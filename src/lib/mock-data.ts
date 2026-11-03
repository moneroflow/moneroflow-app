// XMR exchange rate — in production, fetch from a live API (e.g. CoinGecko)
export const XMR_USD_RATE = 167.42;
export const TRX_USD_RATE = 0.12;

export interface Invoice {
  id: string;
  fiatAmount: number;
  fiatCurrency: string;
  xmrAmount: number;
  subaddress: string;
  subaddressIndex?: number;
  status: 'pending' | 'seen_on_chain' | 'confirming' | 'paid' | 'underpaid' | 'overpaid' | 'expired';
  confirmations?: number;
  createdAt: string;
  paidAt?: string;
  description: string;
  expiresAt: string;
  subscriptionId?: string;
  txid?: string;
  txKey?: string;
  customerNote?: string;
  cartId?: string;
  createdBy?: string; // user id or 'admin'
  simulated?: boolean;
  type?: 'received' | 'sent'; // Track direction of payment
  recipientAddress?: string; // For sent payments
  feeTier?: string; // Fee tier used for sent payments
  feeXmr?: number; // Fee amount for sent payments
  note?: string; // Optional note for sent payments

  // Multi-chain support
  chainType?: 'xmr' | 'eth' | 'trx' | 'arb';
  
  // TRX-specific fields
  trxAddress?: string;
  trxAmount?: number;
  trxTxID?: string;
  trxConfirmations?: number;
  
  // ETH/ARB-specific fields
  ethAddress?: string;
  ethAmount?: number;
  ethTxHash?: string;
  ethConfirmations?: number;
}

export interface PosQuickButton {
  id: string;
  label: string;
  price: number;
  category: string;
  color: string;
  stock?: number;
  icon?: string;
}

export interface PosModifier {
  id: string;
  name: string;
  options: { label: string; priceAdj: number }[];
}

export interface PosCombo {
  id: string;
  name: string;
  itemIds: string[];
  discount: number;
  price: number;
}

export interface ParkedOrder {
  id: string;
  label: string;
  items: { name: string; price: number; qty: number; modifiers?: string[] }[];
  total: number;
  parkedAt: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  modifiers?: string[];
  modifierTotal?: number;
}

