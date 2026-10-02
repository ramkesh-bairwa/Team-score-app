import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image,
} from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { useIsFocused } from '@react-navigation/native';
import { saveInProgressMatch, upsertMatch } from '../services/api';
import { pullLiveState } from '../services/live';
import { popup } from '../components/Popup';
import InningsScorecard from '../components/InningsScorecard';
import CommentaryList from '../components/CommentaryList';
import { C } from '../theme/colors';

function BetSettlement({ resultText, battingTeam, fieldingTeam, bet, cap1PayPhoto, cap2PayPhoto, takePayPhoto }: any) {
  const isTied = resultText === 'Match Tied!';
  const winnerTeam = !isTied
    ? (resultText.startsWith(battingTeam.name) ? battingTeam : fieldingTeam)
    : null;
  const loserTeam = !isTied
    ? (winnerTeam === battingTeam ? fieldingTeam : battingTeam)
    : null;

  return (
    <View style={s.betCard}>
      <View style={s.betHeader}>
        <Text style={s.betHeaderIcon}>💰</Text>
        <View>
          <Text style={s.betCardTitle}>Bet Settlement</Text>
          <Text style={s.betHeaderSub}>Match bet result</Text>
        </View>
      </View>

      {isTied ? (
        <View style={[s.resultBanner, { backgroundColor: C.accentLight, borderColor: C.accent + '40' }]}>
          <Text style={[s.resultBannerText, { color: C.accent }]}>🤝 Match Tied — No Winner</Text>
          <Text style={[s.resultBannerSub, { color: C.accent + 'aa' }]}>Bet amount to be returned</Text>
        </View>
      ) : (
        <View style={[s.resultBanner, { backgroundColor: C.greenLight, borderColor: C.green + '40' }]}>
          <Text style={[s.resultBannerText, { color: C.green }]}>🏆 {resultText}</Text>
          <Text style={[s.resultBannerSub, { color: C.green + 'aa' }]}>{winnerTeam?.name} wins ₹{bet?.amount}</Text>
        </View>
      )}

      <View style={s.betAmountBox}>
        <View style={s.betAmountItem}>
          <Text style={s.betAmountLabel}>Bet Amount</Text>
          <Text style={s.betAmountVal}>₹{bet?.amount}</Text>
        </View>
        <View style={s.betDivider} />
        <View style={s.betAmountItem}>
          <Text style={s.betAmountLabel}>Status</Text>
          <Text style={[s.betStatusVal, { color: isTied ? C.accent : C.green }]}>
            {isTied ? 'TIED' : 'DECIDED'}
          </Text>
        </View>
      </View>

      {!isTied && (
        <View style={s.teamsRow}>
          <View style={[s.teamBetCard, s.winnerCard]}>
            <Text style={s.teamBetBadge}>🏆 WINNER</Text>
            <Text style={s.teamBetName}>{winnerTeam?.name}</Text>
            <Text style={s.teamBetCap}>{winnerTeam?.captain}</Text>
            <Text style={s.teamBetAmount}>+₹{bet?.amount}</Text>
          </View>
          <View style={[s.teamBetCard, s.loserCard]}>
            <Text style={[s.teamBetBadge, { color: C.primary }]}>❌ LOSER</Text>
            <Text style={s.teamBetName}>{loserTeam?.name}</Text>
            <Text style={s.teamBetCap}>{loserTeam?.captain}</Text>
            <Text style={[s.teamBetAmount, { color: C.primary }]}>-₹{bet?.amount}</Text>
          </View>
        </View>
      )}

      <Text style={s.betSubText}>📸 Both captains must confirm payment</Text>
      <View style={s.photoRow}>
        {[
          { team: battingTeam, photo: cap1PayPhoto, num: 1 as 1 | 2 },
          { team: fieldingTeam, photo: cap2PayPhoto, num: 2 as 1 | 2 },
        ].map(({ team, photo, num }) => {
          const isWinner = team === winnerTeam;
          return (
            <View key={num} style={[s.photoCard, isWinner && !isTied && s.photoCardWinner]}>
              {!isTied && (
                <View style={[s.photoRoleBadge, { backgroundColor: isWinner ? C.greenLight : C.primaryLight }]}>
                  <Text style={[s.photoRoleText, { color: isWinner ? C.green : C.primary }]}>
                    {isWinner ? '🏆 Receives' : '💸 Pays'}
                  </Text>
                </View>
              )}
              <Text style={s.photoCapName}>{team.captain}</Text>
              <Text style={s.photoTeamName}>{team.name}</Text>
              {photo ? (
                <TouchableOpacity onPress={() => takePayPhoto(num)}>
                  <Image source={{ uri: photo }} style={s.payPhoto} />
                  <Text style={s.retakeText}>Tap to retake</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.markPaidBtn} onPress={() => takePayPhoto(num)}>
                  <Text style={s.captureIcon}>📷</Text>
                  <Text style={s.markPaidBtnText}>Confirm</Text>
                </TouchableOpacity>
              )}
              {photo && <View style={s.paidBadge}><Text style={s.paidBadgeText}>✓ CONFIRMED</Text></View>}
            </View>
          );
        })}
      </View>

      {cap1PayPhoto && cap2PayPhoto && (
        <View style={s.allConfirmedBanner}>
          <Text style={s.allConfirmedText}>✅ Both captains confirmed — Bet settled!</Text>
        </View>
      )}
    </View>
  );
}

