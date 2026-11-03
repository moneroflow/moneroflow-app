/**
 * Sweep Function Test Utility
 *
 * Run this in browser console to test sweep functionality.
 *
 * Usage:
 * 1. Open the app in browser
 * 2. Open DevTools console
 * 3. Paste and run these commands
 */

import { useStore } from './store';

/**
 * Test helper function - Run in browser console
 */
const testSweep = {
  /**
   * Get current sweep statistics
   */
  stats: () => {
    const store = useStore.getState();
    const cumulative = store.calculateCumulativeReceived();
    const swept = store.merchant.totalSweptXmr || 0;
    const available = cumulative - swept;

    return {
      cumulativeReceivedXmr: cumulative.toFixed(6),
      totalSweptXmr: swept.toFixed(6),
      availableToSweep: available.toFixed(6),
      threshold: store.merchant.autoSweepThreshold.toFixed(2),
      canSweep: available >= store.merchant.autoSweepThreshold,
      autoSweepEnabled: store.merchant.autoSweepEnabled,
      coldWalletAddress: store.merchant.coldWalletAddress || 'not set',
      lastSweepDate: store.merchant.lastSweepDate || 'never'
    };
  },

  /**
   * Run a manual sweep check
   */
  run: async () => {
    console.log('Running sweep check...');
    const store = useStore.getState();

    if (!store.merchant.autoSweepEnabled) {
      console.error('❌ Auto-sweep is not enabled in settings');
      return;
    }

    if (!store.merchant.coldWalletAddress) {
      console.error('❌ No cold wallet address set');
      return;
    }

    try {
      const result = await store.runSweepCheck();
      console.log('Sweep result:', result);

      if (result.success) {
        console.log(`✅ Sweep successful!`);
        console.log(`   Amount swept: ${result.sweptAmount.toFixed(6)} XMR`);
        console.log(`   TX Hash: ${result.txHash}`);
      } else {
        console.log(`❌ Sweep failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
    }
  },

  /**
   * Reset sweep counter (for testing)
   */
  resetCounter: () => {
    const store = useStore.getState();
    store.resetSweepCounter();
    console.log('✅ Sweep counter reset');
  },

  /**
   * Check current invoice payment counts
   */
  invoiceStats: () => {
    const store = useStore.getState();
    const invoices = store.invoices;

    return {
      total: invoices.length,
      paid: invoices.filter(i => i.status === 'paid' && i.type !== 'sent').length,
      sent: invoices.filter(i => i.type === 'sent').length,
      pending: invoices.filter(i => i.status === 'pending').length,
      totalReceivedXmr: invoices
        .filter(i => i.status === 'paid' && i.type !== 'sent')
        .reduce((sum, i) => sum + i.xmrAmount, 0)
        .toFixed(6)
    };
  },

  /**
   * Run full test suite
   */
  fullTest: async () => {
    console.log('=== Sweep Function Test Suite ===\n');

    // 1. Show current stats
    console.log('📊 Current Stats:');
    console.dir(testSweep.stats());

    // 2. Show invoice stats
    console.log('\n📋 Invoice Stats:');
    console.dir(testSweep.invoiceStats());

    // 3. Check configuration
    console.log('\n⚙️ Configuration:');
    const store = useStore.getState();
    console.log(`  Auto-sweep enabled: ${store.merchant.autoSweepEnabled}`);
    console.log(`  Cold wallet address: ${store.merchant.coldWalletAddress ? '✓ Set' : '✗ Not set'}`);
    console.log(`  Sweep threshold: ${store.merchant.autoSweepThreshold} XMR`);

    // 4. Check if sweep can run
    console.log('\n🔍 Sweep Eligibility:');
    const stats = testSweep.stats();
    console.log(`  Available: ${stats.availableToSweep} XMR`);
    console.log(`  Threshold: ${stats.threshold} XMR`);
    console.log(`  Can sweep: ${stats.canSweep ? '✓ Yes' : '✗ No'}`);

    // 5. Try to run sweep if eligible
    if (stats.canSweep && store.merchant.autoSweepEnabled) {
      console.log('\n🚀 Running sweep...');
      await testSweep.run();
    } else if (!store.merchant.autoSweepEnabled) {
      console.log('\n⚠️ Auto-sweep is disabled. Enable it in Settings to test.');
    } else {
      console.log('\n⚠️ Available balance below threshold. Add more payments to test.');
    }

    console.log('\n=== Test Complete ===');
  }
};

// Export for browser console access
if (typeof window !== 'undefined') {
  (window as any).sweepTest = testSweep;
  console.log('✅ Sweep test utility loaded. Use sweepTest.fullTest() to run tests.');
}

export default testSweep;
