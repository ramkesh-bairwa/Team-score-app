import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert, Modal, BackHandler,
} from 'react-native';
import { saveInProgressMatch, clearInProgressMatch } from '../services/api';
import { C } from '../theme/colors';

type Ball = { runs: number; extra?: string; wicket?: boolean };
type PlayerScore = { name: string; runs: number; balls: number; fours: number; sixes: number; out: boolean; howOut?: string };
type BowlerScore = { name: string; overs: number; balls: number; runs: number; wickets: number };

function initBatter(name: string): PlayerScore {
  return { name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
}
function initBowler(name: string): BowlerScore {
  return { name, overs: 0, balls: 0, runs: 0, wickets: 0 };
}

export default function ScoringScreen({ navigation, route }: any) {
  const { battingTeam, fieldingTeam, overs, matchType, target, innings1, originalBattingTeam, originalFieldingTeam, bet, location, tossWinner, tossChoice } = route.params;
  const isSecondInnings = !!target;
  const isLocal = matchType === 'local';

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

  const [selectBowlerModal, setSelectBowlerModal] = useState(false);
  const [selectBatterModal, setSelectBatterModal] = useState(false);
  const [wicketModal, setWicketModal] = useState(false);
  const [pendingRuns, setPendingRuns] = useState(0);
  const [directionModal, setDirectionModal] = useState(false);
  const [pendingBall, setPendingBall] = useState<{ run: number; extra?: string; isWicket?: boolean } | null>(null);

  // Block hardware back button during match
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Match In Progress', 'You cannot go back during a match. Use End Innings to finish.', [{ text: 'OK' }]);
      return true;
    });
    return () => sub.remove();
  }, []);

  // Save state to AsyncStorage on every meaningful change
  const stateRef = useRef<any>({});
  useEffect(() => {
    stateRef.current = { totalRuns, wickets, currentOver, currentBall, balls, overHistory, batters, strikerIdx, nextBatterIdx, bowlers, currentBowlerIdx };
  });

  const persistState = (overrides: any = {}) => {
    const state = { ...stateRef.current, ...overrides };
    saveInProgressMatch({
      battingTeam, fieldingTeam, overs, matchType, target, innings1,
      originalBattingTeam, originalFieldingTeam, bet, location,
      savedState: state,
      isSecondInnings,
    }).catch(() => {});
  };

  const nonStrikerIdx = strikerIdx === 0 ? 1 : 0;
  const striker = batters[strikerIdx];
  const nonStriker = batters[nonStrikerIdx];
  const currentBowler = bowlers[currentBowlerIdx];
  const totalBalls = currentOver * 6 + currentBall;
  const maxBalls = overs * 6;
  const isInningsOver = wickets >= battingTeam.players.length - 1 || totalBalls >= maxBalls || (isSecondInnings && totalRuns >= target);

  const oversDisplay = `${currentOver}.${currentBall}`;
  const crr = totalBalls > 0 ? ((totalRuns / totalBalls) * 6).toFixed(2) : '0.00';

  const handleRunPress = (run: number, extra?: string, isWicket?: boolean) => {
    if (run > 0 && !isWicket) {
      setPendingBall({ run, extra, isWicket });
      setDirectionModal(true);
    } else {
      addBall(run, extra, isWicket);
    }
  };

  const addBall = (run: number, extra?: string, isWicket?: boolean) => {
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

    setTotalRuns(r => r + actualRun);
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
        if (newOver < overs) setSelectBowlerModal(true);
      } else {
        setBalls(newBalls);
      }
    } else {
      setBalls(newBalls);
    }

    setCurrentBall(newBall === 6 ? 0 : newBall);
    setCurrentOver(newOver);

    if (isWicket) {
      setWickets(w => w + 1);
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
    const newBallsFinal = newBall === 0 && isLegal ? [] : (isLegal && newBall !== 6 ? newBalls : newBalls);
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

  const handleWicket = () => {
    setPendingRuns(0);
    setWicketModal(true);
  };

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
    if (isSecondInnings) {
      navigation.navigate('Scorecard', {
        battingTeam: originalBattingTeam,
        fieldingTeam: originalFieldingTeam,
        overs, matchType, location, bet,
        tossWinner, tossChoice,
        innings1,
        innings2: { runs, wickets: wkts, overs: ov, balls: bl, batters: b, bowlers: bwl },
        isFirstInnings: false,
        liveView: false,
      });
    } else {
      navigation.navigate('Scorecard', {
        battingTeam, fieldingTeam, overs, matchType, location, bet,
        tossWinner, tossChoice,
        innings1: { runs, wickets: wkts, overs: ov, balls: bl, batters: b, bowlers: bwl },
        isFirstInnings: true,
        liveView: false,
      });
    }
  };

  const ballColor = (ball: Ball) => {
    if (ball.wicket) return { bg: C.primary, text: C.white };
    if (ball.extra === 'wd') return { bg: C.orangeLight, text: C.orange };
    if (ball.extra === 'nb') return { bg: C.orangeLight, text: C.orange };
    if (ball.runs === 6) return { bg: '#7C3AED', text: C.white };
    if (ball.runs === 4) return { bg: C.accentLight, text: C.accent };
    return { bg: C.divider, text: C.text };
  };

  const ballLabel = (ball: Ball) => {
    if (ball.wicket) return 'W';
    if (ball.extra === 'wd') return isLocal ? `Wd` : `Wd${ball.runs > 1 ? '+' + (ball.runs - 1) : ''}`;
    if (ball.extra === 'nb') return isLocal ? `Nb` : `Nb${ball.runs > 0 ? '+' + ball.runs : ''}`;
    if (ball.extra === 'lb') return `Lb${ball.runs}`;
    if (ball.extra === 'b') return `B${ball.runs}`;
    return `${ball.runs}`;
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      {/* Top Scoreboard */}
      <View style={s.scoreboard}>
        <View style={s.scoreMain}>
          <Text style={s.teamName}>{battingTeam.name}</Text>
          <Text style={s.score}>{totalRuns}/{wickets}</Text>
          <Text style={s.oversText}>Overs: {oversDisplay} / {overs}</Text>
          {isSecondInnings && (
            <Text style={s.targetText}>Target: {target} · Need {Math.max(0, target - totalRuns)} off {maxBalls - totalBalls} balls</Text>
          )}
        </View>
        <View style={s.scoreRight}>
          <View style={s.crrBox}>
            <Text style={s.crrLabel}>CRR</Text>
            <Text style={s.crrVal}>{crr}</Text>
          </View>
          <TouchableOpacity style={s.scorecardBtn} onPress={() => navigation.navigate('Scorecard', {
            battingTeam: isSecondInnings ? originalBattingTeam : battingTeam,
            fieldingTeam: isSecondInnings ? originalFieldingTeam : fieldingTeam,
            overs, matchType, location, bet,
            innings1: isSecondInnings ? innings1 : { runs: totalRuns, wickets, overs: currentOver, balls: currentBall, batters, bowlers },
            innings2: isSecondInnings ? { runs: totalRuns, wickets, overs: currentOver, balls: currentBall, batters, bowlers } : undefined,
            isFirstInnings: !isSecondInnings, liveView: true,
          })}>
            <Text style={s.scorecardBtnText}>Scorecard</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* This Over */}
      <View style={s.overRow}>
        <Text style={s.overLabel}>This Over:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.ballsScroll}>
          {balls.map((b, i) => {
            const col = ballColor(b);
            return (
              <View key={i} style={[s.ballChip, { backgroundColor: col.bg }]}>
                <Text style={[s.ballChipText, { color: col.text }]}>{ballLabel(b)}</Text>
              </View>
            );
          })}
          {balls.length === 0 && <Text style={s.noballsText}>No balls yet</Text>}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Batters */}
        <View style={s.card}>
          <View style={s.batterRow}>
            <Text style={s.batterHeader}>Batter</Text>
            <Text style={s.batterStat}>R</Text>
            <Text style={s.batterStat}>B</Text>
            <Text style={s.batterStat}>4s</Text>
            <Text style={s.batterStat}>6s</Text>
            <Text style={s.batterStat}>SR</Text>
          </View>
          {[striker, nonStriker].map((b, i) => (
            <View key={b.name} style={[s.batterRow, s.batterDataRow]}>
              <View style={s.batterNameWrap}>
                <View style={[s.strikeDot, i === 0 && s.strikeDotActive]} />
                <Text style={[s.batterName, i === 0 && s.batterNameActive]}>{b.name}</Text>
                {b.name === battingTeam.captain && <Text style={s.capBadge}>©</Text>}
                {i === 0 && <Text style={s.strikeLabel}>*</Text>}
              </View>
              <Text style={s.batterStat}>{b.runs}</Text>
              <Text style={s.batterStat}>{b.balls}</Text>
              <Text style={s.batterStat}>{b.fours}</Text>
              <Text style={s.batterStat}>{b.sixes}</Text>
              <Text style={s.batterStat}>{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(0) : '0'}</Text>
            </View>
          ))}
        </View>

        {/* Bowler */}
        <View style={s.card}>
          <View style={s.batterRow}>
            <Text style={s.batterHeader}>Bowler</Text>
            <Text style={s.batterStat}>O</Text>
            <Text style={s.batterStat}>R</Text>
            <Text style={s.batterStat}>W</Text>
            <Text style={s.batterStat}>Eco</Text>
          </View>
          <View style={[s.batterRow, s.batterDataRow]}>
            <Text style={[s.batterName, { flex: 1 }]}>{currentBowler.name} 🎳</Text>
            <Text style={s.batterStat}>{currentBowler.overs}.{currentBowler.balls}</Text>
            <Text style={s.batterStat}>{currentBowler.runs}</Text>
            <Text style={s.batterStat}>{currentBowler.wickets}</Text>
            <Text style={s.batterStat}>
              {currentBowler.balls + currentBowler.overs * 6 > 0
                ? (currentBowler.runs / ((currentBowler.balls + currentBowler.overs * 6) / 6)).toFixed(1)
                : '0.0'}
            </Text>
          </View>
        </View>

        {/* Scoring Buttons */}
        <View style={s.card}>
          <Text style={s.scoringTitle}>Runs</Text>
          <View style={s.runsGrid}>
            {[0, 1, 2, 3, 4, 6].map(r => (
              <TouchableOpacity
                key={r}
                style={[s.runBtn, r === 4 && s.runBtn4, r === 6 && s.runBtn6]}
                onPress={() => handleRunPress(r)}>
                <Text style={[s.runBtnText, (r === 4 || r === 6) && s.runBtnTextLight]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.scoringTitle}>Extras</Text>
          <View style={s.extrasRow}>
            {[
              { label: 'Wide', extra: 'wd', runs: 1 },
              { label: 'No Ball', extra: 'nb', runs: 1 },
              { label: 'Leg Bye', extra: 'lb', runs: 1 },
              { label: 'Bye', extra: 'b', runs: 1 },
            ].map(e => (
              <TouchableOpacity
                key={e.extra}
                style={s.extraBtn}
                onPress={() => handleRunPress(e.runs, e.extra)}>
                <Text style={s.extraBtnText}>{e.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={s.wicketBtn} onPress={handleWicket}>
            <Text style={s.wicketBtnText}>🔴 WICKET</Text>
          </TouchableOpacity>
        </View>

        {/* End Innings manually */}
        <TouchableOpacity style={s.endBtn} onPress={() =>
          Alert.alert('End Innings?', 'Are you sure you want to end the innings?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'End', style: 'destructive', onPress: () => endInnings(batters, bowlers, totalRuns, wickets, currentOver, currentBall) },
          ])}>
          <Text style={s.endBtnText}>End Innings</Text>
        </TouchableOpacity>
      </ScrollView>

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
                const updated = [...batters];
                updated[strikerIdx] = initBatter(p);
                setBatters(updated);
                setNextBatterIdx(i => i + 1);
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
            <Text style={s.modalTitle}>🎳 New Bowler</Text>
            <Text style={s.modalSub}>Select bowler for next over</Text>
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
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scoreboard: {
    backgroundColor: C.primary, paddingTop: 52, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end',
  },
  scoreMain: { flex: 1 },
  teamName: { color: '#ffffff99', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  score: { color: C.white, fontSize: 44, fontWeight: '900', lineHeight: 50 },
  oversText: { color: '#ffffff99', fontSize: 13, marginTop: 2 },
  targetText: { color: '#FFD700', fontSize: 12, fontWeight: '700', marginTop: 4 },
  scoreRight: { alignItems: 'flex-end', gap: 8 },
  crrBox: { alignItems: 'center', backgroundColor: '#ffffff20', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  crrLabel: { color: '#ffffff80', fontSize: 10, fontWeight: '600' },
  crrVal: { color: C.white, fontSize: 18, fontWeight: '800' },
  scorecardBtn: { backgroundColor: '#ffffff20', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  scorecardBtnText: { color: C.white, fontSize: 12, fontWeight: '700' },
  overRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.white,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  overLabel: { fontSize: 12, fontWeight: '700', color: C.textSub, marginRight: 10 },
  ballsScroll: { flex: 1 },
  ballChip: {
    width: 34, height: 34, borderRadius: 17, justifyContent: 'center',
    alignItems: 'center', marginRight: 6,
  },
  ballChipText: { fontSize: 11, fontWeight: '800' },
  noballsText: { color: C.textMuted, fontSize: 12, paddingVertical: 8 },
  scroll: { padding: 12, paddingBottom: 40 },
  card: {
    backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  batterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  batterDataRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.divider },
  batterHeader: { flex: 1, fontSize: 11, fontWeight: '700', color: C.textMuted },
  batterNameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  strikeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.divider },
  strikeDotActive: { backgroundColor: C.green },
  batterName: { fontSize: 14, color: C.text, fontWeight: '500' },
  batterNameActive: { fontWeight: '700', color: C.text },
  capBadge: { fontSize: 11, color: C.orange, fontWeight: '700' },
  strikeLabel: { fontSize: 16, color: C.green, fontWeight: '900' },
  batterStat: { width: 36, textAlign: 'center', fontSize: 13, color: C.text, fontWeight: '600' },
  scoringTitle: { fontSize: 12, fontWeight: '700', color: C.textSub, marginBottom: 10, marginTop: 4 },
  runsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  runBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: C.divider,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.cardBorder,
  },
  runBtn4: { backgroundColor: C.accentLight, borderColor: C.accent + '60' },
  runBtn6: { backgroundColor: '#EDE9FE', borderColor: '#7C3AED60' },
  runBtnText: { fontSize: 20, fontWeight: '800', color: C.text },
  runBtnTextLight: { color: C.accent },
  extrasRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  extraBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: C.orangeLight, borderWidth: 1, borderColor: C.orange + '40',
  },
  extraBtnText: { fontSize: 13, fontWeight: '700', color: C.orange },
  wicketBtn: {
    backgroundColor: C.primaryLight, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: C.primary + '40',
  },
  wicketBtnText: { color: C.primary, fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  endBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: C.cardBorder, backgroundColor: C.white,
  },
  endBtnText: { color: C.textSub, fontSize: 14, fontWeight: '600' },
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

  // legacy stubs
  pizzaWrap: { width: 0, height: 0 },
  pizzaSegment: { width: 0, height: 0 },
  pizzaRing: { width: 0, height: 0 },
  pizzaLabel: { position: 'absolute' },
  pizzaLabelBadge: {},
  pizzaLabelText: {},
  pizzaDivider: { width: 0, height: 0 },
  pizzaCenter: { width: 0, height: 0 },
  pizzaCenterText: {},
  fieldCircle: { width: 0, height: 0 },
  fieldCenter: { width: 0, height: 0 },
  fieldCenterText: {},
  dirBtn: { position: 'absolute' },
  dirBtnText: {},
  batterDot: { position: 'absolute' },
  nonStrikerDot: {},
  strikerDot: {},
  batterDotText: {},
  strikerStar: {},
  crease: {},
  dirModalBox: {},
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