// "Loser to pay": the losing team covers the itemized match expenses
function LoserSettlement({ resultText, battingTeam, fieldingTeam, bet }: any) {
  const isTied = resultText === 'Match Tied!';
  const loser = isTied ? null : resultText.startsWith(battingTeam.name) ? fieldingTeam : battingTeam;
  return (
    <View style={s.expenseCard}>
      <View style={s.expenseHead}>
        <Text style={s.expenseIcon}>🧾</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.expenseTitle}>Loser to Pay</Text>
          <Text style={s.expenseSub}>Match expenses</Text>
        </View>
        <Text style={s.expenseTotal}>₹{bet.amount}</Text>
      </View>
      {(bet.expenses || []).map((e: any, i: number) => (
        <View key={i} style={s.expenseRow}>
          <Text style={s.expenseItem}>{e.label}</Text>
          <Text style={s.expenseAmt}>₹{e.amount}</Text>
        </View>
      ))}
      {!!bet.note && <Text style={s.expenseNote}>📝 {bet.note}</Text>}
      <View style={[s.expenseVerdict, isTied && s.expenseVerdictTie]}>
        <Text style={[s.expenseVerdictText, isTied && s.expenseVerdictTextTie]}>
          {isTied
            ? `🤝 Match tied: both teams share ₹${bet.amount} (₹${Math.round(bet.amount / 2)} each)`
            : `💸 ${loser.name} pays ₹${bet.amount}${loser.captain ? ` (captain ${loser.captain})` : ''}`}
        </Text>
      </View>
    </View>
  );
}

