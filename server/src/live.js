const express = require('express');
const crypto = require('crypto');
const os = require('os');
const router = express.Router();

// Live scoring sessions are kept in memory: they only need to outlive a match,
// and this keeps sharing usable even when DB_RUN=false.
// code -> { hostToken, hostName, tokens: Set, requests: Map, version, payload, updatedBy, touchedAt }
const sessions = new Map();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

const newToken = () => crypto.randomBytes(16).toString('hex');
const newCode = () => {
  let code;
  do {
    code = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
  } while (sessions.has(code));
  return code;
};

setInterval(() => {
  const now = Date.now();
  for (const [code, sess] of sessions) {
    if (now - sess.touchedAt > SESSION_TTL_MS) sessions.delete(code);
  }
}, 30 * 60 * 1000).unref();

const getSession = (req, res) => {
  const sess = sessions.get(String(req.params.code || '').toUpperCase());
  if (!sess) {
    res.status(404).json({ error: 'Match code not found or expired' });
    return null;
  }
  sess.touchedAt = Date.now();
  return sess;
};

// Base URL that streaming apps should use for the overlay: PUBLIC_URL if set, otherwise the
// address the phone used to reach us, falling back to this machine's LAN IP for loopback/emulator hosts
const lanIp = () => {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return 'localhost';
};
const publicBase = (req) => {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const host = req.get('host') || '';
  if (host && !/^(localhost|127\.|10\.0\.2\.2)/.test(host)) return `${req.protocol}://${host}`;
  return `http://${lanIp()}:${process.env.PORT || 3000}`;
};
const overlayUrl = (req, code) => `${publicBase(req)}/overlay/${code}`;

const authorized = (sess, token) => !!token && (token === sess.hostToken || sess.tokens.has(token));

// POST /live  { hostName, deviceId, payload } -> { code, token }
router.post('/', (req, res) => {
  const { hostName, deviceId, payload } = req.body || {};
  const code = newCode();
  const hostToken = newToken();
  sessions.set(code, {
    hostToken, hostName: hostName || 'Scorer',
    tokens: new Set([hostToken]), requests: new Map(),
    version: 1, payload: payload || null, updatedBy: deviceId || null, touchedAt: Date.now(),
  });
  res.json({ code, token: hostToken, overlayUrl: overlayUrl(req, code) });
});

// POST /live/restore  { code, token, hostName, deviceId, payload }
// Sessions live in memory, so after a server restart the owner's phone re-registers its
// existing code; links already pasted into a streaming app keep working.
router.post('/restore', (req, res) => {
  const { code, token, hostName, deviceId, payload } = req.body || {};
  if (!/^[A-Z0-9]{6}$/.test(code || '') || !token) return res.status(400).json({ error: 'Invalid session' });
  const existing = sessions.get(code);
  if (existing) {
    if (existing.hostToken !== token) return res.status(409).json({ error: 'Code is in use by another match' });
    return res.json({ code, restored: false });
  }
  sessions.set(code, {
    hostToken: token, hostName: hostName || 'Scorer',
    tokens: new Set([token]), requests: new Map(),
    version: 1, payload: payload || null, updatedBy: deviceId || null, touchedAt: Date.now(),
  });
  res.json({ code, restored: true });
});

// GET /live/:code/links -> { overlayUrl }
router.get('/:code/links', (req, res) => {
  const sess = getSession(req, res);
  if (!sess) return;
  res.json({ overlayUrl: overlayUrl(req, req.params.code.toUpperCase()) });
});

// POST /live/:code/join  { name, deviceId } -> { requestId, hostName }
router.post('/:code/join', (req, res) => {
  const sess = getSession(req, res);
  if (!sess) return;
  const { name, deviceId } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
  const requestId = newToken();
  sess.requests.set(requestId, {
    id: requestId, name: String(name).trim().slice(0, 40), deviceId: deviceId || null,
    status: 'pending', token: null, createdAt: Date.now(),
  });
  res.json({ requestId, hostName: sess.hostName });
});

// GET /live/:code/requests/:id  -> { status, token?, version?, payload? }  (polled by the joiner)
router.get('/:code/requests/:id', (req, res) => {
  const sess = getSession(req, res);
  if (!sess) return;
  const r = sess.requests.get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Request not found' });
  if (r.status !== 'approved') return res.json({ status: r.status });
  res.json({ status: r.status, token: r.token, version: sess.version, payload: sess.payload });
});

// GET /live/:code/requests?token=hostToken -> pending requests (host only)
router.get('/:code/requests', (req, res) => {
  const sess = getSession(req, res);
  if (!sess) return;
  if (req.query.token !== sess.hostToken) return res.status(403).json({ error: 'Only the match owner can see requests' });
  const list = [...sess.requests.values()]
    .filter(r => r.status === 'pending')
    .map(({ id, name, createdAt }) => ({ id, name, createdAt }));
  res.json(list);
});