export interface Merchant {
  id: string;
  name: string;
  email: string;
  primarySubaddress: string;
  settlementAddress: string;
  webhookUrl: string;
  custodyMode: 'managed' | 'self-sovereign';
  plan: 'free' | 'pro';
  apiKey: string;
  createdAt: string;
  autoSweepEnabled: boolean;
  autoSweepThreshold: number;
  autoSweepCheckFrequency: number; // Minutes between wallet balance checks
  coldWalletAddress: string;
  fiatHedgePercent: number;
  privacyModeEnabled: boolean;
  privacyPassphrase: string;
  privacyBackupEmail: string;
  referralCode: string;
  referralsEnabled: boolean;
  walletMode: 'managed' | 'remote' | 'selfcustody' | 'viewonly';
  remoteNodeUrl: string;
  remoteNodeSsl: boolean;
  nativeRpcEnabled: boolean;
  rpcEndpoint: string;
  rpcUsername: string;
  rpcPassword: string;
  rpcWalletFilename: string;
  rpcConnected: boolean;
  // Localization
  fiatCurrency: string;
  fiatSymbol: string;
  // View-only wallet fields
  viewOnlyAddress: string;
  viewOnlyViewKey: string;
  viewOnlyRestoreHeight: number;
  viewOnlyNodeUrl: string;
  viewOnlySetupComplete: boolean;
  viewOnlySeedPhrase: string;
  viewOnlySeedBackedUp: boolean;
  viewOnlySubaddressIndex: number;
  viewOnlySpendKey: string;
  viewOnlyPublicSpendKey: string;
  viewOnlyPublicViewKey: string;
  // Multi-chain wallet fields (optional - backward compatible)
  multiChainEnabled?: boolean;
  // BIP-39 wallet for multi-chain (Ethereum, Tron, Arbitrum)
  bip39Mnemonic?: string; // 24-word seed phrase
  bip39MnemonicBackedUp?: boolean;
  // Ethereum / Arbitrum (same key, different chain)
  ethAddress?: string; // 0x-prefixed, 42 chars
  ethPrivateKey?: string; // 0x-prefixed hex
  // Tron (different key)
  tronAddress?: string; // Base58, 34 chars
  tronPrivateKey?: string; // hex
  // Multi-chain preferences
  enabledChains?: ('ethereum' | 'arbitrum' | 'tron')[];
  // Node connection state
  connectedNodeLabel: string;
  connectedNodeUrl: string;
  nodeStatus: 'online' | 'syncing' | 'offline' | 'connecting';
  nodeHeight: number;
  nodeLatencyMs: number;
  // PoS Pro features
  posQuickButtons: PosQuickButton[];
  posCategories: string[];
  // Domain
  fqdn: string;
  // PoS Elite features
  posModifiers: PosModifier[];
  posCombos: PosCombo[];
  posFavorites: string[];
  parkedOrders: ParkedOrder[];
  // Admin & Users
  adminPasswordHash: string;
  posUsers: PosUser[];
  activePosUser: string; // user id or '' for admin
  // Pro Subscription (on-chain)
  proStatus: 'free' | 'pro' | 'pro_referral';
  proExpiresAt: string;
  proTxid: string;
  proPaymentId: string;
  proActivatedAt: string;
  // Referral tracking
  referralWalletFingerprint: string; // first 8 chars of wallet address hash
  referredBy: string; // referrer's fingerprint
  referralActiveCount: number; // active referred merchants count
  proUnlockedViaReferrals: boolean;
  referralEarningsXmr: number;
  referralEarningsPendingXmr: number;
  // Payment confirmation settings
  requiredConfirmations: number; // default 1 for retail
  zeroConfEnabled: boolean; // auto-approve 0-conf for small amounts
  zeroConfThresholdUsd: number; // max USD amount for 0-conf (default $30)
  webhookPaymentUrl: string; // webhook fired on payment confirmation
  preferredFeeTier: 'normal' | 'fast' | 'urgent'; // default fee tier to display
  // Send mode
  sendMode: 'proxy' | 'wasm'; // Daemon Proxy (default) or Full WASM
  // Autonomous node switching (Cake-Wallet-style background health monitor)
  autoNodeSwitchEnabled: boolean; // periodic health probe + auto rotate
  autoNodeSwitchIntervalMin: number; // minutes between health probes (default 0.5)
  // Admin auth session timeout (minutes) — how long a verified admin password stays valid
  adminAuthTimeoutMin: number;
  // Treasury / Creator server (creatorServerFqdn removed — hardcoded as CREATOR_SERVER_FQDN)
  lifetimeProCodes: { code: string; createdAt: string; usedBy?: string }[];
  devBypassReferrals: boolean;
  // Cold Wallet Auto-Sweep tracking
  cumulativeReceivedXmr: number; // Total received (not yet swept)
  totalSweptXmr: number; // Total swept to cold wallet
  lastSweepDate: string | null; // Timestamp of last successful sweep
  activeSweepFlag: boolean; // Show sweeping banner when true
  activeSweepMessage: string; // Current sweep step message to display
}

// Pro subscription constants
export const PRO_MONTHLY_XMR = 0.05;
export const PRO_REFERRAL_UNLOCK_COUNT = 10;
export const CREATOR_TREASURY_ADDRESS = '49C9ZpMch9s3jsjobTuPK7RRy7s5rbqjz6MfCWDCQEXpAkDUvKwrktAdc7apj39jNZY2ewvk7NmMLQPszgvMo6U9VpKf1R7';
export const CREATOR_TREASURY_VIEW_KEY = '4317ee72671dabdad9737fd314a8aab981e5a929cf59938bddcbf1a5244eaaff';
export const REFERRAL_ECOSYSTEM_PERCENT = 50; // 50% of pro-sub goes back to referrers
export const CREATOR_SERVER_FQDN = 'moneroflow.depincloud.net'; // Hardcoded — never changes, even in forks

export interface PosUser {
  id: string;
  name: string;
  pin: string;
  createdAt: string;
  role: 'cashier';
}

export interface Referral {
  id: string;
  username: string;
  level: number;
  joinedAt: string;
  monthlyCommission: number;
}

export interface ReferralPayout {
  id: string;
  date: string;
  xmrAmount: number;
  referralCount: number;
  status: 'paid' | 'pending';
}

export interface Subscription {
  id: string;
  customerEmail: string;
  description: string;
  fiatAmount: number;
  fiatCurrency: string;
  interval: 'weekly' | 'monthly';
  status: 'active' | 'paused' | 'cancelled';
  nextBillingDate: string;
  createdAt: string;
  invoiceCount: number;
}

