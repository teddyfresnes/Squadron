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
    { name: 'Uzi',        type: 'smg',     sx:  45, sy:  19, sw:  32, sh: 20, gripX:  9, gripY: 13, foregripX: 17, foregripY: 13, muzzleX: 31, muzzleY:  3 },
    { name: 'MAC-10',     type: 'smg',     sx:  45, sy:  53, sw:  24, sh: 22, gripX:  7, gripY: 15, foregripX: 15, foregripY: 10, muzzleX: 23, muzzleY:  4 },
    { name: 'TEC-9',      type: 'smg',     sx:  45, sy:  93, sw:  22, sh: 22, gripX:  8, gripY: 12, foregripX: 13, foregripY:  9, muzzleX: 21, muzzleY:  2 },
    { name: 'Skorpion vz. 61', type: 'smg', sx:  45, sy: 138, sw:  27, sh: 31, gripX: 13, gripY: 13, foregripX: 15, foregripY: 13, muzzleX: 26, muzzleY:  6 },
    { name: 'HK MP7',     type: 'smg',     sx:  45, sy: 183, sw:  46, sh: 13, gripX: 15, gripY: 12, foregripX: 30, foregripY: 12, muzzleX: 45, muzzleY:  7 },
    { name: 'FN P90',     type: 'smg',     sx:  45, sy: 214, sw:  43, sh: 22, gripX: 23, gripY: 17, foregripX: 31, foregripY: 13, muzzleX: 42, muzzleY: 10 },
    { name: 'FN P90 Tactical', type: 'smg', sx:  45, sy: 250, sw:  44, sh: 27, gripX: 17, gripY: 21, foregripX: 31, foregripY: 16, muzzleX: 43, muzzleY: 10 },
    { name: 'MP5K-PDW',   type: 'smg',     sx:  45, sy: 291, sw:  39, sh: 15, gripX: 22, gripY: 11, foregripX: 27, foregripY:  9, muzzleX: 34, muzzleY:  2 },
    { name: 'MP9 Suppressed', type: 'smg', sx:  45, sy: 320, sw:  27, sh: 15, gripX:  9, gripY: 10, foregripX: 17, foregripY:  8, muzzleX: 26, muzzleY:  3 },
    { name: 'Thompson M1A1', type: 'smg',  sx:  45, sy: 354, sw:  38, sh: 23, gripX: 13, gripY: 11, foregripX: 24, foregripY: 14, muzzleX: 37, muzzleY:  2 },
    { name: 'KRISS Vector', type: 'smg',   sx:  45, sy: 392, sw:  27, sh: 23, gripX: 14, gripY: 11, foregripX: 16, foregripY: 11, muzzleX: 26, muzzleY:  4 },

    { name: 'AK-47',      type: 'rifle',   sx: 352, sy:  19, sw:  46, sh: 16, gripX: 18, gripY: 11, foregripX: 29, foregripY: 11, muzzleX: 45, muzzleY:  3 },
    { name: 'AKS-74U',    type: 'rifle',   sx: 352, sy:  44, sw:  42, sh: 15, gripX: 16, gripY: 10, foregripX: 29, foregripY: 10, muzzleX: 41, muzzleY:  2 },
    { name: 'AK-74',      type: 'rifle',   sx: 352, sy:  68, sw:  49, sh: 15, gripX: 18, gripY: 10, foregripX: 36, foregripY: 10, muzzleX: 48, muzzleY:  4 },
    { name: 'M4A1 Suppressed', type: 'rifle', sx: 352, sy:  92, sw:  65, sh: 16, gripX: 25, gripY: 11, foregripX: 39, foregripY: 10, muzzleX: 64, muzzleY:  5 },
    { name: 'Mk18 Suppressed', type: 'rifle', sx: 352, sy: 117, sw:  61, sh: 15, gripX: 23, gripY: 10, foregripX: 38, foregripY: 10, muzzleX: 60, muzzleY:  4 },
    { name: 'HK G3',      type: 'rifle',   sx: 352, sy: 140, sw:  64, sh: 16, gripX: 21, gripY: 11, foregripX: 43, foregripY: 10, muzzleX: 63, muzzleY:  5 },
    { name: 'FN FAL',     type: 'rifle',   sx: 352, sy: 166, sw:  54, sh: 15, gripX: 22, gripY: 10, foregripX: 38, foregripY: 10, muzzleX: 53, muzzleY:  4 },
    { name: 'FN FAL Tactical', type: 'rifle', sx: 352, sy: 190, sw:  67, sh: 15, gripX: 24, gripY: 10, foregripX: 42, foregripY: 10, muzzleX: 66, muzzleY:  4 },
    { name: 'FAMAS F1',   type: 'rifle',   sx: 352, sy: 214, sw:  43, sh: 16, gripX: 18, gripY: 11, foregripX: 29, foregripY: 11, muzzleX: 42, muzzleY:  5 },
    { name: 'FAMAS Compact', type: 'rifle', sx: 352, sy: 239, sw:  37, sh: 16, gripX: 16, gripY: 11, foregripX: 25, foregripY: 11, muzzleX: 36, muzzleY:  5 },

    { name: 'M202 FLASH', type: 'heavy',   sx: 700, sy:  24, sw:  56, sh: 22, gripX: 28, gripY: 16, foregripX: 39, foregripY: 15, muzzleX: 55, muzzleY: 10 },
    { name: 'Laser Cannon', type: 'heavy', sx: 700, sy:  59, sw:  62, sh: 16, gripX: 35, gripY: 13, foregripX: 48, foregripY: 12, muzzleX: 61, muzzleY:  7 },
    { name: 'Carl Gustaf M3', type: 'heavy', sx: 700, sy:  87, sw:  63, sh: 20, gripX: 29, gripY: 15, foregripX: 43, foregripY: 15, muzzleX: 62, muzzleY:  7 },
    { name: 'XM25 Grenade Launcher', type: 'heavy', sx: 700, sy: 120, sw:  56, sh: 18, gripX: 25, gripY: 13, foregripX: 40, foregripY: 12, muzzleX: 55, muzzleY:  6 },
    { name: 'RPG-7 Launcher', type: 'heavy', sx: 700, sy: 151, sw:  55, sh: 17, gripX: 34, gripY: 13, foregripX: 44, foregripY: 13, muzzleX: 54, muzzleY:  7 },
    { name: 'Recoilless Rifle', type: 'heavy', sx: 700, sy: 180, sw:  62, sh: 15, gripX: 23, gripY: 12, foregripX: 43, foregripY: 11, muzzleX: 61, muzzleY:  6 },
    { name: 'FIM-92 Stinger', type: 'heavy', sx: 700, sy: 208, sw:  60, sh: 15, gripX: 17, gripY: 12, foregripX: 37, foregripY: 10, muzzleX: 59, muzzleY:  5 },
    { name: 'AT4 Launcher', type: 'heavy', sx: 700, sy: 236, sw:  60, sh: 15, gripX: 18, gripY: 12, foregripX: 38, foregripY: 10, muzzleX: 59, muzzleY:  4 },
    { name: 'Twin-Barrel Launcher', type: 'heavy', sx: 700, sy: 264, sw:  61, sh: 26, gripX: 24, gripY: 13, foregripX: 41, foregripY: 13, muzzleX: 60, muzzleY: 14 },
    { name: 'M79 Grenade Launcher', type: 'heavy', sx: 700, sy: 303, sw:  49, sh: 15, gripX: 18, gripY: 12, foregripX: 33, foregripY: 10, muzzleX: 48, muzzleY:  2 },
    { name: 'M60E4',      type: 'heavy',   sx: 700, sy: 331, sw:  51, sh: 15, gripX: 25, gripY: 12, foregripX: 38, foregripY: 11, muzzleX: 50, muzzleY:  3 },
    { name: 'M249 SAW',   type: 'heavy',   sx: 700, sy: 359, sw:  60, sh: 15, gripX: 24, gripY: 13, foregripX: 40, foregripY: 11, muzzleX: 59, muzzleY:  3 },
    { name: 'M134 Minigun', type: 'heavy', sx: 700, sy: 387, sw:  54, sh: 20, gripX: 20, gripY: 15, foregripX: 36, foregripY: 13, muzzleX: 53, muzzleY: 10 },
    { name: 'M32 MGL',    type: 'heavy',   sx: 700, sy: 420, sw:  59, sh: 22, gripX: 20, gripY: 16, foregripX: 40, foregripY: 14, muzzleX: 58, muzzleY: 10 },

    { name: 'Franchi SPAS-12', type: 'shotgun', sx:  25, sy: 511, sw:  49, sh: 17, gripX: 13, gripY: 11, foregripX: 34, foregripY: 12, muzzleX: 48, muzzleY:  3 },
    { name: 'Double-Barrel Shotgun', type: 'shotgun', sx:  23, sy: 546, sw:  63, sh: 16, gripX: 15, gripY: 12, foregripX: 40, foregripY: 11, muzzleX: 62, muzzleY:  2 },
    { name: 'Remington 870', type: 'shotgun', sx:  25, sy: 584, sw:  75, sh: 15, gripX: 21, gripY: 11, foregripX: 51, foregripY: 11, muzzleX: 74, muzzleY:  3 },
    { name: 'Mossberg 500', type: 'shotgun', sx:  25, sy: 625, sw:  56, sh: 16, gripX: 15, gripY: 11, foregripX: 36, foregripY: 11, muzzleX: 55, muzzleY:  2 },
    { name: 'Benelli M4', type: 'shotgun', sx:  25, sy: 667, sw:  70, sh: 15, gripX: 22, gripY: 11, foregripX: 48, foregripY: 11, muzzleX: 69, muzzleY:  2 },
    { name: 'Blunderbuss', type: 'shotgun', sx:  25, sy: 708, sw:  69, sh: 16, gripX: 23, gripY: 10, foregripX: 50, foregripY: 10, muzzleX: 68, muzzleY:  3 },
    { name: 'Sawed-Off Shotgun', type: 'shotgun', sx:  25, sy: 750, sw:  49, sh: 16, gripX: 16, gripY: 11, foregripX: 31, foregripY: 11, muzzleX: 48, muzzleY:  2 },
    { name: 'Over-Under Shotgun', type: 'shotgun', sx:  25, sy: 792, sw:  74, sh: 16, gripX: 21, gripY: 10, foregripX: 51, foregripY: 11, muzzleX: 73, muzzleY:  4 },

    { name: 'Accuracy International AWP', type: 'sniper', sx: 352, sy: 500, sw: 112, sh: 24, gripX: 27, gripY: 17, foregripX: 60, foregripY: 15, muzzleX: 111, muzzleY: 11 },
    { name: 'AWM Suppressed', type: 'sniper', sx: 352, sy: 539, sw: 106, sh: 20, gripX: 24, gripY: 15, foregripX: 57, foregripY: 13, muzzleX: 105, muzzleY:  7 },
    { name: 'SVD Dragunov', type: 'sniper', sx: 352, sy: 574, sw:  96, sh: 23, gripX: 26, gripY: 17, foregripX: 52, foregripY: 15, muzzleX:  95, muzzleY: 11 },
    { name: 'HK PSG1',    type: 'sniper',  sx: 354, sy: 612, sw:  93, sh: 22, gripX: 25, gripY: 16, foregripX: 51, foregripY: 13, muzzleX:  92, muzzleY: 10 },
    { name: 'CheyTac M200', type: 'sniper', sx: 354, sy: 649, sw: 111, sh: 24, gripX: 28, gripY: 18, foregripX: 58, foregripY: 15, muzzleX: 110, muzzleY: 12 },
    { name: 'Barrett M82A1', type: 'sniper', sx: 354, sy: 688, sw: 109, sh: 22, gripX: 28, gripY: 17, foregripX: 58, foregripY: 14, muzzleX: 108, muzzleY: 10 },
    { name: 'Steyr HS .50', type: 'sniper', sx: 354, sy: 725, sw: 118, sh: 18, gripX: 27, gripY: 14, foregripX: 58, foregripY: 12, muzzleX: 117, muzzleY:  5 },
    { name: 'PGM Hecate II', type: 'sniper', sx: 354, sy: 753, sw: 117, sh: 26, gripX: 27, gripY: 18, foregripX: 57, foregripY: 15, muzzleX: 116, muzzleY: 13 },
    { name: 'Steyr Scout', type: 'sniper', sx: 354, sy: 794, sw:  81, sh: 26, gripX: 22, gripY: 17, foregripX: 45, foregripY: 16, muzzleX:  80, muzzleY: 14 },
    { name: 'Compact Marksman Rifle', type: 'sniper', sx: 354, sy: 835, sw:  81, sh: 21, gripX: 22, gripY: 16, foregripX: 46, foregripY: 14, muzzleX:  80, muzzleY:  9 },

    { name: 'Walther PPK', type: 'pistol', sx: 832, sy: 511, sw:  16, sh: 14, gripX:  5, gripY:  9, foregripX:  7, foregripY:  9, muzzleX: 15, muzzleY:  4 },
    { name: 'Colt Python', type: 'pistol', sx: 832, sy: 530, sw:  28, sh: 16, gripX:  7, gripY: 10, foregripX: 10, foregripY:  9, muzzleX: 27, muzzleY:  5 },
    { name: 'S&W Model 29', type: 'pistol', sx: 832, sy: 551, sw:  26, sh: 16, gripX:  7, gripY: 10, foregripX: 10, foregripY:  9, muzzleX: 25, muzzleY:  4 },
    { name: 'Ruger Super Redhawk', type: 'pistol', sx: 832, sy: 572, sw:  29, sh: 16, gripX:  7, gripY: 10, foregripX: 11, foregripY:  9, muzzleX: 28, muzzleY:  3 },
    { name: 'Glock 17',   type: 'pistol',  sx: 832, sy: 593, sw:  22, sh: 16, gripX:  8, gripY: 11, foregripX: 11, foregripY: 10, muzzleX: 21, muzzleY:  2 },
    { name: 'Desert Eagle', type: 'pistol', sx: 832, sy: 614, sw:  29, sh: 16, gripX:  9, gripY: 10, foregripX: 13, foregripY:  9, muzzleX: 28, muzzleY:  2 },
    { name: 'Gold M1911', type: 'pistol',  sx: 832, sy: 637, sw:  20, sh: 17, gripX:  8, gripY: 11, foregripX: 11, foregripY: 10, muzzleX: 19, muzzleY:  2 },
    { name: 'Makarov PM', type: 'pistol',  sx: 832, sy: 661, sw:  21, sh: 15, gripX:  6, gripY: 10, foregripX:  9, foregripY:  9, muzzleX: 20, muzzleY:  2 }
  ];

  // Three-column sprite layout per weapon row. Columns are stored left-to-right;
  // category rules below decide which visual is base, mk1, and mk2.
  const VISUAL_CROPS_BY_ID = {
    'SMG-01': [[45, 19, 32, 20], [111, 19, 46, 20], [206, 19, 52, 20]],
    'SMG-02': [[45, 53, 24, 22], [111, 53, 36, 22], [206, 53, 45, 22]],
    'SMG-03': [[45, 93, 22, 22], [111, 89, 31, 32], [206, 89, 40, 32]],
    'SMG-04': [[45, 138, 27, 31], [111, 136, 38, 33], [206, 136, 54, 33]],
    'SMG-05': [[45, 183, 46, 13], [111, 183, 62, 16], [206, 183, 75, 22]],
    'SMG-06': [[45, 214, 43, 22], [111, 213, 57, 23], [206, 213, 74, 23]],
    'SMG-07': [[45, 250, 44, 27], [111, 250, 60, 27], [206, 249, 76, 32]],
    'SMG-08': [[45, 291, 39, 15], [111, 291, 64, 15], [206, 290, 73, 18]],
    'SMG-09': [[45, 320, 27, 15], [114, 320, 61, 15], [206, 320, 64, 21]],
    'SMG-10': [[45, 354, 38, 23], [110, 349, 53, 28], [206, 348, 67, 33]],
    'SMG-11': [[45, 392, 27, 23], [111, 391, 43, 24], [206, 392, 57, 23]],
    'RIFLE-01': [[352, 19, 46, 16], [448, 19, 67, 17], [560, 19, 73, 19]],
    'RIFLE-02': [[352, 44, 42, 15], [448, 44, 64, 16], [560, 44, 65, 16]],
    'RIFLE-03': [[352, 68, 49, 15], [448, 69, 60, 16], [560, 69, 73, 16]],
    'RIFLE-04': [[352, 92, 65, 16], [448, 94, 75, 14], [560, 94, 75, 14]],
    'RIFLE-05': [[352, 117, 61, 15], [448, 117, 62, 15], [560, 117, 79, 15]],
    'RIFLE-06': [[352, 140, 64, 16], [448, 141, 84, 16], [560, 141, 84, 16]],
    'RIFLE-07': [[352, 166, 54, 15], [448, 166, 71, 15], [560, 166, 80, 15]],
    'RIFLE-08': [[352, 190, 67, 15], [447, 190, 78, 15], [560, 190, 81, 15]],
    'RIFLE-09': [[352, 214, 43, 16], [448, 214, 60, 16], [560, 214, 72, 16]],
    'RIFLE-10': [[352, 239, 37, 16], [448, 239, 54, 16], [560, 239, 64, 16]],
    'HEAVY-01': [[700, 24, 56, 22], [809, 28, 45, 18], [894, 19, 75, 27]],
    'HEAVY-02': [[700, 59, 62, 16], [815, 63, 47, 12], [892, 54, 82, 21]],
    'HEAVY-03': [[700, 87, 63, 20], [818, 90, 38, 17], [893, 83, 85, 24]],
    'HEAVY-04': [[700, 120, 56, 18], [813, 124, 39, 14], [894, 120, 76, 18]],
    'HEAVY-05': [[700, 151, 55, 17], [818, 155, 37, 13], [900, 151, 72, 17]],
    'HEAVY-06': [[700, 180, 62, 15], [816, 183, 36, 12], [900, 177, 74, 24]],
    'HEAVY-07': [[700, 208, 60, 15], [804, 209, 44, 14], [899, 208, 78, 19]],
    'HEAVY-08': [[700, 236, 60, 15], [807, 236, 38, 15], [899, 236, 78, 16]],
    'HEAVY-09': [[700, 264, 61, 26], [823, 264, 31, 22], [894, 264, 83, 26]],
    'HEAVY-10': [[700, 303, 49, 15], [806, 303, 34, 14], [891, 301, 76, 16]],
    'HEAVY-11': [[700, 331, 51, 15], [817, 331, 24, 15], [893, 330, 74, 16]],
    'HEAVY-12': [[700, 359, 60, 15], [808, 359, 42, 15], [894, 359, 79, 15]],
    'HEAVY-13': [[700, 387, 54, 20], [810, 389, 32, 18], [893, 387, 72, 22]],
    'HEAVY-14': [[700, 420, 59, 22], [810, 421, 36, 21], [893, 420, 81, 22]],
    'SHOTGUN-01': [[25, 511, 49, 17], [128, 511, 53, 17], [238, 511, 45, 17]],
    'SHOTGUN-02': [[23, 546, 63, 16], [127, 544, 67, 17], [236, 546, 52, 16]],
    'SHOTGUN-03': [[25, 584, 75, 15], [127, 580, 81, 21], [238, 584, 63, 15]],
    'SHOTGUN-04': [[25, 625, 56, 16], [122, 622, 87, 21], [238, 625, 48, 16]],
    'SHOTGUN-05': [[25, 667, 70, 15], [121, 665, 94, 18], [238, 667, 56, 15]],
    'SHOTGUN-06': [[25, 708, 69, 16], [128, 705, 83, 16], [245, 708, 50, 14]],
    'SHOTGUN-07': [[25, 750, 49, 16], [126, 747, 85, 23], [244, 750, 43, 13]],
    'SHOTGUN-08': [[25, 792, 74, 16], [123, 793, 92, 16], [248, 792, 57, 12]],
    'SNIPER-01': [[352, 500, 112, 24], [493, 500, 82, 24], [614, 500, 131, 24]],
    'SNIPER-02': [[352, 539, 106, 20], [492, 539, 85, 20], [614, 539, 138, 20]],
    'SNIPER-03': [[352, 574, 96, 23], [492, 574, 70, 23], [615, 574, 128, 23]],
    'SNIPER-04': [[354, 612, 93, 22], [492, 612, 79, 22], [615, 612, 128, 22]],
    'SNIPER-05': [[354, 649, 111, 24], [499, 649, 78, 24], [615, 649, 140, 27]],
    'SNIPER-06': [[354, 688, 109, 22], [494, 688, 74, 22], [615, 688, 146, 25]],
    'SNIPER-07': [[354, 725, 118, 18], [501, 725, 76, 18], [615, 725, 146, 18]],
    'SNIPER-08': [[354, 753, 117, 26], [504, 753, 77, 26], [614, 753, 143, 26]],
    'SNIPER-09': [[354, 794, 81, 26], [498, 794, 59, 25], [614, 794, 110, 27]],
    'SNIPER-10': [[354, 835, 81, 21], [498, 835, 57, 20], [614, 835, 121, 21]],
    'PISTOL-01': [[832, 511, 16, 14], [874, 511, 16, 14], [915, 511, 18, 14]],
    'PISTOL-02': [[832, 530, 28, 16], [874, 530, 28, 16], [915, 530, 29, 16]],
    'PISTOL-03': [[832, 551, 26, 16], [871, 550, 29, 17], [913, 551, 29, 16]],
    'PISTOL-04': [[832, 572, 29, 16], [874, 572, 29, 16], [913, 571, 31, 17]],
    'PISTOL-05': [[832, 593, 22, 16], [874, 593, 22, 16], [915, 593, 22, 16]],
    'PISTOL-06': [[832, 614, 29, 16], [874, 614, 29, 16], [915, 613, 30, 17]],
    'PISTOL-07': [[832, 637, 20, 17], [874, 638, 20, 16], [915, 637, 23, 19]],
    'PISTOL-08': [[832, 661, 21, 15], [874, 662, 21, 14], [915, 662, 21, 14]]
  };

  const DISPLAY_NAMES_BY_ID = {
    'SMG-01': 'M3 Grease Goon',
    'SMG-02': 'TEK-9',
    'SMG-03': 'MAK-11',
    'SMG-04': 'Skorpian vz. 61',
    'SMG-05': 'HX MP7',
    'SMG-06': 'PN P90',
    'SMG-07': 'PN F2001',
    'SMG-08': 'Ozi',
    'SMG-09': 'Kolt SCAMP',
    'SMG-10': 'TPX',
    'SMG-11': 'MPX9',
    'RIFLE-01': 'AK-48',
    'RIFLE-02': 'AKS-74V',
    'RIFLE-03': 'AK-74N',
    'RIFLE-04': 'M4A2 Suppressed',
    'RIFLE-05': 'Mk18S Suppressed',
    'RIFLE-06': 'HX G3',
    'RIFLE-07': 'PN FAL',
    'RIFLE-08': 'M204',
    'RIFLE-09': 'FAMAZ F1',
    'RIFLE-10': 'FAMAZ Compact',
    'HEAVY-01': 'Infernal Toob',
    'HEAVY-02': 'Lazor Cannon',
    'HEAVY-03': 'Karl Gustov M3',
    'HEAVY-04': 'XM26 Grenade Lobber',
    'HEAVY-05': 'RPG-8 Launcher',
    'HEAVY-06': 'Recoillite Rifle',
    'HEAVY-07': 'FIM-93 Stingar',
    'HEAVY-08': 'AT5 Launcher',
    'HEAVY-09': 'M202 FLARE',
    'HEAVY-10': 'M80 Grenade Launcher',
    'HEAVY-11': 'M61E4',
    'HEAVY-12': 'M248 SAW',
    'HEAVY-13': 'M135 Minigun',
    'HEAVY-14': 'M33 MGL',
    'SHOTGUN-01': 'Franchi SPAX-12',
    'SHOTGUN-02': 'Stooger Coach Gun',
    'SHOTGUN-03': 'Ithaka 37',
    'SHOTGUN-04': 'Mossburg 500',
    'SHOTGUN-05': 'Double-Barrel Shogun',
    'SHOTGUN-06': 'Blunderbus',
    'SHOTGUN-07': 'Flintlok Shogun',
    'SHOTGUN-08': 'Over-Under Shogun',
    'SNIPER-01': 'AWQ',
    'SNIPER-02': 'AWN',
    'SNIPER-03': 'SVD Dragunof',
    'SNIPER-04': 'HX PSG1',
    'SNIPER-05': 'CheyTak M200',
    'SNIPER-06': 'Barret M82A2',
    'SNIPER-07': 'Steir HS .50',
    'SNIPER-08': 'PGM Hekate II',
    'SNIPER-09': 'Steir Scout',
    'SNIPER-10': 'Compact Marksman Rifl',
    'PISTOL-01': 'Makarovv PM',
    'PISTOL-02': 'Ruger Mark I Silenst',
    'PISTOL-03': 'Sovyet PB 6P9 Silenced',
    'PISTOL-04': 'High Standart HDM',
    'PISTOL-05': 'Beretta 93',
    'PISTOL-06': 'Revolvair',
    'PISTOL-07': 'Gold M1912',
    'PISTOL-08': 'Makarovv PM Mk.II'
  };

  const ALIASES_BY_ID = {
    'SMG-01': ['M3 Grease GUN'],
    'SMG-02': ['TEC-9', 'MAC-10', 'MAK-10'],
    'SMG-03': ['MAC-11'],
    'SMG-04': ['Skorpion vz. 61'],
    'SMG-05': ['HK MP7'],
    'SMG-06': ['FN P90'],
    'SMG-07': ['FN F2000', 'FN P90 Tactical', 'PN P90 Tac'],
    'SMG-08': ['Uzi', 'MP5K-PDW', 'MP5Q-PDW'],
    'SMG-09': ['Colt SCAMP', 'MP9 Suppressed', 'MPX9 Suppressed'],
    'SMG-10': ['TP9', 'Thompson M1A1', 'Thompsen M1A1'],
    'SMG-11': ['MP9', 'KRISS Vector', 'KRYSS Vector'],
    'RIFLE-01': ['AK-47'],
    'RIFLE-02': ['AKS-74U'],
    'RIFLE-03': ['AK-74'],
    'RIFLE-04': ['M4A1 Suppressed'],
    'RIFLE-05': ['Mk18 Suppressed'],
    'RIFLE-06': ['HK G3'],
    'RIFLE-07': ['FN FAL'],
    'RIFLE-08': ['M203', 'FN FAL Tactical', 'PN FAL Tac'],
    'RIFLE-09': ['FAMAS F1'],
    'RIFLE-10': ['FAMAS Compact'],
    'HEAVY-01': ['INFERNAL TUBE'],
    'HEAVY-02': ['Laser Cannon'],
    'HEAVY-03': ['Carl Gustaf M3'],
    'HEAVY-04': ['XM25 Grenade Launcher'],
    'HEAVY-05': ['RPG-7 Launcher'],
    'HEAVY-06': ['Recoilless Rifle'],
    'HEAVY-07': ['FIM-92 Stinger'],
    'HEAVY-08': ['AT4 Launcher'],
    'HEAVY-09': ['M202 FLASH', 'Twin-Barrel Launcher', 'Twin-Barrel Lancher'],
    'HEAVY-10': ['M79 Grenade Launcher'],
    'HEAVY-11': ['M60E4'],
    'HEAVY-12': ['M249 SAW'],
    'HEAVY-13': ['M134 Minigun'],
    'HEAVY-14': ['M32 MGL'],
    'SHOTGUN-01': ['Franchi SPAS-12'],
    'SHOTGUN-02': ['Stoeger Coach Gun'],
    'SHOTGUN-03': ['Ithaca 37', 'Remington 870', 'Reminton 870'],
    'SHOTGUN-04': ['Mossberg 500'],
    'SHOTGUN-05': ['Double-Barrel Shotgun', 'Benelli M4', 'Bonelli M4'],
    'SHOTGUN-06': ['Blunderbuss'],
    'SHOTGUN-07': ['Flintlock Shotgun', 'Sawed-Off Shotgun', 'Sawed-Off Shogun'],
    'SHOTGUN-08': ['Over-Under Shotgun'],
    'SNIPER-01': ['AWP', 'Accuracy International AWP', 'Accurazy AWP'],
    'SNIPER-02': ['AWM', 'AWM Suppressed', 'AWN Suppressed'],
    'SNIPER-03': ['SVD Dragunov'],
    'SNIPER-04': ['HK PSG1'],
    'SNIPER-05': ['CheyTac M200'],
    'SNIPER-06': ['Barrett M82A1'],
    'SNIPER-07': ['Steyr HS .50'],
    'SNIPER-08': ['PGM Hecate II'],
    'SNIPER-09': ['Steyr Scout'],
    'SNIPER-10': ['Compact Marksman Rifle'],
    'PISTOL-01': ['Makarov PM', 'Walther PPK', 'Walthar PPK'],
    'PISTOL-02': ['Ruger Mark I Silenced', 'Colt Python', 'Kolt Python'],
    'PISTOL-03': ['Soviet PB 6P9 Silenced', 'S&W Model 29', 'S&W Modal 29'],
    'PISTOL-04': ['High Standard HDM', 'Ruger Super Redhawk', 'Ruger Super Redhauk'],
    'PISTOL-05': ['Beretta 92', 'Glock 17', 'Glok 17'],
    'PISTOL-06': ['Revolver', 'Desert Eagle', 'Dezert Eagle'],
    'PISTOL-07': ['Gold M1911'],
    'PISTOL-08': []
  };

  const HOLD_BY_TYPE = {
    pistol:  { holdStyle: 'pistol',  stanceProfile: 'one-hand', recoilProfile: 'snap' },
    smg:     { holdStyle: 'smg',     stanceProfile: 'compact',  recoilProfile: 'buzz' },
    rifle:   { holdStyle: 'rifle',   stanceProfile: 'shoulder', recoilProfile: 'medium' },
    shotgun: { holdStyle: 'shotgun', stanceProfile: 'low-heavy', recoilProfile: 'pump' },
    sniper:  { holdStyle: 'sniper',  stanceProfile: 'precision', recoilProfile: 'controlled-heavy' },
    heavy:   { holdStyle: 'heavy',   stanceProfile: 'braced',   recoilProfile: 'heavy' }
  };

  const HOLD_OVERRIDES = {
    'PISTOL-01':  { holdVariant: 'pocket' },
    'PISTOL-02':  { holdVariant: 'long-slide' },
    'PISTOL-04':  { holdVariant: 'long-slide' },
    'PISTOL-06':  { holdVariant: 'long-slide' },
    'SMG-01':     { holdVariant: 'compact' },
    'SMG-04':     { holdVariant: 'tall-compact' },
    'SMG-05':     { holdVariant: 'long-smg' },
    'SMG-06':     { holdVariant: 'long-smg' },
    'SMG-07':     { holdVariant: 'long-smg' },
    'SHOTGUN-01': { holdVariant: 'short-shotgun' },
    'SHOTGUN-02': { holdVariant: 'long-shotgun' },
    'SHOTGUN-03': { holdVariant: 'long-shotgun' },
    'SHOTGUN-05': { holdVariant: 'long-shotgun' },
    'SHOTGUN-06': { holdVariant: 'long-shotgun' },
    'SHOTGUN-08': { holdVariant: 'long-shotgun' },
    'RIFLE-04':   { holdVariant: 'long-rifle' },
    'RIFLE-05':   { holdVariant: 'long-rifle' },
    'RIFLE-06':   { holdVariant: 'long-rifle' },
    'RIFLE-08':   { holdVariant: 'long-rifle' },
    'SNIPER-01':  { holdVariant: 'long-sniper' },
    'SNIPER-05':  { holdVariant: 'long-sniper' },
    'SNIPER-06':  { holdVariant: 'long-sniper' },
    'SNIPER-07':  { holdVariant: 'long-sniper' },
    'SNIPER-08':  { holdVariant: 'long-sniper' },
    'SNIPER-09':  { holdVariant: 'compact-sniper' },
    'SNIPER-10':  { holdVariant: 'compact-sniper' },
    'HEAVY-01':   { holdVariant: 'launcher' },
    'HEAVY-02':   { holdVariant: 'launcher' },
    'HEAVY-03':   { holdVariant: 'launcher' },
    'HEAVY-05':   { holdVariant: 'launcher' },
    'HEAVY-07':   { holdVariant: 'launcher' },
    'HEAVY-08':   { holdVariant: 'launcher' },
    'HEAVY-09':   { holdVariant: 'launcher' },
    'HEAVY-11':   { holdStyle: 'rifle', holdVariant: 'long-rifle' },
    'HEAVY-12':   { holdStyle: 'rifle', holdVariant: 'long-rifle' },
    'HEAVY-13':   { holdVariant: 'cannon' },
    'HEAVY-14':   { holdVariant: 'cannon' }
  };

  function holdMetaFor(def) {
    return Object.assign(
      {},
      HOLD_BY_TYPE[def.type] || HOLD_BY_TYPE.rifle,
      HOLD_OVERRIDES[def.id] || HOLD_OVERRIDES[def.baseWeaponId] || HOLD_OVERRIDES[def.name] || {}
    );
  }

  // ---------- Sprite-sheet weapon ----------
  function makeSheetWeapon(def) {
    const twoHanded = def.type !== 'pistol';
    const holdMeta = holdMetaFor(def);
    const w = {
      name: def.name,
      id: def.id || def.name,
      type: def.type,
      aliases: def.aliases || [],
      mkLevel: def.mkLevel || 0,
      baseWeaponId: def.baseWeaponId || def.id || def.name,
      upgradeFromId: def.upgradeFromId || null,
      holdStyle: holdMeta.holdStyle,
      holdVariant: holdMeta.holdVariant || 'standard',
      stanceProfile: holdMeta.stanceProfile,
      recoilProfile: holdMeta.recoilProfile,
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

  const LEGACY_PREFIX_BY_TYPE = {
    smg: 'SMG',
    rifle: 'RIFLE',
    heavy: 'HEAVY',
    shotgun: 'SHOTGUN',
    sniper: 'SNIPER',
    pistol: 'PISTOL'
  };

  const VISUAL_INDEX_BY_MK_LEVEL = {
    heavy:   [1, 0, 2],
    sniper:  [1, 0, 2],
    shotgun: [2, 0, 1]
  };

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function scaledCoord(value, scale, max) {
    return clamp(Math.round(value * scale), 0, Math.max(0, max));
  }

  function visualIndexFor(def, mkLevel) {
    const byType = VISUAL_INDEX_BY_MK_LEVEL[def.type];
    return byType ? byType[mkLevel] : mkLevel;
  }

  function makeLegacyDefs() {
    const counts = {};
    return MANIFEST.map(function (def) {
      const prefix = LEGACY_PREFIX_BY_TYPE[def.type] || String(def.type || 'WEAPON').toUpperCase();
      const n = (counts[def.type] || 0) + 1;
      counts[def.type] = n;
      return Object.assign({ id: prefix + '-' + String(n).padStart(2, '0') }, def);
    });
  }

  function makeVisualDef(baseDef, mkLevel) {
    const cropSet = VISUAL_CROPS_BY_ID[baseDef.id];
    const crop = cropSet && cropSet[visualIndexFor(baseDef, mkLevel)];
    const sx = crop ? crop[0] : baseDef.sx;
    const sy = crop ? crop[1] : baseDef.sy;
    const sw = crop ? crop[2] : baseDef.sw;
    const sh = crop ? crop[3] : baseDef.sh;
    const scaleX = sw / Math.max(1, baseDef.sw);
    const scaleY = sh / Math.max(1, baseDef.sh);
    const displayName = DISPLAY_NAMES_BY_ID[baseDef.id] || baseDef.name;
    const id = mkLevel ? baseDef.id + '-MK' + mkLevel : baseDef.id;
    const upgradeFromId = mkLevel === 1 ? baseDef.id : (mkLevel === 2 ? baseDef.id + '-MK1' : null);
    return Object.assign({}, baseDef, {
      id,
      name: mkLevel ? displayName + ' mk' + mkLevel : displayName,
      aliases: mkLevel ? [] : (ALIASES_BY_ID[baseDef.id] || []).filter(name => name && name !== displayName),
      sx,
      sy,
      sw,
      sh,
      gripX: scaledCoord(baseDef.gripX, scaleX, sw - 1),
      gripY: scaledCoord(baseDef.gripY, scaleY, sh - 1),
      foregripX: scaledCoord(baseDef.foregripX, scaleX, sw - 1),
      foregripY: scaledCoord(baseDef.foregripY, scaleY, sh - 1),
      muzzleX: Math.max(0, sw - 1),
      muzzleY: scaledCoord(baseDef.muzzleY, scaleY, sh - 1),
      mkLevel,
      baseWeaponId: baseDef.id,
      upgradeFromId
    });
  }

  const legacyBaseDefs = makeLegacyDefs();
  const sheetList = legacyBaseDefs.map(def => makeSheetWeapon(makeVisualDef(def, 0)));

  // ---------- Custom sprites (used by animations, not in the asset pack) ----------
  // Knife and grenade are tightly tied to specific animations (melee, throw)
  // and aren't drawn from the sheet. We keep them as small hand-drawn pieces.
  const px = (ctx, x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); };
  const rect = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };

  function makeWeapon(def) {
    return {
      name: def.name,
      id: def.id || def.name,
      type: def.type,
      mkLevel: def.mkLevel || 0,
      baseWeaponId: def.baseWeaponId || def.id || def.name,
      upgradeFromId: def.upgradeFromId || null,
      holdStyle: def.holdStyle,
      holdVariant: def.holdVariant || 'standard',
      aliases: def.aliases || [],
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

  const bareHands = makeWeapon({
    id: 'MELEE-01', name: 'Main nue', type: 'melee', holdStyle: 'melee', twoHanded: true,
    width: 9, height: 9, gripX: 2, gripY: 6, foregripX: 7, foregripY: 2, muzzleX: 7, muzzleY: 2,
    draw: function (ctx, x, y) {
      rect(ctx, x + 0, y + 4, 3, 3, '#d7a06e');
      px(ctx, x + 1, y + 3, '#f0bd87');
      px(ctx, x + 2, y + 3, '#f0bd87');
      px(ctx, x + 3, y + 5, '#8b5a3c');
      rect(ctx, x + 6, y + 0, 3, 3, '#d7a06e');
      px(ctx, x + 7, y + 3, '#8b5a3c');
      px(ctx, x + 7, y + 4, '#8b5a3c');
      E.outlineRegion(ctx, ctx.canvas.width, ctx.canvas.height, O);
    }
  });

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

  const mkList = [];
  for (const def of legacyBaseDefs) {
    mkList.push(makeSheetWeapon(makeVisualDef(def, 1)));
    mkList.push(makeSheetWeapon(makeVisualDef(def, 2)));
  }

  // ---------- Public API ----------
  // Base weapons keep their historical indices. Main nue remains index 61;
  // generated mk variants are appended after it.
  const weaponList = sheetList.concat([bareHands], mkList);

  function groupByType(list) {
    return {
      smg:     list.filter(w => w.type === 'smg'),
      rifle:   list.filter(w => w.type === 'rifle'),
      heavy:   list.filter(w => w.type === 'heavy'),
      shotgun: list.filter(w => w.type === 'shotgun'),
      sniper:  list.filter(w => w.type === 'sniper'),
      pistol:  list.filter(w => w.type === 'pistol'),
      melee:   [bareHands]
    };
  }

  const byType = groupByType(weaponList);
  const baseByType = groupByType(sheetList);

  const variantsByBaseId = {};
  for (const w of sheetList) variantsByBaseId[w.id] = [w];
  for (const w of mkList) {
    if (!variantsByBaseId[w.baseWeaponId]) variantsByBaseId[w.baseWeaponId] = [];
    variantsByBaseId[w.baseWeaponId][w.mkLevel] = w;
  }

  const lookup = new Map();
  function addLookup(key, weapon) {
    if (key == null) return;
    const str = String(key);
    if (str) lookup.set(str, weapon);
  }
  function rebuildLookup() {
    lookup.clear();
    for (const w of weaponList) {
      addLookup(w.id, w);
      addLookup(w.name, w);
      if (Array.isArray(w.aliases)) {
        for (const alias of w.aliases) addLookup(alias, w);
      }
    }
  }
  function resolveWeapon(value) {
    if (!value) return null;
    if (typeof value === 'object') {
      if (value.id && lookup.get(String(value.id))) return lookup.get(String(value.id));
      if (value.name && lookup.get(String(value.name))) return lookup.get(String(value.name));
      return value;
    }
    return lookup.get(String(value)) || null;
  }
  function getBaseWeapon(value) {
    const weapon = resolveWeapon(value);
    if (!weapon) return null;
    const baseId = weapon.baseWeaponId || weapon.id;
    return variantsByBaseId[baseId] ? variantsByBaseId[baseId][0] : weapon;
  }
  function getVariant(value, mkLevel) {
    const base = getBaseWeapon(value);
    if (!base) return null;
    const variants = variantsByBaseId[base.id] || [];
    return variants[mkLevel || 0] || null;
  }
  function canonicalWeaponId(value) {
    const weapon = resolveWeapon(value);
    return weapon ? weapon.id : (value ? String(value) : null);
  }

  function roundStat(value) {
    return Math.round(value * 1000) / 1000;
  }
  function clampStat(value, min, max) {
    const lo = min == null ? -Infinity : min;
    const hi = max == null ? Infinity : max;
    return roundStat(clamp(value, lo, hi));
  }
  function boostedMkStats(baseStats, mkWeapon, bonus, limits) {
    const stats = Object.assign({}, baseStats, {
      id: mkWeapon.id,
      name: mkWeapon.name,
      aliases: Array.isArray(baseStats.aliases)
        ? baseStats.aliases.map(alias => alias + ' mk' + mkWeapon.mkLevel)
        : [],
      mkLevel: mkWeapon.mkLevel,
      baseWeaponId: mkWeapon.baseWeaponId,
      upgradeFromId: mkWeapon.upgradeFromId
    });
    if (bonus.accuracyAdd) {
      stats.accuracy = clampStat((baseStats.accuracy || 0) + bonus.accuracyAdd, limits.accuracyMin, limits.accuracyMax);
    }
    if (bonus.rangeMaxAdd) stats.rangeMax = Math.max(0, Math.round((baseStats.rangeMax || 0) + bonus.rangeMaxAdd));
    if (bonus.shootSpeedMultiplier) stats.shootSpeed = roundStat((baseStats.shootSpeed || 0) * bonus.shootSpeedMultiplier);
    if (bonus.recoveryMultiplier) stats.recovery = roundStat((baseStats.recovery || 0) * bonus.recoveryMultiplier);
    if (bonus.damageMaxAdd) {
      const baseMax = baseStats.damageMax != null ? baseStats.damageMax : (baseStats.damage != null ? baseStats.damage : 1);
      stats.damageMax = clampStat(baseMax + bonus.damageMaxAdd, limits.damageMin, limits.damageMax);
    }
    const min = stats.damageMin != null ? stats.damageMin : (baseStats.damageMin != null ? baseStats.damageMin : stats.damage);
    const max = stats.damageMax != null ? stats.damageMax : (baseStats.damageMax != null ? baseStats.damageMax : stats.damage);
    if (min != null && max != null) stats.damage = roundStat((Number(min) + Number(max)) / 2);
    return stats;
  }
  function expandWeaponStats(data) {
    const raw = Array.isArray(data) ? data : ((data && data.weapons) || []);
    const limits = (data && data.limits) || {};
    const bonuses = (data && data.mkUpgradeBonuses) || {};
    const expanded = raw.map(w => Object.assign({}, w));
    const byId = {};
    const existingIds = new Set();
    for (const w of expanded) {
      if (!w || !w.id) continue;
      byId[w.id] = w;
      existingIds.add(w.id);
    }
    for (const mkWeapon of mkList) {
      if (existingIds.has(mkWeapon.id)) continue;
      const baseStats = byId[mkWeapon.baseWeaponId];
      if (!baseStats) continue;
      const bonus = bonuses['mk' + mkWeapon.mkLevel] || {};
      expanded.push(boostedMkStats(baseStats, mkWeapon, bonus, limits));
      existingIds.add(mkWeapon.id);
    }
    return expanded;
  }
  rebuildLookup();

  // First weapon of each type — keeps legacy `Weapons.rifle` etc. accessors alive
  // (animations reference them as fallbacks).
  const first = (t) => sheetList.find(w => w.type === t);

  window.Weapons = {
    list: weaponList,
    baseList: sheetList,
    mkList,
    byType,
    baseByType,
    variantsByBaseId,
    resolveWeapon,
    getBaseWeapon,
    getVariant,
    canonicalWeaponId,
    expandWeaponStats,
    rebuildLookup,
    pistol:  first('pistol'),
    smg:     first('smg'),
    rifle:   first('rifle'),
    shotgun: first('shotgun'),
    sniper:  first('sniper'),
    rocket:  first('heavy'),
    bareHands,
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
