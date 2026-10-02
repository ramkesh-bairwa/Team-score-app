import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, TextInput, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import {
  getInProgressMatch, clearInProgressMatch, listMatches, getMatch, clearMyMatches,
  pendingMatchCount, syncPendingMatches,
} from '../services/api';
import { C } from '../theme/colors';
import { popup, PopupCard, PopupIcon } from '../components/Popup';
import { requestJoin, getJoinStatus, takeOverScoring, LivePayload, LiveSession, JoinRole } from '../services/live';
import { isServerConfigured, setApiUrl } from '../services/server';
import { scanQrFromImage } from '../utils/qrScan';
import ServerSettings from '../components/ServerSettings';
import { pendingTeamCount, isServerReachable, syncPendingTeams } from '../services/teams';

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
  // Teams saved offline, shown with a Sync option once the server is reachable
  const [pendingTeams, setPendingTeams] = useState(0);
  const [teamsOnline, setTeamsOnline] = useState(false);
  const [syncingTeams, setSyncingTeams] = useState(false);
  const [pendingMatches, setPendingMatches] = useState(0);
  const [historyOffline, setHistoryOffline] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinState, setJoinState] = useState<'form' | 'sending' | 'waiting'>('form');
  const [joinHost, setJoinHost] = useState('');
  const [scanning, setScanning] = useState(false);
  const [joinRole, setJoinRole] = useState<JoinRole>('streamer');
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
      checkPendingTeams();
    }, [])
  );

  // Match history comes from the match API (falls back to this phone's copy when offline)
  const loadHistory = async () => {
    try {
      const r = await listMatches();
      setHistory(r.matches);
      setHistoryOffline(r.offline);
    } catch (_) {}
  };

  // Teams and matches saved while offline; matches upload by themselves once the server is reachable
  const checkPendingTeams = async () => {
    const n = await pendingTeamCount();
    const m = await pendingMatchCount();
    setPendingTeams(n);
    setPendingMatches(m);
    if (n || m) {
      const online = await isServerReachable();
      setTeamsOnline(online);
      if (online && m) {
        await syncPendingMatches().catch(() => null);
        setPendingMatches(await pendingMatchCount());
        loadHistory();
      }
    }
  };

  // Re-check every 15s while something is waiting, so Sync appears as soon as the net is back
  useEffect(() => {
    if ((!pendingTeams && !pendingMatches) || teamsOnline) return;
    const t = setInterval(checkPendingTeams, 15000);
    return () => clearInterval(t);
  }, [pendingTeams, pendingMatches, teamsOnline]);

  const syncTeams = async () => {
    setSyncingTeams(true);
    try {
      const m = await syncPendingMatches().catch(() => ({ synced: 0, offline: true }));
      const r = await syncPendingTeams();
      if (m.synced) loadHistory();
      if (r.failed.length) {
        popup.alert('Synced With Problems', `Synced ${r.synced}.\n\n${r.failed.map(f => `• ${f.name}: ${f.error}`).join('\n')}`, undefined, 'warning');
      } else if (r.offline) {
        popup.alert('Sync Paused', `Synced ${r.synced}. The connection dropped; try again later.`, undefined, 'warning');
      } else {
        popup.alert('Teams Synced', `${r.synced} team change${r.synced === 1 ? '' : 's'} uploaded for everyone.`, undefined, 'success');
      }
    } finally {
      setSyncingTeams(false);
      checkPendingTeams();
    }
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
      matchId: inProgress.matchId,
      matchKey: inProgress.matchKey,
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

  const enterLiveMatch = async (code: string, token: string, name: string, payload: LivePayload | null | undefined) => {
    const live: LiveSession = { code, token, role: 'scorer' };
    if (!payload) {
      popup.alert('Match Not Started', 'The scorer has not started scoring yet. Try joining again in a moment.', undefined, 'warning');
      return;
    }
    // This phone becomes the only scorer; the other phone's scoring closes
    try {
      await takeOverScoring(live, name);
    } catch (e: any) {
      popup.alert('Could Not Start Scoring', e.message, undefined, 'error');
      return;
    }
    if (payload.phase === 'innings_end') {
      navigation.navigate('Scorecard', { ...payload.scorecardParams, live, liveMirror: true });
    } else {
      navigation.navigate('Scoring', { ...payload.params, savedState: payload.savedState, live });
    }
  };

  const submitJoin = async (codeArg?: string, roleArg?: JoinRole) => {
    const code = (codeArg ?? joinCode).trim().toUpperCase();
    const role = roleArg ?? joinRole;
    const name = joinName.trim();
    if (code.length !== 6) { popup.alert('Invalid Code', 'Enter the 6-character match code shown on the scorer\'s phone.', undefined, 'warning'); return; }
    if (!name) { popup.alert('Name Required', 'Enter your name so the scorer knows who is asking.', undefined, 'warning'); return; }
    if (!(await isServerConfigured())) {
      popup.show({
        type: 'warning', icon: '🖥️', title: 'Set Server Address',
        message: 'Scan the QR code instead (it sets the server automatically), or enter the server address first.',
        buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Set Address', onPress: () => setServerModal(true) }],
      });
      return;
    }
    setJoinState('sending');
    AsyncStorage.setItem(SCORER_NAME_KEY, name).catch(() => {});
    try {
      const { requestId, hostName } = await requestJoin(code, name, role);
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
            if (st.status === 'approved' && st.role === 'streamer') {
              popup.show({
                type: 'success', icon: '📺', title: 'Connected as Live Stream',
                message: `${hostName} approved this phone as the live-stream device. You'll see the score in real time and can go live on YouTube.`,
                buttons: [{ text: 'Open Live Stream', onPress: () => navigation.navigate('LiveStream', { code, token: st.token, name }) }],
              });
            } else if (st.status === 'approved') {
              popup.show({
                type: 'success', title: 'Access Granted',
                message: `${hostName} approved your request. When you start, scoring moves to this phone and closes on theirs.`,
                buttons: [{ text: 'Start Scoring', onPress: () => enterLiveMatch(code, st.token!, name, st.payload) }],
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

  const scanJoin = async (source: 'camera' | 'gallery') => {
    setScanning(true);
    try {
      const link = await scanQrFromImage(source);
      if (!link) return;
      // The QR carries the server address, so the joining phone needs no setup
      if (link.server) await setApiUrl(link.server);
      setJoinCode(link.code);
      if (link.role) setJoinRole(link.role);
      if (joinName.trim()) submitJoin(link.code, link.role);
      else popup.alert('Code Scanned ✅', `Match ${link.code} found. Enter your name and tap Request Access.`, undefined, 'success');
    } catch (e: any) {
      popup.alert('Scan Failed', e.message, undefined, 'error');
    } finally {
      setScanning(false);
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
          await clearMyMatches();
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

      {/* Offline team changes waiting to sync */}
      {pendingTeams + pendingMatches > 0 && (
        <View style={[s.syncBanner, !teamsOnline && s.syncBannerOff]}>
          <Text style={s.syncBannerText}>
            {(() => {
              const parts = [
                pendingTeams ? `${pendingTeams} team change${pendingTeams === 1 ? '' : 's'}` : '',
                pendingMatches ? `${pendingMatches} match${pendingMatches === 1 ? '' : 'es'}` : '',
              ].filter(Boolean).join(' + ');
              return teamsOnline ? `☁️ ${parts} ready to sync` : `📴 ${parts} saved offline`;
            })()}
          </Text>
          {teamsOnline && (
            <TouchableOpacity style={s.syncBannerBtn} onPress={syncTeams} disabled={syncingTeams}>
              {syncingTeams ? <ActivityIndicator color={C.white} size="small" /> : <Text style={s.syncBannerBtnText}>Sync</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Shared teams */}
      <TouchableOpacity style={[s.joinBanner, s.teamsBanner]} onPress={() => navigation.navigate('Teams')}>
        <Text style={s.joinIcon}>👥</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.joinTitle, s.teamsTitle]}>Teams</Text>
          <Text style={s.joinSub}>Create a team once, everyone can play with it</Text>
        </View>
        <Text style={[s.joinArrow, s.teamsTitle]}>›</Text>
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
        {historyOffline && <Text style={s.offlineNote}>📴 Offline · showing matches saved on this phone</Text>}

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
                // Full match (innings + ball-by-ball) from this phone's copy or the match API
                setOpeningId(m.id);
                try {
                  const full = await getMatch(m.id);
                  if (!full?.innings1) {
                    popup.alert('Match In Progress', 'The scorecard is available once the first innings is complete.', undefined, 'info');
                    return;
                  }
                  navigation.navigate('Scorecard', {
                    battingTeam: full.team1,
                    fieldingTeam: full.team2,
                    overs: full.overs,
                    matchType: full.matchType,
                    location: full.location,
                    tossWinner: full.tossWinner,
                    tossChoice: full.tossChoice,
                    innings1: full.innings1,
                    innings2: full.innings2 || null,
                    isFirstInnings: !full.innings2,
                    liveView: false,
                    fromHistory: true,
                    bet: full.bet || null,
                  });
                } catch (e: any) {
                  popup.alert('Could Not Open Match', e.message, undefined, 'error');
                } finally {
                  setOpeningId(null);
                }
              }}>
              <View style={s.matchCardTop}>
                <View style={s.chipRow}>
                  <View style={[s.statusChip, m.status === 'completed' ? s.completedChip : s.firstInningsChip]}>
                    <Text style={[s.statusChipText, m.status === 'completed' ? s.completedChipText : s.firstInningsChipText]}>
                      {m.status === 'completed' ? 'COMPLETED' : m.status === 'innings_break' ? 'INNINGS BREAK' : 'LIVE'}
                    </Text>
                  </View>
                  {m.pending && <Text style={s.pendingChip}>NOT UPLOADED</Text>}
                </View>
                <Text style={s.matchDate}>{m.date}</Text>
              </View>
              <Text style={s.matchTeams}>{m.team1} vs {m.team2}</Text>
              {!!m.score && (
                <View style={s.matchScoreRow}>
                  <Text style={s.matchScore}>{m.score}</Text>
                  <Text style={s.matchOvers}>({m.oversPlayed} ov){m.score2 ? `  ·  ${m.team2} ${m.score2} (${m.oversPlayed2})` : ''}</Text>
                </View>
              )}
              {m.result ? <Text style={s.matchResult}>🏆 {m.result}</Text> : null}
              <Text style={s.viewDetail}>
                {openingId === m.id ? 'Opening…' : `${m.overs} ov${m.ballType ? ` · ${m.ballType} ball` : ''} · Tap to view scorecard →`}
              </Text>
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
            <Text style={s.modalSub}>Scan the scorer's QR code or type their code. They will need to allow you.</Text>
            <View style={s.scanRow}>
              <TouchableOpacity style={s.scanBtn} onPress={() => scanJoin('camera')} disabled={scanning}>
                {scanning ? <ActivityIndicator color={C.white} /> : <Text style={s.scanBtnText}>📷  Scan QR</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.scanBtn, s.scanBtnGhost]} onPress={() => scanJoin('gallery')} disabled={scanning}>
                <Text style={[s.scanBtnText, s.scanBtnGhostText]}>🖼️  From Photo</Text>
              </TouchableOpacity>
            </View>
            <View style={s.orRow}>
              <View style={s.orLine} /><Text style={s.orText}>or enter code</Text><View style={s.orLine} />
            </View>
            <TextInput
              style={[s.modalInput, s.codeInput]}
              placeholder="ABC123"
              placeholderTextColor={C.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              value={joinCode}
              onChangeText={v => setJoinCode(v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
            />
            <TextInput
              style={s.modalInput}
              placeholder="Your name"
              placeholderTextColor={C.textMuted}
              value={joinName}
              onChangeText={setJoinName}
            />
            <Text style={s.roleLabel}>THIS PHONE WILL</Text>
            <View style={s.roleRow}>
              {([
                { key: 'streamer', title: '📺 Live Stream', sub: 'Camera + YouTube' },
                { key: 'scorer', title: '🏏 Take Over Scoring', sub: 'Other phone stops' },
              ] as const).map(r => (
                <TouchableOpacity key={r.key} style={[s.roleBtn, joinRole === r.key && s.roleBtnOn]} onPress={() => setJoinRole(r.key)}>
                  <Text style={[s.roleTitle, joinRole === r.key && s.roleTitleOn]}>{r.title}</Text>
                  <Text style={s.roleSub}>{r.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={closeJoin}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalConfirmBtn, { backgroundColor: C.accent }]} onPress={() => submitJoin()} disabled={joinState === 'sending'}>
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
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingChip: { fontSize: 9, fontWeight: '900', color: C.orange, backgroundColor: C.orangeLight, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  offlineNote: { fontSize: 12, fontWeight: '700', color: C.orange, marginBottom: 8 },
  syncBanner: {
    marginHorizontal: 16, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.accentLight, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: C.accent + '40',
  },
  syncBannerOff: { backgroundColor: C.orangeLight, borderColor: C.orange + '40' },
  syncBannerText: { flex: 1, fontSize: 13, fontWeight: '800', color: C.text },
  syncBannerBtn: { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7, minWidth: 64, alignItems: 'center' },
  syncBannerBtnText: { color: C.white, fontSize: 13, fontWeight: '900' },
  teamsBanner: { borderColor: C.green + '40' },
  teamsTitle: { color: C.green },
  joinTitle: { fontSize: 14, fontWeight: '800', color: C.accent },
  joinSub: { fontSize: 12, color: C.textSub, marginTop: 1 },
  joinArrow: { fontSize: 26, color: C.accent, fontWeight: '300' },
  modalTitle: { fontSize: 19, fontWeight: '800', color: C.text, marginBottom: 6, textAlign: 'center' },
  modalSub: { fontSize: 14, color: C.textSub, marginBottom: 16, textAlign: 'center', lineHeight: 20 },
  modalInput: {
    alignSelf: 'stretch', backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 12,
  },
  roleLabel: { alignSelf: 'flex-start', fontSize: 10, fontWeight: '900', color: C.textMuted, letterSpacing: 1, marginBottom: 6 },
  roleRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginBottom: 12 },
  roleBtn: { flex: 1, borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: C.cardBorder, backgroundColor: C.bg },
  roleBtnOn: { borderColor: C.accent, backgroundColor: C.accentLight },
  roleTitle: { fontSize: 12, fontWeight: '900', color: C.textSub },
  roleTitleOn: { color: C.accent },
  roleSub: { fontSize: 10, color: C.textMuted, marginTop: 2 },
  scanRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  scanBtn: { flex: 1, backgroundColor: C.text, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  scanBtnGhost: { backgroundColor: C.divider, borderWidth: 1, borderColor: C.cardBorder },
  scanBtnText: { color: C.white, fontSize: 14, fontWeight: '800' },
  scanBtnGhostText: { color: C.text },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginVertical: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: C.cardBorder },
  orText: { fontSize: 11, color: C.textMuted, fontWeight: '700' },
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
