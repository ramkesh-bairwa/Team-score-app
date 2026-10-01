import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Share, Linking, ActivityIndicator } from 'react-native';
import { LiveSession, LivePayload, getOverlayLink, isLocalAddress } from '../services/live';
import ServerSettings from './ServerSettings';
import { popup } from './Popup';
import { C } from '../theme/colors';

const STEPS = [
  { title: 'Open a streaming app', body: 'Install Prism Live Studio or Streamlabs on a phone (or OBS on a laptop) and sign in with your YouTube channel.' },
  { title: 'Add the score overlay', body: 'Add a "Web" / "Browser" widget (overlay) and paste the link below. Set size to 1280 × 720 and keep the background transparent.' },
  { title: 'Point the camera & go live', body: 'Frame the ground, start the stream to YouTube. The scoreboard updates on its own every time you score a ball here.' },
];

export default function YouTubeLiveSheet({ visible, session, getPayload, onClose }: {
  visible: boolean; session: LiveSession; getPayload: () => LivePayload; onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverModal, setServerModal] = useState(false);

  const loadLink = () => {
    setUrl(null);
    setError(null);
    getOverlayLink(session, getPayload()).then(setUrl).catch((e: any) => setError(e.message));
  };

  useEffect(() => {
    if (visible) loadLink();
  }, [visible, session.code]);

  const shareLink = () => {
    if (url) Share.share({ message: url, url }).catch(() => {});
  };

  const openStudio = () => {
    Linking.openURL('https://studio.youtube.com').catch(() =>
      popup.alert('Could Not Open YouTube', 'Open YouTube Studio manually to start your live stream.', undefined, 'error'));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.titleRow}>
              <View style={s.ytLogo}><Text style={s.ytLogoText}>▶</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>Stream on YouTube Live</Text>
                <Text style={s.sub}>Live scoreboard overlay for your stream</Text>
              </View>
            </View>

            <View style={s.linkBox}>
              <Text style={s.linkLabel}>OVERLAY LINK · MATCH {session.code}</Text>
              {url ? (
                <Text style={s.link} selectable>{url}</Text>
              ) : error ? (
                <Text style={s.errorText}>⛔ {error}</Text>
              ) : (
                <ActivityIndicator color={C.accent} style={s.loader} />
              )}
              <View style={s.linkBtns}>
                {error ? (
                  <View style={s.errBtns}>
                    <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => setServerModal(true)}>
                      <Text style={s.btnGhostText}>Server Address</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={loadLink}>
                      <Text style={s.btnPrimaryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={[s.btn, s.btnPrimary, !url && s.btnDisabled]} onPress={shareLink} disabled={!url}>
                    <Text style={s.btnPrimaryText}>Share / Copy Link</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {!!url && isLocalAddress(url) && (
              <View style={s.warn}>
                <Text style={s.warnText}>
                  ⚠️ The CricScore server is on your local network. The streaming app must be on the same Wi-Fi as the server computer. To stream from anywhere (e.g. mobile data at the ground), host the server online and enter its address under Server Address (⚙️ on the Home screen).
                </Text>
              </View>
            )}

            {STEPS.map((st, i) => (
              <View key={i} style={s.step}>
                <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>{st.title}</Text>
                  <Text style={s.stepBody}>{st.body}</Text>
                </View>
              </View>
            ))}

            <View style={s.preview}>
              <Text style={s.previewLabel}>The overlay shows</Text>
              <Text style={s.previewBody}>
                Score, overs, batters on strike, bowler figures, this over, run rate, "Need X runs in Y balls" in the chase, plus FOUR / SIX / WICKET animations.
              </Text>
            </View>

            <TouchableOpacity style={[s.btn, s.btnYt]} onPress={openStudio}>
              <Text style={s.btnPrimaryText}>Open YouTube Studio</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
      <ServerSettings visible={serverModal} onClose={() => { setServerModal(false); loadLink(); }} />
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0F172A99', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.white, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, maxHeight: '88%',
  },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: C.cardBorder, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  ytLogo: { width: 46, height: 34, borderRadius: 10, backgroundColor: '#FF0000', justifyContent: 'center', alignItems: 'center' },
  ytLogoText: { color: C.white, fontSize: 16, fontWeight: '900', marginLeft: 2 },
  title: { fontSize: 19, fontWeight: '900', color: C.text },
  sub: { fontSize: 13, color: C.textSub, marginTop: 2 },
  linkBox: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 12 },
  linkLabel: { fontSize: 10, fontWeight: '900', color: C.textMuted, letterSpacing: 1, marginBottom: 6 },
  link: { fontSize: 14, fontWeight: '700', color: C.accent },
  errorText: { fontSize: 13, fontWeight: '700', color: C.primary, lineHeight: 19 },
  loader: { alignSelf: 'flex-start', marginVertical: 2 },
  btnDisabled: { opacity: 0.5 },
  errBtns: { flex: 1, flexDirection: 'row', gap: 10 },
  btnGhost: { backgroundColor: C.divider, borderWidth: 1, borderColor: C.cardBorder },
  btnGhostText: { color: C.textSub, fontSize: 14, fontWeight: '700' },
  linkBtns: { flexDirection: 'row', marginTop: 12 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  btnPrimary: { backgroundColor: C.accent },
  btnYt: { backgroundColor: '#FF0000', flex: 0, marginTop: 6 },
  btnPrimaryText: { color: C.white, fontSize: 15, fontWeight: '800' },
  warn: { backgroundColor: C.orangeLight, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.orange + '40' },
  warnText: { fontSize: 12, color: '#9A3412', lineHeight: 18, fontWeight: '600' },
  step: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.text, justifyContent: 'center', alignItems: 'center' },
  stepNumText: { color: C.white, fontSize: 12, fontWeight: '900' },
  stepTitle: { fontSize: 14, fontWeight: '800', color: C.text },
  stepBody: { fontSize: 13, color: C.textSub, lineHeight: 19, marginTop: 2 },
  preview: { backgroundColor: C.accentLight, borderRadius: 12, padding: 12, marginBottom: 8 },
  previewLabel: { fontSize: 12, fontWeight: '800', color: C.accent, marginBottom: 2 },
  previewBody: { fontSize: 12, color: C.textSub, lineHeight: 18 },
  closeBtn: { alignItems: 'center', paddingVertical: 14 },
  closeText: { color: C.textSub, fontSize: 15, fontWeight: '700' },
});
