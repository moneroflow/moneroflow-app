/**
 * TRX Payment Manager
 * Handles TRX payment creation, monitoring, and confirmations
 */

import { getTronClient, TronClient, TronTransaction, TronTransactionStatus, usdToTrx, trxToUsd } from './tron-rpc';
import { Invoice } from './mock-data';

export interface TrxPaymentIntent {
  id: string;
  merchantAddress: string;
  fiatAmount: number;
  fiatCurrency: string;
  trxAmount: number;
  description: string;
  expiresAt: string;
  createdAt: string;
  expectedConfirmations: number;
}

export interface TrxPaymentStatus {
  paymentId: string;
  status: 'pending' | 'confirming' | 'paid' | 'underpaid' | 'overpaid' | 'expired' | 'failed';
  trxReceived: number;
  trxExpected: number;
  confirmations: number;
  expectedConfirmations: number;
  txID?: string;
  paidAt?: string;
  blockNumber?: number;
}

export class TrxPaymentManager {
  private client: TronClient;
  private expectedConfirmations: number = 19; // ~1 minute on TRX

  constructor() {
    this.client = getTronClient();
  }

  /**
   * Create a TRX payment intent
   */
  async createPaymentIntent(
    merchantAddress: string,
    fiatAmount: number,
    fiatCurrency: string = 'USD',
    description: string = '',
    expirationMinutes: number = 30
  ): Promise<TrxPaymentIntent> {
    // Convert fiat to TRX
    const trxAmount = await usdToTrx(fiatAmount);
    const paymentId = this.generatePaymentId(merchantAddress);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expirationMinutes * 60 * 1000);

    return {
      id: paymentId,
      merchantAddress,
      fiatAmount,
      fiatCurrency,
      trxAmount: Math.ceil(trxAmount * 100) / 100, // Round to 2 decimals
      description,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      expectedConfirmations: this.expectedConfirmations,
    };
  }

  /**
   * Check payment status by polling blockchain
   */
  async checkPaymentStatus(
    merchantAddress: string,
    trxExpected: number,
    expiresAt: string,
    afterTxId?: string
  ): Promise<TrxPaymentStatus> {
    try {
      const now = new Date();
      const expiresAtDate = new Date(expiresAt);

      // Check if expired
      if (now > expiresAtDate) {
        return {
          paymentId: this.generatePaymentId(merchantAddress),
          status: 'expired',
          trxReceived: 0,
          trxExpected,
          confirmations: 0,
          expectedConfirmations: this.expectedConfirmations,
        };
      }

      // Get transactions for merchant address
      const transactions = await this.client.getTransactionsForAddress(merchantAddress, 50);

      // Filter transactions after certain timestamp or tx
      let latestMatchingTx: TronTransaction | null = null;

      for (const tx of transactions) {
        const txDate = new Date(tx.blockTimestamp);
        
        // Check if transaction is after our start time
        if (txDate > now.getTime() - 60 * 60 * 1000) { // Last hour
          latestMatchingTx = tx;
        }
      }

      if (!latestMatchingTx) {
        // No transactions yet
        return {
          paymentId: this.generatePaymentId(merchantAddress),
          status: 'pending',
          trxReceived: 0,
          trxExpected,
          confirmations: 0,
          expectedConfirmations: this.expectedConfirmations,
        };
      }

      // Get confirmations
      const txStatus = await this.client.getTransactionStatus(latestMatchingTx.txID);
      const currentBlock = await this.client.getBlockNumber();
      const confirmations = currentBlock - (latestMatchingTx.blockNumber || 0);

      // Determine payment status
      const trxReceived = parseFloat(latestMatchingTx.valueTrx);
      let status: TrxPaymentStatus['status'] = 'pending';

      if (confirmations >= this.expectedConfirmations) {
        if (trxReceived >= trxExpected) {
          status = Math.abs(trxReceived - trxExpected) < 0.001 ? 'paid' : 'overpaid';
        } else if (trxReceived > 0) {
          status = 'underpaid';
        } else {
          status = 'failed';
        }
      } else if (trxReceived >= trxExpected) {
        status = 'confirming';
      } else if (trxReceived > 0) {
        status = 'confirming';
      }

      return {
        paymentId: this.generatePaymentId(merchantAddress),
        status,
        trxReceived,
        trxExpected,
        confirmations,
        expectedConfirmations: this.expectedConfirmations,
        txID: latestMatchingTx.txID,
        paidAt: confirmations >= this.expectedConfirmations ? new Date(latestMatchingTx.blockTimestamp).toISOString() : undefined,
        blockNumber: latestMatchingTx.blockNumber,
      };
    } catch (error) {
      console.error('[TrxPaymentManager] Payment check failed:', error);
      throw error;
    }
  }

  /**
   * Convert Invoice to TRX invoice format
   */
  async createTrxInvoice(
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
      xmrAmount: 0, // Not used for TRX
      subaddress: '', // Not used for TRX
      status: 'pending',
      createdAt: intent.createdAt,
      expiresAt: intent.expiresAt,
      description: intent.description,
      chainType: 'trx',
      trxAddress: intent.merchantAddress,
      trxAmount: intent.trxAmount,
      confirmations: 0,
    };
  }

  /**
   * Monitor an invoice for TRX payments
   */
  async monitorTrxInvoice(invoice: Partial<Invoice>): Promise<Partial<Invoice>> {
    if (!invoice.trxAddress || !invoice.trxAmount || !invoice.expiresAt) {
      throw new Error('Invalid TRX invoice: missing required fields');
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
   * Generate payment ID from address and timestamp
   */
  private generatePaymentId(address: string): string {
    const timestamp = Date.now();
    const hash = this.simpleHash(address + timestamp.toString());
    return `trx_${hash.substring(0, 16)}`;
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

  /**
   * Get TRX balance for merchant
   */
  async getMerchantBalance(address: string): Promise<{
    address: string;
    balanceTrx: string;
    balanceUsd: number;
  }> {
    const balance = await this.client.getBalance(address);
    return {
      address: balance.address,
      balanceTrx: balance.balanceTrx,
      balanceUsd: balance.balanceUsd || 0,
    };
  }

  /**
   * Get recent TRX transactions for merchant
   */
  async getRecentTransactions(
    address: string,
    limit: number = 10
  ): Promise<TronTransaction[]> {
    return await this.client.getTransactionsForAddress(address, limit);
  }
}

// Singleton instance
let trxPaymentManager: TrxPaymentManager | null = null;

export function getTrxPaymentManager(): TrxPaymentManager {
  if (!trxPaymentManager) {
    trxPaymentManager = new TrxPaymentManager();
  }
  return trxPaymentManager;
}
