import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

const API_URL = Config.API_URL || 'http://10.0.2.2:3000/api';
const HISTORY_KEY = 'cricscore_match_history';
const IN_PROGRESS_KEY = 'cricscore_inprogress_match';
export const STORAGE_MODE_KEY = 'cricscore_storage_mode'; // 'local' | 'central'

export const getStorageMode = async (): Promise<'local' | 'central'> => {
  const m = await AsyncStorage.getItem(STORAGE_MODE_KEY);
  return (m === 'central') ? 'central' : 'local';
};

export const setStorageMode = async (mode: 'local' | 'central') => {
  await AsyncStorage.setItem(STORAGE_MODE_KEY, mode);
};

const isCentral = async () => (await getStorageMode()) === 'central';

const api = async (method: string, path: string, body?: any) => {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
};

// ─── INNINGS HELPER ──────────────────────────────────────

const saveInningsData = async (matchId: string, inningsNum: number, inningsData: any, battingTeamName: string) => {
  const inningsRes = await api('POST', '/innings', {
    match_id: matchId,
    innings_number: inningsNum,
    batting_team_name: battingTeamName,
    total_runs: inningsData.runs,
    total_wickets: inningsData.wickets,
    overs_played: inningsData.overs,
    balls_played: inningsData.balls,
  });
  for (const b of (inningsData.batters || [])) {
    await api('POST', '/batting', {
      innings_id: inningsRes.id,
      player_name: b.name,
      runs: b.runs, balls: b.balls,
      fours: b.fours, sixes: b.sixes, is_out: b.out,
      how_out: b.howOut || null,
    });
  }
  for (const b of (inningsData.bowlers || [])) {
    await api('POST', '/bowling', {
      innings_id: inningsRes.id,
      player_name: b.name,
      overs: b.overs, balls: b.balls,
      runs: b.runs, wickets: b.wickets,
    });
  }
  return inningsRes.id;
};

const saveMatchToServer = async (matchData: any) => {
  const match = await api('POST', '/matches', {
    team1_name: matchData.battingTeam.name,
    team2_name: matchData.fieldingTeam.name,
    overs: matchData.overs,
    match_type: matchData.matchType,
    toss_winner: matchData.tossWinner || '',
    toss_choice: matchData.tossChoice || '',
    bet_type: matchData.betAmount > 0 ? 'paid' : 'free',
    bet_amount: matchData.betAmount || 0,
  });
  await saveInningsData(match.id, 1, matchData.innings1, matchData.battingTeam.name);
  if (matchData.innings2) {
    await saveInningsData(match.id, 2, matchData.innings2, matchData.fieldingTeam.name);
  }
  await api('PATCH', `/matches/${match.id}/complete`, { result: matchData.result || '' });
  return match.id;
};

// ─── MATCHES ─────────────────────────────────────────────

export const saveMatch = async (matchData: any) => {
  const central = await isCentral();

  if (central) {
    return saveMatchToServer(matchData);
  } else {
    const existing = await AsyncStorage.getItem(HISTORY_KEY);
    const history = existing ? JSON.parse(existing) : [];

    // 2nd innings complete — update existing pending record
    if (matchData.innings2) {
      const t1 = matchData.battingTeam.name;
      const t2 = matchData.fieldingTeam.name;
      const idx = history.findIndex(
        (m: any) => m.status === 'pending' &&
          ((m.team1 === t1 && m.team2 === t2) ||
           (m.team1 === t2 && m.team2 === t1))
      );
      if (idx !== -1) {
        history[idx] = {
          ...history[idx],
          innings2: matchData.innings2,
          result: matchData.result || '',
          status: 'completed',
          synced: false,
        };
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        await AsyncStorage.removeItem(IN_PROGRESS_KEY);
        return history[idx].id;
      }
    }

    const record = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('en-IN'),
      team1: matchData.battingTeam.name,
      team2: matchData.fieldingTeam.name,
      overs: matchData.overs,
      matchType: matchData.matchType,
      location: matchData.location,
      score: `${matchData.innings1.runs}/${matchData.innings1.wickets}`,
      oversPlayed: `${matchData.innings1.overs}.${matchData.innings1.balls}`,
      battingTeam: matchData.battingTeam,
      fieldingTeam: matchData.fieldingTeam,
      innings1: matchData.innings1,
      innings2: matchData.innings2 || null,
      result: matchData.result || '',
      bet: matchData.bet || null,
      status: matchData.innings2 ? 'completed' : 'pending',
      synced: false,
    };
    history.unshift(record);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    await AsyncStorage.removeItem(IN_PROGRESS_KEY);
    return record.id;
  }
};

