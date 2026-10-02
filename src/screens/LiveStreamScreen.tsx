import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Share, Linking, BackHandler, Animated,
} from 'react-native';
import { getOverlaySummary, getOverlayLink, getCameraLinks, isLocalAddress, leaveSession, LiveSession } from '../services/live';
import { popup } from '../components/Popup';
import ReplayControls from '../components/ReplayControls';
import { C } from '../theme/colors';

const PRISM_ANDROID = 'com.prism.live';
const STEPS = [
  'Install Prism Live Studio (free) and sign in with your YouTube channel.',
  'In Prism tap Widgets → Web, paste the overlay link below, set size 1280 × 720.',
  'Point this phone\'s camera at the ground and tap Go Live (YouTube).',
  'The score on your stream updates by itself every time the scorer records a ball.',
];

const ballLabel = (b: any, local: boolean) => {
  if (b.wicket) return 'W';
  if (b.extra === 'db') return 'DB';
  if (b.extra === 'wd' || b.extra === 'nb') {
    const taken = local ? b.runs : b.runs - 1;
    return `${b.extra === 'wd' ? 'Wd' : 'Nb'}${taken > 0 ? '+' + taken : ''}`;
  }
  if (b.extra === 'lb') return `Lb${b.runs}`;
  if (b.extra === 'b') return `B${b.runs}`;
  return String(b.runs);
};

