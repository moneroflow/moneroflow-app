import { useStore } from '@/lib/store';
import { useEffect } from 'react';

/**
 * Background sweep checker component.
 * Runs periodically to check if real wallet balance exceeds sweep threshold
 * and automatically executes sweeps when enabled.
 *
 * The check frequency is user-configurable via autoSweepCheckFrequency setting.
 */
export function SweepChecker({ enabled = true }: { enabled?: boolean }) {
  const merchant = useStore(s => s.merchant);

  useEffect(() => {
    if (!enabled || !merchant.autoSweepEnabled) {
      return;
    }

    if (!merchant.coldWalletAddress || !merchant.viewOnlySeedPhrase) {
      return;
    }

    // Get user-configured frequency (in minutes) and convert to milliseconds
    // Default to 4 hours (240 minutes) if not set
    const frequencyMinutes = merchant.autoSweepCheckFrequency || 240;
    const intervalMs = frequencyMinutes * 60 * 1000;

    // Immediately check on mount, then periodically
    const checkAndSweep = async () => {
      try {
        const result = await useStore.getState().runSweepCheck();
        if (result.success) {
          console.log('[SweepChecker] Auto-sweep successful:', result);
        }
      } catch (err) {
        console.error('[SweepChecker] Auto-sweep failed:', err);
      }
    };

    // Initial check with delay (to avoid race conditions on app load)
    const initialTimer = setTimeout(checkAndSweep, 5000);

    // Periodic based on user-configured frequency
    const intervalTimer = setInterval(checkAndSweep, intervalMs);

    console.log(`[SweepChecker] Background checker active. Frequency: ${frequencyMinutes} minutes`);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [enabled, merchant.autoSweepEnabled, merchant.coldWalletAddress, merchant.viewOnlySeedPhrase, merchant.autoSweepCheckFrequency]);

  return null;
}
