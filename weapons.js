// Weapons — sprite-sheet driven. Each "skin" is a PNG in assets/weapons/N.png
// (0..33). All sheets share the same layout — only the colour treatment differs.
// We crop each weapon out of the active sheet at render time, preserving its
// native pixel quality (imageSmoothing disabled, no scaling).
//
// Each weapon exposes the same shape as the previous hand-coded set:
//   { name, type, twoHanded, width, height,
//     gripX, gripY,        // back-hand / pivot
//     foregripX, foregripY,// front-hand (for two-handed weapons)
//     muzzleX, muzzleY,    // bullet exit point (also used for muzzle flash)
//     draw(ctx, px, py, flipX) }
//
// The renderer pins gripX/gripY to the front-hand pixel and rotates around it,
// so accurate grip coords are critical for the weapon to look "held".

(function () {
  const E = window.Engine;
  const O = '#0a0a10';
  const NUM_SKINS = 34;          // sheets 0..33
  const DEFAULT_SKIN = 33;
  const SHEET_DIR = 'assets/weapons/';

  // ---------- Sheet loader ----------
  // Sheets load lazily and are cached. When a sheet finishes loading we
  // dispatch a window event so any visible canvas can re-render.
  const sheetCache = {};   // idx -> HTMLImageElement
  const sheetState = {};   // idx -> 'loading' | 'ready' | 'error'
  let activeSkin = DEFAULT_SKIN;

  function loadSheet(idx) {
    if (sheetCache[idx]) return sheetCache[idx];
    if (sheetState[idx] === 'loading') return null;
    sheetState[idx] = 'loading';
    const img = new Image();
    img.onload = function () {
      sheetCache[idx] = img;
      sheetState[idx] = 'ready';
      window.dispatchEvent(new CustomEvent('weapons:sheetLoaded', { detail: { idx } }));
    };
    img.onerror = function () { sheetState[idx] = 'error'; };
    img.src = SHEET_DIR + idx + '.png';
    return null;
  }

  function getActiveSheet() {
    const s = sheetCache[activeSkin];
    if (s) return s;
    loadSheet(activeSkin);
    return null;
  }

  function setSkinIdx(idx) {
    if (idx === activeSkin) return;
    activeSkin = idx;
    if (!sheetCache[idx]) loadSheet(idx);
    else window.dispatchEvent(new CustomEvent('weapons:sheetLoaded', { detail: { idx } }));
  }

  // ---------- Manifest ----------
  // Auto-extracted from the layout of sheet 33: bounding boxes (sx,sy,sw,sh)
  // and best-guess anchor points. Pistols are 1H; everything else is 2H.
  // Anchor points (gripX/Y, foregripX/Y, muzzleX/Y) were derived by finding the
  // back-grip protrusion, the front-handguard region, and the rightmost edge of
  // each silhouette respectively.
  const MANIFEST = [
    { name: 'SMG-01',     type: 'smg',     sx:  45, sy:  19, sw:  32, sh: 20, gripX:  9, gripY: 19, foregripX: 17, foregripY: 19, muzzleX: 31, muzzleY:  3 },
    { name: 'SMG-02',     type: 'smg',     sx:  45, sy:  53, sw:  24, sh: 22, gripX:  4, gripY: 21, foregripX: 13, foregripY: 21, muzzleX: 23, muzzleY:  4 },
    { name: 'SMG-03',     type: 'smg',     sx:  45, sy:  93, sw:  22, sh: 22, gripX:  7, gripY: 21, foregripX: 14, foregripY: 21, muzzleX: 21, muzzleY:  2 },
    { name: 'SMG-04',     type: 'smg',     sx:  45, sy: 138, sw:  27, sh: 31, gripX:  4, gripY: 30, foregripX: 17, foregripY: 30, muzzleX: 26, muzzleY:  6 },
    { name: 'SMG-05',     type: 'smg',     sx:  45, sy: 183, sw:  46, sh: 13, gripX: 15, gripY: 12, foregripX: 30, foregripY: 12, muzzleX: 45, muzzleY:  7 },
    { name: 'SMG-06',     type: 'smg',     sx:  45, sy: 214, sw:  43, sh: 22, gripX: 14, gripY: 21, foregripX: 29, foregripY: 21, muzzleX: 42, muzzleY: 10 },
    { name: 'SMG-07',     type: 'smg',     sx:  45, sy: 250, sw:  44, sh: 27, gripX: 13, gripY: 26, foregripX: 29, foregripY: 22, muzzleX: 43, muzzleY: 10 },
    { name: 'SMG-08',     type: 'smg',     sx:  45, sy: 291, sw:  39, sh: 15, gripX: 13, gripY: 14, foregripX: 25, foregripY: 14, muzzleX: 38, muzzleY:  2 },
    { name: 'SMG-09',     type: 'smg',     sx:  45, sy: 320, sw:  27, sh: 15, gripX:  6, gripY: 14, foregripX: 17, foregripY: 14, muzzleX: 26, muzzleY:  3 },
    { name: 'SMG-10',     type: 'smg',     sx:  45, sy: 354, sw:  38, sh: 23, gripX: 12, gripY: 22, foregripX: 24, foregripY: 22, muzzleX: 37, muzzleY:  2 },
    { name: 'SMG-11',     type: 'smg',     sx:  45, sy: 392, sw:  27, sh: 23, gripX: 11, gripY: 22, foregripX: 18, foregripY: 22, muzzleX: 26, muzzleY:  4 },

    { name: 'RIFLE-01',   type: 'rifle',   sx: 352, sy:  19, sw:  46, sh: 16, gripX: 15, gripY: 15, foregripX: 28, foregripY: 15, muzzleX: 45, muzzleY:  3 },
    { name: 'RIFLE-02',   type: 'rifle',   sx: 352, sy:  44, sw:  42, sh: 15, gripX: 13, gripY: 14, foregripX: 26, foregripY: 14, muzzleX: 41, muzzleY:  2 },
    { name: 'RIFLE-03',   type: 'rifle',   sx: 352, sy:  68, sw:  49, sh: 15, gripX: 16, gripY: 14, foregripX: 32, foregripY: 14, muzzleX: 48, muzzleY:  4 },
    { name: 'RIFLE-04',   type: 'rifle',   sx: 352, sy:  92, sw:  65, sh: 16, gripX: 21, gripY: 15, foregripX: 43, foregripY: 15, muzzleX: 64, muzzleY:  5 },
    { name: 'RIFLE-05',   type: 'rifle',   sx: 352, sy: 117, sw:  61, sh: 15, gripX: 20, gripY: 14, foregripX: 40, foregripY: 14, muzzleX: 60, muzzleY:  4 },
    { name: 'RIFLE-06',   type: 'rifle',   sx: 352, sy: 140, sw:  64, sh: 16, gripX: 17, gripY: 15, foregripX: 43, foregripY: 15, muzzleX: 63, muzzleY:  5 },
    { name: 'RIFLE-07',   type: 'rifle',   sx: 352, sy: 166, sw:  54, sh: 15, gripX: 18, gripY: 14, foregripX: 35, foregripY: 14, muzzleX: 53, muzzleY:  4 },
    { name: 'RIFLE-08',   type: 'rifle',   sx: 352, sy: 190, sw:  67, sh: 15, gripX: 20, gripY: 14, foregripX: 43, foregripY: 14, muzzleX: 66, muzzleY:  4 },
    { name: 'RIFLE-09',   type: 'rifle',   sx: 352, sy: 214, sw:  43, sh: 16, gripX: 14, gripY: 15, foregripX: 28, foregripY: 15, muzzleX: 42, muzzleY:  5 },
    { name: 'RIFLE-10',   type: 'rifle',   sx: 352, sy: 239, sw:  37, sh: 16, gripX: 12, gripY: 15, foregripX: 24, foregripY: 15, muzzleX: 36, muzzleY:  5 },

    { name: 'HEAVY-01',   type: 'heavy',   sx: 700, sy:  24, sw:  56, sh: 22, gripX: 19, gripY: 21, foregripX: 36, foregripY: 21, muzzleX: 55, muzzleY: 10 },
    { name: 'HEAVY-02',   type: 'heavy',   sx: 700, sy:  59, sw:  62, sh: 16, gripX: 20, gripY: 15, foregripX: 41, foregripY: 15, muzzleX: 61, muzzleY:  7 },
    { name: 'HEAVY-03',   type: 'heavy',   sx: 700, sy:  87, sw:  63, sh: 20, gripX: 21, gripY: 19, foregripX: 41, foregripY: 19, muzzleX: 62, muzzleY:  7 },
    { name: 'HEAVY-04',   type: 'heavy',   sx: 700, sy: 120, sw:  56, sh: 18, gripX: 18, gripY: 17, foregripX: 36, foregripY: 17, muzzleX: 55, muzzleY:  6 },
    { name: 'HEAVY-05',   type: 'heavy',   sx: 700, sy: 151, sw:  55, sh: 17, gripX: 18, gripY: 16, foregripX: 36, foregripY: 16, muzzleX: 54, muzzleY:  7 },
    { name: 'HEAVY-06',   type: 'heavy',   sx: 700, sy: 180, sw:  62, sh: 15, gripX: 20, gripY: 14, foregripX: 41, foregripY: 14, muzzleX: 61, muzzleY:  6 },
    { name: 'HEAVY-07',   type: 'heavy',   sx: 700, sy: 208, sw:  60, sh: 15, gripX: 19, gripY: 14, foregripX: 40, foregripY: 14, muzzleX: 59, muzzleY:  5 },
    { name: 'HEAVY-08',   type: 'heavy',   sx: 700, sy: 236, sw:  60, sh: 15, gripX: 19, gripY: 14, foregripX: 40, foregripY: 14, muzzleX: 59, muzzleY:  4 },
    { name: 'HEAVY-09',   type: 'heavy',   sx: 700, sy: 264, sw:  61, sh: 26, gripX: 21, gripY: 14, foregripX: 41, foregripY: 14, muzzleX: 60, muzzleY: 14 },
    { name: 'HEAVY-10',   type: 'heavy',   sx: 700, sy: 303, sw:  49, sh: 15, gripX: 16, gripY: 14, foregripX: 32, foregripY: 14, muzzleX: 48, muzzleY:  2 },
    { name: 'HEAVY-11',   type: 'heavy',   sx: 700, sy: 331, sw:  51, sh: 15, gripX: 17, gripY: 14, foregripX: 33, foregripY: 14, muzzleX: 50, muzzleY:  3 },
    { name: 'HEAVY-12',   type: 'heavy',   sx: 700, sy: 359, sw:  60, sh: 15, gripX: 19, gripY: 14, foregripX: 40, foregripY: 14, muzzleX: 59, muzzleY:  3 },
    { name: 'HEAVY-13',   type: 'heavy',   sx: 700, sy: 387, sw:  54, sh: 20, gripX: 17, gripY: 19, foregripX: 35, foregripY: 19, muzzleX: 53, muzzleY: 10 },
    { name: 'HEAVY-14',   type: 'heavy',   sx: 700, sy: 420, sw:  59, sh: 22, gripX: 18, gripY: 21, foregripX: 38, foregripY: 21, muzzleX: 58, muzzleY: 10 },

    { name: 'SHOTGUN-01', type: 'shotgun', sx:  25, sy: 511, sw:  49, sh: 17, gripX: 11, gripY: 16, foregripX: 32, foregripY: 16, muzzleX: 48, muzzleY:  3 },
    { name: 'SHOTGUN-02', type: 'shotgun', sx:  23, sy: 546, sw:  63, sh: 16, gripX: 13, gripY: 15, foregripX: 40, foregripY: 15, muzzleX: 62, muzzleY:  2 },
    { name: 'SHOTGUN-03', type: 'shotgun', sx:  25, sy: 584, sw:  75, sh: 15, gripX: 18, gripY: 14, foregripX: 48, foregripY: 14, muzzleX: 74, muzzleY:  3 },
    { name: 'SHOTGUN-04', type: 'shotgun', sx:  25, sy: 625, sw:  56, sh: 16, gripX: 13, gripY: 15, foregripX: 36, foregripY: 15, muzzleX: 55, muzzleY:  2 },
    { name: 'SHOTGUN-05', type: 'shotgun', sx:  25, sy: 667, sw:  70, sh: 15, gripX: 17, gripY: 14, foregripX: 45, foregripY: 14, muzzleX: 69, muzzleY:  2 },
    { name: 'SHOTGUN-06', type: 'shotgun', sx:  25, sy: 708, sw:  69, sh: 16, gripX: 17, gripY: 15, foregripX: 44, foregripY: 15, muzzleX: 68, muzzleY:  3 },
    { name: 'SHOTGUN-07', type: 'shotgun', sx:  25, sy: 750, sw:  49, sh: 16, gripX: 11, gripY: 15, foregripX: 31, foregripY: 15, muzzleX: 48, muzzleY:  2 },
    { name: 'SHOTGUN-08', type: 'shotgun', sx:  25, sy: 792, sw:  74, sh: 16, gripX: 18, gripY: 15, foregripX: 48, foregripY: 15, muzzleX: 73, muzzleY:  4 },

    { name: 'SNIPER-01',  type: 'sniper',  sx: 352, sy: 500, sw: 112, sh: 24, gripX: 25, gripY: 22, foregripX: 72, foregripY: 22, muzzleX: 111, muzzleY: 11 },
    { name: 'SNIPER-02',  type: 'sniper',  sx: 352, sy: 539, sw: 106, sh: 20, gripX: 28, gripY: 19, foregripX: 70, foregripY: 19, muzzleX: 105, muzzleY:  7 },
    { name: 'SNIPER-03',  type: 'sniper',  sx: 352, sy: 574, sw:  96, sh: 23, gripX: 24, gripY: 22, foregripX: 62, foregripY: 22, muzzleX:  95, muzzleY: 11 },
    { name: 'SNIPER-04',  type: 'sniper',  sx: 354, sy: 612, sw:  93, sh: 22, gripX: 24, gripY: 21, foregripX: 60, foregripY: 21, muzzleX:  92, muzzleY: 10 },
    { name: 'SNIPER-05',  type: 'sniper',  sx: 354, sy: 649, sw: 111, sh: 24, gripX: 27, gripY: 23, foregripX: 72, foregripY: 23, muzzleX: 110, muzzleY: 12 },
    { name: 'SNIPER-06',  type: 'sniper',  sx: 354, sy: 688, sw: 109, sh: 22, gripX: 27, gripY: 21, foregripX: 70, foregripY: 21, muzzleX: 108, muzzleY: 10 },
    { name: 'SNIPER-07',  type: 'sniper',  sx: 354, sy: 725, sw: 118, sh: 18, gripX: 26, gripY: 17, foregripX: 76, foregripY: 17, muzzleX: 117, muzzleY:  5 },
    { name: 'SNIPER-08',  type: 'sniper',  sx: 354, sy: 753, sw: 117, sh: 26, gripX: 26, gripY: 25, foregripX: 76, foregripY: 25, muzzleX: 116, muzzleY: 13 },
    { name: 'SNIPER-09',  type: 'sniper',  sx: 354, sy: 794, sw:  81, sh: 26, gripX: 22, gripY: 25, foregripX: 52, foregripY: 25, muzzleX:  80, muzzleY: 14 },
    { name: 'SNIPER-10',  type: 'sniper',  sx: 354, sy: 835, sw:  81, sh: 21, gripX: 22, gripY: 20, foregripX: 52, foregripY: 20, muzzleX:  80, muzzleY:  9 },

    { name: 'PISTOL-01',  type: 'pistol',  sx: 832, sy: 511, sw:  16, sh: 14, gripX:  3, gripY: 13, foregripX:  3, foregripY: 13, muzzleX: 15, muzzleY:  4 },
    { name: 'PISTOL-02',  type: 'pistol',  sx: 832, sy: 530, sw:  28, sh: 16, gripX:  4, gripY: 15, foregripX:  4, foregripY: 15, muzzleX: 27, muzzleY:  5 },
    { name: 'PISTOL-03',  type: 'pistol',  sx: 832, sy: 551, sw:  26, sh: 16, gripX:  4, gripY: 15, foregripX:  4, foregripY: 15, muzzleX: 25, muzzleY:  4 },
    { name: 'PISTOL-04',  type: 'pistol',  sx: 832, sy: 572, sw:  29, sh: 16, gripX:  4, gripY: 15, foregripX:  4, foregripY: 15, muzzleX: 28, muzzleY:  3 },
    { name: 'PISTOL-05',  type: 'pistol',  sx: 832, sy: 593, sw:  22, sh: 16, gripX:  5, gripY: 15, foregripX:  5, foregripY: 15, muzzleX: 21, muzzleY:  2 },
    { name: 'PISTOL-06',  type: 'pistol',  sx: 832, sy: 614, sw:  29, sh: 16, gripX:  5, gripY: 15, foregripX:  5, foregripY: 15, muzzleX: 28, muzzleY:  2 },
    { name: 'PISTOL-07',  type: 'pistol',  sx: 832, sy: 637, sw:  20, sh: 17, gripX:  5, gripY: 16, foregripX:  5, foregripY: 16, muzzleX: 19, muzzleY:  2 },
    { name: 'PISTOL-08',  type: 'pistol',  sx: 832, sy: 661, sw:  21, sh: 15, gripX:  3, gripY: 14, foregripX:  3, foregripY: 14, muzzleX: 20, muzzleY:  2 }
  ];

  // ---------- Sprite-sheet weapon ----------
  function makeSheetWeapon(def) {
    const twoHanded = def.type !== 'pistol';
    const w = {
      name: def.name,
      type: def.type,
      twoHanded,
      width: def.sw,
      height: def.sh,
      gripX: def.gripX,
      gripY: def.gripY,
      foregripX: def.foregripX,
      foregripY: def.foregripY,
      muzzleX: def.muzzleX,
      muzzleY: def.muzzleY,
      _def: def,
      draw: function (ctx, px, py, flipX) {
        const sheet = getActiveSheet();
        if (!sheet) return;
        // Pin native sprite pixels to canvas pixels (no scaling, no smoothing)
        // — disable smoothing for THIS draw without disturbing other layers.
        const prev = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        const tlx = Math.round(px - def.gripX);
        const tly = Math.round(py - def.gripY);
        if (flipX) {
          ctx.save();
          ctx.translate(tlx + def.sw, tly);
          ctx.scale(-1, 1);
          ctx.drawImage(sheet, def.sx, def.sy, def.sw, def.sh, 0, 0, def.sw, def.sh);
          ctx.restore();
        } else {
          ctx.drawImage(sheet, def.sx, def.sy, def.sw, def.sh, tlx, tly, def.sw, def.sh);
        }
        ctx.imageSmoothingEnabled = prev;
      }
    };
    return w;
  }

  const sheetList = MANIFEST.map(makeSheetWeapon);

  // ---------- Custom sprites (used by animations, not in the asset pack) ----------
  // Knife and grenade are tightly tied to specific animations (melee, throw)
  // and aren't drawn from the sheet. We keep them as small hand-drawn pieces.
  const px = (ctx, x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); };
  const rect = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };

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
      draw: function (ctx, px2, py2, flipX) {
        const tlx = px2 - def.gripX;
        const tly = py2 - def.gripY;
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

  const knife = makeWeapon({
    name: 'Knife', type: 'melee', twoHanded: false,
    width: 7, height: 3, gripX: 1, gripY: 1, muzzleX: 7, muzzleY: 1,
    draw: function (ctx, x, y) {
      px(ctx, x + 0, y + 1, '#3a2a20');
      px(ctx, x + 1, y + 1, '#5a3a22');
      px(ctx, x + 2, y + 0, O);
      px(ctx, x + 2, y + 1, '#52525a');
      px(ctx, x + 2, y + 2, O);
      for (let i = 3; i < 7; i++) px(ctx, x + i, y + 1, '#b8b8c2');
      px(ctx, x + 6, y + 1, '#ffffff');
      E.outlineRegion(ctx, ctx.canvas.width, ctx.canvas.height, O);
    }
  });

  const grenade = makeWeapon({
    name: 'Grenade', type: 'grenade', twoHanded: false,
    width: 4, height: 5, gripX: 1, gripY: 2, muzzleX: 2, muzzleY: 2,
    draw: function (ctx, x, y) {
      rect(ctx, x + 1, y + 1, 2, 3, '#3a4a22');
      px(ctx, x + 1, y + 1, '#5a6a3a');
      px(ctx, x + 2, y + 0, '#8a8a92');
      px(ctx, x + 3, y + 0, '#8a8a92');
      px(ctx, x + 3, y + 1, '#8a8a92');
      px(ctx, x + 0, y + 0, O);
      E.outlineRegion(ctx, ctx.canvas.width, ctx.canvas.height, O);
    }
  });

  // ---------- Public API ----------
  // Categorise by type for UI grouping. Order matches sheet layout.
  const byType = {
    smg:     sheetList.filter(w => w.type === 'smg'),
    rifle:   sheetList.filter(w => w.type === 'rifle'),
    heavy:   sheetList.filter(w => w.type === 'heavy'),
    shotgun: sheetList.filter(w => w.type === 'shotgun'),
    sniper:  sheetList.filter(w => w.type === 'sniper'),
    pistol:  sheetList.filter(w => w.type === 'pistol')
  };

  // First weapon of each type — keeps legacy `Weapons.rifle` etc. accessors alive
  // (animations reference them as fallbacks).
  const first = (t) => sheetList.find(w => w.type === t);

  window.Weapons = {
    list: sheetList,
    byType,
    pistol:  first('pistol'),
    smg:     first('smg'),
    rifle:   first('rifle'),
    shotgun: first('shotgun'),
    sniper:  first('sniper'),
    rocket:  first('heavy'),
    knife,
    grenade,
    // Skin (sheet) management
    NUM_SKINS,
    DEFAULT_SKIN,
    setSkinIdx,
    getSkinIdx: () => activeSkin,
    isSkinLoaded: (idx) => sheetState[idx] === 'ready',
    preloadSkin: loadSheet
  };

  // Kick off the default sheet immediately — most renders happen straight away.
  loadSheet(DEFAULT_SKIN);
})();
