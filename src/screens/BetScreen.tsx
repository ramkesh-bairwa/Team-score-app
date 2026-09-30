import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, TextInput, Image,
} from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { C } from '../theme/colors';

const PRESETS = ['10', '20', '50', '100'];

export default function BetScreen({ navigation, route }: any) {
  const { team1, team2, overs, matchType, location } = route.params;

  const [betType, setBetType] = useState<'free' | 'paid' | null>(null);
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [cap1Photo, setCap1Photo] = useState<string | null>(null);
  const [cap2Photo, setCap2Photo] = useState<string | null>(null);

  const finalAmount = amount === 'custom' ? customAmount : amount;

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
    return true;
  };

  const proceed = () => {
    const bet = betType === 'paid'
      ? { type: 'paid', amount: parseInt(finalAmount), cap1Photo, cap2Photo }
      : { type: 'free', amount: 0 };
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
        </View>

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

        <TouchableOpacity
          style={[s.proceedBtn, !canProceed() && s.proceedBtnDisabled]}
          onPress={proceed}
          disabled={!canProceed()}>
          <Text style={s.proceedBtnText}>
            {betType === 'paid' ? '💰 Confirm & Proceed to Toss' : '🏏 Proceed to Toss'}
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
  row: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  typeBtn: {
    flex: 1, backgroundColor: C.white, borderRadius: 16, padding: 16,
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
  proceedBtn: {
    backgroundColor: C.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  proceedBtnDisabled: { backgroundColor: C.textMuted, shadowOpacity: 0 },
  proceedBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
});
