// Renderer — composes a full character frame onto a canvas.
// Works on a stage canvas (default 64x64 to allow extended arms/weapons around the 32x32 body).
// Body origin = (stageCx, stageCy) — the hips pivot at pixel (stageCx, stageCy).

(function () {
  const E = window.Engine;
  const P = window.Palette;
  const Parts = window.Parts;

  // Layout anchors relative to body origin (hips).
  // torsoTL = (originX - 3, originY - 8)      -> torso box 7 wide × 8 tall
  // headTL  = (originX - 4, originY - 20)     -> head 8 × 9
  // shoulderFront = (originX + 2, originY - 7)
  // shoulderBack  = (originX - 1, originY - 7)
  // legsTL  = (originX - 3, originY)          -> legs area y 0..7
  //
  // All coords in the 64x64 stage.

  function renderFrame(ctx, stageW, stageH, cfg, anim, frameIdx, facing) {
    facing = facing || 1;  // +1 right, -1 left
    const frame = anim.get(frameIdx);

    // Pick data from config
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
    const weapon = window.Weapons.list[cfg.weaponIdx];

    // Clear stage
    E.clear(ctx, stageW, stageH);

    // Hurt flash backdrop alpha handled via globalAlpha
    ctx.globalAlpha = frame.alpha || 1;

    // ---- Compute transform for roll / death
    ctx.save();
    const originX = (stageW / 2) | 0;
    const originY = (stageH / 2 + 6) | 0;  // hips a bit below center
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

    // If facing left, flip everything horizontally around originX
    if (facing === -1) {
      ctx.translate(originX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-originX, 0);
    }

    // Body offset
    const bodyDY = frame.bodyDY || 0;
    const headDY = frame.headDY || 0;

    // Torso TL
    const torsoTL_x = originX - 3;
    const torsoTL_y = originY - 8 + bodyDY;
    // Head TL
    const headTL_x = originX - 4;
    const headTL_y = originY - 18 + bodyDY + headDY + (frame.headBack ? -1 : 0);
    // Legs TL
    const legsTL_x = originX - 3;
    const legsTL_y = originY + 0;  // legs always planted; only frame.legs offsets change

    // ---- Draw backpack first (behind body when facing right, back = left side)
    if (pack) Parts.drawBackpack(ctx, torsoTL_x, torsoTL_y, pack);

    // ---- Draw back arm (behind body) — only for two-handed weapons
    // We'll place it after torso for front arm; back arm drawn BEFORE torso so it appears behind.
    const shoulderFrontX = torsoTL_x + 5;
    const shoulderFrontY = torsoTL_y + 2;
    const shoulderBackX = torsoTL_x + 1;
    const shoulderBackY = torsoTL_y + 2;

    // Compute weapon positions ---------------------------------------------
    // aim direction = frame.aimAngle (radians, 0 = horizontal right, + = down)
    const aim = frame.aimAngle + (frame.weaponAngle || 0);
    const armLen = 5;
    // Front hand position = shoulder + armLen along aim direction
    const fh = {
      hx: Math.round(shoulderFrontX + Math.cos(aim) * armLen) + (frame.weaponDX || 0),
      hy: Math.round(shoulderFrontY + Math.sin(aim) * armLen) + (frame.weaponDY || 0)
    };

    // For reloads, back hand goes to magazine instead of foregrip
    let backHand = null;
    if (weapon.twoHanded && !frame.backHandToMag && !frame.tuck && !frame.weaponDropped) {
      // Foregrip — along weapon axis forward from grip by (foregripX - gripX)
      const dx = (weapon.foregripX - weapon.gripX);
      const dy = (weapon.foregripY - weapon.gripY);
      backHand = {
        hx: Math.round(fh.hx + Math.cos(aim) * dx - Math.sin(aim) * dy),
        hy: Math.round(fh.hy + Math.sin(aim) * dx + Math.cos(aim) * dy)
      };
    } else if (weapon.twoHanded && frame.backHandToMag) {
      // Back hand under magazine
      const mx = weapon.foregripX - 2, my = weapon.foregripY + 1;
      const dx = mx - weapon.gripX, dy = my - weapon.gripY;
      backHand = {
        hx: Math.round(fh.hx + Math.cos(aim) * dx - Math.sin(aim) * dy),
        hy: Math.round(fh.hy + Math.sin(aim) * dx + Math.cos(aim) * dy)
      };
    }

    // ---- Draw back arm BEHIND torso
    if (backHand && !frame.tuck) {
      Parts.drawArm(ctx, shoulderBackX, shoulderBackY, backHand.hx, backHand.hy, uniform, P.gloves);
    }

    // ---- Legs
    Parts.drawLegs(ctx, torsoTL_x, legsTL_y, pants, frame.legs);

    // ---- Waist bridge — fills any gap between the (possibly lifted) torso and
    // the planted legs so body bobs can't expose background between them.
    Parts.drawWaistBridge(ctx, torsoTL_x, torsoTL_y + 8, legsTL_y);

    // ---- Torso
    Parts.drawTorso(ctx, torsoTL_x, torsoTL_y, uniform);

    // ---- Vest over torso
    if (vest) Parts.drawVest(ctx, torsoTL_x, torsoTL_y, vest);

    // ---- Backpack strap crossing torso
    if (pack) {
      // diagonal strap
      const strap = pack.shade;
      for (let i = 0; i < 5; i++) {
        E.px(ctx, torsoTL_x + 1 + i, torsoTL_y + 1 + i, strap);
      }
    }

    // ---- Neck — skin bridge from head chin to torso collar.
    // Always renders at least 1 row so the head never floats away from the body
    // regardless of head/body DY offsets. Stretches up to 3 rows for dramatic poses.
    Parts.drawNeck(ctx, originX, headTL_y + 9, torsoTL_y, skin);

    // ---- Head
    Parts.drawHead(ctx, headTL_x, headTL_y, skin, { hurt: frame.mouthHurt });

    // ---- Hair (under hat)
    if (!hatCol || hatKind === 'None' || hatKind === 'Bandana') {
      Parts.drawHair(ctx, headTL_x, headTL_y, hairStyle, hair);
    } else if (hatKind === 'Cap' || hatKind === 'Boonie') {
      // Keep back hair visible
      if (hairStyle === 'Long' || hairStyle === 'Ponytail' || hairStyle === 'Messy') {
        Parts.drawHair(ctx, headTL_x, headTL_y, hairStyle, hair);
      }
    }

    // ---- Hat
    if (hatCol && hatKind !== 'None') {
      Parts.drawHat(ctx, headTL_x, headTL_y, hatKind, hatCol);
    }

    // ---- Eye
    Parts.drawEye(ctx, headTL_x, headTL_y, eye.base, { closed: frame.eyesClosed });

    // ---- Weapon + front arm
    const showWeapon = frame.showWeapon !== false && !frame.weaponDropped;
    if (showWeapon) {
      if (frame.useGrenade) {
        // Draw grenade at front hand
        const g = window.Weapons.grenade;
        ctx.save();
        ctx.translate(fh.hx, fh.hy);
        ctx.rotate(aim);
        g.draw(ctx, 0, 0, false);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(fh.hx, fh.hy);
        ctx.rotate(aim);
        weapon.draw(ctx, 0, 0, false);
        // Muzzle flash
        if (frame.muzzleFlash) {
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
        ctx.restore();
      }
    }

    // ---- Front arm (on top of body and weapon grip)
    Parts.drawArm(ctx, shoulderFrontX, shoulderFrontY, fh.hx, fh.hy, uniform, P.gloves);

    // Released grenade in front of thrower
    if (frame.grenadeReleased) {
      const g = window.Weapons.grenade;
      ctx.save();
      ctx.translate(fh.hx + 6, fh.hy - 3);
      g.draw(ctx, 0, 0, false);
      ctx.restore();
    }

    ctx.restore();

    // Hurt tint overlay
    if (frame.tint) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = frame.tint;
      ctx.fillRect(0, 0, stageW, stageH);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }

  window.CharacterRenderer = { renderFrame };
})();
