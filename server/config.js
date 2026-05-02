'use strict';
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

// Persist JWT secret across restarts so existing tokens stay valid
const SECRET_FILE = path.join(__dirname, '.jwt_secret');
let jwtSecret;
if (fs.existsSync(SECRET_FILE)) {
  jwtSecret = fs.readFileSync(SECRET_FILE, 'utf8').trim();
} else {
  jwtSecret = crypto.randomBytes(64).toString('hex');
  try { fs.writeFileSync(SECRET_FILE, jwtSecret, { mode: 0o600 }); } catch (_) {}
}

module.exports = {
  PORT:          parseInt(process.env.PORT || '3001', 10),
  BIND_HOST:     process.env.BIND_HOST || '0.0.0.0',
  JWT_SECRET:    jwtSecret,
  JWT_EXPIRES_IN:'7d',
  BCRYPT_ROUNDS: 12,
  DB_PATH:       process.env.DB_PATH || path.join(__dirname, 'squadron.db'),
};
