/**
 * Remote Node Manager
 * Handles auto-connection, health checking, and failover for Monero remote nodes.
 */

export interface RemoteNode {
  label: string;
  url: string;
  ssl: boolean;
}

export const REMOTE_NODES: RemoteNode[] = [
  { label: 'Seth for Privacy', url: 'node.sethforprivacy.com:18089', ssl: true },
  { label: 'Cake Wallet', url: 'xmr-node.cakewallet.com:18081', ssl: true },
  { label: 'HashVault', url: 'nodes.hashvault.pro:18081', ssl: true },
  { label: 'RINO Community', url: 'node.community.rino.io:18081', ssl: true },
  { label: 'MoneroWorld', url: 'node.moneroworld.com:18089', ssl: true },
];

export interface NodeStatus {
  connected: boolean;
  label: string;
  url: string;
  height: number;
  targetHeight: number;
  syncPercent: number;
  latencyMs: number;
  status: 'online' | 'syncing' | 'offline' | 'connecting';
  lastChecked: number;
  error?: string;
}

const DEFAULT_STATUS: NodeStatus = {
  connected: false,
  label: '',
  url: '',
  height: 0,
  targetHeight: 0,
  syncPercent: 0,
  latencyMs: 0,
  status: 'offline',
  lastChecked: 0,
};

/**
 * Test a single remote node and return its status.
 * Uses a timeout to prevent hanging on unresponsive nodes.
 */
