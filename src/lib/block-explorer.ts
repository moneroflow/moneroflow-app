/**
 * Monero Block Explorer Payment Verification
 * 
 * Uses public block explorer APIs (xmrchain.net) to verify payments
 * by checking TX outputs with the merchant's view key + address.
 * 
 * Primary method: verifyTxOutputs() — given a TX hash, check if outputs belong to us
 * Secondary method: scanRecentOutputs() — get current height, then scan recent blocks
 */

const EXPLORER_ENDPOINTS = [
  'https://xmrchain.net',
];

export interface ExplorerOutput {
  amount: number;
  match: boolean;
  output_idx: number;
  output_pubkey: string;
}

export interface ExplorerTxResult {
  tx_hash: string;
  tx_fee: number;
  outputs: ExplorerOutput[];
  block_no: number;
  confirmations: number;
  timestamp: number;
  coinbase: boolean;
}

/**
 * Check if a specific TX has outputs belonging to the given address + viewkey.
 * Uses: /api/outputs?txhash=X&address=X&viewkey=X&txprove=0
 * This is the RELIABLE endpoint — always works.
 */
export async function verifyTxOutputs(
  txHash: string,
  address: string,
  viewKey: string,
): Promise<{ matched: boolean; totalAmount: number; confirmations: number; txFee: number } | null> {
  for (const baseUrl of EXPLORER_ENDPOINTS) {
    try {
      const url = `${baseUrl}/api/outputs?txhash=${txHash}&address=${address}&viewkey=${viewKey}&txprove=0`;
      console.log(`[Explorer] Checking TX outputs: ${baseUrl}`);
      
      const resp = await fetch(url, { 
        signal: AbortSignal.timeout(15000),
      });
      
      if (!resp.ok) {
        console.warn(`[Explorer] ${baseUrl} returned ${resp.status}`);
        continue;
      }
      
      const data = await resp.json();
      
      if (data.status === 'fail' || data.status === 'error') {
        console.warn(`[Explorer] API error:`, data.data);
        continue;
      }
      
      const result = data.data;
      const matchedOutputs = (result.outputs || []).filter((o: any) => o.match === true);
      const totalAmount = matchedOutputs.reduce((sum: number, o: any) => sum + (o.amount || 0), 0);
      
      return {
        matched: matchedOutputs.length > 0,
        totalAmount,
        confirmations: result.tx_confirmations ?? 0,
        txFee: result.tx_fee ?? 0,
      };
    } catch (e) {
      console.warn(`[Explorer] ${baseUrl} failed:`, e);
      continue;
    }
  }
  return null;
}

/**
 * Get current blockchain height from the explorer.
 */
export async function getBlockchainHeight(): Promise<number> {
  for (const baseUrl of EXPLORER_ENDPOINTS) {
    try {
      const resp = await fetch(`${baseUrl}/api/networkinfo`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.status === 'success' && data.data?.height) {
        return data.data.height;
      }
    } catch {
      continue;
    }
  }
  return 0;
}

/**
 * Get recent transactions from the mempool.
 * Returns an array of TX hashes currently in the mempool.
 */
export async function getMempoolTxHashes(): Promise<string[]> {
  for (const baseUrl of EXPLORER_ENDPOINTS) {
    try {
      const resp = await fetch(`${baseUrl}/api/mempool`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.status === 'success' && data.data?.txs) {
        return data.data.txs.map((tx: any) => tx.tx_hash).filter(Boolean);
      }
    } catch {
      continue;
    }
  }
  return [];
}

/**
 * Scan recent mempool transactions for outputs to our address.
 * Since the outputsblocks API is unreliable, we:
 * 1. Fetch mempool TX hashes
 * 2. Check each one against our address+viewkey
 * 
 * This is slower but actually works.
 * Limited to first `maxTxsToCheck` transactions to avoid rate limiting.
 */
export async function scanRecentOutputs(
  address: string,
  viewKey: string,
  maxTxsToCheck: number = 20,
): Promise<Array<{
  txHash: string;
  amount: number;
  blockNo: number;
  inMempool: boolean;
  confirmations: number;
}>> {
  try {
    const mempoolHashes = await getMempoolTxHashes();
    if (mempoolHashes.length === 0) return [];
    
    const toCheck = mempoolHashes.slice(0, maxTxsToCheck);
    const results: Array<{
      txHash: string;
      amount: number;
      blockNo: number;
      inMempool: boolean;
      confirmations: number;
    }> = [];
    
    // Check each mempool TX (serially to avoid rate limiting)
    for (const txHash of toCheck) {
      try {
        const result = await verifyTxOutputs(txHash, address, viewKey);
        if (result && result.matched && result.totalAmount > 0) {
          results.push({
            txHash,
            amount: result.totalAmount,
            blockNo: 0,
            inMempool: true,
            confirmations: result.confirmations,
          });
        }
      } catch {
        // Skip failed individual checks
      }
    }
    
    return results;
  } catch (e) {
    console.warn('[Explorer] Mempool scan failed:', e);
    return [];
  }
}

/**
 * Get basic TX info from explorer (no viewkey needed).
 * Uses: /api/transaction/TXHASH
 */
export async function getTxInfo(txHash: string): Promise<{
  confirmed: boolean;
  confirmations: number;
  blockHeight: number;
  fee: number;
  timestamp: number;
} | null> {
  for (const baseUrl of EXPLORER_ENDPOINTS) {
    try {
      const url = `${baseUrl}/api/transaction/${txHash}`;
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.status === 'fail') continue;
      
      const tx = data.data;
      return {
        confirmed: tx.block_height > 0,
        confirmations: tx.confirmations ?? 0,
        blockHeight: tx.block_height ?? 0,
        fee: tx.tx_fee ?? 0,
        timestamp: tx.timestamp ?? 0,
      };
    } catch (e) {
      console.warn(`[Explorer] TX info failed:`, e);
      continue;
    }
  }
  return null;
}

/**
 * Check if explorer APIs are reachable.
 */
export async function checkExplorerHealth(): Promise<{ available: boolean; endpoint: string }> {
  for (const baseUrl of EXPLORER_ENDPOINTS) {
    try {
      const resp = await fetch(`${baseUrl}/api/networkinfo`, {
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        return { available: true, endpoint: baseUrl };
      }
    } catch {
      continue;
    }
  }
  return { available: false, endpoint: '' };
}
