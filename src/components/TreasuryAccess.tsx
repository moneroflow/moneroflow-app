import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Copy, Check, AlertTriangle, Lock, Gift, Sparkles, Bug } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';
import { CREATOR_SERVER_FQDN } from '@/lib/mock-data';


const CREATOR_PASSPHRASE = 'moneroflow-treasury-2026';

interface TreasuryAccessProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function generateProCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MF-PRO-';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function TreasuryAccess({ open, onOpenChange }: TreasuryAccessProps) {
  const merchant = useStore(s => s.merchant);
  const updateMerchant = useStore(s => s.updateMerchant);

  const [step, setStep] = useState<'auth' | 'reveal' | 'locked'>('auth');
  const [passphrase, setPassphrase] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const generatedCodes = merchant.lifetimeProCodes || [];

  const handleAuth = () => {
    if (passphrase === CREATOR_PASSPHRASE) {
      setStep('reveal');
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setStep('locked');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      toast.success('Access granted. You have 60 seconds.');
    } else {
      toast.error('Invalid passphrase');
    }
  };

  const handleGenerateProCode = async () => {
    const code = generateProCode();
    const entry = { code, createdAt: new Date().toISOString() };

    try {
      const response = await fetch(`${CREATOR_SERVER_FQDN}/api/mf/codes/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        throw new Error('Could not persist the code to the shared server');
      }

      updateMerchant({ lifetimeProCodes: [...generatedCodes, entry] });
      toast.success(`Lifetime Pro code generated: ${code}`);
    } catch {
      toast.error('Could not save the code to the shared server. It was not generated.');
    }

  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Code copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleClose = () => {
    setStep('auth');
    setPassphrase('');
    setCountdown(60);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Shield className="w-5 h-5 text-primary" /> Master Access
          </DialogTitle>
        </DialogHeader>

        {step === 'auth' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Creator-Only Access</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This lets you generate lifetime Pro subscription codes.
                    Auto-locks after 60 seconds.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Enter creator passphrase:</label>
              <Input
                type="password"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                placeholder="••••••••••••"
                className="bg-background border-border font-mono"
              />
            </div>
            <Button onClick={handleAuth} className="w-full bg-gradient-orange hover:opacity-90" disabled={!passphrase}>
              <Lock className="w-4 h-4 mr-2" /> Authenticate
            </Button>
          </div>
        )}

        {step === 'reveal' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge className="bg-primary/20 text-primary border-primary/30">Access Granted</Badge>
              <Badge variant="outline" className="text-destructive border-destructive/30 font-mono">
                Auto-lock: {countdown}s
              </Badge>
            </div>

            {/* Lifetime Pro Code Generator */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <label className="text-sm font-medium text-foreground">Lifetime Pro Codes</label>
                </div>
                <Button
                  size="sm"
                  onClick={handleGenerateProCode}
                  className="bg-gradient-orange hover:opacity-90"
                >
                  <Gift className="w-3.5 h-3.5 mr-1.5" /> Generate Code
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Codes are synced to the network server. When a recipient enters a code, it unlocks Pro for LIFE.
              </p>

              {generatedCodes.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {generatedCodes.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-sm font-bold tracking-wider ${entry.usedBy ? 'text-muted-foreground line-through' : 'text-primary'}`}>
                          {entry.code}
                        </span>
                        {entry.usedBy && <Badge className="bg-muted/10 text-muted-foreground border-muted/20 text-[9px]">USED</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</span>
                        {!entry.usedBy && (
                          <Button variant="ghost" size="sm" onClick={() => handleCopyCode(entry.code)} className="h-7 px-1.5">
                            {copiedCode === entry.code ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {generatedCodes.length === 0 && (
                <div className="text-center py-3 text-xs text-muted-foreground">
                  No codes generated yet. Click "Generate Code" to create one.
                </div>
              )}
            </div>

            {/* Dev Bypass Referral Checks */}
            <div className="p-3 rounded-lg bg-background border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bug className="w-4 h-4 text-yellow-500" />
                  <div>
                    <label className="text-sm font-medium text-foreground">Bypass Referral Checks</label>
                    <p className="text-[10px] text-muted-foreground">Skip referral count requirement for Pro unlock (dev/testing)</p>
                  </div>
                </div>
                <Switch
                  checked={merchant.devBypassReferrals}
                  onCheckedChange={(checked) => {
                    updateMerchant({ devBypassReferrals: checked });
                    toast.success(checked ? 'Referral bypass ENABLED' : 'Referral bypass disabled');
                  }}
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
              <p className="text-xs text-warning font-medium">
                ⚠️ This screen auto-locks in {countdown}s. After that, you must re-authenticate.
              </p>
            </div>
          </div>
        )}

        {step === 'locked' && (
          <div className="text-center py-6 space-y-3">
            <Lock className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">Session timed out. Re-authenticate to continue.</p>
            <Button variant="outline" onClick={() => { setStep('auth'); setCountdown(60); }}>
              Re-authenticate
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
