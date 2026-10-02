import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { PopupCard } from './Popup';
import QRCode from './QRCode';
import { LiveSession, JoinRole } from '../services/live';
import { getApiUrl } from '../services/server';
import { buildJoinLink } from '../utils/qrScan';
import { C } from '../theme/colors';

type Mode = 'qr' | 'code';

// Share a match two ways: a QR code (also carries the server address) or the 6-character code
export default function ShareMatchModal({ visible, session, initialRole = 'streamer', onClose }: {
  visible: boolean; session: LiveSession; initialRole?: JoinRole; onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>('qr');
  const [server, setServer] = useState('');
  const [role, setRole] = useState<JoinRole>(initialRole);

  useEffect(() => {
    if (visible) { getApiUrl().then(setServer); setRole(initialRole); }
  }, [visible, initialRole]);

  const shareCode = () => {
    Share.share({
      message: `Join my CricScore match 🏏\nOpen CricScore → "Join a Match with Code" and enter: ${session.code}`,
    }).catch(() => {});
  };

  return (
    <PopupCard visible={visible} onRequestClose={onClose}>
      <Text style={s.title}>Connect a Phone</Text>
      <Text style={s.sub}>Only one other phone can connect. It scans the QR or types the code, then you approve it.</Text>

      <View style={s.roleRow}>
        {([
          { key: 'streamer', label: '📺 Live Stream' },
          { key: 'scorer', label: '🏏 Hand Over Scoring' },
        ] as const).map(r => (
          <TouchableOpacity key={r.key} style={[s.roleBtn, role === r.key && s.roleBtnOn]} onPress={() => setRole(r.key)}>
            <Text style={[s.roleText, role === r.key && s.roleTextOn]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.tabs}>
        {(['qr', 'code'] as const).map(m => (
          <TouchableOpacity key={m} style={[s.tab, mode === m && s.tabOn]} onPress={() => setMode(m)}>
            <Text style={[s.tabText, mode === m && s.tabTextOn]}>{m === 'qr' ? '▦  QR Code' : '#  Code'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'qr' ? (
        <View style={s.qrWrap}>
          {server ? <QRCode value={buildJoinLink(session.code, server, role)} size={210} /> : <View style={s.qrPlaceholder} />}
          <Text style={s.hint}>On the other phone: Join a Match → 📷 Scan QR</Text>
        </View>
      ) : (
        <View style={s.codeWrap}>
          <View style={s.codeBox}>
            <Text style={s.code}>{session.code}</Text>
          </View>
          <Text style={s.hint}>On the other phone: Join a Match → enter this code → choose {role === 'streamer' ? '📺 Live Stream' : '🏏 Take Over Scoring'}</Text>
          <TouchableOpacity style={s.shareBtn} onPress={shareCode}>
            <Text style={s.shareBtnText}>Share Code</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.note}>
        <Text style={s.noteText}>
          {role === 'streamer'
            ? '📺 The stream phone shows the live score and streams to YouTube. It can never change the score.'
            : '⚠️ When they start scoring, scoring on this phone will close.'}
        </Text>
      </View>

      <TouchableOpacity style={s.doneBtn} onPress={onClose}>
        <Text style={s.doneText}>Done</Text>
      </TouchableOpacity>
    </PopupCard>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '900', color: C.text },
  sub: { fontSize: 13, color: C.textSub, textAlign: 'center', marginTop: 4, marginBottom: 14, lineHeight: 18 },
  roleRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginBottom: 12 },
  roleBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: C.cardBorder },
  roleBtnOn: { borderColor: C.primary, backgroundColor: C.primaryLight },
  roleText: { fontSize: 12, fontWeight: '800', color: C.textSub },
  roleTextOn: { color: C.primary },
  tabs: { flexDirection: 'row', alignSelf: 'stretch', backgroundColor: C.divider, borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  tabOn: { backgroundColor: C.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '700', color: C.textSub },
  tabTextOn: { color: C.text, fontWeight: '900' },
  qrWrap: { alignItems: 'center' },
  qrPlaceholder: { width: 210, height: 210, borderRadius: 12, backgroundColor: C.divider },
  codeWrap: { alignItems: 'center', alignSelf: 'stretch' },
  codeBox: {
    alignSelf: 'stretch', alignItems: 'center', paddingVertical: 22, borderRadius: 16,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.accent + '60', backgroundColor: C.accentLight,
  },
  code: { fontSize: 38, fontWeight: '900', letterSpacing: 10, color: C.accent },
  hint: { fontSize: 12, color: C.textMuted, marginTop: 10, textAlign: 'center' },
  shareBtn: { marginTop: 12, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 26 },
  shareBtnText: { color: C.white, fontSize: 14, fontWeight: '800' },
  note: { alignSelf: 'stretch', marginTop: 16, backgroundColor: C.orangeLight, borderRadius: 10, padding: 10 },
  noteText: { fontSize: 12, color: '#9A3412', fontWeight: '600', lineHeight: 17, textAlign: 'center' },
  doneBtn: { marginTop: 12, alignSelf: 'stretch', alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: C.divider },
  doneText: { color: C.textSub, fontSize: 15, fontWeight: '700' },
});
