import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share } from 'react-native';
import { WebView } from 'react-native-webview';
import { getApiUrl } from '../services/server';
import { C } from '../theme/colors';

// react-native-webview's prop types resolve to `never` against this React Native version's types
const Web = WebView as unknown as React.ComponentType<any>;

// Plays the match inside the app: the live camera stream while it's on, then the innings videos,
// ball-by-ball replays and the full match video (the same page viewers get from the watch link).
export default function MatchVideoScreen({ navigation, route }: any) {
  const { code, title } = route.params as { code: string; title?: string };
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    getApiUrl()
      .then(base => setUrl(`${base.replace(/\/api\/?$/, '')}/stream/match/${code}`))
      .catch(() => setFailed(true));
  }, [code]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <View style={s.headerMid}>
          <Text style={s.title} numberOfLines={1}>{title || 'Match videos'}</Text>
          <Text style={s.sub}>Live · replays · innings videos</Text>
        </View>
        <TouchableOpacity style={s.headerBtn} disabled={!url} onPress={() => url && Share.share({ message: `Watch the match: ${url}`, url }).catch(() => {})}>
          <Text style={s.action}>Share</Text>
        </TouchableOpacity>
      </View>

      {failed ? (
        <View style={s.center}>
          <Text style={s.errTitle}>Could not open the match videos</Text>
          <Text style={s.errBody}>Check the server address (⚙️ on Home) and your internet connection.</Text>
          <TouchableOpacity style={s.retry} onPress={() => { setFailed(false); setLoading(true); setAttempt(a => a + 1); }}>
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : url ? (
        <Web
          key={attempt}
          source={{ uri: url }}
          style={s.web}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          onLoadEnd={() => setLoading(false)}
          onError={() => setFailed(true)}
          onHttpError={(e: any) => e.nativeEvent.statusCode >= 500 && setFailed(true)}
        />
      ) : null}
      {loading && !failed && (
        <View style={s.loader} pointerEvents="none">
          <ActivityIndicator color={C.white} size="large" />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 44, paddingBottom: 10,
    backgroundColor: '#0B1730',
  },
  headerBtn: { minWidth: 56, height: 36, justifyContent: 'center', paddingHorizontal: 8 },
  back: { color: C.white, fontSize: 28, fontWeight: '600' },
  action: { color: '#FACC15', fontSize: 14, fontWeight: '800', textAlign: 'right' },
  headerMid: { flex: 1, alignItems: 'center' },
  title: { color: C.white, fontSize: 15, fontWeight: '800' },
  sub: { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginTop: 1 },
  web: { flex: 1, backgroundColor: '#09090B' },
  loader: { position: 'absolute', left: 0, right: 0, top: 120, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errTitle: { color: C.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  errBody: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  retry: { marginTop: 16, backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11 },
  retryText: { color: C.white, fontWeight: '800', fontSize: 14 },
});
