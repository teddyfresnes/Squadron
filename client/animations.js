// Animation system — each animation returns per-frame parameters that drive parts.js + weapons.js.
// Frame params include:
//   bodyDY        : vertical offset of whole body (breathing, hit reaction)
//   torsoStretch  : extra torso length used for soft breathing/idle extension
//   torsoRot      : small torso lean (unused for strict side, kept 0)
//   headDY        : head bob independent of body
//   legs          : { front: dy, back: dy, frontBend: knee forward pixels, backBend }
//   frontArm      : { hx, hy } hand pixel position (relative to body origin)
//   backArm       : { hx, hy } or null if hidden
//   weaponAngle   : extra rotation for weapon (radians)
//   weaponDX/DY   : small offsets (recoil)
//   barrelAngle   : exact rendered barrel angle, bypassing hold aim weighting
//   barrelLocked  : true keeps recoil from rotating a locked barrel
//   reloadHandT   : 0 ammo pouch -> 1 receiver/chamber while reloading
//   reloadRoundT  : matching local position for the visible round/shell
//   muzzleFlash   : true on shoot frames
//   blink / eyesClosed
//   deathAngle    : rotation when dead
//   rollAngle     : rotation for roll
//   showWeapon    : whether to draw weapon
//   showBody      : whether to draw (for roll we still show)
//   alpha         : overall opacity (hurt flash)
//   tint          : overlay color
//   overlay       : special layer fn
//
// Body origin: we treat (16, 24) as the "hip" / body pivot in the 64x64 stage.
// Sprite is drawn onto a larger canvas (e.g. 64x64) centered to allow arm/weapon extensions.

