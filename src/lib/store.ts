import { getTrxPaymentManager } from './tron-payments'; // Legacy TRX - kept for compatibility
import { getUsdtPaymentManager } from './usdt-payments'; // USDT-TRC20 integration
import { generateMultiChainWallet } from './multi-chain-wallet';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Invoice, Merchant, Subscription, PaymentLink, Referral, ReferralPayout, PosQuickButton, defaultMerchant, PRO_REFERRAL_UNLOCK_COUNT, PRO_MONTHLY_XMR, CREATOR_TREASURY_ADDRESS, CREATOR_TREASURY_VIEW_KEY, REFERRAL_ECOSYSTEM_PERCENT, CREATOR_SERVER_FQDN } from './mock-data';
import { createValidatedSubaddress, getTransfers, type RpcConfig } from './monero-rpc';
import { scanRecentOutputs, verifyTxOutputs, getTxInfo } from './block-explorer';
import { generateSubaddress as localGenerateSubaddress, generateBrowserWallet } from './wallet-generator';
import { findFastestNode, connectWithFailover, testNode, REMOTE_NODES, type NodeStatus } from './node-manager';
import { getRates, fiatToXmr, getStaleCache } from './currency-service';
import { normalizeMerchantSubscription } from './subscription';
import { startReferralSync, stopReferralSync } from './referral-sync';

/** Valid Lifetime Pro codes — direct Set lookup. */
const VALID_PRO_CODES: ReadonlySet<string> = new Set([
  "MF-PRO-EBPVLATR",
  "MF-PRO-9FMMSYK9",
  "MF-PRO-ZE3DNC6P",
  "MF-PRO-UZHQJR7Y",
  "MF-PRO-T3724C43",
  "MF-PRO-TZAN4PVY",
  "MF-PRO-ZQ8KU86C",
  "MF-PRO-QM4T2PH2",
  "MF-PRO-DRHYR3AE",
  "MF-PRO-VPL8Y4LG",
  "MF-PRO-LEUELXN8",
  "MF-PRO-5EE6CMBM",
  "MF-PRO-Q47HTG4Y",
  "MF-PRO-D2TVKDBK",
  "MF-PRO-UA9TTM7H",
  "MF-PRO-67J57B7M",
  "MF-PRO-ARXUHEV3",
  "MF-PRO-J6B4VDEG",
  "MF-PRO-EGHJ9V3G",
  "MF-PRO-X8T8ZV87",
  "MF-PRO-FYF7D8Z4",
  "MF-PRO-6CDHKPTQ",
  "MF-PRO-JKK5BTSQ",
  "MF-PRO-EYYNSL8K",
  "MF-PRO-QGXGLTV7",
  "MF-PRO-T7RF8DPW",
  "MF-PRO-R8MHY5UC",
  "MF-PRO-49MGNLW7",
  "MF-PRO-ASBUNUPX",
  "MF-PRO-6D7EG6K4",
  "MF-PRO-CE8RTTGY",
  "MF-PRO-E9L5A833",
  "MF-PRO-FN9HYK29",
  "MF-PRO-8BZXMNMG",
  "MF-PRO-NEPD8V68",
  "MF-PRO-27WYZTFF",
  "MF-PRO-7SWDYJQQ",
  "MF-PRO-5FK2NYEB",
  "MF-PRO-LQ44UDWN",
  "MF-PRO-3RJF23YL",
  "MF-PRO-6VU462Q4",
  "MF-PRO-MYXUSTY7",
  "MF-PRO-24K3N5KM",
  "MF-PRO-5DJ9MQGH",
  "MF-PRO-3G7BEQH2",
  "MF-PRO-DWREWZW4",
  "MF-PRO-96Q8VAFM",
  "MF-PRO-XZX83APN",
  "MF-PRO-AXSJ2X2N",
  "MF-PRO-BRSSDQ9M",
  "MF-PRO-4DHZST79",
  "MF-PRO-D67GYF4T",
  "MF-PRO-NRFMTAJG",
  "MF-PRO-QRTF8FJD",
  "MF-PRO-PFX3W9EK",
  "MF-PRO-D6XGEURU",
  "MF-PRO-7FJRHH86",
  "MF-PRO-PA7HKUX3",
  "MF-PRO-LN9MZE8M",
  "MF-PRO-NTUK3A4R",
  "MF-PRO-5R226W68",
  "MF-PRO-G3FUFYXK",
  "MF-PRO-Q6JQZA3U",
  "MF-PRO-XKJBTK2C",
  "MF-PRO-ABYSHUUF",
  "MF-PRO-XHTGPBQ5",
  "MF-PRO-AFKQXUKY",
  "MF-PRO-M9TGTW3W",
  "MF-PRO-KBM2Z27Z",
  "MF-PRO-Z27Y9CPF",
  "MF-PRO-AY89U4XL",
  "MF-PRO-UA55MSNP",
  "MF-PRO-T5KBLPKN",
  "MF-PRO-RJEV7NEA",
  "MF-PRO-VQNLAXN8",
  "MF-PRO-9MHAC58C",
  "MF-PRO-X68KF92J",
  "MF-PRO-G2C2AAVV",
  "MF-PRO-9XHXJF7G",
  "MF-PRO-3VVWPCLE",
  "MF-PRO-BU5R3D4J",
  "MF-PRO-YPWGUR8Z",
  "MF-PRO-QWQT524T",
  "MF-PRO-7NR8UESW",
  "MF-PRO-8QFA4W8R",
  "MF-PRO-TBNG6YLX",
  "MF-PRO-P2KEYB9K",
  "MF-PRO-F7CRVPW7",
  "MF-PRO-BYJLLC6N",
  "MF-PRO-SLFKLD95",
  "MF-PRO-2LDWEQVV",
  "MF-PRO-UYR3WGJB",
  "MF-PRO-WLG8P6XA",
  "MF-PRO-PNC8BTZ5",
  "MF-PRO-U9MW3EXS",
  "MF-PRO-FESHWDDY",
  "MF-PRO-VAYDLTEG",
  "MF-PRO-S2S75UPU",
  "MF-PRO-LAKSFUX3",
  "MF-PRO-CC444TT8",
]);

function isValidProCode(code: string): boolean {
  return VALID_PRO_CODES.has(code.toUpperCase().trim());
}

// ─── IndexedDB storage adapter for Zustand persist ───
function createIDBStorage() {
  const DB_NAME = 'moneroflow_store';
  const STORE_NAME = 'app_state';

  function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return {
    getItem: async (name: string): Promise<string | null> => {
      try {
        const db = await openDB();
        return new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).get(name);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        });
      } catch { return null; }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        const db = await openDB();
        return new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(value, name);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      } catch { /* silently fail */ }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        const db = await openDB();
        return new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(name);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      } catch { /* silently fail */ }
    },
  };
}

