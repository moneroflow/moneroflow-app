import { useStore } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/copy-utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiveXmrDialog({ open, onOpenChange }: Props) {
  const merchant = useStore(s => s.merchant);
  const [copied, setCopied] = useState(false);

  // Same payout-address heuristic as PaymentLinksPage: the merchant's spendable address.
  const receiveAddress =
    merchant.viewOnlyAddress ?? merchant.settlementAddress ?? merchant.primarySubaddress ?? '';

  const handleCopy = async () => {
    if (!receiveAddress) return;
    const ok = await copyToClipboard(receiveAddress);
    if (ok) {
      setCopied(true);
      toast.success('Address copied');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy address');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Receive XMR</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Share your Monero address to receive payments. Scan with any Monero wallet.
          </DialogDescription>
        </DialogHeader>

        {receiveAddress ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="p-4 rounded-xl bg-background border border-border">
              <QRCodeSVG
                value={receiveAddress}
                size={200}
                level="M"
                fgColor="#F25A1A"
                bgColor="#ffffff"
                style={{ borderRadius: 8 }}
              />
            </div>
            <p className="font-mono text-[11px] text-foreground bg-background border border-border rounded-lg p-3 break-all leading-relaxed max-w-full text-center">
              {receiveAddress}
            </p>
            <Button onClick={handleCopy} variant="outline" className="border-border hover:border-primary/50 w-full gap-2">
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Address Copied' : 'Copy Address'}
            </Button>
            {merchant.viewOnlySetupComplete && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Payments to this address are watched by your view-only wallet.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No receiving address configured yet. Set up your wallet in Settings → Wallet &amp; Node.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
