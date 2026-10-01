import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { PopupCard, PopupIcon } from './Popup';
import { getApiUrl, setApiUrl, normalizeApiUrl, testServer } from '../services/server';
import { C } from '../theme/colors';

type Status = 'idle' | 'testing' | 'ok' | 'fail';

// Lets the user point the app at the CricScore server (laptop Wi-Fi IP or a hosted URL)
export default function ServerSettings({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (!visible) return;
    setStatus('idle');
    getApiUrl().then(u => setInput(u.replace(/\/api$/, '')));
  }, [visible]);

  const test = async () => {
    setStatus('testing');
    setStatus((await testServer(normalizeApiUrl(input))) ? 'ok' : 'fail');
  };

  const save = async () => {
    setStatus('testing');
    const ok = await testServer(normalizeApiUrl(input));
    if (!ok) { setStatus('fail'); return; }
    await setApiUrl(input);
    onClose();
  };

  return (
    <PopupCard visible={visible} onRequestClose={onClose}>
      <PopupIcon type="info" icon="🖥️" />
      <Text style={s.title}>Server Address</Text>
      <Text style={s.sub}>
        The computer running the CricScore server. On Wi-Fi, use its IP address (e.g. 192.168.1.49:3000) — both must be on the same network.
      </Text>
      <TextInput
        style={s.input}
        value={input}
        onChangeText={v => { setInput(v); setStatus('idle'); }}
        placeholder="192.168.1.49:3000"
        placeholderTextColor={C.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <View style={s.statusRow}>
        {status === 'testing' && <ActivityIndicator color={C.accent} />}
        {status === 'testing' && <Text style={s.hint}>Connecting… a sleeping free server can take up to a minute</Text>}
        {status === 'ok' && <Text style={[s.statusText, { color: C.green }]}>✅ Connected</Text>}
        {status === 'fail' && <Text style={[s.statusText, { color: C.primary }]}>⛔ Can't reach the server. Check the address and that the server is running.</Text>}
      </View>
      <View style={s.btnRow}>
        <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={test}>
          <Text style={s.btnGhostText}>Test</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={save}>
          <Text style={s.btnPrimaryText}>Save</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={s.cancel} onPress={onClose}>
        <Text style={s.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </PopupCard>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '800', color: C.text, marginBottom: 6 },
  sub: { fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 19, marginBottom: 14 },
  input: {
    alignSelf: 'stretch', backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, fontWeight: '700', color: C.text, borderWidth: 1, borderColor: C.cardBorder,
  },
  statusRow: { minHeight: 34, justifyContent: 'center', alignSelf: 'stretch', alignItems: 'center', marginVertical: 6 },
  statusText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  hint: { fontSize: 11, color: C.textMuted, marginTop: 4, textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  btnGhost: { backgroundColor: C.divider, borderWidth: 1, borderColor: C.cardBorder },
  btnGhostText: { color: C.textSub, fontSize: 15, fontWeight: '700' },
  btnPrimary: { backgroundColor: C.accent },
  btnPrimaryText: { color: C.white, fontSize: 15, fontWeight: '800' },
  cancel: { paddingTop: 12 },
  cancelText: { color: C.textSub, fontSize: 14, fontWeight: '600' },
});
