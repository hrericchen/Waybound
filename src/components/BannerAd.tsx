import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd as GAMBanner, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useRevenueCat } from '../context/RevenueCatContext';

// Always use test ads in dev, real ads in production
const BANNER_AD_ID = __DEV__
  ? TestIds.BANNER
  : Platform.OS === 'ios' 
    ? 'ca-app-pub-7167949082841776/8919986781'
    : 'ca-app-pub-7167949082841776/8919986781';

const BannerAdComponent: React.FC = () => {
  const { isPro } = useRevenueCat();

  // Pro users see no ads
  if (isPro) return null;

  return (
    <View style={styles.container}>
      <GAMBanner
        unitId={BANNER_AD_ID}
        size={BannerAdSize.BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => console.log('[BannerAd] Loaded')}
        onAdFailedToLoad={(error) => {
          console.warn('[BannerAd] Failed to load:', error.message);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
});

export default BannerAdComponent;