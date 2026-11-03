import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Copy, Download, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/copy-utils';
import { useStore } from '@/lib/store';
import { generateBrowserWallet, type GeneratedWallet } from '@/lib/wallet-generator';
import { encryptData } from '@/lib/crypto-store';
import { REMOTE_NODES } from '@/lib/node-manager';

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

export default function BrowserWalletSetup({ onComplete, onCancel }: Props) {
  const updateMerchant = useStore(s => s.updateMerchant);
  const autoConnectNode = useStore(s => s.autoConnectNode);
  const merchant = useStore(s => s.merchant);

  const [wallet, setWallet] = useState<GeneratedWallet | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-generate on first render
  if (!wallet) {
    const w = generateBrowserWallet();
    setWallet(w);
  }

  if (!wallet) return null;

  const allKeys = `=== XMRPay Browser Wallet Backup ===
Date: ${new Date().toISOString()}

SEED PHRASE (25 words):
${wallet.seedPhrase}

PRIMARY ADDRESS:
${wallet.address}

PRIVATE VIEW KEY:
${wallet.viewKey}

⚠️ KEEP THIS FILE SECURE. Anyone with your seed phrase can access your funds.
`;

  const handleCopyAll = async () => {
    const ok = await copyToClipboard(allKeys);
    if (ok) {
      setCopied(true);
      toast.success('All keys copied to clipboard');
      setTimeout(() => setCopied(false), 3000);
    } else {
      toast.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([allKeys], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xmrpay-wallet-backup-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup file downloaded');
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      if (merchant.privacyModeEnabled && merchant.privacyPassphrase) {
        await encryptData(wallet.viewKey, merchant.privacyPassphrase);
      }

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

      // Auto-connect to the fastest node
      const status = await autoConnectNode();
      if (status?.connected) {
        toast.success('Wallet ready! Connected to ' + (status.label || 'remote node'));
      } else {
        toast.success('Wallet created! Connecting to network...');
      }

      onComplete();
    } catch {
      toast.error('Failed to save wallet');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Warning banner */}
      <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">Back Up Your Wallet Now</p>
            <p className="text-xs text-destructive/80 mt-1">
              This information is shown <strong>ONLY ONCE</strong>. Write it down or save it securely. If you lose it, you cannot recover this wallet.
            </p>
          </div>
        </div>
      </div>

      {/* Seed phrase */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">Seed Phrase (25 words)</label>
        <div className="p-4 rounded-xl bg-background border border-border">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {wallet.seedPhrase.split(' ').map((word, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground text-[10px] w-4 text-right">{i + 1}.</span>
                <span className="font-mono font-medium text-foreground">{word}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Primary Address</label>
        <p className="font-mono text-[11px] text-muted-foreground bg-background border border-border rounded-lg p-3 break-all leading-relaxed">
          {wallet.address}
        </p>
      </div>

      {/* View Key */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Private View Key</label>
        <p className="font-mono text-[11px] text-muted-foreground bg-background border border-border rounded-lg p-3 break-all leading-relaxed">
          {wallet.viewKey}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCopyAll} className="flex-1 border-border hover:border-primary/50 text-xs">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-primary" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
          {copied ? 'Copied!' : 'Copy All Keys'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload} className="flex-1 border-border hover:border-primary/50 text-xs">
          <Download className="w-3.5 h-3.5 mr-1.5" /> Download .txt
        </Button>
      </div>

      {/* Confirmation checkbox */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
        <Checkbox id="confirm-backup" checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} className="mt-0.5" />
        <label htmlFor="confirm-backup" className="text-sm text-foreground cursor-pointer leading-relaxed">
          I have safely backed up my seed phrase, address, and view key. I understand this cannot be shown again.
        </label>
      </div>

      {/* Footer buttons */}
      <div className="flex justify-between pt-1">
        <Button variant="ghost" onClick={onCancel} className="text-muted-foreground text-sm">Cancel</Button>
        <Button onClick={handleConfirm} disabled={!confirmed || saving} className="bg-gradient-orange hover:opacity-90">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          {saving ? 'Connecting...' : 'I Have Saved My Backup'}
        </Button>
      </div>
    </div>
  );
}
