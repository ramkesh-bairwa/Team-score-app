import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import qrcode from 'qrcode-generator';

// Pure-JS QR code drawn with Views (no native module). Dark modules in a row are
// merged into runs to keep the view count low.
export default function QRCode({ value, size = 220, color = '#0F172A' }: { value: string; size?: number; color?: string }) {
  const rows = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const out: { start: number; len: number }[][] = [];
    for (let r = 0; r < n; r++) {
      const runs: { start: number; len: number }[] = [];
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        const last = runs[runs.length - 1];
        if (last && last.start + last.len === c) last.len++;
        else runs.push({ start: c, len: 1 });
      }
      out.push(runs);
    }
    return out;
  }, [value]);

  const quiet = 4; // standard quiet-zone width, in modules
  const cell = size / (rows.length + quiet * 2);
  return (
    <View style={[s.box, { width: size, height: size, padding: cell * quiet }]}>
      {rows.map((runs, r) => (
        <View key={r} style={{ height: cell }}>
          {runs.map(run => (
            <View
              key={run.start}
              style={[s.run, { left: run.start * cell, width: run.len * cell + 0.5, height: cell + 0.5, backgroundColor: color }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: '#FFFFFF', borderRadius: 12 },
  run: { position: 'absolute', top: 0 },
});
