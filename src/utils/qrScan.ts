import { launchCamera, launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import jsQR from 'jsqr';
import { decode as decodeJpeg } from 'jpeg-js';
import UPNG from 'upng-js';

export type JoinLink = { code: string; server?: string; role?: 'scorer' | 'streamer' };

// QR payload: cricscore://join?code=ABC123&server=<api base>&role=streamer. A bare 6-character code also works.
export const buildJoinLink = (code: string, server: string, role?: 'scorer' | 'streamer') =>
  `cricscore://join?code=${code}&server=${encodeURIComponent(server)}${role ? `&role=${role}` : ''}`;

export const parseJoinLink = (text: string): JoinLink | null => {
  const t = text.trim();
  if (/^[A-Za-z0-9]{6}$/.test(t)) return { code: t.toUpperCase() };
  const m = t.match(/^cricscore:\/\/join\?(.*)$/i);
  if (!m) return null;
  const params: Record<string, string> = {};
  m[1].split('&').forEach(pair => {
    const [k, v = ''] = pair.split('=');
    params[k] = decodeURIComponent(v);
  });
  if (!/^[A-Za-z0-9]{6}$/.test(params.code || '')) return null;
  const role = params.role === 'streamer' || params.role === 'scorer' ? params.role : undefined;
  return { code: params.code.toUpperCase(), server: params.server || undefined, role };
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(128);
for (let i = 0; i < B64.length; i++) B64_LOOKUP[B64.charCodeAt(i)] = i;

export const base64ToBytes = (b64: string) => {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64_LOOKUP[clean.charCodeAt(i)] << 18) | (B64_LOOKUP[clean.charCodeAt(i + 1)] << 12)
      | (B64_LOOKUP[clean.charCodeAt(i + 2)] << 6) | B64_LOOKUP[clean.charCodeAt(i + 3)];
    bytes[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length) bytes[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) bytes[o++] = n & 255;
  }
  return bytes.subarray(0, o);
};

// Decodes JPEG or PNG bytes to RGBA pixels
export const decodeImage = (bytes: Uint8Array): { data: Uint8ClampedArray; width: number; height: number } => {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  if (isPng) {
    const png = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    return { data: new Uint8ClampedArray(UPNG.toRGBA8(png)[0]), width: png.width, height: png.height };
  }
  const jpg = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true });
  return { data: new Uint8ClampedArray(jpg.data.buffer, jpg.data.byteOffset, jpg.data.byteLength), width: jpg.width, height: jpg.height };
};

export const readQr = (img: { data: Uint8ClampedArray; width: number; height: number }) =>
  jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });

// The QR is decoded from a photo (or saved screenshot) in JS, so no native scanner module is needed.
// Resolves null if the user cancels; throws if no QR code is found.
export const scanQrFromImage = async (source: 'camera' | 'gallery'): Promise<JoinLink | null> => {
  const opts = { mediaType: 'photo' as const, includeBase64: true, maxWidth: 900, maxHeight: 900, quality: 0.9 as const };
  const res: ImagePickerResponse = await (source === 'camera' ? launchCamera(opts) : launchImageLibrary(opts));
  if (res.didCancel) return null;
  if (res.errorCode) throw new Error(res.errorMessage || 'Could not open the camera');
  const asset = res.assets?.[0];
  if (!asset?.base64) throw new Error('Could not read the photo');
  let found;
  try {
    found = readQr(decodeImage(base64ToBytes(asset.base64)));
  } catch {
    throw new Error('Could not read this image. Use a camera photo or a JPG/PNG screenshot of the QR code.');
  }
  if (!found) throw new Error('No QR code found. Hold the phone steady, fill the frame with the QR code and try again.');
  const link = parseJoinLink(found.data);
  if (!link) throw new Error('This QR code is not a CricScore match code');
  return link;
};
