import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { NodeSwitchingService, defaultNodeSwitchConfig } from '@/lib/node-manager';
import { toast } from 'sonner';

/**
 * Background node health monitor (Cake-Wallet-style).
 *
 * While the dashboard is mounted, runs a periodic probe on the current Monero
 * node. If the node is stale (reporting a height well behind the freshest live
 * node) or unresponsive, it auto-rotates to the next fresh node and persists
 * the change — so a node that has "gone silent" in the background no longer
 * silently serves wrong balances.
 *
 * Mirrors Cake's NodeSwitchingService: cooldown, max-attempts and an exhaustion
 * latch prevent hot-looping over a flaky pool. Toggleable in Settings.
 */
export function useNodeSwitchingMonitor() {
  const serviceRef = useRef<NodeSwitchingService | null>(null);
  const merchant = useStore(s => s.merchant);
  const updateMerchant = useStore(s => s.updateMerchant);
  const enabled = merchant.autoNodeSwitchEnabled !== false;

  // Build the service once, bound to the store.
  if (!serviceRef.current) {
    serviceRef.current = new NodeSwitchingService({
      getCurrentUrl: () => {
        const m = useStore.getState().merchant;
        return m.connectedNodeUrl || m.viewOnlyNodeUrl || (m.walletMode === 'viewonly' || m.walletMode === 'remote' ? m.remoteNodeUrl : null) || null;
      },
      applySwitch: (node, status) => {
        const m = useStore.getState().merchant;
        const updates: Record<string, unknown> = {
          connectedNodeLabel: status.label,
          connectedNodeUrl: node.url,
          nodeStatus: status.status,
          nodeHeight: status.height,
          nodeLatencyMs: status.latencyMs,
          rpcConnected: true,
        };
        if (m.walletMode === 'viewonly') updates.viewOnlyNodeUrl = node.url;
        if (m.walletMode === 'remote') {
          updates.remoteNodeUrl = node.url;
          updates.remoteNodeSsl = node.ssl;
        }
        useStore.getState().updateMerchant(updates);
      },
      onUnhealthy: (_url, reason) => {
        console.warn('[node-switcher] current node unhealthy:', reason);
      },
      onExhausted: (url) => {
        console.warn('[node-switcher] exhausted — no fresh node after retries:', url);
        toast.error('Could not reach a fresh Monero node. Check your connection.');
      },
    });
  }

  const service = serviceRef.current;

  // Sync config from merchant settings whenever they change.
  useEffect(() => {
    if (!service) return;
    service.setConfig({
      enabled: enabled !== false,
      intervalMs: Math.max(15000, Math.round((merchant.autoNodeSwitchIntervalMin || 0.5) * 60_000)),
      ...defaultNodeSwitchConfig,
    });
  }, [service, enabled, merchant.autoNodeSwitchIntervalMin]);

  // Run the probe loop while active.
  useEffect(() => {
    if (!service || !enabled) return;
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      try {
        await service.tick();
      } catch (e) {
        console.warn('[node-switcher] tick failed:', e);
      }
    };

    // Probe immediately, then on the configured interval.
    run();
    const intervalMs = Math.max(15000, Math.round((merchant.autoNodeSwitchIntervalMin || 0.5) * 60_000));
    const id = setInterval(run, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [service, enabled, merchant.autoNodeSwitchIntervalMin]);
}
