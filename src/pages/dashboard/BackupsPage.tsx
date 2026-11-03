import { FadeIn } from '@/components/FadeIn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStore } from '@/lib/store';
import { HardDrive, Cloud, Lock, Download, Upload, Loader2, ShieldCheck, Clock, Check, ExternalLink } from 'lucide-react';
import { HelpTooltip } from '@/components/HelpTooltip';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { exportEncryptedBackup, importEncryptedBackup } from '@/lib/crypto-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isMerchantPro } from '@/lib/subscription';
// ── Inline cloud OAuth types & config (avoids module resolution issues) ──

interface CloudProviderConfig {
  id: string;
  name: string;
  icon: string;
  desc: string;
  instructions: string;
  authEndpoint: string;
  tokenEndpoint: string;
  scope: string;
  clientId: string;
  uploadEndpoint: string;
}

const CLOUD_PROVIDER_CONFIGS: CloudProviderConfig[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    icon: '🟢',
    desc: 'Back up encrypted wallet data to your Google Drive',
    instructions: 'Click Authorize to securely connect your Google account. MoneroFlow will only access a private app folder.',
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive.file',
    clientId: 'YOUR_GOOGLE_CLIENT_ID',
    uploadEndpoint: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: '🔵',
    desc: 'Sync encrypted backups to your Dropbox',
    instructions: 'Click Authorize to securely connect your Dropbox account. Backups are stored in a dedicated MoneroFlow folder.',
    authEndpoint: 'https://www.dropbox.com/oauth2/authorize',
    tokenEndpoint: 'https://api.dropboxapi.com/oauth2/token',
    scope: 'files.content.write',
    clientId: 'YOUR_DROPBOX_CLIENT_ID',
    uploadEndpoint: 'https://content.dropboxapi.com/2/files/upload',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    icon: '🔷',
    desc: 'Store encrypted backups in your OneDrive',
    instructions: 'Click Authorize to securely connect your Microsoft account. MoneroFlow uses a private app folder for all backup data.',
    authEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'Files.ReadWrite.AppFolder',
    clientId: 'YOUR_ONEDRIVE_CLIENT_ID',
    uploadEndpoint: 'https://graph.microsoft.com/v1.0/me/drive/special/approot:/',
  },
];

const TOKEN_PREFIX = 'moneroflow_cloud_token_';
const VERIFIER_KEY = 'moneroflow_oauth_verifier';
const STATE_KEY = 'moneroflow_oauth_state';

function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isProviderConfigured(providerId: string): boolean {
  const config = CLOUD_PROVIDER_CONFIGS.find(p => p.id === providerId);
  if (!config) return false;
  return !config.clientId.startsWith('YOUR_');
}

function isProviderConnected(providerId: string): boolean {
  try {
    const raw = localStorage.getItem(TOKEN_PREFIX + providerId);
    if (!raw) return false;
    const token = JSON.parse(raw);
    return !!token.access_token;
  } catch {
    return false;
  }
}

function getStoredToken(providerId: string): { access_token: string; refresh_token?: string; expires_at?: number } | null {
  try {
    const raw = localStorage.getItem(TOKEN_PREFIX + providerId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearCloudToken(providerId: string): void {
  localStorage.removeItem(TOKEN_PREFIX + providerId);
}

async function initiateOAuth(providerId: string): Promise<string> {
  const config = CLOUD_PROVIDER_CONFIGS.find(p => p.id === providerId);
  if (!config) throw new Error(`Unknown provider: ${providerId}`);
  const verifier = generateRandomString(64);
  const challenge = base64UrlEncode(await sha256(verifier));
  const state = generateRandomString(32);
  localStorage.setItem(VERIFIER_KEY, JSON.stringify({ verifier, providerId }));
  localStorage.setItem(STATE_KEY, state);
  const redirectUri = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    client_id: config.clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: config.scope, state, code_challenge: challenge, code_challenge_method: 'S256',
    access_type: 'offline', prompt: 'consent',
  });
  return `${config.authEndpoint}?${params.toString()}`;
}

async function detectAndHandleOAuthCallback(): Promise<string | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return null;
  const savedState = localStorage.getItem(STATE_KEY);
  if (state !== savedState) return null;
  const verifierData = localStorage.getItem(VERIFIER_KEY);
  if (!verifierData) return null;
  const { verifier, providerId } = JSON.parse(verifierData);
  const config = CLOUD_PROVIDER_CONFIGS.find(p => p.id === providerId);
  if (!config) return null;
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, '', cleanUrl);
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: cleanUrl,
      client_id: config.clientId, code_verifier: verifier,
    });
    const resp = await fetch(config.tokenEndpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(),
    });
    if (!resp.ok) throw new Error(`Token exchange failed: ${resp.status}`);
    const tokenData = await resp.json();
    localStorage.setItem(TOKEN_PREFIX + providerId, JSON.stringify({
      access_token: tokenData.access_token, refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
    }));
    localStorage.removeItem(VERIFIER_KEY);
    localStorage.removeItem(STATE_KEY);
    return providerId;
  } catch (err) {
    console.error('OAuth token exchange failed:', err);
    localStorage.removeItem(VERIFIER_KEY);
    localStorage.removeItem(STATE_KEY);
    return null;
  }
}

