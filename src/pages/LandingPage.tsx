import { useNavigate, Link } from 'react-router-dom';
import { BrandLogo, MoneroLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/FadeIn';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import {
  Zap, Shield, ArrowRight, Check, Lock,
  Wallet, BarChart3, MonitorSmartphone, Globe, Gift,
  Code2, HardDrive, Smartphone, FileSpreadsheet, Send, Link2
} from 'lucide-react';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';

const features = [
  { icon: Zap, title: 'Instant Setup', desc: 'Click one button — your Monero wallet is auto-generated. Start accepting payments in seconds.' },
  { icon: Shield, title: 'Self-Custody by Default', desc: 'Your keys, your coins. Browser wallet with seed phrase backup — no third parties ever touch your funds.' },
  { icon: Globe, title: 'Multi-Currency Invoicing', desc: 'Invoice in any currency, customer pays in XMR. Live rate conversion at time of order.' },
  { icon: MonitorSmartphone, title: 'Elite PoS Terminal', desc: 'Full-featured point-of-sale with kiosk inventory, quick links, cart parking, multi-user support, and parked orders.' },
  { icon: BarChart3, title: 'Analytics & Reporting', desc: 'Real-time dashboard with revenue tracking, user performance, and exportable accounting reports.' },
  { icon: Gift, title: 'Earn XMR Referrals', desc: 'Refer merchants, earn multi-level XMR commissions forever. Refer enough and unlock Pro for free.' },
  { icon: Code2, title: 'Fully Open Source', desc: 'MIT-licensed and community-driven. Inspect every line, self-host anywhere, and contribute to the future of private payments.' },
  { icon: HardDrive, title: 'AES-Encrypted Backup & Restore', desc: 'Lightning-fast AES-GCM encrypted local backup and restore. Your data never leaves your browser.' },
  { icon: Smartphone, title: 'Works Everywhere', desc: 'Phone, tablet, desktop — runs smoothly on all of them. Just a web browser and an internet connection.' },
  { icon: FileSpreadsheet, title: 'CSV Inventory Import', desc: 'Upload any CSV file, map columns to POS fields with smart auto-detection, preview rows, and import your entire inventory in seconds.' },
  { icon: Send, title: 'Cold Wallet Auto Sweep', desc: 'Auto-sweep accumulated payments to your cold wallet when threshold is reached. Near-zero merchant risk with automated security.' },
  { icon: Link2, title: 'Anonymous Payment Links', desc: 'Generate permanent payment links for your website. Instant CSV import for rapid deployment. Expand to accept anonymous payments anywhere.' },
];

  const comparisons = [
    { feature: 'Self-custody by default', us: true, nowpay: false, moneropay: true },
    { feature: 'No server / Docker needed', us: true, nowpay: true, moneropay: false },
    { feature: 'Browser-based wallet', us: true, nowpay: false, moneropay: false },
    { feature: 'Multi-currency invoicing', us: true, nowpay: true, moneropay: false },
    { feature: 'Elite PoS with kiosk inventory & cart parking', us: true, nowpay: false, moneropay: false },
    { feature: 'Multi-user / cashier support', us: true, nowpay: false, moneropay: false },
    { feature: 'AES-encrypted local backup & restore', us: true, nowpay: false, moneropay: false },
    { feature: 'Complete privacy mode (IndexedDB + AES-GCM)', us: true, nowpay: false, moneropay: false },
    { feature: 'Auto node discovery & failover', us: true, nowpay: false, moneropay: false },
    { feature: 'Exportable accounts (PDF/CSV)', us: true, nowpay: false, moneropay: false },
    { feature: 'On-chain Pro subscriptions', us: true, nowpay: false, moneropay: false },
    { feature: 'Earn-to-unlock referrals', us: true, nowpay: false, moneropay: false },
    { feature: 'Fully open source (MIT)', us: true, nowpay: false, moneropay: true },
    { feature: 'CSV inventory import with column mapping', us: true, nowpay: false, moneropay: false },
    { feature: 'Akash Network deployment', us: true, nowpay: false, moneropay: false },
    { feature: 'Multi-sig wallet support', us: true, nowpay: false, moneropay: false },
    { feature: 'TRX/USDT payments', us: true, nowpay: false, moneropay: false },
  ];

