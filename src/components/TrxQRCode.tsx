/**
 * USDT-TRC20 QR Code Generator
 * Generates QR codes for USDT token transfers on the Tron network
 * USDT Contract: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
 */

import { QRCodeSVG } from 'qrcode.react';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { getUsdtClient } from '@/lib/usdt-trc20';
import { copyToClipboard } from '@/lib/copy-utils';

interface UsdtQRCodeProps {
  address: string;
  amount: number; // USDT amount
  onCopy?: () => void;
}

export function UsdtQRCode({ address, amount, onCopy }: UsdtQRCodeProps) {
  const client = getUsdtClient();

  // Generate payment link for wallet deep links
  const paymentLink = client.generatePaymentLink(address, amount);

  // Generate QR code data
  const qrData = client.generateQrData(address, amount);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink);
    toast.success('USDT payment link copied!');
    onCopy?.();
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address);
    toast.success('USDT-TRC20 address copied!');
  };

  const handleOpenWallet = () => {
    window.open(paymentLink, '_blank');
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* QR Code */}
      <div className="p-4 bg-white rounded-xl border-2 border-border">
        <QRCodeSVG
          value={JSON.stringify(qrData)}
          size={200}
          level="H"
          includeMargin={false}
        />
      </div>

      {/* Quick Action Buttons */}
      <div className="flex gap-2 w-full max-w-[300px]">
        <button
          onClick={handleOpenWallet}
          className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Open in Wallet
        </button>
        <button
          onClick={handleCopyAddress}
          className="px-4 py-2 bg-background border border-border hover:bg-accent rounded-lg transition-colors"
        >
          <Copy className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Address display */}
      <div className="text-center w-full max-w-[300px]">
        <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">USDT-TRC20 Address</p>
        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
          <code className="flex-1 text-xs font-mono text-foreground break-all">
            {address.slice(0, 10)}...{address.slice(-8)}
          </code>
        </div>
      </div>

      {/* Amount display */}
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Amount</p>
        <p className="text-3xl font-bold text-orange-500">
          {amount.toFixed(2)} <span className="text-lg">USDT</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">≈ ${amount.toFixed(2)} USD</p>
      </div>

      {/* Contract info */}
      <div className="text-center border-t border-border/50 pt-3 w-full max-w-[300px]">
        <p className="text-[9px] text-muted-foreground">
          USDT-TRC20 Token Payment
        </p>
        <p className="text-[9px] text-muted-foreground font-mono mt-0.5">
          Contract: TR7NHqje...jLj6t
        </p>
      </div>
    </div>
  );
}

// Export as TrxQRCode for backward compatibility
export const TrxQRCode = UsdtQRCode;
