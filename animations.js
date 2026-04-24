// Animation system — each animation returns per-frame parameters that drive parts.js + weapons.js.
// Frame params include:
//   bodyDY        : vertical offset of whole body (breathing, hit reaction)
//   torsoRot      : small torso lean (unused for strict side, kept 0)
//   headDY        : head bob independent of body
//   legs          : { front: dy, back: dy, frontBend: knee forward pixels, backBend }
//   frontArm      : { hx, hy } hand pixel position (relative to body origin)
//   backArm       : { hx, hy } or null if hidden
//   weaponAngle   : extra rotation for weapon (radians)
//   weaponDX/DY   : small offsets (recoil)
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
      bodyDY: 0, headDY: 0,
      legs: { front: 0, back: 0, frontBend: 0, backBend: 0 },
      frontArm: null, backArm: null,
      weaponAngle: 0, weaponDX: 0, weaponDY: 0,
      muzzleFlash: false,
      eyesClosed: false,
      deathAngle: 0, rollAngle: 0,
      showWeapon: true, showBody: true,
      alpha: 1, tint: null,
      handAtGrip: true,
      aimAngle: 0
    };
  }

  // ---------- IDLE (4 frames, gentle breathing) ----------
  Anims.idle = {
    name: 'Idle',
    frames: 4,
    fps: 4,
    get: function (i) {
      const d = defaults();
      const bob = [0, 0, -1, 0][i];
      d.bodyDY = bob;
      // headDY is additive on top of bodyDY; keep it 0 so the head rides with
      // the torso during breathing and the neck stays tight.
      d.headDY = 0;
      d.legs = { front: 0, back: 0, frontBend: 0, backBend: 0 };
      // Arm hangs down naturally holding weapon low
      d.aimAngle = 0.15;  // slight downward
      return d;
    }
  };

  // ---------- WALK (8 frames) ----------
  Anims.walk = {
    name: 'Walk',
    frames: 8,
    fps: 10,
    get: function (i) {
      const d = defaults();
      const t = i / 8;
      const cycle = Math.sin(t * TAU);
      const cycle2 = Math.sin(t * TAU + Math.PI);
      // Vertical bob — head rides with the body to keep the neck tight.
      d.bodyDY = Math.abs(cycle) > 0.7 ? 0 : -1;
      d.headDY = 0;
      // Legs out of phase
      const frontLift = Math.max(0, cycle) * 2;
      const backLift = Math.max(0, cycle2) * 2;
      d.legs = {
        front: -Math.round(frontLift),
        back: -Math.round(backLift),
        frontBend: cycle > 0.3 ? 1 : 0,
        backBend: cycle2 > 0.3 ? 1 : 0
      };
      d.aimAngle = 0.1;
      return d;
    }
  };

  // ---------- RUN (6 frames, faster, bigger motion) ----------
  Anims.run = {
    name: 'Run',
    frames: 6,
    fps: 14,
    get: function (i) {
      const d = defaults();
      const t = i / 6;
      const cycle = Math.sin(t * TAU);
      const cycle2 = Math.sin(t * TAU + Math.PI);
      d.bodyDY = -Math.round((Math.abs(cycle) * 2));
      d.headDY = 0;
      d.legs = {
        front: -Math.round(Math.max(0, cycle) * 3),
        back: -Math.round(Math.max(0, cycle2) * 3),
        frontBend: cycle > 0.2 ? 2 : 0,
        backBend: cycle2 > 0.2 ? 2 : 0
      };
      d.aimAngle = -0.05;  // weapon slightly forward/up while running
      d.forwardLean = 1;
      return d;
    }
  };

  // ---------- AIM (2 frames, hold) ----------
  Anims.aim = {
    name: 'Aim',
    frames: 2,
    fps: 2,
    get: function (i) {
      const d = defaults();
      d.bodyDY = i === 1 ? -1 : 0;
      d.headDY = 0;
      d.aimAngle = -0.1;  // slight upward
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
      const d = defaults();
      d.aimAngle = -0.1;
      d.stance = 'wide';
      if (i === 0) {
        d.weaponDX = 0;
        d.weaponAngle = 0;
      } else if (i === 1) {
        d.weaponDX = -2;
        d.weaponAngle = -0.15;
        d.muzzleFlash = true;
        d.bodyDY = -1;
      } else if (i === 2) {
        d.weaponDX = -1;
        d.weaponAngle = -0.08;
      } else {
        d.weaponDX = 0;
        d.weaponAngle = 0;
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
      const d = defaults();
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
      const d = defaults();
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
      const d = defaults();
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
      const d = defaults();
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
      const d = defaults();
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
