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
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import { ThemeContext, colors, radius, shadows, spacing } from '../theme/theme';
import exchangeRateService, { ExchangeRates } from '../services/exchangeRateService';
import { useRevenueCat } from '../context/RevenueCatContext';

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  JPY: 'Japanese Yen',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  CHF: 'Swiss Franc',
  CNY: 'Chinese Yuan',
  SEK: 'Swedish Krona',
  NZD: 'New Zealand Dollar',
  KRW: 'South Korean Won',
  SGD: 'Singapore Dollar',
  NOK: 'Norwegian Krone',
  MXN: 'Mexican Peso',
  INR: 'Indian Rupee',
  BRL: 'Brazilian Real',
  ZAR: 'South African Rand',
  HKD: 'Hong Kong Dollar',
  TRY: 'Turkish Lira',
  RUB: 'Russian Ruble',
  PLN: 'Polish Zloty',
  THB: 'Thai Baht',
  IDR: 'Indonesian Rupiah',
  HUF: 'Hungarian Forint',
  CZK: 'Czech Koruna',
  ILS: 'Israeli Shekel',
  CLP: 'Chilean Peso',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  MYR: 'Malaysian Ringgit',
  PHP: 'Philippine Peso',
  VND: 'Vietnamese Dong',
  COP: 'Colombian Peso',
  EGP: 'Egyptian Pound',
  ARS: 'Argentine Peso',
  TWD: 'Taiwan Dollar',
  NGN: 'Nigerian Naira',
  KES: 'Kenyan Shilling',
  PKR: 'Pakistani Rupee',
  DZD: 'Algerian Dinar',
  MAD: 'Moroccan Dirham',
  QAR: 'Qatari Riyal',
  BDT: 'Bangladeshi Taka',
  PAB: 'Panamanian Balboa',
  CRC: 'Costa Rican Colon',
  CVE: 'Cape Verdean Escudo',
  AFN: 'Afghan Afghani',
  ALL: 'Albanian Lek',
  AMD: 'Armenian Dram',
  ANG: 'Netherlands Antillian Guilder',
  AOA: 'Angolan Kwanza',
  AWG: 'Aruban Florin',
  AZN: 'Azerbaijani Manat',
  BAM: 'Bosnia-Herzegovina Convertible Mark',
  BBD: 'Barbadian Dollar',
  BGN: 'Bulgarian Lev',
  BHD: 'Bahraini Dinar',
  BIF: 'Burundian Franc',
  BMD: 'Bermudan Dollar',
  BND: 'Brunei Dollar',
  BOB: 'Bolivian Boliviano',
  BSD: 'Bahamian Dollar',
  BTN: 'Bhutanese Ngultrum',
  BWP: 'Botswanan Pula',
  BYN: 'Belarusian Ruble',
  BZD: 'Belize Dollar',
  CDF: 'Congolese Franc',
  CUP: 'Cuban Peso',
  DJF: 'Djiboutian Franc',
  DKK: 'Danish Krone',
  DOP: 'Dominican Peso',
  ETB: 'Ethiopian Birr',
  FJD: 'Fijian Dollar',
  FKP: 'Falkland Islands Pound',
  GEL: 'Georgian Lari',
  GGP: 'Guernsey Pound',
  GHS: 'Ghanaian Cedi',
  GIP: 'Gibraltar Pound',
  GMD: 'Gambian Dalasi',
  GNF: 'Guinean Franc',
  GTQ: 'Guatemalan Quetzal',
  GYD: 'Guyanaese Dollar',
  HNL: 'Honduran Lempira',
  HRK: 'Croatian Kuna',
  HTG: 'Haitian Gourde',
  IMP: 'Manx Pound',
  IQD: 'Iraqi Dinar',
  IRR: 'Iranian Rial',
  ISK: 'Icelandic Krona',
  JEP: 'Jersey Pound',
  JMD: 'Jamaican Dollar',
  JOD: 'Jordanian Dinar',
  KGS: 'Kyrgystani Som',
  KHR: 'Cambodian Riel',
  KMF: 'Comorian Franc',
  KPW: 'North Korean Won',
  KWD: 'Kuwaiti Dinar',
  KYD: 'Cayman Islands Dollar',
  KZT: 'Kazakhstani Tenge',
  LAK: 'Laotian Kip',
  LBP: 'Lebanese Pound',
  LKR: 'Sri Lankan Rupee',
  LRD: 'Liberian Dollar',
  LSL: 'Lesotho Loti',
  LYD: 'Libyan Dinar',
  MDL: 'Moldovan Leu',
  MGA: 'Malagasy Ariary',
  MKD: 'Macedonian Denar',
  MMK: 'Myanmar Kyat',
  MNT: 'Mongolian Tugrik',
  MOP: 'Macanese Pataca',
  MRU: 'Mauritanian Ouguiya',
  MUR: 'Mauritian Rupee',
  MVR: 'Maldivian Rufiyaa',
  MWK: 'Malawian Kwacha',
  MZN: 'Mozambican Metical',
  NAD: 'Namibian Dollar',
  NIO: 'Nicaraguan Cordoba',
  NPR: 'Nepalese Rupee',
  OMR: 'Omani Rial',
  PEN: 'Peruvian Sol',
  PGK: 'Papua New Guinean Kina',
  PYG: 'Paraguayan Guarani',
  RON: 'Romanian Leu',
  RSD: 'Serbian Dinar',
  RWF: 'Rwandan Franc',
  SBD: 'Solomon Islands Dollar',
  SCR: 'Seychellois Rupee',
  SDG: 'Sudanese Pound',
  SHP: 'Saint Helena Pound',
  SLL: 'Sierra Leonean Leone',
  SOS: 'Somali Shilling',
  SRD: 'Surinamese Dollar',
  SSP: 'South Sudanese Pound',
  STN: 'Sao Tome and Principe Dobra',
  SVC: 'Salvadoran Colon',
  SYP: 'Syrian Pound',
  SZL: 'Swazi Lilangeni',
  TJS: 'Tajikistani Somoni',
  TMT: 'Turkmenistani Manat',
  TND: 'Tunisian Dinar',
  TOP: 'Tongan Pa\'anga',
  TTD: 'Trinidad and Tobago Dollar',
  TZS: 'Tanzanian Shilling',
  UAH: 'Ukrainian Hryvnia',
  UGX: 'Ugandan Shilling',
  UYU: 'Uruguayan Peso',
  UZS: 'Uzbekistani Som',
  VES: 'Venezuelan Bolívar',
  VUV: 'Vanuatu Vatu',
  WST: 'Samoan Tala',
  XAF: 'CFA Franc BEAC',
  XCD: 'East Caribbean Dollar',
  XOF: 'CFA Franc BCEAO',
  XPF: 'CFP Franc',
  YER: 'Yemeni Rial',
  ZMW: 'Zambian Kwacha',
  ZWL: 'Zimbabwean Dollar',
};