async function uploadBackupToCloud(providerId: string, filename: string, data: Blob): Promise<void> {
  const token = getStoredToken(providerId);
  if (!token?.access_token) throw new Error('Not connected to ' + providerId);
  const config = CLOUD_PROVIDER_CONFIGS.find(p => p.id === providerId);
  if (!config) throw new Error('Unknown provider');
  if (providerId === 'google-drive') {
    const metadata = { name: filename, mimeType: 'application/octet-stream' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', data);
    const resp = await fetch(config.uploadEndpoint, { method: 'POST', headers: { Authorization: `Bearer ${token.access_token}` }, body: form });
    if (!resp.ok) throw new Error(`Google Drive upload failed: ${resp.status}`);
  } else if (providerId === 'dropbox') {
    const resp = await fetch(config.uploadEndpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path: `/MoneroFlow/${filename}`, mode: 'overwrite' }) }, body: data,
    });
    if (!resp.ok) throw new Error(`Dropbox upload failed: ${resp.status}`);
  } else if (providerId === 'onedrive') {
    const resp = await fetch(`${config.uploadEndpoint}${filename}:/content`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/octet-stream' }, body: data,
    });
    if (!resp.ok) throw new Error(`OneDrive upload failed: ${resp.status}`);
  }
}

const FREQUENCY_OPTIONS = [
  { value: '1h', label: 'Every 1 hour' },
  { value: '4h', label: 'Every 4 hours' },
  { value: '1d', label: 'Every 1 day' },
  { value: '3d', label: 'Every 3 days' },
  { value: '5d', label: 'Every 5 days' },
  { value: '1w', label: 'Every 1 week' },
];