// POST /live/:code/requests/:id  { token, approve } (host only)
router.post('/:code/requests/:id', (req, res) => {
  const sess = getSession(req, res);
  if (!sess) return;
  const { token, approve } = req.body || {};
  if (token !== sess.hostToken) return res.status(403).json({ error: 'Only the match owner can give access' });
  const r = sess.requests.get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Request not found' });
  if (approve) {
    r.status = 'approved';
    r.token = newToken();
    sess.tokens.add(r.token);
  } else {
    r.status = 'denied';
  }
  res.json({ success: true, status: r.status });
});

// PUT /live/:code/state  { token, deviceId, payload } -> { version }
router.put('/:code/state', (req, res) => {
  const sess = getSession(req, res);
  if (!sess) return;
  const { token, deviceId, payload } = req.body || {};
  if (!authorized(sess, token)) return res.status(403).json({ error: 'No scoring access' });
  sess.version += 1;
  sess.payload = payload;
  sess.updatedBy = deviceId || null;
  res.json({ version: sess.version });
});

// GET /live/:code/state?token=&since=version -> { changed, version, payload, updatedBy }
router.get('/:code/state', (req, res) => {
  const sess = getSession(req, res);
  if (!sess) return;
  if (!authorized(sess, req.query.token)) return res.status(403).json({ error: 'No scoring access' });
  const since = parseInt(req.query.since, 10) || 0;
  if (since >= sess.version) return res.json({ changed: false, version: sess.version });
  res.json({ changed: true, version: sess.version, payload: sess.payload, updatedBy: sess.updatedBy });
});

// ─── Public overlay feed (read-only, used by the YouTube overlay page) ────

const ballsOf = (overs) => (overs || []).reduce((n, o) => n + o.length, 0);

const summarize = (sess) => {
  const p = sess.payload;
  if (!p || !p.params) return { version: sess.version, phase: 'waiting' };
  const prm = p.params;
  const base = {
    version: sess.version,
    phase: p.phase,
    inningsNum: p.inningsNum,
    battingTeam: prm.battingTeam?.name || '',
    bowlingTeam: prm.fieldingTeam?.name || '',
    overs: prm.overs,
    target: prm.target || null,
  };

  if (p.phase === 'innings_end') {
    const sc = p.scorecardParams || {};
    const inn = p.inningsNum === 2 ? sc.innings2 : sc.innings1;
    let result = '';
    if (p.inningsNum === 2 && sc.innings1 && sc.innings2) {
      const r1 = sc.innings1.runs, r2 = sc.innings2.runs;
      if (r2 > r1) {
        const left = (sc.fieldingTeam?.players?.length || 11) - 1 - sc.innings2.wickets;
        result = `${sc.fieldingTeam?.name} won by ${left} wicket${left === 1 ? '' : 's'}`;
      } else if (r2 < r1) {
        result = `${sc.battingTeam?.name} won by ${r1 - r2} run${r1 - r2 === 1 ? '' : 's'}`;
      } else {
        result = 'Match tied';
      }
    }
    return {
      ...base,
      runs: inn?.runs ?? 0, wickets: inn?.wickets ?? 0,
      over: inn?.overs ?? 0, ball: inn?.balls ?? 0,
      result,
    };
  }

  const st = p.savedState || {};
  const batters = st.batters || [];
  const si = st.strikerIdx ?? 0;
  const thisOver = st.balls || [];
  const all = [...(st.overHistory || []).flat(), ...thisOver];
  return {
    ...base,
    runs: st.totalRuns ?? 0,
    wickets: st.wickets ?? 0,
    over: st.currentOver ?? 0,
    ball: st.currentBall ?? 0,
    striker: batters[si] ? { name: batters[si].name, runs: batters[si].runs, balls: batters[si].balls } : null,
    nonStriker: batters[si === 0 ? 1 : 0] ? (({ name, runs, balls }) => ({ name, runs, balls }))(batters[si === 0 ? 1 : 0]) : null,
    bowler: st.bowlers && st.bowlers[st.currentBowlerIdx ?? 0] || null,
    thisOver,
    // Number of deliveries so far + the latest one, so the overlay can animate new boundaries/wickets
    deliveries: ballsOf(st.overHistory) + thisOver.length,
    lastBall: all[all.length - 1] || null,
  };
};

// GET /live/:code/overlay -> public score summary (no token: shows score only)
router.get('/:code/overlay', (req, res) => {
  const sess = getSession(req, res);
  if (!sess) return;
  res.set('Cache-Control', 'no-store');
  res.json(summarize(sess));
});

module.exports = router;