export interface PaymentLink {
  id: string;
  slug: string;
  fiatAmount: number;
  fiatCurrency: string;
  label: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  subaddress: string; // Reusable subaddress for this product
  uniqueId: string; // Unique identifier for URL to avoid cross-user clashes
  createdAt: string;
  totalUses: number;
  active: boolean;

  // Multi-chain support
  chainType?: 'xmr' | 'eth' | 'trx' | 'arb';

  // TRX-specific
  trxAddress?: string;

  // ETH/ARB-specific
  ethAddress?: string;
}

// Default merchant — empty, no mock data
export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso' },
  { code: 'CLP', symbol: 'CL$', name: 'Chilean Peso' },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
  { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev' },
  { code: 'HRK', symbol: 'kn', name: 'Croatian Kuna' },
  { code: 'ISK', symbol: 'kr', name: 'Icelandic Króna' },
];

export const defaultMerchant: Merchant = {
  id: '',
  name: '',
  email: '',
  primarySubaddress: '',
  settlementAddress: '',
  webhookUrl: '',
  custodyMode: 'managed',
  plan: 'free',
  apiKey: '',
  createdAt: new Date().toISOString(),
  autoSweepEnabled: false,
  autoSweepThreshold: 0.5,
  autoSweepCheckFrequency: 240, // 4 hours in minutes
  coldWalletAddress: '',
  fiatHedgePercent: 0,
  privacyModeEnabled: false,
  privacyPassphrase: '',
  privacyBackupEmail: '',
  referralCode: '',
  referralsEnabled: false,
  walletMode: 'viewonly',
  remoteNodeUrl: '',
  remoteNodeSsl: false,
  nativeRpcEnabled: true,
  rpcEndpoint: 'http://127.0.0.1:18082',
  rpcUsername: '',
  rpcPassword: '',
  rpcWalletFilename: '',
  rpcConnected: false,
  fiatCurrency: 'USD',
  fiatSymbol: '$',
  viewOnlyAddress: '',
  viewOnlyViewKey: '',
  viewOnlyRestoreHeight: 0,
  viewOnlyNodeUrl: '',
  viewOnlySetupComplete: false,
  viewOnlySeedPhrase: '',
  viewOnlySeedBackedUp: false,
  viewOnlySubaddressIndex: 1,
  viewOnlySpendKey: '',
  viewOnlyPublicSpendKey: '',
  viewOnlyPublicViewKey: '',
  connectedNodeLabel: '',
  connectedNodeUrl: '',
  nodeStatus: 'offline',
  nodeHeight: 0,
  nodeLatencyMs: 0,
  posQuickButtons: [],
  posCategories: ['Food', 'Drinks', 'Services', 'Products'],
  fqdn: '',
  posModifiers: [],
  posCombos: [],
  posFavorites: [],
  parkedOrders: [],
  adminPasswordHash: '',
  posUsers: [],
  activePosUser: '',
  proStatus: 'free',
  proExpiresAt: '',
  proTxid: '',
  proPaymentId: '',
  proActivatedAt: '',
  referralWalletFingerprint: '',
  referredBy: '',
  referralActiveCount: 0,
  proUnlockedViaReferrals: false,
  referralEarningsXmr: 0,
  referralEarningsPendingXmr: 0,
  requiredConfirmations: 1,
  zeroConfEnabled: true,
  zeroConfThresholdUsd: 30,
  webhookPaymentUrl: '',
  preferredFeeTier: 'normal',
  sendMode: 'proxy',
  autoNodeSwitchEnabled: true,
  autoNodeSwitchIntervalMin: 0.5,
  adminAuthTimeoutMin: 30,
  lifetimeProCodes: [],
  devBypassReferrals: false,
  cumulativeReceivedXmr: 0,
  totalSweptXmr: 0,
  lastSweepDate: null,
  activeSweepFlag: false,
  activeSweepMessage: '',
};

export const formatXMR = (amount: number) => amount.toFixed(6) + ' XMR';
export const formatUSDT = (amount: number) => amount.toFixed(2) + ' USDT';
export const formatUSD = (amount: number) => '$' + amount.toFixed(2);
export const formatFiat = (amount: number, symbol: string = '$', code: string = 'USD') => {
  if (code === 'JPY') return symbol + Math.round(amount).toLocaleString();
  return symbol + amount.toFixed(2);
};
export const usdToXmr = (usd: number) => usd / XMR_USD_RATE;
export const usdToTrx = (usd: number) => usd / TRX_USD_RATE; export const trxToUsd = (trx: number) => trx * TRX_USD_RATE;
