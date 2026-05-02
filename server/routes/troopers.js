'use strict';
const express = require('express');
const { generateTroopers }    = require('../utils/generateTroopers');
const { normalizeIp, todayString } = require('../utils/seed');

const router = express.Router();

// GET /api/troopers — deterministic per client IP + current date
router.get('/', (req, res) => {
  const rawIp  = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '';
  const ip     = normalizeIp(rawIp);
  const date   = todayString();
  const troopers = generateTroopers(ip, date, 8);
  return res.json({ troopers, date });
});

module.exports = router;
