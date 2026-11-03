import { FadeIn } from '@/components/FadeIn';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Paintbrush, Code, Globe, Eye, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';

export default function WhiteLabelPage() {
  const merchant = useStore(s => s.merchant);
  const [brandName, setBrandName] = useState(merchant.name);
  const [brandColor, setBrandColor] = useState('#FF6600');
  const [customDomain, setCustomDomain] = useState('');
  const [hideBranding, setHideBranding] = useState(false);
  const [customLogo, setCustomLogo] = useState('');
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedButton, setCopiedButton] = useState(false);

  const baseUrl = merchant.fqdn ? `https://${merchant.fqdn}` : window.location.origin;

  const embedCode = `<iframe src="${baseUrl}/${merchant.apiKey}/checkout" 
  width="400" height="600" 
  style="border:none;border-radius:16px;" 
  allow="clipboard-write">
</iframe>`;

  const buttonCode = `<a href="${baseUrl}/${merchant.apiKey}/49.99/order" 
   style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;
   background:${brandColor};color:#fff;border-radius:8px;font-weight:600;
   text-decoration:none;font-family:sans-serif;">
  Pay with Monero (XMR)
</a>`;

  const copyCode = (code: string, type: 'embed' | 'button') => {
    navigator.clipboard.writeText(code);
    if (type === 'embed') { setCopiedEmbed(true); setTimeout(() => setCopiedEmbed(false), 2000); }
    else { setCopiedButton(true); setTimeout(() => setCopiedButton(false), 2000); }
    toast.success('Code copied!');
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <FadeIn>
        <h1 className="text-2xl font-bold text-foreground">White-Label & Embeds
          
                <HelpTooltip
                  title="White-Label & Embeds"
                  text="Customize checkout branding with your logo, colors, and custom domain. Generate embeddable checkout widgets and payment buttons for any website."
                />
        </h1>
        <p className="text-muted-foreground text-sm">Customize branding, embed checkout widgets, and create payment buttons</p>
      </FadeIn>

      {/* Branding */}
      <FadeIn delay={0.05}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Paintbrush className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Checkout Branding</h2>
          </div>
          <p className="text-xs text-muted-foreground">Customize the look of customer-facing payment pages.</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-foreground">Brand Name</Label>
              <Input value={brandName} onChange={e => setBrandName(e.target.value)} className="bg-background border-border" placeholder="Your Store Name" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Logo URL</Label>
              <Input value={customLogo} onChange={e => setCustomLogo(e.target.value)} className="bg-background border-border" placeholder="https://yoursite.com/logo.png" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Accent Color</Label>
            <div className="flex items-center gap-3">
              <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent" />
              <Input value={brandColor} onChange={e => setBrandColor(e.target.value)} className="bg-background border-border font-mono text-sm w-32" />
              <div className="h-10 flex-1 rounded-lg" style={{ background: brandColor }} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium text-foreground">Remove "Powered by MoneroFlow"</p>
              <p className="text-xs text-muted-foreground">Available on Pro plan</p>
            </div>
            <Switch checked={hideBranding} onCheckedChange={v => {
              if (merchant.plan !== 'pro') { toast.error('Upgrade to Pro to remove branding'); return; }
              setHideBranding(v);
            }} />
          </div>

          {/* Preview */}
          <div className="p-4 rounded-lg bg-muted/20 border border-border">
            <p className="text-xs text-muted-foreground mb-3">Live Preview:</p>
            <div className="rounded-xl border border-border p-6 text-center space-y-3" style={{ borderColor: brandColor + '40' }}>
              {customLogo ? (
                <img src={customLogo} alt="Logo" className="h-8 mx-auto" />
              ) : (
                <p className="text-lg font-bold text-foreground">{brandName || 'Your Store'}</p>
              )}
              <p className="text-3xl font-bold text-foreground">$49.99</p>
              <p className="font-mono text-sm" style={{ color: brandColor }}>0.298605 XMR</p>
              <div className="w-32 h-32 bg-white rounded-xl mx-auto flex items-center justify-center">
                <div className="w-24 h-24 bg-muted/50 rounded" />
              </div>
              <button className="px-6 py-2.5 rounded-lg text-white text-sm font-semibold" style={{ background: brandColor }}>
                Pay with Monero
              </button>
              {!hideBranding && <p className="text-xs text-muted-foreground">Powered by MoneroFlow</p>}
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Custom Domain */}
      <FadeIn delay={0.08}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Custom Checkout Domain</h2>
          </div>
          <p className="text-xs text-muted-foreground">Host your checkout on your own subdomain for seamless branding.</p>
          <div className="space-y-2">
            <Label className="text-foreground">Custom Domain</Label>
            <Input value={customDomain} onChange={e => setCustomDomain(e.target.value)} className="bg-background border-border font-mono text-sm" placeholder="pay.yourstore.com" />
            <p className="text-xs text-muted-foreground">Add a CNAME record pointing to <code className="text-primary">checkout.moneroflow.com</code></p>
          </div>
          <Button variant="outline" className="border-border hover:border-primary/50" onClick={() => toast.success('Domain verification initiated!')}>
            Verify Domain
          </Button>
        </div>
      </FadeIn>

      {/* Embeddable Checkout */}
      <FadeIn delay={0.1}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Embeddable Checkout Widget</h2>
          </div>
          <p className="text-xs text-muted-foreground">Embed a checkout iframe on any website — works on static HTML, WordPress, custom builds, and more.</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-foreground text-sm">Checkout iFrame</Label>
              <button onClick={() => copyCode(embedCode, 'embed')} className="text-xs text-primary hover:underline flex items-center gap-1">
                {copiedEmbed ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedEmbed ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="p-4 rounded-lg bg-muted/30 border border-border text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {embedCode}
            </pre>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-foreground text-sm">Payment Button</Label>
              <button onClick={() => copyCode(buttonCode, 'button')} className="text-xs text-primary hover:underline flex items-center gap-1">
                {copiedButton ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedButton ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="p-4 rounded-lg bg-muted/30 border border-border text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {buttonCode}
            </pre>
          </div>

          {/* Button Preview */}
          <div className="p-4 rounded-lg bg-muted/20 border border-border">
            <p className="text-xs text-muted-foreground mb-3">Button Preview:</p>
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold text-sm cursor-pointer" style={{ background: brandColor }}>
                <span className="text-base">⬡</span> Pay with Monero (XMR)
              </span>
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.12}>
        <Button className="bg-gradient-orange hover:opacity-90" onClick={() => toast.success('White-label settings saved!')}>
          Save Branding Settings
        </Button>
      </FadeIn>
    </div>
  );
}