(function () {
  const TAU = Math.PI * 2;
  const Anims = {};

  // Shared: compute hand position for aiming at angle, given weapon.
  // shoulderX,shoulderY = shoulder pivot. armLen ~ 6 px.
  function armHand(sx, sy, angle, len) {
    return { hx: Math.round(sx + Math.cos(angle) * len), hy: Math.round(sy + Math.sin(angle) * len) };
  }

  // Defaults
  function defaults() {
    return {
      bodyDY: 0, headDY: 0, torsoStretch: 0,
      legs: { front: 0, back: 0, frontBend: 0, backBend: 0 },
      frontArm: null, backArm: null,
      weaponAngle: 0, weaponDX: 0, weaponDY: 0,
      muzzleFlash: false,
      muzzleFlashSize: 1,
      muzzleSmoke: 0,
      eyesClosed: false,
      deathAngle: 0, rollAngle: 0,
      showWeapon: true, showBody: true,
      alpha: 1, tint: null,
      handAtGrip: true,
      motion: 'idle',
      motionFrame: 0,
      aimAngle: 0,
      barrelAngle: null,
      barrelLocked: false,
      gripOffset: null,
      reloadHandT: null,
      reloadRoundT: null,
      reloadRoundVisible: false
    };
  }

  function mark(d, motion, frameIdx) {
    d.motion = motion;
    d.motionFrame = frameIdx || 0;
    return d;
  }

  function easeOutCubic(t) {
    const inv = 1 - t;
    return 1 - inv * inv * inv;
  }

  function easeInOutSine(t) {
    return 0.5 - Math.cos(Math.PI * t) * 0.5;
  }

  const SHOT_PROFILES = {
    pistol: { recoil: 1.4, lift: -0.1, angle: -0.035, bodyKick: 0.45, headKick: 0.05, flash: 0.9, smoke: 0.55, climb: 0 },
    auto: { recoil: 1.8, lift: -0.18, angle: -0.04, bodyKick: 0.35, headKick: 0.04, flash: 0.95, smoke: 0.75, climb: 0.018 },
    burst: { recoil: 2.0, lift: -0.2, angle: -0.05, bodyKick: 0.45, headKick: 0.06, flash: 1.05, smoke: 0.85, climb: 0.022 },
    shotgun: { recoil: 3.0, lift: -0.35, angle: -0.085, bodyKick: 1.0, headKick: 0.18, flash: 1.55, smoke: 1.8, climb: 0.01 },
    sniper: { recoil: 3.8, lift: -0.45, angle: -0.13, bodyKick: 1.35, headKick: 0.28, flash: 1.25, smoke: 1.75, climb: 0 },
    heavy: { recoil: 3.2, lift: -0.28, angle: -0.07, bodyKick: 0.95, headKick: 0.14, flash: 1.55, smoke: 2.1, climb: 0.014 }
  };

  function shotProfile(meta) {
    meta = meta || {};
    if (SHOT_PROFILES[meta.shotProfile]) return SHOT_PROFILES[meta.shotProfile];
    if (meta.weaponCategory === 'sniper') return SHOT_PROFILES.sniper;
    if (meta.weaponCategory === 'shotgun') return SHOT_PROFILES.shotgun;
    if (meta.weaponCategory === 'heavy') return SHOT_PROFILES.heavy;
    if (meta.weaponType === 'automatic') return SHOT_PROFILES.auto;
    if (meta.weaponType === 'burst') return SHOT_PROFILES.burst;
    if (meta.weaponCategory === 'pistol') return SHOT_PROFILES.pistol;
    return SHOT_PROFILES.auto;
  }

  // ---------- IDLE (8 frames, soft breathing) ----------
  Anims.idle = {
    name: 'Idle',
    frames: 8,
    fps: 8,
    get: function (i) {
      const d = mark(defaults(), 'idle', i);
      const breath = [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25][i];
      // The upper body rises a touch while the torso stretches back down to
      // the legs, avoiding the old separate hip filler shape.
      d.bodyDY = -breath;
      d.torsoStretch = breath;
      d.headDY = 0;
      d.legs = { front: 0, back: 0, frontBend: 0, backBend: 0 };
      // Arm hangs down naturally holding weapon low
      d.aimAngle = 0.15;  // slight downward
      return d;
    }
  };

  // ---------- WALK (16 frames, natural patrol step) ----------
  Anims.walk = {
    name: 'Walk',
    frames: 16,
    fps: 10,
    get: function (i) {
      const d = mark(defaults(), 'walk', i);
      const t = i / 16;
      const phase = t * TAU;
      const step = Math.sin(phase);
      const passing = Math.cos(phase);
      const passingRise = 0.5 + 0.5 * Math.cos(phase * 2);
      const frontLift = Math.max(0, passing) * 0.52;
      const backLift = Math.max(0, -passing) * 0.52;
      const bodyBob = 0.14 + 0.22 * passingRise;

      // Keep the walk upright and readable: smaller stride, soft passing rise,
      // and just enough knee bend to avoid a sliding-foot look.
      d.bodyDY = -bodyBob;
      d.torsoStretch = bodyBob;
      d.headDY = Math.sin(phase * 2) * 0.05;
      d.legs = {
        front: 0,
        back: 0,
        frontStep: step * 0.72,
        backStep: -step * 0.72,
        frontLift: frontLift,
        backLift: backLift,
        frontBend: step * 0.34 + frontLift * 0.24,
        backBend: -step * 0.34 + backLift * 0.24
      };
      d.aimAngle = 0.12 + Math.sin(phase * 2) * 0.01;
      return d;
    }
  };

  // ---------- RUN (8 frames, pronounced sprint stride) ----------
  Anims.run = {
    name: 'Run',
    frames: 8,
    fps: 16,
    get: function (i) {
      const d = mark(defaults(), 'run', i);
      const t = i / 8;
      const phase = t * TAU;
      const stride = Math.sin(phase);
      const planted = Math.cos(phase);
      const frontSwing = Math.max(0, planted);
      const backSwing = Math.max(0, -planted);
      const pushOff = 0.5 + 0.5 * Math.cos(phase * 2);
      const bodyBob = 0.16 + 0.24 * pushOff;

      // Run should read as a different gait, not just a faster walk: longer
      // stride, higher knee lift, and a forward carry posture. The vertical
      // bob stays restrained so the vest does not shimmer around the pelvis.
      d.bodyDY = -bodyBob;
      d.torsoStretch = bodyBob;
      d.headDY = Math.sin(phase * 2) * 0.08;
      d.legs = {
        front: 0,
        back: 0,
        frontStep: stride * 1.72,
        backStep: -stride * 1.72,
        frontLift: frontSwing * 1.25,
        backLift: backSwing * 1.25,
        frontBend: frontSwing * 0.95 + Math.max(0, stride) * 0.22 - Math.max(0, -stride) * 0.34,
        backBend: backSwing * 0.95 + Math.max(0, -stride) * 0.22 - Math.max(0, stride) * 0.34
      };
      d.aimAngle = 0.18;  // lower, non-aimed carry while running
      d.weaponAngle = Math.sin(phase) * 0.035;
      d.weaponDY = Math.sin(phase * 2) * 0.25;
      d.forwardLean = 0.35;
      return d;
    }
  };

  // ---------- AIM (smooth shoulder raise, then hold) ----------
  Anims.aim = {
    name: 'Aim',
    frames: 8,
    fps: 18,
    loop: false,
    get: function (i) {
      const d = mark(defaults(), 'aim', i);
      const t = easeInOutSine(i / 7);
      d.lowCarryT = 1 - t;
      d.aimAngle = 0;
      d.bodyDY = -0.12 * t;
      d.headDY = -0.03 * t;
      d.gripOffset = {
        x: -0.4 * t,
        y: 0.6 * (1 - t)
      };
      d.legs = { front: 0, back: 0, frontBend: 0, backBend: 0 };
      d.stance = 'wide';  // legs spread
      return d;
    }
  };

  // ---------- SHOOT (6 frames: bang, smoke, settle, reset) ----------
  Anims.shoot = {
    name: 'Shoot',
    frames: 6,
    fps: 20,
    loop: false,
    get: function (i, meta) {
      const d = mark(defaults(), 'shoot', i);
      const p = shotProfile(meta);
      const shotIndex = meta && meta.shotIndex ? meta.shotIndex : 0;
      const burstClimb = Math.min(0.06, shotIndex * (p.climb || 0));
      d.aimAngle = 0;
      d.barrelAngle = 0;
      d.barrelLocked = false;
      d.stance = 'wide';
      if (i === 0) {
        d.weaponDX = -p.recoil;
        d.weaponDY = p.lift;
        d.weaponAngle = p.angle - burstClimb;
        d.muzzleFlash = true;
        d.muzzleFlashSize = p.flash;
        d.muzzleSmoke = p.smoke * 0.55;
        d.bodyDY = -p.bodyKick;
        d.headDY = -p.headKick;
        d.recoilStage = 'kick';
      } else if (i === 1) {
        d.weaponDX = -p.recoil * 0.55;
        d.weaponDY = p.lift * 0.45;
        d.weaponAngle = (p.angle - burstClimb) * 0.55;
        d.muzzleSmoke = p.smoke;
        d.bodyDY = -p.bodyKick * 0.45;
        d.headDY = -p.headKick * 0.35;
        d.recoilStage = 'settle';
      } else if (i === 2) {
        d.weaponDX = -p.recoil * 0.2;
        d.weaponAngle = (p.angle - burstClimb) * 0.18;
        d.muzzleSmoke = p.smoke * 0.75;
        d.recoilStage = 'smoke';
      } else if (i === 3) {
        d.weaponDX = -p.recoil * 0.08;
        d.weaponAngle = 0;
        d.muzzleSmoke = p.smoke * 0.35;
        d.recoilStage = 'recover';
      } else {
        d.weaponDX = 0;
        d.weaponAngle = 0;
        d.recoilStage = 'ready';
      }
      return d;
    }
  };

  // ---------- UNAIM (lower weapon after a completed shot action) ----------
  Anims.unaim = {
    name: 'Lower Weapon',
    frames: 8,
    fps: 18,
    loop: false,
    get: function (i) {
      const d = mark(defaults(), 'unaim', i);
      const t = easeInOutSine(i / 7);
      d.lowCarryT = t;
      d.aimAngle = 0;
      d.barrelAngle = null;
      d.stance = 'wide';
      d.bodyDY = -0.12 * (1 - t);
      d.gripOffset = {
        x: -0.4 * (1 - t),
        y: 0.6 * t
      };
      return d;
    }
  };

  // ---------- RELOAD (kneel, then load round-by-round) ----------
  Anims.reload = {
    name: 'Reload',
    frames: 32,
    fps: 12,
    loop: false,
    get: function (i) {
      const d = mark(defaults(), 'reload', i);
      const kneelFrames = 6;
      const roundFrames = 6;
      const roundCount = 4;
      const kneel = i < kneelFrames ? easeOutCubic(i / (kneelFrames - 1)) : 1;
      const settle = Math.sin(Math.min(1, i / (kneelFrames - 1)) * Math.PI);

      d.stance = 'kneel';
      d.legs = { pose: 'kneel', kneel };
      d.bodyDY = 2.15 * kneel - 0.15 * settle;
      d.torsoStretch = 0.1 * kneel;
      d.headDY = -0.08 * kneel;
      d.forwardLean = 0.22 * kneel;
      d.aimAngle = 0.16;
      d.weaponAngle = 0.28 + 0.2 * kneel + Math.sin(i * 0.7) * 0.018;
      d.gripOffset = {
        x: -2.5 * kneel,
        y: 3.5 * kneel
      };

      if (i < kneelFrames) {
        d.reloadPhase = 'kneel';
        return d;
      }

      const workFrame = i - kneelFrames;
      const roundIdx = Math.floor(workFrame / roundFrames);
      if (roundIdx >= roundCount) {
        d.reloadPhase = 'check';
        d.reloadHandT = 1;
        d.gripOffset.y += 0.4;
        return d;
      }

      const cycleT = (workFrame % roundFrames) / (roundFrames - 1);
      let handT;
      if (cycleT < 0.18) {
        handT = 0;
      } else if (cycleT < 0.62) {
        handT = easeOutCubic((cycleT - 0.18) / 0.44);
      } else if (cycleT < 0.82) {
        handT = 1;
      } else {
        handT = 1 - easeInOutSine((cycleT - 0.82) / 0.18) * 0.72;
      }

      d.reloadPhase = cycleT < 0.55 ? 'fetch-round' : (cycleT < 0.82 ? 'seat-round' : 'reach-round');
      d.reloadHandT = handT;
      d.reloadRoundT = handT;
      d.reloadRoundVisible = cycleT >= 0.08 && cycleT <= 0.82;
      d.reloadRoundIndex = roundIdx + 1;
      return d;
    }
  };

  // ---------- HURT (5 frames) ----------
  // Smooth backward stagger then return to rest. No tint, no head snap —
  // just a clean recoil along the facing axis (bodyDX = backward).
  Anims.hurt = {
    name: 'Hurt',
    frames: 5,
    fps: 16,
    loop: false,
    get: function (i) {
      const d = mark(defaults(), 'hurt', i);
      const recoil = [4, 3, 2, 1, 0][i] || 0;
      d.bodyDX = recoil;
      d.bodyDY = i === 0 ? -1 : 0;   // tiny upward jolt on impact
      d.aimAngle = 0.35 * (recoil / 4); // weapon dips with the stagger and recovers
      return d;
    }
  };

  // ---------- DEAD (6 frames: fall, 1 rest hold) ----------
  Anims.dead = {
    name: 'Dead',
    frames: 6,
    fps: 8,
    loop: false,
    get: function (i) {
      const d = mark(defaults(), 'dead', i);
      const fall = Math.min(1, i / 4);
      d.deathAngle = fall * (Math.PI / 2);  // rotate 90° to face down
      d.bodyDY = Math.round(fall * 6);
      d.eyesClosed = true;
      d.aimAngle = 0.4;
      d.showWeapon = true;
      d.weaponDropped = i >= 4;
      return d;
    }
  };

  // ---------- ROLL (8 frames) ----------
  Anims.roll = {
    name: 'Roll',
    frames: 8,
    fps: 16,
    get: function (i) {
      const d = mark(defaults(), 'roll', i);
      const t = i / 8;
      d.rollAngle = t * TAU;  // full rotation
      d.bodyDY = -Math.round(Math.sin(t * Math.PI) * 3);
      d.tuck = true;  // compact pose
      d.aimAngle = 0.3;
      d.showWeapon = i < 2 || i > 6;  // hide during tuck for clarity
      return d;
    }
  };

  // ---------- THROW GRENADE (6 frames) ----------
  Anims.throw = {
    name: 'Throw Grenade',
    frames: 6,
    fps: 10,
    get: function (i) {
      const d = mark(defaults(), 'throw', i);
      // Wind up -> throw -> follow-through
      if (i <= 2) {
        d.aimAngle = 1.6 - i * 0.4;  // arm way up behind
        d.throwPhase = 'windup';
        d.bodyDY = 0;
      } else if (i === 3) {
        d.aimAngle = -1.2;  // arm forward/up
        d.throwPhase = 'release';
        d.bodyDY = -1;
        d.grenadeReleased = true;
      } else {
        d.aimAngle = -0.6 + (i - 4) * 0.3;
        d.throwPhase = 'follow';
      }
      d.stance = 'wide';
      d.useGrenade = true;
      return d;
    }
  };

  window.Anims = Anims;
  window.AnimList = ['idle', 'walk', 'run', 'aim', 'shoot', 'unaim', 'reload', 'hurt', 'dead', 'roll', 'throw'];
})();
