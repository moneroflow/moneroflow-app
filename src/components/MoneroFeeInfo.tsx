import { useState } from 'react';
import { Zap, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useRates } from '@/hooks/use-rates';
import { getXmrPrice } from '@/lib/currency-service';
import { useStore } from '@/lib/store';

// Monero fee tiers (realistic estimates based on current network)
const FEE_TIERS = [
  { id: 'normal', label: 'Normal', priority: 1, feeXmr: 0.000012, etaMinutes: 20, description: '~20 min (2 blocks)' },
  { id: 'fast', label: 'Fast', priority: 2, feeXmr: 0.000024, etaMinutes: 10, description: '~10 min (next block)' },
  { id: 'urgent', label: 'Urgent', priority: 3, feeXmr: 0.000048, etaMinutes: 2, description: '~2 min (priority)' },
];

interface Props {
  compact?: boolean;
}

export function MoneroFeeInfo({ compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedTier, setSelectedTier] = useState('normal');
  const { rates } = useRates();
  const merchant = useStore(s => s.merchant);
  const cur = merchant.fiatCurrency || 'USD';
  const sym = merchant.fiatSymbol || '$';

  const xmrPrice = rates ? getXmrPrice(cur, rates) : null;

  const formatFee = (feeXmr: number) => {
    if (!xmrPrice) return `${feeXmr.toFixed(6)} XMR`;
    const fiatVal = feeXmr * xmrPrice;
    return `${feeXmr.toFixed(6)} XMR (${sym}${fiatVal < 0.01 ? '<0.01' : fiatVal.toFixed(2)})`;
  };

  const currentTier = FEE_TIERS.find(t => t.id === selectedTier) || FEE_TIERS[0];

  if (compact) {
    return (
      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
        <Clock className="w-3 h-3" />
        <span>Est. {currentTier.description}</span>
        <span className="text-muted-foreground/60">·</span>
        <span>Fee: {formatFee(currentTier.feeXmr)}</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-primary" />
          <span>Network fee: {formatFee(currentTier.feeXmr)}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>{currentTier.description}</span>
        </div>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-border bg-card/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Transaction Speed</p>
          </div>
          {FEE_TIERS.map(tier => (
            <button
              key={tier.id}
              onClick={() => setSelectedTier(tier.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-colors ${
                selectedTier === tier.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  tier.id === 'normal' ? 'bg-success' :
                  tier.id === 'fast' ? 'bg-warning' :
                  'bg-destructive'
                }`} />
                <span className="font-medium">{tier.label}</span>
                <span className="text-muted-foreground/70">{tier.description}</span>
              </div>
              <span className="font-mono text-[10px]">{formatFee(tier.feeXmr)}</span>
            </button>
          ))}
          <div className="px-3 py-2 border-t border-border bg-muted/20">
            <p className="text-[10px] text-muted-foreground">
              Monero fees are set by the <strong>sender's wallet</strong>. These are estimates for the payer's reference.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
