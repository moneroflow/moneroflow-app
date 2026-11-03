import { REMOTE_NODES } from './node-manager';

// ── Balance Cache ──────────────────────────────────────────────────────────
const BALANCE_CACHE_KEY = 'mf_wallet_balance_cache';

// How far back a FAST sync scans the chain (blocks) on the FIRST-EVER baseline.
// This is the anchoring scan that sets the balance floor, so it must be deep
// enough to capture the wallet's real balance (proof: the original 5000-block
// window found the true balance; a 2000-block window missed ~88% of it because
// the deposits were 32-80h old). ~5000 blocks ≈ 80 hours.
export const FAST_SYNC_BLOCK_WINDOW = 5000;

// Monero mainnet block height floor (~3.4M as of late 2026). A daemon that
// connects but reports 0 or a tiny height is not serving the real chain and
// would silently under-report balances, so fail over to the next node instead.
const MIN_MAINNET_HEIGHT = 1_000_000;

export type SyncDepth = 'fast' | 'full';

export interface BalanceCache {
  balance: number;
  unlockedBalance: number;
  timestamp: number;
  syncMode?: SyncDepth;       // which sync produced / currently governs this value
  restoreHeight?: number;     // restore height used by the scan that wrote this entry
  lastScannedHeight?: number; // height the wallet last finished scanning to — used to
                              // make the NEXT fast sync a small delta instead of a fixed window
  maxBalance?: number;        // high-water mark — never lowered by a fast sync
  maxUnlockedBalance?: number;
}

