/**
 * USDT-TRC20 Payment Manager
 * Handles USDT payment creation, monitoring, and confirmations
 */

import { getUsdtClient, UsdtTrc20Client, USDT_CONTRACT_ADDRESS } from './usdt-trc20';
import { Invoice } from './mock-data';

export interface UsdtPaymentIntent {
  id: string;
  merchantAddress: string;
  fiatAmount: number;
  fiatCurrency: string;
  usdtAmount: number; // Same as fiatAmount (1:1 pegged)
  description: string;
  expiresAt: string;
  createdAt: string;
  expectedConfirmations: number;
}

export interface UsdtPaymentStatus {
  paymentId: string;
  status: 'pending' | 'confirming' | 'paid' | 'underpaid' | 'overpaid' | 'expired' | 'failed';
  usdtReceived: number;
  usdtExpected: number;
  confirmations: number;
  expectedConfirmations: number;
  txID?: string;
  paidAt?: string;
  blockNumber?: number;
}

export class UsdtPaymentManager {
  private client: UsdtTrc20Client;
  private expectedConfirmations: number = 19; // ~1 minute on TRON

  constructor() {
    this.client = getUsdtClient();
  }

  /**
   * Create a USDT payment intent
   */
  async createPaymentIntent(
    merchantAddress: string,
    fiatAmount: number,
    fiatCurrency: string = 'USD',
    description: string = '',
    expirationMinutes: number = 30
  ): Promise<UsdtPaymentIntent> {
    // fiatAmount is always in USD terms (USDT is 1:1 with USD)
    // USDT is 1:1 pegged to USD, so USDT amount = fiat amount
    const usdtAmount = fiatAmount;
    const paymentId = this.generatePaymentId(merchantAddress);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expirationMinutes * 60 * 1000);

