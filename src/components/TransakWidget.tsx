/**
 * Transak Fiat On-Ramp Widget (New Tab Approach)
 * 
 * Opens Transak in a new tab for maximum compatibility.
 * Mobile-friendly, no iframe restrictions, secure redirect flow.
 */

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { Wallet, ExternalLink } from 'lucide-react';

export default function TransakWidget() {
  const merchant = useStore(s => s.merchant);
  const walletAddress = merchant.viewOnlyAddress;

  const openTransak = useCallback(() => {
    if (!walletAddress) {
      alert('Please complete wallet setup first');
      return;
    }

    // Debug: Show what API key is being used
    const apiKey = process.env.VITE_TRANSAK_API_KEY || 'DEMO_API_KEY';
    console.log('[Transak] API Key:', apiKey);
    console.log('[Transak] All env:', {
      VITE_TRANSAK_API_KEY: process.env.VITE_TRANSAK_API_KEY,
      VITE_TRANSAK_ENV: process.env.VITE_TRANSAK_ENV,
    });

    // Build direct Transak URL
    const params = new URLSearchParams({
      apiKey: apiKey,
      environment: process.env.VITE_TRANSAK_ENV || 'STAGING',
      defaultCrypto: 'XMR',
      fiatCurrency: 'AUD',
      walletAddress: walletAddress,
      networks: 'monero',
      themeColor: '#F97316',
      country: 'AU',
      redirectURL: window.location.origin + '/dashboard', // User returns to dashboard after purchase
    });

    const transakUrl = `https://global.transak.com/sdk?${params.toString()}`;
    
    console.log('[Transak] Opening URL:', transakUrl);
    
    // Open in new tab
    window.open(transakUrl, '_blank');
    
  }, [walletAddress]);

  return (
    <Button
      onClick={openTransak}
      disabled={!walletAddress}
      className="bg-gradient-orange hover:opacity-90 glow-orange-sm text-base px-4 h-9"
    >
      <Wallet className="w-4 h-4 mr-2" />
      Buy XMR
      <ExternalLink className="w-4 h-4 ml-2" />
    </Button>
  );
}
