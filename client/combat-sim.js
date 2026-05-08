// Combat simulator â€” semi-simultaneous, Minitroopers-style.
//
// At any given moment one or two soldiers can act. An action is one of:
//   - move      (walk a Speed-bound distance toward/away from target)
//   - shoot     (aim if not already aimed, then fire one burst at the target)
//   - idle      (no enemies left or unreachable â€” short pause)
// While active soldiers animate their actions, every other soldier holds idle
// (or finishes a hurt/dead anim if they were just hit).
//
// Turn order is driven by per-soldier `cooldown`: the next actor is whoever
// has the smallest cooldown. Tie-break: higher initiative, then deterministic
// id ordering. Initiative is wired in but stays at 0 in V1 (boost skills land
// later). After planning an action, the soldier's cooldown is pushed forward by
// the action's full duration plus a small TURN_GAP. The scheduler sometimes
// lets a second ready actor start before the first action finishes.
//
// Battle is deterministic: every dice roll uses a seeded mulberry32 RNG, so
// the same `seed` produces an identical fight bit-for-bit.

(function () {

  // â”€â”€ Tunables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const DT = 1 / 60;
  const SPEED_TILES_PER_SEC = 6;        // base movement speed
  const TILE_PX = 24;
  const ARENA_TILES = 50;
  const MOVE_STEP_TILES = 4;            // distance covered in a single move turn
  const IDLE_TURN_DURATION = 0.4;
  const TURN_GAP = 0.04;                // tiny pause between turns for readability
  const MAX_ACTIVE_ACTIONS = 2;         // Minitroopers-like overlaps, but never a full scrum
  const OVERLAP_CHANCE = 0.35;
  const AIM_OVERLAP_CHANCE = 0.40;
  const OVERLAP_RETRY_DELAY = 0.28;

  const LANE_OFFSETS = { front: 0, mid: -80, back: -180 };
  // Per-soldier Y spread within a lane so soldiers don't stack on one line.
  const LANE_Y_SPREAD = [0, 12, -12, 22, -22, 6, -6];
  const SPAWN_Y_MIN = LANE_OFFSETS.back + Math.min.apply(null, LANE_Y_SPREAD);
  const SPAWN_Y_MAX = LANE_OFFSETS.front + Math.max.apply(null, LANE_Y_SPREAD);
  const SPAWN_Y_CENTER = (SPAWN_Y_MIN + SPAWN_Y_MAX) / 2;
  const FORMATION_FULL_SIZE = 8;
  const FORMATION_Y_JITTER = 7;
  const ENTRY_DELAY_MAX = 0.72;
  const ENTRY_DELAY_STEP = 0.08;
  const ENTRY_DELAY_RANDOM = 0.18;
  const ENTRY_CLOSE_LINE_PX = 34;
  const ENTRY_DIST = 4;               // tiles each soldier runs from off-screen to their spawn
  const SPAWN_EDGE_GUTTER = 0.1;       // nearest spawn stays right next to the side
  const SPAWN_SPACING_TILES = 0.9;     // horizontal spacing between spawn slots
  const SOLO_SPAWN_FROM_EDGE = 2.2;    // a lone soldier is centered in its small side area
  const LANE_RANK = { back: 0, mid: 1, front: 2 };
  const BODY_PARTS = ['head', 'chestLeft', 'chestRight', 'abdomen', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'torso'];
  const BODY_PART_WEIGHTS = [
    { key: 'head', weight: 7 },
    { key: 'chestLeft', weight: 18 },
    { key: 'chestRight', weight: 18 },
    { key: 'abdomen', weight: 14 },
    { key: 'leftArm', weight: 8 },
    { key: 'rightArm', weight: 8 },
    { key: 'leftLeg', weight: 7 },
    { key: 'rightLeg', weight: 7 }
  ];

  // â”€â”€ Weapon stats loader â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const statsByName = {};

  function loadWeaponStats() {
    return fetch('./weapon-config.json?ts=' + Date.now(), { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        for (const key of Object.keys(statsByName)) delete statsByName[key];
        for (const w of data.weapons) statsByName[w.name] = w;
      })
      .catch(() => {});
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

  function emptyBodyHits() {
    const hits = {};
    for (const p of BODY_PARTS) hits[p] = 0;
    return hits;
  }

  function rollHitPart(rng) {
    const total = BODY_PART_WEIGHTS.reduce((sum, p) => sum + p.weight, 0);
    let roll = (rng ? rng() : Math.random()) * total;
    for (const p of BODY_PART_WEIGHTS) {
      roll -= p.weight;
      if (roll <= 0) return p.key;
    }
    return 'abdomen';
  }

  function rollDamage(stats, rng) {
    const rawMin = stats && stats.damageMin != null ? stats.damageMin : (stats && stats.damage != null ? stats.damage : 1);
    const rawMax = stats && stats.damageMax != null ? stats.damageMax : (stats && stats.damage != null ? stats.damage : rawMin);
    const min = Math.max(0, Math.floor(Math.min(rawMin, rawMax)));
    const max = Math.max(min, Math.floor(Math.max(rawMin, rawMax)));
    if (max <= min) return min;
    return min + Math.floor((rng ? rng() : Math.random()) * (max - min + 1));
  }

  function burstCount(stats) {
    return Math.max(1, Math.round(stats && stats.burst || 1));
  }

  function shotInterval(stats, count) {
    if (count <= 1) return 0;
    const bySpeed = stats && stats.shootSpeed > 0 ? 1 / stats.shootSpeed : null;
    const byRecovery = stats && stats.recovery > 0 ? stats.recovery : 0.16;
    return clamp(Math.min(bySpeed || byRecovery, byRecovery), 0.07, 0.85);
  }

  function shotProfileKey(stats) {
    if (!stats) return 'pistol';
    if (stats.category === 'sniper') return 'sniper';
    if (stats.category === 'shotgun') return 'shotgun';
    if (stats.category === 'heavy') return 'heavy';
    if (stats.weaponType === 'automatic') return 'auto';
    if (stats.weaponType === 'burst') return 'burst';
    if (stats.category === 'pistol') return 'pistol';
    return 'auto';
  }

  function spawnXFor(team, idxInTeam, teamSize) {
    const n = Math.max(1, teamSize || 1);
    const fromEdge = n === 1
      ? SOLO_SPAWN_FROM_EDGE
      : SPAWN_EDGE_GUTTER + idxInTeam * SPAWN_SPACING_TILES;
    return team === 'A' ? fromEdge : ARENA_TILES - fromEdge;
  }

  // â”€â”€ RNG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Combatant â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function defaultStats() {
    return {
      name: 'Glock 17', category: 'pistol', weaponType: 'semi_auto',
      damage: 2, damageMin: 1, damageMax: 2, accuracy: 0.5, shootSpeed: 2, burst: 1,
      recovery: 0.2, rangeMin: 1, rangeMax: 10
    };
  }

  function assignTeamFormation(team, rng) {
    const n = team.length;
    if (!n) return;
    if (n === 1) {
      team[0].laneOffsetPx = SPAWN_Y_CENTER;
      team[0].entryDelay = 0;
      return;
    }

    const sorted = team.slice().sort((a, b) => {
      const byLane = (LANE_RANK[a.lane] || 0) - (LANE_RANK[b.lane] || 0);
      if (byLane) return byLane;
      return a.formationRoll - b.formationRoll;
    });

    const fullSpan = SPAWN_Y_MAX - SPAWN_Y_MIN;
    const spanK = n <= 1 ? 0 : Math.min(1, (n - 1) / (FORMATION_FULL_SIZE - 1));
    const usedSpan = fullSpan * spanK;
    const yMin = SPAWN_Y_CENTER - usedSpan / 2;
    const yMax = SPAWN_Y_CENTER + usedSpan / 2;

    for (let i = 0; i < sorted.length; i++) {
      const t = n <= 1 ? 0.5 : i / (n - 1);
      const baseY = lerp(yMin, yMax, t);
      const jitter = n <= 1 ? 0 : (rng() - 0.5) * FORMATION_Y_JITTER * 2;
      sorted[i].laneOffsetPx = clamp(baseY + jitter, SPAWN_Y_MIN, SPAWN_Y_MAX);
    }

    const byLine = team.slice().sort((a, b) => a.laneOffsetPx - b.laneOffsetPx);
    const lineGroups = new Map();
    for (let i = 0; i < byLine.length; i++) {
      let closeBefore = 0;
      for (let j = i - 1; j >= 0; j--) {
        if (byLine[i].laneOffsetPx - byLine[j].laneOffsetPx > ENTRY_CLOSE_LINE_PX) break;
        closeBefore++;
      }
      lineGroups.set(byLine[i].id, closeBefore);
    }

    const byEntry = team.slice().sort((a, b) => a.entryRoll - b.entryRoll);
    for (let i = 0; i < byEntry.length; i++) {
      const waveDelay = i * ENTRY_DELAY_STEP;
      const lineDelay = (lineGroups.get(byEntry[i].id) || 0) * 0.04;
      byEntry[i].entryDelay = Math.min(ENTRY_DELAY_MAX, waveDelay + lineDelay + rng() * ENTRY_DELAY_RANDOM);
    }
  }

  function buildCombatant(soldier, team, idxInTeam, teamSize, rng) {
    const level = soldier.level || 1;
    const hpMax = 10 + 2 * (level - 1);
    const weaponName = soldier.preferredWeapon || soldier.skill1Name || 'Glock 17';
    const stats = getWeaponStats(weaponName) || defaultStats();
    const lane = laneForCategory(stats.category);
    // Keep the nearest spawn at the side, then fan larger squads toward center
    // so the entry reads as a formation instead of a single column.
    const xSpawn = spawnXFor(team, idxInTeam, teamSize);
    const xEntry = team === 'A' ? -ENTRY_DIST : ARENA_TILES + ENTRY_DIST;
    // Per-soldier Y offset within the lane so many soldiers in the same lane
    // don't all share one ground line.
    const laneOffsetPx = LANE_OFFSETS[lane] + LANE_Y_SPREAD[idxInTeam % LANE_Y_SPREAD.length];

    return {
      id: (soldier.id || 'sld') + ':' + team + ':' + idxInTeam,
      name: soldier.name,
      level,
      team,
      cfg: soldier.config,
      skill1Name: soldier.skill1Name || null,
      skill2Name: soldier.skill2Name || null,
      unlockedWeapons: Array.isArray(soldier.unlockedWeapons) ? soldier.unlockedWeapons.slice() : null,
      preferredWeapon: soldier.preferredWeapon || null,
      weaponName,
      weapon: stats,
      bodyHits: emptyBodyHits(),
      lane,
      laneOffsetPx,
      hp: hpMax,
      hpMax,
      x: xEntry,
      xSpawn,
      facing: team === 'A' ? 1 : -1,
      state: 'idle',
      stateT: 0,
      animState: null,
      cooldown: 0,            // when this soldier next gets a turn
      initiative: 0,          // boost stat (V1: always 0; ready for skills)
      aimed: false,
      lastTargetId: null,
      formationRoll: rng ? rng() : 0,
      entryRoll: rng ? rng() : 0,
      entryDelay: 0,
      orderIdx: 0             // assigned below for stable tiebreak
    };
  }

  // â”€â”€ Battle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function createBattle(opts) {
    const seedStr = opts.seed || ('battle-' + Date.now());
    const rng = mulberry32(hashStr(seedStr));

    const teamASoldiers = (opts.teamA && opts.teamA.soldiers || []);
    const teamBSoldiers = (opts.teamB && opts.teamB.soldiers || []);
    const A = teamASoldiers.map((s, i) => buildCombatant(s, 'A', i, teamASoldiers.length, rng));
    const B = teamBSoldiers.map((s, i) => buildCombatant(s, 'B', i, teamBSoldiers.length, rng));
    assignTeamFormation(A, rng);
    assignTeamFormation(B, rng);
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
    let activeActions = [];
    let done = false;
    let winner = null;
    let endHoldT = 0;
    let phase = 'entry';  // 'entry' â†’ all run in simultaneously; 'combat' â†’ turn-based
    let entryT = 0;
    let overlapRetryT = 0;

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
        if (s.cooldown > worldT) continue;
        if (activeActions.some(a => a.actorId === s.id)) continue;
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
        return null;
      }

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

      // â”€â”€ MOVE turn â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (tooFar || tooClose) {
        const dir = tooFar ? sign(dx) : -sign(dx);
        // Don't overshoot past the firing window â€” close to rangeMax (or back
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

      // â”€â”€ SHOOT turn â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const burst = burstCount(w);
      const hitChance = w.accuracy != null ? w.accuracy : 0.5;
      const aimDur = actor.aimed ? 0 : animDur('aim');
      const shotAnim = animDur('shoot');
      const unAimDur = animDur('unaim');
      const interval = shotInterval(w, burst);
      const recovery = Math.max(shotAnim, w.recovery || 0.1);
      const shotProfile = shotProfileKey(w);

      // Pre-roll shots so the action is a self-contained, deterministic plan.
      const shots = [];
      for (let i = 0; i < burst; i++) {
        const hit = rng() < hitChance;
        shots.push({
          atT: aimDur + i * interval,        // local time within the turn
          index: i,
          hit,
          part: hit ? rollHitPart(rng) : null,
          damage: hit ? rollDamage(w, rng) : 0
        });
      }
      const lastShotT = shots[shots.length - 1].atT;
      const unaimStartT = lastShotT + recovery;
      const duration = unaimStartT + unAimDur;

      const action = {
        actorId: actor.id, targetId: target.id,
        type: 'shoot',
        startT: worldT, duration,
        aimDur, shots, shotsFired: 0,
        shotProfile,
        weaponCategory: w.category,
        weaponType: w.weaponType,
        unaimStartT,
        facing: actor.facing,
        ax: actor.x, ay: actor.laneOffsetPx,
        tx: target.x, ty: target.laneOffsetPx
      };
      actor.aimed = true;
      actor.cooldown = worldT + duration + TURN_GAP;
      return action;
    }

    // Entry phase: all soldiers run simultaneously from off-screen to their
    // spawn positions, then the phase switches to turn-based combat.
    function stepEntry(dt) {
      entryT += dt;
      let allArrived = true;
      for (const s of all) {
        if (entryT < s.entryDelay) {
          allArrived = false;
          s.facing = s.team === 'A' ? 1 : -1;
          if (s.state !== 'idle') { s.state = 'idle'; s.stateT = 0; }
          else s.stateT += dt;
          continue;
        }

        const dx = s.xSpawn - s.x;
        const dist = Math.abs(dx);
        if (dist < 0.1) {
          s.x = s.xSpawn;
          if (s.state !== 'idle') { s.state = 'idle'; s.stateT = 0; }
          else s.stateT += dt;
        } else {
          allArrived = false;
          const dir = dx > 0 ? 1 : -1;
          s.x += dir * Math.min(dist, SPEED_TILES_PER_SEC * dt);
          s.facing = dir;
          if (s.state !== 'run') { s.state = 'run'; s.stateT = 0; }
          else s.stateT += dt;
        }
      }
      if (allArrived) {
        phase = 'combat';
        for (const s of all) { s.state = 'idle'; s.stateT = 0; }
      }
    }

    function hasAimInProgress() {
      return activeActions.some(a => a.type === 'shoot' && a.elapsed < a.aimDur);
    }

    function finishBattleIfNeeded() {
      const aA = alive('A'), aB = alive('B');
      if (aA > 0 && aB > 0) return false;
      done = true;
      winner = aA > 0 ? 'A' : (aB > 0 ? 'B' : 'draw');
      activeActions = [];
      events.push({ t: worldT, type: 'end', winner });
      return true;
    }

    function startAction(action) {
      action.elapsed = 0;
      const actor = all.find(s => s.id === action.actorId);
      if (!actor || actor.hp <= 0) return false;

      if (action.type === 'move') {
        actor.state = 'run'; actor.stateT = 0;
        actor.animState = null;
        actor.facing = action.facing;
      } else if (action.type === 'shoot') {
        actor.facing = action.facing;
        actor.animState = null;
        if (action.aimDur > 0) { actor.state = 'aim'; actor.stateT = 0; }
        else { actor.state = 'shoot'; actor.stateT = 0; }
      } else {
        actor.state = 'idle';
        actor.animState = null;
      }

      activeActions.push(action);
      events.push({ t: worldT, type: 'turn', actorId: action.actorId, action: action.type });
      return true;
    }

    function scheduleActions() {
      while (!done && activeActions.length < MAX_ACTIVE_ACTIONS) {
        if (activeActions.length > 0) {
          if (worldT < overlapRetryT) return;
          const chance = hasAimInProgress() ? AIM_OVERLAP_CHANCE : OVERLAP_CHANCE;
          if (rng() >= chance) {
            overlapRetryT = worldT + OVERLAP_RETRY_DELAY;
            return;
          }
        }

        const action = planAction();
        if (!action) return;
        startAction(action);
      }
    }

    function driveAction(a, dt, completed) {
      a.elapsed += dt;
      const actor = all.find(s => s.id === a.actorId);
      if (!actor || actor.hp <= 0) { completed.add(a); return; }

      if (a.type === 'move') {
        const t = clamp(a.elapsed / a.duration, 0, 1);
        actor.x = lerp(a.fromX, a.toX, t);
        actor.facing = a.facing;
        if (actor.state !== 'run') { actor.state = 'run'; actor.stateT = 0; }
        else actor.stateT += dt;
      } else if (a.type === 'shoot') {
        actor.facing = a.facing;
        while (a.shotsFired < a.shots.length && a.elapsed >= a.shots[a.shotsFired].atT) {
          const shot = a.shots[a.shotsFired++];
          const target = all.find(s => s.id === a.targetId);
          actor.animState = {
            shotProfile: a.shotProfile,
            weaponCategory: a.weaponCategory,
            weaponType: a.weaponType,
            shotIndex: shot.index,
            shotCount: a.shots.length
          };
          if (target && target.hp > 0) {
            const bodyPart = shot.part || 'torso';
            events.push({
              t: worldT, type: 'shoot',
              actorId: a.actorId, targetId: a.targetId,
              ax: actor.x, ay: actor.laneOffsetPx,
              tx: target.x, ty: target.laneOffsetPx,
              shotIndex: shot.index,
              shotCount: a.shots.length,
              weaponName: actor.weaponName,
              weaponCategory: a.weaponCategory,
              weaponType: a.weaponType,
              shotProfile: a.shotProfile,
              facing: actor.facing,
              hit: shot.hit,
              bodyPart: shot.hit ? bodyPart : null,
              damage: shot.hit ? shot.damage : 0
            });
            if (shot.hit) {
              target.bodyHits[bodyPart] = Math.min(2, (target.bodyHits[bodyPart] || 0) + 1);
              target.hp = Math.max(0, target.hp - shot.damage);
              if (target.hp <= 0) {
                target.state = 'dead'; target.stateT = 0;
                events.push({ t: worldT, type: 'die', targetId: target.id, bodyPart, damage: shot.damage });
              } else {
                target.state = 'hurt'; target.stateT = 0;
                events.push({
                  t: worldT, type: 'hit',
                  targetId: target.id, hp: target.hp,
                  bodyPart,
                  damage: shot.damage,
                  bodyHits: Object.assign({}, target.bodyHits)
                });
              }
            }
          }
          actor.state = 'shoot'; actor.stateT = 0;
        }

        if (a.elapsed < a.aimDur) {
          if (actor.state !== 'aim') { actor.state = 'aim'; actor.stateT = a.elapsed; }
          else actor.stateT = a.elapsed;
        } else if (a.elapsed >= a.unaimStartT) {
          actor.animState = {
            shotProfile: a.shotProfile,
            weaponCategory: a.weaponCategory,
            weaponType: a.weaponType
          };
          actor.state = 'unaim';
          actor.stateT = a.elapsed - a.unaimStartT;
        } else if (actor.state === 'aim') {
          actor.state = 'shoot'; actor.stateT = 0;
        } else if (actor.state === 'shoot') {
          actor.stateT += dt;
        }
      } else if (a.type === 'idle') {
        if (actor.state !== 'idle') { actor.state = 'idle'; actor.stateT = 0; }
        else actor.stateT += dt;
      }

      if (a.elapsed >= a.duration) {
        if (typeof a.commit === 'function') a.commit();
        if (a.type === 'shoot') {
          actor.aimed = false;
          actor.animState = null;
        }
        completed.add(a);
      }
    }

    function driveInactiveAnimations(dt) {
      const activeIds = new Set(activeActions.map(a => a.actorId));
      for (const s of all) {
        if (activeIds.has(s.id)) continue;
        if (s.state === 'dead') { s.stateT += dt; continue; }
        if (s.state === 'hurt') {
          s.stateT += dt;
          if (s.stateT >= animDur('hurt')) { s.state = 'idle'; s.stateT = 0; }
          continue;
        }
        if (s.state === 'unaim') {
          s.stateT += dt;
          if (s.stateT >= animDur('unaim')) { s.state = 'idle'; s.stateT = 0; s.animState = null; }
          continue;
        }
        if (s.state !== 'idle') { s.state = 'idle'; s.stateT = 0; s.animState = null; }
        else s.stateT += dt;
      }
    }

    function stepConcurrent(dt) {
      if (phase === 'entry') { stepEntry(dt); return; }
      if (done) {
        endHoldT += dt;
        for (const s of all) if (s.state === 'dead') s.stateT += dt;
        return;
      }

      worldT += dt;
      scheduleActions();

      const completed = new Set();
      for (const a of activeActions.slice()) driveAction(a, dt, completed);
      activeActions = activeActions.filter(a => !completed.has(a));
      driveInactiveAnimations(dt);
      finishBattleIfNeeded();
    }

    function step(dt) {
      stepConcurrent(dt);
    }

    return {
      all,
      events,
      step,
      get phase() { return phase; },
      get done() { return done; },
      get winner() { return winner; },
      get time() { return worldT; },
      get endHoldT() { return endHoldT; },
      get currentAction() { return activeActions[0] || null; },
      get activeActions() { return activeActions.slice(); },
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
    LANE_OFFSETS,
    BODY_PARTS
  };

})();
