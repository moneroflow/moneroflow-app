import { FadeIn } from '@/components/FadeIn';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Globe, Languages, DollarSign, Scale, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';
import { CURRENCIES } from '@/lib/mock-data';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸', active: true },
  { code: 'es', name: 'Español', flag: '🇪🇸', active: false },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', active: false },
  { code: 'fr', name: 'Français', flag: '🇫🇷', active: false },
  { code: 'pt', name: 'Português', flag: '🇧🇷', active: false },
  { code: 'ja', name: '日本語', flag: '🇯🇵', active: false },
  { code: 'zh', name: '中文', flag: '🇨🇳', active: false },
  { code: 'ko', name: '한국어', flag: '🇰🇷', active: false },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', active: false },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', active: false },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', active: false },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷', active: false },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱', active: false },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', active: false },
  { code: 'pl', name: 'Polski', flag: '🇵🇱', active: false },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪', active: false },
];

const currencies = CURRENCIES;

const taxRegions = [
  { region: 'European Union', vat: true, rate: '19-27%', note: 'VAT reverse charge may apply for B2B' },
  { region: 'United Kingdom', vat: true, rate: '20%', note: 'UK VAT registration required above £85k' },
  { region: 'United States', vat: false, rate: 'Varies', note: 'Sales tax nexus rules apply per state' },
  { region: 'Brazil', vat: true, rate: '17-25%', note: 'ICMS + ISS apply depending on service type' },
  { region: 'Japan', vat: true, rate: '10%', note: 'Consumption tax (JCT) for registered businesses' },
];

export default function LocalizationPage() {
  const merchant = useStore(s => s.merchant);
  const updateMerchant = useStore(s => s.updateMerchant);

  const [activeLangs, setActiveLangs] = useState<Record<string, boolean>>(
    Object.fromEntries(languages.map(l => [l.code, l.active]))
  );
  const defaultCurrency = merchant.fiatCurrency || 'USD';
  const setDefaultCurrency = (code: string) => {
    const cur = currencies.find(c => c.code === code);
    updateMerchant({ fiatCurrency: code, fiatSymbol: cur?.symbol || '$' });
  };
  const [autoDetectLang, setAutoDetectLang] = useState(true);
  const [showLocalCurrency, setShowLocalCurrency] = useState(true);
  const [autoVat, setAutoVat] = useState(false);

  const toggleLang = (code: string) => {
    if (code === 'en') return;
    setActiveLangs(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const activeCount = Object.values(activeLangs).filter(Boolean).length;

  return (
    <div className="space-y-8 max-w-3xl">
      <FadeIn>
        <h1 className="text-2xl font-bold text-foreground">Localization
          
                <HelpTooltip
                  title="Localization"
                  text="Configure checkout languages, local currency display, and tax/VAT compliance rules for different regions."
                />
        </h1>
        <p className="text-muted-foreground text-sm">Multi-language checkout, local currencies, and regional compliance</p>
      </FadeIn>

      {/* Language Selection */}
      <FadeIn delay={0.05}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Languages className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Checkout Languages</h2>
            </div>
            <Badge variant="outline" className="text-primary border-primary/20">{activeCount} active</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Select languages for customer-facing checkout pages. Includes translated payment instructions and Monero guidance.</p>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-Detect Browser Language</p>
              <p className="text-xs text-muted-foreground">Automatically show checkout in customer's language</p>
            </div>
            <Switch checked={autoDetectLang} onCheckedChange={setAutoDetectLang} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => toggleLang(lang.code)}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${
                  activeLangs[lang.code]
                    ? 'border-primary/30 bg-primary/5 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80'
                } ${lang.code === 'en' ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
              >
                <span className="text-base">{lang.flag}</span>
                <span className="truncate">{lang.name}</span>
                {activeLangs[lang.code] && <Check className="w-3 h-3 text-primary ml-auto shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Currency Display */}
      <FadeIn delay={0.08}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Currency Display</h2>
          </div>
          <p className="text-xs text-muted-foreground">Show prices in the customer's local currency alongside XMR amount.</p>

          <div className="space-y-2">
            <Label className="text-foreground">Default Currency</Label>
            <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map(c => (
                  <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium text-foreground">Show Local Currency</p>
              <p className="text-xs text-muted-foreground">Display price in customer's detected currency + XMR equivalent</p>
            </div>
            <Switch checked={showLocalCurrency} onCheckedChange={setShowLocalCurrency} />
          </div>

          <div className="p-4 rounded-lg bg-muted/20 border border-border">
            <p className="text-xs text-muted-foreground mb-2">Preview (customer sees):</p>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{currencies.find(c => c.code === defaultCurrency)?.symbol}49.99 <span className="text-base text-muted-foreground">{defaultCurrency}</span></p>
              <p className="text-primary font-mono text-sm">≈ 0.298605 XMR</p>
              <p className="text-xs text-muted-foreground mt-1">1 XMR = {currencies.find(c => c.code === defaultCurrency)?.symbol}167.42</p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Tax & Compliance */}
      <FadeIn delay={0.1}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Tax & Compliance</h2>
          </div>
          <p className="text-xs text-muted-foreground">Automatic VAT/tax handling and regional compliance hints.</p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Auto VAT/Tax Calculation</p>
              <p className="text-xs text-muted-foreground">Detect customer region and apply appropriate tax rules</p>
            </div>
            <Switch checked={autoVat} onCheckedChange={setAutoVat} />
          </div>

          {autoVat && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Supported regions:</p>
              {taxRegions.map(r => (
                <div key={r.region} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.region}</p>
                    <p className="text-xs text-muted-foreground">{r.note}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={r.vat ? 'text-primary border-primary/20' : 'text-muted-foreground'}>
                      {r.vat ? `VAT ${r.rate}` : `Tax ${r.rate}`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.12}>
        <Button className="bg-gradient-orange hover:opacity-90" onClick={() => toast.success('Localization settings saved!')}>
          Save Localization Settings
        </Button>
      </FadeIn>
    </div>
  );
}
