import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { FadeIn } from '@/components/FadeIn';
import { Copy, Check, Eye, EyeOff, Zap, Shield, ShieldCheck, ShieldAlert, Lock, Upload, Download, Server, Wifi, WifiOff, HelpCircle, Loader2, Cloud, Globe, Monitor, ChevronDown, Info, Smartphone, RefreshCw, Radio, Settings2, KeyRound, Send } from 'lucide-react';
import { HelpTooltip } from '@/components/HelpTooltip';
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { exportEncryptedBackup, importEncryptedBackup } from '@/lib/crypto-store';
import { testConnection, piconeroToXmr } from '@/lib/monero-rpc';
import { formatXMR } from '@/lib/mock-data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BrowserWalletSetup from '@/components/BrowserWalletSetup';
import RestoreWalletFromSeed from '@/components/RestoreWalletFromSeed';
import { REMOTE_NODES, findFastestNode } from '@/lib/node-manager';
import { isMerchantPro } from '@/lib/subscription';
import AdvancedWalletSetup from '@/components/AdvancedWalletSetup';
import CsvInventoryImport from '@/components/CsvInventoryImport';
import { MultiChainOptIn } from '@/components/MultiChainOptIn';
/** Simple hash for local admin password lock */
function hashPassword(pw: string): string {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    const chr = pw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}