const POPULAR_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN', 'SGD', 'HKD',
];

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
  const navigation = useNavigation();
  const { isPro, presentPaywall } = useRevenueCat();

  // Non-Pro: popular currencies including CNY (Chinese Yuan). Pro: all currencies.
  const ALLOWED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CNY'];

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

  const allCurrencies = rates ? Object.keys(rates.rates).sort() : ALLOWED_CURRENCIES;
  const currencies = isPro ? allCurrencies : allCurrencies.filter((c) => ALLOWED_CURRENCIES.includes(c));
  const popularCurrencies = POPULAR_CURRENCIES.filter((c) => allCurrencies.includes(c));

  const getCurrencyName = (code: string): string => {
    return CURRENCY_NAMES[code] || code;
  };

  const formatCurrency = (value: number, currency: string) => {
    return `${value.toFixed(2)}`;
  };

  const renderCurrencyOption = (
    currency: string,
    selected: string,
    onSelect: (c: string) => void,
    onClose: () => void,
    keyPrefix = ''
  ) => (
    <TouchableOpacity
      key={`${keyPrefix}${currency}`}
      style={[styles.currencyOption, { backgroundColor: selected === currency ? colors.primary + '20' : 'transparent' }]}
      onPress={() => {
        onSelect(currency);
        onClose();
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.currencyOptionText, { color: theme.colors.text }]}>
          {currency}
        </Text>
        <Text style={[styles.currencyOptionSubtext, { color: theme.colors.muted }]}>
          {getCurrencyName(currency)}
        </Text>
      </View>
      {selected === currency && <Icon name="check" size={20} color={colors.primary} />}
    </TouchableOpacity>
  );

  const renderCurrencyPicker = (selected: string, onSelect: (c: string) => void, visible: boolean, onClose: () => void) => {
    if (!visible) return null;
    return (
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
          <View style={[styles.currencyPicker, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>Select Currency</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.pickerSectionLabel, { color: theme.colors.muted }]}>Popular</Text>
              {popularCurrencies.map((currency) =>
                renderCurrencyOption(currency, selected, onSelect, onClose, 'popular-')
              )}
              <Text style={[styles.pickerSectionLabel, { color: theme.colors.muted, marginTop: spacing.md }]}>
                All Currencies
              </Text>
              {currencies.map((currency) =>
                renderCurrencyOption(currency, selected, onSelect, onClose)
              )}
            </ScrollView>
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
          {navigation.canGoBack() && (
            <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
              <Icon name="close" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          )}
          <View>
            <Text style={[styles.title, { color: theme.colors.text }]}>Exchange Rates</Text>
            <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
              Last updated: {lastUpdated || 'Loading...'}
            </Text>
          </View>
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
                {fromCurrency}
              </Text>
              <Text style={[styles.currencyCode, { color: theme.colors.text }]}>{fromCurrency}</Text>
              <Icon name="chevronDown" size={16} color={theme.colors.muted} />
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
                {toCurrency}
              </Text>
              <Text style={[styles.currencyCode, { color: theme.colors.text }]}>{toCurrency}</Text>
              <Icon name="chevronDown" size={16} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>

          {convertedAmount !== null && (
            <View style={styles.conversionRate}>
                <Text style={[styles.conversionRateText, { color: theme.colors.muted }]}>
                  1 {fromCurrency} = {rates ? (rates.rates[toCurrency] / rates.rates[fromCurrency]).toFixed(4) : '---'} {toCurrency}
                </Text>
            </View>
          )}
        </View>

      {/* All Rates - Alphabetical */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {isPro ? 'All Rates' : 'Available Rates'}
        </Text>
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
                  {currency}
                </Text>
              </View>
              <View style={styles.rateInfo}>
                <Text style={[styles.rateCurrency, { color: theme.colors.text }]}>
                  {getCurrencyName(currency)}
                </Text>
                <Text style={[styles.rateCurrencyCode, { color: theme.colors.muted }]}>
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

      {/* Pro Upsell for non-Pro users */}
      {!isPro && (
        <TouchableOpacity
          style={[styles.proUpsellBtn]}
          onPress={() => presentPaywall()}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[colors.primary, '#7985FF']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Icon name="lock" size={16} color={colors.white} />
          <Text style={styles.proUpsellText}>
            Want all 170+ currencies? Get Waybound Pro
          </Text>
          <Icon name="chevronRight" size={16} color={colors.white} />
        </TouchableOpacity>
      )}
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
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.soft,
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
    fontSize: 12,
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
  rateCurrencyCode: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  rateValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  currencyOptionSubtext: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
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
  pickerSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
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
  proUpsellBtn: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    ...shadows.fab,
  },
  proUpsellText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
});

export default ExchangeRatesScreen;
