// Weapons atlas. Each source sheet in assets/weapons contains the same layout;
// only the texture/style changes. The detected regions below come from 33.png.

(function () {
  const DEFAULT_SHEET_ID = 33;
  const SOURCE_SCALE = 0.25;
  const SHEET_IDS = Array.from({ length: 34 }, (_, i) => i);

  const REGIONS = [
    [45, 19, 32, 20],
    [111, 19, 46, 20],
    [206, 19, 52, 20],
    [353, 19, 45, 16],
    [448, 19, 67, 17],
    [560, 19, 73, 19],
    [894, 19, 75, 27],
    [700, 24, 56, 22],
    [809, 28, 45, 18],
    [353, 44, 41, 15],
    [448, 44, 64, 16],
    [560, 44, 65, 16],
    [45, 53, 24, 22],
    [111, 53, 36, 22],
    [206, 53, 45, 22],
    [892, 54, 82, 21],
    [700, 59, 62, 16],
    [815, 63, 47, 12],
    [352, 68, 49, 15],
    [449, 69, 59, 16],
    [560, 69, 73, 16],
    [893, 83, 85, 24],
    [700, 87, 63, 20],
    [111, 89, 31, 32],
    [206, 89, 40, 32],
    [818, 90, 38, 17],
    [352, 92, 65, 16],
    [45, 93, 22, 22],
    [448, 94, 75, 14],
    [560, 94, 75, 14],
    [352, 117, 61, 15],
    [448, 117, 62, 15],
    [560, 117, 79, 15],
    [700, 120, 56, 18],
    [894, 120, 76, 18],
    [813, 124, 39, 14],
    [111, 136, 38, 33],
    [206, 136, 54, 33],
    [45, 138, 27, 31],
    [352, 140, 64, 16],
    [448, 141, 84, 16],
    [560, 141, 84, 16],
    [700, 151, 55, 17],
    [900, 151, 72, 17],
    [818, 155, 37, 13],
    [352, 166, 54, 15],
    [448, 166, 71, 15],
    [560, 166, 80, 15],
    [900, 177, 74, 24],
    [700, 180, 62, 15],
    [45, 183, 46, 13],
    [111, 183, 62, 16],
    [206, 183, 75, 22],
    [816, 183, 36, 12],
    [352, 190, 67, 15],
    [447, 190, 78, 15],
    [560, 190, 81, 15],
    [700, 208, 60, 15],
    [899, 208, 78, 19],
    [804, 209, 44, 14],
    [111, 213, 57, 23],
    [206, 213, 74, 23],
    [45, 214, 43, 22],
    [352, 214, 43, 16],
    [448, 214, 60, 16],
    [560, 214, 72, 16],
    [700, 236, 60, 15],
    [807, 236, 38, 15],
    [899, 236, 78, 16],
    [352, 239, 37, 16],
    [448, 239, 54, 16],
    [560, 239, 64, 16],
    [206, 249, 76, 32],
    [45, 250, 44, 27],
    [111, 250, 60, 27],
    [700, 264, 61, 26],
    [823, 264, 31, 22],
    [894, 264, 83, 26],
    [206, 290, 73, 18],
    [45, 291, 39, 15],
    [111, 291, 64, 15],
    [891, 301, 76, 16],
    [700, 303, 49, 15],
    [806, 303, 34, 14],
    [45, 320, 27, 15],
    [135, 320, 40, 15],
    [206, 320, 64, 21],
    [893, 330, 74, 16],
    [700, 331, 51, 15],
    [817, 331, 24, 15],
    [206, 348, 67, 32],
    [110, 349, 53, 27],
    [45, 354, 38, 22],
    [700, 359, 60, 15],
    [808, 359, 42, 15],
    [894, 359, 79, 15],
    [700, 387, 54, 20],
    [893, 387, 72, 22],
    [810, 389, 32, 18],
    [111, 391, 43, 24],
    [45, 392, 27, 23],
    [206, 392, 57, 23],
    [700, 420, 59, 22],
    [893, 420, 81, 22],
    [810, 421, 36, 21],
    [352, 500, 112, 24],
    [493, 500, 82, 24],
    [614, 500, 131, 24],
    [25, 511, 49, 17],
    [128, 511, 53, 17],
    [238, 511, 45, 17],
    [832, 511, 16, 14],
    [874, 511, 16, 14],
    [915, 511, 18, 14],
    [832, 530, 28, 16],
    [874, 530, 28, 16],
    [915, 530, 29, 16],
    [352, 539, 106, 20],
    [492, 539, 85, 20],
    [614, 539, 138, 20],
    [127, 544, 67, 17],
    [23, 546, 63, 14],
    [236, 546, 52, 14],
    [832, 551, 26, 16],
    [873, 551, 27, 16],
    [913, 551, 29, 16],
    [913, 571, 31, 17],
    [832, 572, 29, 16],
    [874, 572, 29, 16],
    [352, 574, 96, 23],
    [492, 574, 70, 23],
    [615, 574, 128, 23],
    [127, 580, 81, 21],
    [25, 584, 75, 15],
    [238, 584, 63, 15],
    [832, 593, 22, 16],
    [874, 593, 22, 16],
    [915, 593, 22, 16],
    [354, 612, 93, 22],
    [492, 612, 79, 22],
    [615, 612, 128, 22],
    [915, 613, 30, 17],
    [832, 614, 29, 16],
    [874, 614, 29, 16],
    [122, 622, 87, 21],
    [25, 625, 56, 16],
    [238, 625, 48, 16],
    [832, 637, 20, 17],
    [915, 637, 23, 19],
    [874, 638, 20, 16],
    [354, 649, 111, 24],
    [499, 649, 78, 24],
    [615, 649, 140, 27],
    [832, 661, 21, 15],
    [874, 662, 21, 14],
    [915, 662, 21, 14],
    [121, 666, 94, 17],
    [25, 667, 70, 15],
    [238, 667, 56, 15],
    [354, 688, 109, 22],
    [494, 688, 74, 22],
    [615, 688, 146, 25],
    [128, 707, 83, 14],
    [25, 708, 69, 16],
    [245, 708, 50, 14],
    [354, 725, 118, 18],
    [501, 725, 76, 18],
    [615, 725, 146, 18],
    [126, 747, 85, 23],
    [25, 750, 49, 16],
    [244, 750, 43, 13],
    [354, 753, 117, 26],
    [504, 753, 77, 26],
    [614, 753, 143, 26],
    [25, 793, 74, 15],
    [123, 793, 92, 16],
    [248, 793, 57, 11],
    [354, 794, 81, 26],
    [498, 794, 59, 25],
    [614, 794, 110, 27],
    [354, 835, 81, 21],
    [498, 835, 57, 20],
    [614, 835, 121, 21]
  ];

  const cache = new Map();
  let activeSheetId = DEFAULT_SHEET_ID;
  let activeImage = null;
  let loadToken = 0;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const pad3 = (n) => String(n).padStart(3, '0');

  function normalizeSheetId(sheetId) {
    const id = Number(sheetId);
    return SHEET_IDS.includes(id) ? id : DEFAULT_SHEET_ID;
  }

  function event(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function loadImage(sheetId) {
    if (cache.has(sheetId)) return cache.get(sheetId);
    const image = new Image();
    image.decoding = 'async';
    image.src = `assets/weapons/${sheetId}.png`;
    cache.set(sheetId, image);
    return image;
  }

  function setSheet(sheetId) {
    const id = normalizeSheetId(sheetId);
    activeSheetId = id;
    const image = loadImage(id);
    const token = ++loadToken;

    const publish = () => {
      if (token !== loadToken || activeSheetId !== id) return;
      activeImage = image;
      event('weapons:loaded', { sheetId: id });
    };

    if (image.complete && image.naturalWidth > 0) {
      publish();
      return;
    }

    image.addEventListener('load', publish, { once: true });
    image.addEventListener('error', () => {
      if (token !== loadToken || activeSheetId !== id) return;
      event('weapons:error', { sheetId: id });
    }, { once: true });
  }

  function classify(width, height) {
    if (width <= 7 && height <= 6) {
      return { type: 'grenade', twoHanded: false };
    }
    if (width <= 13) {
      return { type: 'sidearm', twoHanded: false };
    }
    if (width >= 24) {
      return { type: 'heavy', twoHanded: true };
    }
    return { type: 'longgun', twoHanded: width >= 14 };
  }

  function makeAnchors(width, height, twoHanded) {
    const gripBias = twoHanded ? 0.34 : 0.28;
    const gripX = clamp(Math.round(width * gripBias), 1, Math.max(1, width - 1));
    const gripY = clamp(Math.round(height * 0.72), 1, Math.max(1, height - 1));
    const foregripX = clamp(Math.round(width * 0.64), gripX + 1, width);
    const foregripY = clamp(Math.round(height * 0.55), 0, Math.max(0, height - 1));
    const muzzleY = clamp(Math.round(height * 0.42), 0, Math.max(0, height - 1));
    return { gripX, gripY, foregripX, foregripY, muzzleX: width, muzzleY };
  }

  function makeWeapon(region, index) {
    const [sx, sy, sw, sh] = region;
    const width = Math.max(1, sw * SOURCE_SCALE);
    const height = Math.max(1, sh * SOURCE_SCALE);
    const role = classify(width, height);
    const anchors = makeAnchors(width, height, role.twoHanded);

    return {
      name: `Weapon ${pad3(index + 1)}`,
      type: role.type,
      twoHanded: role.twoHanded,
      width,
      height,
      gripX: anchors.gripX,
      gripY: anchors.gripY,
      foregripX: anchors.foregripX,
      foregripY: anchors.foregripY,
      muzzleX: anchors.muzzleX,
      muzzleY: anchors.muzzleY,
      source: { sx, sy, sw, sh },
      draw(ctx, px, py, flipX) {
        if (!activeImage || !activeImage.complete || activeImage.naturalWidth === 0) return;

        const tlx = px - anchors.gripX;
        const tly = py - anchors.gripY;

        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (flipX) {
          ctx.translate(tlx + width, tly);
          ctx.scale(-1, 1);
          ctx.drawImage(activeImage, sx, sy, sw, sh, 0, 0, width, height);
        } else {
          ctx.drawImage(activeImage, sx, sy, sw, sh, tlx, tly, width, height);
        }
        ctx.restore();
      }
    };
  }

  const list = REGIONS.map(makeWeapon);

  window.Weapons = {
    DEFAULT_SHEET_ID,
    sheetIds: SHEET_IDS,
    list,
    grenade: list[111] || list[0],
    getSheetId: () => activeSheetId,
    setSheet
  };

  setSheet(DEFAULT_SHEET_ID);
})();