export default function SettingsPage() {
  const merchant = useStore(s => s.merchant);
  const updateMerchant = useStore(s => s.updateMerchant);
  const restoreFromBackup = useStore(s => s.restoreFromBackup);
  const deleteAccount = useStore(s => s.deleteAccount);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showRpcHelp, setShowRpcHelp] = useState(false);
  const [autoSelecting, setAutoSelecting] = useState(false);
  const [showBrowserWalletSetup, setShowBrowserWalletSetup] = useState(false);
  const [showRestoreFromSeed, setShowRestoreFromSeed] = useState(false);
  const [showWalletChoice, setShowWalletChoice] = useState(false);
  const [dangerSeed, setDangerSeed] = useState('');
  const [showDangerConfirm, setShowDangerConfirm] = useState(false);
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Admin password gate state
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showSetAdmin, setShowSetAdmin] = useState(false);
  const [showUnlockAdmin, setShowUnlockAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminPassConfirm, setAdminPassConfirm] = useState('');
  const [unlockPass, setUnlockPass] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Sweep state
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<{ success: boolean; message: string } | null>(null);

  // Helper function to format frequency
  const formatFrequency = (minutes: number): string => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
  };

  const requireAdmin = (action: () => void) => {
    if (adminUnlocked) { action(); return; }
    setPendingAction(() => action);
    if (!merchant.adminPasswordHash) {
      setShowSetAdmin(true);
    } else {
      setShowUnlockAdmin(true);
    }
  };

  const handleSetAdminAndProceed = () => {
    if (adminPass.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (adminPass !== adminPassConfirm) { toast.error('Passwords do not match'); return; }
    updateMerchant({ adminPasswordHash: hashPassword(adminPass) });
    setShowSetAdmin(false);
    setAdminPass('');
    setAdminPassConfirm('');
    setAdminUnlocked(true);
    toast.success('Admin password set! 🔒');
    if (pendingAction) { pendingAction(); setPendingAction(null); }
  };

  const handleUnlockAndProceed = () => {
    if (hashPassword(unlockPass) === merchant.adminPasswordHash) {
      setAdminUnlocked(true);
      setShowUnlockAdmin(false);
      setUnlockPass('');
      toast.success('Admin unlocked');
      if (pendingAction) { pendingAction(); setPendingAction(null); }
    } else {
      toast.error('Wrong admin password');
    }
  };

  const handleSweepNow = async () => {
    if (!merchant.coldWalletAddress) {
      toast.error('Please set a cold wallet address first');
      return;
    }

    setSweeping(true);
    setSweepResult(null);

    try {
      const runSweepCheck = useStore.getState().runSweepCheck;
      const result = await runSweepCheck();

      if (result.success) {
        toast.success(`Swept ${result.sweptAmount.toFixed(6)} XMR to cold wallet!`);
        setSweepResult({ success: true, message: `Successfully swept ${result.sweptAmount.toFixed(6)} XMR. TX: ${result.txHash?.slice(0, 12)}...` });
      } else {
        toast.error(result.error || 'Sweep failed');
        setSweepResult({ success: false, message: result.error || 'Sweep failed' });
      }
    } catch (err) {
      toast.error('Sweep failed unexpectedly');
      setSweepResult({ success: false, message: 'Unexpected error occurred' });
    } finally {
      setSweeping(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(merchant.apiKey);
    setCopied(true);
    toast.success('API key copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportBackup = async () => {
    if (!merchant.privacyPassphrase) { toast.error('Set a passphrase first'); return; }
    try {
      const state = useStore.getState();
      const data = JSON.stringify({
        merchant: state.merchant,
        invoices: state.invoices,
        subscriptions: state.subscriptions,
        paymentLinks: state.paymentLinks,
        referrals: state.referrals,
        referralPayouts: state.referralPayouts,
        isAuthenticated: state.isAuthenticated,
        timestamp: new Date().toISOString(),
        version: '2.0',
      });
      const blob = await exportEncryptedBackup(data, merchant.privacyPassphrase);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `moneroflow-backup-${Date.now()}.json.aes`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Encrypted backup downloaded!');
    } catch { toast.error('Backup export failed'); }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !merchant.privacyPassphrase) { toast.error('Select a file and ensure passphrase is set'); return; }
    setRestoring(true);
    try {
      const json = await importEncryptedBackup(file, merchant.privacyPassphrase);
      const parsed = JSON.parse(json);
      restoreFromBackup(parsed);
      toast.success(`Backup restored successfully! ${parsed.invoices?.length || 0} invoices recovered.`);
    } catch { toast.error('Restore failed — wrong passphrase or corrupted file'); }
    setRestoring(false);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const endpoint = merchant.walletMode === 'remote'
        ? `http://${merchant.remoteNodeUrl}`
        : merchant.rpcEndpoint;
      const result = await testConnection({
        endpoint,
        username: merchant.rpcUsername,
        password: merchant.rpcPassword,
        walletFilename: merchant.rpcWalletFilename,
      });
      if (result.success && result.balance) {
        updateMerchant({ rpcConnected: true });
        toast.success(`Connected! Balance: ${formatXMR(piconeroToXmr(result.balance.unlockedBalance))}`);
      } else {
        updateMerchant({ rpcConnected: false });
        toast.error(result.error || 'Connection failed');
      }
    } catch {
      updateMerchant({ rpcConnected: false });
      toast.error('RPC connection failed — check your wallet is running');
    }
    setTesting(false);
  };

  const handleAutoSelectNode = async () => {
    setAutoSelecting(true);
    try {
      const result = await findFastestNode();
      if (result) {
        updateMerchant({ remoteNodeUrl: result.node.url, remoteNodeSsl: result.node.ssl });
        toast.success(`Selected fastest node: ${result.status.label} (${result.status.latencyMs}ms)`);
      } else {
        toast.error('Could not connect to any remote node');
      }
    } catch {
      toast.error('Node test failed');
    }
    setAutoSelecting(false);
  };

  const walletMode = merchant.walletMode || 'viewonly';
  const isPro = isMerchantPro(merchant);

  const setWalletMode = (mode: 'selfcustody' | 'viewonly') => {
    if (mode === 'viewonly') {
      if (!merchant.viewOnlySetupComplete) {
        setShowWalletChoice(true);
        return;
      }
      updateMerchant({
        walletMode: mode,
        nativeRpcEnabled: false,
        rpcConnected: true,
      });
      return;
    }
    updateMerchant({
      walletMode: mode,
      nativeRpcEnabled: true,
      rpcConnected: merchant.rpcConnected,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <FadeIn>
        <h1 className="text-2xl font-bold text-foreground">Settings
          
                <HelpTooltip
                  title="Settings"
                  text="Configure your merchant account — wallet connection, privacy mode, fee tiers, admin lock, and more."
                />
        </h1>
        <p className="text-muted-foreground text-sm">Configure your merchant account</p>
      </FadeIn>

      {/* Wallet Mode Selection */}
      <FadeIn delay={0.02}>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Wallet & Node
              
                <HelpTooltip
                  title="Wallet & Node"
                  text="Choose how MoneroFlow connects to the Monero network. In-Browser Wallet is recommended for easy self-custody. Full Self-Custody lets you run your own monero-wallet-rpc."
                />
            </h2>
            <Dialog open={showRpcHelp} onOpenChange={setShowRpcHelp}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary h-8 px-2">
                  <HelpCircle className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg">
                <DialogHeader><DialogTitle className="text-foreground">How to run monero-wallet-rpc</DialogTitle></DialogHeader>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>Run the following command to start your own wallet RPC server:</p>
                  <pre className="bg-background border border-border rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
{`monero-wallet-rpc \\
  --rpc-bind-port 18082 \\
  --rpc-login monero:yourpassword \\
  --wallet-dir /path/to/wallets \\
  --daemon-address node.moneroworld.com:18089 \\
  --disable-rpc-ban`}
                  </pre>
                  <div className="space-y-2 pt-2">
                    <p className="text-foreground font-medium">Required flags:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li><code className="text-primary">--rpc-bind-port</code> — Port for RPC (default: 18082)</li>
                      <li><code className="text-primary">--rpc-login</code> — Username:password for auth</li>
                      <li><code className="text-primary">--wallet-dir</code> — Directory containing wallet files</li>
                      <li><code className="text-primary">--daemon-address</code> — Monero node to connect to</li>
                    </ul>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs">⚠️ CORS: If testing locally, add <code className="text-primary">--rpc-access-control-origins=*</code></p>
                    <p className="text-xs mt-1">In production, RPC calls go through server-side API routes — never expose credentials to the browser.</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-xs text-muted-foreground">Choose how XMRPay connects to the Monero network.</p>

          {/* Two Mode Cards */}
          <div className="grid gap-3">
            {/* In-Browser Wallet Mode — FIRST */}
            <button
              onClick={() => setWalletMode('viewonly')}
              className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                walletMode === 'viewonly'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-muted-foreground/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 p-2.5 rounded-lg ${walletMode === 'viewonly' ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Smartphone className={`w-5 h-5 ${walletMode === 'viewonly' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">In-Browser Wallet</span>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Recommended</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Instant setup — wallet is created automatically in your browser. Self-custody with zero downloads. Works on any device.</p>
                  <Badge variant="outline" className="mt-2 text-[10px] text-muted-foreground border-border">🔐 Lightweight • Self-Custody • Max Privacy</Badge>
                </div>
                <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  walletMode === 'viewonly' ? 'border-primary' : 'border-muted-foreground/30'
                }`}>
                  {walletMode === 'viewonly' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
              </div>
            </button>

            {/* Self-Custody Mode */}
            <button
              onClick={() => setWalletMode('selfcustody')}
              className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                walletMode === 'selfcustody'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-muted-foreground/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 p-2.5 rounded-lg ${walletMode === 'selfcustody' ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Monitor className={`w-5 h-5 ${walletMode === 'selfcustody' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">Full Self-Custody</span>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">Advanced</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Run your own monero-wallet-rpc. Full sovereignty — your node, your keys, your rules.</p>
                  <Badge variant="outline" className="mt-2 text-[10px] text-muted-foreground border-border">🔐 Advanced – Self-Custody</Badge>
                </div>
                <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  walletMode === 'selfcustody' ? 'border-primary' : 'border-muted-foreground/30'
                }`}>
                  {walletMode === 'selfcustody' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
              </div>
            </button>
          </div>

          {/* Browser Wallet Setup Dialog */}
          <Dialog open={showBrowserWalletSetup} onOpenChange={setShowBrowserWalletSetup}>
            <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-foreground">Create Your Browser Wallet</DialogTitle></DialogHeader>
              <BrowserWalletSetup
                onComplete={() => setShowBrowserWalletSetup(false)}
                onCancel={() => setShowBrowserWalletSetup(false)}
              />
            </DialogContent>
          </Dialog>

          {/* Restore from Seed Dialog */}
          <Dialog open={showRestoreFromSeed} onOpenChange={setShowRestoreFromSeed}>
            <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-foreground">Restore Wallet from Seed</DialogTitle></DialogHeader>
              <RestoreWalletFromSeed
                onComplete={() => setShowRestoreFromSeed(false)}
                onCancel={() => setShowRestoreFromSeed(false)}
              />
            </DialogContent>
          </Dialog>

          {/* Wallet Choice Dialog — Create New or Restore */}
          <Dialog open={showWalletChoice} onOpenChange={setShowWalletChoice}>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader><DialogTitle className="text-foreground">Set Up Browser Wallet</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">Choose how to get started:</p>
              <div className="grid gap-3 pt-2">
                <button
                  onClick={() => { setShowWalletChoice(false); setShowBrowserWalletSetup(true); }}
                  className="w-full text-left p-4 rounded-xl border-2 border-border bg-card hover:border-primary/50 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground text-sm">Create New Wallet</span>
                      <p className="text-xs text-muted-foreground mt-1">Generate a fresh wallet with a new seed phrase. You'll back it up once during setup.</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => { setShowWalletChoice(false); setShowRestoreFromSeed(true); }}
                  className="w-full text-left p-4 rounded-xl border-2 border-border bg-card hover:border-primary/50 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Download className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground text-sm">Restore from Seed Phrase</span>
                      <p className="text-xs text-muted-foreground mt-1">Already have a 25-word seed? Enter it to restore your existing wallet.</p>
                    </div>
                  </div>
                </button>
              </div>
            </DialogContent>
          </Dialog>

          {walletMode === 'viewonly' && merchant.viewOnlySetupComplete && (
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Browser Wallet</h3>
                <Badge className="bg-success/10 text-success border-success/20 text-xs">
                  <Eye className="w-3 h-3 mr-1" /> Active
                </Badge>
              </div>

              {/* Primary Address — always visible */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Primary Address</label>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-[11px] text-foreground bg-background border border-border rounded-lg p-3 flex-1 break-all leading-relaxed">{merchant.viewOnlyAddress}</p>
                  <Button variant="outline" size="icon" className="shrink-0 border-border hover:border-primary/50 h-8 w-8" onClick={() => { navigator.clipboard.writeText(merchant.viewOnlyAddress); toast.success('Address copied'); }}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Seed Phrase Backup Section */}
              {!merchant.viewOnlySeedBackedUp && merchant.viewOnlySeedPhrase ? (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-destructive" />
                    <p className="text-sm font-semibold text-destructive">⚠️ Back up your seed phrase NOW</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Write down these 25 words in order and store them somewhere safe offline. This is the <strong>only way</strong> to recover your wallet. Once you confirm, this phrase will be hidden permanently.
                  </p>
                  {showKey ? (
                    <>
                      <div className="bg-background border border-border rounded-lg p-3">
                        <p className="font-mono text-xs text-foreground leading-relaxed break-all select-all">{merchant.viewOnlySeedPhrase}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(merchant.viewOnlySeedPhrase || '');
                            toast.success('Seed phrase copied — store it safely!');
                          }}
                        >
                          <Copy className="w-3 h-3 mr-1.5" /> Copy
                        </Button>
                        <Button
                          size="sm"
                          className="bg-gradient-orange text-xs"
                          onClick={() => {
                            updateMerchant({ viewOnlySeedBackedUp: true });
                            setShowKey(false);
                            toast.success('Seed phrase marked as backed up');
                          }}
                        >
                          <Check className="w-3 h-3 mr-1.5" /> I've saved it — lock it down
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                      onClick={() => setShowKey(true)}
                    >
                      <Eye className="w-3 h-3 mr-1.5" /> Reveal Seed Phrase
                    </Button>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    🔐 Seed phrase backed up and secured. If you need to access it again, restore from your backup file.
                  </p>
                </div>
              )}

              {/* Remote Node */}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Connected Node</span>
                <span className="font-mono text-foreground">{merchant.connectedNodeUrl || merchant.viewOnlyNodeUrl}</span>
              </div>

              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-[11px] text-warning leading-relaxed">
                  ⚠️ <strong>Keep this tab open</strong> to detect incoming payments. For 24/7 operation, switch to Managed mode.
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!merchant.viewOnlySeedBackedUp}
                  onClick={() => {
                    updateMerchant({
                      viewOnlyAddress: '',
                      viewOnlyViewKey: '',
                      viewOnlySeedPhrase: '',
                      viewOnlySeedBackedUp: false,
                      viewOnlyRestoreHeight: 0,
                      viewOnlyNodeUrl: '',
                      viewOnlySetupComplete: false,
                      rpcConnected: false,
                    });
                    setShowBrowserWalletSetup(true);
                  }}
                  className={`border-border hover:border-primary/50 text-xs ${merchant.viewOnlySeedBackedUp ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <RefreshCw className="w-3 h-3 mr-1.5" /> Create New Wallet
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => requireAdmin(() => {
                    updateMerchant({
                      viewOnlyAddress: '',
                      viewOnlyViewKey: '',
                      viewOnlySeedPhrase: '',
                      viewOnlySeedBackedUp: false,
                      viewOnlyRestoreHeight: 0,
                      viewOnlyNodeUrl: '',
                      viewOnlySetupComplete: false,
                      rpcConnected: false,
                    });
                    setShowRestoreFromSeed(true);
                  })}
                  className="border-border hover:border-primary/50 text-xs"
                >
                  <Lock className="w-3 h-3 mr-1.5" /> Restore from Seed
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => requireAdmin(() => {
                    updateMerchant({
                      viewOnlyAddress: '',
                      viewOnlyViewKey: '',
                      viewOnlySeedPhrase: '',
                      viewOnlySeedBackedUp: false,
                      viewOnlyRestoreHeight: 0,
                      viewOnlyNodeUrl: '',
                      viewOnlySetupComplete: false,
                      walletMode: 'managed',
                      rpcConnected: false,
                    });
                    toast.success('Browser wallet removed');
                  })}
                  className="border-destructive/30 hover:border-destructive/50 text-destructive text-xs"
                >
                  <Lock className="w-3 h-3 mr-1.5" /> Remove Wallet
                </Button>
              </div>

              {/* Advanced Setup Button */}
              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedSetup(true)}
                  className="w-full border-border hover:border-primary/50 text-xs"
                >
                  <Settings2 className="w-3 h-3 mr-1.5" />
                  Advanced Setup — Send Mode ({merchant.sendMode === 'wasm' ? 'Full WASM' : 'Daemon Proxy'})
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                  Configure how real Monero transactions are constructed and broadcast
                </p>
              </div>
            </div>
          )}

          {/* Multi-Chain Wallet */}
          {walletMode === 'viewonly' && merchant.viewOnlySetupComplete && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Multi-Chain Wallet</h3>
              </div>
              <MultiChainOptIn />
              
              {/* Show multi-chain addresses if enabled */}
              {merchant.multiChainEnabled && (
                <div className="space-y-2 p-4 rounded-lg bg-card border border-border">
                  {merchant.ethAddress && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                        ETH / ARB Address
                      </label>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-[10px] text-foreground bg-background border border-border rounded p-2 flex-1 break-all">{merchant.ethAddress}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-6 w-6"
                          onClick={() => {
                            navigator.clipboard.writeText(merchant.ethAddress || '');
                            toast.success('ETH/ARB address copied');
                          }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {merchant.tronAddress && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground">
                        TRX Address
                      </label>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-[10px] text-foreground bg-background border border-border rounded p-2 flex-1 break-all">{merchant.tronAddress}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-6 w-6"
                          onClick={() => {
                            navigator.clipboard.writeText(merchant.tronAddress || '');
                            toast.success('TRX address copied');
                          }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* BIP-39 Backup Reminder */}
 {!merchant.bip39MnemonicBackedUp && merchant.bip39Mnemonic && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="w-3 h-3 text-destructive" />
                        <p className="text-xs font-semibold text-destructive">Back up multi-chain seed phrase</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-2">
                        Your 24-word BIP-39 seed phrase controls your ETH/ARB/TRX wallets. Write it down now.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                        onClick={() => requireAdmin(() => {
                          navigator.clipboard.writeText(merchant.bip39Mnemonic || '');
                          toast.success('BIP-39 seed phrase copied — store it safely!');
                        })}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy Seed Phrase
                      </Button>
                      <Button
                        size="sm"
                        className="ml-2 bg-gradient-orange text-xs"
                        onClick={() => {
                          updateMerchant({ bip39MnemonicBackedUp: true });
                          toast.success('BIP-39 seed phrase marked as backed up');
                        }}
                      >
                        <Check className="w-3 h-3 mr-1" /> I've saved it
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Advanced Wallet Setup Dialog */}
          <AdvancedWalletSetup open={showAdvancedSetup} onOpenChange={setShowAdvancedSetup} />

          {/* Set Admin Password Dialog */}
          <Dialog open={showSetAdmin} onOpenChange={(open) => { setShowSetAdmin(open); if (!open) { setAdminPass(''); setAdminPassConfirm(''); setPendingAction(null); } }}>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader><DialogTitle className="text-foreground flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> Set Admin Password</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">You must set an admin password before performing this action.</p>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-foreground">Password (min 6 chars)</Label>
                  <div className="relative">
                    <Input type={showAdminPass ? 'text' : 'password'} value={adminPass} onChange={e => setAdminPass(e.target.value)} className="bg-background border-border pr-10" />
                    <button onClick={() => setShowAdminPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Confirm Password</Label>
                  <Input type="password" value={adminPassConfirm} onChange={e => setAdminPassConfirm(e.target.value)} className="bg-background border-border" onKeyDown={e => e.key === 'Enter' && handleSetAdminAndProceed()} />
                </div>
                <Button onClick={handleSetAdminAndProceed} className="w-full bg-gradient-orange hover:opacity-90">Set Password & Continue</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Unlock Admin Dialog */}
          <Dialog open={showUnlockAdmin} onOpenChange={(open) => { setShowUnlockAdmin(open); if (!open) { setUnlockPass(''); setPendingAction(null); } }}>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader><DialogTitle className="text-foreground flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Admin Password Required</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">Enter your admin password to continue.</p>
              <div className="space-y-4 mt-2">
                <Input type="password" value={unlockPass} onChange={e => setUnlockPass(e.target.value)} placeholder="Enter admin password" className="bg-background border-border" onKeyDown={e => e.key === 'Enter' && handleUnlockAndProceed()} />
                <Button onClick={handleUnlockAndProceed} className="w-full bg-gradient-orange hover:opacity-90">Unlock & Continue</Button>
              </div>
            </DialogContent>
          </Dialog>




          {/* Self-Custody Configuration */}
          {walletMode === 'selfcustody' && (
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">RPC Configuration</h3>
                {merchant.rpcConnected ? (
                  <Badge className="bg-success/10 text-success border-success/20 text-xs">
                    <Wifi className="w-3 h-3 mr-1" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-warning border-warning/20 text-xs">
                    <WifiOff className="w-3 h-3 mr-1" /> Disconnected
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <TooltipProvider>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-foreground text-xs">RPC Endpoint URL</Label>
                    <Tooltip>
                      <TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">The URL where your monero-wallet-rpc is running (e.g. http://127.0.0.1:18082)</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
                <Input value={merchant.rpcEndpoint} onChange={e => updateMerchant({ rpcEndpoint: e.target.value })} className="bg-background border-border font-mono text-sm" placeholder="http://127.0.0.1:18082" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <TooltipProvider>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-foreground text-xs">RPC Username</Label>
                      <Tooltip>
                        <TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent>Username set via --rpc-login flag</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                  <Input value={merchant.rpcUsername} onChange={e => updateMerchant({ rpcUsername: e.target.value })} className="bg-background border-border text-sm" placeholder="monero" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground text-xs">RPC Password</Label>
                  <Input type="password" value={merchant.rpcPassword} onChange={e => updateMerchant({ rpcPassword: e.target.value })} className="bg-background border-border text-sm" placeholder="••••••••" />
                </div>
              </div>

              <div className="space-y-2">
                <TooltipProvider>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-foreground text-xs">Wallet Filename</Label>
                    <Tooltip>
                      <TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent>Name of the wallet file in your --wallet-dir directory</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
                <Input value={merchant.rpcWalletFilename} onChange={e => updateMerchant({ rpcWalletFilename: e.target.value })} className="bg-background border-border text-sm" placeholder="merchant_wallet" />
              </div>

              <Button onClick={handleTestConnection} disabled={testing} className="bg-gradient-orange hover:opacity-90 w-full">
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wifi className="w-4 h-4 mr-2" />}
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
              {merchant.rpcConnected && (
                <Badge className="bg-primary/10 text-primary border-primary/20">🔐 Self-Custody Mode Active</Badge>
              )}
            </div>
          )}
        </div>
      </FadeIn>

      {/* Privacy Mode — Pro Only */}
      <FadeIn delay={0.03}>
        <div className={`p-6 rounded-xl border space-y-4 ${isPro ? 'bg-card border-success/20' : 'bg-card border-border opacity-60'}`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-success" />
            <h2 className="text-lg font-semibold text-foreground">Complete Privacy Mode</h2>
            {!isPro && <Badge variant="outline" className="text-primary border-primary/30 text-xs">Pro Only</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">Store all data in encrypted browser storage (IndexedDB + AES-GCM). Zero server-side data.</p>
          {isPro ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable Privacy Mode</p>
                  <p className="text-xs text-muted-foreground">All data stored locally, encrypted with your passphrase</p>
                </div>
                <Switch checked={merchant.privacyModeEnabled} onCheckedChange={v => updateMerchant({ privacyModeEnabled: v })} />
              </div>
              {merchant.privacyModeEnabled && (
                <div className="space-y-4 pt-2 border-t border-border">
                  <div className="space-y-2">
                    <Label className="text-foreground">Encryption Passphrase</Label>
                    <Input type="password" value={merchant.privacyPassphrase} onChange={e => updateMerchant({ privacyPassphrase: e.target.value })} className="bg-background border-border font-mono text-sm" placeholder="Choose a strong passphrase" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Privacy Backup Email</Label>
                    <Input type="email" value={merchant.privacyBackupEmail} onChange={e => updateMerchant({ privacyBackupEmail: e.target.value })} className="bg-background border-border text-sm" placeholder="backup@yourmail.com" />
                    <p className="text-xs text-muted-foreground">Encrypted backups will be emailed here every 24h.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportBackup} className="border-border hover:border-success/50 text-success">
                      <Download className="w-4 h-4 mr-1" /> Export Backup (.json.aes)
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={restoring} className="border-border hover:border-primary/50">
                      <Upload className="w-4 h-4 mr-1" /> Restore from Backup
                    </Button>
                    <input ref={fileRef} type="file" accept=".aes,.json.aes" className="hidden" onChange={handleRestoreBackup} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Upgrade to Pro ($29/mo) to unlock Complete Privacy Mode.</p>
          )}
        </div>
      </FadeIn>

      {/* Payment Confirmation Settings */}
      <FadeIn delay={0.04}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Payment Confirmation</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure how many block confirmations are required before a payment is marked as complete. 
            Lower = faster checkout, higher = more secure.
          </p>

          {/* Required Confirmations Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Required Confirmations</Label>
              <span className="text-sm font-mono text-primary font-bold">{merchant.requiredConfirmations ?? 1}</span>
            </div>
            <Slider
              value={[merchant.requiredConfirmations ?? 1]}
              onValueChange={v => updateMerchant({ requiredConfirmations: v[0] })}
              min={1}
              max={10}
              step={1}
              className="py-2"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1 (fast ~2 min)</span>
              <span>5 (~10 min)</span>
              <span>10 (max security ~20 min)</span>
            </div>
          </div>

          {/* 0-conf for small amounts */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Zero-Confirmation Auto-Approve</p>
                <p className="text-xs text-muted-foreground">Instantly approve small payments (0-conf) — great for coffee shops & kiosks</p>
              </div>
              <Switch
                checked={merchant.zeroConfEnabled ?? true}
                onCheckedChange={v => updateMerchant({ zeroConfEnabled: v })}
              />
            </div>
            {(merchant.zeroConfEnabled ?? true) && (
              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground text-xs">Max amount for 0-conf</Label>
                  <span className="text-sm font-mono text-primary">{merchant.fiatSymbol || '$'}{merchant.zeroConfThresholdUsd ?? 30}</span>
                </div>
                <Slider
                  value={[merchant.zeroConfThresholdUsd ?? 30]}
                  onValueChange={v => updateMerchant({ zeroConfThresholdUsd: v[0] })}
                  min={5}
                  max={200}
                  step={5}
                  className="py-2"
                />
                <p className="text-[10px] text-muted-foreground">
                  Orders under {merchant.fiatSymbol || '$'}{merchant.zeroConfThresholdUsd ?? 30} will be instantly approved when seen in the mempool.
                  Full confirmation follows in ~2 minutes.
                </p>
              </div>
            )}
          </div>

          {/* Preferred fee tier */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-foreground text-xs">Default Fee Tier Display</Label>
            <p className="text-[10px] text-muted-foreground mb-2">Which fee estimate to show customers on the payment screen</p>
            <div className="grid grid-cols-3 gap-2">
              {(['normal', 'fast', 'urgent'] as const).map(tier => (
                <button
                  key={tier}
                  onClick={() => updateMerchant({ preferredFeeTier: tier })}
                  className={`text-center p-2.5 rounded-lg border-2 transition-all text-xs ${
                    (merchant.preferredFeeTier || 'normal') === tier
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${
                    tier === 'normal' ? 'bg-success' : tier === 'fast' ? 'bg-warning' : 'bg-destructive'
                  }`} />
                  <span className="capitalize">{tier}</span>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {tier === 'normal' ? '~20 min' : tier === 'fast' ? '~10 min' : '~2 min'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Webhook URL */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-foreground text-xs">Payment Webhook URL</Label>
            <Input
              value={merchant.webhookPaymentUrl || ''}
              onChange={e => updateMerchant({ webhookPaymentUrl: e.target.value })}
              className="bg-background border-border font-mono text-sm"
              placeholder="https://yoursite.com/api/payment-confirmed"
            />
            <p className="text-[10px] text-muted-foreground">
              We'll POST a JSON payload when a payment reaches the required confirmations. 
              Includes: invoiceId, txid, amount, confirmations, timestamp.
            </p>
          </div>
        </div>
      </FadeIn>


      <FadeIn delay={0.05}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Cold Wallet Auto-Sweep</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Automatically sweep funds to your cold wallet when accumulated payments exceed threshold.
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Auto-Sweep</p>
              <p className="text-xs text-muted-foreground">Auto-sweep when accumulated balance exceeds threshold</p>
            </div>
            <Switch checked={merchant.autoSweepEnabled} onCheckedChange={v => updateMerchant({ autoSweepEnabled: v })} />
          </div>
          {merchant.autoSweepEnabled && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div className="space-y-2">
                <Label className="text-foreground">Cold Wallet Address</Label>
                <Input value={merchant.coldWalletAddress} onChange={e => updateMerchant({ coldWalletAddress: e.target.value })} className="bg-background border-border font-mono text-xs" placeholder="Your XMR cold wallet address" />
              </div>

              {/* Sweep Stats - Live from store */}
              {(() => {
                const cumulativeReceived = useStore.getState().calculateCumulativeReceived();
                const availableToSweep = cumulativeReceived - (merchant.totalSweptXmr || 0);
                const threshold = merchant.autoSweepThreshold || 0.5;

                return (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground mb-2">Sweep Statistics</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Received</p>
                        <p className="text-sm font-mono text-foreground">{cumulativeReceived.toFixed(6)} XMR</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Swept</p>
                        <p className="text-sm font-mono text-foreground">{(merchant.totalSweptXmr || 0).toFixed(6)} XMR</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Threshold</p>
                        <p className="text-sm font-mono text-primary">{threshold.toFixed(2)} XMR</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Sweep Threshold</Label>
                  <span className="text-sm font-mono text-primary">{merchant.autoSweepThreshold} XMR</span>
                </div>
                <Slider value={[merchant.autoSweepThreshold]} onValueChange={v => updateMerchant({ autoSweepThreshold: v[0] })} min={0.01} max={10} step={0.01} className="py-2" />
                <p className="text-xs text-muted-foreground">Minimum wallet balance required before auto-sweep</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Sweep Check Frequency</Label>
                  <span className="text-sm font-mono text-primary">{formatFrequency(merchant.autoSweepCheckFrequency || 240)}</span>
                </div>
                <Slider
                  value={[merchant.autoSweepCheckFrequency || 240]}
                  onValueChange={v => updateMerchant({ autoSweepCheckFrequency: v[0] })}
                  min={1}
                  max={720}
                  step={1}
                  className="py-2"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>1m</span>
                  <span>1h</span>
                  <span className="text-primary font-bold">4h</span>
                  <span>8h</span>
                  <span>12h</span>
                </div>
                <p className="text-xs text-muted-foreground">How often to check wallet balance (recommended: 4 hours)</p>
              </div>

              {/* Sweep Now Button */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Manual Sweep</p>
                  <p className="text-xs text-muted-foreground">Trigger sweep immediately if above threshold</p>
                </div>
                <Button
                  onClick={handleSweepNow}
                  disabled={sweeping || !merchant.coldWalletAddress}
                  className="bg-gradient-orange hover:opacity-90 gap-2"
                >
                  {sweeping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sweeping ? 'Sweeping...' : 'Sweep Now'}
                </Button>
              </div>

              {/* Sweep Result */}
              {sweepResult && (
                <div className={`p-3 rounded-lg text-sm ${
                  sweepResult.success ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                }`}>
                  {sweepResult.message}
                </div>
              )}
            </div>
          )}
        </div>
      </FadeIn>


      {/* Referral Settings */}
      <FadeIn delay={0.09}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Referral Program</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Referrals</p>
              <p className="text-xs text-muted-foreground">Earn XMR commissions by referring merchants</p>
            </div>
            <Switch checked={merchant.referralsEnabled} onCheckedChange={v => updateMerchant({ referralsEnabled: v })} />
          </div>
          {merchant.referralsEnabled && (
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-foreground">Custom Referral Code</Label>
              <Input value={merchant.referralCode} onChange={e => updateMerchant({ referralCode: e.target.value })} className="bg-background border-border font-mono text-sm" placeholder="your-code" />
              <p className="text-xs text-muted-foreground">Link: https://xmrpay.flow/ref/{merchant.referralCode}</p>
            </div>
          )}
        </div>
      </FadeIn>

      {/* Custom Domain (FQDN) */}
      <FadeIn delay={0.095}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Custom Domain (FQDN)</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Set your custom domain for payment links, invoices, and the checkout page. This replaces the default app URL.
          </p>
          <div className="space-y-2">
            <Label className="text-foreground">Your Domain</Label>
            <Input
              value={merchant.fqdn || ''}
              onChange={e => updateMerchant({ fqdn: e.target.value.replace(/^https?:\/\//, '').replace(/\/$/, '') })}
              className="bg-background border-border font-mono text-sm"
              placeholder="pay.yourbusiness.com"
            />
            <p className="text-xs text-muted-foreground">Used by: <span className="text-primary">Payment Links</span>, <span className="text-primary">Invoices</span>, <span className="text-primary">Checkout Pages</span></p>
          </div>
          {merchant.fqdn && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20">
              <p className="text-[11px] text-success">✓ Payment links will use <strong className="font-mono">https://{merchant.fqdn}</strong></p>
            </div>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Webhook Configuration</h2>
          <div className="space-y-2">
            <Label className="text-foreground">Webhook URL</Label>
            <Input value={merchant.webhookUrl} onChange={e => updateMerchant({ webhookUrl: e.target.value })} className="bg-background border-border font-mono text-sm" placeholder="https://yoursite.com/webhooks/xmr" />
            <p className="text-xs text-muted-foreground">We'll POST payment confirmations to this URL.</p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.12}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Settlement</h2>
          <p className="text-xs text-muted-foreground">
            Incoming payments will be automatically forwarded to this address after confirmation (when set).
          </p>
          <div className="space-y-2">
            <Label className="text-foreground">Settlement Address</Label>
            <Input value={merchant.settlementAddress} onChange={e => updateMerchant({ settlementAddress: e.target.value })} className="bg-background border-border font-mono text-xs" placeholder="Your XMR wallet address for settlement" />
            {merchant.settlementAddress && (
              <div className="p-2 rounded-lg bg-success/10 border border-success/20">
                <p className="text-[11px] text-success">✓ Payments will auto-forward to this address after confirmation.</p>
              </div>
            )}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.14}>
        <CsvInventoryImport />
      </FadeIn>

      <FadeIn delay={0.15}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h2 className="text-lg font-semibold text-foreground">API Key</h2>
          <div className="flex items-center gap-2">
            <Input value={showKey ? merchant.apiKey : '•'.repeat(merchant.apiKey.length)} readOnly className="bg-background border-border font-mono text-sm flex-1" />
            <Button variant="outline" size="icon" onClick={() => setShowKey(v => !v)} className="border-border hover:border-primary/50 shrink-0">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={copyKey} className="border-border hover:border-primary/50 shrink-0">
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Plan</h2>
              <p className="text-sm text-muted-foreground">Current: <span className="capitalize font-medium text-foreground">{merchant.plan}</span></p>
            </div>
            {merchant.plan === 'free' && (
              <p className="text-xs text-muted-foreground">Visit the <span className="text-primary">Referrals</span> tab to upgrade to Pro</p>
            )}
            {merchant.plan === 'pro' && (
              <Badge className="bg-primary/10 text-primary border-primary/20">Pro Plan Active</Badge>
            )}
          </div>
        </div>
      </FadeIn>

      {/* DANGER ZONE */}
      <FadeIn delay={0.25}>
        <div className="p-6 rounded-xl border-2 border-destructive/30 bg-destructive/5 space-y-4">
          <h2 className="text-lg font-bold text-destructive">⚠️ DANGER ZONE</h2>
          <p className="text-xs text-muted-foreground">Permanently delete your entire account, all invoices, wallet data, cookies, and local storage. This action <strong className="text-destructive">cannot be undone</strong>.</p>

          <div className="space-y-2">
            <Label className="text-foreground text-sm">Enter your 25-word seed phrase to confirm deletion</Label>
            <textarea
              value={dangerSeed}
              onChange={e => setDangerSeed(e.target.value)}
              className="w-full h-24 rounded-lg bg-background border border-destructive/30 p-3 text-sm font-mono text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-destructive/60"
              placeholder="Enter your seed phrase to unlock account deletion..."
            />
          </div>

          {(() => {
            const seedMatch = dangerSeed.trim().toLowerCase() === (merchant.viewOnlySeedPhrase || '').trim().toLowerCase();
            const hasSeed = !!merchant.viewOnlySeedPhrase;
            return (
              <>
                {dangerSeed.length > 0 && !seedMatch && (
                  <p className="text-xs text-destructive">Seed phrase does not match. Please enter the exact 25-word phrase.</p>
                )}
                {dangerSeed.length > 0 && seedMatch && (
                  <p className="text-xs text-success">✓ Seed phrase verified</p>
                )}
                <Button
                  variant="destructive"
                  disabled={hasSeed ? !seedMatch : false}
                  onClick={() => setShowDangerConfirm(true)}
                  className="w-full"
                >
                  DELETE ENTIRE ACCOUNT
                </Button>
              </>
            );
          })()}

          <Dialog open={showDangerConfirm} onOpenChange={setShowDangerConfirm}>
            <DialogContent className="bg-card border-destructive/30 max-w-sm">
              <DialogHeader><DialogTitle className="text-destructive">Final Confirmation</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">This will permanently delete:</p>
              <ul className="text-xs text-foreground space-y-1 list-disc list-inside">
                <li>All wallet data and keys</li>
                <li>All invoices and payment history</li>
                <li>All subscriptions and payment links</li>
                <li>All settings and preferences</li>
                <li>Cookies and local storage</li>
              </ul>
              <p className="text-xs text-destructive font-bold">This cannot be reversed.</p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowDangerConfirm(false)} className="flex-1 border-border">Cancel</Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    deleteAccount();
                    setShowDangerConfirm(false);
                    toast.success('Account deleted. All data has been wiped.');
                    window.location.href = '/';
                  }}
                >
                  DELETE EVERYTHING
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </FadeIn>
    </div>
  );
}