export function getCachedBalance(): (BalanceCache & { fresh: boolean }) | null {
  try {
    const raw = localStorage.getItem(BALANCE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BalanceCache;
    // Always return cached data — let the caller decide how to display it
    const ageMs = Date.now() - parsed.timestamp;
    return { ...parsed, fresh: ageMs < 2 * 60 * 1000 };
  } catch {
    return null;
  }
}

/**
 * Store a balance result in the cache.
 *
 * A FULL sync scans the entire chain history, so it is authoritative and always
 * sets the high-water mark. A FAST sync only scans recent blocks and may MISS
 * older outputs the wallet owns, so it must NEVER lower the cached balance
 * below the value a FULL sync discovered — otherwise a hasty fast sync would
 * erase a larger, correctly-scanned balance. Fast syncs are only allowed to
 * RAISE the displayed balance (e.g. a fresh deposit seen in the recent window).
 */
export function setCachedBalance(
  balance: number,
  unlockedBalance: number,
  opts?: { depth?: SyncDepth; restoreHeight?: number; lastScannedHeight?: number },
): void {
  const existing = getCachedBalance();
  const now = Date.now();
  const depth: SyncDepth = opts?.depth || 'fast';
  const restoreHeight = opts?.restoreHeight;
  const lastScannedHeight = opts?.lastScannedHeight;

  // FULL sync: authoritative, most complete scan. Always replaces + resets the floor.
  if (depth === 'full') {
    const cache: BalanceCache = {
      balance,
      unlockedBalance,
      timestamp: now,
      syncMode: 'full',
      restoreHeight,
      lastScannedHeight,
      maxBalance: balance,
      maxUnlockedBalance: unlockedBalance,
    };
    localStorage.setItem(BALANCE_CACHE_KEY, JSON.stringify(cache));
    return;
  }

  // FAST sync: never drop below the full-sync high-water mark.
  const floorBalance = existing?.maxBalance ?? balance;
  const floorUnlocked = existing?.maxUnlockedBalance ?? unlockedBalance;
  const displayedBalance = Math.max(balance, floorBalance);
  const displayedUnlocked = Math.max(unlockedBalance, floorUnlocked);
  // If the floor (from a FULL scan) governs the displayed value, mark it as such
  // so the UI can show it is backed by a full scan rather than a partial fast one.
  const governedByFull = displayedBalance > balance;

  const cache: BalanceCache = {
    balance: displayedBalance,
    unlockedBalance: displayedUnlocked,
    timestamp: now,
    syncMode: governedByFull ? 'full' : 'fast',
    restoreHeight,
    // The delta marker advances on every sync (fast OR full) so the next fast
    // sync only rescans the new blocks since this point.
    lastScannedHeight,
    maxBalance: displayedBalance,
    maxUnlockedBalance: displayedUnlocked,
  };
  localStorage.setItem(BALANCE_CACHE_KEY, JSON.stringify(cache));
}

export function clearBalanceCache(): void {
  localStorage.removeItem(BALANCE_CACHE_KEY);
}

/**
 * Real Monero Transaction Sending Service
 *
 * Two modes:
 * 1. "proxy" (Daemon Proxy) — Lazy-loads monero-ts WASM only when sending.
 *    Creates a temporary in-memory wallet from seed, syncs minimally, constructs
 *    and broadcasts the TX, then closes. Lower memory footprint, slower per-send.
 *
 * 2. "wasm" (Full WASM) — Keeps a persistent WASM wallet instance synced in
 *    the background. Instant sends but uses more CPU/memory continuously.
 *
 * Both use the same underlying monero-ts library for real RingCT transaction
 * construction and signing. All keys stay in the browser.
 */

export type SendMode = 'proxy' | 'wasm';

export interface SendRequest {
  recipientAddress: string;
  amountXmr: number;
  priority: number; // 1=normal, 2=elevated, 3=urgent
  note?: string;
}

export interface SendResult {
  success: boolean;
  txHash?: string;
  fee?: number; // in XMR
  error?: string;
}

export interface SyncProgress {
  percent: number;
  height: number;
  targetHeight: number;
  message: string;
}

// Singleton for WASM mode persistent wallet
let persistentWallet: any = null;
let persistentDaemonConnection: any = null;

// Persistent balance-check wallet (Cake-style reuse). Instead of running
// createWalletFull -> sync -> close on every balance check (which repeats the
// expensive ~50MB WASM load + key derivation on each call — the Android
// "stuck at 25%" cost), we keep one wallet open across checks and just
// incremental-sync it. Memory cost is one live wallet, matching how Cake keeps
// a wallet open for background sync.
let balanceWallet: any = null;
let balanceWalletHeight = 0;
let balanceWalletSeed: string | null = null;

function isSecureBrowserContext(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

function normalizeNodeUrl(nodeUrl: string): string {
  return nodeUrl.trim().replace(/\/+$/, '');
}

function getDaemonUrlCandidates(nodeUrl: string): string[] {
  const normalized = normalizeNodeUrl(nodeUrl);
  if (!normalized) return [];

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return [normalized];
  }

  const knownNode = REMOTE_NODES.find((node) => node.url === normalized);
  const candidates = new Set<string>();

  // Production preview runs over HTTPS, so browser wallet nodes must also be HTTPS-capable.
  if (knownNode?.ssl || isSecureBrowserContext() || normalized.includes(':443')) {
    candidates.add(`https://${normalized}`);
  }

  // Only try plain HTTP outside secure browser contexts to avoid mixed-content failures.
  if (!isSecureBrowserContext()) {
    candidates.add(`http://${normalized}`);
  }

  return Array.from(candidates);
}

/**
 * Build an ordered, de-duplicated list of daemon URL candidates for failover.
 * Tries the currently-selected node first (preserving user preference and any
 * low-latency choice), then falls back across every known public REMOTE_NODE
 * in order, so a single silently-dead node can never stall a sync.
 */
function buildFailoverCandidates(nodeUrl: string): string[] {
  const ordered: string[] = [];

  const pushNode = (url: string) => {
    for (const candidate of getDaemonUrlCandidates(url)) {
      if (!ordered.includes(candidate)) {
        ordered.push(candidate);
      }
    }
  };

  // Selected node first, then every public node (skip the one already tried).
  pushNode(nodeUrl);
  for (const node of REMOTE_NODES) {
    if (normalizeNodeUrl(node.url) !== normalizeNodeUrl(nodeUrl)) {
      pushNode(node.url);
    }
  }

  return ordered;
}

// Hard cap on how long a single daemon probe may run. On a mobile connection a
// TLS handshake to a dead/unreachable node can hang for a very long time, and
// because probes run in parallel, ONE stalled probe would block the whole
// failover forever (the Android "stuck at 15%" symptom). Every probe is raced
// against this timeout so nothing can hang the sync.
const DAEMON_PROBE_TIMEOUT_MS = 8_000;

/** Races a promise against a timeout so a hanging call can never block the flow. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('probe timed out')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function connectToReachableDaemon(moneroTs: any, nodeUrl: string): Promise<{ daemon: any; daemonUrl: string; daemonHeight: number }> {
  const candidates = buildFailoverCandidates(nodeUrl);

  // Probe every candidate in parallel, keep only live ones that report a sane
  // mainnet height, then pick the FRESHEST (highest height) — so a node that
  // is connected but silently behind the chain is never chosen over a healthy
  // one. This is the height-freshness standard from Cake's node switching.
  // Each probe is time-boxed (DAEMON_PROBE_TIMEOUT_MS) so a hanging node fails
  // fast instead of stalling the entire failover on a mobile connection.
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const daemon: any = await withTimeout(
          moneroTs.connectToDaemonRpc(candidate),
          DAEMON_PROBE_TIMEOUT_MS,
        );
        const daemonHeight = await withTimeout(daemon.getHeight(), DAEMON_PROBE_TIMEOUT_MS);
        if (!daemonHeight || daemonHeight < MIN_MAINNET_HEIGHT) {
          try { await daemon.close(); } catch {}
          return { candidate, daemon: null as any, daemonHeight: 0 };
        }
        return { candidate, daemon, daemonHeight };
      } catch {
        // Never leak a half-open daemon handle from a probe that failed.
        return { candidate, daemon: null as any, daemonHeight: 0 };
      }
    }),
  );

  // Order by freshness, then by the index of the candidate list (user's node first).
  const live = results.filter(r => r.daemon && r.daemonHeight > 0);
  if (live.length > 0) {
    live.sort((a, b) => {
      if (a.daemonHeight !== b.daemonHeight) return b.daemonHeight - a.daemonHeight;
      return candidates.indexOf(a.candidate) - candidates.indexOf(b.candidate);
    });
    const best = live[0];
    return { daemon: best.daemon, daemonUrl: best.candidate, daemonHeight: best.daemonHeight };
  }

  // Everything failed — close any stray handles and report what we tried.
  for (const r of results) {
    if (r.daemon) { try { await r.daemon.close(); } catch {} }
  }

  const secureHint = isSecureBrowserContext()
    ? ' This app is running over HTTPS, so the connected Monero node must support HTTPS too.'
    : '';

  throw new Error(
    `Could not reach any Monero node. Tried: ${candidates.join(', ') || nodeUrl}.${secureHint}`,
  );
}

function mapSendError(errorMsg: string): SendResult {
  if (errorMsg.includes('Could not reach Monero node')) {
    return { success: false, error: errorMsg };
  }
  if (errorMsg.includes('not enough money') || errorMsg.includes('INSUFFICIENT')) {
    return { success: false, error: 'Insufficient funds to cover amount + network fee.' };
  }
  if (errorMsg.includes('Invalid address')) {
    return { success: false, error: 'Invalid recipient address. Please double-check.' };
  }
  if (
    errorMsg.includes('Request failed without response') ||
    errorMsg.includes('AxiosError: Network Error') ||
    errorMsg.includes('Network Error') ||
    errorMsg.includes('mixed content') ||
    errorMsg.includes('daemon') ||
    errorMsg.includes('connection')
  ) {
    return {
      success: false,
      error: 'Cannot connect to the selected Monero node from this browser. Use an HTTPS-enabled node in Settings → Wallet & Node.',
    };
  }

  return { success: false, error: `Transaction failed: ${errorMsg}` };
}

/**
 * Send real XMR using the daemon proxy approach.
 * Lazy-loads monero-ts, creates a temporary wallet, syncs, sends, closes.
 */
export async function sendViaDaemonProxy(
  seedPhrase: string,
  nodeUrl: string,
  request: SendRequest,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SendResult> {
  let wallet: any = null;

  try {
    onProgress?.({ percent: 5, height: 0, targetHeight: 0, message: 'Loading wallet engine...' });

    // Dynamic import — only loads the ~50MB WASM when actually sending
    const moneroTs = await import('monero-ts');

    onProgress?.({ percent: 15, height: 0, targetHeight: 0, message: 'Connecting to daemon...' });

    const { daemonUrl, daemonHeight } = await connectToReachableDaemon(moneroTs, nodeUrl);

    onProgress?.({ percent: 25, height: 0, targetHeight: daemonHeight, message: 'Creating wallet from seed...' });

    // Create in-memory wallet from mnemonic seed
    wallet = await moneroTs.createWalletFull({
      password: '',
      networkType: moneroTs.MoneroNetworkType.MAINNET,
      seed: seedPhrase,
      server: daemonUrl,
      restoreHeight: Math.max(0, daemonHeight - 5000), // Only sync recent blocks for speed
    });

    onProgress?.({ percent: 35, height: 0, targetHeight: daemonHeight, message: 'Syncing wallet (this may take a moment)...' });

    // Sync the wallet with progress updates
    await wallet.sync(new class extends moneroTs.MoneroWalletListener {
      async onSyncProgress(height: number, startHeight: number, endHeight: number, percentDone: number, _message: string): Promise<void> {
        onProgress?.({
          percent: 35 + Math.floor(percentDone * 40),
          height,
          targetHeight: endHeight,
          message: `Syncing blocks... ${Math.floor(percentDone * 100)}%`,
        });
      }
    });

    onProgress?.({ percent: 80, height: daemonHeight, targetHeight: daemonHeight, message: 'Constructing transaction...' });

    // Get balance check
    const unlockedBalance = await wallet.getUnlockedBalance();
    const amountPico = BigInt(Math.round(request.amountXmr * 1e12));

    if (unlockedBalance < amountPico) {
      return {
        success: false,
        error: `Insufficient unlocked balance. Available: ${Number(unlockedBalance) / 1e12} XMR, Required: ${request.amountXmr} XMR`,
      };
    }

    onProgress?.({ percent: 85, height: daemonHeight, targetHeight: daemonHeight, message: 'Signing and broadcasting...' });

    // Create and relay the transaction
    const tx = await wallet.createTx({
      accountIndex: 0,
      address: request.recipientAddress,
      amount: amountPico.toString(),
      priority: request.priority,
      relay: true, // Broadcast immediately
    });

    const txHash = tx.getHash();
    const fee = Number(tx.getFee()) / 1e12;

    onProgress?.({ percent: 100, height: daemonHeight, targetHeight: daemonHeight, message: 'Transaction broadcast!' });

    // Close the temporary wallet
    await wallet.close();

    // Invalidate balance cache after successful send
    clearBalanceCache();

    return {
      success: true,
      txHash,
      fee,
    };
  } catch (e: any) {
    // Clean up on failure
    try { if (wallet) await wallet.close(); } catch {}

    const errorMsg = e?.message || String(e);
    return mapSendError(errorMsg);
  }
}

/**
 * Send real XMR using the full WASM wallet (persistent, background-synced).
 * The wallet stays open and synced for instant sends.
 */
export async function sendViaWasmWallet(
  seedPhrase: string,
  nodeUrl: string,
  request: SendRequest,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SendResult> {
  try {
    const moneroTs = await import('monero-ts');

    // Reuse or create persistent wallet
    if (!persistentWallet) {
      onProgress?.({ percent: 10, height: 0, targetHeight: 0, message: 'Initializing WASM wallet...' });

      const { daemon, daemonUrl, daemonHeight } = await connectToReachableDaemon(moneroTs, nodeUrl);
      persistentDaemonConnection = daemon;

      persistentWallet = await moneroTs.createWalletFull({
        password: '',
        networkType: moneroTs.MoneroNetworkType.MAINNET,
        seed: seedPhrase,
        server: daemonUrl,
        restoreHeight: Math.max(0, daemonHeight - 10000),
      });

      onProgress?.({ percent: 30, height: 0, targetHeight: daemonHeight, message: 'Initial sync...' });

      await persistentWallet.sync(new class extends moneroTs.MoneroWalletListener {
        async onSyncProgress(height: number, _startHeight: number, endHeight: number, percentDone: number, _message: string): Promise<void> {
          onProgress?.({
            percent: 30 + Math.floor(percentDone * 45),
            height,
            targetHeight: endHeight,
            message: `Syncing... ${Math.floor(percentDone * 100)}%`,
          });
        }
      });

      // Start background sync
      await persistentWallet.startSyncing(30000); // every 30s
    } else {
      // Wallet already exists — quick sync
      onProgress?.({ percent: 50, height: 0, targetHeight: 0, message: 'Quick sync...' });
      await persistentWallet.sync();
    }

    onProgress?.({ percent: 80, height: 0, targetHeight: 0, message: 'Constructing transaction...' });

    const amountPico = BigInt(Math.round(request.amountXmr * 1e12));
    const unlockedBalance = await persistentWallet.getUnlockedBalance();

    if (unlockedBalance < amountPico) {
      return {
        success: false,
        error: `Insufficient unlocked balance. Available: ${Number(unlockedBalance) / 1e12} XMR`,
      };
    }

    onProgress?.({ percent: 90, height: 0, targetHeight: 0, message: 'Broadcasting...' });

    const tx = await persistentWallet.createTx({
      accountIndex: 0,
      address: request.recipientAddress,
      amount: amountPico.toString(),
      priority: request.priority,
      relay: true,
    });

    const txHash = tx.getHash();
    const fee = Number(tx.getFee()) / 1e12;

    onProgress?.({ percent: 100, height: 0, targetHeight: 0, message: 'Transaction broadcast!' });

    // Invalidate balance cache after successful send
    clearBalanceCache();

    return { success: true, txHash, fee };
  } catch (e: any) {
    // If persistent wallet errors, clean it up
    try { if (persistentWallet) { await persistentWallet.close(); persistentWallet = null; } } catch {}

    const errorMsg = e?.message || String(e);
    return mapSendError(errorMsg);
  }
}

/**
 * Close the persistent WASM wallet (cleanup).
 */
export async function closePersistentWallet(): Promise<void> {
  if (persistentWallet) {
    try {
      await persistentWallet.stopSyncing();
      await persistentWallet.close();
    } catch {}
    persistentWallet = null;
    persistentDaemonConnection = null;
  }
  // Also release the persistent balance-check wallet if one is open.
  if (balanceWallet) {
    try { await balanceWallet.close(); } catch {}
    balanceWallet = null;
    balanceWalletHeight = 0;
    balanceWalletSeed = null;
  }
}

/**
 * Get wallet balance using WASM (for full mode).
 */
export async function getWasmWalletBalance(
  seedPhrase: string,
  nodeUrl: string,
): Promise<{ balance: number; unlockedBalance: number } | null> {
  try {
    if (persistentWallet) {
      await persistentWallet.sync();
      const balance = Number(await persistentWallet.getBalance()) / 1e12;
      const unlockedBalance = Number(await persistentWallet.getUnlockedBalance()) / 1e12;
      return { balance, unlockedBalance };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check real on-chain wallet balance.
 * Uses a persistent WASM wallet (created once, reused across checks) and syncs
 * FAST (delta from the last scanned height, or a recent window on first run)
 * or FULL history (back to block 0), reads balances, and caches the result.
 *
 * depth:
 *  - 'fast': scans from the last-synced height (delta) — quick. On the very
 *            first sync it scans a recent window (FAST_SYNC_BLOCK_WINDOW), so it
 *            may miss outputs received/sent longer ago.
 *  - 'full': scans the entire chain back to block 0, so it finds ANY historical
 *            transaction. Slower, but the most complete — and its result has
 *            priority in the cache (never overwritten by a fast sync).
 */
export async function checkWalletBalance(
  seedPhrase: string,
  nodeUrl: string,
  viewAddress?: string,
  viewKey?: string,
  onProgress?: (progress: SyncProgress) => void,
  options?: { depth?: SyncDepth },
): Promise<{ balance: number; unlockedBalance: number }> {
  const depth: SyncDepth = options?.depth || 'fast';

  try {
    onProgress?.({ percent: 5, height: 0, targetHeight: 0, message: 'Loading wallet engine...' });
    const moneroTs = await import('monero-ts');

    onProgress?.({ percent: 15, height: 0, targetHeight: 0, message: 'Connecting to node...' });
    const { daemonUrl, daemonHeight } = await connectToReachableDaemon(moneroTs, nodeUrl);

    let wallet: any = balanceWallet && balanceWalletSeed === seedPhrase ? balanceWallet : null;
    let restoreHeight: number;

    if (depth === 'full') {
      // Full sync — scan the entire chain back to block 0 so any long-ago
      // transaction is found. This requires a fresh wallet at restore 0 (the
      // reusable wallet can't rewind below where it already scanned).
      restoreHeight = 0;
      if (wallet) { try { await wallet.close(); } catch {} }
      wallet = null;
      balanceWallet = null;
      balanceWalletHeight = 0;
      onProgress?.({ percent: 20, height: 0, targetHeight: daemonHeight, message: 'Full sync — scanning the whole chain history (slow)...' });
    } else {
      // Fast sync — continue from where the wallet last finished scanning so
      // repeated fast checks are a tiny delta instead of a fixed 2000-block
      // window every time (Cake's restore-height model). On the very first
      // sync ever (no persisted height, no live wallet) fall back to a recent
      // fixed window so the first check is bounded and quick.
      const cachedLast = getCachedBalance()?.lastScannedHeight ?? 0;
      if (wallet && balanceWalletHeight > 0) {
        restoreHeight = Math.min(balanceWalletHeight, daemonHeight);
      } else if (cachedLast > 0) {
        restoreHeight = Math.min(cachedLast, daemonHeight);
      } else {
        restoreHeight = Math.max(0, daemonHeight - FAST_SYNC_BLOCK_WINDOW);
      }
      onProgress?.({ percent: 20, height: restoreHeight, targetHeight: daemonHeight, message: `Fast sync — scanning since block ${restoreHeight.toLocaleString()}...` });
    }

    onProgress?.({ percent: 25, height: 0, targetHeight: daemonHeight, message: wallet ? 'Using open wallet...' : 'Opening wallet...' });

    if (!wallet) {
      // If there is an open wallet for a different seed (or a full rescan),
      // close it before replacing it with the new one.
      if (balanceWallet) {
        try { await balanceWallet.close(); } catch {}
      }
      wallet = await moneroTs.createWalletFull({
        password: '',
        networkType: moneroTs.MoneroNetworkType.MAINNET,
        seed: seedPhrase,
        server: daemonUrl,
        restoreHeight,
      });
      balanceWallet = wallet;
      balanceWalletHeight = restoreHeight;
      balanceWalletSeed = seedPhrase;
    }

    onProgress?.({ percent: 35, height: 0, targetHeight: daemonHeight, message: depth === 'full' ? 'Syncing full history...' : 'Syncing recent blocks...' });

    // Progressive balance display
    await wallet.sync(new class extends moneroTs.MoneroWalletListener {
      async onSyncProgress(height: number, _startHeight: number, endHeight: number, percentDone: number): Promise<void> {
        // Read partial balance and update UI
        let partialBalance = '0.000000';
        try {
          partialBalance = (Number(await wallet.getBalance()) / 1e12).toFixed(6);
        } catch {}

        onProgress?.({
          percent: 35 + Math.floor(percentDone * 55),
          height,
          targetHeight: endHeight,
          message: `Syncing... ${Math.floor(percentDone * 100)}% (${partialBalance} XMR)`,
        });
      }
    });

    const balance = Number(await wallet.getBalance()) / 1e12;
    const unlockedBalance = Number(await wallet.getUnlockedBalance()) / 1e12;

    // Keep the wallet open for reuse on the next check (walk away cleanly on
    // the rare error path via the catch block), like Cake's background wallet.

    // Update cache — record the depth, restore height and the height we just
    // scanned to so the next fast sync is a delta, and a full-sync result is
    // never overwritten by a fast one.
    setCachedBalance(balance, unlockedBalance, { depth, restoreHeight, lastScannedHeight: daemonHeight });

    onProgress?.({ percent: 100, height: daemonHeight, targetHeight: daemonHeight, message: depth === 'full' ? 'Full sync complete — balance updated' : 'Balance updated' });

    return { balance, unlockedBalance };
  } catch (e: any) {
    try { if (balanceWallet) { await balanceWallet.close(); } } catch {}
    balanceWallet = null;
    balanceWalletHeight = 0;
    balanceWalletSeed = null;
    throw e;
  }
}
