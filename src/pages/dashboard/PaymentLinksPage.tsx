'use client';

import { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { formatFiat } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FadeIn } from '@/components/FadeIn';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Plus, Copy, Trash2, ExternalLink, Upload, Power, PowerOff, ShoppingBag, Bitcoin, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { isNative } from '@/lib/native';

export default function PaymentLinksPage() {
  const createPaymentLink = useStore((state) => state.createPaymentLink);
  const deletePaymentLink = useStore((state) => state.deletePaymentLink);
  const togglePaymentLink = useStore((state) => state.togglePaymentLink);
  const importFromPos = useStore((state) => state.importFromPos);
  const paymentLinks = useStore((state) => state.paymentLinks) || [];
  const posInventory = useStore((state) => state.merchant.posQuickButtons) || [];

  const merchant = useStore((state) => state.merchant) || {};
  const sym = merchant.fiatSymbol ?? '$';
  const cur = merchant.fiatCurrency ?? 'USD';
  const fqdn = merchant.fqdn ?? '';
  const payoutAddress = merchant.viewOnlyAddress ?? merchant.settlementAddress ?? merchant.primarySubaddress ?? '';
  const tronAddress = merchant.tronAddress ?? '';

  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [importing, setImporting] = useState(false);

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    if (fqdn) {
      return `https://${fqdn}`;
    }
    // Always point at the local webserver the app is actually served from
    // (where the merchant's wallet state lives). On a native (Capacitor)
    // build that's the in-app origin the WebView is loaded from; on the
    // PWA it's the hosted origin. The link only carries a public receive
    // address + amount (no secret).
    return window.location.origin;
  }, [fqdn]);

  const buildPayUrl = (link) => {
    const path = `/pay/${link.uniqueId}/${link.fiatAmount}/${link.slug}`;
    // Query params must sit inside the hash for HashRouter (native) so the
    // pay page can read them; BrowserRouter (web) uses the raw path.
    const query = new URLSearchParams();
    // Use the correct address based on chain type
    const linkAddress = link.chainType === 'trx' ? tronAddress : payoutAddress;
    if (linkAddress) {
      query.set('address', linkAddress);
    }
    query.set('currency', link.fiatCurrency || cur);
    query.set('symbol', sym);
    query.set('chain', link.chainType || 'xmr');
    const qs = query.toString();
    const pathWithQuery = `${path}?${qs}`;
    // HashRouter (native): routes live after the '#', so '/pay/...' must be '#/pay/...'
    const route = isNative() ? `#${pathWithQuery}` : pathWithQuery;
    return `${baseUrl}/${route}`;
  };

  const handleCreate = async () => {
    if (!label || Number.isNaN(Number(amount))) {
      return;
    }
    // Check for appropriate wallet based on chain
    if (!payoutAddress) {
      toast.error('Add a wallet receiving address first in Settings → Wallet & Node.');
      return;
    }
    try {
      const baseSlug = slug ? slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') : label.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Automatically create BOTH XMR and TRX payment links
      await createPaymentLink(`${baseSlug}`, Number(amount), label, cur, 'xmr');
      await createPaymentLink(`${baseSlug}`, Number(amount), label, cur, 'trx');

      toast.success(`Created dual payment links: Monero (XMR) and TRON (USDT)`);
      setOpen(false);
      setSlug('');
      setAmount('');
      setLabel('');
      setDescription('');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to create payment link';
      toast.error(message);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const importedCount = await importFromPos();
      toast.success(`Imported ${importedCount} items from POS!`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to import from POS';
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  const copyLink = async (link) => {
    const fullUrl = buildPayUrl(link);
    const success = await copyToClipboard(fullUrl);
    if (success) {
      toast.success('Payment link copied to clipboard!');
    } else {
      toast.error('Failed to copy link. Please select and copy the URL manually.');
    }
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              Payment Links
              <HelpTooltip
                title="Payment Links"
                text="Create reusable payment links for products. Each link has a unique QR code that customers can scan to pay multiple times. Perfect for online shops with persistent checkout buttons."
              />
            </h1>
            <p className="text-muted-foreground text-sm">Reusable links with QR codes for multiple payments</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleImport} disabled={importing}>
              <Upload className="w-4 h-4 mr-2" />
              Import from POS
              <HelpTooltip
                title="Import from POS"
                text="Import all your POS inventory items as payment links. Each product gets a reusable URL and QR code based on its label and price."
              />
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-orange hover:opacity-90"><Plus className="w-4 h-4 mr-2" /> New Link</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle className="text-foreground">Create Payment Link</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label className="text-foreground">Product Name</Label>
                    <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="T-Shirt" className="bg-background border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Premium cotton t-shirt" className="bg-background border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Price ({cur})</Label>
                    <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="29.99" className="bg-background border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">URL Slug</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs font-mono truncate max-w-[160px]">{baseUrl}/pay/$/</span>
                      <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="t-shirt" className="bg-background border-border font-mono text-sm" />
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    💡 This will automatically generate TWO payment links: one for Monero (XMR) and one for TRON (USDT).
                  </div>
                  <Button onClick={handleCreate} className="w-full bg-gradient-orange hover:opacity-90">Create Link</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          {paymentLinks.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <p>No payment links yet. Create one manually or click "Import from POS" to auto-generate from your inventory.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {paymentLinks.map((link) => (
                <FadeIn key={link.id} delay={0.06}>
                  <div className="p-6 hover:bg-muted/10 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground truncate">{link.label}</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => togglePaymentLink(link.id)}
                          >
                            {link.active ? <Power className="w-4 h-4 text-success" /> : <PowerOff className="w-4 h-4 text-muted-foreground" />}
                          </Button>
                          {link.chainType === 'trx' ? (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs gap-1.5 py-1 ml-2">
                              <Activity className="w-3 h-3" />
                              <span>TRON (USDT)</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs gap-1.5 py-1 ml-2">
                              <Bitcoin className="w-3 h-3" />
                              <span>Monero</span>
                            </Badge>
                          )}
                          {!link.active && <span className="text-xs text-muted-foreground">(inactive)</span>}
                        </div>
                        {link.description && (
                          <p className="text-sm text-muted-foreground mb-3">{link.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-foreground font-semibold">{formatFiat(link.fiatAmount, sym, cur)}</span>
                          <span className="text-muted-foreground">{link.fiatCurrency}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{link.totalUses} uses</span>
                        </div>
                        <div className="mt-3">
                          <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono">
                            {buildPayUrl(link)}
                          </code>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Button variant="outline" size="sm" onClick={() => copyLink(link)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                          if (typeof window !== 'undefined') {
                            const url = buildPayUrl(link);
                            // On native (HashRouter) navigate the same WebView so the
                            // in-app pay page renders (wallet state is here); on web
                            // open the pay page in a new tab.
                            if (isNative()) {
                              window.location.href = url;
                            } else {
                              window.open(url, '_blank');
                            }
                          }
                        }} className="text-muted-foreground hover:text-primary">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                          if (confirm('Delete this payment link?')) {
                            deletePaymentLink(link.id);
                            toast.success('Link deleted');
                          }
                        }} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
