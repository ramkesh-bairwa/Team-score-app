import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Modal, BackHandler,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { saveInProgressMatch, clearInProgressMatch } from '../services/api';
import {
  LiveSession, LivePayload, createLiveSession, pushLiveState, pullLiveState,
  getPendingRequests, respondToRequest,
} from '../services/live';
import { popup } from '../components/Popup';
import Celebration, { CelebrationEvent } from '../components/Celebration';
import OverChart, { OverStat } from '../components/OverChart';
import YouTubeLiveSheet from '../components/YouTubeLiveSheet';
import ServerSettings from '../components/ServerSettings';
import { C } from '../theme/colors';

// extra: 'wd' | 'nb' | 'lb' | 'b' | 'db' (dead ball: shown in the over, never counted)
type Ball = { runs: number; extra?: string; wicket?: boolean };
type PlayerScore = { name: string; runs: number; balls: number; fours: number; sixes: number; out: boolean; howOut?: string };
type BowlerScore = { name: string; overs: number; balls: number; runs: number; wickets: number };

function initBatter(name: string): PlayerScore {
  return { name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
}
function initBowler(name: string): BowlerScore {
  return { name, overs: 0, balls: 0, runs: 0, wickets: 0 };
}
const overStat = (o: Ball[], live?: boolean): OverStat => ({
  runs: o.reduce((sum, b) => sum + b.runs, 0),
  wickets: o.filter(b => b.wicket).length,
  live,
});
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const MAX_UNDO = 12;
const HEADER_BG = '#0B1730';

export default function ScoringScreen({ navigation, route }: any) {
  const { battingTeam, fieldingTeam, overs, matchType, target, innings1, originalBattingTeam, originalFieldingTeam, bet, location, tossWinner, tossChoice } = route.params;
  const isSecondInnings = !!target;
  const isLocal = matchType === 'local';
  const inningsNum: 1 | 2 = isSecondInnings ? 2 : 1;
  const scoringParams = {
    battingTeam, fieldingTeam, overs, matchType, target, innings1,
    originalBattingTeam, originalFieldingTeam, bet, location, tossWinner, tossChoice,
  };
  const isFocused = useIsFocused();

  // Restore from saved state if resuming
  const saved = route.params.savedState;

  const [totalRuns, setTotalRuns] = useState(saved?.totalRuns ?? 0);
  const [wickets, setWickets] = useState(saved?.wickets ?? 0);
  const [currentOver, setCurrentOver] = useState(saved?.currentOver ?? 0);
  const [currentBall, setCurrentBall] = useState(saved?.currentBall ?? 0);
  const [balls, setBalls] = useState<Ball[]>(saved?.balls ?? []);
  const [overHistory, setOverHistory] = useState<Ball[][]>(saved?.overHistory ?? []);
  const [batters, setBatters] = useState<PlayerScore[]>(saved?.batters ?? [
    initBatter(battingTeam.players[0]),
    initBatter(battingTeam.players[1]),
  ]);
  const [strikerIdx, setStrikerIdx] = useState(saved?.strikerIdx ?? 0);
  const [nextBatterIdx, setNextBatterIdx] = useState(saved?.nextBatterIdx ?? 2);
  const [bowlers, setBowlers] = useState<BowlerScore[]>(saved?.bowlers ?? [initBowler(fieldingTeam.players[0])]);
  const [currentBowlerIdx, setCurrentBowlerIdx] = useState(saved?.currentBowlerIdx ?? 0);
  // Batters who are out and have been replaced at the crease (kept for the scorecard)
  const [dismissed, setDismissed] = useState<PlayerScore[]>(saved?.dismissed ?? []);
  const [undoStack, setUndoStack] = useState<any[]>(saved?.undoStack ?? []);

  const [tab, setTab] = useState<'score' | 'graph'>('score');
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const [youtubeSheet, setYoutubeSheet] = useState(false);
  const [serverModal, setServerModal] = useState(false);

  const [selectBowlerModal, setSelectBowlerModal] = useState(false);
  const [bowlerChangeManual, setBowlerChangeManual] = useState(false);
  const [selectBatterModal, setSelectBatterModal] = useState(false);
  const [wicketModal, setWicketModal] = useState(false);
  const [directionModal, setDirectionModal] = useState(false);
  const [pendingBall, setPendingBall] = useState<{ run: number; extra?: string; isWicket?: boolean } | null>(null);

  // Live sharing: set when this match is shared via code, or joined from another phone
  const [live, setLive] = useState<LiveSession | null>(route.params.live ?? null);
  const liveRef = useRef<LiveSession | null>(live);
  const versionRef = useRef(0);
  const pendingPushes = useRef(0);
  const localEditSeq = useRef(0);
  const seenRequests = useRef(new Set<string>());
  // Resumed/joined state is already what the server has; don't re-push it on mount
  const skipPush = useRef(!!saved);

  // Leaving mid-match saves progress and returns Home, where it can be resumed
  const confirmLeave = () => {
    popup.show({
      type: 'warning', icon: '🏠', title: 'Leave Match?',
      message: 'Your match is saved. You can resume it from the Home screen.',
      buttons: [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', onPress: () => { persistState(); navigation.navigate('Home'); } },
      ],
    });
  };

  // Hardware back asks for confirmation instead of popping the stack (only while this screen is shown)
  useEffect(() => {
    if (!isFocused) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmLeave();
      return true;
    });
    return () => sub.remove();
  }, [isFocused]);

  // Save state to AsyncStorage on every meaningful change
  const stateRef = useRef<any>({});
  useEffect(() => {
    stateRef.current = { totalRuns, wickets, currentOver, currentBall, balls, overHistory, batters, strikerIdx, nextBatterIdx, bowlers, currentBowlerIdx, dismissed, undoStack };
  });

  const persistState = (overrides: any = {}) => {
    const state = { ...stateRef.current, ...overrides };
    saveInProgressMatch({
      ...scoringParams,
      savedState: state,
      isSecondInnings,
      live: liveRef.current,
    }).catch(() => {});
  };

  const pushLive = (payload: LivePayload) => {
    const l = liveRef.current;
    if (!l) return;
    pendingPushes.current++;
    pushLiveState(l, payload).then(v => {
      pendingPushes.current--;
      if (v) versionRef.current = Math.max(versionRef.current, v);
    });
  };

  // Every scoring change (balls, swaps, new batter/bowler) is saved locally and sent to co-scorers
  useEffect(() => {
    if (skipPush.current) { skipPush.current = false; return; }
    localEditSeq.current++;
    persistState();
    pushLive({ phase: 'scoring', inningsNum, params: scoringParams, savedState: stateRef.current });
  }, [totalRuns, wickets, currentOver, currentBall, balls, overHistory, batters, strikerIdx, nextBatterIdx, bowlers, currentBowlerIdx, dismissed, undoStack]);

  const applyRemoteState = (st: any) => {
    if (!st) return;
    // Called from the polling interval, so compare against the ref rather than stale render values
    const cur = stateRef.current;
    skipPush.current = true;
    // Close pickers the other scorer has already resolved
    if (st.nextBatterIdx > cur.nextBatterIdx) setSelectBatterModal(false);
    if (st.currentBowlerIdx !== cur.currentBowlerIdx || st.bowlers.length !== cur.bowlers.length) setSelectBowlerModal(false);
    setTotalRuns(st.totalRuns);
    setWickets(st.wickets);
    setCurrentOver(st.currentOver);
    setCurrentBall(st.currentBall);
    setBalls(st.balls);
    setOverHistory(st.overHistory);
    setBatters(st.batters);
    setStrikerIdx(st.strikerIdx);
    setNextBatterIdx(st.nextBatterIdx);
    setBowlers(st.bowlers);
    setCurrentBowlerIdx(st.currentBowlerIdx);
    setDismissed(st.dismissed ?? []);
    setUndoStack(st.undoStack ?? []);
    persistState(st);
  };

  const applyRemote = (payload: LivePayload) => {
    const l = liveRef.current;
    if (payload.inningsNum < inningsNum) return; // stale update from the previous innings
    if (payload.phase === 'innings_end') {
      if (payload.inningsNum !== inningsNum) return;
      clearInProgressMatch().catch(() => {});
      navigation.navigate('Scorecard', { ...payload.scorecardParams, live: l, liveMirror: true });
    } else if (payload.inningsNum > inningsNum) {
      navigation.replace('Scoring', { ...payload.params, savedState: payload.savedState, live: l });
    } else {
      applyRemoteState(payload.savedState);
    }
  };

  const askAccess = (l: LiveSession, req: { id: string; name: string }) => {
    popup.show({
      type: 'confirm', icon: '🙋', dismissable: false,
      title: 'Scoring Access Request',
      message: `${req.name} wants to score this match from their phone. Allow access?`,
      buttons: [
        { text: 'Deny', style: 'cancel', onPress: () => { respondToRequest(l, req.id, false).catch(() => {}); } },
        { text: 'Allow', onPress: () => {
          respondToRequest(l, req.id, true)
            .then(() => popup.alert('Access Given', `${req.name} can now score this match.`, undefined, 'success'))
            .catch((e: any) => popup.alert('Could Not Give Access', e.message, undefined, 'error'));
        }},
      ],
    });
  };

  // Poll for co-scorer updates (and, for the match owner, access requests) while on screen
  useEffect(() => {
    if (!live || !isFocused) return;
    let stopped = false;
    const tick = async () => {
      try {
        const seq = localEditSeq.current;
        const r = await pullLiveState(live, versionRef.current);
        // Skip if a local change happened meanwhile; our own push will win
        if (!stopped && r.changed && pendingPushes.current === 0 && seq === localEditSeq.current) {
          versionRef.current = r.version;
          if (!r.fromMe && r.payload) applyRemote(r.payload);
        }
        if (!stopped && live.role === 'host') {
          const reqs = await getPendingRequests(live);
          reqs.filter(q => !seenRequests.current.has(q.id)).forEach(q => {
            seenRequests.current.add(q.id);
            askAccess(live, q);
          });
        }
      } catch (e: any) {
        // Server restarted and forgot the match: re-register it with the current score
        if (e?.status === 404 && live.role === 'host') {
          pushLive({ phase: 'scoring', inningsNum, params: scoringParams, savedState: stateRef.current });
        }
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => { stopped = true; clearInterval(id); };
  }, [live, isFocused]);

  const showCode = (l: LiveSession) => {
    popup.show({
      type: 'success', icon: '📲', title: 'Match Code',
      message: l.role === 'host'
        ? 'On the other phone open CricScore → "Join a Match with Code" and enter this code. You will be asked to allow them first.'
        : 'Share this code with another scorer. The match owner must allow them before they can score.',
      highlight: l.code,
      buttons: [{ text: 'Done' }],
    });
  };

  // Creates the live session on first use (shared by co-scoring and the YouTube overlay)
  const ensureSession = async (): Promise<LiveSession | null> => {
    if (liveRef.current) return liveRef.current;
    try {
      const name = (await AsyncStorage.getItem('cricscore_scorer_name').catch(() => null)) || 'the match scorer';
      const sess = await createLiveSession(name, {
        phase: 'scoring', inningsNum, params: scoringParams, savedState: stateRef.current,
      });
      versionRef.current = 1;
      liveRef.current = sess;
      setLive(sess);
      persistState();
      return sess;
    } catch (e: any) {
      popup.show({
        type: 'error', title: 'Could Not Go Live', message: e.message,
        buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Server Address', onPress: () => setServerModal(true) }],
      });
      return null;
    }
  };

  const createShare = async () => {
    const sess = await ensureSession();
    if (sess) showCode(sess);
  };

  const openYoutube = async () => {
    if (await ensureSession()) setYoutubeSheet(true);
  };

  const shareMatch = () => {
    if (live) { showCode(live); return; }
    popup.show({
      type: 'info', icon: '🔗', title: 'Share Scoring?',
      message: 'Get a code another phone can use to score this match with you. Nobody gets access until you allow them.',
      buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Get Code', onPress: createShare }],
    });
  };

  const swapStrike = () => setStrikerIdx(strikerIdx === 0 ? 1 : 0);

  // Snapshot taken before every delivery so it can be undone
  const pushUndo = () => {
    const core = { ...stateRef.current };
    delete core.undoStack;
    setUndoStack(st => [...st.slice(-(MAX_UNDO - 1)), core]);
  };

  const undoLastBall = () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) {
      popup.alert('Nothing to Undo', 'No deliveries left to undo in this innings.', undefined, 'info');
      return;
    }
    setTotalRuns(last.totalRuns);
    setWickets(last.wickets);
    setCurrentOver(last.currentOver);
    setCurrentBall(last.currentBall);
    setBalls(last.balls);
    setOverHistory(last.overHistory);
    setBatters(last.batters);
    setStrikerIdx(last.strikerIdx);
    setNextBatterIdx(last.nextBatterIdx);
    setBowlers(last.bowlers);
    setCurrentBowlerIdx(last.currentBowlerIdx);
    setDismissed(last.dismissed ?? []);
    setUndoStack(undoStack.slice(0, -1));
    setSelectBatterModal(false);
    setSelectBowlerModal(false);
  };

  const deadBall = () => {
    pushUndo();
    setBalls([...balls, { runs: 0, extra: 'db' }]);
  };

  const changeBowler = () => {
    setBowlerChangeManual(true);
    setSelectBowlerModal(true);
  };

  const nonStrikerIdx = strikerIdx === 0 ? 1 : 0;
  const striker = batters[strikerIdx];
  const nonStriker = batters[nonStrikerIdx];
  const currentBowler = bowlers[currentBowlerIdx];
  const totalBalls = currentOver * 6 + currentBall;
  const maxBalls = overs * 6;
  const oversDisplay = `${currentOver}.${currentBall}`;
  const crr = totalBalls > 0 ? ((totalRuns / totalBalls) * 6).toFixed(2) : '0.00';
  const ballsLeft = Math.max(0, maxBalls - totalBalls);
  const runsNeeded = isSecondInnings ? Math.max(0, target - totalRuns) : 0;
  const rrr = isSecondInnings && ballsLeft > 0 ? ((runsNeeded / ballsLeft) * 6).toFixed(2) : null;
  const projected = totalBalls > 0 ? Math.round((totalRuns / totalBalls) * maxBalls) : 0;
  const allBatters = [...dismissed, ...batters];

  let statusText: string;
  if (isSecondInnings) {
    statusText = runsNeeded === 0
      ? `${battingTeam.name} have reached the target! 🎉`
      : `Need ${plural(runsNeeded, 'run')} in ${plural(ballsLeft, 'ball')}`;
  } else {
    statusText = totalBalls === 0
      ? `${battingTeam.name} to bat · ${overs} overs`
      : `Projected score ${projected} at ${crr} RPO`;
  }

  const allBalls = [...overHistory.flat(), ...balls];
  const thisOverRuns = balls.reduce((sum, b) => sum + b.runs, 0);
  const chartData: OverStat[] = [...overHistory.map(o => overStat(o)), ...(balls.length ? [overStat(balls, true)] : [])];
  const compareData: OverStat[] | undefined = innings1?.overHistory?.map((o: Ball[]) => overStat(o));
  const fours = allBalls.filter(b => b.runs === 4 && !b.extra).length;
  const sixes = allBalls.filter(b => b.runs === 6 && !b.extra).length;
  const dots = allBalls.filter(b => b.runs === 0 && !b.extra && !b.wicket).length;
  const extras = allBalls.filter(b => b.extra && b.extra !== 'db').reduce((sum, b) => sum + b.runs, 0);
  const bestOver = overHistory.reduce((best, o, i) => {
    const r = overStat(o).runs;
    return r > best.runs ? { runs: r, over: i + 1 } : best;
  }, { runs: -1, over: 0 });

  const handleRunPress = (run: number, extra?: string, isWicket?: boolean) => {
    if (run > 0 && !isWicket) {
      setPendingBall({ run, extra, isWicket });
      setDirectionModal(true);
    } else {
      addBall(run, extra, isWicket);
    }
  };

  const addBall = (run: number, extra?: string, isWicket?: boolean) => {
    pushUndo();
    // Local match: wide/no-ball = 0 extra run, counts as legal ball
    const actualRun = isLocal && (extra === 'wd' || extra === 'nb') ? 0 : run;
    const actualExtra = isLocal && (extra === 'wd' || extra === 'nb') ? undefined : extra;
    const ball: Ball = { runs: actualRun, extra: actualExtra, wicket: isWicket };
    const newBalls = [...balls, ball];
    const isLegal = !actualExtra || actualExtra === 'lb' || actualExtra === 'b';

    // Update bowler
    const updatedBowlers = [...bowlers];
    updatedBowlers[currentBowlerIdx] = {
      ...currentBowler,
      runs: currentBowler.runs + actualRun,
      balls: isLegal ? currentBowler.balls + 1 : currentBowler.balls,
      wickets: isWicket ? currentBowler.wickets + 1 : currentBowler.wickets,
    };

    // Update batter
    const updatedBatters = [...batters];
    if (!actualExtra || actualExtra === 'lb' || actualExtra === 'b') {
      updatedBatters[strikerIdx] = {
        ...striker,
        runs: actualExtra ? striker.runs : striker.runs + actualRun,
        balls: striker.balls + 1,
        fours: actualRun === 4 && !actualExtra ? striker.fours + 1 : striker.fours,
        sixes: actualRun === 6 && !actualExtra ? striker.sixes + 1 : striker.sixes,
      };
    }

    if (!actualExtra && !isWicket && (actualRun === 4 || actualRun === 6)) {
      setCelebration({ kind: actualRun === 6 ? 'six' : 'four', batter: striker.name, id: Date.now() });
    }

    setTotalRuns((r: number) => r + actualRun);
    setBowlers(updatedBowlers);
    setBatters(updatedBatters);

    let newBall = currentBall;
    let newOver = currentOver;
    let newStrikerIdx = strikerIdx;

    if (isLegal) {
      newBall = currentBall + 1;
      if (actualRun % 2 !== 0 && !isWicket) {
        newStrikerIdx = nonStrikerIdx;
        setStrikerIdx(nonStrikerIdx);
      }

      if (newBall === 6) {
        setOverHistory(h => [...h, newBalls]);
        setBalls([]);
        newBall = 0;
        newOver = currentOver + 1;
        newStrikerIdx = newStrikerIdx === 0 ? 1 : 0;
        setStrikerIdx(newStrikerIdx);
        updatedBowlers[currentBowlerIdx].overs = newOver;
        setBowlers(updatedBowlers);
        if (newOver < overs) { setBowlerChangeManual(false); setSelectBowlerModal(true); }
      } else {
        setBalls(newBalls);
      }
    } else {
      setBalls(newBalls);
    }

    setCurrentBall(newBall === 6 ? 0 : newBall);
    setCurrentOver(newOver);

    if (isWicket) {
      setWickets((w: number) => w + 1);
      updatedBatters[strikerIdx] = { ...updatedBatters[strikerIdx], out: true };
      setBatters(updatedBatters);
      if (nextBatterIdx < battingTeam.players.length) {
        setSelectBatterModal(true);
      }
    }

    const newTotalRuns = totalRuns + actualRun;
    const newWickets = wickets + (isWicket ? 1 : 0);
    const chaseWon = isSecondInnings && newTotalRuns >= target;
    const allOut = newWickets >= battingTeam.players.length - 1;
    const inningsEnded = chaseWon || newOver >= overs || (isWicket && allOut);

    // Persist state after every ball
    persistState({
      totalRuns: newTotalRuns, wickets: newWickets,
      currentOver: newOver, currentBall: newBall === 6 ? 0 : newBall,
      balls: newBall === 6 ? [] : newBalls,
      batters: updatedBatters, bowlers: updatedBowlers,
      strikerIdx: newStrikerIdx, nextBatterIdx,
    });

    if (inningsEnded) {
      setTimeout(() => endInnings(updatedBatters, updatedBowlers, newTotalRuns, newWickets, newOver, newBall === 6 ? 0 : newBall), 300);
    }
  };

  const handleWicket = () => setWicketModal(true);

  const confirmWicket = (run: number) => {
    setWicketModal(false);
    if (run > 0) {
      setPendingBall({ run, extra: undefined, isWicket: true });
      setDirectionModal(true);
    } else {
      addBall(run, undefined, true);
    }
  };

  const endInnings = (b: PlayerScore[], bwl: BowlerScore[], runs: number, wkts: number, ov: number, bl: number) => {
    clearInProgressMatch().catch(() => {});
    // Called after a short delay from addBall, so read history/dismissed from the ref
    const cur = stateRef.current;
    const history: Ball[][] = cur.balls.length ? [...cur.overHistory, cur.balls] : cur.overHistory;
    const inningsData = {
      runs, wickets: wkts, overs: ov, balls: bl,
      batters: [...cur.dismissed, ...b], bowlers: bwl, overHistory: history,
    };
    const scorecardParams = isSecondInnings
      ? {
        battingTeam: originalBattingTeam,
        fieldingTeam: originalFieldingTeam,
        overs, matchType, location, bet,
        tossWinner, tossChoice,
        innings1,
        innings2: inningsData,
        isFirstInnings: false,
        liveView: false,
      }
      : {
        battingTeam, fieldingTeam, overs, matchType, location, bet,
        tossWinner, tossChoice,
        innings1: inningsData,
        isFirstInnings: true,
        liveView: false,
      };
    pushLive({ phase: 'innings_end', inningsNum, params: scoringParams, scorecardParams });
    navigation.navigate('Scorecard', { ...scorecardParams, live: liveRef.current });
  };

  const ballColor = (ball: Ball) => {
    if (ball.wicket) return { bg: C.primary, text: C.white };
    if (ball.extra === 'db') return { bg: '#E2E8F0', text: '#64748B' };
    if (ball.extra === 'wd') return { bg: C.orangeLight, text: C.orange };
    if (ball.extra === 'nb') return { bg: C.orangeLight, text: C.orange };
    if (ball.runs === 6) return { bg: '#7C3AED', text: C.white };
    if (ball.runs === 4) return { bg: C.accentLight, text: C.accent };
    return { bg: C.divider, text: C.text };
  };

  const ballLabel = (ball: Ball) => {
    if (ball.wicket) return 'W';
    if (ball.extra === 'db') return 'DB';
    if (ball.extra === 'wd') return isLocal ? `Wd` : `Wd${ball.runs > 1 ? '+' + (ball.runs - 1) : ''}`;
    if (ball.extra === 'nb') return isLocal ? `Nb` : `Nb${ball.runs > 0 ? '+' + ball.runs : ''}`;
    if (ball.extra === 'lb') return `Lb${ball.runs}`;
    if (ball.extra === 'b') return `B${ball.runs}`;
    return `${ball.runs}`;
  };

  const sr = (b: PlayerScore) => (b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0');
  const bowlerBalls = currentBowler.overs * 6 + currentBowler.balls;
  const economy = bowlerBalls > 0 ? (currentBowler.runs / (bowlerBalls / 6)).toFixed(2) : '0.00';
  const progress = Math.min(1, totalBalls / maxBalls);
  const emptySlots = Math.max(0, 6 - currentBall);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_BG} />

      {/* ── Scoreboard header ── */}
      <View style={s.header}>
        <View style={s.headerGlow} />
        <View style={s.topRow}>
          <TouchableOpacity style={s.iconBtn} onPress={confirmLeave}>
            <Text style={s.iconBtnText}>←</Text>
          </TouchableOpacity>
          <View style={s.topActions}>
            <TouchableOpacity style={s.ytBtn} onPress={openYoutube}>
              <View style={s.ytPlay}><Text style={s.ytPlayText}>▶</Text></View>
              <Text style={s.pillText}>YouTube</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.pill, live && s.pillLive]} onPress={shareMatch}>
              {live && <View style={s.liveDot} />}
              <Text style={s.pillText}>{live ? live.code : '🔗 Share'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={s.matchLine}>
          {isSecondInnings ? '2ND INNINGS' : '1ST INNINGS'} · {battingTeam.name} v {fieldingTeam.name}
        </Text>
        <View style={s.scoreLine}>
          <Text style={s.score}>{totalRuns}<Text style={s.scoreWkts}>/{wickets}</Text></Text>
          <View style={s.oversBox}>
            <Text style={s.oversVal}>{oversDisplay}</Text>
            <Text style={s.oversOf}>of {overs} ov</Text>
          </View>
        </View>

        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={s.statRow}>
          <View style={s.statChip}><Text style={s.statLabel}>CRR</Text><Text style={s.statVal}>{crr}</Text></View>
          {isSecondInnings ? (
            <>
              <View style={s.statChip}><Text style={s.statLabel}>RRR</Text><Text style={s.statVal}>{rrr ?? '-'}</Text></View>
              <View style={s.statChip}><Text style={s.statLabel}>TARGET</Text><Text style={s.statVal}>{target}</Text></View>
            </>
          ) : (
            <View style={s.statChip}><Text style={s.statLabel}>PROJECTED</Text><Text style={s.statVal}>{projected || '-'}</Text></View>
          )}
          <TouchableOpacity style={[s.statChip, s.statChipBtn]} onPress={() => navigation.navigate('Scorecard', {
            battingTeam: isSecondInnings ? originalBattingTeam : battingTeam,
            fieldingTeam: isSecondInnings ? originalFieldingTeam : fieldingTeam,
            overs, matchType, location, bet,
            innings1: isSecondInnings ? innings1 : { runs: totalRuns, wickets, overs: currentOver, balls: currentBall, batters: allBatters, bowlers },
            innings2: isSecondInnings ? { runs: totalRuns, wickets, overs: currentOver, balls: currentBall, batters: allBatters, bowlers } : undefined,
            isFirstInnings: !isSecondInnings, liveView: true,
          })}>
            <Text style={s.statLabel}>FULL</Text><Text style={s.statVal}>Card ›</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.statusBanner, isSecondInnings && runsNeeded > 0 && rrr && parseFloat(rrr) > 12 && s.statusBannerHot]}>
          <Text style={s.statusIcon}>{isSecondInnings ? '🎯' : '📈'}</Text>
          <Text style={s.statusText}>{statusText}</Text>
        </View>
      </View>

      {/* ── This over ── */}
      <View style={s.overCard}>
        <View style={s.overHead}>
          <Text style={s.overTitle}>THIS OVER</Text>
          <Text style={s.overRuns}>{plural(thisOverRuns, 'run')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.overBalls}>
          {balls.map((b, i) => {
            const col = ballColor(b);
            return (
              <View key={i} style={[s.ballChip, { backgroundColor: col.bg }]}>
                <Text style={[s.ballChipText, { color: col.text }]}>{ballLabel(b)}</Text>
              </View>
            );
          })}
          {Array.from({ length: emptySlots }, (_, i) => <View key={`e${i}`} style={s.ballSlot} />)}
        </ScrollView>
      </View>

      {/* ── Tabs ── */}
      <View style={s.tabs}>
        {(['score', 'graph'] as const).map(k => (
          <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabActive]} onPress={() => setTab(k)}>
            <Text style={[s.tabText, tab === k && s.tabTextActive]}>{k === 'score' ? '🏏  Scoring' : '📊  Graph'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'score' ? (
          <>
            {/* Batters */}
            <View style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.cardTitle}>BATTING</Text>
                <TouchableOpacity style={s.smallBtn} onPress={swapStrike}>
                  <Text style={s.smallBtnText}>⇄ Swap Strike</Text>
                </TouchableOpacity>
              </View>
              {[striker, nonStriker].map((b, i) => (
                <View key={b.name} style={[s.batterRow, i === 0 && s.batterRowOn]}>
                  <View style={[s.avatar, i === 0 && s.avatarOn]}>
                    <Text style={[s.avatarText, i === 0 && s.avatarTextOn]}>{b.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={s.batterInfo}>
                    <View style={s.nameLine}>
                      <Text style={[s.batterName, i === 0 && s.batterNameOn]} numberOfLines={1}>{b.name}</Text>
                      {b.name === battingTeam.captain && <Text style={s.capBadge}>C</Text>}
                      {i === 0 && <Text style={s.strikeBadge}>ON STRIKE</Text>}
                    </View>
                    <Text style={s.batterMeta}>4s {b.fours} · 6s {b.sixes} · SR {sr(b)}</Text>
                  </View>
                  <Text style={s.batterRuns}>{b.runs}<Text style={s.batterBalls}> ({b.balls})</Text></Text>
                </View>
              ))}
            </View>

            {/* Bowler */}
            <View style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.cardTitle}>BOWLING</Text>
                <TouchableOpacity style={s.smallBtn} onPress={changeBowler}>
                  <Text style={s.smallBtnText}>⇄ Change</Text>
                </TouchableOpacity>
              </View>
              <View style={s.bowlerRow}>
                <View style={[s.avatar, s.avatarBowl]}><Text style={s.avatarText}>🎳</Text></View>
                <View style={s.batterInfo}>
                  <Text style={s.batterName} numberOfLines={1}>{currentBowler.name}</Text>
                  <Text style={s.batterMeta}>Economy {economy}</Text>
                </View>
                <Text style={s.bowlerFig}>
                  {currentBowler.wickets}-{currentBowler.runs}
                  <Text style={s.batterBalls}>  ({currentBowler.overs}.{currentBowler.balls})</Text>
                </Text>
              </View>
            </View>

            {/* Run pad */}
            <View style={s.card}>
              <View style={s.padGrid}>
                {[0, 1, 2, 3, 4, 6].map(r => (
                  <TouchableOpacity
                    key={r}
                    activeOpacity={0.75}
                    style={[s.padBtn, r === 4 && s.padBtn4, r === 6 && s.padBtn6]}
                    onPress={() => handleRunPress(r)}>
                    <Text style={[s.padNum, (r === 4 || r === 6) && s.padNumLight]}>{r === 0 ? '•' : r}</Text>
                    <Text style={[s.padSub, (r === 4 || r === 6) && s.padSubLight]}>
                      {r === 0 ? 'DOT' : r === 4 ? 'FOUR' : r === 6 ? 'SIX' : plural(r, 'RUN').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.extrasRow}>
                {[
                  { label: 'Wide', extra: 'wd' },
                  { label: 'No Ball', extra: 'nb' },
                  { label: 'Leg Bye', extra: 'lb' },
                  { label: 'Bye', extra: 'b' },
                ].map(e => (
                  <TouchableOpacity key={e.extra} style={s.extraBtn} onPress={() => handleRunPress(1, e.extra)}>
                    <Text style={s.extraBtnText}>{e.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[s.extraBtn, s.deadBtn]} onPress={deadBall}>
                  <Text style={[s.extraBtnText, s.deadBtnText]}>Dead Ball</Text>
                </TouchableOpacity>
              </View>

              <View style={s.actionRow}>
                <TouchableOpacity
                  style={[s.undoBtn, !undoStack.length && s.btnDisabled]}
                  onPress={undoLastBall}>
                  <Text style={s.undoText}>↶  Undo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.wicketBtn} onPress={handleWicket}>
                  <Text style={s.wicketBtnText}>WICKET</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={s.endBtn} onPress={() =>
              popup.show({
                type: 'warning', icon: '🏁', title: 'End Innings?',
                message: `${battingTeam.name} will finish on ${totalRuns}/${wickets} (${oversDisplay} ov).`,
                buttons: [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'End Innings', style: 'destructive', onPress: () => endInnings(batters, bowlers, totalRuns, wickets, currentOver, currentBall) },
                ],
              })}>
              <Text style={s.endBtnText}>🏁  End Innings</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={s.card}>
              <Text style={[s.cardTitle, s.cardTitleGap]}>RUNS PER OVER</Text>
              {chartData.length === 0 && !compareData ? (
                <Text style={s.emptyChart}>The graph appears after the first ball 📊</Text>
              ) : (
                <OverChart
                  data={chartData}
                  compare={compareData}
                  totalOvers={overs}
                  teamName={battingTeam.name}
                  compareName={isSecondInnings ? fieldingTeam.name : undefined}
                />
              )}
            </View>
            <View style={s.tiles}>
              {[
                { label: 'Fours', val: fours, color: C.accent },
                { label: 'Sixes', val: sixes, color: '#7C3AED' },
                { label: 'Dot balls', val: dots, color: C.textSub },
                { label: 'Extras', val: extras, color: C.orange },
                { label: 'Best over', val: bestOver.runs >= 0 ? `${bestOver.runs} (#${bestOver.over})` : '-', color: C.green },
                { label: isSecondInnings ? 'Req. rate' : 'Projected', val: isSecondInnings ? (rrr ?? '-') : (projected || '-'), color: C.primary },
              ].map(tile => (
                <View key={tile.label} style={s.tile}>
                  <Text style={[s.tileVal, { color: tile.color }]}>{tile.val}</Text>
                  <Text style={s.tileLabel}>{tile.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Celebration event={celebration} onDone={() => setCelebration(null)} />
      <ServerSettings visible={serverModal} onClose={() => setServerModal(false)} />
      {live && (
        <YouTubeLiveSheet
          visible={youtubeSheet}
          session={live}
          getPayload={() => ({ phase: 'scoring', inningsNum, params: scoringParams, savedState: stateRef.current })}
          onClose={() => setYoutubeSheet(false)}
        />
      )}

      {/* Wicket Modal */}
      <Modal visible={wicketModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>🔴 Wicket!</Text>
            <Text style={s.modalSub}>Runs scored before wicket?</Text>
            <View style={s.runsGrid}>
              {[0, 1, 2, 3].map(r => (
                <TouchableOpacity key={r} style={s.runBtn} onPress={() => confirmWicket(r)}>
                  <Text style={s.runBtnText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.modalCancel} onPress={() => setWicketModal(false)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Select New Batter Modal */}
      <Modal visible={selectBatterModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>🏏 Next Batter</Text>
            <Text style={s.modalSub}>Select incoming batter</Text>
            {battingTeam.players.slice(nextBatterIdx).map((p: string) => (
              <TouchableOpacity key={p} style={s.modalPlayerRow} onPress={() => {
                const outIdx = batters.findIndex(b => b.out);
                const slot = outIdx >= 0 ? outIdx : strikerIdx;
                const updated = [...batters];
                if (outIdx >= 0) setDismissed([...dismissed, batters[outIdx]]);
                updated[slot] = initBatter(p);
                setBatters(updated);
                setNextBatterIdx((i: number) => i + 1);
                setSelectBatterModal(false);
              }}>
                <Text style={s.modalPlayerText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Direction Modal - Full Screen */}
      <Modal visible={directionModal} transparent animationType="fade">
        <View style={s.dirOverlay}>
          <StatusBar barStyle="light-content" backgroundColor="#0a1628" />

          {/* Header */}
          <View style={s.dirHeader}>
            <Text style={s.dirTitle}>📍 Shot Direction</Text>
            <Text style={s.dirSub}>Tap where the ball went</Text>
          </View>

          {/* Field */}
          <View style={s.fieldWrap}>

            {/* Slice segments */}
            {[
              { label: 'Straight\nDrive', angle: -90,  color: '#16a34a' },
              { label: 'Long\nOff',       angle: -45,  color: '#65a30d' },
              { label: 'Cover\nDrive',    angle:   0,  color: '#ca8a04' },
              { label: 'Point',           angle:  45,  color: '#ea580c' },
              { label: 'Square\nLeg',     angle:  90,  color: '#dc2626' },
              { label: 'Fine\nLeg',       angle: 135,  color: '#db2777' },
              { label: 'Mid\nWicket',     angle: 180,  color: '#9333ea' },
              { label: 'Long\nOn',        angle: -135, color: '#2563eb' },
            ].map(({ label, angle, color }, idx) => {
              const midRad = (angle * Math.PI) / 180;
              const R = 128;
              const lx = R * Math.cos(midRad);
              const ly = R * Math.sin(midRad);
              const onPress = () => {
                setDirectionModal(false);
                if (pendingBall) addBall(pendingBall.run, pendingBall.extra, pendingBall.isWicket);
                setPendingBall(null);
              };
              return (
                <React.Fragment key={idx}>
                  <View
                    pointerEvents="none"
                    style={[s.slice, { backgroundColor: color + '50', transform: [{ rotate: `${angle - 22.5}deg` }] }]}
                  />
                  <TouchableOpacity
                    style={[s.sliceLabel, { transform: [{ translateX: lx }, { translateY: ly }] }]}
                    onPress={onPress}>
                    <View style={[s.sliceBadge, { backgroundColor: color + 'ee' }]}>
                      <Text style={s.sliceBadgeText}>{label}</Text>
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}

            {/* Divider lines */}
            {[0, 45, 90, 135].map(deg => (
              <View key={deg} pointerEvents="none" style={[s.sliceLine, { transform: [{ rotate: `${deg}deg` }] }]} />
            ))}

            {/* 30-yard circle */}
            <View pointerEvents="none" style={s.infieldRing} />

            {/* ── PITCH ── */}
            <View pointerEvents="none" style={s.pitch}>

              {/* Bowler end — top */}
              {/* Ball icon above top stumps */}
              <View style={s.bowlerEndWrap}>
                <Text style={s.ballIcon}>🏀</Text>
                <Text style={s.endLabel}>{currentBowler.name.split(' ')[0]}</Text>
              </View>

              {/* Top stumps (bowler end) */}
              <View style={s.wicketTop}>
                <View style={s.stump}/><View style={s.stump}/><View style={s.stump}/>
              </View>
              {/* Top crease */}
              <View style={s.creaseTop}/>

              {/* Pitch surface */}
              <View style={s.pitchSurface}/>

              {/* Bottom crease */}
              <View style={s.creaseBottom}/>
              {/* Bottom stumps (striker end) */}
              <View style={s.wicketBottom}>
                <View style={s.stump}/><View style={s.stump}/><View style={s.stump}/>
              </View>

              {/* Non-striker — just above bottom stumps */}
              <View style={s.nonStrikerWrap}>
                <Text style={s.nonStrikerName} numberOfLines={1}>{nonStriker.name.split(' ')[0]}</Text>
              </View>

              {/* Striker — bat icon + name below bottom stumps */}
              <View style={s.strikerWrap}>
                <Text style={s.batIcon}>🏏</Text>
                <Text style={s.strikerName} numberOfLines={1}>{striker.name.split(' ')[0]} ✦</Text>
              </View>
            </View>

            {/* Boundary ring */}
            <View pointerEvents="none" style={s.boundaryRing} />
          </View>

          {/* Skip */}
          <TouchableOpacity style={s.skipDirBtn} onPress={() => {
            setDirectionModal(false);
            if (pendingBall) addBall(pendingBall.run, pendingBall.extra, pendingBall.isWicket);
            setPendingBall(null);
          }}>
            <Text style={s.skipDirText}>Skip Direction</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Select New Bowler Modal */}
      <Modal visible={selectBowlerModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>🎳 {bowlerChangeManual ? 'Change Bowler' : 'New Bowler'}</Text>
            <Text style={s.modalSub}>{bowlerChangeManual ? 'Select who is bowling now' : 'Select bowler for next over'}</Text>
            {fieldingTeam.players.map((p: string) => (
              <TouchableOpacity key={p} style={s.modalPlayerRow} onPress={() => {
                const existing = bowlers.findIndex(b => b.name === p);
                if (existing >= 0) {
                  setCurrentBowlerIdx(existing);
                } else {
                  setBowlers(bwl => [...bwl, initBowler(p)]);
                  setCurrentBowlerIdx(bowlers.length);
                }
                setSelectBowlerModal(false);
              }}>
                <Text style={s.modalPlayerText}>{p}</Text>
                {bowlers.find(b => b.name === p) && (
                  <Text style={s.modalPlayerSub}>
                    {bowlers.find(b => b.name === p)?.overs}.{bowlers.find(b => b.name === p)?.balls} ov · {bowlers.find(b => b.name === p)?.wickets}W
                  </Text>
                )}
              </TouchableOpacity>
            ))}
            {bowlerChangeManual && (
              <TouchableOpacity style={s.modalCancel} onPress={() => setSelectBowlerModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF2F7' },

  // Header
  header: {
    backgroundColor: HEADER_BG, paddingTop: 44, paddingHorizontal: 18, paddingBottom: 34,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute', width: 260, height: 260, borderRadius: 130,
    backgroundColor: C.primary, opacity: 0.22, top: -120, right: -80,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF14',
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnText: { color: C.white, fontSize: 18, fontWeight: '700' },
  topActions: { flexDirection: 'row', gap: 8 },
  ytBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FF0000', borderRadius: 16, paddingLeft: 6, paddingRight: 12, paddingVertical: 6,
  },
  ytPlay: { width: 18, height: 18, borderRadius: 5, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  ytPlayText: { color: '#FF0000', fontSize: 9, fontWeight: '900', marginLeft: 1 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF1F', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
  },
  pillLive: { backgroundColor: '#16A34A40', borderWidth: 1, borderColor: '#4ADE8060' },
  pillText: { color: C.white, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  matchLine: { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  scoreLine: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 2 },
  score: { color: C.white, fontSize: 56, fontWeight: '900', lineHeight: 62 },
  scoreWkts: { fontSize: 36, color: '#CBD5E1', fontWeight: '800' },
  oversBox: { alignItems: 'flex-end', paddingBottom: 8 },
  oversVal: { color: C.white, fontSize: 24, fontWeight: '900' },
  oversOf: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#FFFFFF1A', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: '#FACC15' },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statChip: { flex: 1, backgroundColor: '#FFFFFF12', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  statChipBtn: { backgroundColor: '#FFFFFF24' },
  statLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  statVal: { color: C.white, fontSize: 15, fontWeight: '800', marginTop: 2 },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    backgroundColor: '#FACC15', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14,
  },
  statusBannerHot: { backgroundColor: '#FB923C' },
  statusIcon: { fontSize: 16 },
  statusText: { flex: 1, color: '#1E1B04', fontSize: 15, fontWeight: '900' },

  // This over
  overCard: {
    marginHorizontal: 14, marginTop: -22, backgroundColor: C.white, borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 6,
  },
  overHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  overTitle: { fontSize: 11, fontWeight: '900', color: C.textMuted, letterSpacing: 1 },
  overRuns: { fontSize: 12, fontWeight: '800', color: C.text },
  overBalls: { gap: 8, alignItems: 'center' },
  ballChip: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  ballChipText: { fontSize: 12, fontWeight: '900' },
  ballSlot: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.cardBorder },

  // Tabs
  tabs: {
    flexDirection: 'row', marginHorizontal: 14, marginTop: 12, backgroundColor: '#E2E8F0',
    borderRadius: 14, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  tabActive: { backgroundColor: C.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '700', color: C.textSub },
  tabTextActive: { color: C.text, fontWeight: '800' },

  scroll: { padding: 14, paddingBottom: 40 },
  card: {
    backgroundColor: C.white, borderRadius: 18, padding: 14, marginBottom: 12,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 11, fontWeight: '900', color: C.textMuted, letterSpacing: 1 },
  cardTitleGap: { marginBottom: 12 },
  smallBtn: { backgroundColor: C.accentLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  smallBtnText: { color: C.accent, fontSize: 12, fontWeight: '800' },

  // Batters / bowler
  batterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 8, borderRadius: 12, marginTop: 4 },
  batterRowOn: { backgroundColor: '#F0FDF4' },
  bowlerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.divider, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarOn: { backgroundColor: C.green },
  avatarBowl: { backgroundColor: C.primaryLight },
  avatarText: { fontSize: 15, fontWeight: '900', color: C.textSub },
  avatarTextOn: { color: C.white },
  batterInfo: { flex: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  batterName: { fontSize: 15, fontWeight: '700', color: C.text, flexShrink: 1 },
  batterNameOn: { fontWeight: '900' },
  capBadge: {
    fontSize: 10, fontWeight: '900', color: C.orange, backgroundColor: C.orangeLight,
    paddingHorizontal: 5, borderRadius: 4, overflow: 'hidden',
  },
  strikeBadge: {
    fontSize: 9, fontWeight: '900', color: C.green, backgroundColor: C.greenLight, letterSpacing: 0.5,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, overflow: 'hidden',
  },
  batterMeta: { fontSize: 11, color: C.textMuted, marginTop: 2, fontWeight: '600' },
  batterRuns: { fontSize: 22, fontWeight: '900', color: C.text },
  batterBalls: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  bowlerFig: { fontSize: 22, fontWeight: '900', color: C.text },

  // Run pad
  padGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  padBtn: {
    width: '31.5%', height: 66, borderRadius: 16, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0',
  },
  padBtn4: { backgroundColor: C.accent, borderColor: C.accent },
  padBtn6: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  padNum: { fontSize: 26, fontWeight: '900', color: C.text, lineHeight: 30 },
  padNumLight: { color: C.white },
  padSub: { fontSize: 9, fontWeight: '800', color: C.textMuted, letterSpacing: 1 },
  padSubLight: { color: '#FFFFFFCC' },
  extrasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  extraBtn: {
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11,
    backgroundColor: C.orangeLight, borderWidth: 1, borderColor: C.orange + '40',
  },
  extraBtnText: { fontSize: 13, fontWeight: '800', color: C.orange },
  deadBtn: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
  deadBtnText: { color: '#475569' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  undoBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center',
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1',
  },
  undoText: { fontSize: 15, fontWeight: '800', color: '#334155' },
  btnDisabled: { opacity: 0.45 },
  wicketBtn: {
    flex: 1.6, paddingVertical: 15, borderRadius: 14, alignItems: 'center', backgroundColor: C.primary,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  wicketBtnText: { color: C.white, fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  endBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', backgroundColor: C.white,
  },
  endBtnText: { color: C.textSub, fontSize: 14, fontWeight: '700' },

  // Graph tab
  emptyChart: { textAlign: 'center', color: C.textMuted, paddingVertical: 30, fontSize: 13 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: {
    width: '31.5%', backgroundColor: C.white, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  tileVal: { fontSize: 18, fontWeight: '900' },
  tileLabel: { fontSize: 10, color: C.textMuted, fontWeight: '700', marginTop: 3, letterSpacing: 0.5 },

  // Wicket modal run buttons
  runsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  runBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: C.divider,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.cardBorder,
  },
  runBtnText: { fontSize: 20, fontWeight: '800', color: C.text },
  modalOverlay: { flex: 1, backgroundColor: '#00000070', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  dirOverlay: {
    flex: 1, backgroundColor: '#0a1628',
    justifyContent: 'center', alignItems: 'center',
  },
  dirHeader: { alignItems: 'center', marginBottom: 16, paddingTop: 48 },
  dirTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  dirSub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },

  // Field
  fieldWrap: {
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: '#14532d',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6, shadowRadius: 20, elevation: 18,
  },
  slice: {
    position: 'absolute',
    width: 320, height: 160,
    top: 0, left: 0,
    transformOrigin: 'bottom center',
  },
  sliceLabel: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 6,
  },
  sliceBadge: {
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 3, elevation: 5,
  },
  sliceBadgeText: {
    fontSize: 9, fontWeight: '900', color: '#fff',
    textAlign: 'center', lineHeight: 12,
  },
  sliceLine: {
    position: 'absolute',
    width: 320, height: 1.5,
    backgroundColor: '#ffffff20', zIndex: 2,
  },
  infieldRing: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 1.5, borderColor: '#ffffff30',
    zIndex: 3,
  },
  boundaryRing: {
    position: 'absolute',
    width: 318, height: 318, borderRadius: 159,
    borderWidth: 2.5, borderColor: '#ffffff35',
    zIndex: 3,
  },

  // Pitch
  pitch: {
    position: 'absolute',
    width: 44, height: 140,
    backgroundColor: '#c8a96e',
    borderRadius: 5,
    zIndex: 8,
    alignItems: 'center',
    borderWidth: 1, borderColor: '#a08450',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5, shadowRadius: 6, elevation: 8,
    overflow: 'visible',
  },
  pitchSurface: {
    flex: 1, width: '100%',
    backgroundColor: '#c8a96e',
  },
  creaseTop: {
    width: 44, height: 2,
    backgroundColor: '#fff', opacity: 0.95,
    marginTop: 18,
  },
  creaseBottom: {
    width: 44, height: 2,
    backgroundColor: '#fff', opacity: 0.95,
    marginBottom: 18,
  },
  wicketTop: {
    position: 'absolute', top: 4,
    flexDirection: 'row', gap: 4,
    alignItems: 'flex-end', zIndex: 10,
  },
  wicketBottom: {
    position: 'absolute', bottom: 4,
    flexDirection: 'row', gap: 4,
    alignItems: 'flex-end', zIndex: 10,
  },
  stump: {
    width: 4, height: 16,
    backgroundColor: '#fff',
    borderRadius: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4, shadowRadius: 1, elevation: 2,
  },

  // Bowler end (top, outside pitch)
  bowlerEndWrap: {
    position: 'absolute', top: -52,
    alignItems: 'center', zIndex: 12,
  },
  ballIcon: { fontSize: 18 },
  endLabel: {
    fontSize: 9, fontWeight: '800', color: '#fbbf24',
    backgroundColor: '#1e293b',
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 5, marginTop: 2,
    maxWidth: 70, textAlign: 'center',
    overflow: 'hidden',
  },

  // Non-striker (inside pitch, near bottom stumps)
  nonStrikerWrap: {
    position: 'absolute', bottom: 26,
    alignItems: 'center', zIndex: 12,
  },
  nonStrikerName: {
    fontSize: 8, fontWeight: '700', color: '#fff',
    backgroundColor: '#334155',
    paddingHorizontal: 4, paddingVertical: 1,
    borderRadius: 4, maxWidth: 60, textAlign: 'center',
    overflow: 'hidden',
  },

  // Striker (below pitch, outside)
  strikerWrap: {
    position: 'absolute', bottom: -56,
    alignItems: 'center', zIndex: 12,
  },
  batIcon: { fontSize: 20 },
  strikerName: {
    fontSize: 9, fontWeight: '900', color: '#facc15',
    backgroundColor: '#1e293b',
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 5, marginTop: 2,
    maxWidth: 70, textAlign: 'center',
    overflow: 'hidden',
  },

  skipDirBtn: {
    marginTop: 20, paddingVertical: 11, paddingHorizontal: 36,
    borderRadius: 24, borderWidth: 1.5, borderColor: '#334155',
    marginBottom: 24,
  },
  skipDirText: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },

  modalTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: C.textSub, marginBottom: 20 },
  modalPlayerRow: {
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.divider,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  modalPlayerText: { fontSize: 15, color: C.text, fontWeight: '600' },
  modalPlayerSub: { fontSize: 12, color: C.textMuted },
  modalCancel: { marginTop: 16, alignItems: 'center' },
  modalCancelText: { color: C.textSub, fontSize: 14, fontWeight: '600' },
});
