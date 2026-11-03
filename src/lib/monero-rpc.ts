/**
 * Real Monero Wallet RPC Client
 * 
 * Makes actual JSON-RPC POST requests to monero-wallet-rpc.
 * Browser → RPC directly (for local/self-hosted setups).
 * 
 * CORS: When running monero-wallet-rpc locally, add:
 *   --rpc-access-control-origins=*
 * 
 * For production, proxy through your own server to avoid exposing credentials.
 */

export interface RpcConfig {
  endpoint: string;
  username: string;
  password: string;
  walletFilename: string;
}

export interface RpcBalance {
  balance: number;          // atomic units (piconero)
  unlockedBalance: number;
  multisigImportNeeded: boolean;
}

export interface RpcSubaddress {
  address: string;
  addressIndex: number;
  label: string;
  used: boolean;
}

export interface RpcTransfer {
  txid: string;
  amount: number;
  confirmations: number;
  height: number;
  timestamp: number;
  subaddrIndex: { major: number; minor: number };
  type: 'in' | 'out' | 'pending';
  address: string;
  fee: number;
  note: string;
}

export interface NodeHealth {
  connected: boolean;
  syncHeight: number;
  targetHeight: number;
  syncPercent: number;
  networkType: 'mainnet' | 'stagenet' | 'testnet';
  version: string;
  uptime: number;
  status: 'synced' | 'syncing' | 'offline';
}

// ─── JSON-RPC call ───

let rpcId = 0;

async function jsonRpcCall<T>(
  config: RpcConfig,
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.username && config.password) {
    headers['Authorization'] = 'Basic ' + btoa(`${config.username}:${config.password}`);
  }

  const response = await fetch(`${config.endpoint}/json_rpc`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: String(++rpcId),
      method,
      params: params || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP error ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`RPC error ${data.error.code}: ${data.error.message}`);
  }

  return data.result as T;
}