interface AppState {
  isAuthenticated: boolean;
  merchant: Merchant;
  invoices: Invoice[];
  subscriptions: Subscription[];
  paymentLinks: PaymentLink[];
  referrals: Referral[];
  referralPayouts: ReferralPayout[];
  posXmrMode: boolean;
  posSelectedChain: 'xmr' | 'trx';
  setPosXmrMode: (mode: boolean) => void;
  setPosSelectedChain: (chain: 'xmr' | 'trx') => void;
  login: () => void;
  logout: () => void;
  createInvoice: (description: string, fiatAmount: number, subscriptionId?: string, preGeneratedSubaddress?: string) => Promise<Invoice>;
  simulateInvoice: (description: string, fiatAmount: number) => Promise<Invoice>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  pollInvoicePayment: (invoiceId: string) => Promise<void>;
  verifyInvoiceTxHash: (invoiceId: string, txHash: string) => Promise<{ success: boolean; error?: string }>;
  verifyAllPendingInvoices: () => Promise<{ verified: number; failed: number }>;
  
  // TRX payment methods
  createTrxInvoice: (description: string, usdAmount: number, localFiatAmount?: number) => Promise<Invoice>;
  monitorTrxInvoice: (invoiceId: string) => Promise<void>;
  getTrxBalance: () => Promise<{ address: string; balanceTrx: string; balanceUsd: number }>;
  startTrxPolling: (invoiceId: string) => void;
  stopTrxPolling: (invoiceId: string) => void;
  isTrxPollingActive: (invoiceId: string) => boolean;
  
  activateProWithCode: (code: string) => Promise<boolean>;
  updateMerchant: (updates: Partial<Merchant>) => void;
  createSubscription: (sub: Omit<Subscription, 'id' | 'createdAt' | 'invoiceCount' | 'status' | 'nextBillingDate'> & { interval: Subscription['interval'] }) => Subscription;
  toggleSubscription: (id: string) => void;
  cancelSubscription: (id: string) => void;
  createPaymentLink: (slug: string, fiatAmount: number, label: string, fiatCurrency?: string) => PaymentLink;
  deletePaymentLink: (id: string) => void;
  importFromPos: () => Promise<number>;
  togglePaymentLink: (id: string) => void;
  getRpcConfig: () => RpcConfig;
  autoConnectNode: () => Promise<NodeStatus | null>;
  refreshNodeStatus: () => Promise<void>;
  restoreFromBackup: (data: any) => void;
  deleteAccount: () => void;
  activateProSubscription: (txid: string) => Promise<{ success: boolean; error?: string }>;
  checkReferralProUnlock: () => boolean;
  generateReferralFingerprint: () => string;
  // Cold wallet auto-sweep functions
  calculateCumulativeReceived: () => number;
  runSweepCheck: () => Promise<{ success: boolean; sweptAmount: number; txHash?: string; error?: string }>;
  resetSweepCounter: () => void;
}

