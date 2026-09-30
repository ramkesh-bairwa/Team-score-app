import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { C } from '../theme/colors';

export default function TossScreen({ navigation, route }: any) {
  const { team1, team2, overs, matchType, bet, location } = route.params;
  const [tossWinner, setTossWinner] = useState<null | 'team1' | 'team2'>(null);
  const [choice, setChoice] = useState<null | 'bat' | 'field'>(null);

  const startMatch = () => {
    if (!tossWinner || !choice) return;
    const tossTeam = tossWinner === 'team1' ? team1 : team2;
    const otherTeam = tossWinner === 'team1' ? team2 : team1;
    const battingTeam = choice === 'bat' ? tossTeam : otherTeam;
    const fieldingTeam = choice === 'bat' ? otherTeam : tossTeam;
    navigation.navigate('Scoring', {
      battingTeam, fieldingTeam, overs, matchType, location, bet,
      tossWinner: tossTeam.name, tossChoice: choice,
    });
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Toss Result</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.matchLabel}>{team1.name} vs {team2.name}</Text>
        <Text style={s.oversLabel}>{overs} Overs · {matchType === 'local' ? '🏘️ Local' : '🏟️ Domestic'}</Text>

        <Text style={s.sectionTitle}>Who won the toss?</Text>
        <View style={s.row}>
          {(['team1', 'team2'] as const).map(t => {
            const team = t === 'team1' ? team1 : team2;
            return (
              <TouchableOpacity
                key={t}
                style={[s.teamBtn, tossWinner === t && s.teamBtnActive]}
                onPress={() => { setTossWinner(t); setChoice(null); }}>
                <Text style={s.teamBtnIcon}>🏏</Text>
                <Text style={[s.teamBtnText, tossWinner === t && s.teamBtnTextActive]}>{team.name}</Text>
                {tossWinner === t && <View style={s.check}><Text style={s.checkText}>✓</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {tossWinner && (
          <>
            <Text style={s.sectionTitle}>
              {tossWinner === 'team1' ? team1.name : team2.name} elected to...
            </Text>
            <View style={s.row}>
              <TouchableOpacity
                style={[s.choiceBtn, choice === 'bat' && s.choiceBtnActive]}
                onPress={() => setChoice('bat')}>
                <Text style={s.choiceIcon}>🏏</Text>
                <Text style={[s.choiceText, choice === 'bat' && s.choiceTextActive]}>Bat First</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.choiceBtn, choice === 'field' && s.choiceBtnActive]}
                onPress={() => setChoice('field')}>
                <Text style={s.choiceIcon}>🎳</Text>
                <Text style={[s.choiceText, choice === 'field' && s.choiceTextActive]}>Bowl First</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {tossWinner && choice && (
          <View style={s.summaryBox}>
            <Text style={s.summaryRow}>
              🏏 <Text style={s.bold}>
                {choice === 'bat'
                  ? (tossWinner === 'team1' ? team1.name : team2.name)
                  : (tossWinner === 'team1' ? team2.name : team1.name)}
              </Text> will bat first
            </Text>
            <Text style={s.summaryRow}>
              🎳 <Text style={s.bold}>
                {choice === 'field'
                  ? (tossWinner === 'team1' ? team1.name : team2.name)
                  : (tossWinner === 'team1' ? team2.name : team1.name)}
              </Text> will bowl first
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.startBtn, (!tossWinner || !choice) && s.startBtnDisabled]}
          onPress={startMatch}
          disabled={!tossWinner || !choice}>
          <Text style={s.startBtnText}>🏏 Start Match</Text>
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
  scroll: { padding: 20, paddingBottom: 40 },
  matchLabel: { fontSize: 22, fontWeight: '900', color: C.text, textAlign: 'center', marginBottom: 4 },
  oversLabel: { fontSize: 13, color: C.textSub, textAlign: 'center', marginBottom: 28 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.textSub, marginBottom: 12, marginTop: 4 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  teamBtn: {
    flex: 1, backgroundColor: C.white, borderRadius: 16, paddingVertical: 20,
    alignItems: 'center', borderWidth: 2, borderColor: C.cardBorder, position: 'relative',
  },
  teamBtnActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  teamBtnIcon: { fontSize: 28, marginBottom: 6 },
  teamBtnText: { fontSize: 14, fontWeight: '700', color: C.textSub },
  teamBtnTextActive: { color: C.primary },
  check: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  checkText: { color: C.white, fontSize: 11, fontWeight: '800' },
  choiceBtn: {
    flex: 1, backgroundColor: C.white, borderRadius: 16, paddingVertical: 20,
    alignItems: 'center', borderWidth: 2, borderColor: C.cardBorder,
  },
  choiceBtnActive: { borderColor: C.green, backgroundColor: C.greenLight },
  choiceIcon: { fontSize: 28, marginBottom: 6 },
  choiceText: { fontSize: 14, fontWeight: '700', color: C.textSub },
  choiceTextActive: { color: C.green },
  summaryBox: {
    backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: C.cardBorder, gap: 8,
  },
  summaryRow: { fontSize: 14, color: C.textSub },
  bold: { fontWeight: '700', color: C.text },
  startBtn: {
    backgroundColor: C.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  startBtnDisabled: { backgroundColor: C.textMuted, shadowOpacity: 0 },
  startBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
});
