import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, StatusBar, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import {
  listTeams, createTeam, updateTeam, deleteTeam, syncPendingTeams, pendingTeamCount, isServerReachable,
  SharedTeam, SharedPlayer, PlayerRole,
} from '../services/teams';
import { popup } from '../components/Popup';
import { C } from '../theme/colors';

const ROLES: { key: PlayerRole; icon: string }[] = [
  { key: 'Batter', icon: '🏏' },
  { key: 'Bowler', icon: '🎳' },
  { key: 'All-Rounder', icon: '⭐' },
  { key: 'Keeper', icon: '🧤' },
  { key: 'Captain', icon: '©' },
];
const NAME_KEY = 'cricscore_scorer_name';

// Create and browse teams shared with every app user
export default function TeamsScreen({ navigation }: any) {
  const [teams, setTeams] = useState<SharedTeam[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Offline / sync state
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Editor
  const [editor, setEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [creator, setCreator] = useState('');
  const [players, setPlayers] = useState<SharedPlayer[]>([]);
  const [pName, setPName] = useState('');
  const [pMobile, setPMobile] = useState('');
  const [pRoles, setPRoles] = useState<PlayerRole[]>(['Batter']);
  const [saving, setSaving] = useState(false);

  const reqId = React.useRef(0);
  const load = (q = search) => {
    const id = ++reqId.current; // ignore out-of-order responses while typing
    setLoading(true);
    setError(null);
    pendingTeamCount().then(setPending);
    listTeams(q)
      .then(r => {
        if (id !== reqId.current) return;
        setTeams(r.teams);
        setOffline(r.offline);
        setOnline(!r.offline);
      })
      .catch(e => { if (id === reqId.current) setError(e.message); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  // While changes are waiting, keep checking whether the server is reachable to offer Sync
  useFocusEffect(useCallback(() => {
    if (!pending) return;
    let alive = true;
    const check = () => isServerReachable().then(ok => { if (alive) setOnline(ok); });
    check();
    const t = setInterval(check, 10000);
    return () => { alive = false; clearInterval(t); };
  }, [pending]));

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await syncPendingTeams();
      const failedText = r.failed.map(f => `• ${f.name}: ${f.error}`).join('\n');
      if (r.offline) {
        popup.alert('Sync Paused', `Synced ${r.synced}. Connection dropped; the rest will sync later.${failedText ? `\n\n${failedText}` : ''}`, undefined, 'warning');
      } else if (r.failed.length) {
        popup.alert('Synced With Problems', `Synced ${r.synced}. These were not accepted by the server:\n\n${failedText}`, undefined, 'warning');
      } else {
        popup.alert('All Synced', `${r.synced} team change${r.synced === 1 ? '' : 's'} uploaded. Everyone can see them now.`, undefined, 'success');
      }
    } finally {
      setSyncing(false);
      load();
    }
  };

  const openEditor = async (team?: SharedTeam) => {
    setEditingId(team?.id ?? null);
    setTeamName(team?.name ?? '');
    setPlayers(team ? team.players.map(p => ({ ...p, roles: [...p.roles] })) : []);
    setCreator((await AsyncStorage.getItem(NAME_KEY).catch(() => null)) || '');
    setPName('');
    setPMobile('');
    setPRoles(['Batter']);
    setEditor(true);
  };

  const toggleRole = (r: PlayerRole) =>
    setPRoles(prev => (prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]));

  const addPlayer = () => {
    const name = pName.trim();
    const mobile = pMobile.replace(/[\s-]/g, '');
    if (!name) { popup.alert('Name Required', 'Enter the player name.', undefined, 'warning'); return; }
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      popup.alert('Duplicate Player', `${name} is already in this team.`, undefined, 'warning'); return;
    }
    if (players.length >= 11) { popup.alert('Team Full', 'A team can have at most 11 players.', undefined, 'warning'); return; }
    if (mobile && !/^\+?\d{10,13}$/.test(mobile)) {
      popup.alert('Invalid Mobile No.', 'Enter a valid 10-digit mobile number.', undefined, 'warning'); return;
    }
    let list = players;
    // Only one captain per team
    if (pRoles.includes('Captain')) list = list.map(p => ({ ...p, roles: p.roles.filter(r => r !== 'Captain') }));
    setPlayers([...list, { name, mobile: mobile || undefined, roles: pRoles.length ? pRoles : ['Batter'] }]);
    setPName('');
    setPMobile('');
    setPRoles(['Batter']);
  };

  const makeCaptain = (name: string) =>
    setPlayers(list => list.map(p => ({
      ...p,
      roles: p.name === name
        ? (p.roles.includes('Captain') ? p.roles : [...p.roles, 'Captain'])
        : p.roles.filter(r => r !== 'Captain'),
    })));

  const save = async () => {
    const name = teamName.trim();
    if (!name) { popup.alert('Team Name Required', 'Enter a team name.', undefined, 'warning'); return; }
    if (players.length < 2) { popup.alert('More Players Needed', 'Add at least 2 players.', undefined, 'warning'); return; }
    setSaving(true);
    try {
      if (creator.trim()) AsyncStorage.setItem(NAME_KEY, creator.trim()).catch(() => {});
      const result = editingId
        ? await updateTeam(editingId, name, players)
        : await createTeam(name, players, creator.trim() || 'Unknown');
      const savedLocally = !result || result.pending;
      setEditor(false);
      if (savedLocally) {
        popup.alert('Saved on This Phone', `No internet right now. ${name} is saved here and will be visible to everyone after you sync.`, undefined, 'warning');
      } else {
        popup.alert(editingId ? 'Team Updated' : 'Team Created', `${name} is now available to everyone using CricScore.`, undefined, 'success');
      }
      load();
    } catch (e: any) {
      popup.alert('Could Not Save Team', e.message, undefined, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = (team: SharedTeam) => {
    popup.alert('Delete Team?', `${team.name} will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        deleteTeam(team.id, team.name).then(() => load()).catch(e => popup.alert('Could Not Delete', e.message, undefined, 'error'));
      }},
    ]);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Teams</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => openEditor()}>
          <Text style={s.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          placeholder="🔍  Search team or player"
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={v => { setSearch(v); load(v); }}
          autoCorrect={false}
        />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {pending > 0 && (
          <View style={[s.syncBar, online ? s.syncBarOnline : s.syncBarOffline]}>
            <Text style={s.syncIcon}>{online ? '☁️' : '📴'}</Text>
            <Text style={[s.syncText, online ? s.syncTextOnline : s.syncTextOffline]}>
              {online
                ? `${pending} change${pending === 1 ? '' : 's'} ready to sync`
                : `Offline · ${pending} change${pending === 1 ? '' : 's'} saved on this phone`}
            </Text>
            {online && (
              <TouchableOpacity style={s.syncBtn} onPress={sync} disabled={syncing}>
                {syncing ? <ActivityIndicator color={C.white} size="small" /> : <Text style={s.syncBtnText}>Sync now</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}
        {offline && !pending && <Text style={s.offlineNote}>📴 Offline · showing teams saved on this phone</Text>}
        {error ? (
          <View style={s.center}>
            <Text style={s.error}>⛔ {error}</Text>
            <TouchableOpacity style={s.retry} onPress={() => load()}><Text style={s.retryText}>Retry</Text></TouchableOpacity>
          </View>
        ) : loading && !teams.length ? (
          <ActivityIndicator color={C.primary} style={s.center} />
        ) : teams.length === 0 ? (
          <View style={s.center}>
            <Text style={s.emptyIcon}>👥</Text>
            <Text style={s.emptyTitle}>{search ? 'No teams found' : 'No teams yet'}</Text>
            <Text style={s.emptySub}>Create a team once and everyone can pick it when starting a match.</Text>
          </View>
        ) : teams.map(team => {
          const open = openId === team.id;
          return (
            <View key={team.id} style={s.card}>
              <TouchableOpacity style={s.cardHead} onPress={() => setOpenId(open ? null : team.id)}>
                <View style={s.badge}><Text style={s.badgeText}>{team.name.slice(0, 2).toUpperCase()}</Text></View>
                <View style={s.info}>
                  <Text style={s.teamName} numberOfLines={1}>{team.name}</Text>
                  <Text style={s.meta}>{team.players.length} players · by {team.createdBy}</Text>
                </View>
                {team.pending ? <Text style={s.notSynced}>NOT SYNCED</Text> : team.mine && <Text style={s.mine}>YOURS</Text>}
                <Text style={s.chev}>{open ? '▴' : '▾'}</Text>
              </TouchableOpacity>
              {open && (
                <>
                  {team.players.map((p, i) => (
                    <View key={p.name} style={s.playerRow}>
                      <Text style={s.playerNum}>{i + 1}</Text>
                      <Text style={s.playerName} numberOfLines={1}>
                        {p.name}{p.roles.includes('Captain') ? ' (c)' : ''}{p.roles.includes('Keeper') ? ' (wk)' : ''}
                      </Text>
                      <Text style={s.playerRoles} numberOfLines={1}>
                        {p.roles.filter(r => r !== 'Captain').map(r => ROLES.find(x => x.key === r)?.icon).join(' ')}
                      </Text>
                    </View>
                  ))}
                  <View style={s.actions}>
                    <TouchableOpacity style={[s.actionBtn, s.actionPrimary]} onPress={() => navigation.navigate('SetupTeam', { presetTeam: team })}>
                      <Text style={s.actionPrimaryText}>🏏 Start Match</Text>
                    </TouchableOpacity>
                    {(team.mine || team.pending) && (
                      <>
                        <TouchableOpacity style={s.actionBtn} onPress={() => openEditor(team)}>
                          <Text style={s.actionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.actionBtn} onPress={() => remove(team)}>
                          <Text style={[s.actionText, { color: C.primary }]}>Delete</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Create / edit team */}
      <Modal visible={editor} animationType="slide" onRequestClose={() => setEditor(false)}>
        <View style={s.container}>
          <View style={s.header}>
            <TouchableOpacity style={s.headerBtn} onPress={() => setEditor(false)}>
              <Text style={s.back}>✕</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>{editingId ? 'Edit Team' : 'Create Team'}</Text>
            <TouchableOpacity style={s.newBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={C.white} /> : <Text style={s.newBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>TEAM NAME</Text>
            <TextInput style={s.input} value={teamName} onChangeText={setTeamName} placeholder="e.g. Mumbai Warriors" placeholderTextColor={C.textMuted} />
            {!editingId && (
              <>
                <Text style={s.label}>YOUR NAME</Text>
                <TextInput style={s.input} value={creator} onChangeText={setCreator} placeholder="Shown as 'created by'" placeholderTextColor={C.textMuted} />
              </>
            )}

            <Text style={s.label}>ADD PLAYER ({players.length}/11)</Text>
            <View style={s.card}>
              <TextInput style={s.input} value={pName} onChangeText={setPName} placeholder="Player name" placeholderTextColor={C.textMuted} />
              <TextInput style={s.input} value={pMobile} onChangeText={setPMobile} placeholder="📱 Mobile (optional)" placeholderTextColor={C.textMuted} keyboardType="phone-pad" maxLength={14} />
              <View style={s.roles}>
                {ROLES.map(r => (
                  <TouchableOpacity key={r.key} style={[s.role, pRoles.includes(r.key) && s.roleOn]} onPress={() => toggleRole(r.key)}>
                    <Text style={[s.roleText, pRoles.includes(r.key) && s.roleTextOn]}>{r.icon} {r.key}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={s.addBtn} onPress={addPlayer}>
                <Text style={s.addBtnText}>+ Add Player</Text>
              </TouchableOpacity>
            </View>

            {players.length > 0 && (
              <View style={s.card}>
                {players.map((p, i) => (
                  <View key={p.name} style={s.playerRow}>
                    <Text style={s.playerNum}>{i + 1}</Text>
                    <View style={s.info}>
                      <Text style={s.playerName} numberOfLines={1}>{p.name}</Text>
                      <Text style={s.meta} numberOfLines={1}>
                        {p.roles.filter(r => r !== 'Captain').join(', ') || 'Player'}{p.mobile ? ` · ${p.mobile}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[s.capBtn, p.roles.includes('Captain') && s.capBtnOn]}
                      onPress={() => makeCaptain(p.name)}>
                      <Text style={[s.capText, p.roles.includes('Captain') && s.capTextOn]}>C</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.removeBtn} onPress={() => setPlayers(players.filter(x => x.name !== p.name))}>
                      <Text style={s.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <Text style={s.hint}>Tap C to make a player captain</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 44, paddingBottom: 10, backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  headerBtn: { width: 64, height: 36, justifyContent: 'center' },
  back: { fontSize: 22, color: C.text, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: C.text },
  newBtn: { width: 64, height: 34, borderRadius: 17, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  newBtnText: { color: C.white, fontSize: 13, fontWeight: '800' },
  searchWrap: { padding: 12, paddingBottom: 0 },
  search: {
    backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.cardBorder,
  },
  scroll: { padding: 12, paddingBottom: 40 },
  center: { alignItems: 'center', marginTop: 50, paddingHorizontal: 24 },
  error: { color: C.primary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  retry: { marginTop: 10, backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  retryText: { color: C.white, fontWeight: '800' },
  emptyIcon: { fontSize: 44, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  emptySub: { fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 4 },
  card: {
    backgroundColor: C.white, borderRadius: 16, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: C.cardBorder,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  badge: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  badgeText: { color: C.primary, fontWeight: '900', fontSize: 13 },
  info: { flex: 1 },
  teamName: { fontSize: 15, fontWeight: '900', color: C.text },
  meta: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  mine: { fontSize: 9, fontWeight: '900', color: C.green, backgroundColor: C.greenLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', marginRight: 6 },
  notSynced: { fontSize: 9, fontWeight: '900', color: C.orange, backgroundColor: C.orangeLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', marginRight: 6 },
  syncBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1 },
  syncBarOnline: { backgroundColor: C.accentLight, borderColor: C.accent + '40' },
  syncBarOffline: { backgroundColor: C.orangeLight, borderColor: C.orange + '40' },
  syncIcon: { fontSize: 16 },
  syncText: { flex: 1, fontSize: 13, fontWeight: '800' },
  syncTextOnline: { color: C.accent },
  syncTextOffline: { color: '#9A3412' },
  syncBtn: { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, minWidth: 82, alignItems: 'center' },
  syncBtnText: { color: C.white, fontSize: 12, fontWeight: '900' },
  offlineNote: { fontSize: 12, fontWeight: '700', color: C.orange, textAlign: 'center', marginBottom: 10 },
  chev: { fontSize: 14, color: C.textMuted, width: 18, textAlign: 'center' },
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.divider },
  playerNum: { width: 24, fontSize: 12, fontWeight: '800', color: C.textMuted },
  playerName: { flex: 1, fontSize: 14, fontWeight: '700', color: C.text },
  playerRoles: { fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: C.divider },
  actionPrimary: { flex: 1, alignItems: 'center', backgroundColor: C.primary },
  actionText: { fontSize: 13, fontWeight: '800', color: C.text },
  actionPrimaryText: { fontSize: 13, fontWeight: '900', color: C.white },
  label: { fontSize: 11, fontWeight: '900', color: C.textMuted, letterSpacing: 1, marginBottom: 6, marginTop: 6 },
  input: {
    backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 10,
  },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  role: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, backgroundColor: C.divider, borderWidth: 1, borderColor: C.cardBorder },
  roleOn: { backgroundColor: C.primary, borderColor: C.primary },
  roleText: { fontSize: 12, fontWeight: '700', color: C.textSub },
  roleTextOn: { color: C.white },
  addBtn: { backgroundColor: C.accentLight, borderRadius: 12, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: C.accent + '40' },
  addBtnText: { color: C.accent, fontSize: 14, fontWeight: '800' },
  capBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: C.cardBorder, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  capBtnOn: { backgroundColor: C.orange, borderColor: C.orange },
  capText: { fontSize: 12, fontWeight: '900', color: C.textMuted },
  capTextOn: { color: C.white },
  removeBtn: { padding: 6 },
  removeText: { color: C.textMuted, fontSize: 14 },
  hint: { fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 8 },
});
