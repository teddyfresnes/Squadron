// Renderer - composes a full character frame onto a canvas.
// Weapons keep their native sprite pixels. The soldier is drawn at 2x in the
// same stage so a pistol reads small, rifles read shoulder-fired, and long
// weapons stay impressive without dwarfing the body.

(function () {
  const E = window.Engine;
  const P = window.Palette;
  const Parts = window.Parts;

  const BODY_SCALE = 2;

  const HOLD_PROFILES = {
    pistol: {
      support: false,
      grip: { x: 25, y: -15 },
      baseAngle: -0.05,
      aimWeight: 0.55,
      rearElbow: { x: 11, y: -1 },
      recoilBack: 0.7,
      recoilLift: -0.3,
      recoilAngleScale: 0.9,
      runGrip: { x: -5, y: 5 },
      runAngle: 0.14,
      reloadGrip: { x: -4, y: 4 },
      reloadAngle: 0.12,
      hurtGrip: { x: -5, y: 5 },
      deadGrip: { x: -8, y: 5 }
    },
    smg: {
      support: true,
      grip: { x: 20, y: -8 },
      baseAngle: 0.02,
      aimWeight: 0.55,
      rearElbow: { x: 8, y: 3 },
      supportElbow: { x: 11, y: 4 },
      foregripOffset: { x: -1, y: 0 },
      recoilBack: 0.55,
      recoilLift: -0.15,
      recoilAngleScale: 0.45,
      runGrip: { x: -5, y: 3 },
      runAngle: 0.14,
      reloadGrip: { x: -2, y: 4 },
      reloadAngle: 0.08,
      hurtGrip: { x: -5, y: 4 },
      deadGrip: { x: -8, y: 5 }
    },
    rifle: {
      support: true,
      grip: { x: 21, y: -12 },
      baseAngle: -0.04,
      aimWeight: 0.65,
      rearElbow: { x: 8, y: 1 },
      supportElbow: { x: 16, y: 2 },
      foregripOffset: { x: -1, y: 0 },
      recoilBack: 0.8,
      recoilLift: -0.25,
      recoilAngleScale: 0.8,
      runGrip: { x: -6, y: 3 },
      runAngle: 0.14,
      reloadGrip: { x: -1, y: 5 },
      reloadAngle: 0.08,
      hurtGrip: { x: -5, y: 5 },
      deadGrip: { x: -8, y: 5 }
    },
    shotgun: {
      support: true,
      grip: { x: 20, y: -8 },
      baseAngle: 0.08,
      aimWeight: 0.55,
      rearElbow: { x: 8, y: 4 },
      supportElbow: { x: 19, y: 5 },
      foregripOffset: { x: 2, y: 0 },
      recoilBack: 1.35,
      recoilLift: -0.45,
      recoilAngleScale: 1.35,
      runGrip: { x: -7, y: 5 },
      runAngle: 0.18,
      reloadGrip: { x: -2, y: 6 },
      reloadAngle: 0.1,
      hurtGrip: { x: -6, y: 6 },
      deadGrip: { x: -9, y: 6 }
    },
    sniper: {
      support: true,
      grip: { x: 22, y: -14 },
      baseAngle: -0.08,
      aimWeight: 0.45,
      rearElbow: { x: 9, y: 0 },
      supportElbow: { x: 24, y: 1 },
      foregripOffset: { x: -4, y: 0 },
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
      grip: { x: 20, y: -5 },
      baseAngle: 0.11,
      aimWeight: 0.45,
      rearElbow: { x: 8, y: 7 },
      supportElbow: { x: 20, y: 8 },
      foregripOffset: { x: -2, y: 1 },
      recoilBack: 1.1,
      recoilLift: -0.15,
      recoilAngleScale: 0.7,
      upperBodyX: 1,
      runGrip: { x: -7, y: 6 },
      runAngle: 0.16,
      reloadGrip: { x: -2, y: 7 },
      reloadAngle: 0.08,
      hurtGrip: { x: -6, y: 7 },
      deadGrip: { x: -10, y: 7 }
    }
  };

  const HOLD_VARIANTS = {
    pocket: {
      grip: { x: 22, y: -14 },
      rearElbow: { x: 9, y: 0 },
      recoilBack: 0.45
    },
    'long-slide': {
      grip: { x: 26, y: -16 },
      rearElbow: { x: 12, y: -2 },
      recoilBack: 0.8
    },
    compact: {
      grip: { x: 18, y: -9 },
      rearElbow: { x: 7, y: 3 },
      supportElbow: { x: 9, y: 4 }
    },
    'tall-compact': {
      grip: { x: 18, y: -5 },
      baseAngle: 0.06,
      supportElbow: { x: 10, y: 6 }
    },
    'long-smg': {
      grip: { x: 20, y: -10 },
      supportElbow: { x: 15, y: 3 },
      foregripOffset: { x: -3, y: 0 }
    },
    'long-rifle': {
      grip: { x: 20, y: -12 },
      supportElbow: { x: 18, y: 1 },
      foregripOffset: { x: -2, y: 0 }
    },
    'short-shotgun': {
      grip: { x: 21, y: -7 },
      supportElbow: { x: 16, y: 6 },
      foregripOffset: { x: 0, y: 0 }
    },
    'long-shotgun': {
      grip: { x: 19, y: -8 },
      supportElbow: { x: 22, y: 5 },
      foregripOffset: { x: -1, y: 0 }
    },
    'long-sniper': {
      grip: { x: 20, y: -14 },
      supportElbow: { x: 28, y: 0 },
      foregripOffset: { x: -8, y: 0 },
      recoilBack: 1.15
    },
    'compact-sniper': {
      grip: { x: 23, y: -13 },
      supportElbow: { x: 21, y: 2 },
      foregripOffset: { x: -3, y: 0 }
    },
    launcher: {
      grip: { x: 21, y: -16 },
      baseAngle: -0.02,
      aimWeight: 0.35,
      rearElbow: { x: 8, y: 2 },
      supportElbow: { x: 19, y: 6 },
      foregripOffset: { x: -6, y: 2 },
      recoilLift: -0.08,
      runGrip: { x: -7, y: 5 },
      reloadGrip: { x: -3, y: 5 }
    },
    cannon: {
      grip: { x: 18, y: -2 },
      baseAngle: 0.13,
      rearElbow: { x: 7, y: 8 },
      supportElbow: { x: 20, y: 10 },
      foregripOffset: { x: -3, y: 2 },
      recoilBack: 1.25,
      runGrip: { x: -7, y: 7 },
      reloadGrip: { x: -3, y: 8 }
    }
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
    return mergeHold(base, HOLD_VARIANTS[weapon.holdVariant] || null);
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
    const r = rotatePoint(local, angle);
    return {
      x: Math.round(grip.x + r.x),
      y: Math.round(grip.y + r.y)
    };
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
    if (frame.stance === 'wide' || hold.stanceWide) {
      legs.frontBend = Math.max(legs.frontBend || 0, 1);
    }
    if (hold.upperBodyX) {
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

    const torsoTL_x = originX - 3 + upperBodyDXLocal;
    const torsoTL_y = originY - 8 + bodyDY;
    const headTL_x = originX - 4 + upperBodyDXLocal;
    const headTL_y = originY - 18 + bodyDY + headDY + (frame.headBack ? -1 : 0);
    const legsTL_x = originX - 3;
    const legsTL_y = originY;

    const shoulderFront = worldPoint(originX, originY, torsoTL_x + 5, torsoTL_y + 2);
    const shoulderBack = worldPoint(originX, originY, torsoTL_x + 1, torsoTL_y + 2);

    const weaponGrip = computeGrip(originX, originY, hold, frame, upperBodyDXLocal);
    const aim = computeAngle(hold, frame);

    let supportHand = null;
    if (weapon.twoHanded && hold.support !== false && !frame.tuck && !frame.weaponDropped && !frame.useGrenade) {
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
      const elbow = {
        x: Math.round(shoulderBack.x + (hold.supportElbow ? hold.supportElbow.x : 12)),
        y: Math.round(shoulderBack.y + (hold.supportElbow ? hold.supportElbow.y : 3))
      };
      drawBentArm(ctx, shoulderBack, elbow, supportHand, uniform, smooth);
    }

    withBodyScale(ctx, originX, originY, function () {
      drawLegs(ctx, legsTL_x, legsTL_y, pants, stanceLegs(frame, hold));
      drawWaistBridge(ctx, torsoTL_x, torsoTL_y + 8, legsTL_y);
      drawTorso(ctx, torsoTL_x, torsoTL_y, uniform);
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
      const elbow = {
        x: Math.round(shoulderFront.x + (hold.rearElbow ? hold.rearElbow.x : 9)),
        y: Math.round(shoulderFront.y + (hold.rearElbow ? hold.rearElbow.y : 1))
      };
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
