'use strict';
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const { PORT, BIND_HOST } = require('./config');

const app = express();

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — allow localhost on any port and file:// origins (origin = 'null') ─
app.use(cors({
  origin(origin, cb) {
    const allowed =
      !origin ||                                               // same-origin or no-cors
      origin === 'null' ||                                     // file:// protocol
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin); // any localhost port
    if (allowed) cb(null, true);
    else cb(Object.assign(new Error('CORS'), { status: 403 }));
  },
  credentials: true,
}));

// ── Body parser (tight limit to reduce DoS surface) ──────────────────────────
app.use(express.json({ limit: '32kb' }));

// ── Rate limiters ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessaie dans une minute.' },
});

// Tight limit on auth endpoints to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessaie dans 15 minutes.' },
  skipSuccessfulRequests: false,
});

app.use(globalLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     authLimiter, require('./routes/auth'));
app.use('/api/squad',    require('./routes/squads'));
app.use('/api/troopers', require('./routes/troopers'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route introuvable.' }));

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.status === 403 || (err.message && err.message.startsWith('CORS'))) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  console.error('[squadron-server] unhandled error:', err.message);
  res.status(500).json({ error: 'Erreur serveur.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, BIND_HOST, () => {
  console.log(`[squadron-server] http://${BIND_HOST}:${PORT}`);
});

module.exports = app;
