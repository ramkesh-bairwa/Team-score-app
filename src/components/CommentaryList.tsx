import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../theme/colors';

export type LogEntry = {
  over: string; bat: string; bowl: string; runs: number; extra?: string; wicket?: boolean;
  score: string; text: string; kind: 'four' | 'six' | 'wicket' | 'extra' | 'run' | 'dot';
};

const BADGE: Record<LogEntry['kind'], { bg: string; fg: string }> = {
  six: { bg: '#7C3AED', fg: C.white },
  four: { bg: C.accent, fg: C.white },
  wicket: { bg: C.primary, fg: C.white },
  extra: { bg: C.orangeLight, fg: C.orange },
  run: { bg: C.divider, fg: C.text },
  dot: { bg: C.divider, fg: C.textMuted },
};

const badgeLabel = (e: LogEntry) => {
  if (e.wicket) return 'W';
  if (e.extra === 'db') return 'DB';
  if (e.extra) return `${e.extra === 'b' ? 'B' : e.extra.toUpperCase()}${e.runs || ''}`;
  return e.runs === 0 ? '•' : String(e.runs);
};

// Ball-by-ball log, newest first: over, batter vs bowler, commentary line, score after the ball
export default function CommentaryList({ log, limit }: { log: LogEntry[]; limit?: number }) {
  const items = [...log].reverse().slice(0, limit ?? log.length);
  if (!items.length) return <Text style={s.empty}>Ball-by-ball commentary appears here once play starts 🎙️</Text>;
  return (
    <View>
      {items.map((e, i) => {
        const big = e.kind === 'four' || e.kind === 'six' || e.kind === 'wicket';
        const b = BADGE[e.kind];
        return (
          <View key={`${e.over}-${log.length - i}`} style={[s.row, big && s.rowBig, e.kind === 'wicket' && s.rowWicket]}>
            <View style={s.left}>
              <Text style={s.over}>{e.over}</Text>
              <View style={[s.badge, { backgroundColor: b.bg }]}>
                <Text style={[s.badgeText, { color: b.fg }]}>{badgeLabel(e)}</Text>
              </View>
            </View>
            <View style={s.body}>
              <Text style={s.who} numberOfLines={1}>{e.bowl} to {e.bat}</Text>
              <Text style={[s.text, big && s.textBig]}>{e.text}</Text>
            </View>
            <Text style={s.score}>{e.score}</Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  empty: { textAlign: 'center', color: C.textMuted, paddingVertical: 28, fontSize: 13 },
  row: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.divider },
  rowBig: { backgroundColor: '#F8FAFF', marginHorizontal: -12, paddingHorizontal: 12 },
  rowWicket: { backgroundColor: '#FFF5F5' },
  left: { width: 44, alignItems: 'center', marginRight: 10 },
  over: { fontSize: 11, fontWeight: '800', color: C.textSub, marginBottom: 4 },
  badge: { minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontSize: 11, fontWeight: '900' },
  body: { flex: 1 },
  who: { fontSize: 11, fontWeight: '800', color: C.textMuted, marginBottom: 2 },
  text: { fontSize: 13, color: C.text, lineHeight: 19 },
  textBig: { fontWeight: '700' },
  score: { fontSize: 11, fontWeight: '900', color: C.textSub, marginLeft: 8, marginTop: 1 },
});
