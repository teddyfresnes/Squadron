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
  const AIM_DELAY_MIN = 0.38;           // minimum aim-up duration (covers short aim anims)
  const AIM_HOLD = 0.18;                // pause after aim anim ends, before first shot

  // â”€â”€ Rocket launcher tunables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Bazooka-class heavy weapons fire a single visible rocket with a smoke
  // trail. Hits explode at the target's feet and toss every nearby enemy up
  // via the deadExplode animation; misses fly past and exit the arena.
  const ROCKET_TRAVEL_T = 0.35;         // sim-time the rocket spends in the air (fast & straight, hard to read hit-vs-miss in flight)
  const ROCKET_AOE_TILES = 3;           // X-distance from impact for the AoE
  const ROCKET_AOE_Y_PX = 55;           // Y-distance (laneOffsetPx) from impact — keeps the blast in the impact lane (lane spacing is 80–100 px)
  const ROCKET_RECOVERY_T = 0.18;       // pause between impact and unaim
  const ROCKET_TOSS_DMG_MIN = 1;        // fall damage rolled when a tossed body lands
  const ROCKET_TOSS_DMG_MAX = 6;
  const TOSS_LAND_FRAME = 11;           // deadExplode frame where the body hits the ground

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
        const statsList = window.Weapons && window.Weapons.expandWeaponStats
          ? window.Weapons.expandWeaponStats(data)
          : (data.weapons || []);
        for (const w of statsList) {
          statsByName[w.name] = w;
          statsByName[w.id] = w;
          if (Array.isArray(w.aliases)) {
            for (const alias of w.aliases) statsByName[alias] = w;
          }
        }
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

  function magSizeFor(stats) {
    return Math.max(1, Math.round((stats && stats.magazineSize) || 1));
  }
  // Visual cap for the reserve: the reserve row must never be wider than the
  // main magazine row. Slot stride is 5 px on the mag row vs 3 px on the
  // reserve row, so the reserve fits floor(5 * mag / 3) bullets at most.
  function reserveDisplayCap(magSize) {
    return Math.max(0, Math.floor((5 * Math.max(1, magSize)) / 3));
  }
  function reserveCapFor(stats) {
    const declared = Math.max(0, Math.round((stats && stats.reserveAmmo) || 0));
    return Math.min(declared, reserveDisplayCap(magSizeFor(stats)));
  }
  function resolveAmmoLimits(name) {
    const stats = getWeaponStats(name);
    if (!stats) return { magSize: 0, reserveCap: 0 };
    return { magSize: magSizeFor(stats), reserveCap: reserveCapFor(stats) };
  }

  // Initial ammo: magazine and reserve are rolled independently so each respects
  // its own [min, cap-1] range — there is always at least one empty slot in the
  // magazine (never quite full) and at least one round chambered (never empty).
  // The reserve uses the same "never full" rule but is allowed to be empty.
  function rollInitialAmmo(stats, rng) {
    const mag = magSizeFor(stats);
    const reserveCap = reserveCapFor(stats);
    const roll = rng || Math.random;
    // Magazine: 1 (or magSize if magSize==1) up to magSize-1.
    const loadedMin = Math.min(1, mag);
    const loadedMax = Math.max(loadedMin, mag - 1);
    const loaded = loadedMin + Math.floor(roll() * (loadedMax - loadedMin + 1));
    // Reserve: 0 up to reserveCap-1. (0 when reserveCap is 0 or 1.)
    let reserve = 0;
    if (reserveCap > 0) {
      const reserveMax = Math.max(0, reserveCap - 1);
      reserve = Math.floor(roll() * (reserveMax + 1));
    }
    return { loaded: loaded, reserve: reserve };
  }

  function weaponIdxForName(name) {
    const list = window.Weapons && window.Weapons.list;
    if (!list || !name) return -1;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (!w) continue;
      if (w.name === name || w.id === name) return i;
      if (Array.isArray(w.aliases) && w.aliases.indexOf(name) !== -1) return i;
    }
    return -1;
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
      name: 'Glok 17', category: 'pistol', weaponType: 'semi_auto',
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
    const unlockedWeapons = [];
    function addWeaponName(name) {
      const value = typeof name === 'string'
        ? name
        : (name && (name.name || name.id)) || null;
      if (value && !unlockedWeapons.includes(value)) unlockedWeapons.push(value);
    }
    if (Array.isArray(soldier.unlockedWeapons)) {
      soldier.unlockedWeapons.forEach(addWeaponName);
    }
    addWeaponName(soldier.skill1Name);
    addWeaponName(soldier.skill2Name);
    addWeaponName(soldier.preferredWeapon);
    const weaponName = soldier.preferredWeapon || soldier.skill1Name || unlockedWeapons[0] || 'Glock 17';
    const stats = getWeaponStats(weaponName) || defaultStats();
    const lane = laneForCategory(stats.category);
    // Roll ammo for every weapon this soldier can carry. Equipped weapon is
    // guaranteed at least 1 in the magazine so combat starts immediately.
    const ammo = {};
    for (const name of unlockedWeapons) {
      const wStats = getWeaponStats(name);
      if (!wStats) continue;
      ammo[name] = rollInitialAmmo(wStats, rng);
    }
    if (!ammo[weaponName]) {
      ammo[weaponName] = rollInitialAmmo(stats, rng);
    }
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
      skill1Name: soldier.skill1Name || unlockedWeapons[0] || null,
      skill2Name: soldier.skill2Name || unlockedWeapons.find(name => name !== (soldier.skill1Name || unlockedWeapons[0])) || null,
      unlockedWeapons,
      preferredWeapon: soldier.preferredWeapon || null,
      weaponName,
      weapon: stats,
      ammo,
      outOfAmmo: false,
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

    // Pick which death animation variant a kill should play. Explosive heavy
    // launchers send the body upward; impact weapons still project it back;
    // lighter weapons and melee fall back cleanly.
    function isLauncherLike(weaponStats) {
      if (!weaponStats) return false;
      const text = [
        weaponStats.id,
        weaponStats.name,
        weaponStats.weaponType
      ].concat(weaponStats.aliases || []).filter(Boolean).join(' ').toLowerCase();
      return /launcher|grenade|lobber|rpg|at4|at5|stinger|stingar|gustaf|gustov|mgl|m202|flare|toob|tube|cannon|recoilless|recoillite/.test(text);
    }

    function pickDeadVariant(weaponStats) {
      if (!weaponStats) return 'fall';
      const cat = weaponStats.category;
      if ((cat === 'heavy' && weaponStats.weaponType !== 'automatic') || isLauncherLike(weaponStats)) return 'explode';
      if (cat === 'shotgun' || cat === 'heavy') return 'project';
      if (cat === 'sniper' && (weaponStats.damageMax || 0) >= 6) return 'project';
      return 'fall';
    }

    // Fall damage rolled when a tossed body lands. Damage is in [1, 6] but
    // the distribution is biased by `heightRatio` ∈ [0, 1]:
    //   - heightRatio = 0 (tiny pop)  → heavily biased toward 1-2, 6 nearly impossible
    //   - heightRatio = 1 (big launch) → heavily biased toward 5-6, 1 nearly impossible
    // Implemented via a clipped beta-ish skew: draw two rolls and blend
    // them based on the ratio so the curve shifts smoothly.
    function rollFallDamage(r, heightRatio) {
      const min = ROCKET_TOSS_DMG_MIN;
      const max = ROCKET_TOSS_DMG_MAX;
      const span = max - min;
      // Bias: low ratio → take min-of-rolls (skew low). High ratio → take
      // max-of-rolls (skew high). Mid → average them (uniform-ish).
      const a = r();
      const b = r();
      const low = Math.min(a, b);
      const high = Math.max(a, b);
      const mid = (a + b) * 0.5;
      let blended;
      if (heightRatio <= 0.5) {
        // ramp from pure-low at 0 to mid-blend at 0.5
        const k = heightRatio / 0.5;
        blended = lerp(low, mid, k);
      } else {
        const k = (heightRatio - 0.5) / 0.5;
        blended = lerp(mid, high, k);
      }
      return min + Math.floor(blended * (span + 1 - 1e-9));
    }

    // Bazooka-class weapons: launcher silhouette (RPG, AT4, Carl Gustaf,
    // grenade launchers, MGL, Stinger, etc) but NOT beam weapons like the
    // Lazor Cannon — they don't fire a physical rocket with a smoke trail.
    function isRocketLauncher(weaponStats) {
      if (!weaponStats) return false;
      if (weaponStats.category !== 'heavy') return false;
      if (weaponStats.weaponType === 'automatic') return false;
      const text = [weaponStats.id, weaponStats.name]
        .concat(weaponStats.aliases || []).filter(Boolean).join(' ').toLowerCase();
      if (/lazor|laser|beam/.test(text)) return false;
      return isLauncherLike(weaponStats);
    }

    // Switch a soldier into the airborne `tossed` state: they play the
    // deadExplode anim (launch -> peak -> fall -> ground bounce) and then
    // either die or wake up depending on the rolled fall damage. Any active
    // shooter/reload/move action on them is aborted in place so they don't
    // keep firing while flying.
    function tossSoldier(s, impactX, rngFn) {
      if (!s || s.hp <= 0) return;
      const r = rngFn || rng;
      // Toss height: most blasts lift bodies a normal amount, but a chunky
      // tail of rolls send them WAY up. Triangular distribution biased to
      // 0.8 with a long tail to ~3.0 of the deadExplode arc height.
      // Using max-of-2 rng to bias low, then a 20% kicker that adds a big
      // bonus so the body sometimes goes spectacularly high.
      const baseRoll = Math.min(r(), r());            // bias toward smaller values
      let height = 0.55 + baseRoll * 1.35;             // [0.55, 1.9]
      if (r() < 0.20) height += 0.4 + r() * 1.4;       // 20% chance to add a "kicker" -> up to ~3.7
      // Fall damage scales with height: a tiny pop should mostly tickle for
      // 1-2, a big launch should mostly hurt for 5-6. We bias the [1,6]
      // roll by interpolating between two triangular distributions weighted
      // by a height ratio in [0, 1].
      // heightRatio: 0 at height=0.55 (min toss) -> 1 at height=3.5 (very high).
      const heightRatio = clamp((height - 0.55) / (3.5 - 0.55), 0, 1);
      const damage = rollFallDamage(r, heightRatio);
      // Knock the body horizontally — usually AWAY from the blast, but 35 %
      // of the time it kicks the body the OTHER way (concussion pinwheel)
      // and mirrors the facing so the animation reads as the body spinning
      // 180° before launching. Distance is widely scattered so survivors
      // don't all wake up in a clean ring around the impact.
      let knockDir = s.x >= impactX ? 1 : -1;
      if (r() < 0.35) {
        knockDir *= -1;
        s.facing *= -1;
      }
      const knockTiles = (0.25 + r() * r() * 2.4) * knockDir;
      s.state = 'tossed';
      s.stateT = 0;
      s.aimed = false;
      s.reloadProgress = null;
      s.animState = {
        toss: {
          damage,
          height,
          heightRatio,
          knockFromX: s.x,
          knockToX: clamp(s.x + knockTiles, 0.5, ARENA_TILES - 0.5),
          landed: false
        }
      };
      // Cancel whatever this soldier was doing — they're airborne now.
      for (const a of activeActions) {
        if (a.actorId === s.id) {
          a.aborted = true;
          a.duration = a.elapsed;
        }
      }
      const tossDur = animDur('deadExplode') || 1.15;
      s.cooldown = Math.max(s.cooldown, worldT + tossDur + TURN_GAP);
      events.push({
        t: worldT, type: 'toss',
        targetId: s.id,
        damage,
        height
      });
    }

    function applyRocketAoE(shooter, impactX, impactY) {
      if (!shooter) return;
      const radius = ROCKET_AOE_TILES;
      // Hit list resolved before any state mutation so the AoE order is
      // deterministic regardless of which body the loop touches first.
      const targets = [];
      for (const s of all) {
        if (s.team === shooter.team) continue;  // no friendly fire
        if (s.hp <= 0) continue;
        if (s.state === 'tossed') continue;     // already airborne, ignore
        if (Math.abs(s.x - impactX) > radius) continue;
        // Vertical clamp: enemies in distant lanes don't get caught by a
        // ground-level blast even if they line up horizontally.
        if (Math.abs(s.laneOffsetPx - impactY) > ROCKET_AOE_Y_PX) continue;
        targets.push(s);
      }
      for (const s of targets) {
        tossSoldier(s, impactX, rng);
      }
    }

    function findTarget(self) {
      let best = null, bestD = Infinity;
      for (const e of all) {
        if (e.team === self.team || e.hp <= 0) continue;
        // Skip targets that aren't standing yet — airborne, stunned, or
        // getting up. Lining up a shot on a flat body is wasted time and
        // looks weird in the run-up.
        if (e.state === 'tossed' || e.state === 'lain' || e.state === 'getUp') continue;
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
        if (s.state === 'hurt') continue;
        if (s.state === 'tossed') continue;
        if (s.state === 'lain') continue;
        if (s.state === 'getUp') continue;
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

    // Pick the alternative weapon with the most rounds chambered (excludes the
    // currently equipped weapon). Used when out of ammo to switch to something
    // that can fire immediately.
    function pickLoadedAlternative(actor) {
      let best = null, bestCount = 0;
      for (const name in actor.ammo) {
        if (name === actor.weaponName) continue;
        const state = actor.ammo[name];
        if (!state || state.loaded <= 0) continue;
        if (!best || state.loaded > bestCount) { best = name; bestCount = state.loaded; }
      }
      return best;
    }

    // Pick a weapon to reload: prefer the current weapon if it has reserve,
    // otherwise fall back to whichever weapon still has the most reserve rounds.
    function pickReloadCandidate(actor) {
      const current = actor.ammo[actor.weaponName];
      if (current && current.reserve > 0) return actor.weaponName;
      let best = null, bestReserve = 0;
      for (const name in actor.ammo) {
        const state = actor.ammo[name];
        if (!state || state.reserve <= 0) continue;
        if (!best || state.reserve > bestReserve) { best = name; bestReserve = state.reserve; }
      }
      return best;
    }

    function planSwitchAction(actor, newWeaponName) {
      const newStats = getWeaponStats(newWeaponName) || defaultStats();
      const holsterDur = Math.max(0.18, animDur('holster'));
      const drawDur = Math.max(0.18, animDur('drawWeapon'));
      const duration = holsterDur + drawDur;
      const action = {
        actorId: actor.id, type: 'switch',
        startT: worldT, duration,
        holsterDur, drawDur,
        newWeaponName, newStats,
        swapped: false
      };
      actor.aimed = false;
      actor.cooldown = worldT + duration + TURN_GAP;
      return action;
    }

    function planReloadAction(actor) {
      const ammoState = actor.ammo[actor.weaponName] || { loaded: 0, reserve: 0 };
      const magSize = magSizeFor(actor.weapon);
      const need = Math.max(0, magSize - ammoState.loaded);
      const rounds = Math.max(1, Math.min(need, ammoState.reserve));
      const reloadAnim = window.Anims && window.Anims.reload;
      const duration = (reloadAnim && reloadAnim.durationForRounds)
        ? reloadAnim.durationForRounds(rounds)
        : 2.0;
      const action = {
        actorId: actor.id, type: 'reload',
        startT: worldT, duration,
        rounds, seated: 0, aborted: false
      };
      actor.aimed = false;
      actor.cooldown = worldT + duration + TURN_GAP;
      return action;
    }

    // Reload abort: triggered when at least 1 round is chambered AND somebody
    // is currently aiming at this actor (shoot action in progress targeting us)
    // OR we just took a hit. Mirrors the gameplay rule "stop reloading the
    // moment you have one usable bullet under threat".
    function isUnderThreat(actor) {
      if (actor.state === 'hurt') return true;
      for (const a of activeActions) {
        if (a.type !== 'shoot') continue;
        if (a.targetId !== actor.id) continue;
        const shooter = all.find(s => s.id === a.actorId);
        if (shooter && shooter.hp > 0) return true;
      }
      return false;
    }

    // Sniper-class kite escape. Runs the soldier away from `target` along a
    // 2D vector capped at MOVE_STEP_TILES of total travel (using TILE_PX to
    // convert the Y axis into tile-equivalent units). Pure horizontal when
    // we have backward room; mixes in vertical when the wall is close so we
    // keep gaining distance even when cornered. Returns null when both axes
    // are already at the bound (caller should fall back to the default move).
    function planKiteAction(actor, target) {
      const ax = actor.x;
      const ay = actor.laneOffsetPx;
      const tx = target.x;
      const ty = target.laneOffsetPx;

      // Horizontal: move away from the enemy, but cap at how much arena room
      // is left on that side (with a small gutter).
      const escapeDir = ax >= tx ? 1 : -1;
      const horizontalRoom = escapeDir > 0 ? (ARENA_TILES - ax) : ax;
      const horizontalAvail = Math.max(0, horizontalRoom - 0.5);
      const horizontalBudget = Math.min(MOVE_STEP_TILES, horizontalAvail);

      // Vertical: pick the side with more room (away from target's Y first,
      // unless we're already pinned against that bound). Convert pixels to
      // tile-equivalent units so the speed is consistent with x movement.
      let yDir = ay >= ty ? 1 : -1;
      let yRoomPx = yDir > 0 ? (SPAWN_Y_MAX - ay) : (ay - SPAWN_Y_MIN);
      if (yRoomPx < 1) {
        yDir = -yDir;
        yRoomPx = yDir > 0 ? (SPAWN_Y_MAX - ay) : (ay - SPAWN_Y_MIN);
      }
      const yRoomT = yRoomPx / TILE_PX;
      const yBudgetT = Math.max(0, Math.min(MOVE_STEP_TILES - horizontalBudget, yRoomT));

      const toX = clamp(ax + escapeDir * horizontalBudget, 0.5, ARENA_TILES - 0.5);
      const toY = clamp(ay + yDir * yBudgetT * TILE_PX, SPAWN_Y_MIN, SPAWN_Y_MAX);

      const actualDxT = toX - ax;
      const actualDyT = (toY - ay) / TILE_PX;
      const moveDistT = Math.sqrt(actualDxT * actualDxT + actualDyT * actualDyT);
      if (moveDistT < 0.3) return null;  // both axes pinned — caller falls back

      const dur = moveDistT / SPEED_TILES_PER_SEC;
      const facing = escapeDir > 0 ? 1 : -1;
      const action = {
        actorId: actor.id, type: 'move',
        startT: worldT, duration: dur,
        fromX: ax, toX,
        fromY: ay, toY,
        facing
      };
      action.commit = function () {
        actor.x = toX;
        actor.laneOffsetPx = toY;
      };
      actor.aimed = false;
      actor.cooldown = worldT + dur + TURN_GAP;
      return action;
    }

    // Bare-handed: the soldier has burned through every magazine and was
    // swapped to MELEE-01 by the ammo planning step. Instead of standing
    // around idling, walk into melee range and throw a punch. Damage is the
    // weapon's damageMin/damageMax (currently 1) and lands on the impact
    // frame of Anims.punch — so the swing reads as a real strike that hits
    // exactly when the fist is fully extended.
    function planBareHandsAction(actor) {
      const meleeIdx = bareHandsWeaponIdx();
      if (meleeIdx != null && actor.cfg && actor.cfg.weaponIdx !== meleeIdx) {
        actor.cfg = Object.assign({}, actor.cfg, { weaponIdx: meleeIdx });
      }
      actor.outOfAmmo = true;
      actor.aimed = false;

      const target = findTarget(actor);
      if (!target) {
        const action = {
          actorId: actor.id, type: 'idle',
          startT: worldT, duration: IDLE_TURN_DURATION * 2
        };
        actor.cooldown = worldT + action.duration + TURN_GAP;
        return action;
      }

      const dx = target.x - actor.x;
      const d = Math.abs(dx);
      actor.facing = dx >= 0 ? 1 : -1;

      const meleeStats = getWeaponStats('Main nue') || getWeaponStats('MELEE-01');
      const punchRange = Math.max(0.9, (meleeStats && meleeStats.rangeMax) || 1);

      if (d > punchRange) {
        const dir = sign(dx);
        let stepDist = Math.min(MOVE_STEP_TILES, d - punchRange + 0.4);
        stepDist = Math.max(0.5, stepDist);
        let toX = clamp(actor.x + dir * stepDist, 0, ARENA_TILES);
        const dist = Math.abs(toX - actor.x);
        const dur = dist / SPEED_TILES_PER_SEC;
        const moveAction = {
          actorId: actor.id, type: 'move',
          startT: worldT, duration: dur,
          fromX: actor.x, toX, facing: actor.facing
        };
        moveAction.commit = function () { actor.x = toX; };
        actor.cooldown = worldT + dur + TURN_GAP;
        return moveAction;
      }

      // In range — throw a punch.
      const punchAnim = window.Anims && window.Anims.punch;
      const fps = (punchAnim && punchAnim.fps) || 18;
      const frames = (punchAnim && punchAnim.frames) || 11;
      const impactFrame = (punchAnim && punchAnim.impactFrame != null) ? punchAnim.impactFrame : 5;
      const duration = frames / fps;
      const impactT = impactFrame / fps;
      const accuracy = meleeStats && meleeStats.accuracy != null ? meleeStats.accuracy : 0.8;
      const hit = rng() < accuracy;
      const part = hit ? rollHitPart(rng) : null;
      const damage = hit ? rollDamage(meleeStats || { damageMin: 1, damageMax: 1 }, rng) : 0;

      const action = {
        actorId: actor.id, targetId: target.id, type: 'punch',
        startT: worldT, duration,
        impactT, impacted: false,
        hit, part, damage,
        facing: actor.facing,
        ax: actor.x, ay: actor.laneOffsetPx,
        tx: target.x, ty: target.laneOffsetPx
      };
      actor.cooldown = worldT + duration + TURN_GAP;
      return action;
    }

    function planAction() {
      const aA = alive('A'), aB = alive('B');
      if (aA === 0 || aB === 0) {
        finishBattle(winnerForAliveCounts(aA, aB));
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

      // â”€â”€ AMMO check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Current weapon empty:
      //   1. Free-cost switch to a loaded alternative is always preferred.
      //   2. Otherwise the decision depends on distance — when the enemy is
      //      close, fists land faster than a reload; when far, reload (or
      //      switch-then-reload) so we keep ranged pressure. If no reload is
      //      possible anywhere, fall back to fists no matter the distance.
      const ammoState = actor.ammo[actor.weaponName];
      if (!ammoState || ammoState.loaded <= 0) {
        const switchTo = pickLoadedAlternative(actor);
        if (switchTo) return planSwitchAction(actor, switchTo);

        const reloadTo = pickReloadCandidate(actor);
        const BARE_HANDS_CLOSE_RANGE = 4;  // tiles — within this, punching beats reloading
        if (d <= BARE_HANDS_CLOSE_RANGE) {
          return planBareHandsAction(actor);
        }
        if (reloadTo) {
          if (reloadTo !== actor.weaponName) return planSwitchAction(actor, reloadTo);
          return planReloadAction(actor);
        }
        return planBareHandsAction(actor);
      }
      // Reset bare-hands flag in case the soldier somehow regained ammo.
      if (actor.outOfAmmo) actor.outOfAmmo = false;

      // â”€â”€ KITE turn (sniper-class, enemy inside deadzone) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Big-rangeMin weapons (snipers, most heavies) become useless when an
      // enemy is inside their deadzone. Instead of just shuffling backward
      // along x and hitting the arena wall, break the engagement with a 2D
      // run: pure horizontal backup when there is room, mixed with vertical
      // travel along the lane Y axis when we are cornered. Clamped to arena
      // bounds so the soldier never runs off-screen.
      const KITE_RANGE_MIN_TILES = 5;
      if (tooClose && (w.rangeMin || 0) >= KITE_RANGE_MIN_TILES) {
        const kite = planKiteAction(actor, target);
        if (kite) return kite;
      }

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
      // Cap the burst by what's actually in the magazine so the soldier never
      // fires phantom rounds; the next planning turn will trigger a reload or
      // weapon switch via the ammo check above.
      const isRocket = isRocketLauncher(w);
      const burst = isRocket ? 1 : Math.max(1, Math.min(burstCount(w), ammoState.loaded));
      const hitChance = w.accuracy != null ? w.accuracy : 0.5;
      const aimDur = Math.max(AIM_DELAY_MIN, actor.aimed ? 0 : animDur('aim'));
      const shotAnim = animDur('shoot');
      const unAimDur = animDur('unaim');
      const interval = shotInterval(w, burst);
      const recovery = isRocket ? ROCKET_RECOVERY_T : Math.max(shotAnim, 0.08);
      const shotProfile = shotProfileKey(w);

      // Pre-roll shots so the action is a self-contained, deterministic plan.
      // Rockets fly for ROCKET_TRAVEL_T between launch and impact; the single
      // shot.atT marks the impact moment so AoE damage applies in sim time
      // exactly when the view's rocket reaches the target.
      const launchT = aimDur + AIM_HOLD;
      const shots = [];
      for (let i = 0; i < burst; i++) {
        const hit = rng() < hitChance;
        const atT = isRocket
          ? launchT + ROCKET_TRAVEL_T
          : launchT + i * interval;
        shots.push({
          atT,
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
      if (isRocket) {
        action.isRocket = true;
        action.launchT = launchT;
        action.launchEmitted = false;
        // Pre-roll the miss exit so determinism is preserved. Misses now
        // graze past the target instead of rocketing off-screen — the
        // trajectory should be visually indistinguishable from a hit until
        // the explosion (or absence of one) at the very end.
        const missDir = actor.facing >= 0 ? 1 : -1;
        const missEndX = target.x + missDir * (1.0 + rng() * 1.8);
        // Vertical scatter for a miss: passes just to the side of the
        // target's lane so the rocket clearly clears them visually.
        const missLatSign = rng() < 0.5 ? -1 : 1;
        const missEndY = target.laneOffsetPx + missLatSign * (22 + rng() * 26);
        action.missEndX = missEndX;
        action.missEndY = missEndY;
      }
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

    function winnerForAliveCounts(aA, aB) {
      return aA > 0 ? 'A' : (aB > 0 ? 'B' : 'draw');
    }

    function bareHandsWeaponIdx() {
      const list = window.Weapons && window.Weapons.list;
      if (!list) return null;
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === 'MELEE-01') return i;
      }
      return null;
    }

    function startCelebrateWalk(s) {
      const idx = bareHandsWeaponIdx();
      if (idx != null && s.cfg && s.cfg.weaponIdx !== idx) {
        s.cfg = Object.assign({}, s.cfg, { weaponIdx: idx });
      }
      // 1 in 2 chance: walk or run, bare-handed, forward in facing direction.
      const isRun = rng() < 0.5;
      s.endPhase = isRun ? 'celebrateRun' : 'celebrateWalk';
      s.state = isRun ? 'run' : 'walk';
      s.stateT = 0;
      s.animState = null;
      // Slight speed jitter so the line doesn't move as a perfect block.
      s.celebrateSpeed = (isRun ? SPEED_TILES_PER_SEC * 0.85 : SPEED_TILES_PER_SEC * 0.42) * (0.85 + rng() * 0.3);
    }

    function startWinnerAnimation(s) {
      s.aimed = false;
      s.animState = null;
      if (animDur('holster') > 0) {
        s.endPhase = 'holster';
        s.state = 'holster';
      } else if (animDur('victory') > 0) {
        s.endPhase = 'victory';
        s.state = 'victory';
      } else {
        startCelebrateWalk(s);
        return;
      }
      s.stateT = 0;
    }

    function finishBattle(nextWinner) {
      if (done) return true;
      done = true;
      winner = nextWinner;
      activeActions = [];
      for (const s of all) {
        if (s.hp <= 0) continue;
        if (winner !== 'draw' && s.team === winner) {
          startWinnerAnimation(s);
        } else {
          s.aimed = false;
          s.animState = null;
          s.endPhase = null;
          if (s.state !== 'idle') { s.state = 'idle'; s.stateT = 0; }
        }
      }
      events.push({ t: worldT, type: 'end', winner });
      return true;
    }

    function finishBattleIfNeeded() {
      const aA = alive('A'), aB = alive('B');
      if (aA > 0 && aB > 0) return false;
      return finishBattle(winnerForAliveCounts(aA, aB));
    }

    function driveBattleEndAnimations(dt) {
      for (const s of all) {
        if (s.state === 'dead') { s.stateT += dt; continue; }
        if (s.endPhase === 'holster') {
          s.stateT += dt;
          if (s.stateT >= animDur('holster')) {
            if (animDur('victory') > 0) {
              s.state = 'victory';
              s.stateT = 0;
              s.endPhase = 'victory';
            } else {
              startCelebrateWalk(s);
            }
          }
          continue;
        }
        if (s.endPhase === 'victory') {
          s.stateT += dt;
          if (s.stateT >= animDur('victory')) {
            startCelebrateWalk(s);
          }
          continue;
        }
        if (s.endPhase === 'celebrateWalk' || s.endPhase === 'celebrateRun') {
          const dir = s.facing || 1;
          const speed = s.celebrateSpeed || SPEED_TILES_PER_SEC * 0.5;
          s.x += dir * speed * dt;  // no clamp — walk/run off-screen
          s.stateT += dt;
          continue;
        }
        if (s.state !== 'idle') { s.state = 'idle'; s.stateT = 0; }
        else s.stateT += dt;
      }
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
      } else if (action.type === 'switch') {
        actor.state = 'holster'; actor.stateT = 0;
        actor.animState = null;
      } else if (action.type === 'reload') {
        actor.state = 'reload'; actor.stateT = 0;
        actor.animState = { reloadRounds: action.rounds };
      } else if (action.type === 'punch') {
        actor.facing = action.facing;
        actor.state = 'punch'; actor.stateT = 0;
        actor.animState = null;
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
      const actor = all.find(s => s.id === a.actorId);
      if (!actor || actor.hp <= 0) { completed.add(a); return; }
      // Tossed by a rocket blast mid-action: the body is airborne, the
      // animation is driven by driveTossedSoldier. Drop the action entirely
      // so a rifle in mid-burst doesn't keep emitting shoot events. Same
      // treatment for lain (stunned on the ground) and getUp (rising).
      if (actor.state === 'tossed' || actor.state === 'lain' || actor.state === 'getUp') {
        completed.add(a);
        return;
      }

      // Hurt freezes the action: no elapsed advance, no shots, then re-aim on recovery
      if (actor.state === 'hurt') {
        actor.stateT += dt;
        if (actor.stateT < animDur('hurt')) return;
        // Hurt done — push cooldown forward so next action doesn't start immediately
        actor.cooldown = Math.max(actor.cooldown, worldT + (a.duration - a.elapsed) + TURN_GAP);
        if (a.type === 'shoot') { actor.state = 'aim'; actor.stateT = 0; }
        else if (a.type === 'punch') {
          // Aborting a punch mid-anim: drop back to idle and cancel the action so
          // the soldier doesn't auto-finish a swing that already got interrupted.
          actor.state = 'idle'; actor.stateT = 0;
          a.duration = a.elapsed;
          completed.add(a);
          return;
        }
        else { actor.state = 'idle'; actor.stateT = 0; }
      }

      a.elapsed += dt;

      if (a.type === 'move') {
        const t = clamp(a.elapsed / a.duration, 0, 1);
        actor.x = lerp(a.fromX, a.toX, t);
        if (a.fromY != null && a.toY != null) {
          actor.laneOffsetPx = lerp(a.fromY, a.toY, t);
        }
        actor.facing = a.facing;
        if (actor.state !== 'run') { actor.state = 'run'; actor.stateT = 0; }
        else actor.stateT += dt;
      } else if (a.type === 'shoot') {
        actor.facing = a.facing;
        // Rocket launchers: emit a one-shot rocketLaunch event the moment the
        // round leaves the muzzle. The view animates the rocket flight; the
        // sim still resolves damage on the shot.atT (impact) tick below so
        // gameplay timing stays bit-for-bit deterministic.
        if (a.isRocket && !a.launchEmitted && a.elapsed >= a.launchT) {
          a.launchEmitted = true;
          const magState = actor.ammo && actor.ammo[actor.weaponName];
          if (magState && magState.loaded > 0) magState.loaded -= 1;
          actor.animState = {
            shotProfile: a.shotProfile,
            weaponCategory: a.weaponCategory,
            weaponType: a.weaponType,
            shotIndex: 0,
            shotCount: 1
          };
          actor.state = 'shoot'; actor.stateT = 0;
          const shot = a.shots[0];
          const endX = shot.hit ? a.tx : a.missEndX;
          const endY = shot.hit ? a.ty : a.missEndY;
          events.push({
            t: worldT, type: 'rocketLaunch',
            actorId: a.actorId, targetId: a.targetId,
            ax: actor.x, ay: actor.laneOffsetPx,
            tx: a.tx, ty: a.ty,
            endX, endY,
            hit: shot.hit,
            travelT: ROCKET_TRAVEL_T,
            aoeRadius: ROCKET_AOE_TILES,
            weaponName: actor.weaponName,
            weaponCategory: a.weaponCategory,
            weaponType: a.weaponType,
            facing: actor.facing
          });
        }
        while (a.shotsFired < a.shots.length && a.elapsed >= a.shots[a.shotsFired].atT) {
          const shot = a.shots[a.shotsFired++];
          const target = all.find(s => s.id === a.targetId);
          // Non-rocket: spend the round here at the per-shot tick. Rocket
          // already decremented at launchT above so the magazine empties when
          // the rocket leaves the tube, not when it lands.
          if (!a.isRocket) {
            const magState = actor.ammo && actor.ammo[actor.weaponName];
            if (magState && magState.loaded > 0) magState.loaded -= 1;
          }
          actor.animState = {
            shotProfile: a.shotProfile,
            weaponCategory: a.weaponCategory,
            weaponType: a.weaponType,
            shotIndex: shot.index,
            shotCount: a.shots.length
          };

          if (a.isRocket) {
            // Rocket impact: explosion at the locked-in target position. On a
            // hit, the impact event spawns the explosion fx and the AoE tosses
            // every enemy within ROCKET_AOE_TILES of the blast. On a miss, the
            // rocket just keeps flying past — no explosion, no damage.
            events.push({
              t: worldT, type: 'rocketImpact',
              actorId: a.actorId, targetId: a.targetId,
              ax: actor.x, ay: actor.laneOffsetPx,
              tx: a.tx, ty: a.ty,
              hit: shot.hit,
              weaponName: actor.weaponName,
              weaponCategory: a.weaponCategory,
              weaponType: a.weaponType
            });
            if (shot.hit) {
              applyRocketAoE(actor, a.tx, a.ty);
            }
          } else if (target) {
            const targetAlive = target.hp > 0;
            const bodyPart = shot.part || 'torso';
            // Push the shoot event even when the target is already a corpse
            // from an earlier shot in the same burst — the trail, muzzle
            // flash, and impact spread still render. `damage` is zeroed for
            // corpse hits since HP is already 0.
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
              damage: targetAlive && shot.hit ? shot.damage : 0,
              corpseHit: !targetAlive && shot.hit
            });
            if (shot.hit) {
              target.bodyHits[bodyPart] = Math.min(2, (target.bodyHits[bodyPart] || 0) + 1);
              if (targetAlive) {
                target.hp = Math.max(0, target.hp - shot.damage);
                if (target.hp <= 0) {
                  target.state = 'dead'; target.stateT = 0;
                  const deadVariant = pickDeadVariant(actor.weapon);
                  target.animState = { deadVariant };
                  events.push({ t: worldT, type: 'die', targetId: target.id, bodyPart, damage: shot.damage, deadVariant });
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
              } else {
                // Corpse re-hit (remaining burst shots landing on a body that
                // was already killed earlier in the same burst): replay the
                // dead animation from F0 so the body visibly twitches. Keep
                // the original variant so projected corpses don't suddenly
                // switch to fall-back mid-replay.
                target.state = 'dead';
                target.stateT = 0;
              }
            }
          }
          if (!a.isRocket) {
            actor.state = 'shoot'; actor.stateT = 0;
          }
        }

        // Rockets fire at a.launchT (when the rocket leaves the muzzle) but
        // their shot.atT marks impact much later; aim->shoot must follow the
        // launch, not the impact, otherwise the actor stays aimed while the
        // rocket is mid-flight.
        const firstShotT = a.isRocket ? a.launchT : a.shots[0].atT;
        if (a.elapsed >= a.unaimStartT) {
          actor.animState = {
            shotProfile: a.shotProfile,
            weaponCategory: a.weaponCategory,
            weaponType: a.weaponType
          };
          actor.state = 'unaim';
          actor.stateT = a.elapsed - a.unaimStartT;
        } else if (a.elapsed < firstShotT) {
          // aim phase + hold: stay in aim pose until first shot fires
          if (actor.state !== 'aim') { actor.state = 'aim'; actor.stateT = 0; }
          else actor.stateT += dt;
        } else if (actor.state === 'aim') {
          actor.state = 'shoot'; actor.stateT = 0;
        } else if (actor.state === 'shoot') {
          actor.stateT += dt;
        }
      } else if (a.type === 'switch') {
        // Holster the current weapon, swap at the halfway mark, then draw the new one.
        if (a.elapsed < a.holsterDur) {
          if (actor.state !== 'holster') { actor.state = 'holster'; actor.stateT = 0; }
          else actor.stateT += dt;
        } else {
          if (!a.swapped) {
            actor.weaponName = a.newWeaponName;
            actor.weapon = a.newStats;
            actor.lane = laneForCategory(a.newStats.category);
            actor.aimed = false;
            const newIdx = weaponIdxForName(a.newWeaponName);
            if (newIdx >= 0 && actor.cfg) {
              actor.cfg = Object.assign({}, actor.cfg, { weaponIdx: newIdx });
            }
            if (!actor.ammo[a.newWeaponName]) {
              actor.ammo[a.newWeaponName] = { loaded: 0, reserve: 0 };
            }
            a.swapped = true;
          }
          if (actor.state !== 'drawWeapon') { actor.state = 'drawWeapon'; actor.stateT = 0; }
          else actor.stateT += dt;
        }
      } else if (a.type === 'reload') {
        if (actor.state !== 'reload') { actor.state = 'reload'; actor.stateT = 0; }
        else actor.stateT += dt;
        if (!actor.animState || actor.animState.reloadRounds !== a.rounds) {
          actor.animState = { reloadRounds: a.rounds };
        }
        // Per-cycle bullet seating: each completed round cycle of the reload
        // animation transfers one round from reserve into the magazine. This
        // drives the live progress indicator above the soldier and lets the
        // action be cut short with a partial transfer if interrupted.
        const reloadAnim = window.Anims && window.Anims.reload;
        const fps = (reloadAnim && reloadAnim.fps) || 12;
        const introDur = 8 / fps;
        const roundDur = 7 / fps;
        const elapsedWork = a.elapsed - introDur;
        const expectedSeated = Math.max(0, Math.min(a.rounds, Math.floor(elapsedWork / roundDur)));
        if (expectedSeated > a.seated) {
          const state = actor.ammo[actor.weaponName];
          if (state && state.reserve > 0) {
            const toAdd = Math.min(expectedSeated - a.seated, state.reserve);
            state.loaded += toAdd;
            state.reserve -= toAdd;
          }
          a.seated = expectedSeated;
        }
        actor.reloadProgress = { seated: a.seated, total: a.rounds };
        // Abort early once we have at least one chambered round and someone is
        // either aiming at us or just hit us.
        if (!a.aborted && a.seated >= 1 && a.seated < a.rounds && isUnderThreat(actor)) {
          a.aborted = true;
          a.duration = a.elapsed;  // forces completion on this tick
        }
      } else if (a.type === 'punch') {
        actor.facing = a.facing;
        if (actor.state !== 'punch') { actor.state = 'punch'; actor.stateT = 0; }
        else actor.stateT += dt;
        // Damage lands on the impact frame (full extension). Single hit, no burst.
        if (!a.impacted && a.elapsed >= a.impactT) {
          a.impacted = true;
          const target = all.find(s => s.id === a.targetId);
          if (target && target.hp > 0) {
            const bodyPart = a.part || 'torso';
            events.push({
              t: worldT, type: 'shoot',
              actorId: a.actorId, targetId: a.targetId,
              ax: actor.x, ay: actor.laneOffsetPx,
              tx: target.x, ty: target.laneOffsetPx,
              shotIndex: 0, shotCount: 1,
              weaponName: actor.weaponName,
              weaponCategory: 'melee',
              weaponType: 'unarmed',
              shotProfile: 'melee',
              facing: actor.facing,
              hit: a.hit,
              bodyPart: a.hit ? bodyPart : null,
              damage: a.hit ? a.damage : 0,
              melee: true
            });
            if (a.hit) {
              target.bodyHits[bodyPart] = Math.min(2, (target.bodyHits[bodyPart] || 0) + 1);
              target.hp = Math.max(0, target.hp - a.damage);
              if (target.hp <= 0) {
                target.state = 'dead'; target.stateT = 0;
                // Punch always falls back — `actor.weapon` still points at the
                // last real gun the actor had, so we pass MELEE-01 stats so the
                // variant picker sees the melee category and returns 'fall'.
                const deadVariant = pickDeadVariant(getWeaponStats('Main nue'));
                target.animState = { deadVariant };
                events.push({ t: worldT, type: 'die', targetId: target.id, bodyPart, damage: a.damage, deadVariant });
              } else {
                target.state = 'hurt'; target.stateT = 0;
                events.push({
                  t: worldT, type: 'hit',
                  targetId: target.id, hp: target.hp,
                  bodyPart, damage: a.damage,
                  bodyHits: Object.assign({}, target.bodyHits)
                });
              }
            }
          }
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
        } else if (a.type === 'reload') {
          actor.reloadProgress = null;
          actor.aimed = false;
          actor.animState = null;
          actor.state = 'idle'; actor.stateT = 0;
        } else if (a.type === 'switch') {
          actor.animState = null;
          actor.state = 'idle'; actor.stateT = 0;
        } else if (a.type === 'punch') {
          actor.animState = null;
          actor.state = 'idle'; actor.stateT = 0;
        }
        completed.add(a);
      }
    }

    function driveTossedSoldier(s, dt) {
      const tossAnim = window.Anims && window.Anims.deadExplode;
      const fps = (tossAnim && tossAnim.fps) || 14;
      const frames = (tossAnim && tossAnim.frames) || 16;
      const totalDur = frames / fps;
      const landT = TOSS_LAND_FRAME / fps;
      s.stateT += dt;
      const toss = (s.animState && s.animState.toss) || null;
      // Slide horizontally across the toss so the body lands a step away from
      // where it was standing — picks up the blast direction set in tossSoldier.
      if (toss && toss.knockFromX != null && toss.knockToX != null) {
        const k = clamp(s.stateT / Math.max(0.001, landT), 0, 1);
        s.x = lerp(toss.knockFromX, toss.knockToX, k);
      }
      // Apply fall damage at the landing frame: if it kills, fall through to
      // the explode death variant (same animation, so the body just keeps
      // playing through bounce -> rest). If survived, keep playing through to
      // the end and then wake up in idle.
      if (toss && !toss.landed && s.stateT >= landT) {
        toss.landed = true;
        const bodyPart = 'torso';
        s.bodyHits[bodyPart] = Math.min(2, (s.bodyHits[bodyPart] || 0) + 1);
        s.hp = Math.max(0, s.hp - toss.damage);
        if (s.hp <= 0) {
          // Continue the animation seamlessly as a death — keep the same
          // anim key (deadExplode) so the visual is uninterrupted.
          s.state = 'dead';
          s.animState = Object.assign({}, s.animState, { deadVariant: 'explode' });
          // fromToss tells combat-view to skip the secondary explosion fx —
          // the rocket impact already detonated at impact time; this death is
          // just the body landing.
          events.push({ t: worldT, type: 'die', targetId: s.id, bodyPart, damage: toss.damage, deadVariant: 'explode', fromToss: true });
        } else {
          events.push({
            t: worldT, type: 'hit',
            targetId: s.id, hp: s.hp,
            bodyPart, damage: toss.damage,
            bodyHits: Object.assign({}, s.bodyHits),
            fromToss: true
          });
        }
      }
      if (s.state === 'tossed' && s.stateT >= totalDur) {
        // Survived the blast — lie stunned for a random stretch, then push
        // back up via the getUp anim before returning to combat. The lain
        // duration scales loosely with how high they were tossed (bigger
        // impact → longer recovery).
        const baseLain = 1.0;
        const tossH = (toss && toss.height) || 1;
        const lainDur = baseLain + Math.min(2.0, tossH * 0.5) + rng() * 0.5;
        s.state = 'lain';
        s.stateT = 0;
        s.animState = Object.assign({}, s.animState || {}, {
          lainDuration: lainDur,
          lainStartT: worldT
        });
        // Lock the soldier out of acting until lain+getUp finishes.
        const getUpDur = animDur('getUp') || 1.0;
        s.cooldown = Math.max(s.cooldown, worldT + lainDur + getUpDur + 0.2);
      }
    }

    function driveLainSoldier(s, dt) {
      s.stateT += dt;
      const ls = (s.animState && s.animState.lainDuration) || 1.5;
      if (s.stateT >= ls) {
        s.state = 'getUp';
        s.stateT = 0;
      }
    }

    function driveGetUpSoldier(s, dt) {
      s.stateT += dt;
      const dur = animDur('getUp') || 1.0;
      if (s.stateT >= dur) {
        s.state = 'idle';
        s.stateT = 0;
        s.animState = null;
        // Tiny grace cooldown so the soldier doesn't snap straight into a shot.
        s.cooldown = Math.max(s.cooldown, worldT + 0.15);
      }
    }

    function driveInactiveAnimations(dt) {
      const activeIds = new Set(activeActions.map(a => a.actorId));
      for (const s of all) {
        if (activeIds.has(s.id)) continue;
        if (s.state === 'tossed') { driveTossedSoldier(s, dt); continue; }
        if (s.state === 'lain')   { driveLainSoldier(s, dt);   continue; }
        if (s.state === 'getUp')  { driveGetUpSoldier(s, dt);  continue; }
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
        driveBattleEndAnimations(dt);
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
    resolveAmmoLimits,
    reserveDisplayCap,
    DT,
    TILE_PX,
    ARENA_TILES,
    SPEED_TILES_PER_SEC,
    LANE_OFFSETS,
    BODY_PARTS
  };

})();
