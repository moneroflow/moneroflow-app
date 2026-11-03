import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FadeIn } from '@/components/FadeIn';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Copy, Check, Users, TrendingUp, Coins, Gift, Zap, Crown, Shield, QrCode, Wallet, AlertTriangle, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { formatXMR, formatUSD, usdToXmr, PRO_MONTHLY_XMR, PRO_REFERRAL_UNLOCK_COUNT, CREATOR_TREASURY_ADDRESS, REFERRAL_ECOSYSTEM_PERCENT, CREATOR_SERVER_FQDN } from '@/lib/mock-data';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TreasuryAccess } from '@/components/TreasuryAccess';
import { isMerchantPro } from '@/lib/subscription';


const COMMISSION_TIERS = [
  { level: 1, label: 'Direct Referral', percent: 25 },
  { level: 2, label: 'Level 2', percent: 10 },
  { level: 3, label: 'Level 3', percent: 5 },
  { level: 4, label: 'Level 4+', percent: 2 },
];

// Anti-gaming: minimum requirements to be eligible for referral rewards
const REFERRAL_ELIGIBILITY = {
  minAccountAgeDays: 14,    // Account must be at least 14 days old
  minValidTxCount: 5,       // Must have at least 5 valid paid invoices
  minTotalVolumeUsd: 50,    // Must have processed at least $50 in total volume
};