export default function ScorecardScreen({ navigation, route }: any) {
  const {
    battingTeam, fieldingTeam, overs, innings1,
    isFirstInnings, liveView, innings2, matchType,
    fromHistory, bet, location, tossWinner, tossChoice,
    live, liveMirror, matchId, matchKey,
  } = route.params;
  const isFocused = useIsFocused();
  const liveVersion = useRef(0);

  // Team that batted first is always `battingTeam` here
  const [tab, setTab] = useState<1 | 2>(innings2 ? 2 : 1);
  const [view, setView] = useState<'card' | 'log'>('card');

  let resultText = '';
  if (!isFirstInnings && innings2) {
    if (innings2.runs > innings1.runs) {
      const wl = fieldingTeam.players.length - 1 - innings2.wickets;
      resultText = `${fieldingTeam.name} won by ${wl} wicket${wl !== 1 ? 's' : ''}`;
    } else if (innings2.runs < innings1.runs) {
      const diff = innings1.runs - innings2.runs;
      resultText = `${battingTeam.name} won by ${diff} run${diff !== 1 ? 's' : ''}`;
    } else {
      resultText = 'Match Tied!';
    }
  }

  const [cap1PayPhoto, setCap1PayPhoto] = useState<string | null>(null);
  const [cap2PayPhoto, setCap2PayPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!liveView && !isFirstInnings && !fromHistory) {
      saveResult();
    }
  }, []);

  // At the innings break, co-scorers follow whoever starts the 2nd innings
  useEffect(() => {
    if (!live || !isFirstInnings || liveView || !isFocused) return;
    let stopped = false;
    const tick = async () => {
      try {
        const r = await pullLiveState(live, liveVersion.current);
        if (stopped) return;
        if (r.movedTo) {
          stopped = true;
          popup.show({
            type: 'info', icon: '📲', dismissable: false, title: 'Scoring Moved',
            message: `${r.movedTo} is now scoring this match on their phone, so scoring on this phone is closed.`,
            buttons: [{ text: 'OK', onPress: () => navigation.navigate('Home') }],
          });
          return;
        }
        if (!r.changed) return;
        liveVersion.current = r.version;
        const p = r.payload;
        if (r.fromMe || !p || p.inningsNum !== 2) return;
        if (p.phase === 'scoring') {
          navigation.navigate('Scoring', { ...p.params, savedState: p.savedState, live });
        } else {
          navigation.navigate('Scorecard', { ...p.scorecardParams, live, liveMirror: true });
        }
      } catch (_) {}
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => { stopped = true; clearInterval(id); };
  }, [isFocused]);

  // Match API: the phone that finished the match saves the result (other connected phones skip)
  const saveResult = async () => {
    if (liveMirror || !matchId) return;
    upsertMatch(matchId, matchKey, {
      team1: battingTeam, team2: fieldingTeam, overs, matchType, location, bet,
      tossWinner, tossChoice, innings1, innings2, result: resultText, status: 'completed',
    }).catch(() => {});
  };

  const takePayPhoto = (team: 1 | 2) => {
    launchCamera({ mediaType: 'photo', cameraType: 'front', quality: 0.7 }, res => {
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;
      if (team === 1) setCap1PayPhoto(uri);
      else setCap2PayPhoto(uri);
    });
  };

  const hasBet = bet?.type === 'paid' && bet?.amount > 0;
  const isLoserPays = bet?.type === 'loser' && bet?.amount > 0;

  const abbr = (name: string) => {
    const words = name.trim().split(/\s+/);
    return (words.length > 1 ? words.map(w => w[0]).join('') : name).slice(0, 3).toUpperCase();
  };
  const winner = resultText && resultText !== 'Match Tied!'
    ? (resultText.startsWith(battingTeam.name) ? battingTeam.name : fieldingTeam.name) : null;

  let statusLabel = 'RESULT';
  let statusLine = resultText;
  if (liveView) {
    statusLabel = 'LIVE';
    if (innings2) {
      const need = Math.max(0, innings1.runs + 1 - innings2.runs);
      const left = Math.max(0, overs * 6 - (innings2.overs * 6 + innings2.balls));
      statusLine = `${fieldingTeam.name} need ${need} run${need === 1 ? '' : 's'} in ${left} ball${left === 1 ? '' : 's'}`;
    } else {
      const b = innings1.overs * 6 + innings1.balls;
      statusLine = `${battingTeam.name} batting · CRR ${b ? ((innings1.runs / b) * 6).toFixed(2) : '0.00'}`;
    }
  } else if (isFirstInnings) {
    statusLabel = 'INNINGS BREAK';
    statusLine = `${fieldingTeam.name} need ${innings1.runs + 1} runs to win`;
  }
  const tossLine = tossWinner
    ? `${tossWinner} won the toss and chose to ${tossChoice === 'bat' ? 'bat' : 'bowl'} first`
    : '';

  const teamRows = [
    { team: battingTeam, inn: innings1, n: 1 as const },
    { team: fieldingTeam, inn: innings2, n: 2 as const },
  ];

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <View style={s.headerMid}>
          <Text style={s.headerTitle} numberOfLines={1}>{battingTeam.name} vs {fieldingTeam.name}</Text>
          <Text style={s.headerSub}>Scorecard</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Match summary */}
        <View style={s.summary}>
          <View style={s.summaryTop}>
            <Text style={s.summaryMeta} numberOfLines={1}>
              {overs} OVERS · {matchType === 'local' ? 'LOCAL' : 'DOMESTIC'}
              {bet?.ballType ? ` · ${String(bet.ballType).toUpperCase()} BALL` : ''}
              {location ? ` · ${location.toUpperCase()}` : ''}
            </Text>
            <View style={[s.statusPill, liveView && s.statusPillLive, statusLabel === 'INNINGS BREAK' && s.statusPillBreak]}>
              {liveView && <View style={s.liveDot} />}
              <Text style={s.statusPillText}>{statusLabel}</Text>
            </View>
          </View>

          {teamRows.map(({ team, inn, n }) => {
            const dim = !!winner && winner !== team.name;
            return (
              <View key={n} style={s.teamRow}>
                <View style={[s.badge, n === 2 && s.badge2]}><Text style={s.badgeText}>{abbr(team.name)}</Text></View>
                <Text style={[s.teamName, dim && s.dim]} numberOfLines={1}>{team.name}</Text>
                {inn ? (
                  <Text style={[s.teamScore, dim && s.dim]}>
                    {inn.runs}/{inn.wickets}
                    <Text style={s.teamOvers}>  ({inn.overs}.{inn.balls})</Text>
                  </Text>
                ) : (
                  <Text style={s.yetToBat}>Yet to bat</Text>
                )}
              </View>
            );
          })}

          {!!statusLine && (
            <Text style={[s.statusLine, resultText ? s.statusWin : liveView ? s.statusLive : s.statusBreak]}>
              {resultText ? '🏆 ' : ''}{statusLine}
            </Text>
          )}
          {!!tossLine && <Text style={s.toss}>🪙 {tossLine}</Text>}
        </View>

        {/* Live-streamed match: innings video, ball-by-ball replays and the live stream, in the app */}
        {!!live?.code && (
          <TouchableOpacity
            style={s.videoBtn}
            onPress={() => navigation.navigate('MatchVideo', { code: live.code, title: `${battingTeam.name} vs ${fieldingTeam.name}` })}>
            <Text style={s.videoBtnIcon}>▶</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.videoBtnTitle}>{isFirstInnings ? 'Watch the innings video' : 'Watch match videos'}</Text>
              <Text style={s.videoBtnSub}>Innings videos · ball-by-ball replays · full match</Text>
            </View>
            <Text style={s.videoBtnArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Bet Settlement */}
        {!liveView && !isFirstInnings && hasBet && (
          <BetSettlement
            resultText={resultText}
            battingTeam={battingTeam}
            fieldingTeam={fieldingTeam}
            bet={bet}
            cap1PayPhoto={cap1PayPhoto}
            cap2PayPhoto={cap2PayPhoto}
            takePayPhoto={takePayPhoto}
          />
        )}

        {!liveView && !isFirstInnings && isLoserPays && (
          <LoserSettlement resultText={resultText} battingTeam={battingTeam} fieldingTeam={fieldingTeam} bet={bet} />
        )}

        {/* Innings tabs */}
        <View style={s.tabs}>
          {teamRows.map(({ team, inn, n }) => (
            <TouchableOpacity
              key={n}
              style={[s.tab, tab === n && s.tabOn]}
              disabled={!inn}
              onPress={() => setTab(n)}>
              <Text style={[s.tabTeam, tab === n && s.tabTeamOn, !inn && s.tabOff]}>{abbr(team.name)}</Text>
              <Text style={[s.tabScore, tab === n && s.tabScoreOn, !inn && s.tabOff]}>
                {inn ? `${inn.runs}/${inn.wickets} (${inn.overs}.${inn.balls})` : 'Yet to bat'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.viewRow}>
          <Text style={s.inningsTitle}>
            {tab === 1 ? battingTeam.name : fieldingTeam.name} · {tab === 1 ? '1st' : '2nd'} Innings
          </Text>
          <View style={s.viewToggle}>
            {(['card', 'log'] as const).map(v => (
              <TouchableOpacity key={v} style={[s.viewBtn, view === v && s.viewBtnOn]} onPress={() => setView(v)}>
                <Text style={[s.viewBtnText, view === v && s.viewBtnTextOn]}>{v === 'card' ? 'Scorecard' : 'Commentary'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {view === 'log' ? (
          <View style={s.logCard}>
            <CommentaryList log={(tab === 1 ? innings1 : innings2)?.ballLog ?? []} />
          </View>
        ) : tab === 1 ? (
          <InningsScorecard
            inn={innings1}
            team={battingTeam}
            bowlingTeam={fieldingTeam}
            inProgress={!!liveView && !innings2}
          />
        ) : innings2 ? (
          <InningsScorecard
            inn={innings2}
            team={fieldingTeam}
            bowlingTeam={battingTeam}
            inProgress={!!liveView}
          />
        ) : null}

        {isFirstInnings && !liveView && (
          <TouchableOpacity
            style={s.start2ndBtn}
            onPress={() => {
              const secondInningsParams = {
                battingTeam: fieldingTeam, fieldingTeam: battingTeam,
                overs, matchType, location,
                target: innings1.runs + 1, innings1,
                originalBattingTeam: battingTeam,
                originalFieldingTeam: fieldingTeam, bet,
                tossWinner, tossChoice, matchId, matchKey,
              };
              saveInProgressMatch({ ...secondInningsParams, isSecondInnings: true, savedState: null, live }).catch(() => {});
              navigation.navigate('Scoring', { ...secondInningsParams, live });
            }}>
            <Text style={s.start2ndBtnText}>
              🏏 Start 2nd Innings — {fieldingTeam.name} needs {innings1.runs + 1}
            </Text>
          </TouchableOpacity>
        )}

        {!liveView && !isFirstInnings && (
          <TouchableOpacity style={s.newMatchBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={s.newMatchBtnText}>🏠 Back to Home</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 44, paddingBottom: 10,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  backBtn: { width: 40, height: 36, justifyContent: 'center' },
  back: { color: C.text, fontSize: 22, fontWeight: '600' },
  headerMid: { flex: 1, alignItems: 'center' },
  headerTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  headerSub: { color: C.textMuted, fontSize: 11, fontWeight: '600', marginTop: 1 },
  scroll: { padding: 12, paddingBottom: 40 },
  videoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0B1730',
    borderRadius: 16, padding: 14, marginBottom: 12,
  },
  videoBtnIcon: { color: C.white, fontSize: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: '#EF233C', textAlign: 'center', lineHeight: 38, overflow: 'hidden' },
  videoBtnTitle: { color: C.white, fontSize: 15, fontWeight: '900' },
  videoBtnSub: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  videoBtnArrow: { color: '#FACC15', fontSize: 26, fontWeight: '700' },

  // Summary banner
  summary: { backgroundColor: '#0B1730', borderRadius: 18, padding: 16, marginBottom: 12 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  summaryMeta: { flex: 1, color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginRight: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#16A34A', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillLive: { backgroundColor: C.primary },
  statusPillBreak: { backgroundColor: '#D97706' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.white },
  statusPillText: { color: C.white, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  teamRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  badge: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  badge2: { backgroundColor: C.accent },
  badgeText: { color: C.white, fontSize: 10, fontWeight: '900' },
  teamName: { flex: 1, color: C.white, fontSize: 14, fontWeight: '800' },
  teamScore: { color: C.white, fontSize: 20, fontWeight: '900' },
  teamOvers: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  yetToBat: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  dim: { color: '#94A3B8' },
  statusLine: { marginTop: 10, fontSize: 13, fontWeight: '800' },
  statusWin: { color: '#4ADE80' },
  statusLive: { color: '#FACC15' },
  statusBreak: { color: '#FBBF24' },
  toss: { marginTop: 6, color: '#94A3B8', fontSize: 11, fontWeight: '600' },

  // Loser to pay
  expenseCard: { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.orange + '40' },
  expenseHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  expenseIcon: { fontSize: 26, marginRight: 10 },
  expenseTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  expenseSub: { fontSize: 11, color: C.textMuted },
  expenseTotal: { fontSize: 22, fontWeight: '900', color: C.orange },
  expenseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.divider },
  expenseItem: { fontSize: 13, color: C.textSub, fontWeight: '600' },
  expenseAmt: { fontSize: 13, color: C.text, fontWeight: '800' },
  expenseNote: { fontSize: 12, color: C.textSub, marginTop: 8, lineHeight: 18 },
  expenseVerdict: { marginTop: 10, backgroundColor: C.orangeLight, borderRadius: 10, padding: 10 },
  expenseVerdictTie: { backgroundColor: C.accentLight },
  expenseVerdictText: { fontSize: 13, fontWeight: '900', color: '#9A3412' },
  expenseVerdictTextTie: { color: C.accent },

  // Innings tabs
  tabs: { flexDirection: 'row', backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 12, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: C.primary, backgroundColor: '#FFF7F7' },
  tabTeam: { fontSize: 12, fontWeight: '900', color: C.textSub, letterSpacing: 0.5 },
  tabTeamOn: { color: C.primary },
  tabScore: { fontSize: 11, fontWeight: '700', color: C.textMuted, marginTop: 2 },
  tabScoreOn: { color: C.text },
  tabOff: { color: '#CBD5E1' },
  viewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  viewToggle: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 10, padding: 3 },
  viewBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  viewBtnOn: { backgroundColor: C.white },
  viewBtnText: { fontSize: 11, fontWeight: '700', color: C.textSub },
  viewBtnTextOn: { color: C.text, fontWeight: '900' },
  logCard: { backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: C.cardBorder },
  inningsTitle: { flex: 1, fontSize: 12, fontWeight: '900', color: C.textSub, letterSpacing: 0.5, marginLeft: 2 },

  betCard: {
    backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12,
    borderWidth: 2, borderColor: C.orange + '30',
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  betHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  betHeaderIcon: { fontSize: 28 },
  betCardTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  betHeaderSub: { fontSize: 11, color: C.textMuted },
  resultBanner: {
    borderRadius: 12, padding: 14, marginBottom: 14,
    borderWidth: 1, alignItems: 'center',
  },
  resultBannerText: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  resultBannerSub: { fontSize: 12, fontWeight: '600' },
  betAmountBox: {
    flexDirection: 'row', backgroundColor: C.bg, borderRadius: 12,
    padding: 14, marginBottom: 14, alignItems: 'center',
  },
  betAmountItem: { flex: 1, alignItems: 'center' },
  betDivider: { width: 1, height: 36, backgroundColor: C.cardBorder },
  betAmountLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600', marginBottom: 4 },
  betAmountVal: { fontSize: 22, fontWeight: '900', color: C.orange },
  betStatusVal: { fontSize: 14, fontWeight: '800' },
  teamsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  teamBetCard: {
    flex: 1, borderRadius: 14, padding: 12, alignItems: 'center',
    borderWidth: 1.5,
  },
  winnerCard: { backgroundColor: C.greenLight, borderColor: C.green + '50' },
  loserCard: { backgroundColor: C.primaryLight, borderColor: C.primary + '40' },
  teamBetBadge: { fontSize: 10, fontWeight: '800', color: C.green, marginBottom: 4 },
  teamBetName: { fontSize: 13, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 2 },
  teamBetCap: { fontSize: 11, color: C.textSub, marginBottom: 6 },
  teamBetAmount: { fontSize: 18, fontWeight: '900', color: C.green },
  betSubText: { fontSize: 11, color: C.textMuted, marginBottom: 12 },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoCard: {
    flex: 1, alignItems: 'center', backgroundColor: C.bg,
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.cardBorder,
  },
  photoCardWinner: { borderColor: C.green + '60', backgroundColor: C.greenLight },
  photoRoleBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  photoRoleText: { fontSize: 10, fontWeight: '800' },
  photoCapName: { fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 2, textAlign: 'center' },
  photoTeamName: { fontSize: 10, color: C.textMuted, marginBottom: 8, textAlign: 'center' },
  payPhoto: { width: 64, height: 64, borderRadius: 12, marginBottom: 4 },
  retakeText: { fontSize: 9, color: C.textMuted, textAlign: 'center' },
  captureIcon: { fontSize: 22, marginBottom: 2 },
  markPaidBtn: {
    backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: C.cardBorder, alignItems: 'center',
  },
  markPaidBtnText: { color: C.textSub, fontWeight: '700', fontSize: 11 },
  paidBadge: { marginTop: 6, backgroundColor: C.greenLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  paidBadgeText: { color: C.green, fontSize: 10, fontWeight: '800' },
  allConfirmedBanner: {
    marginTop: 12, backgroundColor: C.greenLight, borderRadius: 12,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: C.green + '40',
  },
  allConfirmedText: { color: C.green, fontWeight: '800', fontSize: 13 },
  start2ndBtn: {
    backgroundColor: C.green, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 12,
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  start2ndBtnText: { color: C.white, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  newMatchBtn: {
    backgroundColor: C.white, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: C.cardBorder,
  },
  newMatchBtnText: { color: C.text, fontSize: 15, fontWeight: '700' },
});