export const useStore = create<AppState>()(persist((set, get) => ({
  isAuthenticated: false,
  merchant: defaultMerchant,
  invoices: [],
  subscriptions: [],
  paymentLinks: [],
  posInventory: [],
  referrals: [],
  referralPayouts: [],
  trxPollingIntervals: {}, // TRX polling state (not persisted)
  posXmrMode: false,
  posSelectedChain: 'xmr',

  setPosXmrMode: (mode: boolean) => set({ posXmrMode: mode }),
  setPosSelectedChain: (chain: 'xmr' | 'trx') => set({ posSelectedChain: chain }),

  login: async () => {
    set({ isAuthenticated: true });
    // Auto-provision browser wallet if none exists
    const m = get().merchant;
    if (!m.viewOnlySetupComplete || !m.viewOnlyViewKey) {
      try {
        const w = generateBrowserWallet();
        
        // Auto-generate multi-chain wallet for new users
        const multiChainWallet = await generateMultiChainWallet(24);
        
        get().updateMerchant({
          walletMode: 'viewonly',
          viewOnlyAddress: w.address,
          viewOnlyViewKey: w.viewKey,
          viewOnlySpendKey: w.spendKey,
          viewOnlyPublicSpendKey: w.publicSpendKey,
          viewOnlyPublicViewKey: w.publicViewKey,
          viewOnlySeedPhrase: w.seedPhrase,
          viewOnlySeedBackedUp: false,
          viewOnlyRestoreHeight: 0,
          viewOnlyNodeUrl: REMOTE_NODES[0].url,
          viewOnlySetupComplete: true,
          viewOnlySubaddressIndex: 1,
          nodeStatus: 'connecting',
          // Multi-chain wallet (enabled by default for new users)
          multiChainEnabled: true,
          bip39Mnemonic: multiChainWallet.bip39.mnemonic,
          bip39MnemonicBackedUp: false,
          ethAddress: multiChainWallet.ethereum.address,
          ethPrivateKey: multiChainWallet.ethereum.privateKey,
          tronAddress: multiChainWallet.tron.address,
          tronPrivateKey: multiChainWallet.tron.privateKey,
          enabledChains: ['ethereum', 'arbitrum', 'tron'],
        });
        // Generate referral fingerprint
        get().generateReferralFingerprint();
        // Auto-connect in background
        get().autoConnectNode();
      } catch (e) {
        console.error('[Store] Auto wallet generation failed:', e);
      }
    } else if (m.viewOnlySetupComplete && m.nodeStatus !== 'online') {
      get().autoConnectNode();
    }
    // Migrate existing merchants without TRON wallet
    if (m.viewOnlySetupComplete && !m.tronAddress) {
      try {
        const multiChainWallet = await generateMultiChainWallet(24);
        get().updateMerchant({
          multiChainEnabled: true,
          bip39Mnemonic: multiChainWallet.bip39.mnemonic,
          bip39MnemonicBackedUp: false,
          ethAddress: multiChainWallet.ethereum.address,
          ethPrivateKey: multiChainWallet.ethereum.privateKey,
          tronAddress: multiChainWallet.tron.address,
          tronPrivateKey: multiChainWallet.tron.privateKey,
          enabledChains: ['ethereum', 'arbitrum', 'tron'],
        });
        console.log('[Store] TRON wallet migration completed');
      } catch (e) {
        console.error('[Store] TRON wallet migration failed:', e);
      }
    }
    // Ensure referral fingerprint exists
    if (!get().merchant.referralWalletFingerprint) {
      get().generateReferralFingerprint();
    }
    // Start referral telemetry sync
    startReferralSync(get);
  },
  logout: () => {
    stopReferralSync();
    set({ isAuthenticated: false });
  },

  getRpcConfig: () => {
    const m = get().merchant;
    if (m.walletMode === 'viewonly') {
      const nodeUrl = m.connectedNodeUrl || m.viewOnlyNodeUrl || REMOTE_NODES[0].url;
      const endpoint = `https://${nodeUrl}`;
      return { endpoint, username: '', password: '', walletFilename: '' };
    }
    const endpoint = m.walletMode === 'remote'
      ? `http${m.remoteNodeSsl ? 's' : ''}://${m.remoteNodeUrl}`
      : m.rpcEndpoint;
    return {
      endpoint,
      username: m.rpcUsername,
      password: m.rpcPassword,
      walletFilename: m.rpcWalletFilename,
    };
  },

  autoConnectNode: async () => {
    const m = get().merchant;
    if (m.walletMode !== 'viewonly' && m.walletMode !== 'remote') return null;

    get().updateMerchant({ nodeStatus: 'connecting' });

    // If we have a currently configured node, try it first
    const currentUrl = m.walletMode === 'viewonly' ? m.viewOnlyNodeUrl : m.remoteNodeUrl;
    if (currentUrl) {
      const currentNode = REMOTE_NODES.find(n => n.url === currentUrl) || { label: 'Custom', url: currentUrl, ssl: true };
      const status = await testNode(currentNode, 6000);
      if (status.connected) {
        get().updateMerchant({
          connectedNodeLabel: status.label,
          connectedNodeUrl: status.url,
          nodeStatus: status.status,
          nodeHeight: status.height,
          nodeLatencyMs: status.latencyMs,
          rpcConnected: true,
        });
        return status;
      }
    }

    // Failover: find fastest available node
    const result = await findFastestNode();
    if (result) {
      const updates: Partial<Merchant> = {
        connectedNodeLabel: result.status.label,
        connectedNodeUrl: result.node.url,
        nodeStatus: result.status.status,
        nodeHeight: result.status.height,
        nodeLatencyMs: result.status.latencyMs,
        rpcConnected: true,
      };
      if (m.walletMode === 'viewonly') updates.viewOnlyNodeUrl = result.node.url;
      if (m.walletMode === 'remote') {
        updates.remoteNodeUrl = result.node.url;
        updates.remoteNodeSsl = result.node.ssl;
      }
      get().updateMerchant(updates);
      return result.status;
    }

    get().updateMerchant({ nodeStatus: 'offline', rpcConnected: false });
    return null;
  },

  refreshNodeStatus: async () => {
    const m = get().merchant;
    const nodeUrl = m.connectedNodeUrl || m.viewOnlyNodeUrl || m.remoteNodeUrl;
    if (!nodeUrl) return;

    const node = REMOTE_NODES.find(n => n.url === nodeUrl) || { label: 'Custom', url: nodeUrl, ssl: true };
    const status = await testNode(node, 6000);

    if (status.connected) {
      get().updateMerchant({
        connectedNodeLabel: status.label,
        connectedNodeUrl: status.url,
        nodeStatus: status.status,
        nodeHeight: status.height,
        nodeLatencyMs: status.latencyMs,
        rpcConnected: true,
      });
    } else {
      // Auto-failover
      const fallback = await connectWithFailover(REMOTE_NODES, nodeUrl);
      if (fallback) {
        get().updateMerchant({
          connectedNodeLabel: fallback.status.label,
          connectedNodeUrl: fallback.node.url,
          nodeStatus: fallback.status.status,
          nodeHeight: fallback.status.height,
          nodeLatencyMs: fallback.status.latencyMs,
          rpcConnected: true,
          ...(m.walletMode === 'viewonly' ? { viewOnlyNodeUrl: fallback.node.url } : {}),
          ...(m.walletMode === 'remote' ? { remoteNodeUrl: fallback.node.url, remoteNodeSsl: fallback.node.ssl } : {}),
        });
      } else {
        get().updateMerchant({ nodeStatus: 'offline', rpcConnected: false });
      }
    }
  },

  createInvoice: async (description: string, fiatAmount: number, subscriptionId?: string, preGeneratedSubaddress?: string) => {
    const m = get().merchant;
    let subaddress = '';
    let subaddressIndex: number | undefined;

    if (preGeneratedSubaddress) {
      // Use pre-generated subaddress (for payment links from URL)
      subaddress = preGeneratedSubaddress;
      // Still generate a fake index for tracking (won't be used for derivation)
      subaddressIndex = m.viewOnlySubaddressIndex || 1;
      console.log('[Store] Using pre-generated subaddress for payment link:', subaddress);
    } else if (m.walletMode === 'viewonly' && m.viewOnlySetupComplete && m.viewOnlyViewKey && m.viewOnlyPublicSpendKey) {
      // Browser Wallet mode: derive subaddress locally using real Monero crypto
      const nextIndex = m.viewOnlySubaddressIndex || 1;
      try {
        subaddress = localGenerateSubaddress(
          m.viewOnlyViewKey,
          m.viewOnlyPublicSpendKey,
          0,
          nextIndex
        );
        subaddressIndex = nextIndex;
        // Increment for next invoice
        get().updateMerchant({ viewOnlySubaddressIndex: nextIndex + 1 });
        console.log('[Store] Generated local subaddress:', subaddress, 'index:', nextIndex);
      } catch (e) {
        console.error('[Store] Local subaddress generation failed:', e);
        throw new Error('Could not generate Monero subaddress. Please re-create your browser wallet in Settings → Wallet & Node.');
      }
    } else {
      // Other modes (remote, selfcustody, managed): use RPC create_address
      const config = get().getRpcConfig();
      const failoverConfigs: RpcConfig[] = REMOTE_NODES
        .filter(n => {
          const nodeEndpoint = `https://${n.url}`;
          return nodeEndpoint !== config.endpoint;
        })
        .slice(0, 2)
        .map(n => ({
          endpoint: `https://${n.url}`,
          username: '',
          password: '',
          walletFilename: '',
        }));

      try {
        const result = await createValidatedSubaddress(config, `Invoice: ${description}`, failoverConfigs);
        subaddress = result.address;
        subaddressIndex = result.addressIndex;
      } catch (e) {
        console.error('Failed to create validated subaddress:', e);
        throw new Error('Could not generate valid Monero address. Please try again or switch node in Settings → Wallet & Node.');
      }
    }

    // Fetch live rates for conversion
    let xmrAmount: number;
    try {
      const rates = await getRates();
      xmrAmount = Math.ceil(fiatToXmr(fiatAmount, m.fiatCurrency || 'USD', rates) * 1e6) / 1e6;
    } catch {
      // Fallback to stale cache
      const stale = getStaleCache();
      if (stale) {
        xmrAmount = Math.ceil(fiatToXmr(fiatAmount, m.fiatCurrency || 'USD', stale) * 1e6) / 1e6;
      } else {
        throw new Error('Could not fetch exchange rates. Please check your internet connection.');
      }
    }

    const invoice: Invoice = {
      id: 'inv_' + Math.random().toString(36).slice(2, 8),
      fiatAmount,
      fiatCurrency: m.fiatCurrency || 'USD',
      xmrAmount,
      subaddress,
      subaddressIndex,
      status: 'pending',
      confirmations: 0,
      createdAt: new Date().toISOString(),
      description,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      subscriptionId,
      createdBy: m.activePosUser || 'admin',
    };
    set(state => ({ invoices: [invoice, ...state.invoices] }));
    return invoice;
  },

  simulateInvoice: async (description: string, fiatAmount: number) => {
    const m = get().merchant;
    let xmrAmount: number;
    try {
      const rates = await getRates();
      xmrAmount = Math.ceil(fiatToXmr(fiatAmount, m.fiatCurrency || 'USD', rates) * 1e6) / 1e6;
    } catch {
      const stale = getStaleCache();
      xmrAmount = stale ? Math.ceil(fiatToXmr(fiatAmount, m.fiatCurrency || 'USD', stale) * 1e6) / 1e6 : 0.001;
    }

    const fakeTxHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const invoice: Invoice = {
      id: 'inv_' + Math.random().toString(36).slice(2, 8),
      fiatAmount,
      fiatCurrency: m.fiatCurrency || 'USD',
      xmrAmount,
      subaddress: m.viewOnlyAddress || '4' + 'x'.repeat(93),
      status: 'paid',
      confirmations: 10,
      createdAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
      description,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      txid: fakeTxHash,
      simulated: true,
      createdBy: 'admin',
    };
    set(state => ({ invoices: [invoice, ...state.invoices] }));
    return invoice;
  },

  updateInvoice: (id: string, updates: Partial<Invoice>) => {
    set(state => ({
      invoices: state.invoices.map(inv =>
        inv.id === id ? { ...inv, ...updates } : inv
      ),
    }));
  },

  pollInvoicePayment: async (invoiceId: string) => {
    const state = get();
    const invoice = state.invoices.find(i => i.id === invoiceId);
    if (!invoice || invoice.status === 'paid' || invoice.status === 'expired') return;

    if (new Date(invoice.expiresAt).getTime() < Date.now()) {
      get().updateInvoice(invoiceId, { status: 'expired' });
      return;
    }

    const m = get().merchant;
    const requiredConfs = m.requiredConfirmations ?? 1;
    const isZeroConfEligible = m.zeroConfEnabled && invoice.fiatAmount <= (m.zeroConfThresholdUsd || 30);

    // Helper to process found payment data
    const processPayment = (totalReceivedXmr: number, confirmations: number, txid: string) => {
      const expectedXmr = invoice.xmrAmount;
      let newStatus: Invoice['status'];

      if (totalReceivedXmr >= expectedXmr * 0.95) {
        if (isZeroConfEligible && confirmations === 0) {
          newStatus = 'paid';
        } else if (confirmations >= requiredConfs) {
          newStatus = 'paid';
        } else if (confirmations >= 1) {
          newStatus = 'confirming';
        } else {
          newStatus = 'seen_on_chain';
        }
        if (totalReceivedXmr > expectedXmr * 1.05 && confirmations >= requiredConfs) newStatus = 'overpaid';
      } else if (totalReceivedXmr > 0) {
        newStatus = 'underpaid';
      } else {
        return; // nothing received
      }

      const wasPaid = invoice.status === 'paid';
      get().updateInvoice(invoiceId, {
        status: newStatus,
        confirmations,
        txid,
        paidAt: newStatus === 'paid' && !wasPaid ? new Date().toISOString() : invoice.paidAt,
      });

      // Fire webhook on payment confirmation
      if (newStatus === 'paid' && !wasPaid && m.webhookPaymentUrl) {
        fetch(m.webhookPaymentUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'payment.confirmed',
            invoiceId, txid,
            amount: invoice.xmrAmount,
            fiatAmount: invoice.fiatAmount,
            fiatCurrency: invoice.fiatCurrency,
            confirmations,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
      }
    };

    // ── Strategy 1: Block Explorer scan (works for ALL wallet modes) ──
    // Use the subaddress + private view key to scan recent blocks via public explorer
    if (m.viewOnlyViewKey && invoice.subaddress) {
      try {
        console.log(`[Poll] Explorer scan for invoice ${invoiceId} → ${invoice.subaddress.slice(0, 12)}...`);
        const outputs = await scanRecentOutputs(invoice.subaddress, m.viewOnlyViewKey, 10);
        
        if (outputs.length > 0) {
          const totalPico = outputs.reduce((sum, o) => sum + o.amount, 0);
          const totalXmr = totalPico / 1e12;
          const bestConf = Math.max(...outputs.map(o => o.confirmations));
          const primaryTxHash = outputs[0].txHash;
          console.log(`[Poll] Explorer found ${outputs.length} output(s), total: ${totalXmr} XMR, confs: ${bestConf}`);
          processPayment(totalXmr, bestConf, primaryTxHash);
          return;
        }
      } catch (e) {
        console.warn('[Poll] Explorer scan failed, trying RPC fallback:', e);
      }
    }

    // ── Strategy 2: If we have a known txid (from manual entry), verify it ──
    if (invoice.txid && m.viewOnlyViewKey) {
      try {
        const result = await verifyTxOutputs(invoice.txid, invoice.subaddress, m.viewOnlyViewKey);
        if (result && result.matched) {
          processPayment(result.totalAmount / 1e12, result.confirmations, invoice.txid);
          return;
        }
      } catch (e) {
        console.warn('[Poll] TX verify failed:', e);
      }
    }

    // ── Strategy 3: Wallet RPC (for managed/remote/selfcustody modes with real wallet-rpc) ──
    if (m.walletMode !== 'viewonly' && invoice.subaddressIndex !== undefined) {
      const config = get().getRpcConfig();
      try {
        const transfers = await getTransfers(config, [invoice.subaddressIndex]);
        const incoming = [...transfers.in, ...transfers.pending].filter(
          t => t.subaddrIndex.minor === invoice.subaddressIndex
        );
        if (incoming.length > 0) {
          const totalReceived = incoming.reduce((sum, t) => sum + t.amount, 0);
          processPayment(totalReceived / 1e12, incoming[0].confirmations || 0, incoming[0].txid);
          return;
        }
      } catch (e) {
        console.error('[Poll] RPC polling error:', e);
      }
    }

    console.log(`[Poll] No payment found yet for invoice ${invoiceId}`);
  },

  verifyInvoiceTxHash: async (invoiceId: string, txHash: string) => {
    const state = get();
    const invoice = state.invoices.find(i => i.id === invoiceId);
    if (!invoice) return { success: false, error: 'Invoice not found' };

    const m = state.merchant;
    const cleanHash = txHash.trim();

    if (!/^[a-fA-F0-9]{64}$/.test(cleanHash)) {
      return { success: false, error: 'Invalid TX hash format. Must be 64 hex characters.' };
    }

    // First, save the txid so future polls can verify it
    get().updateInvoice(invoiceId, { txid: cleanHash });

    // Try to verify via explorer
    if (m.viewOnlyViewKey && invoice.subaddress) {
      try {
        const result = await verifyTxOutputs(cleanHash, invoice.subaddress, m.viewOnlyViewKey);
        if (result) {
          if (result.matched) {
            const totalXmr = result.totalAmount / 1e12;
            const requiredConfs = m.requiredConfirmations ?? 1;
            const isZeroConf = m.zeroConfEnabled && invoice.fiatAmount <= (m.zeroConfThresholdUsd || 30);
            
            let status: Invoice['status'] = 'seen_on_chain';
            if (totalXmr >= invoice.xmrAmount * 0.95) {
              if (isZeroConf || result.confirmations >= requiredConfs) {
                status = 'paid';
              } else if (result.confirmations >= 1) {
                status = 'confirming';
              }
            } else if (totalXmr > 0) {
              status = 'underpaid';
            }

            get().updateInvoice(invoiceId, {
              status,
              confirmations: result.confirmations,
              txid: cleanHash,
              paidAt: status === 'paid' ? new Date().toISOString() : undefined,
            });

            return { success: true };
          }
          return { success: false, error: 'TX found but no outputs match this payment address. Wrong transaction?' };
        }
      } catch (e) {
        console.warn('[VerifyTX] Explorer verification failed:', e);
      }
    }

    // Fallback: just mark as seen if we can't verify (will continue polling)
    get().updateInvoice(invoiceId, { txid: cleanHash, status: 'seen_on_chain' });
    return { success: true };
  },

  verifyAllPendingInvoices: async () => {
    const state = get();
    const m = state.merchant;
    if (!m.viewOnlyViewKey) return { verified: 0, failed: 0 };
    
    const pendingInvoices = state.invoices.filter(
      i => i.status === 'pending' || i.status === 'seen_on_chain' || i.status === 'confirming'
    );
    
    let verified = 0;
    let failed = 0;
    
    for (const inv of pendingInvoices) {
      // If invoice has a txid, verify it directly
      if (inv.txid) {
        try {
          const result = await verifyTxOutputs(inv.txid, inv.subaddress, m.viewOnlyViewKey);
          if (result && result.matched) {
            const totalXmr = result.totalAmount / 1e12;
            const requiredConfs = m.requiredConfirmations ?? 1;
            const isZeroConf = m.zeroConfEnabled && inv.fiatAmount <= (m.zeroConfThresholdUsd || 30);
            
            let status: Invoice['status'] = 'seen_on_chain';
            if (totalXmr >= inv.xmrAmount * 0.95) {
              if (isZeroConf || result.confirmations >= requiredConfs) {
                status = 'paid';
              } else if (result.confirmations >= 1) {
                status = 'confirming';
              }
            } else if (totalXmr > 0) {
              status = 'underpaid';
            }
            
            get().updateInvoice(inv.id, {
              status,
              confirmations: result.confirmations,
              paidAt: status === 'paid' && !inv.paidAt ? new Date().toISOString() : inv.paidAt,
            });
            verified++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }
      
      // Check if expired
      if (!inv.txid && new Date(inv.expiresAt).getTime() < Date.now()) {
        get().updateInvoice(inv.id, { status: 'expired' });
      }
    }
    
    return { verified, failed };
  },

  // ─── USDT-TRC20 Payment Methods ───

  createTrxInvoice: async (description: string, usdAmount: number, localFiatAmount?: number) => {
    const state = get();
    const merchant = state.merchant;

    if (!merchant.tronAddress) {
      throw new Error('TRX wallet not found. Enable multi-chain wallet in settings.');
    }

    try {
      // Use USDT payment manager (1:1 pegged to USD)
      // usdAmount is in USD (same as USDT), localFiatAmount is in merchant's local currency
      const manager = getUsdtPaymentManager();
      const invoice: Partial<Invoice> = await manager.createUsdtInvoice(
        merchant.tronAddress,
        usdAmount,
        merchant.fiatCurrency,
        description
      );

      // Override fiatAmount with the local fiat amount for correct display in invoices tab
      if (localFiatAmount !== undefined) {
        invoice.fiatAmount = localFiatAmount;
      }

      // Add to state
      set((prev) => ({
        invoices: [...prev.invoices, invoice as Invoice],
      }));

      return invoice as Invoice;
    } catch (error) {
      console.error('[Store] Failed to create USDT invoice:', error);
      throw error;
    }
  },

  monitorTrxInvoice: async (invoiceId: string) => {
    const state = get();
    const invoice = state.invoices.find(i => i.id === invoiceId);

    if (!invoice || invoice.chainType !== 'trx') {
      return;
    }

    try {
      // Use USDT payment manager
      const manager = getUsdtPaymentManager();
      const updated = await manager.monitorUsdtInvoice(invoice);
      
      // Update invoice in state
      get().updateInvoice(invoiceId, updated);
    } catch (error) {
      console.error(`[Store] Failed to monitor TRX invoice ${invoiceId}:`, error);
    }
  },

  getTrxBalance: async () => {
    const state = get();
    const merchant = state.merchant;
    
    if (!merchant.tronAddress) {
      return { address: '', balanceTrx: '0', balanceUsd: 0 };
    }
    
    try {
      const manager = getTrxPaymentManager();
      return await manager.getMerchantBalance(merchant.tronAddress);
    } catch (error) {
      console.error('[Store] Failed to get TRX balance:', error);
      return { address: merchant.tronAddress, balanceTrx: '0', balanceUsd: 0 };
    }
  },

  startTrxPolling: (invoiceId: string) => {
    const state = get();
    
    if (state.trxPollingIntervals[invoiceId]) {
      return; // Already polling
    }
    
    // Check every 10 seconds (Tron has fast block times: 3 seconds)
    const interval = setInterval(() => {
      get().monitorTrxInvoice(invoiceId);
    }, 10000);
    
    set((prev) => ({
      trxPollingIntervals: {
        ...prev.trxPollingIntervals,
        [invoiceId]: interval,
      },
    }));
    
    console.log(`[Store] Started TRX polling for invoice ${invoiceId}`);
  },

  stopTrxPolling: (invoiceId: string) => {
    const state = get();
    const interval = state.trxPollingIntervals[invoiceId];
    
    if (interval) {
      clearInterval(interval);
      set((prev) => {
        const newIntervals = { ...prev.trxPollingIntervals };
        delete newIntervals[invoiceId];
        return { trxPollingIntervals: newIntervals };
      });
      console.log(`[Store] Stopped TRX polling for invoice ${invoiceId}`);
    }
  },

  isTrxPollingActive: (invoiceId: string) => {
    return !!get().trxPollingIntervals[invoiceId];
  },

  activateProWithCode: async (code: string): Promise<boolean> => {
    const upperCode = code.toUpperCase().trim();

    // Quick local guard — already redeemed on this browser
    const redeemedCodes: string[] = JSON.parse(localStorage.getItem('mf_redeemed_codes') || '[]');
    if (redeemedCodes.includes(upperCode)) return false;

    // Must be in the hardcoded allowlist
    if (!isValidProCode(upperCode)) return false;

    // --- Server-side validation (prevents cross-browser reuse) ---
    try {
      const valResp = await fetch(`https://${CREATOR_SERVER_FQDN}/api/mf/codes/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: upperCode }),
      });
      if (valResp.ok) {
        const valData = await valResp.json();
        if (!valData.valid) return false; // Server says already used or not found
      }
      // If server validates, redeem it server-side
      await fetch(`https://${CREATOR_SERVER_FQDN}/api/mf/codes/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: upperCode, redeemedBy: get().merchant.referralWalletFingerprint || 'unknown' }),
      });
    } catch {
      // Server unreachable — fall through to local-only validation (offline mode)
      console.warn('[Store] Creator server unreachable, using local-only code validation');
    }

    // Mark as redeemed locally
    redeemedCodes.push(upperCode);
    localStorage.setItem('mf_redeemed_codes', JSON.stringify(redeemedCodes));

    // Activate lifetime pro
    get().updateMerchant({
      plan: 'pro',
      proStatus: 'pro',
      proActivatedAt: new Date().toISOString(),
      proExpiresAt: '',
      proTxid: `LIFETIME-CODE-${upperCode}`,
    });

    return true;
  },

  updateMerchant: (updates: Partial<Merchant>) => {
    set(state => ({ merchant: { ...state.merchant, ...updates } }));
  },

  createSubscription: (data) => {
    const nextDate = new Date();
    if (data.interval === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
    else nextDate.setMonth(nextDate.getMonth() + 1);
    const sub: Subscription = {
      id: 'sub_' + Math.random().toString(36).slice(2, 8),
      customerEmail: data.customerEmail,
      description: data.description,
      fiatAmount: data.fiatAmount,
      fiatCurrency: data.fiatCurrency,
      interval: data.interval,
      status: 'active',
      nextBillingDate: nextDate.toISOString(),
      createdAt: new Date().toISOString(),
      invoiceCount: 0,
    };
    set(state => ({ subscriptions: [sub, ...state.subscriptions] }));
    return sub;
  },

  toggleSubscription: (id: string) => {
    set(state => ({
      subscriptions: state.subscriptions.map(s =>
        s.id === id ? { ...s, status: (s.status === 'active' ? 'paused' : 'active') as Subscription['status'] } : s
      ),
    }));
  },

  cancelSubscription: (id: string) => {
    set(state => ({
      subscriptions: state.subscriptions.map(s =>
        s.id === id ? { ...s, status: 'cancelled' as const } : s
      ),
    }));
  },

  createPaymentLink: (slug: string, fiatAmount: number, label: string, fiatCurrency?: string, chainType: 'xmr' | 'trx' = 'xmr') => {
    const merchant = get().merchant;
    
    // Use appropriate address based on chain type
    let subaddress = '';
    if (chainType === 'xmr') {
      subaddress = merchant.viewOnlyAddress || merchant.primarySubaddress || '';
    } else if (chainType === 'trx') {
      if (!merchant.tronAddress) {
        throw new Error('TRX wallet not enabled. Enable multi-chain wallet in Settings.');
      }
      subaddress = merchant.tronAddress;
    }

    // Generate unique identifier to avoid clashes across users on same domain
    const uniqueId = Math.random().toString(36).slice(2, 12);

    const link: PaymentLink = {
      id: `pl_${Math.random().toString(36).slice(2, 8)}`,
      slug,
      fiatAmount,
      fiatCurrency: fiatCurrency || merchant.fiatCurrency || 'USD',
      label,
      subaddress,
      uniqueId,
      createdAt: new Date().toISOString(),
      totalUses: 0,
      active: true,
      chainType,
      trxAddress: chainType === 'trx' ? subaddress : undefined,
      ethAddress: chainType === 'eth' ? subaddress : undefined,
    };
    set(state => ({ paymentLinks: [link, ...state.paymentLinks] }));
    return link;
  },

  deletePaymentLink: (id: string) => {
    set(state => ({ paymentLinks: state.paymentLinks.filter(l => l.id !== id) }));
  },

  importFromPos: async () => {
    const merchant = get().merchant;
    const posItems = merchant.posQuickButtons || [];

    if (posItems.length === 0) {
      throw new Error('No POS inventory items found. Add items to the POS terminal first.');
    }

    let imported = 0;
    const existingSlugs = new Set(get().paymentLinks.map((l) => l.slug));

    for (const item of posItems) {
      const baseSlug = item.label.toLowerCase().replace(/[^a-z0-9-]/g, '-') + `-${item.price}`;

      // Create XMR link — chainType is 5th parameter
      const xmrSlug = `${baseSlug}-xmr`;
      if (!existingSlugs.has(xmrSlug)) {
        await get().createPaymentLink(
          xmrSlug,
          item.price,
          item.label,
          merchant.fiatCurrency || 'USD',
          'xmr'
        );
        imported += 1;
        existingSlugs.add(xmrSlug);
      }

      // Create TRX/USDT link — chainType is 5th parameter
      const trxSlug = `${baseSlug}-trx`;
      if (!existingSlugs.has(trxSlug)) {
        try {
          await get().createPaymentLink(
            trxSlug,
            item.price,
            item.label,
            merchant.fiatCurrency || 'USD',
            'trx'
          );
          imported += 1;
          existingSlugs.add(trxSlug);
        } catch (e) {
          // TRX wallet might not be set up — skip TRX link but continue with others
          console.warn(`[Import] Skipped TRX link for "${item.label}": ${(e as Error).message}`);
        }
      }
    }

    return imported;
  },

  togglePaymentLink: (id: string) => {
    set(state => ({
      paymentLinks: state.paymentLinks.map((l) =>
        l.id === id ? { ...l, active: !l.active } : l
      ),
    }));
  },

  restoreFromBackup: (data: any) => {
    const updates: any = {};
    if (data.merchant) {
      updates.merchant = normalizeMerchantSubscription({ ...defaultMerchant, ...data.merchant });
    }
    if (data.invoices) updates.invoices = data.invoices;
    if (data.subscriptions) updates.subscriptions = data.subscriptions;
    if (data.paymentLinks) updates.paymentLinks = data.paymentLinks;
    if (data.referrals) updates.referrals = data.referrals;
    if (data.referralPayouts) updates.referralPayouts = data.referralPayouts;
    if (typeof data.isAuthenticated === 'boolean') updates.isAuthenticated = data.isAuthenticated;
    // Clear cached rates so fresh rates are fetched after restore
    try { localStorage.removeItem('moneroflow_currency_cache'); } catch {}
    set(updates);
  },

  deleteAccount: () => {
    stopReferralSync();
    set({
      isAuthenticated: false,
      merchant: defaultMerchant,
      invoices: [],
      subscriptions: [],
      paymentLinks: [],
      referrals: [],
      referralPayouts: [],
    });
    try { indexedDB.deleteDatabase('moneroflow_store'); } catch {}
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    document.cookie.split(';').forEach(c => {
      document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
    });
  },

  generateReferralFingerprint: () => {
    const m = get().merchant;
    if (m.referralWalletFingerprint) return m.referralWalletFingerprint;
    // Generate from wallet address or random
    const source = m.viewOnlyAddress || m.id || Math.random().toString(36);
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
    }
    const fingerprint = Math.abs(hash).toString(36).slice(0, 8).toUpperCase();
    get().updateMerchant({ referralWalletFingerprint: fingerprint, referralCode: fingerprint });
    return fingerprint;
  },

  activateProSubscription: async (txid: string) => {
    const cleanTxid = txid.trim().toLowerCase();
    if (!/^[a-fA-F0-9]{64}$/i.test(cleanTxid)) {
      return { success: false, error: 'Invalid TX hash. Must be exactly 64 hex characters.' };
    }

    // Check if TX hash was already used
    const usedKey = 'mf_used_pro_txids';
    const usedRaw = localStorage.getItem(usedKey);
    const usedHashes: string[] = usedRaw ? JSON.parse(usedRaw) : [];
    if (usedHashes.includes(cleanTxid)) {
      return { success: false, error: 'This TX hash has already been used for a Pro activation.' };
    }

    // Verify TX on blockchain via block explorer
    const txInfo = await getTxInfo(cleanTxid);
    if (!txInfo) {
      return { success: false, error: 'TX not found on the blockchain. Please check the hash and try again.' };
    }
    if (txInfo.confirmations < 1) {
      return { success: false, error: 'TX needs at least 1 block confirmation. Please wait a few minutes and try again.' };
    }

    // Check TX is recent (within 24 hours)
    const now = Math.floor(Date.now() / 1000);
    const txAge = now - txInfo.timestamp;
    const twentyFourHours = 24 * 60 * 60;
    if (txInfo.timestamp > 0 && txAge > twentyFourHours) {
      return { success: false, error: 'TX is older than 24 hours. Please send a new payment.' };
    }

    // Verify TX outputs go to the treasury address using view key
    let destinationVerified = false;
    try {
      const outputCheck = await verifyTxOutputs(cleanTxid, CREATOR_TREASURY_ADDRESS, CREATOR_TREASURY_VIEW_KEY);
      if (outputCheck) {
        if (!outputCheck.matched || outputCheck.totalAmount <= 0) {
          return { success: false, error: 'Payment not sent to the treasury address. Please send to the correct address.' };
        }
        // Amount is in piconero (1 XMR = 1e12 piconero)
        const requiredPiconero = PRO_MONTHLY_XMR * 1e12;
        if (outputCheck.totalAmount < requiredPiconero) {
          const receivedXmr = (outputCheck.totalAmount / 1e12).toFixed(6);
          return { success: false, error: `Payment amount too low: ${receivedXmr} XMR received, ${PRO_MONTHLY_XMR} XMR required.` };
        }
        destinationVerified = true;
        console.log(`[Pro] TX verified: ${(outputCheck.totalAmount / 1e12).toFixed(6)} XMR to treasury, ${outputCheck.confirmations} confirmations`);
      } else {
        console.warn('[Pro] Could not verify TX outputs via explorer — falling back to basic check');
      }
    } catch (e) {
      console.warn('[Pro] Output verification failed, falling back to basic check:', e);
    }

    if (!destinationVerified) {
      console.warn('[Pro] Destination not verified (view key may be public, not private). Accepting TX based on existence + confirmation.');
    }

    // All checks passed — activate Pro
    usedHashes.push(cleanTxid);
    localStorage.setItem(usedKey, JSON.stringify(usedHashes));

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    get().updateMerchant({
      plan: 'pro',
      proStatus: 'pro',
      proTxid: cleanTxid,
      proActivatedAt: new Date().toISOString(),
      proExpiresAt: expiresAt.toISOString(),
    });

    return { success: true };
  },

  checkReferralProUnlock: () => {
    const m = get().merchant;
    const activeRefs = get().referrals.filter(r => r.level === 1).length;
    const bypass = m.devBypassReferrals;
    if ((bypass || activeRefs >= PRO_REFERRAL_UNLOCK_COUNT) && !m.proUnlockedViaReferrals) {
      get().updateMerchant({
        plan: 'pro',
        proStatus: 'pro_referral',
        proUnlockedViaReferrals: true,
        proExpiresAt: '', // never expires
      });
      return true;
    }
    return false;
  },

  // ─── Cold Wallet Auto-Sweep Functions ───

  /**
   * Calculate cumulative received XMR from all paid invoices.
   * Excludes sent transactions (withdrawals) and already swept amounts.
   */
  calculateCumulativeReceived: () => {
    const state = get();
    const paidReceived = state.invoices
      .filter((inv) => inv.status === 'paid' && inv.type !== 'sent')
      .reduce((sum, inv) => sum + inv.xmrAmount, 0);

    return paidReceived;
  },

  /**
   * Run a sweep check and execute if real wallet balance exceeds threshold.
   * Returns success status, swept amount, tx hash (if successful), or error.
   */
  runSweepCheck: async () => {
    const { merchant } = get();

    if (!merchant.autoSweepEnabled || !merchant.coldWalletAddress) {
      return { success: false, sweptAmount: 0, error: 'Auto-sweep not enabled or no cold wallet address' };
    }

    if (!merchant.viewOnlySetupComplete || !merchant.viewOnlySeedPhrase) {
      return { success: false, sweptAmount: 0, error: 'Wallet not set up for spending' };
    }

    const alreadySwept = merchant.totalSweptXmr || 0;
    const threshold = merchant.autoSweepThreshold || 0.5;

    try {
      const { checkWalletBalance, sendViaDaemonProxy, SyncProgress } = await import('./wallet-send');
      const nodeUrl = merchant.connectedNodeUrl || merchant.viewOnlyNodeUrl || 'xmr-node.cakewallet.com:18081';

      get().updateMerchant({ activeSweepFlag: true, activeSweepMessage: 'Checking wallet balance...' });

      console.log(`[SweepCheck] Checking real wallet balance against threshold: ${threshold} XMR`);

      // Check real on-chain wallet balance (with optimized restore height)
      const balanceResult = await checkWalletBalance(
        merchant.viewOnlySeedPhrase,
        nodeUrl,
        merchant.viewOnlyAddress,
        merchant.viewOnlyViewKey,
        (progress: SyncProgress) => {
          get().updateMerchant({ activeSweepMessage: progress.message });
        },
      );

      const realUnlockedBalance = balanceResult.unlockedBalance;

      // Only sweep if REAL balance exceeds threshold
      if (realUnlockedBalance < threshold) {
        get().updateMerchant({ activeSweepFlag: false, activeSweepMessage: '' });
        console.log(`[SweepCheck] Balance ${realUnlockedBalance.toFixed(6)} XMR below threshold ${threshold} XMR - skipping sweep`);
        return {
          success: false,
          sweptAmount: 0,
          error: `Wallet balance below threshold. Threshold: ${threshold} XMR`,
        };
      }

      if (realUnlockedBalance < 0.001) {
        get().updateMerchant({ activeSweepFlag: false, activeSweepMessage: '' });
        return {
          success: false,
          sweptAmount: 0,
          error: `Balance too small to sweep`,
        };
      }

      // Estimate fee (use a small percentage of balance to be safe)
      const estimatedFee = Math.max(0.0001, realUnlockedBalance * 0.002);
      const amountToSweep = Math.max(0, realUnlockedBalance - estimatedFee);

      if (amountToSweep < 0.0001) {
        get().updateMerchant({ activeSweepFlag: false, activeSweepMessage: '' });
        return {
          success: false,
          sweptAmount: 0,
          error: `Balance too low after estimated fee`,
        };
      }

      get().updateMerchant({ activeSweepMessage: `Sweeping to cold wallet...` });
      console.log(`[SweepCheck] Real balance: ${realUnlockedBalance.toFixed(6)} XMR > threshold: ${threshold} XMR - Sweeping: ${amountToSweep.toFixed(6)} XMR`);

      // Sweep the entire real wallet balance (minus estimated fees)
      const sendResult = await sendViaDaemonProxy(
        merchant.viewOnlySeedPhrase,
        nodeUrl,
        {
          recipientAddress: merchant.coldWalletAddress,
          amountXmr: amountToSweep,
          priority: 1,
          note: 'Auto-sweep to cold wallet',
        },
        (progress: SyncProgress) => {
          get().updateMerchant({ activeSweepMessage: progress.message });
        },
      );

      if (sendResult.success && sendResult.txHash) {
        get().updateMerchant({
          totalSweptXmr: alreadySwept + amountToSweep,
          lastSweepDate: new Date().toISOString(),
          activeSweepFlag: false,
          activeSweepMessage: '',
        });

        // Add sweep transaction to payments history as a sent payment
        const state = get();
        const fiatCurrency = merchant.fiatCurrency || 'USD';

        let fiatAmount = 0;
        try {
          const { getRates, xmrToFiat } = await import('./currency-service');
          const rates = await getRates();
          fiatAmount = xmrToFiat(amountToSweep, fiatCurrency, rates);
        } catch (err) {
          console.warn('[SweepCheck] Could not fetch conversion rates:', err);
        }

        const sweepInvoice: Invoice = {
          id: `sweep_${Date.now()}`,
          fiatAmount,
          fiatCurrency,
          xmrAmount: amountToSweep,
          subaddress: '',
          status: 'paid',
          confirmations: 0,
          createdAt: new Date().toISOString(),
          paidAt: new Date().toISOString(),
          description: `Auto-sweep to cold wallet`,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          txid: sendResult.txHash,
          type: 'sent',
          createdBy: 'admin',
          recipientAddress: merchant.coldWalletAddress,
          feeXmr: sendResult.fee || estimatedFee,
          note: `Auto-sweep to cold wallet`,
        };
        set({ invoices: [sweepInvoice, ...state.invoices] });

        console.log(`[SweepCheck] Success — txHash: ${sendResult.txHash}, fee: ${sendResult.fee}`);

        return {
          success: true,
          sweptAmount: amountToSweep,
          txHash: sendResult.txHash,
          fee: sendResult.fee,
        };
      } else {
        get().updateMerchant({ activeSweepFlag: false, activeSweepMessage: '' });
        return { success: false, sweptAmount: 0, error: sendResult.error || 'Sweep transaction failed' };
      }
    } catch (err: any) {
      get().updateMerchant({ activeSweepFlag: false, activeSweepMessage: '' });
      console.error('[SweepCheck] Failed:', err);
      return { success: false, sweptAmount: 0, error: err?.message || 'Sweep failed unexpectedly' };
    }
  },

  /**
   * Reset sweep counter (for testing or manual override).
   */
  resetSweepCounter: () => {
    get().updateMerchant({
      totalSweptXmr: 0,
      lastSweepDate: null,
    });
  },
}), {
  name: 'moneroflow-state',
  version: 2,
  storage: createJSONStorage(() => createIDBStorage()),
  partialize: (state) => ({
    isAuthenticated: state.isAuthenticated,
    merchant: state.merchant,
    invoices: state.invoices,
    subscriptions: state.subscriptions,
    paymentLinks: state.paymentLinks,
    referrals: state.referrals,
    referralPayouts: state.referralPayouts,
    posXmrMode: state.posXmrMode,
    posSelectedChain: state.posSelectedChain,
  }),
  migrate: (persistedState: any, version: number) => {
    // Ensure sendMode defaults to 'proxy' for legacy storage
    if (persistedState.merchant && typeof persistedState.merchant.sendMode === 'undefined') {
      persistedState.merchant.sendMode = 'proxy';
    }
    return persistedState;
  },
}));
