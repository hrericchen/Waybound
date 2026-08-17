import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { Linking } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { revenueCatService, OFFERING_IDS } from '../services/revenueCatService';
import { communityService } from '../services/communityService';
import RevenueCatUI from 'react-native-purchases-ui';
import { posthog } from '../config/posthog';
import storageService from '../services/storageService';
import { getFirebaseAuth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import PaywallModal from '../components/PaywallModal';

type RevenueCatContextType = {
  isPro: boolean;
  isMini: boolean;
  subscriptionTier: 'pro' | 'mini' | 'free';
  isLoading: boolean;
  isInitialized: boolean;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<CustomerInfo | null>;
  restorePurchases: () => Promise<void>;
  refreshCustomerInfo: () => Promise<void>;
  /**
   * Present a paywall. Defaults to the "upgrade button" offering. Pass
   * OFFERING_IDS.intro / OFFERING_IDS.randomShowup for those triggers.
   */
  presentPaywall: (offeringId?: string) => Promise<void>;
  manageSubscription: () => Promise<void>;
};

const RevenueCatContext = createContext<RevenueCatContextType>({} as RevenueCatContextType);

export const useRevenueCat = () => useContext(RevenueCatContext);

export const RevenueCatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPro, setIsPro] = useState(false);
  const [isMini, setIsMini] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'pro' | 'mini' | 'free'>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
  const [isInitialized, setIsInitialized] = useState(false); // Track init completion
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallOffering, setPaywallOffering] = useState<PurchasesOffering | null>(null);

  useEffect(() => {
    initRevenueCat();
    checkAdminPro();
  }, []);

  // Bind RevenueCat entitlements to the SIGNED-IN account (not the device).
  // Without this, a purchase/pro state follows the device's anonymous
  // RevenueCat ID, so a brand-new account on the same device would wrongly
  // inherit the previous account's subscription.
  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), async (fbUser) => {
      try {
        if (fbUser) {
          await Purchases.logIn(fbUser.uid);
        } else {
          await Purchases.logOut();
        }
      } catch (e) {
        console.warn('[RevenueCat] Account switch failed:', e);
      }
      // Re-evaluate entitlements for THIS account (preserving admin pro).
      try {
        const info = await revenueCatService.getCustomerInfo();
        const stored = await storageService.load(storageService.STORAGE_KEYS.USER);
        let remote = null;
        if (fbUser) {
          try { remote = await communityService.getUser(fbUser.uid); } catch (e) {}
        }
        const isAdmin = !!((stored?.id === fbUser?.uid && stored?.isAdmin) || remote?.isAdmin);
        // Admin-granted Pro/Mini (written by the Grant Pro / Grant Mini buttons).
        // Note: grantedPro is a distinct field from the informational isPro that
        // gets synced from RevenueCat purchases, so cancelled subscribers can't
        // stay Pro forever.
        const grantedPro = !!remote?.grantedPro;
        const grantedMini = !!remote?.grantedMini || !!remote?.isMini;
        const rcPro = !!(info?.entitlements?.active?.[revenueCatService.ENTITLEMENT_ID]);
        const rcMini = !!(info?.entitlements?.active?.[revenueCatService.MINI_ENTITLEMENT_ID]);
        const hasPro = isAdmin || rcPro || grantedPro;
        const hasMini = grantedMini || (rcMini && !hasPro);
        setIsPro(hasPro);
        setIsMini(hasMini);
        setSubscriptionTier(hasPro ? 'pro' : hasMini ? 'mini' : 'free');
        if (info) setCustomerInfo(info);
      } catch (e) {
        console.warn('[RevenueCat] Failed to refresh entitlements:', e);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAdminPro = async () => {
    const user = await storageService.load(storageService.STORAGE_KEYS.USER);

    // Consult Firestore so server-side admin status and admin-granted
    // Pro/Mini flags are honored on every device.
    // NOTE: only admins and ADMIN-GRANTED pro count as permanent pro. Regular
    // subscribers' pro comes from RevenueCat entitlements in initRevenueCat,
    // which expire automatically when they cancel — so we never read a
    // persisted isPro flag back as proof (grantedPro is the explicit grant).
    let isRemoteAdmin = !!user?.isAdmin;
    let isRemoteGrantedPro = false;
    let isRemoteGrantedMini = false;
    if (user?.id) {
      try {
        const remote = await communityService.getUser(user.id);
        if (remote) {
          if (remote.isAdmin) isRemoteAdmin = true;
          isRemoteGrantedPro = !!remote.grantedPro;
          isRemoteGrantedMini = !!remote.grantedMini || !!remote.isMini;
          if (remote.tag && !user.tag) user.tag = remote.tag;
          if (isRemoteAdmin) {
            user.isAdmin = true;
            await storageService.save(storageService.STORAGE_KEYS.USER, user);
          }
        }
      } catch (e) {
        console.warn('[RevenueCat] Failed to fetch remote admin status:', e);
      }
    }

    if (isRemoteAdmin || isRemoteGrantedPro) {
      setIsPro(true);
      setSubscriptionTier('pro');
    } else if (user && user.isPro) {
      // Clear a stale locally-persisted pro flag left over from an older build so a
      // cancelled subscriber doesn't keep pro forever.
      user.isPro = false;
      await storageService.save(storageService.STORAGE_KEYS.USER, user);
    }

    // Honor an admin-granted Mini flag stored on the user's Firestore doc.
    if (!(isRemoteAdmin || isRemoteGrantedPro) && isRemoteGrantedMini) {
      setIsMini(true);
      setSubscriptionTier('mini');
    }
  };

  /** Persist the user's pro status to Firestore so it's saved on the server. */
  const saveProStatusToServer = async (isProVal: boolean) => {
    // Informational only - pro derives from RevenueCat entitlements (which expire
    // when the subscription ends) or from being an admin. Never persist isPro as
    // permanent, so cancelled subscribers don't keep pro forever.
    const user = await storageService.load(storageService.STORAGE_KEYS.USER);
    if (user?.id) {
      await communityService.updateUserStatus(user.id, { isPro: isProVal });
    }
  };

  const initRevenueCat = async () => {
    try {
      await revenueCatService.init();
      const info = await revenueCatService.getCustomerInfo();
      if (info && info.entitlements && info.entitlements.active) {
        setCustomerInfo(info);
        const hasPro = info.entitlements.active[revenueCatService.ENTITLEMENT_ID] !== undefined;
        const hasMini = info.entitlements.active[revenueCatService.MINI_ENTITLEMENT_ID] !== undefined;
        setIsPro(hasPro);
        setIsMini(hasMini);
        setSubscriptionTier(hasPro ? 'pro' : hasMini ? 'mini' : 'free');
      }
      const offering = await revenueCatService.getOfferings();
      if (offering) {
        setCurrentOffering(offering);
      }
    } catch (e) {
      console.error('[RevenueCat] Init failed:', e);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  };

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    setIsLoading(true);
    try {
      const info = await revenueCatService.purchasePackage(pkg);
      if (info && info.entitlements && info.entitlements.active) {
        setCustomerInfo(info);
        const hasProEntitlement = info.entitlements.active[revenueCatService.ENTITLEMENT_ID] !== undefined;
        const hasMiniEntitlement = info.entitlements.active[revenueCatService.MINI_ENTITLEMENT_ID] !== undefined;
        setIsPro(hasProEntitlement);
        setIsMini(hasMiniEntitlement);
        setSubscriptionTier(hasProEntitlement ? 'pro' : hasMiniEntitlement ? 'mini' : 'free');
        if (hasProEntitlement) {
          posthog?.capture('subscription_purchased');
          await saveProStatusToServer(true);
        }
      }
      return info;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    setIsLoading(true);
    try {
      const info = await revenueCatService.restorePurchases();
      if (info && info.entitlements && info.entitlements.active) {
        setCustomerInfo(info);
        const hasProEntitlement = info.entitlements.active[revenueCatService.ENTITLEMENT_ID] !== undefined;
        const hasMiniEntitlement = info.entitlements.active[revenueCatService.MINI_ENTITLEMENT_ID] !== undefined;
        setIsPro(hasProEntitlement);
        setIsMini(hasMiniEntitlement);
        setSubscriptionTier(hasProEntitlement ? 'pro' : hasMiniEntitlement ? 'mini' : 'free');
        if (hasProEntitlement) {
          posthog?.capture('subscription_restored');
          await saveProStatusToServer(true);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshCustomerInfo = useCallback(async () => {
    const info = await revenueCatService.getCustomerInfo();
    if (info && info.entitlements && info.entitlements.active) {
      setCustomerInfo(info);
      const hasPro = info.entitlements.active[revenueCatService.ENTITLEMENT_ID] !== undefined;
      const hasMini = info.entitlements.active[revenueCatService.MINI_ENTITLEMENT_ID] !== undefined;
      setIsPro(hasPro);
      setIsMini(hasMini);
      setSubscriptionTier(hasPro ? 'pro' : hasMini ? 'mini' : 'free');
      if (hasPro) {
        await saveProStatusToServer(true);
      }
    }
  }, []);

  const handlePresentPaywall = useCallback(
    async (offeringId?: string) => {
      posthog?.capture('paywall_presented', { offering_id: offeringId || 'default' });
      // Resolve the offering for this trigger: upgrade button by default,
      // intro / random showup when explicitly requested.
      let offering = currentOffering;
      if (offeringId && offering?.identifier !== offeringId) {
        try {
          offering = await revenueCatService.getOfferingById(offeringId);
        } catch (e) {
          console.warn('[RevenueCat] Failed to load offering:', e);
          offering = currentOffering;
        }
      }
      // Prefer RevenueCat's own paywall UI so the paywalls configured in the
      // dashboard (intro / random showup / upgrade button) are shown exactly as
      // designed — including multi-page survey templates. presentPaywall only
      // resolves once the user dismisses it, so the full paywall runs without
      // being interrupted by any fallback.
      if (offering && offering.availablePackages && offering.availablePackages.length > 0) {
        try {
          await RevenueCatUI.presentPaywall({ offering, displayCloseButton: true });
          await refreshCustomerInfo();
          return;
        } catch (e) {
          console.warn('[RevenueCat] Native paywall unavailable, using in-app modal:', e);
        }
      }
      // Fallback: in-app modal (also used while offerings are still loading).
      setPaywallOffering(offering || currentOffering);
      setPaywallVisible(true);
    },
    [currentOffering, refreshCustomerInfo]
  );

  const handleClosePaywall = useCallback(() => {
    setPaywallVisible(false);
  }, []);

  // Purchase a package from the custom paywall. Returns true on success so the
  // modal knows to close itself.
  const handlePurchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    const info = await purchasePackage(pkg);
    if (info) {
      await refreshCustomerInfo();
      return true;
    }
    return false;
  }, [purchasePackage, refreshCustomerInfo]);

  // Restore purchases from the custom paywall.
  const handleRestorePurchases = useCallback(async () => {
    await restorePurchases();
    await refreshCustomerInfo();
  }, [restorePurchases, refreshCustomerInfo]);

  const handleManageSubscription = useCallback(async () => {
    try {
      posthog?.capture('manage_subscription');
      // On Android, open Google Play subscription management directly
      if (Platform.OS === 'android') {
        // Try RevenueCat management URL first
        try {
          const url = await revenueCatService.getManagementURL();
          if (url) {
            await Linking.openURL(url);
            return;
          }
        } catch (e) {
          console.warn('[RevenueCat] Management URL fallback:', e);
        }
        // Fallback: open Google Play subscriptions page for the app
        const playStoreUrl = 'https://play.google.com/store/account/subscriptions?package=com.waybound.travel';
        await Linking.openURL(playStoreUrl);
        return;
      }
      // On iOS, present the paywall which supports management
      await RevenueCatUI.presentPaywall({
        offering: currentOffering || undefined,
      });
      await refreshCustomerInfo();
    } catch (e) {
      console.error('[RevenueCat] Subscription management failed:', e);
      // Final fallback
      try {
        const url = await revenueCatService.getManagementURL();
        if (url) {
          Linking.openURL(url);
        }
      } catch (e2) {
        console.error('[RevenueCat] Management URL final fallback failed:', e2);
      }
    }
  }, [currentOffering, refreshCustomerInfo]);

  return (
    <RevenueCatContext.Provider
      value={{
        isPro,
        isMini,
        subscriptionTier,
        isLoading,
        isInitialized,
        customerInfo,
        currentOffering,
        purchasePackage,
        restorePurchases,
        refreshCustomerInfo,
        presentPaywall: handlePresentPaywall,
        manageSubscription: handleManageSubscription,
      }}
    >
      {children}
      <PaywallModal
        visible={paywallVisible}
        onClose={handleClosePaywall}
        offerings={paywallOffering || currentOffering}
        isPro={isPro}
        isLoading={isLoading}
        onPurchase={handlePurchasePackage}
        onRestore={handleRestorePurchases}
      />
    </RevenueCatContext.Provider>
  );
};