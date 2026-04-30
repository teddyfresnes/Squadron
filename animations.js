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
      gripOffset: null
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
    frames: 12,
    fps: 18,
    loop: false,
    get: function (i) {
      const d = mark(defaults(), 'aim', i);
      const t = i / 11;
      const raise = easeOutCubic(t);
      const settle = Math.sin(t * Math.PI);
      d.bodyDY = -0.35 * raise - 0.18 * settle;
      d.torsoStretch = 0.18 * raise;
      d.headDY = -0.08 * raise;
      d.aimAngle = 0;
      d.barrelAngle = 0;
      d.barrelLocked = true;
      d.gripOffset = {
        x: -4 * (1 - raise),
        y: 5 * (1 - raise)
      };
      d.legs = { front: 0, back: 0, frontBend: 0, backBend: 0 };
      d.stance = 'wide';  // legs spread
      return d;
    }
  };

  // ---------- SHOOT (4 frames: pre, bang+recoil, recoil-hold, reset) ----------
  Anims.shoot = {
    name: 'Shoot',
    frames: 4,
    fps: 14,
    get: function (i) {
      const d = mark(defaults(), 'shoot', i);
      d.aimAngle = 0;
      d.barrelAngle = 0;
      d.barrelLocked = true;
      d.stance = 'wide';
      if (i === 0) {
        d.weaponDX = 0;
        d.weaponAngle = 0;
        d.recoilStage = 'pre';
      } else if (i === 1) {
        d.weaponDX = -2;
        d.weaponAngle = 0;
        d.muzzleFlash = true;
        d.bodyDY = -1;
        d.recoilStage = 'kick';
      } else if (i === 2) {
        d.weaponDX = -1;
        d.weaponAngle = 0;
        d.recoilStage = 'settle';
      } else {
        d.weaponDX = 0;
        d.weaponAngle = 0;
        d.recoilStage = 'recover';
      }
      return d;
    }
  };

  // ---------- RELOAD (6 frames) ----------
  Anims.reload = {
    name: 'Reload',
    frames: 6,
    fps: 8,
    get: function (i) {
      const d = mark(defaults(), 'reload', i);
      d.stance = 'wide';
      // Weapon tilts downward, back hand moves to magazine
      const t = i / 5;
      d.weaponAngle = 0.3 + 0.2 * Math.sin(t * Math.PI);  // tilt down then back
      d.aimAngle = 0.25;
      d.reloadPhase = i < 3 ? 'eject' : 'insert';
      d.backHandToMag = true;
      return d;
    }
  };

  // ---------- HURT (3 frames) ----------
  Anims.hurt = {
    name: 'Hurt',
    frames: 3,
    fps: 8,
    get: function (i) {
      const d = mark(defaults(), 'hurt', i);
      if (i === 0) {
        d.bodyDY = -2;
        d.headDY = -1;   // small extra head snap-back on top of body recoil
        d.tint = '#ff2030';
        d.alpha = 0.9;
        d.headBack = 1;
        d.eyesClosed = true;
      } else if (i === 1) {
        d.bodyDY = -1;
        d.headDY = -1;
        d.tint = '#ff2030';
        d.alpha = 0.85;
        d.eyesClosed = true;
      } else {
        d.bodyDY = 0;
        d.headDY = 0;
      }
      d.aimAngle = 0.4;  // weapon drops
      d.mouthHurt = true;
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
  window.AnimList = ['idle', 'walk', 'run', 'aim', 'shoot', 'reload', 'hurt', 'dead', 'roll', 'throw'];
})();
