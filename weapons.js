// Weapons — all drawn facing right. Each returns { width, height, gripX, gripY, muzzleX, muzzleY, draw(ctx, x, y, flipX) }
// gripX/gripY are where the main (front) hand holds the weapon — this is the anchor we pin to the front hand.
// The sprite is drawn with gripX/gripY placed AT the hand's pixel.

(function () {
  const E = window.Engine;
  const O = '#0a0a10';

  function makeWeapon(def) {
    return {
      name: def.name,
      type: def.type,
      twoHanded: def.twoHanded || false,
      width: def.width,
      height: def.height,
      gripX: def.gripX,
      gripY: def.gripY,
      foregripX: def.foregripX,
      foregripY: def.foregripY,
      muzzleX: def.muzzleX,
      muzzleY: def.muzzleY,
      draw: function (ctx, px, py, flipX) {
        // px,py is where grip anchor goes. So top-left of sprite is px-gripX, py-gripY.
        const tlx = px - def.gripX;
        const tly = py - def.gripY;
        if (flipX) {
          ctx.save();
          ctx.translate(tlx + def.width, tly);
          ctx.scale(-1, 1);
          def.draw(ctx, 0, 0);
          ctx.restore();
        } else {
          def.draw(ctx, tlx, tly);
        }
      }
    };
  }

  // Common draw helper
  const px = (ctx, x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x|0, y|0, 1, 1); };
  const rect = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x|0, y|0, w|0, h|0); };

  // ---------- PISTOL ----------
  const pistol = makeWeapon({
    name: 'Pistol',
    type: 'pistol',
    twoHanded: false,
    width: 9, height: 6,
    gripX: 2, gripY: 4,    // grip position (where hand holds)
    muzzleX: 9, muzzleY: 2, // where bullets exit
    draw: function (ctx, x, y) {
      const M = '#52525a';  // metal
      const Ms = '#2a2a32';
      const Mh = '#8a8a92';
      // Slide (top)
      rect(ctx, x + 2, y + 1, 6, 2, M);
      px(ctx, x + 2, y + 1, Mh);
      px(ctx, x + 3, y + 1, Mh);
      rect(ctx, x + 2, y + 3, 6, 1, Ms);
      // Barrel tip
      px(ctx, x + 8, y + 2, Ms);
      // Grip
      rect(ctx, x + 2, y + 3, 2, 3, '#3a2a20');
      px(ctx, x + 2, y + 5, O);
      px(ctx, x + 3, y + 5, O);
      // Trigger guard
      px(ctx, x + 4, y + 4, O);
      px(ctx, x + 4, y + 5, O);
      px(ctx, x + 5, y + 5, O);
      // Outline
      E.outlineRegion(ctx, ctx.canvas.width, ctx.canvas.height, O);
    }
  });

  // ---------- SMG ----------
  const smg = makeWeapon({
    name: 'SMG',
    type: 'smg',
    twoHanded: true,
    width: 13, height: 7,
    gripX: 3, gripY: 5,
    foregripX: 8, foregripY: 4,
    muzzleX: 13, muzzleY: 2,
    draw: function (ctx, x, y) {
      const M = '#42424a';
      const Ms = '#20202a';
      const Mh = '#72727a';
      // Upper receiver
      rect(ctx, x + 2, y + 1, 8, 2, M);
      rect(ctx, x + 2, y + 1, 8, 1, Mh);
      // Barrel
      rect(ctx, x + 9, y + 2, 4, 1, Ms);
      // Stock folded / short
      px(ctx, x + 1, y + 2, M);
      px(ctx, x + 0, y + 2, Ms);
      // Magazine
      rect(ctx, x + 4, y + 3, 2, 3, Ms);
      px(ctx, x + 4, y + 5, O);
      px(ctx, x + 5, y + 5, O);
      // Grip
      rect(ctx, x + 2, y + 3, 2, 3, '#2a2a30');
      // Trigger guard hint
      px(ctx, x + 3, y + 4, O);
      E.outlineRegion(ctx, ctx.canvas.width, ctx.canvas.height, O);
    }
  });

  // ---------- ASSAULT RIFLE ----------
  const rifle = makeWeapon({
    name: 'Assault Rifle',
    type: 'rifle',
    twoHanded: true,
    width: 17, height: 7,
    gripX: 5, gripY: 5,
    foregripX: 11, foregripY: 4,
    muzzleX: 17, muzzleY: 2,
    draw: function (ctx, x, y) {
      const M = '#3a3a42';
      const Ms = '#1a1a22';
      const Mh = '#62626a';
      // Stock (back)
      rect(ctx, x + 0, y + 2, 4, 2, '#3a2a20');
      px(ctx, x + 0, y + 3, Ms);
      // Upper receiver
      rect(ctx, x + 4, y + 1, 9, 2, M);
      rect(ctx, x + 4, y + 1, 9, 1, Mh);
      // Sight
      px(ctx, x + 7, y + 0, M);
      px(ctx, x + 8, y + 0, Ms);
      // Barrel
      rect(ctx, x + 13, y + 2, 4, 1, Ms);
      // Magazine
      rect(ctx, x + 6, y + 3, 2, 4, M);
      px(ctx, x + 6, y + 6, Ms);
      px(ctx, x + 7, y + 6, Ms);
      // Grip
      rect(ctx, x + 4, y + 3, 2, 3, '#2a2a30');
      // Foregrip / handguard
      rect(ctx, x + 9, y + 3, 4, 1, Ms);
      E.outlineRegion(ctx, ctx.canvas.width, ctx.canvas.height, O);
    }
  });

  // ---------- SHOTGUN ----------
  const shotgun = makeWeapon({
    name: 'Shotgun',
    type: 'shotgun',
    twoHanded: true,
    width: 16, height: 6,
    gripX: 4, gripY: 4,
    foregripX: 10, foregripY: 3,
    muzzleX: 16, muzzleY: 2,
    draw: function (ctx, x, y) {
      const M = '#42342a';
      const Ms = '#22180f';
      const Metal = '#52525a';
      const MetalS = '#2a2a32';
      // Stock
      rect(ctx, x + 0, y + 2, 4, 2, M);
      rect(ctx, x + 0, y + 2, 4, 1, '#6a523a');
      // Receiver
      rect(ctx, x + 4, y + 1, 4, 3, Metal);
      rect(ctx, x + 4, y + 1, 4, 1, '#7a7a82');
      // Pump
      rect(ctx, x + 9, y + 2, 3, 2, M);
      // Barrel
      rect(ctx, x + 8, y + 1, 8, 2, MetalS);
      rect(ctx, x + 8, y + 1, 8, 1, Metal);
      // Grip
      rect(ctx, x + 4, y + 3, 2, 2, '#2a1a12');
      E.outlineRegion(ctx, ctx.canvas.width, ctx.canvas.height, O);
    }
  });

  // ---------- SNIPER ----------
  const sniper = makeWeapon({
    name: 'Sniper',
    type: 'sniper',
    twoHanded: true,
    width: 22, height: 8,
    gripX: 6, gripY: 6,
    foregripX: 14, foregripY: 4,
    muzzleX: 22, muzzleY: 3,
    draw: function (ctx, x, y) {
      const M = '#3a3a42';
      const Ms = '#1a1a22';
      const Mh = '#62626a';
      // Stock
      rect(ctx, x + 0, y + 3, 5, 2, '#3a2a20');
      px(ctx, x + 0, y + 4, Ms);
      // Receiver
      rect(ctx, x + 5, y + 2, 6, 2, M);
      rect(ctx, x + 5, y + 2, 6, 1, Mh);
      // Scope
      rect(ctx, x + 6, y + 0, 5, 2, Ms);
      rect(ctx, x + 6, y + 0, 5, 1, M);
      px(ctx, x + 5, y + 1, Ms);
      px(ctx, x + 11, y + 1, Ms);
      // Bolt handle hint
      px(ctx, x + 10, y + 1, Mh);
      // Long barrel
      rect(ctx, x + 11, y + 3, 11, 1, Ms);
      // Muzzle brake
      rect(ctx, x + 20, y + 2, 2, 2, M);
      // Bipod
      px(ctx, x + 15, y + 4, Ms);
      px(ctx, x + 15, y + 5, Ms);
      px(ctx, x + 14, y + 6, Ms);
      px(ctx, x + 16, y + 6, Ms);
      // Magazine
      rect(ctx, x + 7, y + 4, 2, 2, M);
      // Grip
      rect(ctx, x + 5, y + 4, 2, 3, '#2a2a30');
      E.outlineRegion(ctx, ctx.canvas.width, ctx.canvas.height, O);
    }
  });

  // ---------- ROCKET LAUNCHER ----------
  const rocket = makeWeapon({
    name: 'Rocket Launcher',
    type: 'rocket',
    twoHanded: true,
    width: 18, height: 8,
    gripX: 5, gripY: 6,
    foregripX: 11, foregripY: 4,
    muzzleX: 18, muzzleY: 3,
    draw: function (ctx, x, y) {
      const M = '#5a6a3a';  // olive tube
      const Ms = '#3a4a22';
      const Mh = '#7a8a52';
      // Tube
      rect(ctx, x + 1, y + 2, 16, 3, M);
      rect(ctx, x + 1, y + 2, 16, 1, Mh);
      rect(ctx, x + 1, y + 4, 16, 1, Ms);
      // Rear flare
      rect(ctx, x + 0, y + 1, 2, 5, Ms);
      // Front flare
      rect(ctx, x + 17, y + 1, 1, 5, Ms);
      // Sight
      rect(ctx, x + 7, y + 0, 2, 2, Ms);
      px(ctx, x + 8, y + 0, Mh);
      // Grip
      rect(ctx, x + 4, y + 5, 2, 3, '#2a2a30');
      // Warning stripe
      px(ctx, x + 14, y + 3, '#b8a040');
      px(ctx, x + 15, y + 3, '#b8a040');
      E.outlineRegion(ctx, ctx.canvas.width, ctx.canvas.height, O);
    }
  });

  // ---------- KNIFE ----------
  const knife = makeWeapon({
    name: 'Knife',
    type: 'melee',
    twoHanded: false,
    width: 7, height: 3,
    gripX: 1, gripY: 1,
    muzzleX: 7, muzzleY: 1,
    draw: function (ctx, x, y) {
      // Handle
      px(ctx, x + 0, y + 1, '#3a2a20');
      px(ctx, x + 1, y + 1, '#5a3a22');
      // Guard
      px(ctx, x + 2, y + 0, O);
      px(ctx, x + 2, y + 1, '#52525a');
      px(ctx, x + 2, y + 2, O);
      // Blade
      for (let i = 3; i < 7; i++) {
        px(ctx, x + i, y + 1, '#b8b8c2');
      }
      px(ctx, x + 6, y + 1, '#ffffff');
      E.outlineRegion(ctx, ctx.canvas.width, ctx.canvas.height, O);
    }
  });

  // ---------- GRENADE ----------
  const grenade = makeWeapon({
    name: 'Grenade',
    type: 'grenade',
    twoHanded: false,
    width: 4, height: 5,
    gripX: 1, gripY: 2,
    muzzleX: 2, muzzleY: 2,
    draw: function (ctx, x, y) {
      // Body
      rect(ctx, x + 1, y + 1, 2, 3, '#3a4a22');
      px(ctx, x + 1, y + 1, '#5a6a3a');
      // Lever
      px(ctx, x + 2, y + 0, '#8a8a92');
      px(ctx, x + 3, y + 0, '#8a8a92');
      px(ctx, x + 3, y + 1, '#8a8a92');
      // Pin (on top)
      px(ctx, x + 0, y + 0, O);
      E.outlineRegion(ctx, ctx.canvas.width, ctx.canvas.height, O);
    }
  });

  window.Weapons = {
    pistol, smg, rifle, shotgun, sniper, rocket, knife, grenade,
    list: [pistol, smg, rifle, shotgun, sniper, rocket, knife, grenade]
  };
})();
