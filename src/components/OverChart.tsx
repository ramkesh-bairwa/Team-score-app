import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { C } from '../theme/colors';

export type OverStat = { runs: number; wickets: number; live?: boolean };

const CHART_H = 150;
const BAR_W = 18;

// Manhattan chart: runs per over, wickets as red dots, optional 1st-innings comparison bars
export default function OverChart({ data, compare, totalOvers, teamName, compareName }: {
  data: OverStat[]; compare?: OverStat[]; totalOvers: number; teamName: string; compareName?: string;
}) {
  const count = Math.max(data.length, compare?.length ?? 0, Math.min(totalOvers, 6));
  const maxRuns = Math.max(6, ...data.map(d => d.runs), ...(compare ?? []).map(d => d.runs));
  const step = maxRuns > 18 ? 10 : maxRuns > 9 ? 5 : 2;
  const top = Math.ceil(maxRuns / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step).reverse();
  const h = (runs: number) => Math.max(runs > 0 ? 3 : 0, (runs / top) * CHART_H);

  return (
    <View>
      <View style={s.legendRow}>
        <View style={s.legendItem}><View style={[s.legendSwatch, { backgroundColor: C.accent }]} /><Text style={s.legendText}>{teamName}</Text></View>
        {compare && compareName && (
          <View style={s.legendItem}><View style={[s.legendSwatch, { backgroundColor: '#CBD5E1' }]} /><Text style={s.legendText}>{compareName}</Text></View>
        )}
        <View style={s.legendItem}><View style={s.wicketDot} /><Text style={s.legendText}>Wicket</Text></View>
      </View>

      <View style={s.chartRow}>
        <View style={[s.axis, { height: CHART_H }]}>
          {ticks.map(t => <Text key={t} style={s.axisText}>{t}</Text>)}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.barsScroll}>
          <View>
            <View style={[s.plot, { height: CHART_H }]}>
              {ticks.map(t => <View key={t} style={[s.gridLine, { bottom: (t / top) * CHART_H }]} />)}
              {Array.from({ length: count }, (_, i) => {
                const d = data[i];
                const c = compare?.[i];
                return (
                  <View key={i} style={s.group}>
                    {compare && <View style={[s.bar, s.compareBar, { height: c ? h(c.runs) : 0 }]} />}
                    <View style={s.barCol}>
                      {d && d.wickets > 0 && (
                        <View style={s.wicketStack}>
                          {Array.from({ length: d.wickets }, (__, w) => <View key={w} style={s.wicketDot} />)}
                        </View>
                      )}
                      {d && d.runs > 0 && <Text style={s.barValue}>{d.runs}</Text>}
                      <View style={[s.bar, { height: d ? h(d.runs) : 0 }, d?.live && s.liveBar, d && d.runs >= 12 && s.bigBar]} />
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={s.labels}>
              {Array.from({ length: count }, (_, i) => (
                <Text key={i} style={[s.label, compare && s.labelWide]}>{i + 1}</Text>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
      <Text style={s.caption}>Runs per over</Text>
    </View>
  );
}

const s = StyleSheet.create({
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 11, color: C.textSub, fontWeight: '600' },
  chartRow: { flexDirection: 'row' },
  axis: { width: 22, justifyContent: 'space-between', marginRight: 4, marginTop: -6 },
  axisText: { fontSize: 9, color: C.textMuted, textAlign: 'right', lineHeight: 12 },
  barsScroll: { paddingRight: 8 },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: C.divider },
  group: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barCol: { alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: BAR_W, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: C.accent },
  bigBar: { backgroundColor: '#7C3AED' },
  liveBar: { opacity: 0.55 },
  compareBar: { width: 8, backgroundColor: '#CBD5E1' },
  barValue: { fontSize: 9, fontWeight: '800', color: C.textSub, marginBottom: 2 },
  wicketStack: { gap: 2, marginBottom: 3, alignItems: 'center' },
  wicketDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary },
  labels: { flexDirection: 'row', gap: 8, marginTop: 4 },
  label: { width: BAR_W, textAlign: 'center', fontSize: 9, color: C.textMuted, fontWeight: '600' },
  labelWide: { width: BAR_W + 10, textAlign: 'right' },
  caption: { fontSize: 10, color: C.textMuted, textAlign: 'center', marginTop: 6 },
});