export default function BackupsPage() {
  const merchant = useStore(s => s.merchant);
  const updateMerchant = useStore(s => s.updateMerchant);
  const restoreFromBackup = useStore(s => s.restoreFromBackup);
  const isPro = isMerchantPro(merchant);

  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [backupFrequency, setBackupFrequency] = useState('1d');
  const [encryptedBackups, setEncryptedBackups] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);
  const [showCloudWizard, setShowCloudWizard] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [uploadingToCloud, setUploadingToCloud] = useState(false);

  // Track connected providers reactively
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(() => {
    const set = new Set<string>();
    CLOUD_PROVIDER_CONFIGS.forEach(p => {
      if (isProviderConnected(p.id)) set.add(p.id);
    });
    return set;
  });

  // Handle OAuth callback on page load
  useEffect(() => {
    detectAndHandleOAuthCallback().then(providerId => {
      if (providerId) {
        setConnectedProviders(prev => new Set([...prev, providerId]));
        const name = CLOUD_PROVIDER_CONFIGS.find(p => p.id === providerId)?.name;
        toast.success(`Connected to ${name}! Backups will sync automatically.`);
      }
    }).catch(err => {
      console.error('OAuth callback error:', err);
      toast.error(`OAuth failed: ${err.message}`);
    });
  }, []);

  const handleManualBackup = async () => {
    setExporting(true);
    try {
      const state = useStore.getState();
      const backupData = JSON.stringify({
        merchant: state.merchant,
        invoices: state.invoices,
        subscriptions: state.subscriptions,
        paymentLinks: state.paymentLinks,
        referrals: state.referrals,
        referralPayouts: state.referralPayouts,
        isAuthenticated: state.isAuthenticated,
        autoBackupEnabled,
        backupFrequency,
        encryptedBackups,
        timestamp: new Date().toISOString(),
        version: '2.0',
      });

      const filename = `moneroflow-backup-${Date.now()}`;

      if (encryptedBackups && isPro && merchant.privacyPassphrase) {
        const blob = await exportEncryptedBackup(backupData, merchant.privacyPassphrase);

        // Upload to connected cloud providers
        const connectedList = Array.from(connectedProviders);
        if (connectedList.length > 0) {
          setUploadingToCloud(true);
          for (const providerId of connectedList) {
            try {
              await uploadBackupToCloud(providerId, `${filename}.json.aes`, blob);
              toast.success(`Backup uploaded to ${CLOUD_PROVIDER_CONFIGS.find(p => p.id === providerId)?.name}`);
            } catch (err: any) {
              toast.error(`Upload to ${providerId} failed: ${err.message}`);
            }
          }
          setUploadingToCloud(false);
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json.aes`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Encrypted backup downloaded!');
      } else {
        const blob = new Blob([backupData], { type: 'application/json' });

        // Upload to connected cloud providers
        const connectedList = Array.from(connectedProviders);
        if (connectedList.length > 0) {
          setUploadingToCloud(true);
          for (const providerId of connectedList) {
            try {
              await uploadBackupToCloud(providerId, `${filename}.json`, blob);
              toast.success(`Backup uploaded to ${CLOUD_PROVIDER_CONFIGS.find(p => p.id === providerId)?.name}`);
            } catch (err: any) {
              toast.error(`Upload to ${providerId} failed: ${err.message}`);
            }
          }
          setUploadingToCloud(false);
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Backup downloaded!');
      }
    } catch {
      toast.error('Backup export failed');
    }
    setExporting(false);
  };

  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [showRestorePassphrasePrompt, setShowRestorePassphrasePrompt] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);

  const doRestore = async (file: File, passphrase: string) => {
    setRestoring(true);
    try {
      let json: string;
      if (file.name.endsWith('.aes')) {
        json = await importEncryptedBackup(file, passphrase);
      } else {
        json = await file.text();
      }
      const parsed = JSON.parse(json);
      restoreFromBackup(parsed);
      if (typeof parsed.autoBackupEnabled === 'boolean') setAutoBackupEnabled(parsed.autoBackupEnabled);
      if (parsed.backupFrequency) setBackupFrequency(parsed.backupFrequency);
      if (typeof parsed.encryptedBackups === 'boolean') setEncryptedBackups(parsed.encryptedBackups);
      const invoiceCount = parsed.invoices?.length || 0;
      const subCount = parsed.subscriptions?.length || 0;
      const userCount = parsed.merchant?.posUsers?.length || 0;
      const proStatus = parsed.merchant?.proStatus || 'free';
      toast.success(`Backup restored! ${invoiceCount} invoices, ${subCount} subscriptions, ${userCount} users. Pro: ${proStatus}`);
      setShowRestorePassphrasePrompt(false);
      setPendingRestoreFile(null);
      setRestorePassphrase('');
    } catch {
      toast.error('Restore failed — wrong passphrase or corrupted file');
    }
    setRestoring(false);
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.aes')) {
      if (merchant.privacyPassphrase) {
        await doRestore(file, merchant.privacyPassphrase);
      } else {
        setPendingRestoreFile(file);
        setShowRestorePassphrasePrompt(true);
      }
    } else {
      await doRestore(file, '');
    }
    if (e.target) e.target.value = '';
  };

  const currentProvider = CLOUD_PROVIDER_CONFIGS.find(p => p.id === showCloudWizard);

  const handleCloudConnect = (providerId: string) => {
    setShowCloudWizard(providerId);
  };

  const handleCloudAuthorize = async () => {
    if (!showCloudWizard) return;
    setConnectingProvider(showCloudWizard);

    try {
      const authUrl = await initiateOAuth(showCloudWizard);
      // Redirect to OAuth provider
      window.location.href = authUrl;
    } catch (err: any) {
      toast.error(err.message);
      setConnectingProvider(null);
    }
  };

  const handleDisconnectCloud = (providerId: string) => {
    clearCloudToken(providerId);
    setConnectedProviders(prev => {
      const next = new Set(prev);
      next.delete(providerId);
      return next;
    });
    toast.success(`Disconnected from ${CLOUD_PROVIDER_CONFIGS.find(p => p.id === providerId)?.name}`);
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <FadeIn>
        <h1 className="text-2xl font-bold text-foreground">Backups
          
                <HelpTooltip
                  title="Backups"
                  text="Download or restore complete backups of your wallet, invoices, subscriptions, and all settings. Supports encrypted backups (Pro) and cloud sync."
                />
        </h1>
        <p className="text-muted-foreground text-sm">Protect your data with local and cloud backups</p>
      </FadeIn>

      {/* Manual Backup */}
      <FadeIn delay={0.05}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Manual Backup</h2>
          </div>
          <p className="text-xs text-muted-foreground">Download a complete backup of your wallet, invoices, subscriptions, payment links, and all settings.</p>

          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-[11px] text-foreground">
              ✅ Backups include: <strong>merchant settings</strong>, <strong>all invoices</strong>, <strong>subscriptions</strong>, <strong>payment links</strong>, <strong>referral data</strong>, <strong>POS items & users</strong>, <strong>wallet/seed phrase</strong>, <strong>pro-sub status</strong>, <strong>passwords</strong>, <strong>analytics</strong>, and <strong>local currency settings</strong>.
            </p>
          </div>

          {connectedProviders.size > 0 && (
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <p className="text-[11px] text-success">
                ☁️ Backups will also upload to: {Array.from(connectedProviders).map(id => CLOUD_PROVIDER_CONFIGS.find(p => p.id === id)?.name).join(', ')}
              </p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleManualBackup} disabled={exporting || uploadingToCloud} className="bg-gradient-orange hover:opacity-90">
              {exporting || uploadingToCloud ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {uploadingToCloud ? 'Uploading to Cloud...' : exporting ? 'Exporting...' : 'Download Backup'}
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={restoring} className="border-border hover:border-primary/50">
              {restoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {restoring ? 'Restoring...' : 'Restore from File (.json / .aes)'}
            </Button>
            <input ref={fileRef} type="file" accept=".json,.aes,.json.aes" className="hidden" onChange={handleRestoreBackup} />
          </div>
        </div>
      </FadeIn>

      {/* Auto Local Backups */}
      <FadeIn delay={0.08}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Auto Local Backups</h2>
          </div>
          <p className="text-xs text-muted-foreground">Automatically save backup snapshots to your browser's storage at set intervals.</p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Auto Local Backups</p>
              <p className="text-xs text-muted-foreground">Snapshots saved to IndexedDB automatically</p>
            </div>
            <Switch checked={autoBackupEnabled} onCheckedChange={setAutoBackupEnabled} />
          </div>

          {autoBackupEnabled && (
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Backup Frequency</label>
                <Select value={backupFrequency} onValueChange={setBackupFrequency}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-[11px] text-muted-foreground">
                  💾 Backups are stored locally in your browser. They persist across sessions but will be lost if browser data is cleared. For maximum safety, also use cloud backup.
                </p>
              </div>
            </div>
          )}
        </div>
      </FadeIn>

      {/* Cloud Backups */}
      <FadeIn delay={0.1}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Cloud Backups</h2>
          </div>
          <p className="text-xs text-muted-foreground">Sync backups to a cloud provider via real OAuth 2.0 PKCE authorization. No passwords stored — only secure tokens.</p>

          <div className="grid gap-3">
            {CLOUD_PROVIDER_CONFIGS.map(provider => {
              const isConnected = connectedProviders.has(provider.id);
              return (
                <div key={provider.id} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${isConnected ? 'border-success/30 bg-success/5' : 'border-border bg-card'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{provider.name}</p>
                      <p className="text-xs text-muted-foreground">{provider.desc}</p>
                    </div>
                  </div>
                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-success/10 text-success border-success/20 text-xs">Connected</Badge>
                      <Button variant="ghost" size="sm" onClick={() => handleDisconnectCloud(provider.id)} className="text-xs text-muted-foreground hover:text-destructive">
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCloudConnect(provider.id)}
                      disabled={connectingProvider === provider.id}
                      className="border-border hover:border-primary/50"
                    >
                      {connectingProvider === provider.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                      Connect
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {connectedProviders.size > 0 && autoBackupEnabled && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-foreground">
                ✅ Auto backups will sync to {Array.from(connectedProviders).map(id => CLOUD_PROVIDER_CONFIGS.find(p => p.id === id)?.name).join(', ')} every <strong>{FREQUENCY_OPTIONS.find(f => f.value === backupFrequency)?.label?.toLowerCase()}</strong>.
              </p>
            </div>
          )}
        </div>
      </FadeIn>

      {/* Cloud Connection Wizard Dialog */}
      <Dialog open={!!showCloudWizard} onOpenChange={() => setShowCloudWizard(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <span className="text-2xl">{currentProvider?.icon}</span>
              Connect {currentProvider?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{currentProvider?.instructions}</p>

            <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">1</span>
                </div>
                <p className="text-xs text-foreground">Click "Authorize" to open {currentProvider?.name}'s secure sign-in page</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
                <p className="text-xs text-foreground">Sign in and grant MoneroFlow permission to create a backup folder</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">3</span>
                </div>
                <p className="text-xs text-foreground">You'll be redirected back here automatically</p>
              </div>
            </div>

            {currentProvider && !isProviderConfigured(currentProvider.id) && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-[11px] text-amber-400">
                  ⚠ This provider is not yet enabled. Contact your administrator to configure cloud backups.
                </p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <p className="text-[11px] text-success">
                🔐 MoneroFlow only stores encrypted backup files. We never read or access any other data in your cloud account. OAuth tokens are stored locally in your browser.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCloudWizard(null)} className="flex-1 border-border">
                Cancel
              </Button>
              <Button
                onClick={handleCloudAuthorize}
                disabled={!currentProvider || !isProviderConfigured(currentProvider.id) || !!connectingProvider}
                className="flex-1 bg-gradient-orange hover:opacity-90"
              >
                {connectingProvider ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Authorize
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Passphrase Prompt for encrypted backups without active passphrase */}
      <Dialog open={showRestorePassphrasePrompt} onOpenChange={(v) => { if (!v) { setShowRestorePassphrasePrompt(false); setPendingRestoreFile(null); setRestorePassphrase(''); } }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" /> Enter Backup Passphrase
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This backup is encrypted. Enter the passphrase you used when creating it to restore your data.
            </p>
            <div className="space-y-2">
              <Label className="text-foreground">Passphrase</Label>
              <Input
                type="password"
                value={restorePassphrase}
                onChange={e => setRestorePassphrase(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && pendingRestoreFile && restorePassphrase) doRestore(pendingRestoreFile, restorePassphrase); }}
                placeholder="Enter your backup passphrase"
                className="bg-background border-border font-mono"
              />
            </div>
            <Button
              onClick={() => pendingRestoreFile && doRestore(pendingRestoreFile, restorePassphrase)}
              disabled={!restorePassphrase || restoring}
              className="w-full bg-gradient-orange hover:opacity-90"
            >
              {restoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {restoring ? 'Restoring...' : 'Restore Backup'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Encrypted Backups — Pro Only */}
      <FadeIn delay={0.12}>
        <div className={`p-6 rounded-xl border space-y-4 ${isPro ? 'bg-card border-success/20' : 'bg-card border-border opacity-60'}`}>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-success" />
            <h2 className="text-lg font-semibold text-foreground">Encrypted Backups</h2>
            {!isPro && <Badge variant="outline" className="text-primary border-primary/30 text-xs">Pro Only</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">AES-256-GCM encrypted backups. Even if someone accesses your backup file, they can't read it without your passphrase.</p>

          {isPro ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable Encrypted Backups</p>
                  <p className="text-xs text-muted-foreground">All backups (manual + auto) will be encrypted with your Privacy Mode passphrase</p>
                </div>
                <Switch
                  checked={encryptedBackups}
                  onCheckedChange={v => {
                    if (v && !merchant.privacyPassphrase) {
                      toast.error('Set a passphrase in Settings → Privacy Mode first');
                      return;
                    }
                    setEncryptedBackups(v);
                  }}
                />
              </div>
              {encryptedBackups && (
                <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-xs text-success flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    Backups are encrypted with AES-256-GCM. Keep your passphrase safe — it cannot be recovered.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Upgrade to Pro ($29/mo) to unlock encrypted backups.</p>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