export default function LandingPage() {
  const navigate = useNavigate();
  const login = useStore(s => s.login);
  const updateMerchant = useStore(s => s.updateMerchant);

  const handleStart = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref')?.toUpperCase().trim();

    login();

    if (refCode && refCode.length >= 4) {
      updateMerchant({ referredBy: refCode });
    }

    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full bg-surface-glass backdrop-blur-xl border-b border-border/50">
        <div className="container flex h-16 items-center justify-between">
          <BrandLogo />
          {/* Buttons removed - auto-onboard via hero CTA */}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-dark" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="container relative z-10 text-center">
          <FadeIn>
            <Badge variant="outline" className="mb-6 border-primary/30 text-primary px-4 py-1.5 text-sm">
              <Lock className="w-3.5 h-3.5 mr-1.5" /> Self-Custody · Zero Setup · Privacy-First
            </Badge>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
              Accept{' '}
              <span className="text-gradient-orange">Monero</span>
              {' '}Instantly
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              One click to a full merchant dashboard with browser wallet, elite PoS terminal, 
              multi-currency invoicing and XMR referral rewards, all without giving up custody.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="flex items-center justify-center">
              <Button size="lg" className="bg-gradient-orange hover:opacity-90 glow-orange-sm text-base px-8 h-12" onClick={handleStart}>
                Start Accepting XMR <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </FadeIn>
          <FadeIn delay={0.4}>
            <p className="mt-4 text-sm text-muted-foreground">No signup required · No email · Your keys, your coins</p>
          </FadeIn>
        </div>
      </section>

      {/* Architecture Diagram */}
      <ArchitectureDiagram />

      {/* Features */}
      <section className="py-24 bg-surface-elevated/50">
        <div className="container">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to accept <span className="text-primary">Monero</span></h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">Built for merchants who want privacy and simplicity without compromise.</p>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.08}>
                <div className="group p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300 h-full">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-24">
        <div className="container">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Why <span className="text-primary">MoneroFlow</span>?</h2>
              <p className="text-muted-foreground text-lg">See how we compare to existing solutions.</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="max-w-3xl mx-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-4 text-muted-foreground font-medium">Feature</th>
                    <th className="py-4 px-4 text-primary font-bold">MoneroFlow</th>
                    <th className="py-4 px-4 text-muted-foreground font-medium">NOWPayments</th>
                    <th className="py-4 px-4 text-muted-foreground font-medium">MoneroPay</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row) => (
                    <tr key={row.feature} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                      <td className="py-3 px-4 text-foreground">{row.feature}</td>
                      <td className="py-3 px-4 text-center">{row.us ? <Check className="w-4 h-4 text-primary mx-auto" /> : <span className="text-muted-foreground/40">✕</span>}</td>
                      <td className="py-3 px-4 text-center">{row.nowpay ? <Check className="w-4 h-4 text-muted-foreground mx-auto" /> : <span className="text-muted-foreground/40">✕</span>}</td>
                      <td className="py-3 px-4 text-center">{row.moneropay ? <Check className="w-4 h-4 text-muted-foreground mx-auto" /> : <span className="text-muted-foreground/40">✕</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* How Monetization Works */}
      <section className="py-24 bg-surface-elevated/50">
        <div className="container">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                <span className="text-primary">On-Chain</span> Pro Subscriptions
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                No accounts. No email. Pay XMR on-chain to unlock Pro — your payment ID is your receipt.
                50% of every Pro subscription rewards the referral network.
              </p>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <FadeIn delay={0.1}>
              <div className="text-center p-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-2">1. Pay On-Chain</h3>
                <p className="text-sm text-muted-foreground">Send XMR to the MoneroFlow treasury address with your unique payment ID. No account needed.</p>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div className="text-center p-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-2">2. Auto-Verified</h3>
                <p className="text-sm text-muted-foreground">The app checks the blockchain for your payment. Pro unlocks instantly — no middleman, no KYC.</p>
              </div>
            </FadeIn>
            <FadeIn delay={0.3}>
              <div className="text-center p-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-2">3. Earn & Unlock</h3>
                <p className="text-sm text-muted-foreground">Refer 10 active merchants → Pro unlocks for free, forever. 50% of Pro revenue feeds the referral pool.</p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24">
        <div className="container">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Simple, transparent <span className="text-primary">pricing</span></h2>
            <p className="text-center text-muted-foreground mb-16 text-lg">No percentage cuts. No hidden fees. Pay in XMR, on-chain.</p>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <FadeIn delay={0.1}>
              <div className="p-8 rounded-xl bg-card border border-border">
                <h3 className="text-xl font-bold mb-2 text-foreground">Free</h3>
                <div className="mb-4">
                  <span className="text-4xl font-extrabold text-foreground">0 XMR</span>
                  <span className="text-muted-foreground">/forever</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Unlimited invoices', 'Browser wallet (self-custody)', 'Basic PoS terminal', 'Multi-currency invoicing', 'CSV inventory import', 'Dashboard & analytics', 'Referral program access', 'Auto node discovery & failover', 'Works on any device'].map(f => (
                    <li key={f} className="flex items-center text-sm text-muted-foreground"><Check className="w-4 h-4 text-primary mr-2 shrink-0" />{f}</li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full border-border hover:border-primary/50" onClick={handleStart}>
                  Start Free
                </Button>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div className="p-8 rounded-xl bg-card border border-primary/30 glow-orange relative">
                <Badge className="absolute -top-3 right-6 bg-gradient-orange text-primary-foreground border-0">Popular</Badge>
                <h3 className="text-xl font-bold mb-2 text-foreground">Pro</h3>
                <div className="mb-1">
                  <span className="text-4xl font-extrabold text-foreground">0.05 XMR</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Or refer 10 merchants → free forever</p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Everything in Free',
                    'Elite PoS with Kiosk Inventory, Quick Links & Cart Parking',
                    'Encrypted local backup & restore',
                    'Complete privacy mode (IndexedDB + AES-GCM)',
                    'Accounting exports (PDF/CSV)',
                    'White-label branding',
                    'Priority node connections',
                    'Multi-user / cashier system',
                  ].map(f => (
                    <li key={f} className="flex items-center text-sm text-muted-foreground"><Check className="w-4 h-4 text-primary mr-2 shrink-0" />{f}</li>
                  ))}
                </ul>
                <Button className="w-full bg-gradient-orange hover:opacity-90" onClick={handleStart}>
                  Start Free, Upgrade Anytime
                </Button>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-surface-elevated/50">
        <div className="container text-center">
          <FadeIn>
            <MoneroLogo size={48} className="mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to accept <span className="text-primary">Monero</span>?</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">One click. No signup. Your keys, your coins.</p>
            <Button size="lg" className="bg-gradient-orange hover:opacity-90 glow-orange-sm text-base px-10 h-12" onClick={handleStart}>
              Start Accepting XMR <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <BrandLogo />
          <p className="text-muted-foreground text-sm">© 2025 MoneroFlow. Privacy is a right, not a feature.</p>
        </div>
      </footer>
    </div>
  );
}
