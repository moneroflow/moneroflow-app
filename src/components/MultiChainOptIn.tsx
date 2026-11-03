/**
 * MultiChainOptIn Component
 * Allows existing merchants to add multi-chain wallet support
 */

import { useState } from 'react';
import { useStore } from '../lib/store';
import { generateMultiChainWallet } from '../lib/multi-chain-wallet';
import { Bitcoin, Wallet, Shield, Check, AlertCircle } from 'lucide-react';

export function MultiChainOptIn() {
  const [showDialog, setShowDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);

  const merchant = useStore((state) => state.merchant);
  const updateMerchant = useStore((state) => state.updateMerchant);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    
    try {
      const multiChainWallet = await generateMultiChainWallet(24);
      
      updateMerchant({
        multiChainEnabled: true,
        bip39Mnemonic: multiChainWallet.bip39.mnemonic,
        bip39MnemonicBackedUp: false,
        ethAddress: multiChainWallet.ethereum.address,
        ethPrivateKey: multiChainWallet.ethereum.privateKey,
        tronAddress: multiChainWallet.tron.address,
        tronPrivateKey: multiChainWallet.tron.privateKey,
        enabledChains: ['ethereum', 'arbitrum', 'tron'],
      });
      
      setSuccess(true);
      setTimeout(() => {
        setShowDialog(false);
        setSuccess(false);
        // Navigate to settings page to see seed backup prompt
        // Navigation handled by parent component
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to generate multi-chain wallet');
      console.error('[MultiChainOptIn] Generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      {/* Button to open dialog */}
      <button
        onClick={() => setShowDialog(true)}
        disabled={!!merchant.multiChainEnabled}
        className="w-full flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10 text-primary">
            <Bitcoin className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="font-medium text-sm flex items-center gap-2">
              Multi-Chain Wallet
              {merchant.multiChainEnabled && (
                <span className="text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded">
                  Enabled
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Accept ETH, TRX, ARB
            </div>
          </div>
        </div>
        <Wallet className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <Bitcoin className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold">Add Multi-Chain Support</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Generate Ethereum, Tron, and Arbitrum addresses alongside your Monero wallet.
              </p>
            </div>

            {/* Success State */}
            {success ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-green-900 dark:text-green-100">
                    Multi-Chain Wallet Created
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    Your multi-chain wallet is ready. You'll be prompted to backup your seed phrase.
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Features */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-primary/10 text-primary mt-0.5">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">ETH & ARB</div>
                      <div className="text-xs text-muted-foreground">Accept Ethereum and Arbitrum tokens</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-primary/10 text-primary mt-0.5">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">TRX</div>
                      <div className="text-xs text-muted-foreground">Accept Tron payments</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-primary/10 text-primary mt-0.5">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">Secure</div>
                      <div className="text-xs text-muted-foreground">Uses BIP-39 industry standard</div>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-amber-900 dark:text-amber-100">
                      Important: Backup Your Seed Phrase
                    </div>
                    <div className="text-xs text-amber-700 dark:text-amber-300">
                      A 24-word seed phrase will be generated. Store it safely to recover your wallet.
                    </div>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDialog(false)}
                    disabled={isGenerating}
                    className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <span className="animate-spin">⟳</span>
                        Generating...
                      </>
                    ) : (
                      'Generate Wallet'
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Close button */}
            {!success && (
              <button
                onClick={() => setShowDialog(false)}
                className="absolute top-4 right-4 p-1 rounded-md hover:bg-accent"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