export default function ReferralsPage() {
  const merchant = useStore(s => s.merchant);
  const invoices = useStore(s => s.invoices);
  const referrals = useStore(s => s.referrals);
  const referralPayouts = useStore(s => s.referralPayouts);
  const activateProSubscription = useStore(s => s.activateProSubscription);
  const activateProWithCode = useStore(s => s.activateProWithCode);
  const updateMerchant = useStore(s => s.updateMerchant);
  const [copied, setCopied] = useState(false);
  const [copiedTreasury, setCopiedTreasury] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showProActivation, setShowProActivation] = useState(false);
  const [showTreasury, setShowTreasury] = useState(false);
  const [proTxid, setProTxid] = useState('');
  const [referralInput, setReferralInput] = useState('');
  const [proCodeInput, setProCodeInput] = useState('');
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  // Check network connectivity to creator server
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const resp = await fetch(`${CREATOR_SERVER_FQDN}/api/mf/health`, { method: 'GET' });
        setNetworkStatus(resp.ok ? 'connected' : 'disconnected');
      } catch {
        setNetworkStatus('disconnected');
      }
    };
    checkNetwork();
    const interval = setInterval(checkNetwork, 30000);
    return () => clearInterval(interval);
  }, []);

  const fingerprint = merchant.referralWalletFingerprint || merchant.referralCode || 'LOADING';
  const directReferrals = referrals.filter(r => r.level === 1).length;
  const totalReferred = referrals.length;
  const monthlyEarnings = referrals.reduce((sum, r) => sum + (r.monthlyCommission || 0), 0);
  const lifetimeEarnings = referralPayouts.reduce((sum, p) => sum + p.xmrAmount, 0);
  const progressToFreePro = Math.min(directReferrals / PRO_REFERRAL_UNLOCK_COUNT * 100, 100);
  const isPro = isMerchantPro(merchant);
  const isProViaReferral = merchant.proStatus === 'pro_referral' || merchant.proUnlockedViaReferrals;

  // Anti-gaming eligibility check
  const accountAgeDays = Math.floor((Date.now() - new Date(merchant.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const totalVolumeUsd = paidInvoices.reduce((sum, i) => sum + i.fiatAmount, 0);
  const isEligibleForReferrals = 
    accountAgeDays >= REFERRAL_ELIGIBILITY.minAccountAgeDays &&
    paidInvoices.length >= REFERRAL_ELIGIBILITY.minValidTxCount &&
    totalVolumeUsd >= REFERRAL_ELIGIBILITY.minTotalVolumeUsd;

  const eligibilityChecks = [
    { label: `Account age ≥ ${REFERRAL_ELIGIBILITY.minAccountAgeDays} days`, met: accountAgeDays >= REFERRAL_ELIGIBILITY.minAccountAgeDays, current: `${accountAgeDays} days` },
    { label: `≥ ${REFERRAL_ELIGIBILITY.minValidTxCount} paid invoices`, met: paidInvoices.length >= REFERRAL_ELIGIBILITY.minValidTxCount, current: `${paidInvoices.length} invoices` },
    { label: `≥ $${REFERRAL_ELIGIBILITY.minTotalVolumeUsd} total volume`, met: totalVolumeUsd >= REFERRAL_ELIGIBILITY.minTotalVolumeUsd, current: `$${totalVolumeUsd.toFixed(2)}` },
  ];

  const proPaymentId = fingerprint.padEnd(16, '0').slice(0, 16);

  const copyCode = async () => {
    const baseUrl = window.location.origin;
    const referralUrl = `${baseUrl}/?ref=${fingerprint}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(referralUrl);
        setCopied(true);
        toast.success('Referral link copied to clipboard!');
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = referralUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (success) {
          setCopied(true);
          toast.success('Referral link copied to clipboard!');
        } else {
          throw new Error('execCommand copy failed');
        }
      } else {
        toast.error('Clipboard not available');
      }
    } catch (e) {
      console.error('Failed to copy referral link:', e);
      toast.error('Failed to copy link. Please select and copy it manually.');
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const copyTreasury = () => {
    navigator.clipboard.writeText(CREATOR_TREASURY_ADDRESS);
    setCopiedTreasury(true);
    toast.success('Treasury address copied!');
    setTimeout(() => setCopiedTreasury(false), 2000);
  };

  const handleApplyReferral = () => {
    const code = referralInput.trim().toUpperCase();
    if (!code || code.length < 4) {
      toast.error('Please enter a valid referral code');
      return;
    }
    if (code === fingerprint) {
      toast.error('You cannot refer yourself!');
      return;
    }
    if (merchant.referredBy) {
      toast.error('You already have a referrer set');
      return;
    }
    updateMerchant({ referredBy: code });
    setReferralInput('');
    toast.success(`Referral code ${code} applied! Your referrer will earn commissions when you subscribe to Pro.`);
  };

  const [redeemingCode, setRedeemingCode] = useState(false);

  const handleRedeemProCode = async () => {
    const code = proCodeInput.trim().toUpperCase();
    if (!code || code.length < 6) {
      toast.error('Please enter a valid Pro code');
      return;
    }

    setRedeemingCode(true);
    try {
      const success = await activateProWithCode(code);

      if (success) {
        setProCodeInput('');
        toast.success('🎉 Lifetime Pro activated! You have permanent access to all Pro features.');
      } else {
        toast.error('Invalid or already-used code. Please check and try again.');
      }
    } catch {
      toast.error('Could not validate code. Please try again.');
    } finally {
      setRedeemingCode(false);
    }
  };

  const [verifyingTx, setVerifyingTx] = useState(false);

  const handleProActivation = async () => {
    const cleanTx = proTxid.trim();
    if (!/^[a-fA-F0-9]{64}$/.test(cleanTx)) {
      toast.error('Invalid TX hash. Must be exactly 64 hex characters (a-f, 0-9).');
      return;
    }
    setVerifyingTx(true);
    try {
      const result = await activateProSubscription(cleanTx);
      if (result.success) {
        setShowProActivation(false);
        setProTxid('');
        toast.success('🎉 Pro activated! Your payment has been verified on-chain.');
      } else {
        toast.error(result.error || 'Verification failed. Please try again.');
      }
    } catch (e) {
      toast.error('Could not reach the block explorer. Please try again later.');
    } finally {
      setVerifyingTx(false);
    }
  };

  const proPaymentUri = `monero:${CREATOR_TREASURY_ADDRESS}?tx_amount=${PRO_MONTHLY_XMR.toFixed(6)}&tx_payment_id=${proPaymentId}&tx_description=MoneroFlow%20Pro%20Subscription`;

  return (
    <div className="space-y-6 max-w-4xl">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Gift className="w-6 h-6 text-primary" /> Referral Program
              <HelpTooltip
                title="Referral Program"
                text="Earn XMR by referring merchants. Your referral code is derived from your wallet — no signup needed. Multi-level commissions paid on-chain."
              />
            </h1>
            <p className="text-muted-foreground text-sm">Earn XMR by referring merchants — decentralized, on-chain, forever.</p>
          </div>
          <div className="flex items-center gap-2">
            {isPro ? (
              <Badge className="bg-gradient-orange text-primary-foreground border-0 gap-1">
                <Crown className="w-3.5 h-3.5" /> {isProViaReferral ? 'Pro (Earned)' : 'Pro Active'}
              </Badge>
            ) : (
              <Button size="sm" className="bg-gradient-orange hover:opacity-90" onClick={() => setShowProActivation(true)}>
                <Zap className="w-3.5 h-3.5 mr-1.5" /> Upgrade to Pro
              </Button>
            )}
          </div>
        </div>
      </FadeIn>

      {/* Enter Referral Code */}
      {!merchant.referredBy && (
        <FadeIn delay={0.01}>
          <div className="p-5 rounded-xl bg-card border border-primary/20 space-y-3">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Got a referral code from a friend?</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={referralInput}
                onChange={e => setReferralInput(e.target.value.toUpperCase())}
                placeholder="Enter code e.g. 9IB8LK"
                className="bg-background border-border font-mono text-sm uppercase tracking-wider flex-1 max-w-xs"
                maxLength={12}
              />
              <Button onClick={handleApplyReferral} disabled={!referralInput.trim()} className="bg-gradient-orange hover:opacity-90">
                Apply Code
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Enter a code to link your account. Your referrer earns commissions when you go Pro.</p>
          </div>
        </FadeIn>
      )}

      {/* Redeem Lifetime Pro Code */}
      {!isPro && (
        <FadeIn delay={0.015}>
          <div className="p-5 rounded-xl bg-card border border-primary/30 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Have a Lifetime Pro code?</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={proCodeInput}
                onChange={e => setProCodeInput(e.target.value.toUpperCase())}
                placeholder="Enter code e.g. MF-PRO-ABCD1234"
                className="bg-background border-border font-mono text-sm uppercase tracking-wider flex-1 max-w-sm"
                maxLength={20}
              />
              <Button onClick={handleRedeemProCode} disabled={!proCodeInput.trim() || redeemingCode} className="bg-gradient-orange hover:opacity-90">
                <Gift className="w-4 h-4 mr-1.5" /> {redeemingCode ? 'Validating...' : 'Redeem'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">One-time-use codes that unlock Pro features permanently. Given by the MoneroFlow team.</p>
          </div>
        </FadeIn>
      )}

      {merchant.referredBy && (
        <FadeIn delay={0.01}>
          <div className="p-3 rounded-xl bg-card border border-border flex items-center gap-2">
            <Check className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Referred by:</span>
            <Badge variant="outline" className="font-mono text-primary border-primary/20">{merchant.referredBy}</Badge>
          </div>
        </FadeIn>
      )}

      {/* Anti-Gaming Eligibility */}
      {!isEligibleForReferrals && (
        <FadeIn delay={0.02}>
          <div className="p-5 rounded-xl bg-card border border-warning/30 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <span className="font-semibold text-foreground">Referral Eligibility</span>
            </div>
            <p className="text-xs text-muted-foreground">
              To prevent gaming, you must meet these requirements before your referral code becomes active:
            </p>
            <div className="space-y-1.5">
              {eligibilityChecks.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {c.met ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    <span className={c.met ? 'text-foreground' : 'text-muted-foreground'}>{c.label}</span>
                  </div>
                  <span className={`text-xs font-mono ${c.met ? 'text-primary' : 'text-muted-foreground'}`}>{c.current}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Earn-to-Unlock Progress */}
      {!isPro && (
        <FadeIn delay={0.03}>
          <div className="p-5 rounded-xl bg-card border border-primary/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">Earn Free Pro</span>
              </div>
              <span className="text-sm text-muted-foreground">{directReferrals}/{PRO_REFERRAL_UNLOCK_COUNT} merchants</span>
            </div>
            <div className="w-full h-3 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-gradient-orange rounded-full transition-all duration-500" style={{ width: `${progressToFreePro}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              Refer {PRO_REFERRAL_UNLOCK_COUNT - directReferrals} more merchants to unlock Pro forever — no payment needed!
            </p>
          </div>
        </FadeIn>
      )}

      {/* Revenue Split Banner */}
      <FadeIn delay={0.04}>
        <div className="p-5 rounded-xl bg-gradient-orange text-primary-foreground relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent)]" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="font-bold text-lg">On-Chain Referral Rewards 🚀</p>
              <p className="text-sm opacity-90">{REFERRAL_ECOSYSTEM_PERCENT}% of every Pro subscription goes back to the referral network</p>
              <p className="text-xs opacity-70 mt-1">Multi-level commissions paid in XMR · No accounts · No KYC</p>
            </div>
            <Coins className="w-10 h-10 opacity-50" />
          </div>
        </div>
      </FadeIn>

      {/* Stats Cards */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Users className="w-4 h-4" /> Direct Referrals</div>
            <p className="text-2xl font-bold text-foreground">{directReferrals}</p>
          </div>
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Users className="w-4 h-4" /> Total Network</div>
            <p className="text-2xl font-bold text-foreground">{totalReferred}</p>
          </div>
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><TrendingUp className="w-4 h-4" /> Monthly Earnings</div>
            <p className="text-2xl font-bold text-primary">{formatXMR(usdToXmr(monthlyEarnings))}</p>
            <p className="text-xs text-muted-foreground">{formatUSD(monthlyEarnings)}</p>
          </div>
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Coins className="w-4 h-4" /> Lifetime Earned</div>
            <p className="text-2xl font-bold text-foreground">{formatXMR(lifetimeEarnings)}</p>
          </div>
        </div>
      </FadeIn>

      {/* Your Referral Identity — referral link */}
      <FadeIn delay={0.06}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Share Your Referral Link
            <HelpTooltip
              title="Your Referral Link"
              text="Share this link with other merchants — when they sign up, your referral code is automatically credited. You earn XMR commissions when they upgrade to Pro."
            />
          </h2>
          <p className="text-xs text-muted-foreground">
            When someone clicks your link, they get auto-onboarded with a new browser wallet and your referral code is automatically credited to their account.
            {!isEligibleForReferrals && (
              <span className="text-warning ml-1 font-medium">⚠ Link inactive — meet eligibility requirements above first.</span>
            )}
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-4xl sm:text-5xl font-black font-mono text-primary tracking-[0.2em] select-all">
              {fingerprint}
            </span>
            <Button variant="outline" size="icon" onClick={copyCode} className="border-border hover:border-primary/50 shrink-0 h-12 w-12">
              {copied ? <Check className="w-5 h-5 text-primary" /> : <Copy className="w-5 h-5" />}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowQR(v => !v)} className="text-muted-foreground text-xs">
            <QrCode className="w-3.5 h-3.5 mr-1.5" />
            {showQR ? 'Hide QR Code' : 'Show QR Code'}
          </Button>
          {showQR && (
            <div className="flex justify-center p-4 bg-white rounded-lg w-fit mx-auto">
              <QRCodeSVG value={`${window.location.origin}/?ref=${fingerprint}`} size={160} />
            </div>
          )}
        </div>
      </FadeIn>

      {/* How It Works */}
      <FadeIn delay={0.08}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> How On-Chain Monetization Works
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-background border border-border text-center">
              <Wallet className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground mb-1">Pay On-Chain</p>
              <p className="text-xs text-muted-foreground">Send {PRO_MONTHLY_XMR} XMR to the treasury with your payment ID. No accounts needed.</p>
            </div>
            <div className="p-4 rounded-lg bg-background border border-border text-center">
              <Shield className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground mb-1">Verified On-Chain</p>
              <p className="text-xs text-muted-foreground">The blockchain is the receipt. Your payment ID links the tx to your wallet fingerprint.</p>
            </div>
            <div className="p-4 rounded-lg bg-background border border-border text-center">
              <Gift className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground mb-1">{REFERRAL_ECOSYSTEM_PERCENT}% Back</p>
              <p className="text-xs text-muted-foreground">Half of every Pro payment flows to referrers. Or refer {PRO_REFERRAL_UNLOCK_COUNT} → free Pro forever.</p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Anti-Gaming Explainer */}
      <FadeIn delay={0.09}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Anti-Gaming Protection
          </h2>
          <p className="text-xs text-muted-foreground">
            To ensure the referral ecosystem is fair and sustainable, the following measures are enforced:
          </p>
          <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
            <li>Accounts must be <strong className="text-foreground">{REFERRAL_ELIGIBILITY.minAccountAgeDays}+ days old</strong> before their referral code activates</li>
            <li>Must have processed <strong className="text-foreground">{REFERRAL_ELIGIBILITY.minValidTxCount}+ verified paid invoices</strong></li>
            <li>Must have <strong className="text-foreground">${REFERRAL_ELIGIBILITY.minTotalVolumeUsd}+ total volume</strong> in real transactions</li>
            <li>Self-referral detection: same wallet fingerprint chains are rejected</li>
            <li>Referral rewards only pay out when the referred merchant's Pro subscription is active and verified on-chain</li>
          </ul>
        </div>
      </FadeIn>

      {/* Commission Structure */}
      <FadeIn delay={0.1}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Commission Structure</h2>
          <p className="text-xs text-muted-foreground">
            {REFERRAL_ECOSYSTEM_PERCENT}% of every Pro subscription ({(PRO_MONTHLY_XMR * REFERRAL_ECOSYSTEM_PERCENT / 100).toFixed(4)} XMR) is distributed across the referral tree:
          </p>
          <div className="space-y-2">
            {COMMISSION_TIERS.map(t => {
              const perSubXmr = PRO_MONTHLY_XMR * (REFERRAL_ECOSYSTEM_PERCENT / 100) * (t.percent / 100);
              return (
                <div key={t.level} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono text-xs">L{t.level}</Badge>
                    <span className="text-sm text-foreground">{t.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-primary">{t.percent}%</span>
                    <span className="text-xs text-muted-foreground ml-2">({perSubXmr.toFixed(6)} XMR/sub)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {/* Downline */}
      <FadeIn delay={0.12}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Your Network</h2>
          {referrals.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-2">No referrals yet</p>
              <p className="text-xs text-muted-foreground">Share your referral code to start building your network and earning XMR!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {referrals.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs text-muted-foreground">L{r.level}</Badge>
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.username}</p>
                      <p className="text-xs text-muted-foreground">Joined {new Date(r.joinedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-primary">{formatUSD(r.monthlyCommission)}/mo</p>
                    <p className="text-xs text-muted-foreground">from their revenue</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </FadeIn>

      {/* Payout History */}
      <FadeIn delay={0.15}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Payout History</h2>
          {referralPayouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payouts yet. Payouts are sent directly to your wallet on-chain.</p>
          ) : (
            <div className="space-y-2">
              {referralPayouts.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{new Date(p.date).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">{p.referralCount} referrals</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-bold text-primary">{formatXMR(p.xmrAmount)}</p>
                    <Badge variant="outline" className={p.status === 'paid' ? 'text-success border-success/30' : 'text-warning border-warning/30'}>
                      {p.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </FadeIn>

      {/* Referrals Network Status */}
      <FadeIn delay={0.18}>
        <div className="flex items-center justify-center gap-2 py-4">
          <div className={`w-2 h-2 rounded-full ${
            networkStatus === 'connected' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' :
            networkStatus === 'disconnected' ? 'bg-destructive shadow-[0_0_6px_rgba(239,68,68,0.6)]' :
            'bg-muted-foreground animate-pulse'
          }`} />
          <span className="text-xs text-muted-foreground">
            Referrals Network {networkStatus === 'connected' ? 'Connected' : networkStatus === 'disconnected' ? 'Disconnected' : 'Checking...'}
          </span>
        </div>
      </FadeIn>

      {/* Invisible long-press access point */}
      <div
        className="fixed bottom-4 right-4 w-8 h-8 cursor-default select-none z-50 flex items-center justify-center"
        aria-hidden="true"
        onPointerDown={() => {
          const timer = setTimeout(() => setShowTreasury(true), 10000);
          const cancel = () => { clearTimeout(timer); window.removeEventListener('pointerup', cancel); };
          window.addEventListener('pointerup', cancel);
        }}
      >
        {/* Subtle pixel cluster — just enough to locate visually */}
        <div className="grid grid-cols-2 gap-px opacity-30">
          <div className="w-[2px] h-[2px] rounded-full bg-primary/80" />
          <div className="w-[2px] h-[2px] rounded-full bg-primary/60" />
          <div className="w-[2px] h-[2px] rounded-full bg-primary/60" />
          <div className="w-[2px] h-[2px] rounded-full bg-primary/40" />
        </div>
      </div>

      {/* Treasury Access Dialog */}
      <TreasuryAccess open={showTreasury} onOpenChange={setShowTreasury} />

      {/* Pro Activation Dialog */}
      <Dialog open={showProActivation} onOpenChange={setShowProActivation}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Crown className="w-5 h-5 text-primary" /> Activate Pro Subscription
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-background border border-border text-center">
              <p className="text-2xl font-bold text-primary mb-1">{PRO_MONTHLY_XMR} XMR<span className="text-sm text-muted-foreground font-normal">/month</span></p>
              <p className="text-xs text-muted-foreground">Or refer {PRO_REFERRAL_UNLOCK_COUNT} merchants for free Pro forever</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">1. Send XMR to this address:</p>
              <div className="p-3 rounded-lg bg-background border border-border">
                <p className="font-mono text-xs text-muted-foreground break-all leading-relaxed">{CREATOR_TREASURY_ADDRESS}</p>
                <Button variant="outline" size="sm" onClick={copyTreasury} className="mt-2 border-border hover:border-primary/50">
                  {copiedTreasury ? <Check className="w-3 h-3 mr-1.5" /> : <Copy className="w-3 h-3 mr-1.5" />}
                  {copiedTreasury ? 'Copied' : 'Copy Address'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">2. Include this Payment ID:</p>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="font-mono text-sm text-primary text-center tracking-wider">{proPaymentId}</p>
              </div>
            </div>

            <div className="flex justify-center p-4 bg-white rounded-lg w-fit mx-auto">
              <QRCodeSVG value={proPaymentUri} size={180} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">3. Paste your TX hash to activate:</p>
              <Input
                value={proTxid}
                onChange={e => setProTxid(e.target.value)}
                placeholder="Transaction hash (64 hex characters)"
                className="bg-background border-border font-mono text-sm"
              />
            </div>

            <Button
              className="w-full bg-gradient-orange hover:opacity-90"
              onClick={handleProActivation}
              disabled={!proTxid || verifyingTx}
            >
              {verifyingTx ? (
                <><span className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Verifying on-chain…</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" /> Activate Pro</>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              {REFERRAL_ECOSYSTEM_PERCENT}% of your payment rewards the referral network that brought you here.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
