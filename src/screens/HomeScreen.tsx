import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, Modal, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { getInProgressMatch, clearInProgressMatch, getMatches, getMatchFull } from '../services/api';
import Config from 'react-native-config';
import { C } from '../theme/colors';

const DB_RUN = Config.DB_RUN === 'true';
const HISTORY_KEY = 'cricscore_match_history';

export default function HomeScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<'history'>('history');
  const [history, setHistory] = useState<any[]>([]);
  const [inProgress, setInProgress] = useState<any | null>(null);
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdInput, setPwdInput] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadHistory();
      loadInProgress();
    }, [])
  );

  const loadHistory = async () => {
    try {
      if (DB_RUN) {
        const matches = await getMatches();
        setHistory(matches);
      } else {
        const data = await AsyncStorage.getItem(HISTORY_KEY);
        setHistory(data ? JSON.parse(data) : []);
      }
    } catch (_) {}
  };

  const loadInProgress = async () => {
    try {
      const match = await getInProgressMatch();
      setInProgress(match);
    } catch (_) {}
  };

  const resumeMatch = () => {
    if (!inProgress) return;
    navigation.navigate('Scoring', {
      battingTeam: inProgress.battingTeam,
      fieldingTeam: inProgress.fieldingTeam,
      overs: inProgress.overs,
      matchType: inProgress.matchType,
      target: inProgress.target,
      innings1: inProgress.innings1,
      originalBattingTeam: inProgress.originalBattingTeam,
      originalFieldingTeam: inProgress.originalFieldingTeam,
      bet: inProgress.bet,
      location: inProgress.location,
      savedState: inProgress.savedState,
    });
  };

  const discardInProgress = () => {
    Alert.alert('Discard Match?', 'This will delete the in-progress match.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: async () => {
        await clearInProgressMatch();
        setInProgress(null);
      }},
    ]);
  };

  const clearHistory = () => {
    setPwdInput('');
    setPwdModal(true);
  };

  const confirmClearHistory = () => {
    if (pwdInput !== '061093') {
      Alert.alert('Wrong Password', 'Incorrect password. Try again.');
      return;
    }
    setPwdModal(false);
    Alert.alert('Clear History', 'Delete all match history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem(HISTORY_KEY);
          setHistory([]);
        },
      },
    ]);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      <View style={s.header}>
        <View>
          <Text style={s.headerGreet}>Welcome back 👋</Text>
          <Text style={s.headerTitle}>Cric<Text style={s.headerAccent}>Score</Text></Text>
        </View>
        {history.length > 0 && (
          <TouchableOpacity style={s.clearBtn} onPress={clearHistory}>
            <Text style={s.clearBtnText}>Clear History</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Start Match Banner */}
      <TouchableOpacity style={s.startBanner} onPress={() => navigation.navigate('SetupTeam')}>
        <View style={s.startBannerLeft}>
          <Text style={s.startBannerTitle}>Start a New Match</Text>
          <Text style={s.startBannerSub}>Create teams · Pick captain · Score live</Text>
        </View>
        <View style={s.startBannerBtn}>
          <Text style={s.startBannerBtnText}>▶</Text>
        </View>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* In-Progress Match */}
        {inProgress && (
          <View style={s.inProgressCard}>
            <View style={s.inProgressHeader}>
              <View style={s.liveDot} />
              <Text style={s.inProgressLabel}>MATCH IN PROGRESS</Text>
            </View>
            <Text style={s.inProgressTeams}>
              {inProgress.battingTeam?.name} vs {inProgress.fieldingTeam?.name}
            </Text>
            <Text style={s.inProgressScore}>
              {inProgress.savedState?.totalRuns ?? 0}/{inProgress.savedState?.wickets ?? 0}
              {'  '}({inProgress.savedState?.currentOver ?? 0}.{inProgress.savedState?.currentBall ?? 0} ov)
              {inProgress.target ? `  •  Target: ${inProgress.target}` : ''}
            </Text>
            <View style={s.inProgressBtns}>
              <TouchableOpacity style={s.resumeBtn} onPress={resumeMatch}>
                <Text style={s.resumeBtnText}>▶ Resume Match</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.discardBtn} onPress={discardInProgress}>
                <Text style={s.discardBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={s.sectionTitle}>📋 Match History ({history.length})</Text>

        {history.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>🏏</Text>
            <Text style={s.emptyText}>No matches played yet</Text>
            <Text style={s.emptySubText}>Start a match to see history here</Text>
          </View>
        ) : (
          history.map((m: any) => (
            <TouchableOpacity
              key={m.id}
              style={s.matchCard}
              onPress={async () => {
                let matchData = m;
                if (DB_RUN && (!m.innings1)) {
                  try {
                    const full = await getMatchFull(m.id);
                    if (full) {
                      const inn1 = full.innings?.find((i: any) => i.innings_number === 1);
                      const inn2 = full.innings?.find((i: any) => i.innings_number === 2);
                      const mapInnings = (inn: any) => inn ? ({
                        runs: inn.total_runs, wickets: inn.total_wickets,
                        overs: inn.overs_played, balls: inn.balls_played,
                        batters: (inn.batters || []).map((b: any) => ({ name: b.player_name, runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes, out: b.is_out })),
                        bowlers: (inn.bowlers || []).map((b: any) => ({ name: b.player_name, overs: b.overs, balls: b.balls, runs: b.runs, wickets: b.wickets })),
                      }) : null;
                      matchData = {
                        ...m,
                        battingTeam: { name: full.team1_name, players: [], captain: '' },
                        fieldingTeam: { name: full.team2_name, players: [], captain: '' },
                        matchType: full.match_type,
                        innings1: mapInnings(inn1),
                        innings2: mapInnings(inn2),
                      };
                    }
                  } catch (_) {}
                }
                if (!matchData.innings1) return;
                navigation.navigate('Scorecard', {
                  battingTeam: matchData.battingTeam,
                  fieldingTeam: matchData.fieldingTeam,
                  overs: matchData.overs,
                  matchType: matchData.matchType,
                  location: matchData.location,
                  innings1: matchData.innings1,
                  innings2: matchData.innings2 || null,
                  isFirstInnings: !matchData.innings2,
                  liveView: false,
                  fromHistory: true,
                  bet: matchData.bet || null,
                });
              }}>
              <View style={s.matchCardTop}>
                <View style={[s.statusChip, m.status === 'completed' ? s.completedChip : s.firstInningsChip]}>
                  <Text style={[s.statusChipText, m.status === 'completed' ? s.completedChipText : s.firstInningsChipText]}>
                    {m.status === 'completed' ? 'COMPLETED' : 'IN PROGRESS'}
                  </Text>
                </View>
                <Text style={s.matchDate}>{m.date}</Text>
              </View>
              <Text style={s.matchTeams}>{m.team1} vs {m.team2}</Text>
              <View style={s.matchScoreRow}>
                <Text style={s.matchScore}>{m.score}</Text>
                <Text style={s.matchOvers}>({m.oversPlayed} ov) · {m.overs} ov match</Text>
              </View>
              {m.result ? <Text style={s.matchResult}>🏆 {m.result}</Text> : null}
              <Text style={s.viewDetail}>Tap to view scorecard →</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Password Modal */}
      <Modal visible={pwdModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>🔒 Enter Password</Text>
            <Text style={s.modalSub}>Password required to clear history</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Enter password"
              placeholderTextColor={C.textMuted}
              secureTextEntry
              value={pwdInput}
              onChangeText={setPwdInput}
              autoFocus
            />
            <TouchableOpacity style={s.modalConfirmBtn} onPress={confirmClearHistory}>
              <Text style={s.modalConfirmText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCancelBtn} onPress={() => setPwdModal(false)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  headerGreet: { color: C.textMuted, fontSize: 12, marginBottom: 2 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: C.text, letterSpacing: 1 },
  headerAccent: { color: C.primary },
  clearBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: C.primaryLight, borderWidth: 1, borderColor: C.primary + '30',
  },
  clearBtnText: { color: C.primary, fontSize: 12, fontWeight: '700' },
  startBanner: {
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    backgroundColor: C.primary, borderRadius: 18, padding: 18,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  startBannerLeft: { flex: 1 },
  startBannerTitle: { color: C.white, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  startBannerSub: { color: '#ffffff99', fontSize: 12 },
  startBannerBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ffffff25', justifyContent: 'center', alignItems: 'center',
  },
  startBannerBtnText: { color: C.white, fontSize: 18 },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12, marginTop: 4 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
  emptySubText: { fontSize: 13, color: C.textMuted },
  matchCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  matchCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  inProgressCard: {
    backgroundColor: C.primary, borderRadius: 18, padding: 16, marginBottom: 16,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  inProgressHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD700' },
  inProgressLabel: { color: '#FFD700', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  inProgressTeams: { color: C.white, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  inProgressScore: { color: '#ffffffcc', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  inProgressBtns: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  resumeBtn: {
    flex: 1, backgroundColor: C.white, borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  resumeBtnText: { color: C.primary, fontWeight: '800', fontSize: 14 },
  discardBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#ffffff20', justifyContent: 'center', alignItems: 'center',
  },
  discardBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  completedChip: { backgroundColor: C.greenLight },
  firstInningsChip: { backgroundColor: C.accentLight },
  statusChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  completedChipText: { color: C.green },
  firstInningsChipText: { color: C.accent },
  matchResult: { fontSize: 12, color: C.green, fontWeight: '700', marginBottom: 4 },
  matchDate: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  matchTeams: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 6 },
  matchScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  matchScore: { fontSize: 22, fontWeight: '900', color: C.primary },
  matchOvers: { fontSize: 12, color: C.textSub },
  viewDetail: { fontSize: 12, color: C.accent, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: '#00000060', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalBox: { backgroundColor: C.white, borderRadius: 20, padding: 24, width: '100%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: C.textSub, marginBottom: 16 },
  modalInput: {
    backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 16,
  },
  modalConfirmBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
  modalConfirmText: { color: C.white, fontWeight: '700', fontSize: 15 },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 8 },
  modalCancelText: { color: C.textSub, fontSize: 14, fontWeight: '600' },
});
