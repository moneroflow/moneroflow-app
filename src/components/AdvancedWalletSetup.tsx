import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import {
  Shield, Zap, Server, Smartphone, Check, AlertTriangle,
  Clock, Cpu, Lock, Globe, ArrowRight, Settings2,
} from 'lucide-react';
import type { SendMode } from '@/lib/wallet-send';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AdvancedWalletSetup({ open, onOpenChange }: Props) {
  const merchant = useStore(s => s.merchant);
  const updateMerchant = useStore(s => s.updateMerchant);
  const currentMode: SendMode = merchant.sendMode || 'proxy';
  const [selectedMode, setSelectedMode] = useState<SendMode>(currentMode);

  // Sync selectedMode with currentMode when dialog opens or merchant changes
  useEffect(() => {
    if (open) {
      setSelectedMode(currentMode);
    }
  }, [open, currentMode]);

  const handleConfirm = () => {
    updateMerchant({ sendMode: selectedMode });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Advanced Wallet Send Mode
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Choose how your browser wallet constructs and broadcasts real Monero transactions.
          Both modes sign transactions entirely in your browser — your private keys <strong className="text-foreground">never leave this device</strong>.
        </p>

        <div className="grid gap-4 pt-2">
          {/* Daemon Proxy Mode */}
          <button
            onClick={() => setSelectedMode('proxy')}
            className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
              selectedMode === 'proxy'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`mt-0.5 p-2.5 rounded-lg ${selectedMode === 'proxy' ? 'bg-primary/10' : 'bg-muted'}`}>
                <Globe className={`w-5 h-5 ${selectedMode === 'proxy' ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">Daemon Proxy</span>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Default</Badge>
                  <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Recommended</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Loads the transaction engine <strong className="text-foreground">on-demand</strong> only when you click "Send".
                  Creates a temporary wallet, syncs recent blocks, constructs & signs the transaction, broadcasts it, then closes.
                </p>

                {/* Pros */}
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-success uppercase tracking-wider">✅ Advantages</p>
                  <div className="grid gap-1">
                    {[
                      'Low memory footprint — WASM only loaded when needed',
                      'No background processes — saves battery & CPU',
                      'Smaller attack surface — wallet exists only during send',
                      'Works on mobile devices and low-spec hardware',
                      'Keys are in memory for the shortest possible time',
                    ].map((pro, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <Check className="w-3 h-3 text-success shrink-0 mt-0.5" />
                        <span className="text-[11px] text-muted-foreground">{pro}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cons */}
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-warning uppercase tracking-wider">⚠️ Trade-offs</p>
                  <div className="grid gap-1">
                    {[
                      'Each send takes 30–120s (loading WASM + syncing blocks)',
                      'Must sync recent blocks before each transaction',
                      'First send per session is slowest (~50MB WASM download)',
                    ].map((con, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <Clock className="w-3 h-3 text-warning shrink-0 mt-0.5" />
                        <span className="text-[11px] text-muted-foreground">{con}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security */}
                <div className="mt-3 p-2.5 rounded-lg bg-muted/20 border border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Security</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Private spend key is loaded into WASM memory only for the duration of the send (typically under 2 minutes).
                    After the transaction is broadcast, the temporary wallet is destroyed and keys are cleared from memory.
                    This minimizes the window of exposure if the browser tab is compromised.
                  </p>
                </div>
              </div>
              <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                selectedMode === 'proxy' ? 'border-primary' : 'border-muted-foreground/30'
              }`}>
                {selectedMode === 'proxy' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>
            </div>
          </button>

          {/* Full WASM Mode */}
          <button
            onClick={() => setSelectedMode('wasm')}
            className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
              selectedMode === 'wasm'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`mt-0.5 p-2.5 rounded-lg ${selectedMode === 'wasm' ? 'bg-primary/10' : 'bg-muted'}`}>
                <Cpu className={`w-5 h-5 ${selectedMode === 'wasm' ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">Full WASM Wallet</span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">Advanced</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Keeps a <strong className="text-foreground">persistent WASM wallet</strong> running in the background,
                  continuously synced with the blockchain. Transactions are constructed and broadcast <strong className="text-foreground">instantly</strong>.
                </p>

                {/* Pros */}
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-success uppercase tracking-wider">✅ Advantages</p>
                  <div className="grid gap-1">
                    {[
                      'Instant sends — wallet is already synced and ready',
                      'Real-time balance updates from the blockchain',
                      'No waiting for sync before each transaction',
                      'Best for high-volume merchants sending frequently',
                    ].map((pro, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <Zap className="w-3 h-3 text-success shrink-0 mt-0.5" />
                        <span className="text-[11px] text-muted-foreground">{pro}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cons */}
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-warning uppercase tracking-wider">⚠️ Trade-offs</p>
                  <div className="grid gap-1">
                    {[
                      'High memory usage (~200–500MB RAM continuously)',
                      'Background CPU usage for blockchain sync',
                      'WASM binary (~50MB) must stay loaded in the tab',
                      'First sync can take 10–30+ minutes',
                      'May drain battery on mobile devices',
                    ].map((con, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-warning shrink-0 mt-0.5" />
                        <span className="text-[11px] text-muted-foreground">{con}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security */}
                <div className="mt-3 p-2.5 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Lock className="w-3.5 h-3.5 text-warning" />
                    <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Security Considerations</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Private spend key remains in WASM memory <strong className="text-warning">for the entire browser session</strong>.
                    If an attacker gains access to your browser tab (via XSS, malicious extension, or physical access),
                    they could potentially extract keys from the running WASM instance. This is inherent to any hot wallet.
                    Use only on trusted devices with locked screens.
                  </p>
                </div>
              </div>
              <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                selectedMode === 'wasm' ? 'border-primary' : 'border-muted-foreground/30'
              }`}>
                {selectedMode === 'wasm' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>
            </div>
          </button>
        </div>

        {/* Comparison Table */}
        <div className="rounded-lg border border-border overflow-hidden mt-2">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-left p-2.5 text-muted-foreground font-medium">Feature</th>
                <th className="text-center p-2.5 text-muted-foreground font-medium">Daemon Proxy</th>
                <th className="text-center p-2.5 text-muted-foreground font-medium">Full WASM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ['Send speed', '30–120s', '< 5s'],
                ['Memory usage', '~50MB (temp)', '200–500MB'],
                ['Key exposure time', '< 2 min', 'Entire session'],
                ['Background sync', 'None', 'Continuous'],
                ['Mobile friendly', '✅ Yes', '⚠️ Heavy'],
                ['Best for', 'Occasional sends', 'Frequent sends'],
                ['First-time setup', 'Fast', '10–30min sync'],
              ].map(([label, proxy, wasm], i) => (
                <tr key={i} className="hover:bg-muted/10">
                  <td className="p-2.5 text-foreground font-medium">{label}</td>
                  <td className="p-2.5 text-center text-muted-foreground">{proxy}</td>
                  <td className="p-2.5 text-center text-muted-foreground">{wasm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Info banner */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Both modes are fully self-custodial.</strong> Your private keys never leave your browser.
            Transactions are signed locally using the monero-ts WASM library and broadcast directly to the Monero network
            via your connected daemon node. No third-party server ever sees your keys.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-border">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="flex-1 bg-gradient-orange hover:opacity-90">
            <Check className="w-4 h-4 mr-2" />
            {selectedMode === currentMode ? 'Keep Current Mode' : `Switch to ${selectedMode === 'proxy' ? 'Daemon Proxy' : 'Full WASM'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