export async function testNode(node: RemoteNode, timeoutMs = 8000): Promise<NodeStatus> {
  const startTime = Date.now();
  const protocol = node.ssl ? 'https' : 'http';
  const url = `${protocol}://${node.url}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${url}/json_rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'get_info',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return { ...DEFAULT_STATUS, label: node.label, url: node.url, error: `HTTP ${response.status}`, lastChecked: Date.now() };
    }

    const data = await response.json();
    if (data.error) {
      return { ...DEFAULT_STATUS, label: node.label, url: node.url, error: data.error.message, lastChecked: Date.now() };
    }

    const result = data.result;
    const height = result?.height || 0;
    const targetHeight = result?.target_height || height;
    const syncPercent = targetHeight > 0 ? Math.min(100, (height / targetHeight) * 100) : 100;

    return {
      connected: true,
      label: node.label,
      url: node.url,
      height,
      targetHeight,
      syncPercent,
      latencyMs,
      status: syncPercent >= 99.9 ? 'online' : 'syncing',
      lastChecked: Date.now(),
    };
  } catch (e) {
    return {
      ...DEFAULT_STATUS,
      label: node.label,
      url: node.url,
      latencyMs: Date.now() - startTime,
      error: (e as Error).message?.includes('abort') ? 'Timeout' : (e as Error).message,
      lastChecked: Date.now(),
    };
  }
}

/**
 * Find the fastest responding node from the list.
 * Tests all nodes in parallel and returns the best one.
 */
export async function findFastestNode(nodes: RemoteNode[] = REMOTE_NODES): Promise<{ node: RemoteNode; status: NodeStatus } | null> {
  const results = await Promise.all(nodes.map(async (node) => {
    const status = await testNode(node, 6000);
    return { node, status };
  }));

  // Filter to connected nodes, sort by latency
  const connected = results
    .filter(r => r.status.connected)
    .sort((a, b) => a.status.latencyMs - b.status.latencyMs);

  return connected[0] || null;
}

/**
 * Try to connect to nodes in order, returning the first successful one.
 * Used for failover when current node goes down.
 */
export async function connectWithFailover(
  nodes: RemoteNode[] = REMOTE_NODES,
  excludeUrl?: string
): Promise<{ node: RemoteNode; status: NodeStatus } | null> {
  const candidates = excludeUrl ? nodes.filter(n => n.url !== excludeUrl) : nodes;

  for (const node of candidates) {
    const status = await testNode(node, 5000);
    if (status.connected) {
      return { node, status };
    }
  }
  return null;
}

// ── Autonomous Node Switching (Cake-Wallet-style) ─────────────────────────
// Mirrors Cake Wallet's NodeSwitchingService: a background monitor probes the
// current node's health independently of the sync loop and, if the node is
// stale or unresponsive, rotates to the next live node — so a node that is
// "connected" but silently falling behind is never trusted for balances.
//
// Better than Cake: candidates are judged on HEIGHT FRESHNESS relative to the
// freshest live node (not just "height > 0"), plus connection, so a node that
// is alive but years behind is rejected too.

// A node as many blocks behind the freshest live node as this is considered
// stale. ~30 blocks ≈ 30 minutes on mainnet.
export const HEIGHT_TOLERANCE_BLOCKS = 30;

export interface NodeSwitchConfig {
  enabled: boolean;
  intervalMs: number;      // how often the background monitor pings
  maxAttempts: number;     // switching attempts before we stop hot-looping
  cooldownMs: number;      // pause between switch attempts
  exhaustionMs: number;    // how long we latch "disabled" after max attempts
  probeTimeoutMs: number;
}

export const defaultNodeSwitchConfig: NodeSwitchConfig = {
  enabled: true,
  intervalMs: 30_000,
  maxAttempts: 5,
  cooldownMs: 15_000,
  exhaustionMs: 5 * 60_000,
  probeTimeoutMs: 5_000,
};

export interface NodeSwitchResult {
  switched: boolean;
  reason: string;
  previousUrl: string;
  newNode?: RemoteNode;
  newStatus?: NodeStatus;
  bestHeight: number;
}

/**
 * Probe every trusted node and return the freshest (highest) mainnet height
 * observed. Returns 0 if none respond — callers treat 0 as "can't compare",
 * so a merely-connected node is still accepted rather than falsely rejected.
 */
export async function probeFreshestHeight(timeoutMs = 6_000): Promise<number> {
  const results = await Promise.all(REMOTE_NODES.map(n => testNode(n, timeoutMs)));
  let best = 0;
  for (const r of results) {
    if (r.connected && r.height > best) best = r.height;
  }
  return best;
}

/**
 * True when a node is connected AND, when a comparison height is available,
 * it is not materially behind the freshest node. "Connected but behind" is
 * exactly the silent-failure case a plain connectivity check misses.
 */
export function isNodeFresh(
  status: NodeStatus,
  bestHeight: number,
  tolerance = HEIGHT_TOLERANCE_BLOCKS,
): boolean {
  if (!status.connected) return false;
  if (bestHeight <= 0) return true; // nothing to compare against — trust the link
  return status.height >= bestHeight - tolerance;
}

/**
 * Finds the best healthy node to switch to. Returns the freshest node that is
 * connected and not behind the best height, preferring lowest latency among
 * equally-fresh candidates. Excludes the current node and any we've recently
 * tried (Cake's "used nodes" guard).
 */
export async function pickSwitchTarget(
  excludeUrls: string[],
  bestHeight: number,
  timeoutMs = 5_000,
): Promise<{ node: RemoteNode; status: NodeStatus } | null> {
  const exclude = new Set(excludeUrls.map(u => normalizeUrl(u)));
  const results = await Promise.all(
    REMOTE_NODES.filter(n => !exclude.has(n.url)).map(async (n) => {
      const status = await testNode(n, timeoutMs);
      return { node: n, status };
    }),
  );

  // Connected + fresh first, sorted by freshness then latency.
  const healthy = results
    .filter(r => isNodeFresh(r.status, bestHeight))
    .sort((a, b) => {
      const aLag = bestHeight - a.status.height;
      const bLag = bestHeight - b.status.height;
      if (aLag !== bLag) return aLag - bLag;
      return a.status.latencyMs - b.status.latencyMs;
    });

  return healthy[0] || null;
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Autonomous node-switching monitor. Holds the cooldown/max-attempts/exhaustion
 * latch state (mirroring Cake's in-memory counters) and drives the periodic
 * health probe. Pure: all store/merchant side-effects go through the supplied
 * hooks so this stays unit-testable and framework-agnostic.
 */
export class NodeSwitchingService {
  private config: NodeSwitchConfig = defaultNodeSwitchConfig;
  private attempts = 0;
  private cooldownUntil = 0;
  private exhaustedUntil = 0;
  private usedUrls: string[] = [];
  private _active = false;

  constructor(
    private hooks: {
      getCurrentUrl: () => string | null;
      applySwitch: (node: RemoteNode, status: NodeStatus) => void;
      onExhausted?: (url: string) => void;
      onUnhealthy?: (url: string, reason: string) => void;
    },
  ) {}

  setConfig(cfg: Partial<NodeSwitchConfig>) {
    this.config = { ...this.config, ...cfg };
  }

  get active(): boolean {
    return this._active;
  }

  /** Reset latch state — call when a node passes health or the wallet changes. */
  reset() {
    this.attempts = 0;
    this.cooldownUntil = 0;
    this.exhaustedUntil = 0;
    this.usedUrls = [];
  }

  private currentUrl(): string | null {
    try {
      return this.hooks.getCurrentUrl();
    } catch {
      return null;
    }
  }

  /**
   * One monitoring tick: probe the current node; if unhealthy, rotate to the
   * next fresh node. No-ops when disabled, cooling down, or exhausted.
   */
  async tick(): Promise<NodeSwitchResult> {
    const now = Date.now();
    const url = this.currentUrl();
    if (!url) return { switched: false, reason: 'no-current-node', previousUrl: '', bestHeight: 0 };
    if (this.exhaustedUntil > now) return { switched: false, reason: 'exhausted', previousUrl: url, bestHeight: 0 };
    if (this.cooldownUntil > now) return { switched: false, reason: 'cooldown', previousUrl: url, bestHeight: 0 };

    const bestHeight = await probeFreshestHeight(this.config.probeTimeoutMs);

    const currentIsKnown = REMOTE_NODES.find(n => n.url === url);
    const current = currentIsKnown || { label: 'Custom', url, ssl: true };
    const currentStatus = await testNode(current, this.config.probeTimeoutMs);

    if (isNodeFresh(currentStatus, bestHeight)) {
      // Healthy — reset failure counters (Cake resets when a node passes).
      this.attempts = 0;
      this.usedUrls = [];
      return { switched: false, reason: 'healthy', previousUrl: url, newStatus: currentStatus, bestHeight };
    }

    this.hooks.onUnhealthy?.(url, `connected=${currentStatus.connected} height=${currentStatus.height} best=${bestHeight}`);

    // Try to rotate to a fresh node, excluding this one + recently-used ones.
    const target = await pickSwitchTarget([url, ...this.usedUrls], bestHeight, this.config.probeTimeoutMs);
    if (!target) {
      this.attempts += 1;
      this.cooldownUntil = Date.now() + this.config.cooldownMs;
      if (this.attempts >= this.config.maxAttempts) {
        this.exhaustedUntil = Date.now() + this.config.exhaustionMs;
        this.hooks.onExhausted?.(url);
      }
      return { switched: false, reason: 'no-fresh-node', previousUrl: url, bestHeight };
    }

    // Rotate.
    this.hooks.applySwitch(target.node, target.status);
    // Remember the failed node so we don't bounce straight back to it, but
    // never let the ring grow unbounded.
    this.usedUrls = [...new Set([...this.usedUrls, url])].slice(-REMOTE_NODES.length);
    this.attempts = 0;
    this.cooldownUntil = Date.now() + this.config.cooldownMs;

    return {
      switched: true,
      reason: 'rotated',
      previousUrl: url,
      newNode: target.node,
      newStatus: target.status,
      bestHeight,
    };
  }
}
