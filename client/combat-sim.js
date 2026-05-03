// Combat simulator — headless deterministic engine inspired by Minitroopers.
// V1 scope: infinite ammo, no reload, no critical, no specializations.
// Decisions per soldier each tick: hurt/dead lock → aim transition → run to/from
// range → fire (burst-aware). All randomness comes from a seeded mulberry32.

(function () {

  // ── Tunables ──────────────────────────────────────────────────────────────
  const DT = 1 / 60;                  // fixed simulation step
  const SPEED_TILES_PER_SEC = 6;      // base movement speed (Minitroopers default)
  const TILE_PX = 24;                 // 1 tile = 24 px on screen
  const ARENA_TILES = 50;             // playable width in tiles

  // Lane separation along Y (in pixels of arena coords).
  // Front-line carries SMG/shotgun/heavy; mid carries rifles/pistols; back is sniper.
  const LANE_OFFSETS = { front: 0, mid: -20, back: -40 };

  // ── Weapon stats loader ───────────────────────────────────────────────────
  // weapon-config.json is keyed by id; we re-key by name to match what soldiers
  // store (preferredWeapon / skill1Name are names, not ids).
  const statsByName = {};
  let statsLoadPromise = null;

  function loadWeaponStats() {
    if (statsLoadPromise) return statsLoadPromise;
    statsLoadPromise = fetch('./weapon-config.json')
      .then(r => r.json())
      .then(data => {
        for (const w of data.weapons) statsByName[w.name] = w;
      })
      .catch(() => {});
    return statsLoadPromise;
  }

  function getWeaponStats(name) {
    return statsByName[name] || null;
  }

  function laneForCategory(cat) {
    if (cat === 'sniper') return 'back';
    if (cat === 'rifle' || cat === 'pistol') return 'mid';
    return 'front'; // smg, shotgun, heavy
  }

  function animDur(animKey) {
    const a = window.Anims && window.Anims[animKey];
    if (!a) return 0;
    return a.frames / a.fps;
  }

  // ── RNG ───────────────────────────────────────────────────────────────────
  function mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    s = String(s);
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }

  // ── Combatant build ───────────────────────────────────────────────────────
  function defaultStats() {
    return {
      name: 'Glock 17', category: 'pistol',
      damage: 10, accuracy: 0.5, shootSpeed: 2, burst: 1,
      recovery: 0.2, rangeMin: 1, rangeMax: 10
    };
  }

  function buildCombatant(soldier, team, idxInTeam) {
    const level = soldier.level || 1;
    const hpMax = 10 + 2 * (level - 1);
    const weaponName = soldier.preferredWeapon || soldier.skill1Name || 'Glock 17';
    const stats = getWeaponStats(weaponName) || defaultStats();
    const lane = laneForCategory(stats.category);

    // Starting X: friendly side at left, enemy side at right.
    // Front lane starts further forward, back lane stays in retreat.
    // Stagger same-team soldiers along X so they don't render on top of each
    // other; ~2 tiles ≈ 48 px between adjacent bodies at the start.
    const laneFwd = lane === 'front' ? 6 : (lane === 'mid' ? 3 : 1);
    const xStart = team === 'A'
      ? laneFwd + idxInTeam * 2.0
      : (ARENA_TILES - 1) - laneFwd - idxInTeam * 2.0;

    return {
      id: (soldier.id || 'sld') + ':' + team + ':' + idxInTeam,
      name: soldier.name,
      team,
      cfg: soldier.config,
      weaponName,
      weapon: stats,
      lane,
      laneOffsetPx: LANE_OFFSETS[lane],
      hp: hpMax,
      hpMax,
      x: xStart,
      facing: team === 'A' ? 1 : -1,
      state: 'idle',
      stateT: 0,
      cooldownShoot: 0.4 + idxInTeam * 0.08,  // tiny stagger so first shots don't all align
      burstCooldown: 0,
      burstLeft: 0,
      aimed: false,
      targetId: null,
      initiative: 0
    };
  }

  // ── Battle ────────────────────────────────────────────────────────────────
  function createBattle(opts) {
    const seedStr = opts.seed || ('battle-' + Date.now());
    const rng = mulberry32(hashStr(seedStr));

    const A = (opts.teamA && opts.teamA.soldiers || []).map((s, i) => buildCombatant(s, 'A', i));
    const B = (opts.teamB && opts.teamB.soldiers || []).map((s, i) => buildCombatant(s, 'B', i));
    const all = A.concat(B);

    const events = [];
    let timeElapsed = 0;
    let done = false;
    let winner = null;
    let endHoldT = 0;

    function alive(team) {
      let n = 0;
      for (const s of all) if (s.team === team && s.hp > 0) n++;
      return n;
    }

    function findTarget(self) {
      let best = null, bestD = Infinity;
      for (const e of all) {
        if (e.team === self.team) continue;
        if (e.hp <= 0) continue;
        const d = Math.abs(e.x - self.x);
        if (d < bestD) { best = e; bestD = d; }
      }
      return best;
    }

    function performShot(s, target) {
      const w = s.weapon;
      const hit = rng() < (w.accuracy != null ? w.accuracy : 0.5);
      const ev = {
        t: timeElapsed,
        type: 'shoot',
        actorId: s.id,
        targetId: target.id,
        hit,
        // Snapshot positions for rendering bullet trail (sim is authoritative).
        ax: s.x, ay: s.laneOffsetPx,
        tx: target.x, ty: target.laneOffsetPx,
        facing: s.facing
      };
      events.push(ev);

      if (!hit) return;

      target.hp = Math.max(0, target.hp - (w.damage || 10));
      events.push({ t: timeElapsed, type: 'hit', targetId: target.id, hp: target.hp });
      if (target.hp <= 0) {
        if (target.state !== 'dead') {
          target.state = 'dead';
          target.stateT = 0;
          events.push({ t: timeElapsed, type: 'die', targetId: target.id });
        }
      } else {
        target.state = 'hurt';
        target.stateT = 0;
        target.aimed = false;
      }
    }

    function step(dt) {
      if (done) {
        endHoldT += dt;
        // still advance stateT so dead anim plays
        for (const s of all) s.stateT += dt;
        return;
      }
      timeElapsed += dt;

      // Order: by initiative desc, then stable by id. With initiative=0 for all
      // in V1, the id tiebreak keeps the loop deterministic.
      const order = all.slice().sort((a, b) => {
        if (b.initiative !== a.initiative) return b.initiative - a.initiative;
        return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
      });

      for (const s of order) {
        s.stateT += dt;

        if (s.hp <= 0) {
          if (s.state !== 'dead') { s.state = 'dead'; s.stateT = 0; }
          continue;
        }

        // Hurt lock — fully blocks any other action while playing.
        if (s.state === 'hurt') {
          if (s.stateT < animDur('hurt')) continue;
          s.state = 'idle'; s.stateT = 0;
        }

        // Aim transition — must finish before first shot.
        if (s.state === 'aim') {
          if (s.stateT < animDur('aim')) continue;
          s.aimed = true;
          s.state = 'idle'; s.stateT = 0;
        }

        s.cooldownShoot = Math.max(0, s.cooldownShoot - dt);
        s.burstCooldown = Math.max(0, s.burstCooldown - dt);

        const target = findTarget(s);
        if (!target) {
          if (s.state !== 'idle') { s.state = 'idle'; s.stateT = 0; }
          continue;
        }
        if (target.id !== s.targetId) s.aimed = false;
        s.targetId = target.id;

        const dx = target.x - s.x;
        s.facing = dx >= 0 ? 1 : -1;
        const d = Math.abs(dx);
        const w = s.weapon;
        const tooFar   = d > w.rangeMax;
        const tooClose = (w.rangeMin || 0) > 0 && d < w.rangeMin;

        if (tooFar) {
          s.aimed = false;
          if (s.state !== 'run') { s.state = 'run'; s.stateT = 0; }
          s.x += SPEED_TILES_PER_SEC * s.facing * dt;
          continue;
        }
        if (tooClose) {
          s.aimed = false;
          if (s.state !== 'run') { s.state = 'run'; s.stateT = 0; }
          s.x -= SPEED_TILES_PER_SEC * s.facing * dt;
          if (s.x < 0) s.x = 0;
          if (s.x > ARENA_TILES) s.x = ARENA_TILES;
          continue;
        }

        // In range — must aim first, then fire.
        if (!s.aimed) {
          s.state = 'aim'; s.stateT = 0;
          continue;
        }

        // Continue an in-progress burst.
        if (s.burstLeft > 0 && s.burstCooldown <= 0) {
          performShot(s, target);
          s.burstLeft--;
          if (s.burstLeft > 0) s.burstCooldown = w.recovery || 0.1;
          s.state = 'shoot'; s.stateT = 0;
          continue;
        }

        // Start a new shot/burst.
        if (s.burstLeft === 0 && s.cooldownShoot <= 0) {
          performShot(s, target);
          const burst = Math.max(1, w.burst || 1);
          s.burstLeft = burst - 1;
          s.burstCooldown = burst > 1 ? (w.recovery || 0.1) : 0;
          // Cooldown between bursts: total round-time normalised to shootSpeed.
          s.cooldownShoot = burst / Math.max(0.01, w.shootSpeed || 1);
          s.state = 'shoot'; s.stateT = 0;
          continue;
        }

        // Cooling down — let shoot anim finish, then drop to idle.
        if (s.state === 'shoot' && s.stateT >= animDur('shoot')) {
          s.state = 'idle'; s.stateT = 0;
        } else if (s.state === 'run') {
          s.state = 'idle'; s.stateT = 0;
        }
      }

      // End condition.
      const aA = alive('A');
      const aB = alive('B');
      if (aA === 0 || aB === 0) {
        done = true;
        winner = aA > 0 ? 'A' : (aB > 0 ? 'B' : 'draw');
        events.push({ t: timeElapsed, type: 'end', winner });
      }
    }

    return {
      all,
      events,
      step,
      get done() { return done; },
      get winner() { return winner; },
      get time() { return timeElapsed; },
      get endHoldT() { return endHoldT; },
      aliveCount: (team) => alive(team)
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.CombatSim = {
    loadWeaponStats,
    getWeaponStats,
    createBattle,
    DT,
    TILE_PX,
    ARENA_TILES,
    SPEED_TILES_PER_SEC,
    LANE_OFFSETS
  };

})();
