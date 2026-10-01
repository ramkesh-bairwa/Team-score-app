import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, TextInput, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { getInProgressMatch, clearInProgressMatch, getMatches, getMatchFull } from '../services/api';
import Config from 'react-native-config';
import { C } from '../theme/colors';
import { popup, PopupCard, PopupIcon } from '../components/Popup';
import { requestJoin, getJoinStatus, LivePayload } from '../services/live';
import ServerSettings from '../components/ServerSettings';

const DB_RUN = Config.DB_RUN === 'true';
const HISTORY_KEY = 'cricscore_match_history';
const SCORER_NAME_KEY = 'cricscore_scorer_name';
// Wait for a closing popup card to finish animating before opening the next one
const afterClose = (fn: () => void) => setTimeout(fn, 220);

export default function HomeScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<'history'>('history');
  const [history, setHistory] = useState<any[]>([]);
  const [inProgress, setInProgress] = useState<any | null>(null);
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdInput, setPwdInput] = useState('');
  const [joinModal, setJoinModal] = useState(false);
  const [serverModal, setServerModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinState, setJoinState] = useState<'form' | 'sending' | 'waiting'>('form');
  const [joinHost, setJoinHost] = useState('');
  const joinPoll = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopJoinPoll = () => {
    if (joinPoll.current) clearInterval(joinPoll.current);
    joinPoll.current = null;
  };
  useEffect(() => stopJoinPoll, []);

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
      tossWinner: inProgress.tossWinner,
      tossChoice: inProgress.tossChoice,
      live: inProgress.live,
    });
  };

  const openJoin = async () => {
    setJoinCode('');
    setJoinState('form');
    setJoinName((await AsyncStorage.getItem(SCORER_NAME_KEY).catch(() => null)) || '');
    setJoinModal(true);
  };

  const closeJoin = () => {
    stopJoinPoll();
    setJoinModal(false);
  };

  const enterLiveMatch = (code: string, token: string, payload: LivePayload | null | undefined) => {
    const live = { code, token, role: 'scorer' };
    if (!payload) {
      popup.alert('Match Not Started', 'The scorer has not started scoring yet. Try joining again in a moment.', undefined, 'warning');
      return;
    }
    if (payload.phase === 'innings_end') {
      navigation.navigate('Scorecard', { ...payload.scorecardParams, live, liveMirror: true });
    } else {
      navigation.navigate('Scoring', { ...payload.params, savedState: payload.savedState, live });
    }
  };

  const submitJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    const name = joinName.trim();
    if (code.length !== 6) { popup.alert('Invalid Code', 'Enter the 6-character match code shown on the scorer\'s phone.', undefined, 'warning'); return; }
    if (!name) { popup.alert('Name Required', 'Enter your name so the scorer knows who is asking.', undefined, 'warning'); return; }
    setJoinState('sending');
    AsyncStorage.setItem(SCORER_NAME_KEY, name).catch(() => {});
    try {
      const { requestId, hostName } = await requestJoin(code, name);
      setJoinHost(hostName);
      setJoinState('waiting');
      stopJoinPoll();
      joinPoll.current = setInterval(async () => {
        try {
          const st = await getJoinStatus(code, requestId);
          if (st.status === 'pending') return;
          stopJoinPoll();
          setJoinModal(false);
          afterClose(() => {
            if (st.status === 'approved') {
              popup.show({
                type: 'success', title: 'Access Granted', message: `${hostName} approved your request. You can now score this match.`,
                buttons: [{ text: 'Start Scoring', onPress: () => enterLiveMatch(code, st.token!, st.payload) }],
              });
            } else {
              popup.alert('Access Denied', `${hostName} did not allow you to score this match.`, undefined, 'error');
            }
          });
        } catch (e: any) {
          stopJoinPoll();
          setJoinModal(false);
          afterClose(() => popup.alert('Connection Lost', e.message, undefined, 'error'));
        }
      }, 2500);
    } catch (e: any) {
      setJoinState('form');
      popup.alert('Could Not Join', e.message, undefined, 'error');
    }
  };

  const discardInProgress = () => {
    popup.alert('Discard Match?', 'This will delete the in-progress match.', [
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
      setPwdModal(false);
      afterClose(() => popup.alert('Wrong Password', 'Incorrect password. Try again.', [{ text: 'Try Again', onPress: () => { setPwdInput(''); setPwdModal(true); } }], 'error'));
      return;
    }
    setPwdModal(false);
    afterClose(() => popup.alert('Clear History', 'Delete all match history? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem(HISTORY_KEY);
          setHistory([]);
        },
      },
    ]));
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      <View style={s.header}>
        <View>
          <Text style={s.headerGreet}>Welcome back 👋</Text>
          <Text style={s.headerTitle}>Cric<Text style={s.headerAccent}>Score</Text></Text>
        </View>
        <View style={s.headerBtns}>
          {history.length > 0 && (
            <TouchableOpacity style={s.clearBtn} onPress={clearHistory}>
              <Text style={s.clearBtnText}>Clear History</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.gearBtn} onPress={() => setServerModal(true)}>
            <Text style={s.gearText}>⚙️</Text>
          </TouchableOpacity>
        </View>
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

      {/* Join someone else's match */}
      <TouchableOpacity style={s.joinBanner} onPress={openJoin}>
        <Text style={s.joinIcon}>🔗</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.joinTitle}>Join a Match with Code</Text>
          <Text style={s.joinSub}>Score together with another scorer's phone</Text>
        </View>
        <Text style={s.joinArrow}>›</Text>
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

      {/* Password Popup */}
      <PopupCard visible={pwdModal} onRequestClose={() => setPwdModal(false)}>
        <PopupIcon type="warning" icon="🔒" />
        <Text style={s.modalTitle}>Enter Password</Text>
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
        <View style={s.modalBtnRow}>
          <TouchableOpacity style={s.modalCancelBtn} onPress={() => setPwdModal(false)}>
            <Text style={s.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.modalConfirmBtn} onPress={confirmClearHistory}>
            <Text style={s.modalConfirmText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </PopupCard>

      <ServerSettings visible={serverModal} onClose={() => setServerModal(false)} />

      {/* Join Match Popup */}
      <PopupCard visible={joinModal} onRequestClose={closeJoin}>
        {joinState === 'waiting' ? (
          <>
            <PopupIcon type="info" icon="⏳" />
            <Text style={s.modalTitle}>Waiting for Approval</Text>
            <Text style={s.modalSub}>
              Asked {joinHost || 'the scorer'} for access to match {joinCode.toUpperCase()}.{'\n'}Keep this screen open.
            </Text>
            <ActivityIndicator color={C.accent} size="large" style={{ marginVertical: 8 }} />
            <TouchableOpacity style={[s.modalCancelBtn, s.modalCancelFull]} onPress={closeJoin}>
              <Text style={s.modalCancelText}>Cancel Request</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <PopupIcon type="info" icon="🔗" />
            <Text style={s.modalTitle}>Join a Match</Text>
            <Text style={s.modalSub}>Enter the code shown on the scorer's phone. They will need to allow you.</Text>
            <TextInput
              style={[s.modalInput, s.codeInput]}
              placeholder="ABC123"
              placeholderTextColor={C.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              value={joinCode}
              onChangeText={v => setJoinCode(v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
              autoFocus
            />
            <TextInput
              style={s.modalInput}
              placeholder="Your name"
              placeholderTextColor={C.textMuted}
              value={joinName}
              onChangeText={setJoinName}
            />
            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={closeJoin}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalConfirmBtn, { backgroundColor: C.accent }]} onPress={submitJoin} disabled={joinState === 'sending'}>
                {joinState === 'sending'
                  ? <ActivityIndicator color={C.white} />
                  : <Text style={s.modalConfirmText}>Request Access</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </PopupCard>
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
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gearBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: C.divider,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.cardBorder,
  },
  gearText: { fontSize: 16 },
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
  joinBanner: {
    marginHorizontal: 16, marginTop: 10, backgroundColor: C.white, borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: C.accent + '30',
  },
  joinIcon: { fontSize: 22 },
  joinTitle: { fontSize: 14, fontWeight: '800', color: C.accent },
  joinSub: { fontSize: 12, color: C.textSub, marginTop: 1 },
  joinArrow: { fontSize: 26, color: C.accent, fontWeight: '300' },
  modalTitle: { fontSize: 19, fontWeight: '800', color: C.text, marginBottom: 6, textAlign: 'center' },
  modalSub: { fontSize: 14, color: C.textSub, marginBottom: 16, textAlign: 'center', lineHeight: 20 },
  modalInput: {
    alignSelf: 'stretch', backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 12,
  },
  codeInput: { fontSize: 24, fontWeight: '900', letterSpacing: 8, textAlign: 'center' },
  modalBtnRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 6 },
  modalConfirmBtn: { flex: 1, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  modalConfirmText: { color: C.white, fontWeight: '700', fontSize: 15 },
  modalCancelBtn: {
    flex: 1, backgroundColor: C.divider, borderRadius: 14, paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: C.cardBorder,
  },
  modalCancelFull: { flex: 0, alignSelf: 'stretch', marginTop: 8 },
  modalCancelText: { color: C.textSub, fontSize: 15, fontWeight: '700' },
});
