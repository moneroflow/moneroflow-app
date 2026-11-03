/**
 * Ethereum / Arbitrum RPC Client
 * Handles balance checking, transaction monitoring, and gas estimation
 */

import { ethers } from 'ethers';
import { CHAIN_CONFIGS } from './multi-chain-wallet';

export interface EthereumBalance {
  address: string;
  balanceWei: string;
  balanceEth: string;
  balanceUsd?: number;
}

export interface EthereumTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueEth: string;
  blockNumber: number;
  confirmations: number;
  timestamp?: number;
}

export interface TokenTransfer {
  token: string;
  symbol: string;
  from: string;
  to: string;
  value: string;
  decimals: number;
}

export class EthereumClient {
  private provider: ethers.JsonRpcProvider;
  private chainType: 'ethereum' | 'arbitrum';
  private config: typeof CHAIN_CONFIGS.ethereum | typeof CHAIN_CONFIGS.arbitrum;

  constructor(chainType: 'ethereum' | 'arbitrum') {
    this.chainType = chainType;
    this.config = CHAIN_CONFIGS[chainType];
    // Alchemy public endpoint for ETH, or Arbitrum RPC
    const rpcUrl = chainType === 'ethereum'
      ? 'https://eth.llamarpc.com' // Public RPC
      : 'https://arb1.arbitrum.io/rpc'; // Arbitrum public RPC
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  /**
   * Get balance for an address
   */
  async getBalance(address: string): Promise<EthereumBalance> {
    try {
      const balanceWei = await this.provider.getBalance(address);
      const balanceEth = ethers.formatEther(balanceWei);
      
      // Get ETH price for USD conversion (simplified)
      const ethPrice = await this.getEthPrice();
      
      return {
        address,
        balanceWei: balanceWei.toString(),
        balanceEth,
        balanceUsd: parseFloat(balanceEth) * ethPrice,
      };
    } catch (error) {
      console.error(`[EthereumClient] Failed to get balance for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash: string): Promise<EthereumTransaction> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        throw new Error('Transaction not found');
      }

      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      let ethPrice = 0;
      try {
        ethPrice = await this.getEthPrice();
      } catch {}

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: tx.value.toString(),
        valueEth: ethers.formatEther(tx.value),
        blockNumber: receipt.blockNumber,
        confirmations,
        timestamp: await this.getBlockTimestamp(receipt.blockNumber),
      };
    } catch (error) {
      console.error(`[EthereumClient] Failed to get transaction ${txHash}:`, error);
      throw error;
    }
  }

  /**
   * Get block timestamp
   */
  private async getBlockTimestamp(blockNumber: number): Promise<number> {
    const block = await this.provider.getBlock(blockNumber);
    return block?.timestamp || 0;
  }

  /**
   * Get ETH price (simplified - in production use proper price API)
   */
  private async getEthPrice(): Promise<number> {
    try {
      // Use CoinGecko public API
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      return data.ethereum?.usd || 0;
    } catch {
      // Fallback price
      return 3400; // Approximate ETH price
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(to: string, value: string, data: string = '0x'): Promise<bigint> {
    try {
      return await this.provider.estimateGas({
        to,
        value,
        data,
      });
    } catch (error) {
      console.error('[EthereumClient] Gas estimation failed:', error);
      // Fallback to 21000 gas (typical for simple ETH transfer)
      return 21000n;
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<{ gasPrice: string; gasGwei: string }> {
    try {
      const feeData = await this.provider.getFeeData();
      if (!feeData.gasPrice) {
        throw new Error('No gas price available');
      }
      
      const gasPriceWei = feeData.gasPrice.toString();
      const gasGwei = ethers.formatUnits(feeData.gasPrice, 'gwei');
      
      return { gasPrice: gasPriceWei, gasGwei };
    } catch (error) {
      console.error('[EthereumClient] Failed to get gas price:', error);
      // Fallback gas price
      return { gasPrice: '20000000000', gasGwei: '20' }; // 20 gwei
    }
  }

  /**
   * Get latest block number
   */
  async getBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  /**
   * Get transactions for an address (simplified - uses logs)
   */
  async getTransactionsForAddress(address: string, startBlock?: number): Promise<EthereumTransaction[]> {
    // Note: This is a simplified implementation
    // In production, use proper indexing service or block explorer API
    return [];
  }

  /**
   * Validate address format
   */
  static isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }
}

// Singleton instances
let ethClient: EthereumClient | null = null;
let arbClient: EthereumClient | null = null;

export function getEthereumClient(): EthereumClient {
  if (!ethClient) {
    ethClient = new EthereumClient('ethereum');
  }
  return ethClient;
}

export function getArbitrumClient(): EthereumClient {
  if (!arbClient) {
    arbClient = new EthereumClient('arbitrum');
  }
  return arbClient;
}