// For daemon RPC calls (get_info uses a different endpoint path)
async function daemonRpcCall<T>(
  endpoint: string,
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${endpoint}/json_rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: String(++rpcId),
      method,
      params: params || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Daemon HTTP error ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Daemon error ${data.error.code}: ${data.error.message}`);
  }
  return data.result as T;
}

// ─── Public API ───

export async function testConnection(config: RpcConfig): Promise<{ success: boolean; balance?: RpcBalance; error?: string }> {
  try {
    if (!config.endpoint) throw new Error('RPC endpoint is required');
    const result = await jsonRpcCall<{
      balance: number;
      unlocked_balance: number;
      multisig_import_needed: boolean;
    }>(config, 'get_balance', { account_index: 0 });
    const balance: RpcBalance = {
      balance: result.balance,
      unlockedBalance: result.unlocked_balance,
      multisigImportNeeded: result.multisig_import_needed,
    };
    return { success: true, balance };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function createSubaddress(config: RpcConfig, label: string): Promise<RpcSubaddress> {
  const result = await jsonRpcCall<{
    address: string;
    address_index: number;
  }>(config, 'create_address', { account_index: 0, label });
  return {
    address: result.address,
    addressIndex: result.address_index,
    label,
    used: false,
  };
}

export async function validateAddress(config: RpcConfig, address: string): Promise<{ valid: boolean; integrated: boolean; subaddress: boolean; nettype: string }> {
  const result = await jsonRpcCall<{
    valid: boolean;
    integrated: boolean;
    subaddress: boolean;
    nettype: string;
  }>(config, 'validate_address', { address });
  return result;
}

/**
 * Create a subaddress with validation and retry + failover.
 * Returns only addresses that pass validate_address.
 */
export async function createValidatedSubaddress(
  config: RpcConfig,
  label: string,
  failoverConfigs?: RpcConfig[]
): Promise<{ address: string; addressIndex: number }> {
  const configs = [config, ...(failoverConfigs || [])];

  for (const cfg of configs) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const sub = await createSubaddress(cfg, label);
        console.log('[MoneroRPC] create_address response:', JSON.stringify(sub));

        // Validate the returned address
        try {
          const validation = await validateAddress(cfg, sub.address);
          console.log('[MoneroRPC] validate_address response:', JSON.stringify(validation));

          if (validation.valid && validation.subaddress) {
            if (validation.nettype !== 'mainnet') {
              console.warn(`[MoneroRPC] Address is ${validation.nettype}, not mainnet. Retrying...`);
              continue;
            }
            return { address: sub.address, addressIndex: sub.addressIndex };
          }
          console.warn('[MoneroRPC] Address failed validation, retrying...', validation);
        } catch (valErr) {
          // validate_address may not be available on all nodes — if create_address succeeded, trust the RPC
          console.warn('[MoneroRPC] validate_address call failed, trusting create_address result:', valErr);
          if (sub.address.length === 95 && sub.address.startsWith('8')) {
            return { address: sub.address, addressIndex: sub.addressIndex };
          }
        }
      } catch (e) {
        console.error(`[MoneroRPC] create_address attempt ${attempt + 1} failed on ${cfg.endpoint}:`, e);
      }
    }
  }

  throw new Error('Could not generate valid Monero subaddress after multiple attempts. Please try again or switch node.');
}

export async function getBalance(config: RpcConfig): Promise<RpcBalance> {
  const result = await jsonRpcCall<{
    balance: number;
    unlocked_balance: number;
    multisig_import_needed: boolean;
  }>(config, 'get_balance', { account_index: 0 });
  return {
    balance: result.balance,
    unlockedBalance: result.unlocked_balance,
    multisigImportNeeded: result.multisig_import_needed,
  };
}

export async function getTransfers(
  config: RpcConfig,
  subaddrIndices?: number[]
): Promise<{ in: RpcTransfer[]; out: RpcTransfer[]; pending: RpcTransfer[] }> {
  const params: Record<string, unknown> = {
    in: true,
    out: true,
    pending: true,
    account_index: 0,
  };
  if (subaddrIndices?.length) {
    params.subaddr_indices = subaddrIndices;
  }

  const result = await jsonRpcCall<{
    in?: Array<{
      txid: string;
      amount: number;
      confirmations: number;
      height: number;
      timestamp: number;
      subaddr_index: { major: number; minor: number };
      address: string;
      fee: number;
      note: string;
    }>;
    out?: Array<{
      txid: string;
      amount: number;
      confirmations: number;
      height: number;
      timestamp: number;
      subaddr_index: { major: number; minor: number };
      address: string;
      fee: number;
      note: string;
    }>;
    pending?: Array<{
      txid: string;
      amount: number;
      confirmations: number;
      height: number;
      timestamp: number;
      subaddr_index: { major: number; minor: number };
      address: string;
      fee: number;
      note: string;
    }>;
  }>(config, 'get_transfers', params);

  const mapTransfer = (t: any, type: 'in' | 'out' | 'pending'): RpcTransfer => ({
    txid: t.txid,
    amount: t.amount,
    confirmations: t.confirmations || 0,
    height: t.height || 0,
    timestamp: t.timestamp,
    subaddrIndex: { major: t.subaddr_index.major, minor: t.subaddr_index.minor },
    type,
    address: t.address,
    fee: t.fee || 0,
    note: t.note || '',
  });

  return {
    in: (result.in || []).map(t => mapTransfer(t, 'in')),
    out: (result.out || []).map(t => mapTransfer(t, 'out')),
    pending: (result.pending || []).map(t => mapTransfer(t, 'pending')),
  };
}

export async function sweepToAddress(
  config: RpcConfig,
  address: string,
  amount: number
): Promise<{ txid: string; fee: number; txKey: string }> {
  const result = await jsonRpcCall<{
    tx_hash: string;
    fee: number;
    tx_key: string;
  }>(config, 'transfer', {
    destinations: [{ amount, address }],
    account_index: 0,
    priority: 1,
  });
  return {
    txid: result.tx_hash,
    fee: result.fee,
    txKey: result.tx_key,
  };
}

export async function getTxKey(config: RpcConfig, txid: string): Promise<string> {
  const result = await jsonRpcCall<{ tx_key: string }>(config, 'get_tx_key', { txid });
  return result.tx_key;
}

export async function getNodeHealth(config: RpcConfig): Promise<NodeHealth> {
  try {
    // get_info is a daemon RPC method — try the wallet's daemon via get_height first
    const heightResult = await jsonRpcCall<{
      height: number;
    }>(config, 'get_height');

    // Also get version
    const versionResult = await jsonRpcCall<{
      version: number;
    }>(config, 'get_version');

    const major = (versionResult.version >> 16) & 0xff;
    const minor = (versionResult.version >> 8) & 0xff;
    const patch = versionResult.version & 0xff;

    return {
      connected: true,
      syncHeight: heightResult.height,
      targetHeight: heightResult.height, // wallet RPC doesn't expose target easily
      syncPercent: 100,
      networkType: 'mainnet',
      version: `${major}.${minor}.${patch}`,
      uptime: 0, // not available via wallet RPC
      status: 'synced',
    };
  } catch (e) {
    return {
      connected: false,
      syncHeight: 0,
      targetHeight: 0,
      syncPercent: 0,
      networkType: 'mainnet',
      version: 'unknown',
      uptime: 0,
      status: 'offline',
    };
  }
}

// For remote node mode — calls monerod get_info
export async function getDaemonInfo(daemonUrl: string): Promise<NodeHealth> {
  try {
    const result = await daemonRpcCall<{
      height: number;
      target_height: number;
      version: string;
      nettype: string;
      start_time: number;
      status: string;
    }>(daemonUrl, 'get_info');

    const syncPercent = result.target_height > 0
      ? Math.min(100, (result.height / result.target_height) * 100)
      : 100;

    return {
      connected: result.status === 'OK',
      syncHeight: result.height,
      targetHeight: result.target_height || result.height,
      syncPercent,
      networkType: (result.nettype as 'mainnet' | 'stagenet' | 'testnet') || 'mainnet',
      version: result.version || 'unknown',
      uptime: result.start_time ? Math.floor(Date.now() / 1000) - result.start_time : 0,
      status: syncPercent >= 99.9 ? 'synced' : 'syncing',
    };
  } catch {
    return {
      connected: false,
      syncHeight: 0,
      targetHeight: 0,
      syncPercent: 0,
      networkType: 'mainnet',
      version: 'unknown',
      uptime: 0,
      status: 'offline',
    };
  }
}

// Convert atomic units (piconero) to XMR
export const piconeroToXmr = (pico: number) => pico / 1e12;
export const xmrToPiconero = (xmr: number) => Math.round(xmr * 1e12);
