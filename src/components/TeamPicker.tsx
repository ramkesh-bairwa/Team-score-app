import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, FlatList, ActivityIndicator,
} from 'react-native';
import { listTeams, SharedTeam } from '../services/teams';
import { C } from '../theme/colors';

// Bottom sheet listing shared teams (searchable by team or player name)
export default function TeamPicker({ visible, title, excludeId, onPick, onClose }: {
  visible: boolean; title: string; excludeId?: string;
  onPick: (team: SharedTeam) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [teams, setTeams] = useState<SharedTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const reqId = useRef(0);

  const load = (q: string) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    listTeams(q)
      .then(r => { if (id === reqId.current) { setTeams(r.teams); setOffline(r.offline); } })
      .catch(e => { if (id === reqId.current) setError(e.message); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  };

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => load(search), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [visible, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{title}</Text>
          <TextInput
            style={s.search}
            placeholder="🔍  Search team or player"
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {offline && <Text style={s.offline}>📴 Offline · showing teams saved on this phone</Text>}
          {error ? (
            <View style={s.center}>
              <Text style={s.error}>⛔ {error}</Text>
              <TouchableOpacity style={s.retry} onPress={() => load(search)}><Text style={s.retryText}>Retry</Text></TouchableOpacity>
            </View>
          ) : loading && !teams.length ? (
            <ActivityIndicator color={C.primary} style={s.center} />
          ) : (
            <FlatList
              data={teams.filter(t => t.id !== excludeId)}
              keyExtractor={t => t.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={s.empty}>{search ? 'No teams match your search' : 'No teams created yet'}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.item} onPress={() => onPick(item)}>
                  <View style={s.badge}><Text style={s.badgeText}>{item.name.slice(0, 2).toUpperCase()}</Text></View>
                  <View style={s.info}>
                    <Text style={s.name} numberOfLines={1}>
                      {item.name}{item.pending ? '  ·  Not synced' : item.mine ? '  ·  Yours' : ''}
                    </Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {item.players.length} players · C: {item.captain} · by {item.createdBy}
                    </Text>
                  </View>
                  <Text style={s.chev}>›</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0F172A99', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28, height: '75%' },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: C.cardBorder, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '900', color: C.text, marginBottom: 12 },
  search: {
    backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 10,
  },
  center: { marginTop: 30, alignItems: 'center' },
  offline: { fontSize: 12, fontWeight: '700', color: C.orange, backgroundColor: C.orangeLight, borderRadius: 8, padding: 8, marginBottom: 8, overflow: 'hidden' },
  error: { color: C.primary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  retry: { marginTop: 10, backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  retryText: { color: C.white, fontWeight: '800' },
  empty: { textAlign: 'center', color: C.textMuted, marginTop: 30, fontSize: 13 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider },
  badge: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  badgeText: { color: C.primary, fontWeight: '900', fontSize: 13 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: C.text },
  meta: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  chev: { fontSize: 24, color: C.textMuted, marginLeft: 8 },
});
