import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import exchangeRateService, { ExchangeRates } from '../services/exchangeRateService';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
};

const ExchangeRatesScreen: React.FC = () => {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [amount, setAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  
  const insets = useSafeAreaInsets();
  const theme = useContext(ThemeContext);

  useEffect(() => {
    loadRates();
  }, []);

  useEffect(() => {
    convertCurrency();
  }, [amount, fromCurrency, toCurrency, rates]);

  const loadRates = async () => {
    const fetchedRates = await exchangeRateService.getCachedRates();
    setRates(fetchedRates);
    if (fetchedRates.lastUpdated) {
      setLastUpdated(new Date(fetchedRates.lastUpdated).toLocaleString());
    }
  };

  const convertCurrency = async () => {
    if (!amount || isNaN(parseFloat(amount))) {
      setConvertedAmount(null);
      return;
    }

    const result = await exchangeRateService.convert(
      parseFloat(amount),
      fromCurrency,
      toCurrency
    );
    setConvertedAmount(result);
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const currencies = rates ? Object.keys(rates.rates).sort() : ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];

  const formatCurrency = (value: number, currency: string) => {
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    return `${symbol}${value.toFixed(2)}`;
  };

  const renderCurrencyPicker = (selected: string, onSelect: (c: string) => void, visible: boolean, onClose: () => void) => {
    if (!visible) return null;
    return (
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={onClose}>
          <View style={[styles.currencyPicker, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>Select Currency</Text>
            {currencies.map((currency) => (
              <TouchableOpacity
                key={currency}
                style={[styles.currencyOption, { backgroundColor: selected === currency ? colors.primary + '20' : 'transparent' }]}
                onPress={() => {
                  onSelect(currency);
                  onClose();
                }}
              >
                <Text style={[styles.currencyOptionText, { color: theme.colors.text }]}>
                  {currency} {CURRENCY_SYMBOLS[currency] || ''}
                </Text>
                {selected === currency && <Icon name="check" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Exchange Rates</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            Last updated: {lastUpdated || 'Loading...'}
          </Text>
        </View>

        {/* Currency Converter */}
        <View style={[styles.converterCard, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.converterTitle, { color: theme.colors.text }]}>Currency Converter</Text>

          {/* From Currency */}
          <View style={[styles.currencyInput, { borderColor: theme.colors.border }]}>
            <TextInput
              placeholder="Amount"
              placeholderTextColor={theme.colors.muted}
              style={[styles.amountInput, { color: theme.colors.text }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[styles.currencySelector, { backgroundColor: theme.colors.background }]}
              onPress={() => setShowFromPicker(true)}
            >
              <Text style={[styles.currencySymbol, { color: theme.colors.text }]}>
                {CURRENCY_SYMBOLS[fromCurrency] || fromCurrency}
              </Text>
              <Text style={[styles.currencyCode, { color: theme.colors.text }]}>{fromCurrency}</Text>
              <Icon name="chevron-down" size={16} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Swap Button */}
          <TouchableOpacity onPress={swapCurrencies} style={styles.swapButton}>
            <View style={[styles.swapButtonInner, { backgroundColor: colors.primary + '20' }]}>
              <Icon name="swap" size={24} color={colors.primary} />
            </View>
          </TouchableOpacity>

          {/* To Currency */}
          <View style={[styles.currencyInput, { borderColor: theme.colors.border }]}>
            <TextInput
              placeholder="Converted Amount"
              placeholderTextColor={theme.colors.muted}
              style={[styles.amountInput, { color: theme.colors.text }]}
              value={convertedAmount !== null ? convertedAmount.toFixed(2) : ''}
              editable={false}
            />
            <TouchableOpacity
              style={[styles.currencySelector, { backgroundColor: theme.colors.background }]}
              onPress={() => setShowToPicker(true)}
            >
              <Text style={[styles.currencySymbol, { color: theme.colors.text }]}>
                {CURRENCY_SYMBOLS[toCurrency] || toCurrency}
              </Text>
              <Text style={[styles.currencyCode, { color: theme.colors.text }]}>{toCurrency}</Text>
              <Icon name="chevron-down" size={16} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>

          {convertedAmount !== null && (
            <View style={styles.conversionRate}>
              <Text style={[styles.conversionRateText, { color: theme.colors.muted }]}>
                1 {fromCurrency} = {rates ? (rates.rates[toCurrency] / rates.rates[fromCurrency]).toFixed(4)} {toCurrency}
              </Text>
            </View>
          )}
        </View>

        {/* All Rates - Alphabetical */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>All Rates</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.muted }]}>Base: USD</Text>
        </View>

        <View style={styles.ratesList}>
          {currencies.map((currency) => (
            <View
              key={currency}
              style={[styles.rateCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            >
              <View style={styles.rateHeader}>
                <View style={[styles.currencyFlag, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.currencyFlagText, { color: colors.primary }]}>
                    {CURRENCY_SYMBOLS[currency] || currency}
                  </Text>
                </View>
                <View style={styles.rateInfo}>
                  <Text style={[styles.rateCurrency, { color: theme.colors.text }]}>
                    {currency}
                  </Text>
                  <Text style={[styles.rateValue, { color: theme.colors.muted }]}>
                    {rates ? formatCurrency(rates.rates[currency], currency) : 'Loading...'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Currency Pickers */}
      {renderCurrencyPicker(fromCurrency, setFromCurrency, showFromPicker, () => setShowFromPicker(false))}
      {renderCurrencyPicker(toCurrency, setToCurrency, showToPicker, () => setShowToPicker(false))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  converterCard: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.deep,
  },
  converterTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '700',
  },
  swapButton: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  swapButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversionRate: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border + '40',
    alignItems: 'center',
  },
  conversionRateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  ratesList: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    ...shadows.soft,
  },
  rateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  currencyFlag: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyFlagText: {
    fontSize: 14,
    fontWeight: '800',
  },
  rateInfo: {
    flex: 1,
  },
  rateCurrency: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  rateValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary + '15',
  },
  selectButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  currencyPicker: {
    width: '100%',
    maxHeight: '70%',
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.deep,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  currencyOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 4,
  },
});

export default ExchangeRatesScreen;