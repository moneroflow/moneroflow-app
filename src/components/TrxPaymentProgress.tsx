import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, Loader2, Radio, Shield, Zap, Hash, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/copy-utils';

interface TrxPaymentProgressProps {
  invoiceId: string;
  fiatAmount: number;
  trxAmount: number;
  address: string;
  onPaid?: () => void;
}

type PaymentStage = 'waiting' | 'mempool' | 'confirming' | 'confirmed';

const BLOCK_TIME_SECONDS = 3; // TRON ~3 seconds per block

export function TrxPaymentProgress({ invoiceId, fiatAmount, trxAmount, address, onPaid }: TrxPaymentProgressProps) {
  const invoice = useStore(s => s.invoices.find(i => i.id === invoiceId));
  const monitorTrxInvoice = useStore(s => s.monitorTrxInvoice);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pollCount, setPollCount] = useState(0);

  const confirmations = invoice?.trxConfirmations || 0;
  const status = invoice?.status || 'pending';
  const txId = invoice?.trxTxID;

  const stage: PaymentStage = useMemo(() => {
    if (status === 'paid' || status === 'overpaid') return 'confirmed';
    if (status === 'confirming') return 'confirming';
    if (status === 'seen_on_chain') return 'mempool';
    return 'waiting';
  }, [status]);

  // Fire callback when confirmed
  useEffect(() => {
    if (stage === 'confirmed' && onPaid) {
      onPaid();
    }
  }, [stage, onPaid]);

  // Elapsed timer
  useEffect(() => {
    if (stage === 'confirmed') return;
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [stage]);

  // Active polling via TronGrid — every 8 seconds
  useEffect(() => {
    if (stage === 'confirmed') return;
    // Initial poll immediately
    monitorTrxInvoice(invoiceId).then(() => setPollCount(c => c + 1));

    const interval = setInterval(() => {
      monitorTrxInvoice(invoiceId).then(() => setPollCount(c => c + 1));
    }, 8000);
    return () => clearInterval(interval);
  }, [invoiceId, stage, monitorTrxInvoice]);

  // ETA calculation (19 confirmations target for TRX)
  const requiredConfs = 19;
  const etaSeconds = useMemo(() => {
    if (stage === 'confirmed') return 0;
    if (stage === 'waiting') return null;
    const remainingConfs = Math.max(0, requiredConfs - confirmations);
    return remainingConfs * BLOCK_TIME_SECONDS;
  }, [stage, confirmations]);

  const formatTime = (secs: number) => {
    if (secs < 60) return `~${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return rem > 0 ? `~${mins}m ${rem}s` : `~${mins}m`;
  };

  // Progress percentage based on confirmations
  const progressPercent = useMemo(() => {
    if (stage === 'confirmed') return 100;
    if (stage === 'waiting') return 0;
    const confProgress = (confirmations / requiredConfs) * 100;
    return Math.min(confProgress, 95);
  }, [stage, confirmations]);

  const stages = [
    { key: 'waiting', label: 'Waiting for Payment', icon: Clock },
    { key: 'mempool', label: 'Transaction Detected', icon: Radio },
    { key: 'confirming', label: 'Confirming', icon: Loader2, animated: true },
    { key: 'confirmed', label: 'Confirmed', icon: Check },
  ];

  const currentStageIndex = stages.findIndex(s => s.key === stage);
  const activeStages = stages.slice(0, currentStageIndex + 1);

  const handleViewTx = () => {
    if (txId) {
      window.open(`https://tronscan.org/#/transaction/${txId}`, '_blank');
    }
  };

  const copyTxId = async () => {
    if (txId) {
      const ok = await copyToClipboard(txId);
      if (ok) toast.success('TX ID copied!');
      else toast.error('Failed to copy');
      toast.success('Transaction ID copied!');
    }
  };

  return (
    <div className="w-full space-y-4 pt-4 border-t border-border/50">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {stages.map((s, idx) => {
          const isActive = idx <= currentStageIndex;
          const isCurrent = s.key === stage;
          const StageIcon = s.icon;

          return (
            <div key={s.key} className="flex items-center flex-1">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300
                  ${isActive
                    ? 'bg-success/10 border-success text-success'
                    : 'bg-muted border-border text-muted-foreground'
                  }
                  ${isCurrent && s.animated ? 'animate-pulse' : ''}
                `}
              >
                {isCurrent && s.animated ? (
                  <StageIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <StageIcon className="w-4 h-4" />
                )}
              </div>
              {idx < stages.length - 1 && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2 transition-all duration-500
                    ${isActive ? 'bg-success' : 'bg-border'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 详细状态 */}
      <div className="space-y-3">
        {stage === 'waiting' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Waiting for payment to {address.slice(0, 8)}...{address.slice(-6)}</span>
          </div>
        )}

        {stage === 'mempool' && confirmations === 0 && (
          <div className="flex items-center gap-2 text-sm text-warning">
            <Radio className="w-4 h-4" />
            <span>Transaction detected in mempool. Waiting for first confirmation...</span>
          </div>
        )}

        {confirmations > 0 && stage !== 'confirmed' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-foreground">
                  Confirmations: <span className="font-bold">{confirmations}</span> / {requiredConfs}
                </span>
              </div>
              {etaSeconds && etaSeconds > 0 && (
                <span className="text-xs text-muted-foreground">ETA: {formatTime(etaSeconds)}</span>
              )}
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {stage === 'confirming' && confirmations < requiredConfs && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              Confirming payment on TRON network ({requiredConfs - confirmations} confirmations remaining)
            </span>
          </div>
        )}

        {stage === 'confirmed' && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 text-sm text-success"
            >
              <Check className="w-4 h-4" />
              <span className="font-medium">Payment confirmed on TRON network!</span>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Transaction Details */}
        {txId && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-2 pt-2"
          >
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Transaction ID</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-primary hover:text-primary/80 p-0"
                  onClick={handleViewTx}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View on Tronscan
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background rounded px-2 py-1 text-[10px] font-mono break-all">
                  {txId}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={copyTxId}
                >
                  <Hash className="w-3 h-3 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Time Elapsed */}
      {elapsedSeconds > 0 && stage !== 'confirmed' && (
        <div className="text-center">
          <span className="text-xs text-muted-foreground">
            Time elapsed: {formatTime(elapsedSeconds)}
          </span>
        </div>
      )}

      {/* Poll Status */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
        <Zap className="w-3 h-3" />
        <span>Live monitoring active ({pollCount} checks)</span>
      </div>
    </div>
  );
}
