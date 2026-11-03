import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';
import { restoreWalletFromSeed } from '@/lib/wallet-generator';
import { REMOTE_NODES } from '@/lib/node-manager';

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

export default function RestoreWalletFromSeed({ onComplete, onCancel }: Props) {
  const updateMerchant = useStore(s => s.updateMerchant);
  const autoConnectNode = useStore(s => s.autoConnectNode);

  const [seedInput, setSeedInput] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState('');

  const wordCount = seedInput.trim().split(/\s+/).filter(Boolean).length;
  const isValid = wordCount === 25;

  const handleRestore = async () => {
    setRestoring(true);
    setError('');
    try {
      const wallet = restoreWalletFromSeed(seedInput);

      updateMerchant({
        walletMode: 'viewonly',
        viewOnlyAddress: wallet.address,
        viewOnlyViewKey: wallet.viewKey,
        viewOnlySpendKey: wallet.spendKey,
        viewOnlyPublicSpendKey: wallet.publicSpendKey,
        viewOnlyPublicViewKey: wallet.publicViewKey,
        viewOnlySeedPhrase: wallet.seedPhrase,
        viewOnlySeedBackedUp: true,
        viewOnlyRestoreHeight: 0,
        viewOnlyNodeUrl: REMOTE_NODES[0].url,
        viewOnlySetupComplete: true,
        viewOnlySubaddressIndex: 1,
        nodeStatus: 'connecting',
      });

      const status = await autoConnectNode();
      if (status?.connected) {
        toast.success('Wallet restored! Connected to ' + (status.label || 'remote node'));
      } else {
        toast.success('Wallet restored! Connecting to network...');
      }

      onComplete();
    } catch (e: any) {
      setError(e.message || 'Invalid seed phrase');
      toast.error(e.message || 'Could not restore wallet');
    }
    setRestoring(false);
  };

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Restore from Seed Phrase</p>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your 25-word Monero seed phrase to restore your wallet. Your keys never leave your browser.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">Seed Phrase (25 words)</label>
        <Textarea
          value={seedInput}
          onChange={(e) => { setSeedInput(e.target.value); setError(''); }}
          className="bg-background border-border font-mono text-sm min-h-[120px] resize-none"
          placeholder="Enter your 25-word seed phrase, separated by spaces..."
        />
        <div className="flex items-center justify-between">
          <span className={`text-xs ${isValid ? 'text-success' : 'text-muted-foreground'}`}>
            {wordCount}/25 words
          </span>
          {isValid && (
            <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </p>
        </div>
      )}

      <div className="flex justify-between pt-1">
        <Button variant="ghost" onClick={onCancel} className="text-muted-foreground text-sm">Cancel</Button>
        <Button onClick={handleRestore} disabled={!isValid || restoring} className="bg-gradient-orange hover:opacity-90">
          {restoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
          {restoring ? 'Restoring...' : 'Restore Wallet'}
        </Button>
      </div>
    </div>
  );
}
