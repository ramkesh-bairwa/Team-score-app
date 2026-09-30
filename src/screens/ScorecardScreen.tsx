import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image,
} from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { saveMatch as saveMatchApi, saveInProgressMatch } from '../services/api';
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

export default function ScorecardScreen({ navigation, route }: any) {
  const {
    battingTeam, fieldingTeam, overs, innings1,
    isFirstInnings, liveView, innings2, matchType,
    fromHistory, bet, location, tossWinner, tossChoice,
  } = route.params;

  const oversDisplay = `${innings1.overs}.${innings1.balls}`;

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
      saveMatchApi({
        battingTeam, fieldingTeam, overs, matchType, location,
        tossWinner: tossWinner || '',
        tossChoice: tossChoice || '',
        betAmount: bet?.amount || 0,
        bet: bet || null,
        innings1, innings2, result: resultText,
      }).catch(() => {});
    }
  }, []);

  const takePayPhoto = (team: 1 | 2) => {
    launchCamera({ mediaType: 'photo', cameraType: 'front', quality: 0.7 }, res => {
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;
      if (team === 1) setCap1PayPhoto(uri);
      else setCap2PayPhoto(uri);
    });
  };

  const hasBet = bet?.type === 'paid' && bet?.amount > 0;

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← {liveView ? 'Back to Match' : 'Back'}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Scorecard</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Summary */}
        <View style={s.summaryCard}>
          <Text style={s.matchTitle}>{battingTeam.name} vs {fieldingTeam.name}</Text>
          <Text style={s.matchSub}>
            {overs} Overs · {matchType === 'local' ? '🏘️ Local' : '🏟️ Domestic'}
            {location ? `  📍 ${location}` : ''}
          </Text>
          <View style={s.scoreBox}>
            <Text style={s.bigScore}>{innings1.runs}/{innings1.wickets}</Text>
            <Text style={s.bigOvers}>({oversDisplay} ov)</Text>
          </View>
          {innings2 && (
            <Text style={s.score2nd}>
              {fieldingTeam.name}: {innings2.runs}/{innings2.wickets} ({innings2.overs}.{innings2.balls} ov)
            </Text>
          )}
          <View style={[s.resultBox,
            liveView ? { backgroundColor: '#ff000030' } :
            resultText ? { backgroundColor: C.greenLight } : {}]}>
            <Text style={[s.resultText,
              liveView ? { color: '#cc0000' } :
              resultText ? { color: C.green } : { color: C.white }]}>
              {liveView ? '🔴 LIVE' : resultText ? `🏆 ${resultText}` : '🏏 1st Innings Complete'}
            </Text>
          </View>
        </View>

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

        {/* 1st Innings Batting */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🏏 {battingTeam.name} Batting</Text>
          <View style={s.tableHeader}>
            <Text style={s.colBatter}>Batter</Text>
            <Text style={s.colStat}>R</Text><Text style={s.colStat}>B</Text>
            <Text style={s.colStat}>4s</Text><Text style={s.colStat}>6s</Text>
            <Text style={s.colStat}>SR</Text>
          </View>
          {innings1.batters.map((b: any, i: number) => (
            <View key={i} style={[s.tableRow, b.out && s.tableRowOut]}>
              <View style={s.colBatterWrap}>
                <Text style={[s.batterName, !b.out && s.batterNameActive]}>{b.name}</Text>
                {b.name === battingTeam.captain && <Text style={s.capBadge}>©</Text>}
                {b.out ? <Text style={s.outLabel}>out</Text> : <Text style={s.notOutLabel}>not out</Text>}
              </View>
              <Text style={s.colStat}>{b.runs}</Text>
              <Text style={s.colStat}>{b.balls}</Text>
              <Text style={s.colStat}>{b.fours}</Text>
              <Text style={s.colStat}>{b.sixes}</Text>
              <Text style={s.colStat}>{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(0) : '-'}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalVal}>{innings1.runs}/{innings1.wickets} ({oversDisplay} ov)</Text>
          </View>
        </View>

        {/* 1st Innings Bowling */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🎳 {fieldingTeam.name} Bowling</Text>
          <View style={s.tableHeader}>
            <Text style={s.colBatter}>Bowler</Text>
            <Text style={s.colStat}>O</Text><Text style={s.colStat}>R</Text>
            <Text style={s.colStat}>W</Text><Text style={s.colStat}>Eco</Text>
          </View>
          {innings1.bowlers.map((b: any, i: number) => (
            <View key={i} style={s.tableRow}>
              <View style={s.colBatterWrap}>
                <Text style={s.batterName}>{b.name}</Text>
                {b.name === fieldingTeam.captain && <Text style={s.capBadge}>©</Text>}
              </View>
              <Text style={s.colStat}>{b.overs}.{b.balls}</Text>
              <Text style={s.colStat}>{b.runs}</Text>
              <Text style={[s.colStat, b.wickets > 0 && s.wicketStat]}>{b.wickets}</Text>
              <Text style={s.colStat}>
                {(b.overs * 6 + b.balls) > 0 ? (b.runs / ((b.overs * 6 + b.balls) / 6)).toFixed(1) : '-'}
              </Text>
            </View>
          ))}
        </View>

        {/* 2nd Innings */}
        {innings2 && (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>🏏 {fieldingTeam.name} Batting (2nd Innings)</Text>
              <View style={s.tableHeader}>
                <Text style={s.colBatter}>Batter</Text>
                <Text style={s.colStat}>R</Text><Text style={s.colStat}>B</Text>
                <Text style={s.colStat}>4s</Text><Text style={s.colStat}>6s</Text>
                <Text style={s.colStat}>SR</Text>
              </View>
              {innings2.batters.map((b: any, i: number) => (
                <View key={i} style={[s.tableRow, b.out && s.tableRowOut]}>
                  <View style={s.colBatterWrap}>
                    <Text style={[s.batterName, !b.out && s.batterNameActive]}>{b.name}</Text>
                    {b.name === fieldingTeam.captain && <Text style={s.capBadge}>©</Text>}
                    {b.out ? <Text style={s.outLabel}>out</Text> : <Text style={s.notOutLabel}>not out</Text>}
                  </View>
                  <Text style={s.colStat}>{b.runs}</Text>
                  <Text style={s.colStat}>{b.balls}</Text>
                  <Text style={s.colStat}>{b.fours}</Text>
                  <Text style={s.colStat}>{b.sixes}</Text>
                  <Text style={s.colStat}>{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(0) : '-'}</Text>
                </View>
              ))}
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Total</Text>
                <Text style={s.totalVal}>{innings2.runs}/{innings2.wickets} ({innings2.overs}.{innings2.balls} ov)</Text>
              </View>
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>🎳 {battingTeam.name} Bowling (2nd Innings)</Text>
              <View style={s.tableHeader}>
                <Text style={s.colBatter}>Bowler</Text>
                <Text style={s.colStat}>O</Text><Text style={s.colStat}>R</Text>
                <Text style={s.colStat}>W</Text><Text style={s.colStat}>Eco</Text>
              </View>
              {innings2.bowlers.map((b: any, i: number) => (
                <View key={i} style={s.tableRow}>
                  <View style={s.colBatterWrap}>
                    <Text style={s.batterName}>{b.name}</Text>
                    {b.name === battingTeam.captain && <Text style={s.capBadge}>©</Text>}
                  </View>
                  <Text style={s.colStat}>{b.overs}.{b.balls}</Text>
                  <Text style={s.colStat}>{b.runs}</Text>
                  <Text style={[s.colStat, b.wickets > 0 && s.wicketStat]}>{b.wickets}</Text>
                  <Text style={s.colStat}>
                    {(b.overs * 6 + b.balls) > 0 ? (b.runs / ((b.overs * 6 + b.balls) / 6)).toFixed(1) : '-'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

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
              };
              saveInProgressMatch({ ...secondInningsParams, isSecondInnings: true, savedState: null }).catch(() => {});
              navigation.navigate('Scoring', secondInningsParams);
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
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  back: { color: C.primary, fontSize: 15, fontWeight: '600', width: 80 },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },
  summaryCard: { backgroundColor: C.primary, borderRadius: 20, padding: 20, marginBottom: 16, alignItems: 'center' },
  matchTitle: { color: C.white, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  matchSub: { color: '#ffffff80', fontSize: 12, marginBottom: 16, textAlign: 'center' },
  scoreBox: { alignItems: 'center', marginBottom: 4 },
  bigScore: { color: C.white, fontSize: 52, fontWeight: '900', lineHeight: 56 },
  bigOvers: { color: '#ffffff80', fontSize: 14, marginBottom: 8 },
  score2nd: { color: '#ffffffcc', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  resultBox: { backgroundColor: '#ffffff20', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 6 },
  resultText: { color: C.white, fontSize: 13, fontWeight: '700' },
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
  card: {
    backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.divider },
  tableRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.divider },
  tableRowOut: { opacity: 0.6 },
  colBatter: { flex: 1, fontSize: 11, fontWeight: '700', color: C.textMuted },
  colBatterWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  colStat: { width: 38, textAlign: 'center', fontSize: 13, color: C.text, fontWeight: '600' },
  batterName: { fontSize: 14, color: C.textSub, fontWeight: '500' },
  batterNameActive: { color: C.text, fontWeight: '700' },
  capBadge: { fontSize: 11, color: C.orange, fontWeight: '700' },
  outLabel: { fontSize: 10, color: C.primary, fontWeight: '600', backgroundColor: C.primaryLight, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  notOutLabel: { fontSize: 10, color: C.green, fontWeight: '600', backgroundColor: C.greenLight, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  wicketStat: { color: C.primary, fontWeight: '800' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  totalLabel: { fontSize: 14, fontWeight: '800', color: C.text },
  totalVal: { fontSize: 14, fontWeight: '800', color: C.primary },
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
