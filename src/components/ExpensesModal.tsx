import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from './Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';
import { Expense, ExpenseCategory } from '../types';
import exchangeRateService from '../services/exchangeRateService';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CNY', 'KRW', 'INR', 'MXN', 'BRL', 'SGD'];

const CATEGORIES: { id: ExpenseCategory; label: string; color: string; icon: string }[] = [
  { id: 'transportation', label: 'Transportation', color: '#3B82F6', icon: 'transit' },
  { id: 'stays', label: 'Stays', color: '#8B5CF6', icon: 'hotel' },
  { id: 'dining', label: 'Dining', color: '#F59E0B', icon: 'restaurant' },
  { id: 'experiences', label: 'Experiences', color: '#EC4899', icon: 'ticket' },
  { id: 'other', label: 'Other', color: '#64748B', icon: 'category' },
];

type ExpensesModalProps = {
  visible: boolean;
  onClose: () => void;
  budgetAmount: number;
  budgetCurrency: string;
  onBudgetChange: (amount: number, currency: string) => void;
  expenses: Expense[];
  onExpensesChange: (expenses: Expense[]) => void;
};

let expenseIdCounter = 0;
const genExpenseId = () => `exp-${Date.now()}-${expenseIdCounter++}`;

// Reusable currency dropdown (expands inline below the button)
const CurrencyDropdown: React.FC<{ value: string; onChange: (c: string) => void; compact?: boolean }> = ({
  value,
  onChange,
  compact,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity
        style={[styles.currencyDropdownBtn, compact && styles.currencyDropdownBtnCompact]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.85}
      >
        <Text style={styles.currencyDropdownText}>{value}</Text>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} color={colors.primary} />
      </TouchableOpacity>
      {open && (
        <View style={styles.currencyDropdownList}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.currencyDropdownItem, c === value && styles.currencyDropdownItemActive]}
              onPress={() => {
                onChange(c);
                setOpen(false);
              }}
            >
              <Text style={[styles.currencyDropdownItemText, c === value && { color: colors.white }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};


const ExpensesModal: React.FC<ExpensesModalProps> = ({
  visible,
  onClose,
  budgetAmount,
  budgetCurrency,
  onBudgetChange,
  expenses,
  onExpensesChange,
}) => {
  // New expense form state
  const [category, setCategory] = useState<ExpenseCategory>('transportation');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(budgetCurrency || 'USD');
  const [notes, setNotes] = useState('');
  const [timestamp, setTimestamp] = useState<number>(Date.now());
  const [converted, setConverted] = useState<{ id: string; amount: number }[]>([]);

  // Convert each expense to the budget currency for totals + chart
  useEffect(() => {
    let active = true;
    (async () => {
      const res = await Promise.all(
        expenses.map(async (e) => {
          try {
            const v = await exchangeRateService.convert(e.amount, e.currency, budgetCurrency || 'USD');
            return { id: e.id, amount: v };
          } catch {
            return { id: e.id, amount: e.amount };
          }
        })
      );
      if (active) setConverted(res);
    })();
    return () => { active = false; };
  }, [expenses, budgetCurrency]);

  const withConverted = expenses.map((e, i) => ({ ...e, convertedAmount: converted[i]?.amount ?? e.amount }));
  const totalSpent = withConverted.reduce((s, e) => s + e.convertedAmount, 0);

  const categoryTotals = CATEGORIES.map((cat) => ({
    ...cat,
    total: withConverted.filter((e) => e.category === cat.id).reduce((s, e) => s + e.convertedAmount, 0),
  }));
  const spentCategories = categoryTotals.filter((c) => c.total > 0);

  // Donut chart segments
  const CIRCUMFERENCE = 2 * Math.PI * 62;
  let cumulative = 0;
  const segments = spentCategories.map((cat) => {
    const fraction = totalSpent > 0 ? cat.total / totalSpent : 0;
    const seg = {
      ...cat,
      dash: fraction * CIRCUMFERENCE,
      offset: cumulative * CIRCUMFERENCE,
    };
    cumulative += fraction;
    return seg;
  });

  const remaining = budgetAmount - totalSpent;
  const percentUsed = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;

  const addExpense = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    const expense: Expense = {
      id: genExpenseId(),
      category,
      amount: amt,
      currency,
      notes: notes.trim() || undefined,
      timestamp,
    };
    onExpensesChange([...expenses, expense]);
    setAmount('');
    setNotes('');
    setTimestamp(Date.now());
  };

  const removeExpense = (id: string) => {
    onExpensesChange(expenses.filter((e) => e.id !== id));
  };

  const setNow = () => setTimestamp(Date.now());

  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const catFor = (id: ExpenseCategory) => CATEGORIES.find((c) => c.id === id)!;


  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Expenses</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Icon name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Budget */}
          <Text style={styles.sectionLabel}>Budget</Text>
          <View style={styles.budgetRow}>
            <TextInput
              style={styles.budgetInput}
              value={budgetAmount > 0 ? String(budgetAmount) : ''}
              onChangeText={(t) => onBudgetChange(parseFloat(t) || 0, budgetCurrency)}
              placeholder="Budget amount"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
            />
            <CurrencyDropdown value={budgetCurrency} onChange={(c) => onBudgetChange(budgetAmount, c)} />
          </View>

          {/* Donut chart + total */}
          <View style={styles.chartCard}>
            <View style={styles.donutWrap}>
              {spentCategories.length > 0 ? (
                <Svg width={160} height={160}>
                  {segments.map((seg) => (
                    <Circle
                      key={seg.id}
                      cx={80}
                      cy={80}
                      r={62}
                      stroke={seg.color}
                      strokeWidth={26}
                      fill="none"
                      strokeDasharray={`${seg.dash} ${CIRCUMFERENCE}`}
                      strokeDashoffset={-seg.offset}
                      rotation={-90}
                      origin="80, 80"
                    />
                  ))}
                </Svg>
              ) : (
                <Svg width={160} height={160}>
                  <Circle cx={80} cy={80} r={62} stroke={colors.border} strokeWidth={26} fill="none" />
                </Svg>
              )}
              <View style={styles.donutCenter}>
                <Text style={styles.donutTotal}>{totalSpent.toFixed(0)}</Text>
                <Text style={styles.donutCurrency}>{budgetCurrency} spent</Text>
              </View>
            </View>

            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(percentUsed, 100)}%` }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressText}>{percentUsed.toFixed(0)}% of budget used</Text>
                <Text style={styles.progressText}>{remaining >= 0 ? `${remaining.toFixed(0)} ${budgetCurrency} left` : `${Math.abs(remaining).toFixed(0)} ${budgetCurrency} over`}</Text>
              </View>
            </View>

            <View style={styles.legend}>
              {categoryTotals.map((cat) => (
                <View key={cat.id} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                  <Text style={styles.legendLabel}>{cat.label}</Text>
                  <Text style={styles.legendValue}>{cat.total.toFixed(0)}</Text>
                </View>
              ))}
            </View>
          </View>


          {/* Add expense */}
          <Text style={styles.sectionLabel}>Add Expense</Text>
          <View style={styles.addCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, category === cat.id && { backgroundColor: cat.color }]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Icon name={cat.icon} size={14} color={category === cat.id ? colors.white : cat.color} />
                  <Text style={[styles.catChipText, category === cat.id && { color: colors.white }]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.expenseRow}>
              <TextInput
                style={[styles.expenseAmount, { flex: 2 }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="Amount"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
              <CurrencyDropdown value={currency} onChange={setCurrency} compact />
            </View>

            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.muted}
            />

            <View style={styles.dateRow}>
              <Text style={styles.dateText}>{fmtDate(timestamp)}</Text>
              <TouchableOpacity style={styles.nowBtn} onPress={setNow}>
                <Icon name="time" size={14} color={colors.primary} />
                <Text style={styles.nowText}>Now</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.addExpenseBtn} onPress={addExpense} activeOpacity={0.9}>
              <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.addExpenseGradient}>
                <Icon name="plus" size={16} color={colors.white} />
                <Text style={styles.addExpenseText}>Add Expense</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Expense list */}
          <Text style={styles.sectionLabel}>History</Text>
          {expenses.length === 0 ? (
            <Text style={styles.emptyText}>No expenses yet. Add your first expense above.</Text>
          ) : (
            expenses.map((e) => {
              const cat = catFor(e.category);
              return (
                <View key={e.id} style={styles.expenseItem}>
                  <View style={[styles.expenseIcon, { backgroundColor: cat.color + '20' }]}>
                    <Icon name={cat.icon} size={18} color={cat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expenseCat}>{cat.label}</Text>
                    {e.notes ? <Text style={styles.expenseNotes} numberOfLines={1}>{e.notes}</Text> : null}
                    <Text style={styles.expenseDate}>{fmtDate(e.timestamp)}</Text>
                  </View>
                  <Text style={styles.expenseAmountText}>
                    {e.amount} {e.currency}
                  </Text>
                  <TouchableOpacity onPress={() => removeExpense(e.id)}>
                    <Icon name="close" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.md },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  closeBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: spacing.lg, marginBottom: spacing.sm },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  budgetInput: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text },
  currencyDropdownBtn: { minWidth: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingVertical: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  currencyDropdownBtnCompact: { minWidth: 104, paddingVertical: 12 },
  currencyDropdownText: { fontSize: 14, fontWeight: '800', color: colors.text },
  currencyDropdownList: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  currencyDropdownItem: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  currencyDropdownItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  currencyDropdownItemText: { fontSize: 12, fontWeight: '700', color: colors.text },
  chartCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md, ...shadows.card },
  donutWrap: { alignItems: 'center', justifyContent: 'center', height: 160 },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutTotal: { fontSize: 26, fontWeight: '800', color: colors.text },
  donutCurrency: { fontSize: 12, color: colors.muted, marginTop: 2 },
  progressWrap: { marginTop: spacing.lg },
  progressTrack: { height: 10, backgroundColor: colors.border, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 999 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  legend: { marginTop: spacing.lg, gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  legendValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  addCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, ...shadows.card },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  catChipText: { fontSize: 12, fontWeight: '700', color: colors.text },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  expenseAmount: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: colors.text },
  notesInput: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: colors.text },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateText: { fontSize: 13, fontWeight: '600', color: colors.text },
  nowBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  nowText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  addExpenseBtn: { borderRadius: radius.full, overflow: 'hidden', ...shadows.fab },
  addExpenseGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  addExpenseText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  expenseItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadows.soft },
  expenseIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  expenseCat: { fontSize: 15, fontWeight: '700', color: colors.text },
  expenseNotes: { fontSize: 12, color: colors.muted, marginTop: 2 },
  expenseDate: { fontSize: 11, color: colors.muted, marginTop: 2 },
  expenseAmountText: { fontSize: 14, fontWeight: '800', color: colors.text, marginRight: spacing.sm },
  emptyText: { color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl },
});

export default ExpensesModal;

