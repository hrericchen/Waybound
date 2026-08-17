import { Platform } from 'react-native';
import mobileAds, {
  BannerAdSize,
  InterstitialAd,
  RewardedAd,
  TestIds,
  AdEventType,
  RewardedAdEventType,
  MaxAdContentRating,
  AdsConsent,
  AdsConsentStatus,
} from 'react-native-google-mobile-ads';
import { requestTrackingPermission } from 'react-native-tracking-transparency';
import storageService from './storageService';
import { revenueCatService } from './revenueCatService';

const AD_UNITS = {
  ios: {
    banner: 'ca-app-pub-7167949082841776/8919986781',
    interstitial: 'ca-app-pub-7167949082841776/2083794310',
    rewarded: 'ca-app-pub-7167949082841776/2887709713',
  },
  android: {
    banner: 'ca-app-pub-7167949082841776/8919986781',
    interstitial: 'ca-app-pub-7167949082841776/2083794310',
    rewarded: 'ca-app-pub-7167949082841776/2887709713',
  },
};

const getAdUnitId = (type: 'banner' | 'interstitial' | 'rewarded'): string => {
  if (__DEV__) {
    switch (type) {
      case 'banner':
        return TestIds.BANNER;
      case 'interstitial':
        return TestIds.INTERSTITIAL;
      case 'rewarded':
        return TestIds.REWARDED;
    }
  }
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  return AD_UNITS[platform][type];
};

const INTERSTITIAL_COUNT_KEY = 'INTERSTITIAL_TRIP_VIEW_COUNT';

export const adService = {
  async init(): Promise<void> {
    try {
      // iOS: request App Tracking Transparency authorization BEFORE initializing
      // the ads SDK so it knows whether personalized ads are allowed. No-op on
      // Android (returns 'unavailable'). Requires NSUserTrackingUsageDescription
      // in Info.plist (already set in app.json).
      if (Platform.OS === 'ios') {
        try {
          await requestTrackingPermission();
        } catch (e) {
          console.warn('[AdMob] ATT request failed:', e);
        }
      }

      // GDPR / EEA + regulated US states: check consent via Google UMP. The GMA
      // SDK reads the stored consent automatically and serves personalized or
      // non-personalized ads accordingly. Requires consent forms configured in
      // the AdMob dashboard (Privacy & messaging -> GDPR / US states).
      try {
        const consentInfo = await AdsConsent.requestInfoUpdate();
        if (consentInfo.status === AdsConsentStatus.REQUIRED) {
          await AdsConsent.showForm();
        }
      } catch (e) {
        console.warn('[AdMob] Consent flow failed:', e);
      }

      await mobileAds().initialize();
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.MA,
      });
      console.log('[AdMob] Initialized');
    } catch (e) {
      console.error('[AdMob] Init failed:', e);
    }
  },

  getBannerAdUnitId(): string {
    return getAdUnitId('banner');
  },

  getBannerSize(): BannerAdSize {
    return BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
  },

  async shouldShowInterstitial(): Promise<boolean> {
    try {
      const isPro = await revenueCatService.isPro();
      if (isPro) return false;
      const isMini = await revenueCatService.isMini();
      if (isMini) return false;

      const currentCount = (await storageService.load(INTERSTITIAL_COUNT_KEY)) || 0;
      const newCount = currentCount + 1;
      await storageService.save(INTERSTITIAL_COUNT_KEY, newCount);

      return newCount % 5 === 0;
    } catch {
      return false;
    }
  },

  async showInterstitial(): Promise<boolean> {
    try {
      const isPro = await revenueCatService.isPro();
      if (isPro) return false;
      const isMini = await revenueCatService.isMini();
      if (isMini) return false;

      const interstitial = InterstitialAd.createForAdRequest(getAdUnitId('interstitial'), {
        requestNonPersonalizedAdsOnly: false,
      });

      await interstitial.load();

      return new Promise((resolve) => {
        const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
          interstitial.show();
        });

        const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
          unsubscribeLoaded();
          unsubscribeClosed();
          resolve(true);
        });

        const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
          console.warn('[AdMob] Interstitial error:', error);
          unsubscribeLoaded();
          unsubscribeClosed();
          unsubscribeError();
          resolve(false);
        });

        setTimeout(() => {
          unsubscribeLoaded();
          unsubscribeClosed();
          unsubscribeError();
          resolve(false);
        }, 60000);
      });
    } catch (e) {
      console.error('[AdMob] Interstitial failed:', e);
      return false;
    }
  },

  async showRewardedAd(): Promise<boolean> {
    try {
      const rewarded = RewardedAd.createForAdRequest(getAdUnitId('rewarded'), {
        requestNonPersonalizedAdsOnly: false,
      });

      await rewarded.load();

      return new Promise((resolve) => {
        // Track whether reward was earned; CLOSED without EARNED = user dismissed early
        let rewardEarned = false;

        const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
          rewarded.show();
        });

        const unsubscribeEarned = rewarded.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD,
          () => {
            console.log('[AdMob] User earned reward!');
            rewardEarned = true;
            // Don't resolve yet — wait for CLOSED to clean up listeners
          }
        );

        const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
          unsubscribeLoaded();
          unsubscribeEarned();
          unsubscribeClosed();
          unsubscribeError();
          if (rewardEarned) {
            resolve(true);
          } else {
            console.log('[AdMob] Rewarded ad closed without completing');
            resolve(false);
          }
        });

        const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
          console.warn('[AdMob] Rewarded error:', error);
          unsubscribeLoaded();
          unsubscribeEarned();
          unsubscribeClosed();
          unsubscribeError();
          rewardEarned = false;
          resolve(false);
        });

        setTimeout(() => {
          unsubscribeLoaded();
          unsubscribeEarned();
          unsubscribeClosed();
          unsubscribeError();
          if (!rewardEarned) {
            resolve(false);
          }
        }, 60000);
      });
    } catch (e) {
      console.error('[AdMob] Rewarded ad failed:', e);
      return false;
    }
  },
};