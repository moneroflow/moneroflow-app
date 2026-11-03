import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, Loader2, Radio, Shield, Zap, AlertTriangle, Hash, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';

interface PaymentProgressProps {
  invoiceId: string;
  fiatAmount: number;
  xmrAmount: number;
  subaddress: string;
  onPaid?: () => void;
}

type PaymentStage = 'waiting' | 'mempool' | 'confirming' | 'confirmed';

const BLOCK_TIME_SECONDS = 120; // Monero avg ~2 min per block

export function PaymentProgress({ invoiceId, fiatAmount, xmrAmount, subaddress, onPaid }: PaymentProgressProps) {
  const invoice = useStore(s => s.invoices.find(i => i.id === invoiceId));
  const merchant = useStore(s => s.merchant);
  const pollInvoicePayment = useStore(s => s.pollInvoicePayment);
  const verifyInvoiceTxHash = useStore(s => s.verifyInvoiceTxHash);
  const requiredConfs = merchant.requiredConfirmations ?? 1;
  const zeroConfEnabled = merchant.zeroConfEnabled;
  const zeroConfThreshold = merchant.zeroConfThresholdUsd || 30;
  const isZeroConfEligible = zeroConfEnabled && fiatAmount <= zeroConfThreshold;

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);
  const [showTxInput, setShowTxInput] = useState(false);
  const [txHashInput, setTxHashInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const confirmations = invoice?.confirmations || 0;
  const status = invoice?.status || 'pending';

  const stage: PaymentStage = useMemo(() => {
    if (status === 'paid' || status === 'overpaid') return 'confirmed';
    if (status === 'confirming') return 'confirming';
    if (status === 'seen_on_chain') return isZeroConfEligible ? 'confirmed' : 'mempool';
    return 'waiting';
  }, [status, isZeroConfEligible]);

  // Fire callback when confirmed
  useEffect(() => {
    if (stage === 'confirmed' && onPaid) {
      onPaid();
    }
  }, [stage, onPaid]);

  // Pulse animation on stage change
  useEffect(() => {
    setPulseKey(k => k + 1);
  }, [stage]);

  // Elapsed timer
  useEffect(() => {
    if (stage === 'confirmed') return;
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [stage]);

  // Active polling via block explorer — every 15 seconds
  useEffect(() => {
    if (stage === 'confirmed') return;
    // Initial poll immediately
    pollInvoicePayment(invoiceId).then(() => setPollCount(c => c + 1));
    
    const interval = setInterval(() => {
      pollInvoicePayment(invoiceId).then(() => setPollCount(c => c + 1));
    }, 15000);
    return () => clearInterval(interval);
  }, [invoiceId, stage, pollInvoicePayment]);

  // Show TX input hint after 60s of waiting
  const showManualHint = stage === 'waiting' && elapsedSeconds > 60;

  // ETA calculation
  const etaSeconds = useMemo(() => {
    if (stage === 'confirmed') return 0;
    if (stage === 'waiting') return null;
    const remainingConfs = Math.max(0, requiredConfs - confirmations);
    return remainingConfs * BLOCK_TIME_SECONDS;
  }, [stage, requiredConfs, confirmations]);

  const formatTime = (secs: number) => {
    if (secs < 60) return `~${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return rem > 0 ? `~${mins}m ${rem}s` : `~${mins}m`;
  };

  // Progress percentage
  const progressPercent = useMemo(() => {
    if (stage === 'confirmed') return 100;
    if (stage === 'waiting') return 5;
    if (stage === 'mempool') return 25;
    const confProgress = Math.min(confirmations / requiredConfs, 1);
    return 25 + confProgress * 70;
  }, [stage, confirmations, requiredConfs]);

  // Manual TX hash verification
  const handleVerifyTx = async () => {
    if (!txHashInput.trim()) return;
    setVerifying(true);
    try {
      const result = await verifyInvoiceTxHash(invoiceId, txHashInput.trim());
      if (result.success) {
        toast.success('Transaction found! Verifying payment...');
        setShowTxInput(false);
        setTxHashInput('');
      } else {
        toast.error(result.error || 'Could not verify transaction');
      }
    } catch (e) {
      toast.error('Verification failed. Please try again.');
    }
    setVerifying(false);
  };

  const steps = [
    { id: 'broadcast', label: 'Waiting for payment', icon: Radio, done: stage !== 'waiting' },
    { id: 'mempool', label: 'Seen in mempool (0-conf)', icon: Zap, done: stage === 'confirming' || stage === 'confirmed' },
    { id: 'confirming', label: `${confirmations}/${requiredConfs} confirmations`, icon: Shield, done: stage === 'confirmed' },
    { id: 'confirmed', label: 'Payment confirmed!', icon: Check, done: stage === 'confirmed' },
  ];

  if (isZeroConfEligible) {
    steps[1].label = 'Seen in mempool → auto-approved';
  }

  const stageColors: Record<PaymentStage, string> = {
    waiting: 'text-muted-foreground',
    mempool: 'text-warning',
    confirming: 'text-primary',
    confirmed: 'text-success',
  };

  const stageMessages: Record<PaymentStage, { title: string; subtitle: string }> = {
    waiting: {
      title: 'Awaiting payment...',
      subtitle: 'Scan the QR code and send XMR. We\'re checking the blockchain every 15 seconds.',
    },
    mempool: {
      title: 'Payment detected! 🎉',
      subtitle: 'Your transaction is in the mempool. Waiting for block confirmation...',
    },
    confirming: {
      title: `Confirming... (${confirmations}/${requiredConfs})`,
      subtitle: etaSeconds ? `Estimated ${formatTime(etaSeconds)} remaining` : 'Almost there...',
    },
    confirmed: {
      title: 'Payment confirmed! ✅',
      subtitle: 'Thank you — your order is being processed',
    },
  };

  const msg = stageMessages[stage];

  return (
    <div className="w-full space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className={`font-medium ${stageColors[stage]}`}>{msg.title}</span>
          {stage !== 'confirmed' && etaSeconds !== null && (
            <Badge variant="outline" className="text-muted-foreground border-border text-[10px] gap-1">
              <Clock className="w-3 h-3" />
              ETA {formatTime(etaSeconds)}
            </Badge>
          )}
        </div>
        <motion.div key={pulseKey} initial={{ scale: 1.02 }} animate={{ scale: 1 }} transition={{ duration: 0.3 }}>
          <Progress value={progressPercent} className="h-2.5 bg-muted/30" />
        </motion.div>
        <p className="text-[10px] text-muted-foreground">{msg.subtitle}</p>
      </div>

      {/* Step indicators */}
      <div className="space-y-1.5">
        {steps.map((step) => {
          const isCurrent =
            (step.id === 'broadcast' && stage === 'waiting') ||
            (step.id === 'mempool' && stage === 'mempool') ||
            (step.id === 'confirming' && stage === 'confirming') ||
            (step.id === 'confirmed' && stage === 'confirmed');

          return (
            <motion.div
              key={step.id}
              initial={false}
              animate={{
                opacity: step.done || isCurrent ? 1 : 0.4,
                x: isCurrent ? 4 : 0,
              }}
              transition={{ duration: 0.3 }}
              className={`flex items-center gap-2.5 text-xs py-1.5 px-2 rounded-lg transition-colors ${
                isCurrent ? 'bg-primary/5 border border-primary/10' : ''
              }`}
            >
              {step.done ? (
                <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-success" />
                </div>
              ) : isCurrent ? (
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Loader2 className="w-3 h-3 text-primary animate-spin" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
                  <step.icon className="w-3 h-3 text-muted-foreground" />
                </div>
              )}
              <span className={`${step.done ? 'text-foreground' : isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* TX ID display when found */}
      {invoice?.txid && stage !== 'waiting' && (
        <div className="bg-muted/20 rounded-lg p-2.5 border border-border">
          <p className="text-[10px] text-muted-foreground mb-1">Transaction ID</p>
          <a 
            href={`https://xmrchain.net/tx/${invoice.txid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[9px] text-primary hover:underline break-all flex items-start gap-1"
          >
            {invoice.txid}
            <ExternalLink className="w-3 h-3 shrink-0 mt-0.5" />
          </a>
        </div>
      )}

      {/* 0-conf disclaimer */}
      {isZeroConfEligible && stage === 'confirmed' && confirmations === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <p className="text-[10px] text-warning leading-relaxed">
            Auto-approved at 0-conf (amount under {merchant.fiatSymbol || '$'}{zeroConfThreshold}). 
            Full confirmation will follow in ~2 minutes.
          </p>
        </motion.div>
      )}

      {/* Manual TX hash entry — shown after 60s or on demand */}
      {stage === 'waiting' && (
        <div className="space-y-2">
          {showManualHint && !showTxInput && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="text-[10px] text-muted-foreground text-center">
                Already sent? Paste your TX hash below for instant verification.
              </p>
            </motion.div>
          )}
          
          {!showTxInput ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTxInput(true)}
              className="w-full text-xs text-muted-foreground hover:text-primary gap-1.5"
            >
              <Hash className="w-3.5 h-3.5" />
              I already sent — enter TX hash
            </Button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <Input
                placeholder="Paste your Monero TX hash here..."
                value={txHashInput}
                onChange={e => setTxHashInput(e.target.value)}
                className="font-mono text-xs h-9 bg-muted/20"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleVerifyTx}
                  disabled={verifying || !txHashInput.trim()}
                  className="flex-1 h-8 text-xs gap-1"
                >
                  {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowTxInput(false); setTxHashInput(''); }}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Polling indicator */}
      {stage !== 'confirmed' && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Scanning blockchain · Poll #{pollCount} · {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')} elapsed
        </div>
      )}
    </div>
  );
}
