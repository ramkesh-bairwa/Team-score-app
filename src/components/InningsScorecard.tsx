import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../theme/colors';

type Ball = { runs: number; extra?: string; wicket?: boolean };
type Team = { name: string; players: string[]; captain?: string; playerDetails?: { name: string; roles?: string[] }[] };
export type Innings = {
  runs: number; wickets: number; overs: number; balls: number;
  batters: { name: string; runs: number; balls: number; fours: number; sixes: number; out: boolean; howOut?: string }[];
  bowlers: { name: string; overs: number; balls: number; runs: number; wickets: number; maidens?: number; wides?: number; noBalls?: number }[];
  overHistory?: Ball[][];
  fallOfWickets?: { score: number; wicket: number; over: string; batter: string }[];
  ballLog?: import('./CommentaryList').LogEntry[];
};

const sr = (r: number, b: number) => (b > 0 ? ((r / b) * 100).toFixed(1) : '-');
const econ = (r: number, o: number, b: number) => (o * 6 + b > 0 ? (r / ((o * 6 + b) / 6)).toFixed(2) : '-');

// Extras breakdown from ball history; older matches without history fall back to total minus batters' runs
function extrasOf(inn: Innings) {
  if (!inn.overHistory) {
    const bat = inn.batters.reduce((sum, b) => sum + b.runs, 0);
    return { total: Math.max(0, inn.runs - bat), detail: '' };
  }
  const all = inn.overHistory.flat();
  const sum = (t: string) => all.filter(b => b.extra === t).reduce((acc, b) => acc + b.runs, 0);
  const parts = { b: sum('b'), lb: sum('lb'), w: sum('wd'), nb: sum('nb') };
  const total = parts.b + parts.lb + parts.w + parts.nb;
  return { total, detail: `b ${parts.b}, lb ${parts.lb}, w ${parts.w}, nb ${parts.nb}` };
}

const roleTag = (team: Team, name: string) => {
  const tags: string[] = [];
  if (team.captain === name) tags.push('c');
  if (team.playerDetails?.find(p => p.name === name)?.roles?.includes('Keeper')) tags.push('wk');
  return tags.length ? ` (${tags.join(', ')})` : '';
};

