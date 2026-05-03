// Combat simulator — strict turn-based, Minitroopers-style.
//
// At any given moment ONE soldier acts. A turn is one of:
//   - move      (walk a Speed-bound distance toward/away from target)
//   - shoot     (aim if not already aimed, then fire one burst at the target)
//   - idle      (no enemies left or unreachable — short pause)
// While the active soldier animates their action, every other soldier holds
// idle (or finishes a hurt/dead anim if they were just hit).
//
// Turn order is driven by per-soldier `cooldown`: the next actor is whoever
// has the smallest cooldown. Tie-break: higher initiative, then deterministic
// id ordering. Initiative is wired in but stays at 0 in V1 (boost skills land
// later). After acting, the soldier's cooldown is pushed forward by the
// action's full duration plus a small TURN_GAP, so the next-min picker rolls
// to the next free unit.
//
// Battle is deterministic: every dice roll uses a seeded mulberry32 RNG, so
// the same `seed` produces an identical fight bit-for-bit.

(function () {

  // ── Tunables ──────────────────────────────────────────────────────────────
  const DT = 1 / 60;
  const SPEED_TILES_PER_SEC = 6;        // base movement speed
  const TILE_PX = 24;
  const ARENA_TILES = 50;
  const MOVE_STEP_TILES = 4;            // distance covered in a single move turn
  const IDLE_TURN_DURATION = 0.4;
  const TURN_GAP = 0.04;                // tiny pause between turns for readability

  const LANE_OFFSETS = { front: 0, mid: -20, back: -40 };

  // ── Weapon stats loader ───────────────────────────────────────────────────
  const statsByName = {};
  let statsLoadPromise = null;

  function loadWeaponStats() {
    if (statsLoadPromise) return statsLoadPromise;
    statsLoadPromise = fetch('./weapon-config.json')
      .then(r => r.json())
      .then(data => { for (const w of data.weapons) statsByName[w.name] = w; })
      .catch(() => {});
    return statsLoadPromise;
  }
  function getWeaponStats(name) { return statsByName[name] || null; }

  function laneForCategory(cat) {
    if (cat === 'sniper') return 'back';
    if (cat === 'rifle' || cat === 'pistol') return 'mid';
    return 'front';
  }

  function animDur(animKey) {
    const a = window.Anims && window.Anims[animKey];
    return a ? (a.frames / a.fps) : 0;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function sign(v) { return v > 0 ? 1 : (v < 0 ? -1 : 0); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

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

  // ── Combatant ─────────────────────────────────────────────────────────────
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
      cooldown: 0,            // when this soldier next gets a turn
      initiative: 0,          // boost stat (V1: always 0; ready for skills)
      aimed: false,
      lastTargetId: null,
      orderIdx: 0             // assigned below for stable tiebreak
    };
  }

  // ── Battle ────────────────────────────────────────────────────────────────
  function createBattle(opts) {
    const seedStr = opts.seed || ('battle-' + Date.now());
    const rng = mulberry32(hashStr(seedStr));

    const A = (opts.teamA && opts.teamA.soldiers || []).map((s, i) => buildCombatant(s, 'A', i));
    const B = (opts.teamB && opts.teamB.soldiers || []).map((s, i) => buildCombatant(s, 'B', i));
    const all = A.concat(B);

    // Interleave initial turn order so neither team grabs the whole opening
    // round. A0 acts first, then B0, then A1, then B1, etc.
    const max = Math.max(A.length, B.length);
    let order = 0;
    for (let i = 0; i < max; i++) {
      if (A[i]) { A[i].cooldown = order * 0.001; A[i].orderIdx = order++; }
      if (B[i]) { B[i].cooldown = order * 0.001; B[i].orderIdx = order++; }
    }

    const events = [];
    let worldT = 0;
    let current = null;
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
        if (e.team === self.team || e.hp <= 0) continue;
        const d = Math.abs(e.x - self.x);
        if (d < bestD) { best = e; bestD = d; }
      }
      return best;
    }

    function pickNextActor() {
      let best = null;
      for (const s of all) {
        if (s.hp <= 0) continue;
        if (!best) { best = s; continue; }
        if (s.cooldown < best.cooldown) { best = s; continue; }
        if (s.cooldown > best.cooldown) continue;
        if (s.initiative > best.initiative) { best = s; continue; }
        if (s.initiative < best.initiative) continue;
        if (s.orderIdx < best.orderIdx) best = s;
      }
      return best;
    }

    function planAction() {
      const aA = alive('A'), aB = alive('B');
      if (aA === 0 || aB === 0) {
        done = true;
        winner = aA > 0 ? 'A' : (aB > 0 ? 'B' : 'draw');
        events.push({ t: worldT, type: 'end', winner });
        return null;
      }

      const actor = pickNextActor();
      if (!actor) {
        done = true; winner = 'draw';
        events.push({ t: worldT, type: 'end', winner });
        return null;
      }

      // Advance world clock to actor's turn.
      if (actor.cooldown > worldT) worldT = actor.cooldown;

      const target = findTarget(actor);
      if (!target) {
        const action = {
          actorId: actor.id, type: 'idle',
          startT: worldT, duration: IDLE_TURN_DURATION
        };
        actor.cooldown = worldT + action.duration + TURN_GAP;
        return action;
      }

      // Re-aim required when target changes.
      if (actor.lastTargetId && actor.lastTargetId !== target.id) actor.aimed = false;
      actor.lastTargetId = target.id;

      const dx = target.x - actor.x;
      const d  = Math.abs(dx);
      actor.facing = dx >= 0 ? 1 : -1;
      const w = actor.weapon;
      const tooFar   = d > w.rangeMax;
      const tooClose = (w.rangeMin || 0) > 0 && d < w.rangeMin;

      // ── MOVE turn ─────────────────────────────────────────────────────────
      if (tooFar || tooClose) {
        const dir = tooFar ? sign(dx) : -sign(dx);
        // Don't overshoot past the firing window — close to rangeMax (or back
        // out to rangeMin) without flipping past it on a single step.
        let stepDist = MOVE_STEP_TILES;
        if (tooFar) {
          stepDist = Math.min(stepDist, d - w.rangeMax + 0.5);
        } else {
          stepDist = Math.min(stepDist, (w.rangeMin - d) + 0.5);
        }
        stepDist = Math.max(0.5, stepDist);
        let toX = clamp(actor.x + dir * stepDist, 0, ARENA_TILES);
        const dist = Math.abs(toX - actor.x);
        const dur = dist / SPEED_TILES_PER_SEC;
        actor.aimed = false;
        const action = {
          actorId: actor.id, type: 'move',
          startT: worldT, duration: dur,
          fromX: actor.x, toX, facing: actor.facing
        };
        action.commit = function () { actor.x = toX; };
        actor.cooldown = worldT + dur + TURN_GAP;
        return action;
      }

      // ── SHOOT turn ────────────────────────────────────────────────────────
      const burst = Math.max(1, w.burst || 1);
      const aimDur = actor.aimed ? 0 : animDur('aim');
      const shotAnim = animDur('shoot');
      const recovery = w.recovery || 0.1;

      // Pre-roll shots so the action is a self-contained, deterministic plan.
      const shots = [];
      for (let i = 0; i < burst; i++) {
        shots.push({
          atT: aimDur + i * recovery,        // local time within the turn
          hit: rng() < (w.accuracy != null ? w.accuracy : 0.5)
        });
      }
      const lastShotT = shots[shots.length - 1].atT;
      const duration = lastShotT + shotAnim;

      const action = {
        actorId: actor.id, targetId: target.id,
        type: 'shoot',
        startT: worldT, duration,
        aimDur, shots, shotsFired: 0,
        facing: actor.facing,
        damage: w.damage,
        ax: actor.x, ay: actor.laneOffsetPx,
        tx: target.x, ty: target.laneOffsetPx
      };
      actor.aimed = true;
      actor.cooldown = worldT + duration + TURN_GAP;
      return action;
    }

    function step(dt) {
      if (done) {
        endHoldT += dt;
        for (const s of all) if (s.state === 'dead') s.stateT += dt;
        return;
      }

      if (!current) {
        current = planAction();
        if (!current) return;
        current.elapsed = 0;
        const actor = all.find(s => s.id === current.actorId);
        // Reset everyone non-actor to idle if they're not in hurt/dead.
        for (const s of all) {
          if (s.id === current.actorId) continue;
          if (s.state === 'hurt' || s.state === 'dead') continue;
          s.state = 'idle';  // stateT keeps cycling so idle keeps breathing
        }
        // Initialize actor anim
        if (current.type === 'move') {
          actor.state = 'run'; actor.stateT = 0;
          actor.facing = current.facing;
        } else if (current.type === 'shoot') {
          actor.facing = current.facing;
          if (current.aimDur > 0) { actor.state = 'aim'; actor.stateT = 0; }
          else { actor.state = 'shoot'; actor.stateT = 0; }
        } else {
          actor.state = 'idle';
        }
        events.push({ t: worldT, type: 'turn', actorId: current.actorId, action: current.type });
      }

      current.elapsed += dt;
      const a = current;
      const actor = all.find(s => s.id === a.actorId);
      if (!actor) { current = null; return; }

      // ── Drive the actor's animation per action type ─────────────────────
      if (a.type === 'move') {
        const t = clamp(a.elapsed / a.duration, 0, 1);
        actor.x = lerp(a.fromX, a.toX, t);
        actor.facing = a.facing;
        if (actor.state !== 'run') { actor.state = 'run'; actor.stateT = 0; }
        else actor.stateT += dt;
      } else if (a.type === 'shoot') {
        actor.facing = a.facing;
        // Fire any shots whose scheduled local time has arrived.
        while (a.shotsFired < a.shots.length && a.elapsed >= a.shots[a.shotsFired].atT) {
          const shot = a.shots[a.shotsFired++];
          const target = all.find(s => s.id === a.targetId);
          if (target) {
            events.push({
              t: worldT + a.elapsed, type: 'shoot',
              actorId: a.actorId, targetId: a.targetId,
              ax: actor.x, ay: actor.laneOffsetPx,
              tx: target.x, ty: target.laneOffsetPx,
              hit: shot.hit
            });
            if (shot.hit && target.hp > 0) {
              target.hp = Math.max(0, target.hp - a.damage);
              if (target.hp <= 0) {
                target.state = 'dead'; target.stateT = 0;
                events.push({ t: worldT + a.elapsed, type: 'die', targetId: target.id });
              } else {
                target.state = 'hurt'; target.stateT = 0;
                events.push({ t: worldT + a.elapsed, type: 'hit', targetId: target.id, hp: target.hp });
              }
            }
          }
          // Restart shoot anim on every shot so the muzzle flash plays each time.
          actor.state = 'shoot'; actor.stateT = 0;
        }

        if (a.elapsed < a.aimDur) {
          if (actor.state !== 'aim') { actor.state = 'aim'; actor.stateT = a.elapsed; }
          else actor.stateT = a.elapsed; // sync to absolute action time
        } else if (actor.state === 'aim') {
          actor.state = 'shoot'; actor.stateT = 0;
        } else if (actor.state === 'shoot') {
          actor.stateT += dt;
        }
      } else if (a.type === 'idle') {
        if (actor.state !== 'idle') { actor.state = 'idle'; actor.stateT = 0; }
        else actor.stateT += dt;
      }

      // ── Drive every non-actor's anim ────────────────────────────────────
      for (const s of all) {
        if (s.id === a.actorId) continue;
        if (s.state === 'dead') { s.stateT += dt; continue; }
        if (s.state === 'hurt') {
          s.stateT += dt;
          if (s.stateT >= animDur('hurt')) { s.state = 'idle'; s.stateT = 0; }
          continue;
        }
        // Idle keeps cycling.
        if (s.state !== 'idle') { s.state = 'idle'; s.stateT = 0; }
        else s.stateT += dt;
      }

      if (a.elapsed >= a.duration) {
        if (typeof a.commit === 'function') a.commit();
        worldT = a.startT + a.duration;
        current = null;
      }
    }

    return {
      all,
      events,
      step,
      get done() { return done; },
      get winner() { return winner; },
      get time() { return worldT; },
      get endHoldT() { return endHoldT; },
      get currentAction() { return current; },
      aliveCount: (team) => alive(team)
    };
  }

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
