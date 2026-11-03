import { FadeIn } from '@/components/FadeIn';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ShoppingBag, ShoppingCart, Zap, Webhook, ArrowRight, Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const plugins = [
  {
    id: 'shopify',
    name: 'Shopify',
    icon: ShoppingBag,
    description: 'Accept XMR on your Shopify store. Auto-syncs products, shows live XMR pricing at checkout, handles order status updates.',
    status: 'available' as const,
    features: ['One-click install from Shopify App Store', 'Auto product mapping', 'Live XMR conversion at checkout', 'Order status sync (Paid → Fulfilled)', 'VAT/tax handling on local currency side'],
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    icon: ShoppingCart,
    description: 'WordPress plugin for WooCommerce stores. Drop-in checkout gateway with XMR payment option and automatic order management.',
    status: 'available' as const,
    features: ['WordPress plugin install', 'WooCommerce gateway integration', 'Multi-currency display (EUR, GBP, USD → XMR)', 'Webhook-based order updates', 'Compatible with all WooCommerce themes'],
  },
];

const automations = [
  {
    id: 'zapier',
    name: 'Zapier',
    icon: Zap,
    description: 'Connect MoneroFlow to 5,000+ apps. Trigger workflows on payment events.',
    examples: ['Payment received → Create QuickBooks invoice', 'New customer → Add to HubSpot CRM', 'Auto-sweep → Update Google Sheets'],
  },
  {
    id: 'make',
    name: 'Make.com',
    icon: Webhook,
    description: 'Visual automation builder for complex workflows with MoneroFlow triggers.',
    examples: ['Invoice paid → Send Telegram notification', 'Subscription created → Email welcome sequence', 'Daily revenue → Slack summary'],
  },
  {
    id: 'n8n',
    name: 'n8n',
    icon: Webhook,
    description: 'Self-hosted automation. Full control over your payment event workflows.',
    examples: ['Payment confirmed → Update inventory DB', 'Sweep complete → Log to custom dashboard', 'New merchant signup → Onboard flow'],
  },
];

export default function IntegrationsPage() {
  const [webhookUrls, setWebhookUrls] = useState<Record<string, string>>({});
  const [enabledAutomations, setEnabledAutomations] = useState<Record<string, boolean>>({});
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const installSnippet = `<script src="https://cdn.moneroflow.com/plugins/shopify.js" data-api-key="mf_live_k8x92mzp4q7r1t5y"></script>`;

  const copySnippet = () => {
    navigator.clipboard.writeText(installSnippet);
    setCopiedSnippet(true);
    toast.success('Install snippet copied!');
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const testWebhook = async (platform: string) => {
    const url = webhookUrls[platform];
    if (!url) {
      toast.error('Please enter a webhook URL first');
      return;
    }
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors',
        body: JSON.stringify({
          event: 'test_ping',
          timestamp: new Date().toISOString(),
          source: 'moneroflow',
        }),
      });
      toast.success(`Test event sent to ${platform}. Check your workflow history.`);
    } catch {
      toast.error('Failed to send test event. Check the URL.');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <FadeIn>
        <h1 className="text-2xl font-bold text-foreground">Integrations
          
                <HelpTooltip
                  title="Integrations"
                  text="Connect MoneroFlow to your store platform (Shopify, WooCommerce) and automate workflows with Zapier, Make, or n8n."
                />
        </h1>
        <p className="text-muted-foreground text-sm">Connect MoneroFlow to your store platform and automate workflows</p>
      </FadeIn>

      {/* E-Commerce Plugins */}
      <FadeIn delay={0.05}>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" /> E-Commerce Plugins
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {plugins.map(plugin => (
            <div key={plugin.id} className="p-6 rounded-xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <plugin.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{plugin.name}</h3>
                    <Badge variant="outline" className="text-xs text-success border-success/20">Ready to Install</Badge>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{plugin.description}</p>
              <ul className="space-y-1.5">
                {plugin.features.map((f, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <Check className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full bg-gradient-orange hover:opacity-90" onClick={() => toast.success(`${plugin.name} plugin installed! Configure in your ${plugin.name} admin.`)}>
                Install Plugin <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* Install Snippet */}
      <FadeIn delay={0.08}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-3">
          <h3 className="font-semibold text-foreground">Manual Install (Any Platform)</h3>
          <p className="text-sm text-muted-foreground">Add this snippet to your site's checkout page for instant XMR payments:</p>
          <div className="relative">
            <pre className="p-4 rounded-lg bg-muted/30 border border-border text-xs font-mono text-muted-foreground overflow-x-auto">
              {installSnippet}
            </pre>
            <button onClick={copySnippet} className="absolute top-2 right-2 p-1.5 rounded bg-background/80 hover:bg-background border border-border">
              {copiedSnippet ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>
          </div>
        </div>
      </FadeIn>

      {/* No-Code Automations */}
      <FadeIn delay={0.1}>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" /> No-Code Automations
        </h2>
        <div className="space-y-4">
          {automations.map(auto => (
            <div key={auto.id} className="p-6 rounded-xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <auto.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{auto.name}</h3>
                    <p className="text-xs text-muted-foreground">{auto.description}</p>
                  </div>
                </div>
                <Switch
                  checked={enabledAutomations[auto.id] || false}
                  onCheckedChange={v => setEnabledAutomations(prev => ({ ...prev, [auto.id]: v }))}
                />
              </div>

              {enabledAutomations[auto.id] && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="space-y-2">
                    <Label className="text-foreground text-sm">Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={webhookUrls[auto.id] || ''}
                        onChange={e => setWebhookUrls(prev => ({ ...prev, [auto.id]: e.target.value }))}
                        placeholder={`https://hooks.${auto.id}.com/your-webhook-url`}
                        className="bg-background border-border font-mono text-xs"
                      />
                      <Button variant="outline" size="sm" onClick={() => testWebhook(auto.id)} className="shrink-0 border-border hover:border-primary/50">
                        Test
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Example workflows:</p>
                    <ul className="space-y-1">
                      {auto.examples.map((ex, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                          <ArrowRight className="w-3 h-3 text-primary shrink-0" /> {ex}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </FadeIn>

      {/* API Docs Link */}
      <FadeIn delay={0.12}>
        <div className="p-6 rounded-xl bg-card border border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">REST API & Webhooks</h3>
            <p className="text-sm text-muted-foreground">Full API documentation for custom integrations</p>
          </div>
          <Button variant="outline" className="border-border hover:border-primary/50">
            View API Docs <ExternalLink className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </FadeIn>
    </div>
  );
}
