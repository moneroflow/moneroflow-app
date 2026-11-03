// Real-time currency conversion service with multi-source fetching and local caching

interface CachedRates {
  xmrUsd: number;
  trxUsd: number;
  fiatRates: Record<string, number>; // rates relative to USD
  fetchedAt: number;
}

const CACHE_KEY = 'moneroflow_currency_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Fetch XMR/USD from multiple sources with fallback ──
async function fetchXmrUsd(): Promise<number> {
  const sources = [
    async () => {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=monero&vs_currencies=usd', { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      return d.monero?.usd;
    },
    async () => {
      const r = await fetch('https://api.kraken.com/0/public/Ticker?pair=XMRUSD', { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      return parseFloat(d.result?.XXMRZUSD?.c?.[0]);
    },
    async () => {
      const r = await fetch('https://min-api.cryptocompare.com/data/price?fsym=XMR&tsyms=USD', { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      return d.USD;
    },
  ];

  for (const src of sources) {
    try {
      const price = await src();
      if (price && price > 0) return price;
    } catch { /* try next */ }
  }
  throw new Error('All XMR price sources failed');
}

// ── Fetch TRX/USD from multiple sources with fallback ──
async function fetchTrxUsd(): Promise<number> {
  const sources = [
    async () => {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd', { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      return d.tron?.usd;
    },
    async () => {
      const r = await fetch('https://min-api.cryptocompare.com/data/price?fsym=TRX&tsyms=USD', { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      return d.USD;
    },
  ];

  for (const src of sources) {
    try {
      const price = await src();
      if (price && price > 0) return price;
    } catch { /* try next */ }
  }
  // Fallback static rate
  return 0.12;
}

// ── Fetch fiat exchange rates relative to USD ──
async function fetchFiatRates(): Promise<Record<string, number>> {
  const sources = [
    async () => {
      const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      return d.rates as Record<string, number>;
    },
    async () => {
      const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      return d.rates as Record<string, number>;
    },
  ];

  for (const src of sources) {
    try {
      const rates = await src();
      if (rates && Object.keys(rates).length > 10) return rates;
    } catch { /* try next */ }
  }
  // Return fallback static rates
  return {
    USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, BRL: 5.05, CAD: 1.36,
    AUD: 1.53, CHF: 0.88, INR: 83.1, MXN: 17.15, NGN: 1550, ZAR: 18.5,
  };
}

function getCache(): CachedRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedRates = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt < CACHE_TTL) return cached;
    return null;
  } catch { return null; }
}

function setCache(rates: CachedRates) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(rates)); } catch { /* ok */ }
}

let fetchPromise: Promise<CachedRates> | null = null;

export async function getRates(): Promise<CachedRates> {
  const cached = getCache();
  if (cached) return cached;

  // Deduplicate concurrent calls
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const [xmrUsd, trxUsd, fiatRates] = await Promise.all([fetchXmrUsd(), fetchTrxUsd(), fetchFiatRates()]);
      const rates: CachedRates = { xmrUsd, trxUsd, fiatRates, fetchedAt: Date.now() };
      setCache(rates);
      return rates;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

// Get stale cache (even expired) as fallback
export function getStaleCache(): CachedRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Conversion helpers ──

/** Convert fiat amount to XMR using live rates */
export function fiatToXmr(fiatAmount: number, fiatCurrency: string, rates: CachedRates): number {
  const fiatToUsd = fiatCurrency === 'USD' ? 1 : (1 / (rates.fiatRates[fiatCurrency] || 1));
  const usdAmount = fiatAmount * fiatToUsd;
  return usdAmount / rates.xmrUsd;
}

/** Convert XMR to fiat using live rates */
export function xmrToFiat(xmrAmount: number, fiatCurrency: string, rates: CachedRates): number {
  const usdAmount = xmrAmount * rates.xmrUsd;
  const fiatRate = rates.fiatRates[fiatCurrency] || 1;
  return usdAmount * fiatRate;
}

/** Get XMR price in a specific fiat currency */
export function getXmrPrice(fiatCurrency: string, rates: CachedRates): number {
  const fiatRate = rates.fiatRates[fiatCurrency] || 1;
  return rates.xmrUsd * fiatRate;
}

/** Convert fiat amount to TRX using live rates */
export function fiatToTrx(fiatAmount: number, fiatCurrency: string, rates: CachedRates): number {
  const fiatToUsd = fiatCurrency === 'USD' ? 1 : (1 / (rates.fiatRates[fiatCurrency] || 1));
  const usdAmount = fiatAmount * fiatToUsd;
  return usdAmount / rates.trxUsd;
}

/** Convert TRX to fiat using live rates */
export function trxFiat(trxAmount: number, fiatCurrency: string, rates: CachedRates): number {
  const usdAmount = trxAmount * rates.trxUsd;
  const fiatRate = rates.fiatRates[fiatCurrency] || 1;
  return usdAmount * fiatRate;
}

/** Get TRX price in a specific fiat currency */
export function getTrxPrice(fiatCurrency: string, rates: CachedRates): number {
  const fiatRate = rates.fiatRates[fiatCurrency] || 1;
  return rates.trxUsd * fiatRate;
}

export function usdToUsdt(usdAmount: number): number {
  return usdAmount; // 1 USD = 1 USDT (pegged)
}

export function fiatToUsdt(fiatAmount: number, fiatCurrency: string, rates: CachedRates): number {
  const fiatToUsd = fiatCurrency === 'USD' ? 1 : (1 / (rates.fiatRates[fiatCurrency] || 1));
  const usdAmount = fiatAmount * fiatToUsd;
  return usdAmount; // USD to USDT (1:1)
}

export function usdtToFiat(usdtAmount: number): number {
  return usdtAmount; // 1 USDT = 1 USD (pegged)
}

export function getUsdtPrice(fiatCurrency: string, rates: CachedRates): number {
  const fiatRate = rates.fiatRates[fiatCurrency] || 1;
  return fiatRate; // USDT mirrors USD rate for other currencies
}
