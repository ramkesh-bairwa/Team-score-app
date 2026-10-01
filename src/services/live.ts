import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl, fetchWithTimeout } from './server';
const DEVICE_KEY = 'cricscore_device_id';

export type LiveRole = 'host' | 'scorer';
export type LiveSession = { code: string; token: string; role: LiveRole };

// What gets synced between scorers. `params` are the Scoring screen params for
// the current innings; `scorecardParams` is set once an innings has ended.
export type LivePayload = {
  phase: 'scoring' | 'innings_end';
  inningsNum: 1 | 2;
  params: any;
  savedState?: any;
  scorecardParams?: any;
};

let deviceId: string | null = null;
export const getDeviceId = async () => {
  if (deviceId) return deviceId;
  deviceId = await AsyncStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    deviceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_KEY, deviceId);
  }
  return deviceId;
};

const call = async (method: string, path: string, body?: any) => {
  const base = await getApiUrl();
  let res: Response;
  try {
    res = await fetchWithTimeout(`${base}/live${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(
      new Error(`Could not reach the CricScore server at ${base.replace(/\/api$/, '')}. Make sure it is running and this phone is on the same Wi-Fi, or change the server address.`),
      { status: 0 },
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
  return data;
};

export const createLiveSession = async (hostName: string, payload: LivePayload): Promise<LiveSession> => {
  const { code, token } = await call('POST', '', { hostName, deviceId: await getDeviceId(), payload });
  return { code, token, role: 'host' };
};

export const requestJoin = async (code: string, name: string): Promise<{ requestId: string; hostName: string }> =>
  call('POST', `/${code.trim().toUpperCase()}/join`, { name, deviceId: await getDeviceId() });

export const getJoinStatus = async (code: string, requestId: string): Promise<{
  status: 'pending' | 'approved' | 'denied'; token?: string; version?: number; payload?: LivePayload | null;
}> => call('GET', `/${code}/requests/${requestId}`);

export const getPendingRequests = async (s: LiveSession): Promise<{ id: string; name: string }[]> =>
  call('GET', `/${s.code}/requests?token=${s.token}`);

export const respondToRequest = async (s: LiveSession, requestId: string, approve: boolean) =>
  call('POST', `/${s.code}/requests/${requestId}`, { token: s.token, approve });

// The server keeps sessions in memory; after a restart the owner re-registers the same code
const restoreSession = async (s: LiveSession, payload?: LivePayload) =>
  call('POST', '/restore', { code: s.code, token: s.token, deviceId: await getDeviceId(), payload });

// Pushes are chained so updates from one device always reach the server in order
let pushChain: Promise<any> = Promise.resolve();
export const pushLiveState = (s: LiveSession, payload: LivePayload): Promise<number | null> => {
  const next = pushChain.then(async () => {
    const body = { token: s.token, deviceId: await getDeviceId(), payload };
    try {
      return (await call('PUT', `/${s.code}/state`, body)).version as number;
    } catch (e: any) {
      if (e.status !== 404 || s.role !== 'host') throw e;
      await restoreSession(s, payload);
      return (await call('PUT', `/${s.code}/state`, body)).version as number;
    }
  }).catch(() => null);
  pushChain = next;
  return next;
};

export const pullLiveState = async (s: LiveSession, since: number): Promise<{
  changed: boolean; version: number; payload?: LivePayload; fromMe?: boolean;
}> => {
  const data = await call('GET', `/${s.code}/state?token=${s.token}&since=${since}`);
  return { ...data, fromMe: data.updatedBy === (await getDeviceId()) };
};

// Asks the server for the overlay link (it knows the address streaming apps can reach).
// Makes sure the session exists first, so a server restart doesn't leave a dead link.
export const getOverlayLink = async (s: LiveSession, payload?: LivePayload): Promise<string> => {
  try {
    return (await call('GET', `/${s.code}/links`)).overlayUrl;
  } catch (e: any) {
    if (e.status !== 404 || s.role !== 'host') throw e;
    await restoreSession(s, payload);
    return (await call('GET', `/${s.code}/links`)).overlayUrl;
  }
};

// Private-network addresses only work for devices on the same Wi-Fi as the server
export const isLocalAddress = (url: string) => /\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url);
