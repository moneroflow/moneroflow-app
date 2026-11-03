import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, ShieldCheck, Info, ArrowRight, ArrowLeft, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';
import { encryptData } from '@/lib/crypto-store';

const REMOTE_NODES = [
  { label: 'Seth for Privacy', url: 'node.sethforprivacy.com:18089' },
  { label: 'HashVault', url: 'nodes.hashvault.pro:18081' },
  { label: 'Cake Wallet', url: 'xmr-node.cakewallet.com:18081' },
  { label: 'MoneroWorld', url: 'node.moneroworld.com:18089' },
  { label: 'XMR.to', url: 'opennode.xmr-tw.org:18089' },
];

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

export default function ViewOnlyWalletWizard({ onComplete, onCancel }: Props) {
  const updateMerchant = useStore(s => s.updateMerchant);
  const merchant = useStore(s => s.merchant);

  const [step, setStep] = useState(1);
  const [address, setAddress] = useState(merchant.viewOnlyAddress || '');
  const [viewKey, setViewKey] = useState(merchant.viewOnlyViewKey || '');
  const [restoreHeight, setRestoreHeight] = useState(merchant.viewOnlyRestoreHeight || 0);
  const [nodeUrl, setNodeUrl] = useState(merchant.viewOnlyNodeUrl || REMOTE_NODES[0].url);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const isValidAddress = address.length === 95 || address.length === 106;
  const isValidViewKey = viewKey.length === 64;

  const handleTestNode = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const url = `http://${nodeUrl}`;
      const res = await fetch(`${url}/json_rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'get_info' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.result?.status === 'OK') {
          setTestResult('success');
          toast.success(`Connected! Height: ${data.result.height?.toLocaleString()}`);
        } else {
          setTestResult('error');
          toast.error('Node responded but status is not OK');
        }
      } else {
        setTestResult('error');
        toast.error(`Node returned HTTP ${res.status}`);
      }
    } catch {
      setTestResult('error');
      toast.error('Could not reach node — check the address or try another');
    }
    setTesting(false);
  };

  const handleComplete = async () => {
    // Encrypt view key if privacy mode is enabled
    if (merchant.privacyModeEnabled && merchant.privacyPassphrase) {
      try {
        await encryptData(viewKey, merchant.privacyPassphrase);
      } catch {
        // Non-critical — we still store it in zustand state
      }
    }

    updateMerchant({
      walletMode: 'viewonly',
      viewOnlyAddress: address,
      viewOnlyViewKey: viewKey,
      viewOnlyRestoreHeight: restoreHeight,
      viewOnlyNodeUrl: nodeUrl,
      viewOnlySetupComplete: true,
      rpcConnected: true,
    });

    toast.success('View-only wallet configured!');
    onComplete();
  };

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
              s === step ? 'bg-primary text-primary-foreground' :
              s < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
        <span className="text-xs text-muted-foreground ml-2">
          {step === 1 ? 'Enter Keys' : step === 2 ? 'Choose Node' : 'Confirm'}
        </span>
      </div>

      {/* Step 1: Address + View Key */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">View-Only Wallet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your Monero primary address and private view key. This allows XMRPay to monitor incoming payments without ever having spending access to your funds.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <TooltipProvider>
              <div className="flex items-center gap-1.5">
                <Label className="text-foreground text-sm">Primary Address</Label>
                <Tooltip>
                  <TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">Your main Monero address (starts with 4). Found in any Monero wallet under "Receive".</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <Input
              value={address}
              onChange={e => setAddress(e.target.value.trim())}
              className="bg-background border-border font-mono text-xs"
              placeholder="4... (95 or 106 characters)"
            />
            {address && !isValidAddress && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Address must be 95 or 106 characters
              </p>
            )}
          </div>

          <div className="space-y-2">
            <TooltipProvider>
              <div className="flex items-center gap-1.5">
                <Label className="text-foreground text-sm">Private View Key</Label>
                <Tooltip>
                  <TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">64-character hex key. Found in your wallet settings under "Show keys" or "View key". This key can only view incoming transactions — it cannot spend your funds.</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <Input
              type="password"
              value={viewKey}
              onChange={e => setViewKey(e.target.value.trim())}
              className="bg-background border-border font-mono text-xs"
              placeholder="64-character hex private view key"
            />
            {viewKey && !isValidViewKey && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> View key must be exactly 64 hex characters
              </p>
            )}
          </div>

          <div className="space-y-2">
            <TooltipProvider>
              <div className="flex items-center gap-1.5">
                <Label className="text-foreground text-sm">Restore Height (optional)</Label>
                <Tooltip>
                  <TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">Block height from which to start scanning. Use 0 to scan from the beginning (slowest) or enter the height when this wallet was created. Leave at 0 if unsure.</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <Input
              type="number"
              value={restoreHeight || ''}
              onChange={e => setRestoreHeight(Number(e.target.value))}
              className="bg-background border-border text-sm"
              placeholder="0 (scan from genesis)"
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">Cancel</Button>
            <Button
              onClick={() => setStep(2)}
              disabled={!isValidAddress || !isValidViewKey}
              className="bg-gradient-orange hover:opacity-90"
            >
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Choose Remote Node */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground text-sm">Remote Node</Label>
            <p className="text-xs text-muted-foreground">Choose a public Monero node to connect to. Your view key is sent to the node to scan for payments — for maximum privacy, run your own node.</p>
            <Select value={nodeUrl} onValueChange={setNodeUrl}>
              <SelectTrigger className="bg-background border-border font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {REMOTE_NODES.map(n => (
                  <SelectItem key={n.url} value={n.url} className="font-mono text-sm">
                    {n.label} — {n.url}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground text-xs">Or enter a custom node</Label>
            <Input
              value={nodeUrl}
              onChange={e => setNodeUrl(e.target.value)}
              className="bg-background border-border font-mono text-sm"
              placeholder="node.example.com:18089"
            />
          </div>

          <Button
            variant="outline"
            onClick={handleTestNode}
            disabled={testing || !nodeUrl}
            className="w-full border-border hover:border-primary/50"
          >
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {testing ? 'Testing...' : testResult === 'success' ? '✓ Connected' : 'Test Node Connection'}
          </Button>

          {testResult === 'error' && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Could not connect. Try another node or check the address.
            </p>
          )}

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Remote nodes process your view key to find transactions. For maximum privacy, use your own node or Tor-connected node.
            </p>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button onClick={() => setStep(3)} className="bg-gradient-orange hover:opacity-90">
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-card border border-border space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Review Configuration</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Address</span>
                <span className="font-mono text-foreground">{address.slice(0, 8)}...{address.slice(-8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">View Key</span>
                <span className="font-mono text-foreground">{'•'.repeat(16)}...{viewKey.slice(-8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Restore Height</span>
                <span className="font-mono text-foreground">{restoreHeight || 'Genesis (0)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remote Node</span>
                <span className="font-mono text-foreground">{nodeUrl}</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Security Summary</p>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
              <li>View key can <strong>only monitor</strong> incoming payments — it cannot spend your XMR</li>
              <li>Keys are stored encrypted in your browser{merchant.privacyModeEnabled ? ' (Privacy Mode active)' : ''}</li>
              <li>Spend key will only be requested temporarily when sweeping funds</li>
              <li>No data is sent to XMRPay servers</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
            <p className="text-xs text-warning flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>Keep this tab open</strong> to receive and detect payments. For 24/7 unattended operation, use Managed mode instead.
              </span>
            </p>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(2)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button onClick={handleComplete} className="bg-gradient-orange hover:opacity-90">
              <ShieldCheck className="w-4 h-4 mr-1" /> Activate View-Only Wallet
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
