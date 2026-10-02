import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Share, Linking } from 'react-native';
import QRCode from './QRCode';
import { CameraStream, getStreamStatus } from '../services/stream';
import { C } from '../theme/colors';

type Tab = 'camera' | 'watch';

// Free WebRTC live stream: the camera phone scans a QR and goes live in its browser;
// viewers open the watch link on any phone and see the video with the live scoreboard.
export default function CameraLiveSheet({ visible, code, links, onClose, onYoutube }: {
  visible: boolean; code: string; links: CameraStream | null; onClose: () => void; onYoutube: () => void;
}) {
  const [tab, setTab] = useState<Tab>('camera');
  const [status, setStatus] = useState<{ live: boolean; viewers: number; maxViewers: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    const tick = () => getStreamStatus(code).then(s => { if (alive) setStatus(s); }).catch(() => {});
    tick();
    const t = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [visible, code]);

  const shareWatch = () => {
    if (links) Share.share({ message: `Watch our match live 🏏🔴\n${links.watchUrl}` }).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.titleRow}>
              <Text style={s.title}>📹 Live Stream</Text>
              <View style={[s.pill, status?.live && s.pillLive]}>
                {status?.live && <View style={s.dot} />}
                <Text style={s.pillText}>
                  {status?.live ? `LIVE · 👁 ${status.viewers}/${status.maxViewers}` : 'NOT LIVE YET'}
                </Text>
              </View>
            </View>
            <Text style={s.sub}>Free, no YouTube or app needed. Works in Chrome or Safari.</Text>

            <View style={s.tabs}>
              {([
                { key: 'camera', label: '📹 Camera phone' },
                { key: 'watch', label: '👀 Viewers' },
              ] as const).map(t => (
                <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabOn]} onPress={() => setTab(t.key)}>
                  <Text style={[s.tabText, tab === t.key && s.tabTextOn]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!links ? (
              <Text style={s.sub}>Preparing the stream…</Text>
            ) : tab === 'camera' ? (
              <View style={s.center}>
                <QRCode value={links.broadcastUrl} size={220} />
                <Text style={s.step}>1. On the camera phone, open the normal <Text style={s.bold}>Camera</Text> app and scan this QR.</Text>
                <Text style={s.step}>2. Open the link, allow camera & mic, turn the phone sideways and tap <Text style={s.bold}>GO LIVE</Text>.</Text>
                <Text style={s.warn}>Keep this QR private: anyone who scans it can broadcast for this match.</Text>
                <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => Linking.openURL(links.broadcastUrl).catch(() => {})}>
                  <Text style={s.btnGhostText}>Open camera page on this phone</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.center}>
                <QRCode value={links.watchUrl} size={180} />
                <Text style={s.link} selectable>{links.watchUrl}</Text>
                <Text style={s.step}>Anyone can open this link to watch live with the scoreboard (up to {links.maxViewers} viewers at once).</Text>
                <TouchableOpacity style={[s.btn, s.btnRed]} onPress={shareWatch}>
                  <Text style={s.btnText}>Share Watch Link</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={s.ytLink} onPress={onYoutube}>
              <Text style={s.ytLinkText}>▶ Stream to YouTube instead (more viewers)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.close} onPress={onClose}>
              <Text style={s.closeText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0F172A99', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, maxHeight: '92%' },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: C.cardBorder, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 19, fontWeight: '900', color: C.text },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.divider, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  pillLive: { backgroundColor: C.primary },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.white },
  pillText: { fontSize: 10, fontWeight: '900', color: C.textSub, letterSpacing: 0.5 },
  sub: { fontSize: 12, color: C.textSub, marginTop: 4, marginBottom: 12 },
  tabs: { flexDirection: 'row', backgroundColor: C.divider, borderRadius: 12, padding: 4, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  tabOn: { backgroundColor: C.white },
  tabText: { fontSize: 13, fontWeight: '700', color: C.textSub },
  tabTextOn: { color: C.text, fontWeight: '900' },
  center: { alignItems: 'center' },
  step: { fontSize: 13, color: C.textSub, lineHeight: 19, marginTop: 10, alignSelf: 'stretch' },
  bold: { fontWeight: '900', color: C.text },
  warn: { fontSize: 11, color: '#9A3412', backgroundColor: C.orangeLight, borderRadius: 8, padding: 8, marginTop: 10, alignSelf: 'stretch', overflow: 'hidden' },
  link: { fontSize: 13, fontWeight: '800', color: C.accent, marginTop: 10, textAlign: 'center' },
  btn: { alignSelf: 'stretch', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  btnRed: { backgroundColor: C.primary },
  btnText: { color: C.white, fontSize: 14, fontWeight: '800' },
  btnGhost: { backgroundColor: C.divider, borderWidth: 1, borderColor: C.cardBorder },
  btnGhostText: { color: C.text, fontSize: 13, fontWeight: '700' },
  ytLink: { alignItems: 'center', paddingTop: 16 },
  ytLinkText: { color: '#FF0000', fontSize: 13, fontWeight: '800' },
  close: { alignItems: 'center', paddingVertical: 14 },
  closeText: { color: C.textSub, fontSize: 15, fontWeight: '700' },
});
