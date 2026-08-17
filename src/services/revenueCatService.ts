import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering, PurchasesPackage, LOG_LEVEL } from 'react-native-purchases';

const REVENUECAT_API_KEY = Platform.select({
  ios: 'goog_EZYTyVumwTvgPHYEdinMikEDSWL',
  android: 'goog_EZYTyVumwTvgPHYEdinMikEDSWL',
  default: 'goog_EZYTyVumwTvgPHYEdinMikEDSWL',
});

const ENTITLEMENT_ID = 'Waybound Pro';
const MINI_ENTITLEMENT_ID = 'Waybound Mini';

/**
 * Offering identifiers for each paywall trigger.
 * ⚠️ Make sure these EXACTLY match the offering identifiers in your
 * RevenueCat dashboard (lowercase, underscores). If one isn't found, the
 * current/default offering is used instead, so nothing breaks.
 */
export const OFFERING_IDS = {
  /** The one-time "intro" paywall shown right after onboarding. */
  intro: 'intro',
  /** The paywall that shows up randomly ~1-2x per week. */
  randomShowup: 'random_showup',
  /** The paywall shown when tapping an Upgrade button. */
  upgrade: 'upgrade_button',
};

export const revenueCatService = {
  /** Initialize RevenueCat SDK — call once at app startup */
  async init(): Promise<void> {
    try {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      console.log('[RevenueCat] Initialized');
    } catch (e) {
      console.error('[RevenueCat] Init failed:', e);
    }
  },

  /** Get current customer info (entitlements, subscription status) */
  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      return await Purchases.getCustomerInfo();
    } catch (e) {
      console.error('[RevenueCat] getCustomerInfo failed:', e);
      return null;
    }
  },

  /** Check if user has the "Waybound Pro" entitlement */
  async isPro(): Promise<boolean> {
    try {
      const info = await Purchases.getCustomerInfo();
      return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (e) {
      console.error('[RevenueCat] isPro check failed:', e);
      return false;
    }
  },

  /** Check if user has the "Waybound Mini" entitlement */
  async isMini(): Promise<boolean> {
    try {
      const info = await Purchases.getCustomerInfo();
      return info.entitlements.active[MINI_ENTITLEMENT_ID] !== undefined;
    } catch (e) {
      console.error('[RevenueCat] isMini check failed:', e);
      return false;
    }
  },

  /** Get the user's subscription tier: 'pro' | 'mini' | 'free' */
  async getSubscriptionTier(): Promise<'pro' | 'mini' | 'free'> {
    try {
      const info = await Purchases.getCustomerInfo();
      if (info.entitlements.active[ENTITLEMENT_ID] !== undefined) return 'pro';
      if (info.entitlements.active[MINI_ENTITLEMENT_ID] !== undefined) return 'mini';
      return 'free';
    } catch (e) {
      console.error('[RevenueCat] getSubscriptionTier failed:', e);
      return 'free';
    }
  },

  /** Fetch available offerings (subscription plans) */
  async getOfferings(): Promise<PurchasesOffering | null> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current || null;
    } catch (e) {
      console.error('[RevenueCat] getOfferings failed:', e);
      return null;
    }
  },

  /** Fetch a specific offering by identifier (falls back to the current offering). */
  async getOfferingById(identifier: string): Promise<PurchasesOffering | null> {
    try {
      const offerings = await Purchases.getOfferings();
      const all = (offerings as any).all || {};
      return all[identifier] || offerings.current || null;
    } catch (e) {
      console.error('[RevenueCat] getOfferingById failed:', e);
      return null;
    }
  },

  /** Purchase a specific package */
  async purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      console.log('[RevenueCat] Purchase success:', customerInfo.entitlements.active);
      return customerInfo;
    } catch (e: any) {
      if (!e.userCancelled) {
        console.error('[RevenueCat] Purchase failed:', e);
      }
      return null;
    }
  },

  /** Restore previous purchases */
  async restorePurchases(): Promise<CustomerInfo | null> {
    try {
      return await Purchases.restorePurchases();
    } catch (e) {
      console.error('[RevenueCat] restorePurchases failed:', e);
      return null;
    }
  },

  /** Get management URL for subscription changes/cancellation */
  async getManagementURL(): Promise<string | null> {
    try {
      const info = await Purchases.getCustomerInfo();
      return (info as any).managementURL || null;
    } catch (e) {
      console.error('[RevenueCat] getManagementURL failed:', e);
      return null;
    }
  },

  ENTITLEMENT_ID,
  MINI_ENTITLEMENT_ID,
};