// The second device of a match: shows the live score in real time and connects the stream to YouTube.
// It can never score (the server blocks it).
export default function LiveStreamScreen({ navigation, route }: any) {
  const { code, token, name } = route.params as { code: string; token: string; name: string };
  const session: LiveSession = { code, token, role: 'scorer' };
  const [d, setD] = useState<any>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'lost' | 'ended'>('connecting');
  const [overlayUrl, setOverlayUrl] = useState('');
  const [camera, setCamera] = useState<{ studioUrl: string; watchUrl: string } | null>(null);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const lastDeliveries = useRef<number | null>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Real-time score: poll the same feed the YouTube overlay uses, every second
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const data = await getOverlaySummary(code);
        if (!alive) return;
        setD(data);
        setStatus('live');
        if (lastDeliveries.current !== null && data.deliveries > lastDeliveries.current && data.lastBall) {
          const b = data.lastBall;
          const kind = b.wicket ? 'WICKET!' : !b.extra && b.runs === 6 ? 'SIX!' : !b.extra && b.runs === 4 ? 'FOUR!' : null;
          if (kind) {
            setFlash(kind);
            flashAnim.setValue(0);
            Animated.sequence([
              Animated.spring(flashAnim, { toValue: 1, useNativeDriver: true, friction: 5 }),
              Animated.delay(2200),
              Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]).start(() => setFlash(null));
          }
        }
        lastDeliveries.current = data.deliveries ?? lastDeliveries.current;
      } catch (e: any) {
        if (alive) setStatus(e.status === 404 ? 'ended' : 'lost');
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => { alive = false; clearInterval(t); };
  }, [code]);

  useEffect(() => {
    getOverlayLink(session).then(setOverlayUrl).catch(() => {});
  }, [code]);

  const disconnect = () => {
    popup.show({
      type: 'warning', icon: '📺', title: 'Stop Live Stream Device?',
      message: 'This phone will disconnect from the match. The scorer can then connect another stream phone.',
      buttons: [
        { text: 'Stay', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => {
          leaveSession(code, token).catch(() => {});
          navigation.navigate('Home');
        }},
      ],
    });
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { disconnect(); return true; });
    return () => sub.remove();
  }, []);

  // Built-in streaming: this phone's browser films, adds the scoreboard, streams and records
  const loadCamera = async () => {
    setCameraBusy(true);
    setCameraError(null);
    try {
      const links = await getCameraLinks(session);
      setCamera(links);
      return links;
    } catch (e: any) {
      setCameraError(e.message);
      return null;
    } finally {
      setCameraBusy(false);
    }
  };

  const openCameraStudio = async () => {
    // Fetch a fresh link each time: it signs the browser in and expires after a day
    const links = await loadCamera();
    if (links) Linking.openURL(links.studioUrl).catch(() => setCameraError('Could not open the browser on this phone.'));
  };

  const openPrism = () => {
    Linking.openURL(`market://details?id=${PRISM_ANDROID}`)
      .catch(() => Linking.openURL(`https://play.google.com/store/apps/details?id=${PRISM_ANDROID}`))
      .catch(() => {});
  };

  const local = d?.matchType === 'local';
  const totalBalls = d ? d.over * 6 + d.ball : 0;
  const crr = totalBalls ? ((d.runs / totalBalls) * 6).toFixed(2) : '0.00';
  let statusLine = '';
  if (d?.phase === 'scoring') {
    if (d.target) {
      const need = Math.max(0, d.target - d.runs);
      const left = Math.max(0, d.overs * 6 - totalBalls);
      statusLine = need === 0 ? `${d.battingTeam} have reached the target!` : `Need ${need} run${need === 1 ? '' : 's'} in ${left} ball${left === 1 ? '' : 's'}`;
    } else {
      statusLine = `CRR ${crr}${totalBalls ? ` · Projected ${Math.round((d.runs / totalBalls) * d.overs * 6)}` : ''}`;
    }
  } else if (d?.phase === 'innings_end') {
    statusLine = d.result || `Innings break · ${d.bowlingTeam} need ${d.runs + 1} to win`;
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1730" />
      <View style={s.header}>
        <TouchableOpacity onPress={disconnect} style={s.headerBtn}><Text style={s.headerBtnText}>✕</Text></TouchableOpacity>
        <View style={s.headerMid}>
          <Text style={s.headerTitle}>📺 Live Stream Device</Text>
          <Text style={s.headerSub}>Match {code} · {name}</Text>
        </View>
        <View style={[s.livePill, status !== 'live' && s.livePillOff]}>
          <View style={[s.liveDot, status !== 'live' && s.liveDotOff]} />
          <Text style={s.livePillText}>{status === 'live' ? 'LIVE' : status === 'ended' ? 'ENDED' : '…'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Real-time score */}
        <View style={s.scoreCard}>
          {status === 'ended' ? (
            <Text style={s.waiting}>This match has ended or the code expired.</Text>
          ) : !d || d.phase === 'waiting' ? (
            <Text style={s.waiting}>{status === 'lost' ? '📡 Reconnecting…' : 'Waiting for the scorer to start…'}</Text>
          ) : (
            <>
              <Text style={s.teamLine}>{d.battingTeam} <Text style={s.vs}>v {d.bowlingTeam}</Text></Text>
              <View style={s.scoreRow}>
                <Text style={s.score}>{d.runs}<Text style={s.wkts}>/{d.wickets}</Text></Text>
                <Text style={s.overs}>{d.over}.{d.ball}<Text style={s.oversOf}> / {d.overs} ov</Text></Text>
              </View>
              {!!statusLine && <Text style={s.statusLine}>{statusLine}</Text>}
              {d.phase === 'scoring' && (
                <>
                  {[d.striker, d.nonStriker].filter(Boolean).map((b: any, i: number) => (
                    <View key={b.name} style={s.playerRow}>
                      <Text style={[s.playerName, i === 0 && s.onStrike]} numberOfLines={1}>{b.name}{i === 0 ? ' *' : ''}</Text>
                      <Text style={s.playerRuns}>{b.runs} <Text style={s.playerBalls}>({b.balls})</Text></Text>
                    </View>
                  ))}
                  {d.bowler && (
                    <View style={[s.playerRow, s.bowlerRow]}>
                      <Text style={s.playerName} numberOfLines={1}>🎳 {d.bowler.name}</Text>
                      <Text style={s.playerRuns}>{d.bowler.wickets}-{d.bowler.runs} <Text style={s.playerBalls}>({d.bowler.overs}.{d.bowler.balls})</Text></Text>
                    </View>
                  )}
                  <View style={s.overRow}>
                    {(d.thisOver || []).map((b: any, i: number) => (
                      <View key={i} style={[s.chip, b.wicket && s.chipW, !b.extra && b.runs === 4 && s.chip4, !b.extra && b.runs === 6 && s.chip6]}>
                        <Text style={s.chipText}>{ballLabel(b, local)}</Text>
                      </View>
                    ))}
                  </View>
                  {!!d.lastCommentary && <Text style={s.commentary}>🎙️ {d.lastCommentary}</Text>}
                </>
              )}
            </>
          )}
          {flash && (
            <Animated.View style={[s.flash, { opacity: flashAnim, transform: [{ scale: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
              <Text style={s.flashText}>{flash}</Text>
            </Animated.View>
          )}
        </View>

        {/* Replays on the camera stream, right under the live score */}
        {status !== 'ended' && <ReplayControls session={session} />}

        {/* Built-in camera stream */}
        <View style={s.card}>
          <View style={s.ytHead}>
            <View style={[s.ytLogo, s.camLogo]}><Text style={s.ytLogoText}>●</Text></View>
            <Text style={s.cardTitle}>Stream from this phone's camera</Text>
          </View>
          <Text style={s.stepText}>
            No extra app needed. Opens the camera studio in your browser with the live scoreboard on the video.
            Viewers watch with a link, and when you end the stream you can upload the recording to YouTube.
          </Text>
          {cameraError && <Text style={s.camError}>⛔ {cameraError}</Text>}
          {!!camera && isLocalAddress(camera.studioUrl) && (
            <Text style={s.camWarn}>
              ⚠️ The server address is not https, so the browser will block the camera. Run server/scripts/go-live.sh on
              the computer and use the https address it prints (⚙️ on the Home screen).
            </Text>
          )}
          <TouchableOpacity style={[s.btn, s.btnRed, cameraBusy && s.btnBusy]} disabled={cameraBusy} onPress={openCameraStudio}>
            <Text style={s.btnText}>{cameraBusy ? 'Opening…' : '🎥 Open Camera Studio'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.btnBlue, cameraBusy && s.btnBusy]}
            disabled={cameraBusy}
            onPress={async () => {
              const links = camera ?? (await loadCamera());
              if (links) Share.share({ message: `Watch the match live: ${links.watchUrl}` }).catch(() => {});
            }}
          >
            <Text style={s.btnText}>Share Watch Link</Text>
          </TouchableOpacity>
        </View>

        {/* YouTube */}
        <View style={s.card}>
          <View style={s.ytHead}>
            <View style={s.ytLogo}><Text style={s.ytLogoText}>▶</Text></View>
            <Text style={s.cardTitle}>Go live on YouTube</Text>
          </View>
          {STEPS.map((step, i) => (
            <View key={i} style={s.step}>
              <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
              <Text style={s.stepText}>{step}</Text>
            </View>
          ))}
          <View style={s.linkBox}>
            <Text style={s.linkLabel}>OVERLAY LINK</Text>
            <Text style={s.link} selectable>{overlayUrl || 'Loading…'}</Text>
          </View>
          <View style={s.btnRow}>
            <TouchableOpacity style={[s.btn, s.btnBlue]} disabled={!overlayUrl} onPress={() => Share.share({ message: overlayUrl }).catch(() => {})}>
              <Text style={s.btnText}>Copy / Share Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnDark]} onPress={openPrism}>
              <Text style={s.btnText}>Get Prism</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[s.btn, s.btnRed]} onPress={() => Linking.openURL('https://studio.youtube.com').catch(() => {})}>
            <Text style={s.btnText}>Open YouTube Studio</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.footnote}>
          Only 2 phones can be connected to a match: the scorer and this live-stream phone. This phone can't change the score.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF2F7' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0B1730', paddingTop: 44, paddingBottom: 12, paddingHorizontal: 12 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF1A', justifyContent: 'center', alignItems: 'center' },
  headerBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
  headerMid: { flex: 1, marginLeft: 12 },
  headerTitle: { color: C.white, fontSize: 16, fontWeight: '900' },
  headerSub: { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginTop: 1 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  livePillOff: { backgroundColor: '#475569' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.white },
  liveDotOff: { backgroundColor: '#CBD5E1' },
  livePillText: { color: C.white, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  scroll: { padding: 14, paddingBottom: 40 },
  scoreCard: { backgroundColor: '#0B1730', borderRadius: 18, padding: 16, marginBottom: 12, overflow: 'hidden' },
  waiting: { color: '#CBD5E1', fontSize: 14, fontWeight: '700', textAlign: 'center', paddingVertical: 30 },
  teamLine: { color: C.white, fontSize: 14, fontWeight: '800' },
  vs: { color: '#94A3B8', fontWeight: '600' },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  score: { color: C.white, fontSize: 48, fontWeight: '900', lineHeight: 54 },
  wkts: { color: '#CBD5E1', fontSize: 30 },
  overs: { color: C.white, fontSize: 22, fontWeight: '900', marginBottom: 6 },
  oversOf: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  statusLine: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#FACC15', color: '#1E1B04', fontSize: 13, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, overflow: 'hidden' },
  playerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  bowlerRow: { borderTopWidth: 1, borderTopColor: '#FFFFFF1A', paddingTop: 10 },
  playerName: { flex: 1, color: '#CBD5E1', fontSize: 14, fontWeight: '700' },
  onStrike: { color: C.white, fontWeight: '900' },
  playerRuns: { color: C.white, fontSize: 15, fontWeight: '900' },
  playerBalls: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  overRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 4, backgroundColor: '#FFFFFF1F', justifyContent: 'center', alignItems: 'center' },
  chip4: { backgroundColor: C.accent },
  chip6: { backgroundColor: '#7C3AED' },
  chipW: { backgroundColor: C.primary },
  chipText: { color: C.white, fontSize: 11, fontWeight: '900' },
  commentary: { color: '#E2E8F0', fontSize: 12, marginTop: 12, lineHeight: 18 },
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0B1730E6', justifyContent: 'center', alignItems: 'center' },
  flashText: { color: '#FACC15', fontSize: 52, fontWeight: '900', letterSpacing: 3 },
  card: { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12 },
  ytHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  ytLogo: { width: 40, height: 28, borderRadius: 8, backgroundColor: '#FF0000', justifyContent: 'center', alignItems: 'center' },
  ytLogoText: { color: C.white, fontSize: 13, fontWeight: '900', marginLeft: 2 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: C.text },
  step: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.text, justifyContent: 'center', alignItems: 'center' },
  stepNumText: { color: C.white, fontSize: 11, fontWeight: '900' },
  stepText: { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 19 },
  linkBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.cardBorder, marginVertical: 6 },
  linkLabel: { fontSize: 10, fontWeight: '900', color: C.textMuted, letterSpacing: 1, marginBottom: 4 },
  link: { fontSize: 13, fontWeight: '700', color: C.accent },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  btnBlue: { backgroundColor: C.accent },
  btnDark: { backgroundColor: C.text },
  btnRed: { backgroundColor: '#FF0000', flex: 0 },
  btnText: { color: C.white, fontSize: 14, fontWeight: '800' },
  btnBusy: { opacity: 0.6 },
  camLogo: { backgroundColor: C.primary },
  camError: { fontSize: 13, color: C.primary, fontWeight: '700', marginTop: 8 },
  camWarn: { fontSize: 12, color: '#9A3412', backgroundColor: C.orangeLight, borderRadius: 10, padding: 10, marginTop: 8, lineHeight: 18, overflow: 'hidden' },
  footnote: { fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 16, paddingHorizontal: 12 },
});
