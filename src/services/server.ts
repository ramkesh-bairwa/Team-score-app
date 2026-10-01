import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

const SERVER_KEY = 'cricscore_server_url';
// 10.0.2.2 is the host machine as seen from the Android emulator only
export const DEFAULT_API_URL = Config.API_URL || 'http://10.0.2.2:3000/api';

let cached: string | null = null;

// The server address can be changed in-app (no rebuild), e.g. to the laptop's Wi-Fi IP or a hosted server
export const getApiUrl = async () => {
  if (!cached) cached = (await AsyncStorage.getItem(SERVER_KEY).catch(() => null)) || DEFAULT_API_URL;
  return cached;
};

// Accepts "192.168.1.49", "192.168.1.49:3000", "http://host:3000" or a full ".../api" URL
export const normalizeApiUrl = (input: string) => {
  let url = input.trim().replace(/\/+$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  if (/^http:\/\/[^/:]+$/i.test(url)) url += ':3000';
  if (!/\/api$/.test(url)) url += '/api';
  return url;
};

export const setApiUrl = async (input: string) => {
  const url = normalizeApiUrl(input);
  if (url) await AsyncStorage.setItem(SERVER_KEY, url);
  else await AsyncStorage.removeItem(SERVER_KEY);
  cached = url || DEFAULT_API_URL;
  return cached;
};

// Free hosts (e.g. Render) sleep when idle and can take up to a minute to wake up
export const fetchWithTimeout = async (url: string, init: RequestInit = {}, ms = 20000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
};

export const testServer = async (apiUrl: string): Promise<boolean> => {
  try {
    const res = await fetchWithTimeout(`${apiUrl.replace(/\/api$/, '')}/health`, {}, 60000);
    return res.ok;
  } catch {
    return false;
  }
};