    return {
      id: paymentId,
      merchantAddress,
      fiatAmount,
      fiatCurrency,
      usdtAmount: parseFloat(usdtAmount.toFixed(2)),
      description,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      expectedConfirmations: this.expectedConfirmations,
    };
  }

  /**
   * Check payment status by polling blockchain for USDT-TRC20 transfers
   */
  async checkPaymentStatus(
    merchantAddress: string,
    usdtExpected: number,
    expiresAt: string,
    afterTxId?: string
  ): Promise<UsdtPaymentStatus> {
    try {
      const now = new Date();
      const expiresAtDate = new Date(expiresAt);

      // Check if expired
      if (now > expiresAtDate) {
        return {
          paymentId: this.generatePaymentId(merchantAddress),
          status: 'expired',
          usdtReceived: 0,
          usdtExpected,
          confirmations: 0,
          expectedConfirmations: this.expectedConfirmations,
        };
      }

      // Get USDT transactions for merchant address
      const transactions = await this.client.getUsdtTransactions(merchantAddress, 50);

      // Filter transactions from the last hour
      let latestMatchingTx: any = null;

      for (const tx of transactions) {
        const txDate = new Date(tx.blockTimestamp);

        // Check if transaction is from the last hour
        if (txDate.getTime() > now.getTime() - 60 * 60 * 1000) {
          latestMatchingTx = tx;
        }
      }

      if (!latestMatchingTx) {
        // No transactions yet
        return {
          paymentId: this.generatePaymentId(merchantAddress),
          status: 'pending',
          usdtReceived: 0,
          usdtExpected,
          confirmations: 0,
          expectedConfirmations: this.expectedConfirmations,
        };
      }

      // Get current block and calculate confirmations
      try {
        const currentBlock = await this.client.getBlockNumber();
        const confirmations = currentBlock - (latestMatchingTx.blockNumber || 0);

        // Determine payment status
        const usdtReceived = parseFloat(latestMatchingTx.valueUsdt);
        let status: UsdtPaymentStatus['status'] = 'pending';

        // Use 0.01 USDT tolerance for underpayment due to potential decimals
        const tolerance = 0.01;

        if (confirmations >= this.expectedConfirmations) {
          if (usdtReceived >= usdtExpected - tolerance) {
            const diff = Math.abs(usdtReceived - usdtExpected);
            status = diff < tolerance * 2 ? 'paid' : 'overpaid';
          } else if (usdtReceived > 0) {
            status = 'underpaid';
          } else {
            status = 'failed';
          }
        } else if (usdtReceived >= usdtExpected - tolerance) {
          status = 'confirming';
        } else if (usdtReceived > 0) {
          status = 'confirming';
        }

        return {
          paymentId: this.generatePaymentId(merchantAddress),
          status,
          usdtReceived,
          usdtExpected,
          confirmations,
          expectedConfirmations: this.expectedConfirmations,
          txID: latestMatchingTx.txID,
          paidAt: confirmations >= this.expectedConfirmations ? new Date(latestMatchingTx.blockTimestamp).toISOString() : undefined,
          blockNumber: latestMatchingTx.blockNumber,
        };
      } catch (blockErr) {
        console.error('[UsdtPaymentManager] Failed to get block number:', blockErr);
        return {
          paymentId: this.generatePaymentId(merchantAddress),
          status: 'confirming',
          usdtReceived: parseFloat(latestMatchingTx.valueUsdt),
          usdtExpected,
          confirmations: 0,
          expectedConfirmations: this.expectedConfirmations,
          txID: latestMatchingTx.txID,
        };
      }
    } catch (error) {
      console.error('[UsdtPaymentManager] Payment check failed:', error);
      throw error;
    }
  }

  /**
   * Convert Invoice to USDT invoice format
   */
  async createUsdtInvoice(
    merchantAddress: string,
    fiatAmount: number,
    fiatCurrency: string,
    description: string,
    expirationMinutes: number = 30
  ): Promise<Partial<Invoice>> {
    const intent = await this.createPaymentIntent(
      merchantAddress,
      fiatAmount,
      fiatCurrency,
      description,
      expirationMinutes
    );

    return {
      id: intent.id,
      fiatAmount: intent.fiatAmount,
      fiatCurrency: intent.fiatCurrency,
      xmrAmount: 0, // Not used for USDT
      subaddress: '', // Not used for USDT
      status: 'pending',
      createdAt: intent.createdAt,
      expiresAt: intent.expiresAt,
      description: intent.description,
      chainType: 'trx', // Keep 'trx' for TRON network
      trxAddress: intent.merchantAddress,
      trxAmount: intent.usdtAmount, // Now storing USDT amount, not TRX
      confirmations: 0,
    };
  }

  /**
   * Monitor an invoice for USDT payments
   */
  async monitorUsdtInvoice(invoice: Partial<Invoice>): Promise<Partial<Invoice>> {
    if (!invoice.trxAddress || !invoice.trxAmount || !invoice.expiresAt) {
      throw new Error('Invalid USDT invoice: missing required fields');
    }

    const status = await this.checkPaymentStatus(
      invoice.trxAddress,
      invoice.trxAmount,
      invoice.expiresAt
    );

    return {
      ...invoice,
      status: status.status,
      trxConfirmations: status.confirmations,
      trxTxID: status.txID,
      paidAt: status.paidAt,
      confirmations: status.confirmations,
    };
  }

  /**
   * Get USDT balance for merchant
   */
  async getMerchantBalance(address: string): Promise<{
    address: string;
    balanceUsdt: string;
    balanceUsd: number;
  }> {
    const balance = await this.client.getUsdtBalance(address);
    return {
      address: balance.address,
      balanceUsdt: balance.balanceUsdt,
      balanceUsd: balance.balanceUsd,
    };
  }

  /**
   * Get recent USDT transactions for merchant
   */
  async getRecentTransactions(
    address: string,
    limit: number = 10
  ): Promise<any[]> {
    return await this.client.getUsdtTransactions(address, limit);
  }

  /**
   * Generate payment ID from address and timestamp
   */
  private generatePaymentId(address: string): string {
    const timestamp = Date.now();
    const hash = this.simpleHash(address + timestamp.toString());
    return `usdt_${hash.substring(0, 16)}`;
  }

  /**
   * Simple hash function for ID generation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

// Singleton instance
let usdtPaymentManager: UsdtPaymentManager | null = null;

export function getUsdtPaymentManager(): UsdtPaymentManager {
  if (!usdtPaymentManager) {
    usdtPaymentManager = new UsdtPaymentManager();
  }
  return usdtPaymentManager;
}
