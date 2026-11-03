'use client';

import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { formatXMR, XMR_USD_RATE } from '@/lib/mock-data';
import { useStore } from '@/lib/store';
import { QRCodeSVG } from 'qrcode.react';
import { Badge } from '@/components/ui/badge';
import { MoneroLogo } from '@/components/BrandLogo';
import { ArrowLeft, Check, Clock, Copy, Loader2 } from 'lucide-react';
import { isNative } from '@/lib/native';
import { toast } from 'sonner';
import { PaymentProgress } from '@/components/PaymentProgress';
import { TrxPaymentProgress } from '@/components/TrxPaymentProgress';
import { TrxQRCode } from '@/components/TrxQRCode';
import { fiatToXmr, getRates, getStaleCache, getXmrPrice } from '@/lib/currency-service';
import { useRates } from '@/hooks/use-rates';

export default function PayPage() {
  const navigate = useNavigate();
  const { uniqueId, amount, label } = useParams();
  const fiatAmount = parseFloat(amount || '0');
  const search = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
  const displayCurrency = (search.get('currency') || 'USD').toUpperCase();
  const displaySymbol = search.get('symbol') || (displayCurrency === 'USD' ? '$' : `${displayCurrency} `);
  const chainType = (search.get('chain') || 'xmr') as 'xmr' | 'trx' | 'eth' | 'arb';

  const pollInvoicePayment = useStore(s => s.pollInvoicePayment);
  const createInvoice = useStore(s => s.createInvoice);
  const createTrxInvoice = useStore(s => s.createTrxInvoice);
  const updateInvoice = useStore(s => s.updateInvoice);
  const invoices = useStore(s => s.invoices);
  const paymentLinks = useStore(s => s.paymentLinks);
  const merchant = useStore(s => s.merchant);
  const { rates } = useRates();

  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [subaddress, setSubaddress] = useState('');
  const [trxAddress, setTrxAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(3600);
  const [copied, setCopied] = useState(false);
  const [xmrAmount, setXmrAmount] = useState(0);
  const [trxAmount, setTrxAmount] = useState(0);
  const [referenceRate, setReferenceRate] = useState(XMR_USD_RATE);

  const invoice = invoices.find(i => i.id === invoiceId);
  const paid = invoice?.status === 'paid';
  const confirming = invoice?.status === 'confirming';
  const seenOnChain = invoice?.status === 'seen_on_chain';
  const failed = (invoice?.status === 'expired' || invoice?.status === 'cancelled');

  // Find payment link by uniqueId (prevents clashes across users)
  const paymentLink = uniqueId
    ? paymentLinks.find(pl => pl.uniqueId === uniqueId)
    : null;
  const isInactivePaymentLink = paymentLink && !paymentLink.active;

  const formattedFiatAmount = `${displaySymbol}${fiatAmount.toFixed(2)}${displayCurrency === 'USD' ? '' : ` ${displayCurrency}`}`;
  const isTrxPayment = chainType === 'trx';

  // Calculate USDT amount from fiat (for TRX invoice creation)
  const [usdtAmount, setUsdtAmount] = useState(0);

  // Fetch live rates
  useEffect(() => {
    let active = true;

    const loadQuote = async () => {
      try {
        const rates = await getRates();
        if (!active) return;

        if (isTrxPayment) {
          // For USDT: fiat → USDT conversion
          const usd = fiatAmount / (rates.fiatRates[displayCurrency] || 1);
          setUsdtAmount(usd);
          setTrxAmount(usd); // USDT amount = USD amount (1:1 peg)
          setReferenceRate(rates.fiatRates[displayCurrency] || 1);
        } else {
          setXmrAmount(fiatToXmr(fiatAmount, displayCurrency, rates));
          setReferenceRate(getXmrPrice(displayCurrency, rates));
        }
      } catch {
        const stale = getStaleCache();
        if (stale && active) {
          if (isTrxPayment) {
            const usd = fiatAmount / (stale.fiatRates[displayCurrency] || 1);
            setUsdtAmount(usd);
            setTrxAmount(usd);
            setReferenceRate(stale.fiatRates[displayCurrency] || 1);
          } else {
            setXmrAmount(fiatToXmr(fiatAmount, displayCurrency, stale));
            setReferenceRate(getXmrPrice(displayCurrency, stale));
          }
        }
      }
    };

        if (fiatAmount > 0) loadQuote();
        return () => { active = false; };
    }, [displayCurrency, fiatAmount, isTrxPayment]);

    // Check if merchant has TRON wallet for USDT payments
    // Wait for store to hydrate — if merchant object is still default, don't error yet
    useEffect(() => {
      if (isTrxPayment && merchant.tronAddress === undefined) {
        // Store might not be hydrated yet, don't error immediately
        return;
      }
      if (isTrxPayment && !merchant.tronAddress) {
        setError('USDT payments require multi-chain wallet to be enabled. Please contact the merchant.');
        setLoading(false);
      }
    }, [isTrxPayment, merchant.tronAddress]);

    // Apply TRON theme for USDT payments
  useEffect(() => {
    if (isTrxPayment) {
      const previousTheme = localStorage.getItem('mf-theme') || 'dark';
      localStorage.setItem('mf-previous-theme', previousTheme);
      document.documentElement.classList.remove('dark', 'theme-light', 'theme-rose', 'theme-lavender', 'theme-mint', 'theme-peach');
      document.documentElement.classList.add('theme-tron');
    }
    return () => {
      // Restore previous theme on unmount
      if (isTrxPayment) {
        const prev = localStorage.getItem('mf-previous-theme') || 'dark';
        document.documentElement.classList.remove('theme-tron');
        if (prev === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (prev.startsWith('theme-')) {
          document.documentElement.classList.add(prev);
        }
      }
    };
  }, [isTrxPayment]);

  // Create NEW invoice on each payment link visit
  // The payment link URL stays the same, but each session gets unique subaddress/invoice
  useEffect(() => {
    if (!fiatAmount || fiatAmount <= 0) {
      setLoading(false);
      return;
    }

    // Wait for required wallet address before creating invoice
    if (isTrxPayment && !merchant.tronAddress) {
      // Store not hydrated yet or no TRX wallet — will re-run when merchant.tronAddress changes
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const invoiceDescription = label
          ? `Payment Link: ${decodeURIComponent(label).replace(/-/g, ' ')}`
          : 'Payment Link';

        let inv;

        if (isTrxPayment) {
          // Create TRX invoice — pass USD amount (for USDT 1:1) and local fiat amount for display
          inv = await createTrxInvoice(invoiceDescription, usdtAmount || fiatAmount, fiatAmount);
        } else {
          // Create XMR invoice
          inv = await createInvoice(invoiceDescription, fiatAmount);
        }

        // Check if cancelled before setting state
        if (cancelled) return;

        // Link invoice to payment link for analytics
        if (paymentLink?.id) {
          updateInvoice(inv.id, {
            description: invoiceDescription,
          });
        }

        if (isTrxPayment) {
          setTrxAddress(inv.trxAddress || '');
        } else {
          setSubaddress(inv.subaddress);
        }
        setInvoiceId(inv.id);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message || 'Failed to create payment address. Check RPC connection.');
        }
      }
      if (!cancelled) {
        setLoading(false);
      }
    };

    init();

    // Cleanup function to cancel if effect re-runs
    return () => {
      cancelled = true;
    };
  }, [createInvoice, createTrxInvoice, updateInvoice, fiatAmount, uniqueId, paymentLink, isTrxPayment, merchant.tronAddress]);

  // Poll for payment confirmation (more frequent for payment links)
  useEffect(() => {
    if (!invoiceId || paid) return;
    const interval = setInterval(() => {
      pollInvoicePayment(invoiceId);
    }, 8000);
    return () => clearInterval(interval);
  }, [invoiceId, paid]);

  // Countdown timer
  useEffect(() => {
    if (paid) return;
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(v => v - 1), 1000);
    return () => clearInterval(t);
  }, [paid, timeLeft]);

  const copyAddr = () => {
    const addr = isTrxPayment ? trxAddress : subaddress;
    try {
      navigator.clipboard.writeText(addr).then(() => {
        setCopied(true);
        toast.success(isTrxPayment ? 'TRX address copied!' : 'XMR address copied!');
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        const t = document.createElement('textarea');
        t.value = addr;
        t.style.position = 'fixed';
        t.style.opacity = '0';
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        document.body.removeChild(t);
        setCopied(true);
        toast.success(isTrxPayment ? 'TRX address copied!' : 'XMR address copied!');
        setTimeout(() => setCopied(false), 2000);
      });
    } catch {
      toast.error('Failed to copy address');
    }
  };

  if (!fiatAmount || fiatAmount <= 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">Invalid payment link.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className={`w-8 h-8 animate-spin mx-auto ${isTrxPayment ? 'text-orange-500' : 'text-primary'}`} />
          <p className="text-muted-foreground text-sm">Preparing payment checkout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-destructive font-medium">Connection Error</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (isInactivePaymentLink) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-muted-foreground font-medium">Payment Link Inactive</p>
          <p className="text-muted-foreground text-sm">This payment link has been disabled by the merchant and is no longer accepting payments.</p>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className={`rounded-2xl bg-card border border-border p-8 space-y-6 ${isTrxPayment ? 'border-orange-500/30' : ''}`}>
          {isNative() && (
            <button
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <div className="text-center">
            <MoneroLogo size={32} />
            <h1 className="text-xl font-bold text-foreground mt-3">
              {label ? decodeURIComponent(label).replace(/-/g, ' ') : 'Payment'}
            </h1>
            <p className={`text-sm mt-1 ${isTrxPayment ? 'text-orange-500' : 'text-muted-foreground'}`}>{isTrxPayment ? 'Pay with TRON (USDT)' : 'Pay with Monero (XMR)'}</p>
          </div>

          {paid ? (
            <div className="text-center py-8 space-y-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${isTrxPayment ? 'bg-orange-500/20' : 'bg-success/20'}`}>
                <Check className={`w-10 h-10 ${isTrxPayment ? 'text-orange-500' : 'text-success'}`} />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Payment Confirmed!</h2>
              <p className="text-muted-foreground">{formattedFiatAmount} received - thank you!</p>
              {(invoice?.txid || invoice?.trxTxID) && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">Transaction ID</p>
                  <p className="font-mono text-[10px] text-foreground break-all">{invoice?.txid || invoice?.trxTxID}</p>
                </div>
              )}
            </div>
          ) : confirming ? (
            <div className="text-center py-8 space-y-4">
              <Loader2 className={`w-12 h-12 animate-spin mx-auto ${isTrxPayment ? 'text-orange-500' : 'text-primary'}`} />
              <h2 className="text-xl font-bold text-foreground">Confirming Payment...</h2>
              <p className="text-muted-foreground text-sm">
                {isTrxPayment
                  ? 'Your payment is being confirmed on the TRON network. This usually takes ~1 minute.'
                  : 'Your payment is being confirmed on the blockchain. This usually takes 2-5 minutes.'}
              </p>
            </div>
          ) : seenOnChain ? (
            <div className="text-center py-8 space-y-4">
              <Loader2 className={`w-12 h-12 animate-spin mx-auto ${isTrxPayment ? 'text-orange-500' : 'text-primary'}`} />
              <h2 className="text-xl font-bold text-foreground">Payment Detected!</h2>
              <p className="text-muted-foreground text-sm">
                Your transaction has been detected. Waiting for final confirmation...
              </p>
            </div>
          ) : failed ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-destructive font-medium">Payment Failed or Expired</p>
              <p className="text-muted-foreground text-sm">
                {invoice?.status === 'expired'
                  ? 'This invoice has expired. Please refresh and try again.'
                  : 'Please try again or contact the merchant.'}
              </p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="text-4xl font-bold text-foreground">{formattedFiatAmount}</p>
                <p className={`font-mono mt-1 ${isTrxPayment ? 'text-orange-500' : 'text-primary'}`}>
                  {isTrxPayment ? `${(usdtAmount || trxAmount).toFixed(2)} USDT` : formatXMR(xmrAmount)}
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  {isTrxPayment
                    ? `1 USDT = ${displaySymbol}${(rates?.fiatRates?.[displayCurrency] || 1).toFixed(2)} ${displayCurrency}`
                    : `1 XMR = ${displaySymbol}${referenceRate.toFixed(2)} ${displayCurrency}`}
                </p>
              </div>

              {isTrxPayment ? (
                <TrxQRCode address={trxAddress} amount={usdtAmount || trxAmount} onCopy={copyAddr} />
              ) : (
                <>
                  <div className="flex justify-center">
                    <div className="bg-white rounded-2xl p-5">
                      <QRCodeSVG value={`monero:${subaddress}?tx_amount=${xmrAmount.toFixed(12)}`} size={200} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">Send exactly to this address:</p>
                    <button onClick={copyAddr} className="w-full p-3 rounded-lg bg-muted/30 border border-border text-xs font-mono text-muted-foreground break-all hover:border-primary/30 transition-colors text-left">
                      {subaddress}
                    </button>
                    <div className="flex items-center justify-between">
                      <button onClick={copyAddr} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Copy className="w-3 h-3" /> {copied ? 'Copied!' : 'Copy address'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Payment progress */}
              {invoiceId && (
                isTrxPayment ? (
                  <TrxPaymentProgress
                    invoiceId={invoiceId}
                    fiatAmount={fiatAmount}
                    trxAmount={usdtAmount || trxAmount}
                    address={trxAddress}
                  />
                ) : (
                  <PaymentProgress
                    invoiceId={invoiceId}
                    fiatAmount={fiatAmount}
                    xmrAmount={xmrAmount}
                    subaddress={subaddress}
                  />
                )
              )}
            </>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Powered by <span className={isTrxPayment ? 'text-orange-500 font-medium' : 'text-primary font-medium'}>MoneroFlow</span>
          </p>
        </div>
      </div>
    </div>
  );
}
