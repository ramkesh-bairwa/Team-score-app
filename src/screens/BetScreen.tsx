import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, TextInput, Image,
} from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { C } from '../theme/colors';

const PRESETS = ['10', '20', '50', '100'];
const EXPENSE_PRESETS = ['Ground fee', 'Ball fee', 'Umpire fee', 'Refreshments', 'Equipment'];
export const BALL_TYPES = [
  { key: 'Tennis', icon: '🎾' },
  { key: 'Leather', icon: '🔴' },
  { key: 'Plastic', icon: '⚪' },
  { key: 'Wind', icon: '🌬️' },
];
type Expense = { label: string; amount: string };

export default function BetScreen({ navigation, route }: any) {
  const { team1, team2, overs, matchType, location } = route.params;

  const [betType, setBetType] = useState<'free' | 'paid' | 'loser' | null>(null);
  // Loser to pay: the losing team covers the match expenses
  const [expenses, setExpenses] = useState<Expense[]>([{ label: 'Ground fee', amount: '' }]);
  const [expenseNote, setExpenseNote] = useState('');
  const [ballType, setBallType] = useState('Tennis');
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [cap1Photo, setCap1Photo] = useState<string | null>(null);
  const [cap2Photo, setCap2Photo] = useState<string | null>(null);

  const finalAmount = amount === 'custom' ? customAmount : amount;
  const expenseTotal = expenses.reduce((sum, e) => sum + (parseInt(e.amount, 10) || 0), 0);

  const addExpense = (label: string) => {
    if (expenses.some(e => e.label === label) && label !== 'Other') return;
    setExpenses([...expenses, { label, amount: '' }]);
  };
  const updateExpense = (i: number, patch: Partial<Expense>) =>
    setExpenses(expenses.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const capturePhoto = (captain: 1 | 2) => {
    launchCamera({ mediaType: 'photo', cameraType: 'front', quality: 0.7 }, res => {
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;
      if (captain === 1) setCap1Photo(uri);
      else setCap2Photo(uri);
    });
  };

  const canProceed = () => {
    if (!betType) return false;
    if (betType === 'paid') {
      if (!finalAmount || parseInt(finalAmount) < 1) return false;
      if (!cap1Photo || !cap2Photo) return false;
    }
    if (betType === 'loser' && expenseTotal < 1) return false;
    return true;
  };

  const proceed = () => {
    // ballType travels inside `bet`, which is already passed through every match screen
    const bet = betType === 'paid'
      ? { type: 'paid', amount: parseInt(finalAmount), cap1Photo, cap2Photo, ballType }
      : betType === 'loser'
        ? {
          type: 'loser', amount: expenseTotal, ballType, note: expenseNote.trim(),
          expenses: expenses
            .filter(e => (parseInt(e.amount, 10) || 0) > 0)
            .map(e => ({ label: e.label.trim() || 'Other', amount: parseInt(e.amount, 10) })),
        }
        : { type: 'free', amount: 0, ballType };
    navigation.navigate('Toss', {
      team1, team2, overs, matchType, location, bet,
    });
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Match Bet</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.matchLabel}>{team1.name} vs {team2.name}</Text>

        {/* Free / Paid */}
        <Text style={s.sectionTitle}>Bet Type</Text>
        <View style={s.row}>
          <TouchableOpacity
            style={[s.typeBtn, betType === 'free' && s.typeBtnActive]}
            onPress={() => { setBetType('free'); setAmount(''); setCustomAmount(''); }}>
            <Text style={s.typeIcon}>🆓</Text>
            <Text style={[s.typeText, betType === 'free' && s.typeTextActive]}>Free Match</Text>
            <Text style={s.typeDesc}>No bet amount</Text>
            {betType === 'free' && <View style={s.check}><Text style={s.checkText}>✓</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.typeBtn, betType === 'paid' && s.typeBtnActive]}
            onPress={() => setBetType('paid')}>
            <Text style={s.typeIcon}>💰</Text>
            <Text style={[s.typeText, betType === 'paid' && s.typeTextActive]}>Paid Match</Text>
            <Text style={s.typeDesc}>Set bet amount</Text>
            {betType === 'paid' && <View style={s.check}><Text style={s.checkText}>✓</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.typeBtn, betType === 'loser' && s.typeBtnActive]}
            onPress={() => setBetType('loser')}>
            <Text style={s.typeIcon}>🧾</Text>
            <Text style={[s.typeText, betType === 'loser' && s.typeTextActive]}>Loser to Pay</Text>
            <Text style={s.typeDesc}>Loser pays expenses</Text>
            {betType === 'loser' && <View style={s.check}><Text style={s.checkText}>✓</Text></View>}
          </TouchableOpacity>
        </View>

        {betType === 'loser' && (
          <>
            <Text style={s.sectionTitle}>Match Expenses (₹)</Text>
            <View style={s.card}>
              {expenses.map((e, i) => (
                <View key={i} style={s.expenseRow}>
                  <TextInput
                    style={[s.expenseInput, s.expenseLabel]}
                    value={e.label}
                    onChangeText={v => updateExpense(i, { label: v })}
                    placeholder="Expense"
                    placeholderTextColor={C.textMuted}
                  />
                  <TextInput
                    style={[s.expenseInput, s.expenseAmount]}
                    value={e.amount}
                    onChangeText={v => updateExpense(i, { amount: v.replace(/[^0-9]/g, '') })}
                    placeholder="₹ 0"
                    placeholderTextColor={C.textMuted}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity style={s.expenseRemove} onPress={() => setExpenses(expenses.filter((_, idx) => idx !== i))}>
                    <Text style={s.expenseRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={s.expenseChips}>
                {[...EXPENSE_PRESETS, 'Other'].filter(l => l === 'Other' || !expenses.some(e => e.label === l)).map(l => (
                  <TouchableOpacity key={l} style={s.expenseChip} onPress={() => addExpense(l)}>
                    <Text style={s.expenseChipText}>+ {l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={s.noteInput}
                value={expenseNote}
                onChangeText={setExpenseNote}
                placeholder="📝 Note (e.g. ground booked for 2 hours, 2 new balls)"
                placeholderTextColor={C.textMuted}
                multiline
              />
              <View style={s.expenseTotal}>
                <Text style={s.expenseTotalLabel}>Losing team pays</Text>
                <Text style={s.expenseTotalVal}>₹{expenseTotal}</Text>
              </View>
            </View>
          </>
        )}

        {betType === 'paid' && (
          <>
            {/* Amount */}
            <Text style={s.sectionTitle}>Bet Amount (₹)</Text>
            <View style={s.card}>
              <View style={s.amountRow}>
                {PRESETS.map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[s.amountChip, amount === a && s.amountChipActive]}
                    onPress={() => { setAmount(a); setCustomAmount(''); }}>
                    <Text style={[s.amountChipText, amount === a && s.amountChipTextActive]}>₹{a}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[s.amountChip, amount === 'custom' && s.amountChipActive]}
                  onPress={() => setAmount('custom')}>
                  <Text style={[s.amountChipText, amount === 'custom' && s.amountChipTextActive]}>Custom</Text>
                </TouchableOpacity>
              </View>
              {amount === 'custom' && (
                <TextInput
                  style={s.customInput}
                  placeholder="Enter amount"
                  placeholderTextColor={C.textMuted}
                  keyboardType="number-pad"
                  value={customAmount}
                  onChangeText={setCustomAmount}
                  autoFocus
                />
              )}
              {finalAmount && parseInt(finalAmount) > 0 && (
                <View style={s.amountConfirm}>
                  <Text style={s.amountConfirmText}>💰 Bet: ₹{finalAmount}</Text>
                </View>
              )}
            </View>

            {/* Captain Photos */}
            {finalAmount && parseInt(finalAmount) > 0 && (
              <>
                <Text style={s.sectionTitle}>Captain Confirmation</Text>
                <Text style={s.photoSubText}>Both captains must take a selfie to confirm the bet</Text>
                <View style={s.photoRow}>
                  {[
                    { captain: team1.captain, team: team1.name, photo: cap1Photo, num: 1 as 1 | 2 },
                    { captain: team2.captain, team: team2.name, photo: cap2Photo, num: 2 as 1 | 2 },
                  ].map(({ captain, team, photo, num }) => (
                    <View key={num} style={s.photoCard}>
                      <Text style={s.photoCapName}>{captain}</Text>
                      <Text style={s.photoTeamName}>{team}</Text>
                      {photo ? (
                        <TouchableOpacity onPress={() => capturePhoto(num)}>
                          <Image source={{ uri: photo }} style={s.photoImg} />
                          <Text style={s.retakeText}>Tap to retake</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={s.captureBtn} onPress={() => capturePhoto(num)}>
                          <Text style={s.captureIcon}>📷</Text>
                          <Text style={s.captureBtnText}>Take Photo</Text>
                        </TouchableOpacity>
                      )}
                      {photo && <View style={s.photoDone}><Text style={s.photoDoneText}>✓ Done</Text></View>}
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        <Text style={s.sectionTitle}>Ball Type</Text>
        <View style={s.ballRow}>
          {BALL_TYPES.map(b => (
            <TouchableOpacity key={b.key} style={[s.ballBtn, ballType === b.key && s.ballBtnOn]} onPress={() => setBallType(b.key)}>
              <Text style={s.ballIcon}>{b.icon}</Text>
              <Text style={[s.ballText, ballType === b.key && s.ballTextOn]}>{b.key}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[s.proceedBtn, !canProceed() && s.proceedBtnDisabled]}
          onPress={proceed}
          disabled={!canProceed()}>
          <Text style={s.proceedBtnText}>
            {betType === 'paid' ? '💰 Confirm & Proceed to Toss' : betType === 'loser' ? `🧾 Loser pays ₹${expenseTotal} · Proceed to Toss` : '🏏 Proceed to Toss'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  back: { color: C.primary, fontSize: 15, fontWeight: '600', width: 60 },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },
  matchLabel: { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.textSub, marginBottom: 10, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeBtn: {
    flex: 1, backgroundColor: C.white, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 6,
    alignItems: 'center', borderWidth: 2, borderColor: C.cardBorder, position: 'relative',
  },
  typeBtnActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  typeIcon: { fontSize: 28, marginBottom: 6 },
  typeText: { fontSize: 13, fontWeight: '700', color: C.textSub, marginBottom: 2 },
  typeTextActive: { color: C.primary },
  typeDesc: { fontSize: 11, color: C.textMuted, textAlign: 'center' },
  check: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  checkText: { color: C.white, fontSize: 11, fontWeight: '800' },
  card: {
    backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  amountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  amountChip: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12,
    backgroundColor: C.divider, borderWidth: 1, borderColor: C.cardBorder,
  },
  amountChipActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  amountChipText: { fontSize: 15, fontWeight: '700', color: C.textSub },
  amountChipTextActive: { color: C.primary },
  customInput: {
    backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: C.text, borderWidth: 1, borderColor: C.primary, marginTop: 8,
  },
  amountConfirm: {
    marginTop: 12, backgroundColor: C.greenLight, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  amountConfirmText: { color: C.green, fontWeight: '700', fontSize: 14 },
  photoSubText: { fontSize: 12, color: C.textMuted, marginBottom: 12, marginTop: -6 },
  photoRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  photoCard: {
    flex: 1, backgroundColor: C.white, borderRadius: 16, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: C.cardBorder,
  },
  photoCapName: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 2, textAlign: 'center' },
  photoTeamName: { fontSize: 11, color: C.textMuted, marginBottom: 12, textAlign: 'center' },
  captureBtn: {
    backgroundColor: C.divider, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 12,
    alignItems: 'center', borderWidth: 1, borderColor: C.cardBorder, width: '100%',
  },
  captureIcon: { fontSize: 28, marginBottom: 4 },
  captureBtnText: { fontSize: 12, fontWeight: '700', color: C.textSub },
  photoImg: { width: 100, height: 100, borderRadius: 12, marginBottom: 4 },
  retakeText: { fontSize: 10, color: C.textMuted, textAlign: 'center' },
  photoDone: {
    marginTop: 8, backgroundColor: C.greenLight, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  photoDoneText: { color: C.green, fontSize: 11, fontWeight: '700' },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  expenseInput: {
    backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.cardBorder,
  },
  expenseLabel: { flex: 1 },
  expenseAmount: { width: 90, textAlign: 'right', fontWeight: '800' },
  expenseRemove: { padding: 6 },
  expenseRemoveText: { color: C.textMuted, fontSize: 14 },
  expenseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
  expenseChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: C.accentLight },
  expenseChipText: { color: C.accent, fontSize: 12, fontWeight: '700' },
  noteInput: {
    backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 56,
    fontSize: 13, color: C.text, borderWidth: 1, borderColor: C.cardBorder, marginTop: 6, textAlignVertical: 'top',
  },
  expenseTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12,
    backgroundColor: C.orangeLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  expenseTotalLabel: { fontSize: 13, fontWeight: '800', color: '#9A3412' },
  expenseTotalVal: { fontSize: 18, fontWeight: '900', color: C.orange },
  ballRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  ballBtn: {
    flex: 1, backgroundColor: C.white, borderRadius: 14, paddingVertical: 12, alignItems: 'center',
    borderWidth: 2, borderColor: C.cardBorder,
  },
  ballBtnOn: { borderColor: C.green, backgroundColor: C.greenLight },
  ballIcon: { fontSize: 22, marginBottom: 4 },
  ballText: { fontSize: 12, fontWeight: '800', color: C.textSub },
  ballTextOn: { color: C.green },
  proceedBtn: {
    backgroundColor: C.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  proceedBtnDisabled: { backgroundColor: C.textMuted, shadowOpacity: 0 },
  proceedBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
});
