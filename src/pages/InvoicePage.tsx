import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { formatXMR, formatUSDT, formatFiat } from '@/lib/mock-data';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Clock, Copy, AlertTriangle, Eye, FileDown, Loader2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { FadeIn } from '@/components/FadeIn';
import { Progress } from '@/components/ui/progress';
import { MoneroFeeInfo } from '@/components/MoneroFeeInfo';
import { getCheckoutTranslation } from '@/lib/checkout-translations';
import { copyToClipboard } from '@/lib/copy-to-clipboard';

export default function InvoicePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const invoices = useStore(s => s.invoices);
  const merchant = useStore(s => s.merchant);
  const pollInvoicePayment = useStore(s => s.pollInvoicePayment);
  const invoice = invoices.find(i => i.id === id);

  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Determine if this is a TRX/USDT invoice
  const isTrxInvoice = invoice?.chainType === 'trx' && invoice?.trxAddress;

  // Get chain-specific data
  const chainName = isTrxInvoice ? 'TRON (USDT)' : 'Monero (XMR)';
  const cryptoAmount = isTrxInvoice ? invoice?.trxAmount || 0 : invoice?.xmrAmount || 0;
  const cryptoAddress = isTrxInvoice ? invoice?.trxAddress : invoice?.subaddress;
  const cryptoDisplay = isTrxInvoice ? formatUSDT(cryptoAmount) : formatXMR(cryptoAmount);
  const txHash = isTrxInvoice ? invoice?.trxTxID : invoice?.txid;
  const confirmations = isTrxInvoice ? invoice?.trxConfirmations : invoice?.confirmations;
  const reqConfirmations = isTrxInvoice ? 19 : 10;

  // Get translations
  const t = useMemo(() => getCheckoutTranslation(), []);
  const sym = merchant.fiatSymbol || '$';
  const cur = merchant.fiatCurrency || 'USD';

  // Apply chain-specific theme
  useEffect(() => {
    if (!invoice) return;
    
    const root = document.documentElement;
    
    if (isTrxInvoice) {
      // Apply TRON theme
      const currentTheme = root.classList.contains('dark') ? 'dark' : Array.from(root.classList).find(c => c.startsWith('theme-')) || 'dark';
      localStorage.setItem('mf-previous-theme', currentTheme);
      root.classList.remove('dark', 'theme-light', 'theme-rose', 'theme-lavender', 'theme-mint', 'theme-peach');
      root.classList.add('theme-tron');
    } else {
      // Restore XMR theme
      const previousTheme = localStorage.getItem('mf-previous-theme') || 'dark';
      root.classList.remove('theme-tron');
      if (previousTheme === 'dark') {
        root.classList.add('dark');
      } else if (previousTheme.startsWith('theme-')) {
        root.classList.add(previousTheme);
      }
    }

    // Cleanup on unmount
    return () => {
      if (!isTrxInvoice) {
        root.classList.remove('theme-tron');
        const previousTheme = localStorage.getItem('mf-previous-theme') || 'dark';
        if (previousTheme === 'dark') {
          root.classList.add('dark');
        } else if (previousTheme.startsWith('theme-')) {
          root.classList.add(previousTheme);
        }
      }
    };
  }, [invoice, isTrxInvoice]);

  // Countdown timer
  useEffect(() => {
    if (!invoice || invoice.status !== 'pending') return;
    const interval = setInterval(() => {
      const diff = new Date(invoice.expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft(t.expired); return; }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [invoice, t]);

  // Poll for payment every 12 seconds
  useEffect(() => {
    if (!invoice || !id) return;
    if (invoice.status === 'paid' || invoice.status === 'expired' || invoice.status === 'overpaid') return;

    const poll = async () => {
      try {
        await pollInvoicePayment(id);
      } catch (e) {
        console.error('Poll error:', e);
      }
    };

    poll();
    const interval = setInterval(poll, 12000);
    return () => clearInterval(interval);
  }, [id, invoice?.status, pollInvoicePayment]);

  if (!invoice) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">{t.invoiceNotFound}</h1>
          <p className="text-muted-foreground">This invoice doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const copyAddress = async () => {
    const success = await copyToClipboard(cryptoAddress);
    if (success) {
      setCopied(true);
      toast.success(t.copied + '!');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy address');
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'paid': return 'bg-success/10 text-success border-success/20';
      case 'pending': return 'bg-warning/10 text-warning border-warning/20';
      case 'seen_on_chain': case 'confirming': return 'bg-primary/10 text-primary border-primary/20';
      case 'underpaid': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'overpaid': return 'bg-success/10 text-success border-success/20';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) navigate('/dashboard/invoices'); }}>
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[120px] ${
        isTrxInvoice ? 'bg-orange-500/5' : 'bg-primary/5'
      }`} />
      <FadeIn className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <BrandLogo linkTo="/dashboard/invoices" />
        </div>

        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground font-mono">{invoice.id}</p>
                <p className="text-sm font-medium text-foreground mt-1">{invoice.description}</p>
                {invoice.subaddressIndex !== undefined && !isTrxInvoice && (
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">subaddr idx: {invoice.subaddressIndex}</p>
                )}
              </div>
              <Badge variant="outline" className={statusColor(invoice.status)}>
                {invoice.status === 'paid' && <Check className="w-3 h-3 mr-1" />}
                {invoice.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                {(invoice.status === 'seen_on_chain' || invoice.status === 'confirming') && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                {(invoice.status === 'expired' || invoice.status === 'underpaid') && <AlertTriangle className="w-3 h-3 mr-1" />}
                {invoice.status}
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{formatFiat(invoice.fiatAmount, sym, cur)}</p>
              <p className={`font-mono text-sm mt-1 flex items-center justify-center gap-1 ${
                isTrxInvoice ? 'text-orange-500' : 'text-primary'
              }`}>
                {cryptoDisplay}
              </p>
            </div>
          </div>

          {(invoice.status === 'pending' || invoice.status === 'seen_on_chain' || invoice.status === 'confirming') && (
            <>
              <div className="p-6 flex flex-col items-center">
                <div className="bg-foreground p-3 rounded-xl mb-4">
                  {isTrxInvoice ? (
                    // TRX QR code
                    <QRCodeSVG 
                      value={`https://tronscan.org/#/transfer?to=${cryptoAddress}&amount=${cryptoAmount}&tokenId=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`}
                      size={180} 
                      bgColor="#fafafa" 
                      fgColor="#f97316" 
                    />
                  ) : (
                    // XMR QR code
                    <QRCodeSVG 
                      value={`monero:${cryptoAddress}?tx_amount=${cryptoAmount.toFixed(6)}`} 
                      size={180} 
                      bgColor="#fafafa" 
                      fgColor="#09090b" 
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">{t.sendExactly}</p>
                <p className={`font-mono text-sm font-medium mb-4 ${
                  isTrxInvoice ? 'text-orange-500' : 'text-primary'
                }`}>{cryptoDisplay}</p>
                <div className="w-full bg-muted/30 rounded-lg p-3 mb-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    {isTrxInvoice ? 'To this TRON address' : t.toSubaddress}
                  </p>
                  <p className="font-mono text-[10px] text-foreground break-all leading-relaxed">{cryptoAddress}</p>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Button variant="outline" size="sm" onClick={copyAddress} className="border-border hover:border-primary/50">
                    {copied ? <Check className="w-3 h-3 mr-1.5" /> : <Copy className="w-3 h-3 mr-1.5" />}
                    {copied ? t.copied : t.copyAddress}
                  </Button>
                </div>

                {invoice.status === 'confirming' && confirmations !== undefined && (
                  <div className="w-full mt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{t.confirmations}</span>
                      <span className="font-mono text-foreground">{confirmations}/{reqConfirmations}</span>
                    </div>
                    <Progress value={Math.min(100, (confirmations / reqConfirmations) * 100)} className="h-1.5" />
                  </div>
                )}

                {txHash && (
                  <div className="w-full mt-3 bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">{t.txId}</p>
                    <p className="font-mono text-[10px] text-foreground break-all">{txHash}</p>
                  </div>
                )}

                {timeLeft && invoice.status === 'pending' && (
                  <p className="text-xs text-muted-foreground mt-4">{t.expiresIn} <span className="text-warning font-mono">{timeLeft}</span></p>
                )}

                {/* Fee info only for XMR */}
                {!isTrxInvoice && (
                  <div className="w-full mt-3">
                    <MoneroFeeInfo />
                  </div>
                )}
              </div>
              <div className="px-6 pb-4">
                <p className="text-[10px] text-muted-foreground text-center">
                  {t.scanQrCode} · Checking every 12s via {isTrxInvoice ? 'TRON blockchain' : 'block explorer'}...
                </p>
              </div>
            </>
          )}

          {invoice.status === 'paid' && (
            <div className="p-6 space-y-4">
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4`}>
                  <Check className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">{t.paymentConfirmed}</h3>
                <p className="text-sm text-muted-foreground">
                  {cryptoDisplay} received on {invoice.paidAt ? new Date(invoice.paidAt).toLocaleString() : ''}
                </p>
                {confirmations !== undefined && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{t.confirmations}</span>
                      <span className="font-mono text-foreground">{confirmations}/{reqConfirmations}</span>
                    </div>
                    <Progress value={Math.min(100, (confirmations / reqConfirmations) * 100)} className="h-1.5" />
                  </div>
                )}
              </div>

              {txHash && (
                <div className="space-y-2 pt-3 border-t border-border">
                  <p className="text-xs font-medium text-foreground">Transaction Proof</p>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">{t.txId}</p>
                    <p className="font-mono text-[10px] text-foreground break-all">{txHash}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.open(
                      isTrxInvoice 
                        ? `https://tronscan.org/#/transaction/${txHash}`
                        : `https://xmrchain.net/tx/${txHash}`,
                      '_blank'
                    )} className="border-border hover:border-primary/50 text-xs flex-1">
                      <Eye className="w-3 h-3 mr-1" /> View on Explorer
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toast.info('Payment proof PDF export coming soon!')} className="border-border hover:border-primary/50 text-xs">
                      <FileDown className="w-3 h-3 mr-1" /> Export
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {invoice.status === 'expired' && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">{t.expired}</h3>
              <p className="text-sm text-muted-foreground">This invoice is no longer valid.</p>
            </div>
          )}

          {invoice.status === 'underpaid' && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">{t.underpaid}</h3>
              <p className="text-sm text-muted-foreground">{t.underpaid}</p>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
