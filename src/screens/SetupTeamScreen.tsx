import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, Modal, Image,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { C } from '../theme/colors';
import { popup } from '../components/Popup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TeamPicker from '../components/TeamPicker';
import { SharedTeam, createTeam } from '../services/teams';

type PlayerRole = 'Batter' | 'Bowler' | 'All-Rounder' | 'Captain' | 'Keeper' | 'Impact Player';
type Player = { name: string; nickname: string; mobile?: string; photo?: string; roles: PlayerRole[] };

const ALL_ROLES: { key: PlayerRole; icon: string }[] = [
  { key: 'Batter', icon: '🏏' },
  { key: 'Bowler', icon: '🎳' },
  { key: 'All-Rounder', icon: '⭐' },
  { key: 'Captain', icon: '©' },
  { key: 'Keeper', icon: '🧤' },
  { key: 'Impact Player', icon: '⚡' },
];

const toPlayers = (team: SharedTeam): Player[] =>
  team.players.map(p => ({ name: p.name, nickname: p.nickname || '', mobile: p.mobile, roles: p.roles as PlayerRole[] }));

export default function SetupTeamScreen({ navigation, route }: any) {
  // Opened from the Teams screen with a saved team pre-selected as "Your Team"
  const preset: SharedTeam | undefined = route?.params?.presetTeam;
  const [step, setStep] = useState<'teams' | 'players' | 'settings'>('teams');
  const [team1Name, setTeam1Name] = useState(preset?.name ?? '');
  const [team2Name, setTeam2Name] = useState('');
  const [activeTeam, setActiveTeam] = useState<1 | 2>(1);
  const [team1Players, setTeam1Players] = useState<Player[]>(preset ? toPlayers(preset) : []);
  const [team2Players, setTeam2Players] = useState<Player[]>([]);
  const [playerInput, setPlayerInput] = useState('');
  const [team1Captain, setTeam1Captain] = useState(preset?.captain ?? '');
  const [team2Captain, setTeam2Captain] = useState('');
  const [savedId1, setSavedId1] = useState<string | undefined>(preset?.id);
  const [savedId2, setSavedId2] = useState<string | undefined>(undefined);
  const [pickerFor, setPickerFor] = useState<1 | 2 | null>(null);
  const [savingTeam, setSavingTeam] = useState(false);
  const [overs, setOvers] = useState('10');
  const [matchType, setMatchType] = useState<'local' | 'domestic'>('local');
  const [location, setLocation] = useState('');

  // Player modal state
  const [playerModal, setPlayerModal] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [pendingNickname, setPendingNickname] = useState('');
  const [pendingMobile, setPendingMobile] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | undefined>(undefined);
  const [selectedRoles, setSelectedRoles] = useState<PlayerRole[]>([]);

  const pickSaved = (n: 1 | 2, team: SharedTeam) => {
    const list = toPlayers(team);
    const captain = list.find(p => p.roles.includes('Captain'))?.name || team.captain;
    if (n === 1) { setTeam1Name(team.name); setTeam1Players(list); setTeam1Captain(captain); setSavedId1(team.id); }
    else { setTeam2Name(team.name); setTeam2Players(list); setTeam2Captain(captain); setSavedId2(team.id); }
    setPickerFor(null);
  };

  // Publish the team being built so other app users can pick it next time
  const saveForEveryone = async () => {
    const name = (activeTeam === 1 ? team1Name : team2Name).trim();
    const list = activeTeam === 1 ? team1Players : team2Players;
    if (list.length < 2) { popup.alert('More Players Needed', 'Add at least 2 players before saving the team.', undefined, 'warning'); return; }
    setSavingTeam(true);
    try {
      const by = (await AsyncStorage.getItem('cricscore_scorer_name').catch(() => null)) || 'Unknown';
      const saved = await createTeam(name, list.map(p => ({ name: p.name, nickname: p.nickname || undefined, mobile: p.mobile, roles: p.roles })), by);
      if (activeTeam === 1) setSavedId1(saved.id); else setSavedId2(saved.id);
      if (saved.pending) {
        popup.alert('Saved on This Phone', `No internet right now. ${name} will be shared with everyone when you sync from Teams.`, undefined, 'warning');
      } else {
        popup.alert('Team Saved', `${name} is now available to everyone in Teams.`, undefined, 'success');
      }
    } catch (e: any) {
      popup.alert('Could Not Save Team', e.message, undefined, 'error');
    } finally {
      setSavingTeam(false);
    }
  };

  const players = activeTeam === 1 ? team1Players : team2Players;
  const setPlayers = activeTeam === 1 ? setTeam1Players : setTeam2Players;

  const captain = activeTeam === 1 ? team1Captain : team2Captain;
  const setCaptain = activeTeam === 1 ? setTeam1Captain : setTeam2Captain;

  const addPlayer = () => {
    if (players.length >= 11) { popup.alert('Team Full', 'A team can have a maximum of 11 players.', undefined, 'warning'); return; }
    setEditingIdx(null);
    setPendingName(playerInput.trim());
    setPendingNickname('');
    setPendingMobile('');
    setPendingPhoto(undefined);
    setSelectedRoles([]);
    setPlayerInput('');
    setPlayerModal(true);
  };

  const editPlayer = (idx: number) => {
    const p = players[idx];
    setEditingIdx(idx);
    setPendingName(p.name);
    setPendingNickname(p.nickname);
    setPendingMobile(p.mobile || '');
    setPendingPhoto(p.photo);
    setSelectedRoles(p.roles);
    setPlayerModal(true);
  };

  const confirmPlayer = () => {
    const name = pendingName.trim();
    const mobile = pendingMobile.replace(/[\s-]/g, '');
    const others = players.filter((_, i) => i !== editingIdx);
    if (!name) { popup.alert('Name Required', 'Please enter the player name.', undefined, 'warning'); return; }
    if (others.some(p => p.name === name)) { popup.alert('Duplicate Player', `${name} is already in this team.`, undefined, 'warning'); return; }
    if (mobile && !/^\+?\d{10,13}$/.test(mobile)) {
      popup.alert('Invalid Mobile No.', 'Enter a valid 10-digit mobile number.', undefined, 'warning'); return;
    }
    if (selectedRoles.length === 0) { popup.alert('Role Required', 'Select at least one role for the player.', undefined, 'warning'); return; }
    if (selectedRoles.includes('Captain') && others.some(p => p.roles.includes('Captain'))) {
      popup.alert('Captain Exists', 'A captain is already assigned to this team.', undefined, 'warning'); return;
    }
    const player: Player = { name, nickname: pendingNickname.trim(), mobile: mobile || undefined, photo: pendingPhoto, roles: selectedRoles };
    if (editingIdx === null) {
      setPlayers([...players, player]);
    } else {
      setPlayers(players.map((p, i) => (i === editingIdx ? player : p)));
    }
    const oldName = editingIdx === null ? null : players[editingIdx].name;
    if (selectedRoles.includes('Captain')) setCaptain(name);
    else if (oldName && captain === oldName) setCaptain('');
    setPlayerModal(false);
  };

  const pickPhoto = () => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: '📷 Camera', onPress: () => launchCamera({ mediaType: 'photo', quality: 0.7 }, r => { if (r.assets?.[0]?.uri) setPendingPhoto(r.assets[0].uri); }) },
      { text: '🖼️ Gallery', onPress: () => launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, r => { if (r.assets?.[0]?.uri) setPendingPhoto(r.assets[0].uri); }) },
    ];
    if (pendingPhoto) buttons.push({ text: 'Remove Photo', style: 'destructive', onPress: () => setPendingPhoto(undefined) });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    popup.show({ type: 'info', icon: '📸', title: 'Player Photo', message: 'Take a new photo or choose one from your gallery.', buttons });
  };

  const toggleRole = (role: PlayerRole) => {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const removePlayer = (name: string) => {
    popup.alert('Remove Player?', `${name} will be removed from the team.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        setPlayers(players.filter(p => p.name !== name));
        if (captain === name) setCaptain('');
      }},
    ]);
  };

  const goToPlayers = () => {
    if (!team1Name.trim() || !team2Name.trim()) { popup.alert('Team Names Required', 'Enter names for both teams.', undefined, 'warning'); return; }
    if (team1Name.trim() === team2Name.trim()) { popup.alert('Same Team Names', 'Both teams must have different names.', undefined, 'warning'); return; }
    setStep('players');
  };

  const goToSettings = () => {
    if (team1Players.length < 2) { popup.alert('More Players Needed', `Add at least 2 players to ${team1Name}.`, undefined, 'warning'); setActiveTeam(1); return; }
    if (team2Players.length < 2) { popup.alert('More Players Needed', `Add at least 2 players to ${team2Name}.`, undefined, 'warning'); setActiveTeam(2); return; }
    if (!team1Players.some(p => p.roles.includes('Captain'))) {
      popup.alert('Captain Required', `${team1Name} mein ek Captain hona zaroori hai`, undefined, 'warning');
      setActiveTeam(1); return;
    }
    if (!team2Players.some(p => p.roles.includes('Captain'))) {
      popup.alert('Captain Required', `${team2Name} mein ek Captain hona zaroori hai`, undefined, 'warning');
      setActiveTeam(2); return;
    }
    setStep('settings');
  };

  const startMatch = () => {
    const o = parseInt(overs, 10);
    if (!o || o < 1 || o > 50) { popup.alert('Invalid Overs', 'Overs must be between 1 and 50.', undefined, 'warning'); return; }
    if (!team1Captain) { popup.alert('Captain Required', `Pick a captain for ${team1Name}.`, undefined, 'warning'); return; }
    if (!team2Captain) { popup.alert('Captain Required', `Pick a captain for ${team2Name}.`, undefined, 'warning'); return; }
    navigation.navigate('Bet', {
      team1: { name: team1Name.trim(), players: team1Players.map(p => p.name), playerDetails: team1Players, captain: team1Captain },
      team2: { name: team2Name.trim(), players: team2Players.map(p => p.name), playerDetails: team2Players, captain: team2Captain },
      overs: o, matchType, location: location.trim(),
    });
  };

  const roleColor = (role: PlayerRole) => {
    if (role === 'Captain') return { bg: C.orangeLight, text: C.orange };
    if (role === 'Keeper') return { bg: C.accentLight, text: C.accent };
    if (role === 'Impact Player') return { bg: '#EDE9FE', text: '#7C3AED' };
    if (role === 'All-Rounder') return { bg: C.greenLight, text: C.green };
    if (role === 'Bowler') return { bg: C.primaryLight, text: C.primary };
    return { bg: C.divider, text: C.textSub };
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => step === 'teams' ? navigation.goBack() : setStep(step === 'settings' ? 'players' : 'teams')}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {step === 'teams' ? 'Create Match' : step === 'players' ? 'Add Players' : 'Match Settings'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={s.stepRow}>
        {(['teams', 'players', 'settings'] as const).map((st, i) => (
          <View key={st} style={s.stepItem}>
            <View style={[s.stepCircle, step === st && s.stepCircleActive,
              (step === 'players' && i === 0) || (step === 'settings' && i < 2) ? s.stepCircleDone : null]}>
              <Text style={[s.stepNum,
                step === st ? s.stepNumActive :
                (step === 'players' && i === 0) || (step === 'settings' && i < 2) ? s.stepNumDone : null]}>
                {(step === 'players' && i === 0) || (step === 'settings' && i < 2) ? '✓' : i + 1}
              </Text>
            </View>
            <Text style={[s.stepLabel, step === st && s.stepLabelActive]}>
              {st === 'teams' ? 'Teams' : st === 'players' ? 'Players' : 'Settings'}
            </Text>
            {i < 2 && <View style={s.stepLine} />}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* STEP 1: Teams */}
        {step === 'teams' && (
          <View>
            <Text style={s.sectionTitle}>Match Type</Text>
            <View style={s.matchTypeRow}>
              <TouchableOpacity style={[s.matchTypeBtn, matchType === 'local' && s.matchTypeBtnActive]} onPress={() => setMatchType('local')}>
                <Text style={s.matchTypeIcon}>🏘️</Text>
                <Text style={[s.matchTypeTitle, matchType === 'local' && s.matchTypeTitleActive]}>Local Match</Text>
                <Text style={s.matchTypeDesc}>No extra runs on{`\n`}wide or no ball</Text>
                {matchType === 'local' && <View style={s.matchTypeCheck}><Text style={s.matchTypeCheckText}>✓</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.matchTypeBtn, matchType === 'domestic' && s.matchTypeBtnActive]} onPress={() => setMatchType('domestic')}>
                <Text style={s.matchTypeIcon}>🏟️</Text>
                <Text style={[s.matchTypeTitle, matchType === 'domestic' && s.matchTypeTitleActive]}>Domestic Match</Text>
                <Text style={s.matchTypeDesc}>Official rules,{`\n`}extras counted</Text>
                {matchType === 'domestic' && <View style={s.matchTypeCheck}><Text style={s.matchTypeCheckText}>✓</Text></View>}
              </TouchableOpacity>
            </View>
            <Text style={s.sectionTitle}>Team Names</Text>
            <View style={s.card}>
              {([1, 2] as const).map(n => {
                const name = n === 1 ? team1Name : team2Name;
                const count = (n === 1 ? team1Players : team2Players).length;
                const savedId = n === 1 ? savedId1 : savedId2;
                return (
                  <View key={n}>
                    {n === 2 && <View style={s.divider} />}
                    <View style={s.teamLabelRow}>
                      <Text style={s.inputLabel}>{n === 1 ? '🏏 Your Team' : '⚔️ Opponent Team'}</Text>
                      <TouchableOpacity style={s.pickBtn} onPress={() => setPickerFor(n)}>
                        <Text style={s.pickBtnText}>👥 Pick saved team</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={s.input}
                      placeholder={n === 1 ? 'e.g. Mumbai Indians' : 'e.g. Chennai Super Kings'}
                      placeholderTextColor={C.textMuted}
                      value={name}
                      onChangeText={v => {
                        if (n === 1) { setTeam1Name(v); setSavedId1(undefined); } else { setTeam2Name(v); setSavedId2(undefined); }
                      }}
                    />
                    {!!savedId && <Text style={s.loadedText}>✓ Saved team loaded · {count} players</Text>}
                  </View>
                );
              })}
              <View style={s.divider} />
              <Text style={s.inputLabel}>📍 Match Location</Text>
              <TextInput style={s.input} placeholder="e.g. Wankhede Stadium, Mumbai" placeholderTextColor={C.textMuted} value={location} onChangeText={setLocation} />
            </View>
            <TouchableOpacity style={s.primaryBtn} onPress={goToPlayers}>
              <Text style={s.primaryBtnText}>Next: Add Players →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Players */}
        {step === 'players' && (
          <View>
            <View style={s.teamTabs}>
              <TouchableOpacity style={[s.teamTab, activeTeam === 1 && s.teamTabActive]} onPress={() => setActiveTeam(1)}>
                <Text style={[s.teamTabText, activeTeam === 1 && s.teamTabTextActive]}>{team1Name} ({team1Players.length}/11)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.teamTab, activeTeam === 2 && s.teamTabActive]} onPress={() => setActiveTeam(2)}>
                <Text style={[s.teamTabText, activeTeam === 2 && s.teamTabTextActive]}>{team2Name} ({team2Players.length}/11)</Text>
              </TouchableOpacity>
            </View>

            <View style={s.card}>
              <View style={s.addRow}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Player name"
                  placeholderTextColor={C.textMuted}
                  value={playerInput}
                  onChangeText={setPlayerInput}
                  onSubmitEditing={addPlayer}
                  returnKeyType="done"
                />
                <TouchableOpacity style={s.addBtn} onPress={addPlayer}>
                  <Text style={s.addBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {players.length > 0 && (
              <View style={s.card}>
                {players.map((p, i) => (
                  <TouchableOpacity key={p.name} activeOpacity={0.7} onPress={() => editPlayer(i)} style={[s.playerRow, i < players.length - 1 && s.playerRowBorder]}>
                    {p.photo
                      ? <Image source={{ uri: p.photo }} style={s.playerAvatar} />
                      : <View style={s.playerNumBadge}><Text style={s.playerNum}>{i + 1}</Text></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={s.playerName}>{p.name}{p.nickname ? ` (${p.nickname})` : ''}</Text>
                      {!!p.mobile && <Text style={s.playerMobile}>📱 {p.mobile}</Text>}
                      <View style={s.rolesWrap}>
                        {p.roles.map(r => {
                          const col = roleColor(r);
                          return (
                            <View key={r} style={[s.roleBadge, { backgroundColor: col.bg }]}>
                              <Text style={[s.roleBadgeText, { color: col.text }]}>
                                {ALL_ROLES.find(x => x.key === r)?.icon} {r}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => editPlayer(i)} style={s.editBtn}>
                      <Text style={s.editBtnText}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removePlayer(p.name)} style={s.removeBtn}>
                      <Text style={s.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {players.length > 0 && <Text style={s.hintText}>Tap a player to edit name, mobile or role</Text>}

            {players.length === 0 && (
              <View style={s.emptyBox}>
                <Text style={s.emptyIcon}>👤</Text>
                <Text style={s.emptyText}>No players added yet</Text>
              </View>
            )}

            {players.length >= 2 && !(activeTeam === 1 ? savedId1 : savedId2) && (
              <TouchableOpacity style={s.saveTeamBtn} onPress={saveForEveryone} disabled={savingTeam}>
                <Text style={s.saveTeamText}>
                  {savingTeam ? 'Saving…' : `☁️ Save ${(activeTeam === 1 ? team1Name : team2Name) || 'team'} for everyone`}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.primaryBtn} onPress={goToSettings}>
              <Text style={s.primaryBtnText}>Next: Match Settings →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Settings */}
        {step === 'settings' && (
          <View>
            <Text style={s.sectionTitle}>Overs</Text>
            <View style={s.card}>
              <Text style={s.inputLabel}>Number of Overs per innings</Text>
              <View style={s.oversRow}>
                {['5', '10', '20', '50'].map(o => (
                  <TouchableOpacity key={o} style={[s.oversChip, overs === o && s.oversChipActive]} onPress={() => setOvers(o)}>
                    <Text style={[s.oversChipText, overs === o && s.oversChipTextActive]}>{o}</Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={[s.oversInput, !['5','10','20','50'].includes(overs) && s.oversInputActive]}
                  placeholder="Custom"
                  placeholderTextColor={C.textMuted}
                  keyboardType="number-pad"
                  value={['5','10','20','50'].includes(overs) ? '' : overs}
                  onChangeText={setOvers}
                />
              </View>
            </View>

            <Text style={s.sectionTitle}>Captains</Text>
            {[{ team: team1Name, teamPlayers: team1Players, captain: team1Captain, setCaptain: setTeam1Captain, icon: '🏏' },
              { team: team2Name, teamPlayers: team2Players, captain: team2Captain, setCaptain: setTeam2Captain, icon: '⚔️' }
            ].map(({ team, teamPlayers, captain, setCaptain, icon }, ti) => (
              <View key={ti} style={[s.card, ti > 0 && { marginTop: 12 }]}>
                <Text style={s.captainTeamLabel}>{icon} {team} Captain</Text>
                {teamPlayers.map(p => (
                  <TouchableOpacity key={p.name} style={[s.captainRow, captain === p.name && s.captainRowActive]} onPress={() => setCaptain(p.name)}>
                    <View style={[s.radio, captain === p.name && s.radioActive]}>
                      {captain === p.name && <View style={s.radioDot} />}
                    </View>
                    <Text style={[s.captainName, captain === p.name && s.captainNameActive]}>{p.name}</Text>
                    <View style={s.rolesWrap}>
                      {p.roles.slice(0, 2).map(r => {
                        const col = roleColor(r);
                        return (
                          <View key={r} style={[s.roleBadge, { backgroundColor: col.bg }]}>
                            <Text style={[s.roleBadgeText, { color: col.text }]}>{ALL_ROLES.find(x => x.key === r)?.icon} {r}</Text>
                          </View>
                        );
                      })}
                    </View>
                    {captain === p.name && <Text style={s.captainBadge}>© Captain</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: C.green }]} onPress={startMatch}>
              <Text style={s.primaryBtnText}>🏏 Proceed to Bet</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <TeamPicker
        visible={pickerFor !== null}
        title={pickerFor === 2 ? 'Pick Opponent Team' : 'Pick Your Team'}
        excludeId={pickerFor === 1 ? savedId2 : savedId1}
        onPick={team => pickerFor && pickSaved(pickerFor, team)}
        onClose={() => setPickerFor(null)}
      />

      {/* Player Add Modal */}
      <Modal visible={playerModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={s.modalBox} keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>{editingIdx === null ? '👤 Add Player' : '✎ Edit Player'}</Text>

            {/* Photo */}
            <TouchableOpacity style={s.photoPickerBtn} onPress={pickPhoto}>
              {pendingPhoto
                ? <Image source={{ uri: pendingPhoto }} style={s.photoPickerImg} />
                : <View style={s.photoPickerPlaceholder}>
                    <Text style={s.photoPickerIcon}>📷</Text>
                    <Text style={s.photoPickerText}>Add Photo</Text>
                  </View>}
            </TouchableOpacity>

            {/* Name & Nickname */}
            <TextInput
              style={s.modalInput}
              placeholder="Full Name *"
              placeholderTextColor={C.textMuted}
              value={pendingName}
              onChangeText={setPendingName}
            />
            <TextInput
              style={s.modalInput}
              placeholder="Nickname (optional)"
              placeholderTextColor={C.textMuted}
              value={pendingNickname}
              onChangeText={setPendingNickname}
            />
            <TextInput
              style={s.modalInput}
              placeholder="📱 Mobile No. (optional)"
              placeholderTextColor={C.textMuted}
              keyboardType="phone-pad"
              maxLength={14}
              value={pendingMobile}
              onChangeText={setPendingMobile}
            />

            {/* Roles */}
            <Text style={s.modalSub}>Select Role(s) *</Text>
            <View style={s.rolesGrid}>
              {ALL_ROLES.map(({ key, icon }) => {
                const selected = selectedRoles.includes(key);
                const col = roleColor(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.roleBtn, selected && { backgroundColor: col.bg, borderColor: col.text + '60' }]}
                    onPress={() => toggleRole(key)}>
                    <Text style={s.roleBtnIcon}>{icon}</Text>
                    <Text style={[s.roleBtnText, selected && { color: col.text }]}>{key}</Text>
                    {selected && <View style={[s.roleCheck, { backgroundColor: col.text }]}><Text style={s.roleCheckText}>✓</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={s.confirmBtn} onPress={confirmPlayer}>
              <Text style={s.confirmBtnText}>{editingIdx === null ? 'Add Player →' : 'Save Changes ✓'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setPlayerModal(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
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
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  back: { color: C.primary, fontSize: 15, fontWeight: '600', width: 60 },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.divider, justifyContent: 'center', alignItems: 'center' },
  stepCircleActive: { backgroundColor: C.primary },
  stepCircleDone: { backgroundColor: C.green },
  stepNum: { fontSize: 12, fontWeight: '700', color: C.textMuted },
  stepNumActive: { color: C.white },
  stepNumDone: { color: C.white },
  stepLabel: { fontSize: 11, color: C.textMuted, marginLeft: 6 },
  stepLabelActive: { color: C.primary, fontWeight: '700' },
  stepLine: { width: 28, height: 2, backgroundColor: C.cardBorder, marginHorizontal: 6 },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.textSub, marginBottom: 8, marginTop: 4, letterSpacing: 0.5 },
  card: {
    backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  inputLabel: { fontSize: 13, color: C.textSub, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 4,
  },
  divider: { height: 1, backgroundColor: C.divider, marginVertical: 12 },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
  teamTabs: {
    flexDirection: 'row', backgroundColor: C.white, borderRadius: 12,
    padding: 4, marginBottom: 12, borderWidth: 1, borderColor: C.cardBorder,
  },
  teamTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  teamTabActive: { backgroundColor: C.primary },
  teamTabText: { fontSize: 13, fontWeight: '600', color: C.textSub },
  teamTabTextActive: { color: C.white },
  addRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  addBtn: { backgroundColor: C.accentLight, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.accent + '40' },
  addBtnText: { color: C.accent, fontWeight: '700', fontSize: 14 },
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  playerRowBorder: { borderBottomWidth: 1, borderBottomColor: C.divider },
  playerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  playerNumBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.divider, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  playerNum: { fontSize: 12, fontWeight: '700', color: C.textSub },
  playerName: { fontSize: 15, color: C.text, fontWeight: '600', marginBottom: 4 },
  rolesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  roleBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  roleBadgeText: { fontSize: 10, fontWeight: '700' },
  playerMobile: { fontSize: 12, color: C.textSub, marginBottom: 4 },
  hintText: { fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: -4, marginBottom: 8 },
  editBtn: { padding: 6, marginRight: 2 },
  editBtnText: { color: C.accent, fontSize: 16, fontWeight: '700' },
  removeBtn: { padding: 6 },
  teamLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickBtn: { backgroundColor: C.greenLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8 },
  pickBtnText: { color: C.green, fontSize: 12, fontWeight: '800' },
  loadedText: { fontSize: 12, color: C.green, fontWeight: '700', marginTop: 2 },
  saveTeamBtn: {
    borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 4,
    borderWidth: 1.5, borderColor: C.green, borderStyle: 'dashed', backgroundColor: C.greenLight,
  },
  saveTeamText: { color: C.green, fontSize: 14, fontWeight: '800' },
  removeBtnText: { color: C.textMuted, fontSize: 14 },
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { color: C.textMuted, fontSize: 14 },
  matchTypeRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  matchTypeBtn: { flex: 1, backgroundColor: C.white, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: C.cardBorder, position: 'relative' },
  matchTypeBtnActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  matchTypeIcon: { fontSize: 28, marginBottom: 6 },
  matchTypeTitle: { fontSize: 13, fontWeight: '700', color: C.textSub, marginBottom: 4, textAlign: 'center' },
  matchTypeTitleActive: { color: C.primary },
  matchTypeDesc: { fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 16 },
  matchTypeCheck: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  matchTypeCheckText: { color: C.white, fontSize: 11, fontWeight: '800' },
  oversRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 },
  oversChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: C.divider, borderWidth: 1, borderColor: C.cardBorder },
  oversChipActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  oversChipText: { fontSize: 14, fontWeight: '600', color: C.textSub },
  oversChipTextActive: { color: C.primary },
  oversInput: { width: 70, backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.cardBorder, textAlign: 'center' },
  oversInputActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  captainTeamLabel: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  captainRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider, flexWrap: 'wrap', gap: 4 },
  captainRowActive: { backgroundColor: C.greenLight, marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 10 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.cardBorder, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: C.green },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.green },
  captainName: { fontSize: 15, color: C.text, marginRight: 8 },
  captainNameActive: { fontWeight: '700', color: C.green },
  captainBadge: { fontSize: 11, color: C.green, fontWeight: '700', backgroundColor: C.greenLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#00000060', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 2 },
  modalSub: { fontSize: 13, color: C.textSub, marginBottom: 20 },
  rolesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  roleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    backgroundColor: C.divider, borderWidth: 1, borderColor: C.cardBorder,
    position: 'relative',
  },
  roleBtnIcon: { fontSize: 16 },
  roleBtnText: { fontSize: 13, fontWeight: '700', color: C.textSub },
  roleCheck: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  roleCheckText: { color: C.white, fontSize: 9, fontWeight: '800' },
  confirmBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  confirmBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
  modalInput: {
    backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 10,
  },
  photoPickerBtn: { alignSelf: 'center', marginBottom: 16 },
  photoPickerImg: { width: 80, height: 80, borderRadius: 40 },
  photoPickerPlaceholder: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: C.divider,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.cardBorder,
  },
  photoPickerIcon: { fontSize: 24 },
  photoPickerText: { fontSize: 10, color: C.textMuted, fontWeight: '600', marginTop: 2 },
  cancelBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { color: C.textSub, fontSize: 14, fontWeight: '600' },
});
