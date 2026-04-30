// Renderer - composes a full character frame onto a canvas.
// The soldier is drawn larger while weapon sprites are slightly reduced, so the
// character reads about twice as large relative to the guns.

(function () {
  const E = window.Engine;
  const P = window.Palette;
  const Parts = window.Parts;

  const BODY_SCALE = 3;
  const WEAPON_SCALE = 1;

  const HOLD_PROFILES = {
    pistol: {
      support: true,
      grip: { x: 22, y: -18 },
      baseAngle: -0.02,
      aimWeight: 0.5,
      rearElbow: { x: 7, y: 0 },
      supportElbow: { x: 6, y: 2 },
      foregripOffset: { x: -1, y: 1 },
      recoilBack: 0.7,
      recoilLift: -0.3,
      recoilAngleScale: 0.9,
      runGrip: { x: -4, y: 2 },
      runAngle: 0.1,
      reloadGrip: { x: -2, y: 3 },
      reloadAngle: 0.1,
      hurtGrip: { x: -4, y: 3 },
      deadGrip: { x: -8, y: 4 }
    },
    smg: {
      support: true,
      grip: { x: 17, y: -13 },
      baseAngle: -0.02,
      aimWeight: 0.5,
      rearElbow: { x: 6, y: 2 },
      supportElbow: { x: 11, y: 8 },
      foregripOffset: { x: 0, y: 1 },
      recoilBack: 0.55,
      recoilLift: -0.15,
      recoilAngleScale: 0.45,
      runGrip: { x: -4, y: 2 },
      runAngle: 0.11,
      reloadGrip: { x: -2, y: 2 },
      reloadAngle: 0.07,
      hurtGrip: { x: -5, y: 3 },
      deadGrip: { x: -8, y: 4 }
    },
    rifle: {
      support: true,
      grip: { x: 20, y: -15 },
      baseAngle: -0.03,
      aimWeight: 0.65,
      rearElbow: { x: 7, y: 0 },
      supportElbow: { x: 16, y: 4 },
      foregripOffset: { x: 0, y: 1 },
      recoilBack: 0.8,
      recoilLift: -0.25,
      recoilAngleScale: 0.8,
      runGrip: { x: -6, y: 2 },
      runAngle: 0.14,
      reloadGrip: { x: -1, y: 4 },
      reloadAngle: 0.08,
      hurtGrip: { x: -5, y: 4 },
      deadGrip: { x: -8, y: 5 }
    },
    shotgun: {
      support: true,
      grip: { x: 19, y: -13 },
      baseAngle: 0.04,
      aimWeight: 0.55,
      rearElbow: { x: 8, y: 2 },
      supportElbow: { x: 21, y: 6 },
      foregripOffset: { x: 0, y: 1 },
      recoilBack: 1.35,
      recoilLift: -0.45,
      recoilAngleScale: 1.35,
      runGrip: { x: -6, y: 4 },
      runAngle: 0.18,
      reloadGrip: { x: -2, y: 5 },
      reloadAngle: 0.1,
      hurtGrip: { x: -6, y: 5 },
      deadGrip: { x: -9, y: 6 }
    },
    sniper: {
      support: true,
      grip: { x: 21, y: -17 },
      baseAngle: -0.05,
      aimWeight: 0.45,
      rearElbow: { x: 8, y: -1 },
      supportElbow: { x: 23, y: 4 },
      foregripOffset: { x: 0, y: 1 },
      recoilBack: 1.05,
      recoilLift: -0.3,
      recoilAngleScale: 1.05,
      runGrip: { x: -7, y: 5 },
      runAngle: 0.15,
      reloadGrip: { x: -2, y: 5 },
      reloadAngle: 0.08,
      hurtGrip: { x: -6, y: 5 },
      deadGrip: { x: -9, y: 6 }
    },
    heavy: {
      support: true,
      grip: { x: 20, y: -12 },
      baseAngle: 0.03,
      aimWeight: 0.45,
      rearElbow: { x: 7, y: 2 },
      supportElbow: { x: 16, y: 6 },
      foregripOffset: { x: 0, y: 1 },
      recoilBack: 1.1,
      recoilLift: -0.15,
      recoilAngleScale: 0.7,
      upperBodyX: 1,
      runGrip: { x: -6, y: 4 },
      runAngle: 0.12,
      reloadGrip: { x: -2, y: 5 },
      reloadAngle: 0.08,
      hurtGrip: { x: -6, y: 5 },
      deadGrip: { x: -10, y: 6 }
    }
  };

  const HOLD_VARIANTS = {
    pocket: {
      grip: { x: 21, y: -17 },
      rearElbow: { x: 7, y: 0 },
      supportElbow: { x: 6, y: 2 },
      foregripOffset: { x: -1, y: 1 },
      recoilBack: 0.45
    },
    'long-slide': {
      grip: { x: 23, y: -18 },
      rearElbow: { x: 9, y: 0 },
      supportElbow: { x: 8, y: 2 },
      foregripOffset: { x: -2, y: 1 },
      recoilBack: 0.8
    },
    compact: {
      grip: { x: 17, y: -13 },
      rearElbow: { x: 6, y: 2 },
      supportElbow: { x: 10, y: 8 },
      foregripOffset: { x: 0, y: 1 }
    },
    'tall-compact': {
      grip: { x: 17, y: -13 },
      baseAngle: 0,
      supportElbow: { x: 10, y: 9 },
      foregripOffset: { x: 0, y: 1 }
    },
    'long-smg': {
      grip: { x: 18, y: -13 },
      supportElbow: { x: 13, y: 8 },
      foregripOffset: { x: 0, y: 1 }
    },
    'long-rifle': {
      grip: { x: 20, y: -15 },
      supportElbow: { x: 17, y: 4 },
      foregripOffset: { x: 0, y: 1 }
    },
    'short-shotgun': {
      grip: { x: 20, y: -13 },
      supportElbow: { x: 17, y: 6 },
      foregripOffset: { x: 0, y: 1 }
    },
    'long-shotgun': {
      grip: { x: 19, y: -13 },
      supportElbow: { x: 23, y: 6 },
      foregripOffset: { x: 0, y: 1 }
    },
    'long-sniper': {
      grip: { x: 20, y: -18 },
      supportElbow: { x: 27, y: 4 },
      foregripOffset: { x: 0, y: 1 },
      recoilBack: 1.15
    },
    'compact-sniper': {
      grip: { x: 22, y: -17 },
      supportElbow: { x: 20, y: 4 },
      foregripOffset: { x: 0, y: 1 }
    },
    launcher: {
      grip: { x: 17, y: -21 },
      baseAngle: -0.03,
      aimWeight: 0.22,
      rearElbow: { x: 5, y: 0 },
      supportElbow: { x: 9, y: 5 },
      foregripOffset: { x: -3, y: 4 },
      recoilLift: -0.08,
      runGrip: { x: -5, y: 3 },
      runAngle: 0.08,
      reloadGrip: { x: -3, y: 4 }
    },
    cannon: {
      grip: { x: 19, y: -10 },
      baseAngle: 0.05,
      rearElbow: { x: 7, y: 3 },
      supportElbow: { x: 16, y: 7 },
      foregripOffset: { x: 0, y: 1 },
      recoilBack: 1.25,
      runGrip: { x: -6, y: 5 },
      reloadGrip: { x: -3, y: 6 }
    }
  };

  const HOLD_OVERRIDES = {
    'PISTOL-01':  { grip: { x: 21, y: -17 }, rearElbow: { x: 7, y: 0 }, supportElbow: { x: 5, y: 2 }, foregripOffset: { x: -1, y: 1 } },
    'PISTOL-02':  { grip: { x: 23, y: -18 }, rearElbow: { x: 9, y: 0 }, supportElbow: { x: 7, y: 2 }, foregripOffset: { x: -2, y: 1 } },
    'PISTOL-03':  { grip: { x: 22, y: -18 }, rearElbow: { x: 8, y: 0 }, supportElbow: { x: 6, y: 2 }, foregripOffset: { x: -1, y: 1 } },
    'PISTOL-04':  { grip: { x: 23, y: -18 }, rearElbow: { x: 9, y: 0 }, supportElbow: { x: 7, y: 2 }, foregripOffset: { x: -2, y: 1 } },
    'PISTOL-05':  { grip: { x: 22, y: -18 }, rearElbow: { x: 8, y: 0 }, supportElbow: { x: 6, y: 2 }, foregripOffset: { x: -1, y: 1 } },
    'PISTOL-06':  { grip: { x: 23, y: -18 }, rearElbow: { x: 9, y: 0 }, supportElbow: { x: 7, y: 2 }, foregripOffset: { x: -2, y: 1 } },
    'PISTOL-07':  { grip: { x: 22, y: -18 }, rearElbow: { x: 8, y: 0 }, supportElbow: { x: 6, y: 2 }, foregripOffset: { x: -1, y: 1 } },
    'PISTOL-08':  { grip: { x: 21, y: -17 }, rearElbow: { x: 7, y: 0 }, supportElbow: { x: 5, y: 2 }, foregripOffset: { x: -1, y: 1 } },

    'SMG-01':     { grip: { x: 17, y: -12 }, rearElbow: { x: 6, y: 2 }, supportElbow: { x: 10, y: 6 }, foregripOffset: { x: 0, y: 0 } },
    'SMG-02':     { grip: { x: 17, y: -13 }, supportElbow: { x: 10, y: 8 }, foregripOffset: { x: 0, y: 1 } },
    'SMG-03':     { grip: { x: 17, y: -15 }, supportElbow: { x: 10, y: 6 }, foregripOffset: { x: 0, y: 1 } },
    'SMG-04':     { grip: { x: 17, y: -19 }, rearElbow: { x: 7, y: -1 }, supportElbow: { x: 6, y: 2 }, foregripOffset: { x: 0, y: 1 } },
    'SMG-05':     { grip: { x: 19, y: -10 }, supportElbow: { x: 13, y: 4 }, foregripOffset: { x: -4, y: -1 } },
    'SMG-06':     { grip: { x: 18, y: -12 }, supportElbow: { x: 12, y: 7 }, foregripOffset: { x: 0, y: 0 } },
    'SMG-07':     { grip: { x: 18, y: -13 }, supportElbow: { x: 14, y: 8 }, foregripOffset: { x: 0, y: 1 } },
    'SMG-08':     { grip: { x: 17, y: -13 }, supportElbow: { x: 8, y: 8 }, foregripOffset: { x: 0, y: 1 } },
    'SMG-09':     { grip: { x: 17, y: -13 }, supportElbow: { x: 9, y: 8 }, foregripOffset: { x: 0, y: 1 } },
    'SMG-10':     { grip: { x: 18, y: -16 }, rearElbow: { x: 6, y: 0 }, supportElbow: { x: 10, y: 6 }, foregripOffset: { x: 0, y: 1 } },
    'SMG-11':     { grip: { x: 17, y: -17 }, rearElbow: { x: 7, y: -1 }, supportElbow: { x: 6, y: 2 }, foregripOffset: { x: 0, y: 1 } },

    'RIFLE-01':   { supportElbow: { x: 14, y: 4 }, foregripOffset: { x: 0, y: 1 } },
    'RIFLE-02':   { supportElbow: { x: 14, y: 4 }, foregripOffset: { x: 0, y: 1 } },
    'RIFLE-03':   { supportElbow: { x: 16, y: 4 }, foregripOffset: { x: 0, y: -1 } },
    'RIFLE-04':   { grip: { x: 20, y: -15 }, supportElbow: { x: 17, y: 4 }, foregripOffset: { x: 0, y: -1 } },
    'RIFLE-05':   { grip: { x: 20, y: -15 }, supportElbow: { x: 17, y: 4 }, foregripOffset: { x: 0, y: -1 } },
    'RIFLE-06':   { supportElbow: { x: 18, y: 4 }, foregripOffset: { x: 0, y: -1 } },
    'RIFLE-07':   { supportElbow: { x: 16, y: 4 }, foregripOffset: { x: 0, y: -1 } },
    'RIFLE-08':   { grip: { x: 20, y: -15 }, supportElbow: { x: 18, y: 4 }, foregripOffset: { x: 0, y: -1 } },
    'RIFLE-09':   { supportElbow: { x: 14, y: 4 }, foregripOffset: { x: 0, y: -1 } },
    'RIFLE-10':   { grip: { x: 20, y: -13 }, supportElbow: { x: 13, y: 3 }, foregripOffset: { x: 0, y: -1 } },

    'SHOTGUN-01': { grip: { x: 20, y: -13 }, supportElbow: { x: 17, y: 6 }, foregripOffset: { x: 0, y: 1 } },
    'SHOTGUN-02': { supportElbow: { x: 22, y: 6 }, foregripOffset: { x: 0, y: -1 } },
    'SHOTGUN-03': { grip: { x: 19, y: -13 }, supportElbow: { x: 24, y: 6 }, foregripOffset: { x: 0, y: 1 } },
    'SHOTGUN-04': { supportElbow: { x: 21, y: 6 }, foregripOffset: { x: 0, y: -1 } },
    'SHOTGUN-05': { grip: { x: 19, y: -13 }, supportElbow: { x: 23, y: 6 }, foregripOffset: { x: 0, y: -1 } },
    'SHOTGUN-06': { grip: { x: 19, y: -13 }, supportElbow: { x: 23, y: 6 }, foregripOffset: { x: 0, y: 1 } },
    'SHOTGUN-07': { grip: { x: 20, y: -13 }, supportElbow: { x: 17, y: 6 }, foregripOffset: { x: 5, y: 1 } },
    'SHOTGUN-08': { grip: { x: 19, y: -13 }, supportElbow: { x: 24, y: 6 }, foregripOffset: { x: 0, y: 1 } },

    'SNIPER-01':  { grip: { x: 20, y: -18 }, supportElbow: { x: 26, y: 4 }, foregripOffset: { x: 0, y: 1 } },
    'SNIPER-02':  { grip: { x: 21, y: -17 }, supportElbow: { x: 25, y: 4 }, foregripOffset: { x: 0, y: 1 } },
    'SNIPER-03':  { supportElbow: { x: 23, y: 4 }, foregripOffset: { x: 0, y: 1 } },
    'SNIPER-04':  { supportElbow: { x: 22, y: 4 }, foregripOffset: { x: 0, y: 1 } },
    'SNIPER-05':  { grip: { x: 20, y: -18 }, supportElbow: { x: 26, y: 4 }, foregripOffset: { x: 0, y: 1 } },
    'SNIPER-06':  { grip: { x: 20, y: -18 }, supportElbow: { x: 26, y: 4 }, foregripOffset: { x: 0, y: 1 } },
    'SNIPER-07':  { grip: { x: 20, y: -18 }, supportElbow: { x: 27, y: 4 }, foregripOffset: { x: 0, y: 1 } },
    'SNIPER-08':  { grip: { x: 20, y: -18 }, supportElbow: { x: 27, y: 4 }, foregripOffset: { x: 0, y: 1 } },
    'SNIPER-09':  { supportElbow: { x: 20, y: 4 }, foregripOffset: { x: 0, y: 1 } },
    'SNIPER-10':  { supportElbow: { x: 20, y: 4 }, foregripOffset: { x: 0, y: 1 } },

    'HEAVY-01':   { grip: { x: 17, y: -21 }, rearElbow: { x: 5, y: 0 }, supportElbow: { x: 9, y: 5 }, foregripOffset: { x: -2, y: 4 } },
    'HEAVY-02':   { grip: { x: 17, y: -21 }, rearElbow: { x: 5, y: 0 }, supportElbow: { x: 9, y: 5 }, foregripOffset: { x: -3, y: 4 } },
    'HEAVY-03':   { grip: { x: 17, y: -20 }, rearElbow: { x: 5, y: 0 }, supportElbow: { x: 10, y: 5 }, foregripOffset: { x: -2, y: 4 } },
    'HEAVY-04':   { grip: { x: 20, y: -13 }, supportElbow: { x: 15, y: 6 }, foregripOffset: { x: 0, y: 1 } },
    'HEAVY-05':   { grip: { x: 17, y: -21 }, rearElbow: { x: 5, y: 0 }, supportElbow: { x: 9, y: 5 }, foregripOffset: { x: -3, y: 4 } },
    'HEAVY-06':   { grip: { x: 20, y: -13 }, supportElbow: { x: 17, y: 6 }, foregripOffset: { x: 0, y: 1 } },
    'HEAVY-07':   { grip: { x: 10, y: -21 }, rearElbow: { x: 5, y: 0 }, supportElbow: { x: 8, y: 5 }, foregripOffset: { x: -7, y: 0 } },
    'HEAVY-08':   { grip: { x: 10, y: -21 }, rearElbow: { x: 5, y: 0 }, supportElbow: { x: 8, y: 5 }, foregripOffset: { x: -7, y: 0 } },
    'HEAVY-09':   { grip: { x: 11, y: -20 }, rearElbow: { x: 5, y: 0 }, supportElbow: { x: 9, y: 5 }, foregripOffset: { x: -3, y: 4 } },
    'HEAVY-10':   { grip: { x: 20, y: -13 }, supportElbow: { x: 14, y: 6 }, foregripOffset: { x: 0, y: -1 } },
    'HEAVY-11':   { grip: { x: 20, y: -15 }, rearElbow: { x: 7, y: 0 }, supportElbow: { x: 16, y: 4 }, foregripOffset: { x: 0, y: 1 } },
    'HEAVY-12':   { grip: { x: 20, y: -15 }, rearElbow: { x: 7, y: 0 }, supportElbow: { x: 17, y: 4 }, foregripOffset: { x: 0, y: -1 } },
    'HEAVY-13':   { grip: { x: 19, y: -11 }, supportElbow: { x: 14, y: 7 }, foregripOffset: { x: 0, y: 1 } },
    'HEAVY-14':   { grip: { x: 19, y: -11 }, supportElbow: { x: 15, y: 7 }, foregripOffset: { x: 0, y: 1 } }
  };

  function isObj(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  function mergeHold(a, b) {
    const out = {};
    Object.keys(a || {}).forEach((k) => {
      out[k] = isObj(a[k]) ? Object.assign({}, a[k]) : a[k];
    });
    Object.keys(b || {}).forEach((k) => {
      out[k] = isObj(b[k]) && isObj(out[k]) ? Object.assign({}, out[k], b[k]) : b[k];
    });
    return out;
  }

  function getHold(weapon) {
    const base = HOLD_PROFILES[weapon.holdStyle || weapon.type] || HOLD_PROFILES.rifle;
    return mergeHold(mergeHold(base, HOLD_VARIANTS[weapon.holdVariant] || null), HOLD_OVERRIDES[weapon.name] || null);
  }

  function add(a, b) {
    if (!b) return { x: a.x, y: a.y };
    return { x: a.x + (b.x || 0), y: a.y + (b.y || 0) };
  }

  function rotatePoint(p, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return {
      x: c * p.x - s * p.y,
      y: s * p.x + c * p.y
    };
  }

  function worldPoint(originX, originY, x, y) {
    return {
      x: Math.round(originX + (x - originX) * BODY_SCALE),
      y: Math.round(originY + (y - originY) * BODY_SCALE)
    };
  }

  function withBodyScale(ctx, originX, originY, fn) {
    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(BODY_SCALE, BODY_SCALE);
    ctx.translate(-originX, -originY);
    fn();
    ctx.restore();
  }

  function motionOf(frame) {
    if (frame.motion) return frame.motion;
    if (frame.reloadPhase) return 'reload';
    if (frame.muzzleFlash || frame.weaponAngle) return 'shoot';
    if (frame.weaponDropped || frame.deathAngle) return 'dead';
    return 'idle';
  }

  function computeGrip(originX, originY, hold, frame, upperBodyDXLocal) {
    const motion = motionOf(frame);
    let grip = {
      x: originX + hold.grip.x + upperBodyDXLocal * BODY_SCALE,
      y: originY + hold.grip.y + (frame.bodyDY || 0) * BODY_SCALE
    };

    if (motion === 'run') grip = add(grip, hold.runGrip);
    else if (motion === 'walk') grip = add(grip, hold.walkGrip);
    else if (motion === 'reload') grip = add(grip, hold.reloadGrip);
    else if (motion === 'hurt') grip = add(grip, hold.hurtGrip);
    else if (motion === 'dead') grip = add(grip, hold.deadGrip);

    const recoil = Math.abs(frame.weaponDX || 0);
    grip.x += (frame.weaponDX || 0) * (hold.recoilBack || 1);
    grip.y += (frame.weaponDY || 0) + recoil * (hold.recoilLift || 0);

    return {
      x: Math.round(grip.x),
      y: Math.round(grip.y)
    };
  }

  function computeAngle(hold, frame) {
    const motion = motionOf(frame);
    let angle = (hold.baseAngle || 0) +
      (frame.aimAngle || 0) * (hold.aimWeight == null ? 1 : hold.aimWeight) +
      (frame.weaponAngle || 0) * (hold.recoilAngleScale == null ? 1 : hold.recoilAngleScale);

    if (motion === 'run') angle += hold.runAngle || 0;
    else if (motion === 'reload') angle += hold.reloadAngle || 0;
    else if (motion === 'hurt') angle += hold.hurtAngle || 0.08;
    else if (motion === 'dead') angle += hold.deadAngle || 0.18;

    return angle;
  }

  function supportLocalPoint(weapon, hold, frame) {
    if (frame.backHandToMag) {
      const magX = Math.max(weapon.gripX + 3, Math.min(weapon.foregripX - 2, weapon.gripX + 12));
      return {
        x: magX - weapon.gripX,
        y: Math.max(weapon.gripY + 2, weapon.foregripY + 2) - weapon.gripY
      };
    }

    return {
      x: weapon.foregripX - weapon.gripX + ((hold.foregripOffset && hold.foregripOffset.x) || 0),
      y: weapon.foregripY - weapon.gripY + ((hold.foregripOffset && hold.foregripOffset.y) || 0)
    };
  }

  function pointOnWeapon(grip, local, angle) {
    const r = rotatePoint({
      x: local.x * WEAPON_SCALE,
      y: local.y * WEAPON_SCALE
    }, angle);
    return {
      x: Math.round(grip.x + r.x),
      y: Math.round(grip.y + r.y)
    };
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function resolveElbow(shoulder, preferred, hand, weapon, role) {
    const dx = hand.x - shoulder.x;
    const dy = hand.y - shoulder.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return preferred;

    const compact = weapon.type === 'pistol' || weapon.type === 'smg';
    const heavyCarry = weapon.type === 'shotgun' || weapon.type === 'heavy';
    const isSupport = role === 'support';
    const minT = isSupport ? (compact ? 0.25 : 0.3) : (compact ? 0.22 : 0.25);
    const maxT = isSupport ? (compact ? 0.78 : 0.82) : 0.76;
    const minBend = isSupport ? (compact ? 1.2 : 2.2) : (compact ? 0.8 : 1.4);
    const maxBend = isSupport ? (heavyCarry ? 13 : 11) : (compact ? 8 : 10);
    const liftAllowance = isSupport ? 2 : 3;
    const dropAllowance = heavyCarry ? 16 : 13;

    const ux = dx / len;
    const uy = dy / len;
    let nx = -uy;
    let ny = ux;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
    }

    const px = preferred.x - shoulder.x;
    const py = preferred.y - shoulder.y;
    let along = px * ux + py * uy;
    let bend = px * nx + py * ny;

    along = clamp(along, len * minT, len * maxT);
    bend = clamp(bend, minBend, Math.min(maxBend, Math.max(minBend + 1, len * 0.45)));

    let x = shoulder.x + ux * along + nx * bend;
    let y = shoulder.y + uy * along + ny * bend;
    x = clamp(x, Math.min(shoulder.x, hand.x) - 1, Math.max(shoulder.x, hand.x) + 1);
    y = clamp(y, Math.min(shoulder.y, hand.y) - liftAllowance, Math.max(shoulder.y, hand.y) + dropAllowance);

    return { x: Math.round(x), y: Math.round(y) };
  }

  function drawMuzzleFlash(ctx, weapon) {
    const mx = (weapon.muzzleX - weapon.gripX);
    const my = (weapon.muzzleY - weapon.gripY);
    ctx.fillStyle = '#ffe080';
    ctx.fillRect(mx, my - 1, 3, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx + 1, my, 1, 1);
    ctx.fillStyle = '#ff8020';
    ctx.fillRect(mx + 3, my, 1, 1);
    ctx.fillRect(mx, my - 2, 1, 1);
    ctx.fillRect(mx, my + 2, 1, 1);
  }

  function drawBentArm(ctx, shoulder, elbow, hand, uniform, smooth) {
    if (smooth && Parts.drawBentArmHD) {
      Parts.drawBentArmHD(ctx, shoulder.x, shoulder.y, elbow.x, elbow.y, hand.x, hand.y, uniform, P.gloves, {
        scale: BODY_SCALE,
        handLarge: true
      });
    } else if (Parts.drawBentArm) {
      Parts.drawBentArm(ctx, shoulder.x, shoulder.y, elbow.x, elbow.y, hand.x, hand.y, uniform, P.gloves, {
        thick: true,
        handLarge: true
      });
    } else {
      Parts.drawArm(ctx, shoulder.x, shoulder.y, hand.x, hand.y, uniform, P.gloves);
    }
  }

  function drawGripHand(ctx, hand, smooth) {
    if (smooth && Parts.drawHandHD) {
      Parts.drawHandHD(ctx, hand.x, hand.y, P.gloves, { scale: BODY_SCALE, large: true });
    } else if (Parts.drawHand) {
      Parts.drawHand(ctx, hand.x, hand.y, P.gloves, { large: true });
    }
  }

  function stanceLegs(frame, hold) {
    const legs = Object.assign({ front: 0, back: 0, frontBend: 0, backBend: 0 }, frame.legs || {});
    const strideLegs = (
      typeof legs.frontStep === 'number' ||
      typeof legs.backStep === 'number' ||
      typeof legs.frontLift === 'number' ||
      typeof legs.backLift === 'number'
    );
    if (!strideLegs && (frame.stance === 'wide' || hold.stanceWide)) {
      legs.frontBend = Math.max(legs.frontBend || 0, 1);
    }
    if (!strideLegs && hold.upperBodyX) {
      legs.back = Math.min(legs.back || 0, -1);
      legs.frontBend = Math.max(legs.frontBend || 0, 1);
    }
    return legs;
  }

  function renderFrame(ctx, stageW, stageH, cfg, anim, frameIdx, facing, options) {
    options = options || {};
    facing = facing || 1;
    const frame = anim.get(frameIdx);
    const renderScale = options.renderScale || 1;
    const smooth = options.smooth === true;

    const skin = P.skin[cfg.skinIdx];
    const hair = P.hair[cfg.hairIdx];
    const eye  = P.eye[cfg.eyeIdx];
    const uniform = P.uniforms[cfg.uniformIdx];
    const pants = P.pants[cfg.pantsIdx];
    const vest  = cfg.vestOn ? P.vest[cfg.vestIdx] : null;
    const pack  = cfg.backpackOn ? P.backpack[cfg.backpackIdx] : null;
    const hatKind = P.hat[cfg.hatIdx].name;
    const hatCol = P.hat[cfg.hatIdx];
    const hairStyle = P.hairstyles[cfg.hairStyleIdx].name;
    const weapon = window.Weapons.list[cfg.weaponIdx] || window.Weapons.list[0];
    const hold = getHold(weapon);
    const drawBackpack = smooth && Parts.drawBackpackHD ? Parts.drawBackpackHD : Parts.drawBackpack;
    const drawWaistBridge = smooth && Parts.drawWaistBridgeHD ? Parts.drawWaistBridgeHD : Parts.drawWaistBridge;
    const drawNeck = smooth && Parts.drawNeckHD ? Parts.drawNeckHD : Parts.drawNeck;
    const drawHead = smooth && Parts.drawHeadHD ? Parts.drawHeadHD : Parts.drawHead;
    const drawHair = smooth && Parts.drawHairHD ? Parts.drawHairHD : Parts.drawHair;
    const drawHat = smooth && Parts.drawHatHD ? Parts.drawHatHD : Parts.drawHat;
    const drawEye = smooth && Parts.drawEyeHD ? Parts.drawEyeHD : Parts.drawEye;
    const drawTorso = smooth && Parts.drawTorsoHD ? Parts.drawTorsoHD : Parts.drawTorso;
    const drawVest = smooth && Parts.drawVestHD ? Parts.drawVestHD : Parts.drawVest;
    const drawLegs = smooth && Parts.drawLegsHD ? Parts.drawLegsHD : Parts.drawLegs;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    E.clear(ctx, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();

    ctx.save();
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.imageSmoothingEnabled = smooth;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = frame.alpha || 1;

    ctx.save();
    const originX = (stageW / 2) | 0;
    const originY = Math.round(stageH * 0.63);
    const upperBodyDXLocal = (hold.upperBodyX || 0) + (frame.forwardLean || 0);

    if (frame.rollAngle) {
      ctx.translate(originX, originY - 4 + (frame.bodyDY || 0));
      ctx.rotate(facing * frame.rollAngle);
      ctx.translate(-originX, -(originY - 4 + (frame.bodyDY || 0)));
    }
    if (frame.deathAngle) {
      ctx.translate(originX, originY);
      ctx.rotate(facing * frame.deathAngle);
      ctx.translate(-originX, -originY);
    }

    if (facing === -1) {
      ctx.translate(originX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-originX, 0);
    }

    const bodyDY = frame.bodyDY || 0;
    const headDY = frame.headDY || 0;
    const torsoStretchY = Math.max(0, frame.torsoStretch || 0);

    const torsoTL_x = originX - 3 + upperBodyDXLocal;
    const torsoTL_y = originY - 8 + bodyDY;
    const headTL_x = originX - 4 + upperBodyDXLocal;
    const headTL_y = originY - 16 + bodyDY + headDY + (frame.headBack ? -1 : 0);
    const legsTL_x = originX - 3;
    const legsTL_y = originY;

    // Arm anchors at the actual corners of the torso top row. Front shoulder
    // is on the LEFT (closer to viewer in this 3/4 rotation); back on the
    // RIGHT (further from viewer). The trigger arm therefore reaches across
    // the body to the weapon grip — the classic minitroopers shooting pose.
    const shoulderFront = worldPoint(originX, originY, torsoTL_x + 0, torsoTL_y + 1);
    const shoulderBack = worldPoint(originX, originY, torsoTL_x + 6, torsoTL_y + 1);

    const weaponGrip = computeGrip(originX, originY, hold, frame, upperBodyDXLocal);
    const aim = computeAngle(hold, frame);

    let supportHand = null;
    if (
      (weapon.twoHanded || hold.support === true) &&
      hold.support !== false &&
      !frame.tuck &&
      !frame.weaponDropped &&
      !frame.useGrenade
    ) {
      supportHand = pointOnWeapon(weaponGrip, supportLocalPoint(weapon, hold, frame), aim);
    }

    let throwHand = null;
    if (frame.useGrenade) {
      const throwAim = frame.aimAngle || -0.8;
      throwHand = {
        x: Math.round(shoulderFront.x + Math.cos(throwAim) * 22),
        y: Math.round(shoulderFront.y + Math.sin(throwAim) * 22)
      };
    }

    if (pack) {
      withBodyScale(ctx, originX, originY, function () {
        drawBackpack(ctx, torsoTL_x, torsoTL_y, pack);
      });
    }

    if (supportHand && !frame.tuck) {
      const elbow = resolveElbow(shoulderBack, {
        x: Math.round(shoulderBack.x + (hold.supportElbow ? hold.supportElbow.x : 12)),
        y: Math.round(shoulderBack.y + (hold.supportElbow ? hold.supportElbow.y : 3))
      }, supportHand, weapon, 'support');
      drawBentArm(ctx, shoulderBack, elbow, supportHand, uniform, smooth);
    }

    withBodyScale(ctx, originX, originY, function () {
      drawLegs(ctx, legsTL_x, legsTL_y, pants, stanceLegs(frame, hold));
      drawWaistBridge(ctx, torsoTL_x, torsoTL_y + 8 + (smooth ? torsoStretchY : Math.ceil(torsoStretchY)), legsTL_y, pants);
      drawTorso(ctx, torsoTL_x, torsoTL_y, uniform, { stretchY: torsoStretchY });
      if (vest) drawVest(ctx, torsoTL_x, torsoTL_y, vest);
      if (pack) {
        const strap = pack.shade;
        for (let i = 0; i < 5; i++) {
          E.px(ctx, torsoTL_x + 1 + i, torsoTL_y + 1 + i, strap);
        }
      }
      drawNeck(ctx, originX + upperBodyDXLocal, headTL_y + 8, torsoTL_y, skin);
      drawHead(ctx, headTL_x, headTL_y, skin, { hurt: frame.mouthHurt });

      if (!hatCol || hatKind === 'None' || hatKind === 'Bandana') {
        drawHair(ctx, headTL_x, headTL_y, hairStyle, hair);
      } else if (hatKind === 'Cap' || hatKind === 'Boonie') {
        if (hairStyle === 'Long' || hairStyle === 'Ponytail' || hairStyle === 'Messy') {
          drawHair(ctx, headTL_x, headTL_y, hairStyle, hair);
        }
      }

      if (hatCol && hatKind !== 'None') {
        drawHat(ctx, headTL_x, headTL_y, hatKind, hatCol);
      }

      drawEye(ctx, headTL_x, headTL_y, eye.base, { closed: frame.eyesClosed });
    });

    const showWeapon = frame.showWeapon !== false && !frame.weaponDropped;
    if (showWeapon) {
      if (frame.useGrenade) {
        const g = window.Weapons.grenade;
        ctx.save();
        ctx.translate(throwHand.x, throwHand.y);
        ctx.rotate(frame.aimAngle || 0);
        g.draw(ctx, 0, 0, false);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(weaponGrip.x, weaponGrip.y);
        ctx.rotate(aim);
        ctx.scale(WEAPON_SCALE, WEAPON_SCALE);
        weapon.draw(ctx, 0, 0, false);
        if (frame.muzzleFlash) drawMuzzleFlash(ctx, weapon);
        ctx.restore();
      }
    }

    if (supportHand && showWeapon) drawGripHand(ctx, supportHand, smooth);

    if (frame.useGrenade) {
      const elbow = {
        x: Math.round((shoulderFront.x + throwHand.x) / 2),
        y: Math.round((shoulderFront.y + throwHand.y) / 2) - 4
      };
      drawBentArm(ctx, shoulderFront, elbow, throwHand, uniform, smooth);
    } else if (!frame.tuck) {
      const elbow = resolveElbow(shoulderFront, {
        x: Math.round(shoulderFront.x + (hold.rearElbow ? hold.rearElbow.x : 9)),
        y: Math.round(shoulderFront.y + (hold.rearElbow ? hold.rearElbow.y : 1))
      }, weaponGrip, weapon, 'rear');
      drawBentArm(ctx, shoulderFront, elbow, weaponGrip, uniform, smooth);
    }

    if (frame.grenadeReleased) {
      const g = window.Weapons.grenade;
      ctx.save();
      ctx.translate(throwHand.x + 6, throwHand.y - 3);
      g.draw(ctx, 0, 0, false);
      ctx.restore();
    }

    ctx.restore();

    if (frame.tint) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = frame.tint;
      ctx.fillRect(0, 0, stageW, stageH);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  window.CharacterRenderer = { renderFrame, getWeaponHold: getHold };
})();
