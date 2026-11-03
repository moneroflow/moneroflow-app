import type { Merchant } from './mock-data';

export function isMerchantPro(merchant: Merchant): boolean {
  return merchant.plan === 'pro'
    || merchant.proStatus === 'pro'
    || merchant.proStatus === 'pro_referral'
    || merchant.proUnlockedViaReferrals;
}

export function normalizeMerchantSubscription(merchant: Merchant): Merchant {
  const pro = isMerchantPro(merchant);

  return {
    ...merchant,
    plan: pro ? 'pro' : 'free',
    proStatus: pro
      ? (merchant.proStatus === 'pro_referral' || merchant.proUnlockedViaReferrals ? 'pro_referral' : 'pro')
      : 'free',
  };
}