// ─── SYNC LOCAL → SERVER ─────────────────────────────────

export const syncLocalToServer = async (): Promise<{ synced: number; failed: number }> => {
  const existing = await AsyncStorage.getItem(HISTORY_KEY);
  const history: any[] = existing ? JSON.parse(existing) : [];

  const unsynced = history.filter(m => !m.synced && m.status === 'completed');
  let synced = 0;
  let failed = 0;

  for (const m of unsynced) {
    try {
      await saveMatchToServer({
        battingTeam: m.battingTeam,
        fieldingTeam: m.fieldingTeam,
        overs: m.overs,
        matchType: m.matchType,
        tossWinner: m.tossWinner || '',
        tossChoice: m.tossChoice || '',
        betAmount: m.bet?.amount || 0,
        innings1: m.innings1,
        innings2: m.innings2,
        result: m.result,
      });
      const idx = history.findIndex(h => h.id === m.id);
      if (idx !== -1) history[idx].synced = true;
      synced++;
    } catch {
      failed++;
    }
  }

  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return { synced, failed };
};

export const getUnsyncedCount = async (): Promise<number> => {
  const existing = await AsyncStorage.getItem(HISTORY_KEY);
  const history: any[] = existing ? JSON.parse(existing) : [];
  return history.filter(m => !m.synced && m.status === 'completed').length;
};

// ─── IN PROGRESS ─────────────────────────────────────────

export const saveInProgressMatch = async (state: any) => {
  await AsyncStorage.setItem(IN_PROGRESS_KEY, JSON.stringify({ ...state, status: 'inprogress', savedAt: Date.now() }));
};

export const getInProgressMatch = async () => {
  const data = await AsyncStorage.getItem(IN_PROGRESS_KEY);
  return data ? JSON.parse(data) : null;
};

export const clearInProgressMatch = async () => {
  await AsyncStorage.removeItem(IN_PROGRESS_KEY);
};

// ─── GET MATCHES ─────────────────────────────────────────

export const getMatches = async () => {
  const central = await isCentral();
  if (central) {
    const matches = await api('GET', '/matches');
    return matches.map((m: any) => ({
      id: m.id,
      date: new Date(m.created_at).toLocaleDateString('en-IN'),
      team1: m.team1_name,
      team2: m.team2_name,
      overs: m.overs,
      matchType: m.match_type,
      score: '',
      oversPlayed: '',
      battingTeam: { name: m.team1_name },
      fieldingTeam: { name: m.team2_name },
      innings1: null,
      innings2: null,
      result: '',
      status: m.status,
      synced: true,
    }));
  } else {
    const data = await AsyncStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  }
};

export const clearMatches = async () => {
  await AsyncStorage.removeItem(HISTORY_KEY);
};

export const saveTeam = async (name: string) => {
  if (!(await isCentral())) return null;
  return api('POST', '/teams', { name });
};

export const savePlayers = async (teamId: string, players: any[]) => {
  if (!(await isCentral())) return;
  for (const p of players) {
    await api('POST', '/players', {
      team_id: teamId,
      name: p.name, nickname: p.nickname,
      photo: p.photo, roles: p.roles,
    });
  }
};
