import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { Icon } from './Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';

type PaywallModalProps = {
  visible: boolean;
  onClose: () => void;
  offerings: PurchasesOffering | null;
  isPro: boolean;
  isLoading: boolean;
  onPurchase: (pkg: PurchasesPackage) => Promise<boolean>;
  onRestore: () => Promise<void>;
};

const FEATURES = [
  'Export trips as PDF, ICS, CSV & PNG cards',
  'Unlimited itineraries',
  'Add collaborators to plan together',
  '170+ currencies in Exchange Rates',
  'No ads',
];

const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  offerings,
  isPro,
  isLoading,
  onPurchase,
  onRestore,
}) => {
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const packages = offerings?.availablePackages || [];

  const handlePurchase = async (pkg: PurchasesPackage) => {
    if (purchasingId) return;
    setPurchasingId(pkg.identifier);
    const success = await onPurchase(pkg);
    setPurchasingId(null);
    if (success) {
      onClose();
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    await onRestore();
    setRestoring(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.headerGradient}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="close" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerKicker}>WAYBOUND</Text>
          <Text style={styles.headerTitle}>Upgrade to Pro</Text>
          <Text style={styles.headerSubtitle}>Unlock the full travel planning experience</Text>
        </LinearGradient>

        <View style={styles.sheet}>
          {isPro ? (
            <View style={styles.alreadyPro}>
              <Icon name="check" size={40} color={colors.success} />
              <Text style={styles.alreadyProText}>You're already a Pro member!</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <View style={styles.featuresList}>
                {FEATURES.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <Icon name="check" size={18} color={colors.success} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {isLoading && packages.length === 0 ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
              ) : (
                <View style={styles.packagesList}>
                  {packages.map((pkg) => {
                    const isBuying = purchasingId === pkg.identifier;
                    const title = pkg.product?.title || pkg.identifier;
                    const price = pkg.product?.priceString || '';
                    return (
                      <TouchableOpacity
                        key={pkg.identifier}
                        style={[styles.packageBtn, isBuying && styles.packageBtnDisabled]}
                        activeOpacity={0.85}
                        onPress={() => handlePurchase(pkg)}
                        disabled={!!purchasingId}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.packageTitle}>{title}</Text>
                          {pkg.product?.description ? (
                            <Text style={styles.packageDesc} numberOfLines={1}>
                              {pkg.product.description}
                            </Text>
                          ) : null}
                        </View>
                        {isBuying ? (
                          <ActivityIndicator color={colors.white} size="small" />
                        ) : (
                          <Text style={styles.packagePrice}>{price}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={restoring}>
                {restoring ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={styles.restoreText}>Restore Purchases</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.termsText}>
                Payment will be charged to your account. Subscriptions auto-renew until cancelled.
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};



const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  headerGradient: {
    paddingTop: 54,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: spacing.xl,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerKicker: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  headerTitle: { color: colors.white, fontSize: 30, fontWeight: '800', marginTop: 4 },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  sheet: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingTop: spacing.xl,
  },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  featuresList: { gap: 12, marginBottom: spacing.xl },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { color: '#1A1A2E', fontSize: 15, fontWeight: '600', flex: 1 },
  packagesList: { gap: 12 },
  packageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    ...shadows.card,
  },
  packageBtnDisabled: { opacity: 0.7 },
  packageTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  packageDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  packagePrice: { color: colors.white, fontSize: 16, fontWeight: '800' },
  restoreBtn: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.lg },
  restoreText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  termsText: { color: '#6B7280', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  alreadyPro: { alignItems: 'center', justifyContent: 'center', paddingTop: 40, gap: 12 },
  alreadyProText: { color: '#1A1A2E', fontSize: 18, fontWeight: '700' },
  doneBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: radius.full,
  },
  doneBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});

export default PaywallModal;
