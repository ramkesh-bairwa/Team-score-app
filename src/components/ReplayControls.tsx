import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LiveSession, sendReplay } from '../services/live';

const OPTIONS: { label: string; seconds: number; rate: number }[] = [
  { label: '30s', seconds: 30, rate: 1 },
  { label: '1 min', seconds: 60, rate: 1 },
  { label: '2 min', seconds: 120, rate: 1 },
  { label: '3 min', seconds: 180, rate: 1 },
  { label: '🐢 Slow-mo', seconds: 10, rate: 0.5 },
];

// Replay buttons for the match's camera stream: the replay plays on the camera device and every
// viewer sees it with a REPLAY tag, then it cuts back to live by itself
export default function ReplayControls({ session, dark = true }: { session: LiveSession; dark?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (key: string, action: 'start' | 'stop', seconds?: number, rate?: number) => {
    setBusy(key);
    setMsg(null);
    try {
      await sendReplay(session, action, seconds, rate);
      setMsg({ ok: true, text: action === 'stop' ? 'Back to live' : `Replay on air (${key})` });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Replay failed' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[s.box, !dark && s.boxLight]}>
      <Text style={[s.title, !dark && s.titleLight]}>⏪ Replay on the live stream</Text>
      <View style={s.row}>
        {OPTIONS.map(o => (
          <TouchableOpacity key={o.label} style={s.btn} disabled={!!busy} onPress={() => run(o.label, 'start', o.seconds, o.rate)}>
            {busy === o.label ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>{o.label}</Text>}
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[s.btn, s.stop]} disabled={!!busy} onPress={() => run('stop', 'stop')}>
          {busy === 'stop' ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>■ Live</Text>}
        </TouchableOpacity>
      </View>
      {msg ? (
        <Text style={[s.msg, msg.ok ? s.ok : s.err]}>{msg.ok ? '✅ ' : '⛔ '}{msg.text}</Text>
      ) : (
        <Text style={[s.hint, !dark && s.hintLight]}>Plays on the camera device and every viewer's screen, then returns to live.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: '#13244A', borderRadius: 16, padding: 14, marginBottom: 12 },
  boxLight: { backgroundColor: '#0B1730' },
  title: { color: '#fff', fontSize: 14, fontWeight: '900', marginBottom: 10 },
  titleLight: { color: '#fff' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    minWidth: 58, paddingHorizontal: 12, height: 38, borderRadius: 19, backgroundColor: '#ffffff22',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ffffff33',
  },
  stop: { backgroundColor: '#EF233C', borderColor: '#EF233C' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  msg: { fontSize: 12, fontWeight: '700', marginTop: 10, lineHeight: 17 },
  ok: { color: '#4ADE80' },
  err: { color: '#FCA5A5' },
  hint: { color: '#94A3B8', fontSize: 11, marginTop: 10, lineHeight: 16 },
  hintLight: { color: '#94A3B8' },
});