// Cricbuzz-style innings: batting table, extras, total, did not bat, fall of wickets, bowling table
export default function InningsScorecard({ inn, team, bowlingTeam, inProgress }: {
  inn: Innings; team: Team; bowlingTeam: Team; inProgress: boolean;
}) {
  const extras = extrasOf(inn);
  const batted = new Set(inn.batters.map(b => b.name));
  const yetToBat = team.players.filter(p => !batted.has(p));
  const totalBalls = inn.overs * 6 + inn.balls;
  const rr = totalBalls > 0 ? ((inn.runs / totalBalls) * 6).toFixed(2) : '0.00';

  return (
    <View>
      {/* Batting */}
      <View style={s.table}>
        <View style={[s.row, s.headRow]}>
          <Text style={[s.nameCol, s.head]}>Batter</Text>
          <Text style={[s.num, s.head]}>R</Text>
          <Text style={[s.num, s.head]}>B</Text>
          <Text style={[s.numSm, s.head]}>4s</Text>
          <Text style={[s.numSm, s.head]}>6s</Text>
          <Text style={[s.numWide, s.head]}>SR</Text>
        </View>
        {inn.batters.map((b, i) => (
          <View key={`${b.name}-${i}`} style={[s.row, s.bodyRow]}>
            <View style={s.nameCol}>
              <Text style={[s.player, !b.out && s.playerIn]} numberOfLines={1}>
                {b.name}{roleTag(team, b.name)}{!b.out && inProgress ? ' *' : ''}
              </Text>
              <Text style={[s.dismissal, !b.out && s.notOut]} numberOfLines={1}>
                {b.out ? (b.howOut || 'out') : inProgress ? 'batting' : 'not out'}
              </Text>
            </View>
            <Text style={[s.num, s.runs]}>{b.runs}</Text>
            <Text style={s.num}>{b.balls}</Text>
            <Text style={s.numSm}>{b.fours}</Text>
            <Text style={s.numSm}>{b.sixes}</Text>
            <Text style={s.numWide}>{sr(b.runs, b.balls)}</Text>
          </View>
        ))}

        <View style={[s.row, s.bodyRow]}>
          <Text style={[s.nameCol, s.label]}>Extras</Text>
          <Text style={s.extrasVal}>
            <Text style={s.bold}>{extras.total}</Text>
            {extras.detail ? <Text style={s.muted}>  ({extras.detail})</Text> : null}
          </Text>
        </View>
        <View style={[s.row, s.totalRow]}>
          <Text style={[s.nameCol, s.totalLabel]}>Total</Text>
          <Text style={s.totalVal}>
            {inn.runs}
            <Text style={s.totalMeta}>  ({inn.wickets} wkts, {inn.overs}.{inn.balls} Ov, RR {rr})</Text>
          </Text>
        </View>
        {yetToBat.length > 0 && (
          <View style={s.noteRow}>
            <Text style={s.noteLabel}>{inProgress ? 'Yet to bat' : 'Did not bat'}</Text>
            <Text style={s.noteText}>{yetToBat.map(p => p + roleTag(team, p)).join(', ')}</Text>
          </View>
        )}
      </View>

      {/* Fall of wickets */}
      {!!inn.fallOfWickets?.length && (
        <View style={s.table}>
          <View style={[s.row, s.headRow]}><Text style={[s.head, s.flex]}>Fall of wickets</Text></View>
          <View style={s.fowWrap}>
            {inn.fallOfWickets.map(f => (
              <View key={f.wicket} style={s.fowItem}>
                <Text style={s.fowScore}>{f.score}-{f.wicket}</Text>
                <Text style={s.fowMeta} numberOfLines={1}>{f.batter} · {f.over} ov</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Bowling */}
      <View style={s.table}>
        <View style={[s.row, s.headRow]}>
          <Text style={[s.nameCol, s.head]}>Bowler</Text>
          <Text style={[s.num, s.head]}>O</Text>
          <Text style={[s.numSm, s.head]}>M</Text>
          <Text style={[s.num, s.head]}>R</Text>
          <Text style={[s.numSm, s.head]}>W</Text>
          <Text style={[s.numSm, s.head]}>NB</Text>
          <Text style={[s.numSm, s.head]}>WD</Text>
          <Text style={[s.numWide, s.head]}>ECO</Text>
        </View>
        {inn.bowlers.map((b, i) => (
          <View key={`${b.name}-${i}`} style={[s.row, s.bodyRow]}>
            <Text style={[s.nameCol, s.player]} numberOfLines={1}>{b.name}{roleTag(bowlingTeam, b.name)}</Text>
            <Text style={s.num}>{b.overs}.{b.balls}</Text>
            <Text style={s.numSm}>{b.maidens ?? 0}</Text>
            <Text style={s.num}>{b.runs}</Text>
            <Text style={[s.numSm, s.runs, b.wickets > 0 && s.wkts]}>{b.wickets}</Text>
            <Text style={s.numSm}>{b.noBalls ?? 0}</Text>
            <Text style={s.numSm}>{b.wides ?? 0}</Text>
            <Text style={s.numWide}>{econ(b.runs, b.overs, b.balls)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  table: {
    backgroundColor: C.white, borderRadius: 14, marginBottom: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: C.cardBorder,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  headRow: { backgroundColor: '#F1F5F9', paddingVertical: 8 },
  bodyRow: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.divider },
  head: { fontSize: 11, fontWeight: '800', color: C.textSub },
  flex: { flex: 1 },
  nameCol: { flex: 1, paddingRight: 6 },
  num: { width: 32, textAlign: 'right', fontSize: 12, color: C.text },
  numSm: { width: 26, textAlign: 'right', fontSize: 12, color: C.text },
  numWide: { width: 44, textAlign: 'right', fontSize: 12, color: C.text },
  player: { fontSize: 13, fontWeight: '700', color: C.accent },
  playerIn: { color: C.text },
  dismissal: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  notOut: { color: C.green, fontWeight: '600' },
  runs: { fontWeight: '900' },
  wkts: { color: C.primary },
  label: { fontSize: 12, fontWeight: '700', color: C.text },
  extrasVal: { fontSize: 12, color: C.text },
  bold: { fontWeight: '800' },
  muted: { color: C.textMuted, fontSize: 11 },
  totalRow: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.cardBorder, backgroundColor: '#FAFAFA' },
  totalLabel: { fontSize: 14, fontWeight: '900', color: C.text },
  totalVal: { fontSize: 16, fontWeight: '900', color: C.text },
  totalMeta: { fontSize: 11, fontWeight: '600', color: C.textSub },
  noteRow: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.divider },
  noteLabel: { fontSize: 11, fontWeight: '800', color: C.textSub, marginBottom: 2 },
  noteText: { fontSize: 12, color: C.accent, lineHeight: 18 },
  fowWrap: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 8 },
  fowItem: {
    backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: C.divider, maxWidth: '48%',
  },
  fowScore: { fontSize: 13, fontWeight: '900', color: C.text },
  fowMeta: { fontSize: 10, color: C.textMuted, marginTop: 1 },
});
