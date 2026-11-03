/**
 * USDT-TRC20 Token Payment Manager
 * Handles USDT (Tether) token transactions on the Tron network
 * USDT Contract: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
 */

import axios from 'axios';

// USDT-TRC20 Contract Address
export const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

export interface UsdtTransaction {
  txID: string;
  blockNumber: number;
  blockTimestamp: number;
  from: string;
  to: string;
  value: string; // In USDT (6 decimals)
  valueUsdt: string;
  valueDecimals: number;
  contractRet?: string;
  receipt?: {
    result: string;
    energyUsage?: number;
    netUsage?: number;
  };
}

export interface UsdtBalance {
  address: string;
  balanceUsdt: string;
  balanceDecimals: number;
  balanceUsd: number; // USDT is 1:1 with USD
}

export class UsdtTrc20Client {
  private apiUrl: string;

  constructor() {
    // TronGrid API
    this.apiUrl = 'https://api.trongrid.io';
  }

  /**
   * Get USDT-TRC20 balance for an address
   */
  async getUsdtBalance(address: string): Promise<UsdtBalance> {
    try {
      // TronGrid API to get TRC-20 token balance
      const response = await axios.get(
        `${this.apiUrl}/v1/accounts/${address}/tokens/${USDT_CONTRACT_ADDRESS}`,
        {
          headers: {
            'TRON-PRO-API-KEY': process.env.VITE_TRONGRID_API_KEY || '',
          },
        }
      );

      let balanceDecimals = 0;
      let balanceUsdt = '0';

      if (response.data && response.data.data) {
        const balance = response.data.data.balance || '0';
        balanceDecimals = parseInt(balance);
        // USDT has 6 decimals
        balanceUsdt = (balanceDecimals / 1_000_000).toFixed(6);
      }

      return {
        address,
        balanceUsdt,
        balanceDecimals,
        balanceUsd: parseFloat(balanceUsdt),
      };
    } catch (error) {
      // New address or no tokens yet
      return {
        address,
        balanceUsdt: '0',
        balanceDecimals: 0,
        balanceUsd: 0,
      };
    }
  }

  /**
   * Get USDT-TRC20 transactions for an address
   */
  async getUsdtTransactions(
    address: string,
    limit: number = 20
  ): Promise<UsdtTransaction[]> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/v1/accounts/${address}/transactions/trc20`,
        {
          params: {
            limit,
            contract_address: USDT_CONTRACT_ADDRESS,
            only_to: true,
          },
          headers: {
            'TRON-PRO-API-KEY': process.env.VITE_TRONGRID_API_KEY || '',
          },
        }
      );

      const transactions: UsdtTransaction[] = [];

      if (response.data && response.data.data) {
        for (const txData of response.data.data) {
          const value = txData.value || '0';
          const valueDecimals = parseInt(value);
          const valueUsdt = (valueDecimals / 1_000_000).toFixed(6);

          transactions.push({
            txID: txData.transaction_id || txData.txID || '',
            blockNumber: txData.block_number || 0,
            blockTimestamp: txData.block_timestamp || 0,
            from: txData.from || '',
            to: txData.to || address,
            value: value,
            valueUsdt: valueUsdt,
            valueDecimals: valueDecimals,
            contractRet: txData.ret?.[0],
            receipt: {
              result: txData.ret?.[0] || 'SUCCESS',
              energyUsage: txData.receipt?.energy_usage_total,
              netUsage: txData.receipt?.net_usage || 0,
            },
          });
        }
      }

      return transactions;
    } catch (error: any) {
      console.error(`[UsdtTrc20Client] Failed to get USDT transactions for ${address}:`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get transaction details by hash
   */
  async getTransaction(txHash: string): Promise<UsdtTransaction | null> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/v1/transactions/${txHash}`,
        {
          headers: {
            'TRON-PRO-API-KEY': process.env.VITE_TRONGRID_API_KEY || '',
          },
        }
      );

      const txData = response.data?.data?.[0];
      if (!txData) return null;

      // Check if it's a USDT transfer
      if (txData.contract_address?.toLowerCase() !== USDT_CONTRACT_ADDRESS.toLowerCase()) {
        return null;
      }

      const value = txData.value || '0';
      const valueDecimals = parseInt(value);
      const valueUsdt = (valueDecimals / 1_000_000).toFixed(6);

      return {
        txID: txData.transaction_id || txHash,
        blockNumber: txData.block_number || 0,
        blockTimestamp: txData.block_timestamp || 0,
        from: txData.from || '',
        to: txData.to || '',
        value: value,
        valueUsdt: valueUsdt,
        valueDecimals: valueDecimals,
        contractRet: txData.ret?.[0],
        receipt: {
          result: txData.ret?.[0] || 'SUCCESS',
          energyUsage: txData.receipt?.energy_usage_total,
          netUsage: txData.receipt?.net_usage || 0,
        },
      };
    } catch (error) {
      console.error(`[UsdtTrc20Client] Failed to get transaction ${txHash}:`, error);
      return null;
    }
  }

  /**
   * Get latest block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/wallet/getnowblock`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data.block_header?.raw_data?.number || 0;
    } catch (error) {
      console.error('[UsdtTrc20Client] Failed to get block number:', error);
      return 0;
    }
  }

  /**
   * Generate USDT-TRC20 payment link (for wallet deep links)
   * This format is supported by TronLink, Trust Wallet, etc.
   */
  generatePaymentLink(address: string, amountUsdt: number): string {
    // Convert USDT to contract value (6 decimals)
    const amountDecimals = Math.floor(amountUsdt * 1_000_000);

    // Format for TronLink and other wallets
    // Format: https://tronscan.org/?contract={address}&function=transfer&params=[]&callback_url=
    // Or use direct deep link format
    return `https://tronscan.org/#/contract/${USDT_CONTRACT_ADDRESS}/interact?address=${address}&amount=${amountUsdt}`;
  }

  /**
   * Generate QR code data for USDT-TRC20 payment
   * Format that works with mobile wallets
   */
  generateQrData(address: string, amountUsdt: number): string {
    // Tron URI format for contract interaction
    // Not all wallets support this directly, so we use a payment link
    return JSON.stringify({
      currency: 'USDT',
      network: 'TRC20',
      contract: USDT_CONTRACT_ADDRESS,
      to: address,
      amount: amountUsdt.toFixed(2),
    });
  }

  /**
   * Convert USD to USDT (1:1 pegged)
   */
  usdToUsdt(usdAmount: number): number {
    return usdAmount; // USDT is pegged 1:1 to USD
  }

  /**
   * Convert USDT to USD (1:1 pegged)
   */
  usdtToUsd(usdtAmount: number): number {
    return usdtAmount; // USDT is pegged 1:1 to USD
  }
}

// Singleton instance
let usdtClient: UsdtTrc20Client | null = null;

export function getUsdtClient(): UsdtTrc20Client {
  if (!usdtClient) {
    usdtClient = new UsdtTrc20Client();
  }
  return usdtClient;
}
