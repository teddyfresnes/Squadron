// Body parts — each function draws one layer onto ctx at given anchor position.
// Sprite is 32x32. Character faces RIGHT by default.
// Anatomy map (approximate):
//   y  0-2   : hat / hair top
//   y  3-10  : head (8px tall, ~9px wide)
//   y 12-13  : neck / collar
//   y 14-21  : torso (8px)
//   y 22-23  : hips / belt
//   y 24-29  : legs (6px)
//   y 30-31  : boots
// Horizontal center of body at x ~ 15

(function () {
  const P = window.Palette;
  const E = window.Engine;

  const Parts = {};

  // ---------- HEAD ----------
  // Head is a compact, right-facing MiniTroopers-style mass.
  // Takes skin palette entry.
  Parts.drawHead = function (ctx, cx, cy, skin, opts) {
    opts = opts || {};
    const b = skin.base, s = skin.shade, h = skin.hl;
    const O = P.outline;

    // 9 wide, 8 tall. cx,cy is top-left of bounding box.
    const tpl = [
      '..OOOOO..',
      '.OSBBBBO.',
      'OSBBBBBBO',
      'OSBBBBBBO',
      'OSBBHBBBO',
      'OSBBBBBBO',
      '.OSBBBBO.',
      '..OOOOO..'
    ];
    const map = { O, B: b, H: h, S: s };
    E.stamp(ctx, cx, cy, tpl, map);

  };

  // ---------- WAIST BRIDGE ----------
  // Fills the rows between torso bottom and legs top when bodyDY lifts the
  // torso. Uses trouser colors so the connector reads as hips instead of a
  // black artifact.
  Parts.drawWaistBridge = function (ctx, tx, topY, legsY, pants, opts) {
    if (topY >= legsY) return;
    opts = opts || {};
    const O = P.outline;
    const b = pants && pants.base ? pants.base : P.outlineSoft;
    const s = pants && pants.shade ? pants.shade : b;
    const slender = opts.slender === true;
    // Keep the bobbing connector colored like the hips instead of drawing a
    // thick black bar between torso and legs.
    for (let y = topY; y < legsY; y++) {
      E.px(ctx, tx + 0, y, O);
      E.px(ctx, tx + 1, y, b);
      E.px(ctx, tx + 2, y, b);
      E.px(ctx, tx + 3, y, b);
      if (slender) {
        E.px(ctx, tx + 4, y, s);
        E.px(ctx, tx + 5, y, O);
      } else {
        E.px(ctx, tx + 4, y, b);
        E.px(ctx, tx + 5, y, s);
        E.px(ctx, tx + 6, y, O);
      }
    }
  };

  // ---------- NECK ----------
  // Connects head chin to torso collar. Dynamically fills any gap between them.
  // ox     : body origin X (horizontal center of neck).
  // topY   : first row below the head's chin outline.
  // torsoY : torso top row (neck ends just above it, clamped to 3 rows max).
  Parts.drawNeck = function (ctx, ox, topY, torsoY, skin) {
    const O = P.outline;
    // If the head's chin already reaches the torso top row, the neck would
    // overlap the torso — skip to avoid painting skin on the uniform.
    if (topY >= torsoY) return;
    // Tiny neck nub only; the head should sit almost directly on the collar.
    const endY = Math.min(topY, torsoY - 1);
    for (let y = topY; y <= endY; y++) {
      E.px(ctx, ox - 1, y, O);
      E.px(ctx, ox,     y, skin.base);
      E.px(ctx, ox + 1, y, O);
    }
    // Collar-bone shadow where neck meets torso — subtle darker seam.
    E.px(ctx, ox, endY, skin.shade);
  };

  // ---------- EYE ----------
  Parts.drawEye = function (ctx, cx, cy, eyeColor, opts) {
    opts = opts || {};
    // Two low, right-shifted eyes. The rear eye is larger; the front eye is
    // smaller to fake perspective on a tiny sprite.
    const ex = cx + 5, ey = cy + 5;
    const lashes = opts.lashes === true;
    const eyeOutline = lashes ? P.outline : P.outlineSoft;
    function drawLashes() {
      E.px(ctx, ex + 0, ey - 2, P.outline);
      E.px(ctx, ex + 1, ey - 2, P.outline);
      E.px(ctx, ex + 3, ey - 2, P.outline);
    }
    if (opts.closed) {
      if (lashes) E.px(ctx, ex - 1, ey, P.outline);
      E.px(ctx, ex, ey, eyeOutline);
      E.px(ctx, ex + 1, ey, eyeOutline);
      E.px(ctx, ex + 2, ey, eyeOutline);
      if (!lashes) E.px(ctx, ex + 3, ey, eyeOutline);
      if (lashes) drawLashes();
      return;
    }
    if (lashes) {
      E.px(ctx, ex - 1, ey,     eyeOutline);
      E.px(ctx, ex - 1, ey + 1, eyeOutline);
      E.px(ctx, ex + 1, ey + 2, eyeOutline);
      E.px(ctx, ex + 3, ey,     eyeOutline);
      E.px(ctx, ex + 3, ey + 1, eyeOutline);
      E.px(ctx, ex + 2, ey + 2, eyeOutline);
    } else {
      E.px(ctx, ex - 1, ey - 1, eyeOutline);
      E.px(ctx, ex,     ey - 1, eyeOutline);
      E.px(ctx, ex + 1, ey - 1, eyeOutline);
      E.px(ctx, ex + 3, ey - 1, eyeOutline);
      E.px(ctx, ex - 1, ey,     eyeOutline);
      E.px(ctx, ex + 3, ey,     eyeOutline);
      E.px(ctx, ex + 1, ey + 2, eyeOutline);
      E.px(ctx, ex + 2, ey + 2, eyeOutline);
    }
    E.px(ctx, ex,     ey,     P.white);
    E.px(ctx, ex,     ey + 1, P.white);
    E.px(ctx, ex + 1, ey,     eyeColor);
    E.px(ctx, ex + 1, ey + 1, eyeColor);

    E.px(ctx, ex + 2, ey,     P.white);
    E.px(ctx, ex + 2, ey + 1, eyeColor);
    if (lashes) drawLashes();
  };

  // ---------- HAIR ----------
  function isFemaleHairStyle(style) {
    return (
      style === 'Short' ||
      style === 'Messy' ||
      style === 'Long' ||
      style === 'Ponytail' ||
      style === 'Bob' ||
      style === 'Wavy' ||
      style === 'Flowing' ||
      style === 'High Ponytail'
    );
  }

  function usesFemaleHair(opts, style) {
    return opts && opts.bodyType === 'female' && isFemaleHairStyle(style);
  }

  function drawFemaleHairBackPixel(ctx, cx, cy, style, hairCol) {
    const b = hairCol.base, s = hairCol.shade, h = hairCol.hl;
    const O = P.outline;
    const map = { O, B: b, S: s, H: h };

    if (style === 'Short') {
      E.stamp(ctx, cx - 2, cy + 4, [
        '.OOO.',
        'OBBBO',
        '.OBSO'
      ], map);
    } else if (style === 'Messy') {
      E.stamp(ctx, cx - 3, cy + 3, [
        '..OOO.',
        '.OBBBO',
        'OBBBBO',
        'OBBBSO',
        '.OBBS.',
        '..OO..'
      ], map);
    } else if (style === 'Long') {
      E.stamp(ctx, cx - 3, cy + 2, [
        '..OOOO.',
        '.OBBBBO',
        'OBBBBBBO',
        'OBBBBBBO',
        'OBBBBSO.',
        'OBBBBSO.',
        '.OBBBSO.',
        '.OBBBS..',
        '..OOO...'
      ], map);
      E.px(ctx, cx - 1, cy + 5, h);
      E.px(ctx, cx - 1, cy + 6, h);
    } else if (style === 'Ponytail') {
      E.stamp(ctx, cx - 4, cy + 3, [
        '..OO...',
        '.OBBO..',
        'OBBBBO.',
        'OBBBBO.',
        '.OBBBSO',
        '..OBBSO',
        '...OO.'
      ], map);
      E.px(ctx, cx - 1, cy + 4, s);
      E.px(ctx, cx + 0, cy + 4, O);
    } else if (style === 'Bob') {
      E.stamp(ctx, cx - 2, cy + 3, [
        '.OOO..',
        'OBBBO.',
        'OBBBSO',
        'OBBBSO',
        '.OOO..'
      ], map);
      E.px(ctx, cx + 7, cy + 4, O);
      E.px(ctx, cx + 7, cy + 5, b);
      E.px(ctx, cx + 7, cy + 6, O);
    } else if (style === 'Wavy') {
      E.stamp(ctx, cx - 3, cy + 3, [
        '..OO..',
        '.OBBO.',
        'OBBBO.',
        'OBBBSO',
        '.OBBSO',
        '..OO..'
      ], map);
      E.px(ctx, cx - 1, cy + 6, h);
    } else if (style === 'Flowing') {
      for (let i = 0; i < 9; i++) {
        E.px(ctx, cx - 2, cy + 4 + i, O);
        E.px(ctx, cx - 1, cy + 4 + i, b);
        E.px(ctx, cx + 0, cy + 4 + i, b);
      }
      E.px(ctx, cx - 1, cy + 13, O);
      E.px(ctx, cx + 0, cy + 13, O);
      E.px(ctx, cx - 1, cy + 7, h);
      E.px(ctx, cx + 0, cy + 10, h);
    } else if (style === 'High Ponytail') {
      E.px(ctx, cx - 1, cy + 3, b); E.px(ctx, cx - 2, cy + 3, O);
      E.px(ctx, cx - 2, cy + 4, b); E.px(ctx, cx - 1, cy + 4, b); E.px(ctx, cx - 3, cy + 4, O);
      E.px(ctx, cx - 3, cy + 5, b); E.px(ctx, cx - 2, cy + 5, b); E.px(ctx, cx - 4, cy + 5, O);
      E.px(ctx, cx - 4, cy + 6, b); E.px(ctx, cx - 3, cy + 6, b); E.px(ctx, cx - 5, cy + 6, O);
      E.px(ctx, cx - 4, cy + 7, b); E.px(ctx, cx - 3, cy + 7, b); E.px(ctx, cx - 5, cy + 7, O);
      E.px(ctx, cx - 4, cy + 8, O); E.px(ctx, cx - 3, cy + 8, O);
    }
  }

  function drawFemaleHairFrontPixel(ctx, cx, cy, style, hairCol) {
    const b = hairCol.base, s = hairCol.shade, h = hairCol.hl;
    const O = P.outline;
    const map = { O, B: b, S: s, H: h };

    if (style === 'Short') {
      E.stamp(ctx, cx - 1, cy - 2, [
        '..OOOOOO...',
        '.OBBBBBBO..',
        'OBBHHBBBBO.',
        'OBHHBBBBBO.',
        'OBBBBBBBBO.',
        '.OBBBBBBO..',
        '..OBBBO....'
      ], map);
      E.px(ctx, cx + 1, cy + 2, s);
      E.px(ctx, cx + 6, cy + 1, h);
    } else if (style === 'Messy') {
      E.stamp(ctx, cx - 1, cy - 2, [
        '..OO.OOO...',
        '.OBBBBBBO..',
        'OBBHHHBBBO.',
        'OBHHBBBBBO.',
        'OBBBBBBBBO.',
        'OBBBBBBBBO.',
        '.OBBBBBO...',
        '..OBBO.....'
      ], map);
      E.px(ctx, cx + 1, cy + 3, s);
    } else if (style === 'Long') {
      E.stamp(ctx, cx - 1, cy - 2, [
        '..OOOOOO...',
        '.OBBBBBBO..',
        'OBBHHBBBBO.',
        'OBHHBBBBBO.',
        'OBBBBBBBBO.',
        'OBBBBBBBBO.',
        '.OBBBBBBO..',
        '.OBBBBOO...'
      ], map);
      E.px(ctx, cx + 1, cy + 4, s);
    } else if (style === 'Ponytail') {
      E.stamp(ctx, cx - 1, cy - 2, [
        '..OOOOOO...',
        '.OBBBBBBO..',
        'OBHHHBBBBO.',
        'OBBBBBBBBO.',
        '.OBBBBBBBO.',
        '..BBBBBBO..'
      ], map);
      E.px(ctx, cx + 1, cy + 2, s);
      E.px(ctx, cx + 2, cy + 1, s);
      E.px(ctx, cx + 6, cy + 0, h);
    } else if (style === 'Bob') {
      E.stamp(ctx, cx - 1, cy - 1, [
        '..OOOOOO...',
        '.OBBBBBBO..',
        'OBBHHBBBBO.',
        'OBBBBBBBBO.',
        'OBBBBBBBBO.',
        'OB......BO.',
        'OB......BO.',
        '.OBBBBBBO..'
      ], map);
      E.px(ctx, cx + 4, cy + 0, h);
    } else if (style === 'Wavy') {
      E.stamp(ctx, cx - 1, cy - 2, [
        '.OOOOOOOO..',
        'OBBBBBBBBO.',
        'OBBHHBBBBO.',
        'OBBBBBBBBO.',
        'OBBBBBBBBO.',
        '.BBBBBBBBO.',
        '..BBBBBBO..'
      ], map);
      E.px(ctx, cx + 1, cy - 2, h);
      E.px(ctx, cx + 6, cy - 2, h);
      E.px(ctx, cx + 1, cy + 3, s);
    } else if (style === 'Flowing') {
      E.stamp(ctx, cx - 1, cy - 1, [
        '..OOOOOO...',
        '.OBBBBBBO..',
        'OBBHHBBBBO.',
        'OBBBBBBBBO.',
        'OBBBBBBBBO.',
        '.OBBBBBBO..'
      ], map);
      E.px(ctx, cx + 8, cy + 4, b);
      E.px(ctx, cx + 8, cy + 5, O);
      E.px(ctx, cx + 1, cy + 4, s);
    } else if (style === 'High Ponytail') {
      E.stamp(ctx, cx - 1, cy - 2, [
        '...OOOO....',
        '..OBBBBO...',
        '.OBBHHBBO..',
        'OBBBBBBBBO.',
        'OBBBBBBBBO.',
        '.OBBBBBBO..'
      ], map);
      E.px(ctx, cx + 1, cy + 1, s);
      E.px(ctx, cx + 2, cy + 1, s);
      E.px(ctx, cx + 6, cy + 0, h);
    }
  }

  Parts.drawHairBack = function (ctx, cx, cy, style, hairCol, opts) {
    if (!style || style === 'Bald' || !hairCol) return;
    if (usesFemaleHair(opts, style)) drawFemaleHairBackPixel(ctx, cx, cy, style, hairCol);
  };

  Parts.drawHair = function (ctx, cx, cy, style, hairCol, opts) {
    if (!style || style === 'Bald') return;
    if (usesFemaleHair(opts, style)) {
      drawFemaleHairFrontPixel(ctx, cx, cy, style, hairCol);
      return;
    }
    const b = hairCol.base, s = hairCol.shade, h = hairCol.hl;
    const O = P.outline;
    const slender = opts && opts.slender === true;

    if (slender && style === 'Short') {
      // Chin-length bob: covers crown, sides flow down past the cheek and curl
      // under the chin so the silhouette reads distinctly feminine.
      const tpl = [
        '..OOOOOO...',
        '.OBBBBBBO..',
        'OBBHHBBBBO.',
        'OBBBBBBBBO.',
        'OBBBBBBBBO.',
        'OB......BO.',
        'OB......BO.',
        '.OBBBBBBO..'
      ];
      E.stamp(ctx, cx - 1, cy - 1, tpl, { O, B: b, H: h });
      // Side highlight strand on the crown for sheen
      E.px(ctx, cx + 4, cy + 0, h);
      return;
    }

    if (slender && style === 'Messy') {
      // Soft tousled mid-length: wavy crown, side-swept fringe, back wisps.
      const tpl = [
        '.OOOOOOOO..',
        'OBBBBBBBBO.',
        'OBBHHBBBBO.',
        'OBBBBBBBBO.',
        'OBBBBBBBBO.',
        '.BBBBBBBBO.',
        '..BBBBBBO..'
      ];
      E.stamp(ctx, cx - 1, cy - 2, tpl, { O, B: b, H: h });
      // Wisps trailing down the back
      for (let i = 0; i < 4; i++) {
        E.px(ctx, cx - 1, cy + 3 + i, O);
        E.px(ctx, cx + 0, cy + 3 + i, b);
      }
      E.px(ctx, cx + 0, cy + 7, O);
      // Wave highlights up top
      E.px(ctx, cx + 1, cy - 2, h);
      E.px(ctx, cx + 6, cy - 2, h);
      return;
    }

    if (slender && style === 'Long') {
      // Voluminous long hair flowing well past the shoulder.
      const tpl = [
        '..OOOOOO...',
        '.OBBBBBBO..',
        'OBBHHBBBBO.',
        'OBBBBBBBBO.',
        'OBBBBBBBBO.',
        '.OBBBBBBO..'
      ];
      E.stamp(ctx, cx - 1, cy - 1, tpl, { O, B: b, H: h });
      // 3-px wide trail down the back
      for (let i = 0; i < 9; i++) {
        E.px(ctx, cx - 2, cy + 4 + i, O);
        E.px(ctx, cx - 1, cy + 4 + i, b);
        E.px(ctx, cx + 0, cy + 4 + i, b);
      }
      E.px(ctx, cx - 1, cy + 13, O);
      E.px(ctx, cx + 0, cy + 13, O);
      // Sheen highlights along the trail
      E.px(ctx, cx - 1, cy + 7, h);
      E.px(ctx, cx + 0, cy + 10, h);
      // Front side strand framing the cheek
      E.px(ctx, cx + 8, cy + 4, b);
      return;
    }

    if (slender && style === 'Ponytail') {
      // High pony with extra crown volume and a curving tail behind.
      const tpl = [
        '...OOOO....',
        '..OBBBBO...',
        '.OBBHHBBO..',
        'OBBBBBBBBO.',
        'OBBBBBBBBO.',
        '.OBBBBBBO..'
      ];
      E.stamp(ctx, cx - 1, cy - 2, tpl, { O, B: b, H: h });
      // Tail behind (left side, curving down-back)
      E.px(ctx, cx - 1, cy + 3, b); E.px(ctx, cx - 2, cy + 3, O);
      E.px(ctx, cx - 2, cy + 4, b); E.px(ctx, cx - 1, cy + 4, b); E.px(ctx, cx - 3, cy + 4, O);
      E.px(ctx, cx - 3, cy + 5, b); E.px(ctx, cx - 2, cy + 5, b); E.px(ctx, cx - 4, cy + 5, O);
      E.px(ctx, cx - 4, cy + 6, b); E.px(ctx, cx - 3, cy + 6, b); E.px(ctx, cx - 5, cy + 6, O);
      E.px(ctx, cx - 4, cy + 7, b); E.px(ctx, cx - 3, cy + 7, b); E.px(ctx, cx - 5, cy + 7, O);
      E.px(ctx, cx - 4, cy + 8, O); E.px(ctx, cx - 3, cy + 8, O);
      // Hair-tie band hint
      E.px(ctx, cx + 1, cy + 1, s);
      E.px(ctx, cx + 2, cy + 1, s);
      return;
    }

    if (style === 'Textured Crop') {
      const tpl = [
        '...OO.OO...',
        '..OBBBBBBO.',
        '.OBHHBBBSO.',
        'OBBHBBBBBO.',
        'OBBBBBSBO..',
        '.OBS..BS...',
        '..B...S....'
      ];
      E.stamp(ctx, cx - 1, cy - 2, tpl, { O, B: b, S: s, H: h });
    } else if (style === 'Low Fade') {
      const tpl = [
        '....OOOO...',
        '..OOBBBBO..',
        '.OBHHBBBO..',
        'OBBBBBBBBO.',
        'OBBSSSBBO..',
        '.SS...SS...',
        '..S........'
      ];
      E.stamp(ctx, cx - 1, cy - 1, tpl, { O, B: b, S: s, H: h });
    } else if (style === 'Side Part') {
      const tpl = [
        '..OOOOOO...',
        '.OBBBBBBO..',
        'OBHHSBBBBO.',
        'OBHHBBBBBO.',
        'OBBBBBSBO..',
        '.OBB..SO...',
        '..B...S....'
      ];
      E.stamp(ctx, cx - 1, cy - 2, tpl, { O, B: b, S: s, H: h });
    } else if (style === 'Quiff') {
      const tpl = [
        '.....OO....',
        '...OOBBO...',
        '..OBHHBBO..',
        '.OBHBBBBO..',
        'OBBBBBBBBO.',
        '.OBBBBSO...',
        '..BB..S....'
      ];
      E.stamp(ctx, cx - 1, cy - 3, tpl, { O, B: b, S: s, H: h });
    } else if (style === 'Curly Top') {
      const tpl = [
        '..OO.OO....',
        '.OBBOBBBO..',
        'OBBHHOBBBO.',
        'OBBBBBBBBO.',
        '.OBBSBBBO..',
        '..B.S.BS...'
      ];
      E.stamp(ctx, cx - 1, cy - 2, tpl, { O, B: b, S: s, H: h });
    } else if (style === 'Buzz Cut') {
      const tpl = [
        '..S.S.S....',
        '.S.S.S.S...',
        '..S.S.S.S..',
        '.S.S.S.....'
      ];
      E.stamp(ctx, cx - 1, cy + 1, tpl, { O, B: b, S: s, H: h });
    } else if (style === 'Crew Cut') {
      const tpl = [
        '...OOOOO...',
        '..OBBBBBO..',
        '.OBHBBBBBO.',
        'OBBBBBBBBO.',
        '.OBBSBBO...',
        '..S..S.....'
      ];
      E.stamp(ctx, cx - 1, cy - 2, tpl, { O, B: b, S: s, H: h });
    } else if (style === 'Slick Back') {
      const tpl = [
        '...OOOOO...',
        '.OOBBBBBO..',
        'OBHHBBBBBO.',
        'OBBBBBBBBO.',
        '.OBBSSSBO..',
        '..S.S.S....'
      ];
      E.stamp(ctx, cx - 1, cy - 2, tpl, { O, B: b, S: s, H: h });
    } else if (style === 'Stubble') {
      const tpl = [
        '..S.S.S.S..',
        '.S.S.S.S.S.',
        '..S.S.S.S..'
      ];
      E.stamp(ctx, cx - 1, cy - 1, tpl, { O, B: b, S: s, H: h });
    }
  };

  // ---------- HAT ----------
  Parts.drawHat = function (ctx, cx, cy, hatKind, hatCol) {
    if (!hatCol || hatKind === 'None') return;
    const b = hatCol.base, s = hatCol.shade, h = hatCol.hl;
    const O = P.outline;

    if (hatKind === 'Helmet' || hatKind === 'Combat Helmet') {
      const tpl = [
        '..OOOOO..',
        '.OBBBBBO.',
        'OBHBBBBBO',
        'OBBBBBBBO',
        'OBBBSSSO.',
        'OBBS.....',
        'OBS......',
        'OO.......'
      ];
      E.stamp(ctx, cx - 1, cy - 3, tpl, { O, B: b, S: s, H: h });
      E.px(ctx, cx + 3, cy - 1, h);
      E.px(ctx, cx + 4, cy - 1, h);
      E.px(ctx, cx + 2, cy + 4, s);
      E.px(ctx, cx + 7, cy + 2, O);
      return;
    }

    if (hatKind === 'Beanie') {
      const tpl = [
        '.OOOOOO.',
        'OBBBBBBO',
        'OBHBBBBO',
        'OBBBBBBO'
      ];
      E.stamp(ctx, cx, cy - 1, tpl, { O, B: b, H: h });
      // fold
      for (let x = 1; x <= 6; x++) E.px(ctx, cx + x, cy + 2, s);
    } else if (hatKind === 'Cap') {
      // Crown
      const crown = [
        '.OOOOOO.',
        'OBBBBBBO',
        'OBHBBBBO'
      ];
      E.stamp(ctx, cx, cy - 1, crown, { O, B: b, H: h });
      // Brim extending forward
      E.rect(ctx, cx + 5, cy + 2, 5, 1, O);
      E.rect(ctx, cx + 5, cy + 1, 4, 1, b);
    } else if (hatKind === 'Helmet' || hatKind === 'Combat Helmet') {
      const tpl = [
        '.OOOOOOO',
        'OBBBBBBO',
        'OBHBBBBO',
        'OBBBBBBO',
        'OBBBBBBO'
      ];
      E.stamp(ctx, cx, cy - 2, tpl, { O, B: b, H: h });
      // Visor ridge — darker band separating helmet from face.
      for (let vx = 1; vx <= 6; vx++) E.px(ctx, cx + vx, cy + 3, s);
      // chin strap anchor points at the sides of the head
      E.px(ctx, cx + 0, cy + 3, O);
      E.px(ctx, cx + 7, cy + 3, O);
      if (hatKind === 'Combat Helmet') {
        // Rail / side mount hint
        E.px(ctx, cx + 7, cy - 1, h);
        E.px(ctx, cx + 7, cy + 0, h);
        // NVG mount bracket on the front
        E.px(ctx, cx + 5, cy - 2, O);
        E.px(ctx, cx + 6, cy - 2, h);
      }
    } else if (hatKind === 'Boonie') {
      // wide brim
      const tpl = [
        '..OOOO..',
        '.OBBBBO.',
        '.OHBBBO.',
        'OOOOOOOO'
      ];
      E.stamp(ctx, cx, cy - 1, tpl, { O, B: b, H: h });
      // brim underline
      for (let x = 0; x < 8; x++) E.px(ctx, cx + x, cy + 3, s);
    } else if (hatKind === 'Bandana') {
      const tpl = [
        '........',
        'OBBBBBBO',
        'OBHBBBBO'
      ];
      E.stamp(ctx, cx, cy, tpl, { O, B: b, H: h });
      // knot at back
      E.px(ctx, cx + 0, cy + 2, b);
      E.px(ctx, cx - 1, cy + 2, O);
      E.px(ctx, cx - 1, cy + 3, b);
      E.px(ctx, cx - 2, cy + 3, O);
    }
  };

  // ---------- TORSO ----------
  // 7-wide × 8-tall main body, with shoulder caps protruding 1 px on each
  // side so the silhouette reads as a 3/4 chibi perspective:
  //   - Back shoulder cap on the LEFT (further from viewer, smaller / shaded)
  //   - Front shoulder cap on the RIGHT (closer to viewer, larger / lit)
  // The renderer anchors arms exactly on these caps, so the shoulders are
  // both a visual cue AND the explicit attach point for the arm system.
  Parts.drawTorso = function (ctx, tx, ty, uniform, opts) {
    opts = opts || {};
    const b = uniform.base, s = uniform.shade, h = uniform.hl;
    const O = P.outline;
    const stretchRows = (opts.stretchY || 0) >= 0.5 ? 1 : 0;
    const slender = opts.slender === true;

    // Slightly-tapered base silhouette (collar narrower than shoulders).
    const tpl = slender ? (stretchRows ? [
      '..OBBO.',
      '.OBBBSO',
      '.OBBBSO',
      '.OBBBSO',
      '.OBBBSO',
      '.OBBBSO',
      '.OSSSO.',
      '.OBBBO.',
      '.OOOOO.'
    ] : [
      '..OBBO.',
      '.OBBBSO',
      '.OBBBSO',
      '.OBBBSO',
      '.OBBBSO',
      '.OBBBSO',
      '.OSSSO.',
      '.OOOOO.'
    ]) : (stretchRows ? [
      '.OBSBO.',
      'OBHBBSO',
      'OBBBBSO',
      'OBBBBSO',
      'OBBBBSO',
      'OBBBBSO',
      'OSSSSSO',
      'OBBBBSO',
      'OOOOOOO'
    ] : [
      '.OBSBO.', // y0 collar — narrow neck opening (S = neck dip)
      'OBHBBSO', // y1 shoulder line (back HL + front seam)
      'OBBBBSO', // y2
      'OBBBBSO', // y3
      'OBBBBSO', // y4
      'OBBBBSO', // y5
      'OSSSSSO', // y6 belt band
      'OOOOOOO'  // y7 base outline (flush with leg tops)
    ]);
    E.stamp(ctx, tx, ty, tpl, { O, B: b, H: h, S: s });

    // Placket + buttons down the front (right side = closer to viewer).
    E.px(ctx, tx + 4, ty + 2, s);
    E.px(ctx, tx + 4, ty + 3, h);
    E.px(ctx, tx + 4, ty + 4, s);
    E.px(ctx, tx + 4, ty + 5, h);

    // Chest pocket hint
    E.px(ctx, tx + 2, ty + 3, s);
    E.px(ctx, tx + 3, ty + 3, s);
    E.px(ctx, tx + 2, ty + 4, s);

    // Belt buckle
    E.px(ctx, tx + 3, ty + 6, h);
    E.px(ctx, tx + 4, ty + 6, O);

    // ---- Shoulder accents (3/4 perspective without protruding silhouette) ----
    // Front shoulder ball (left, closer to viewer): bigger highlight + a
    // darker seam so it visually pops as the near shoulder.
    const nearX = slender ? 1 : 0;
    const farX = slender ? 5 : 6;
    E.px(ctx, tx + nearX, ty + 0, O);   // top-left corner outline
    E.px(ctx, tx + nearX, ty + 1, h);   // front deltoid highlight (top)
    E.px(ctx, tx + nearX + 1, ty + 2, h);   // front deltoid highlight (inner)
    E.px(ctx, tx + nearX, ty + 2, s);   // armhole seam shadow

    // Back shoulder ball (right, further from viewer): tiny shaded bump above
    // the corner so the shoulder reads as a rounded joint at distance.
    E.px(ctx, tx + farX, ty + 0, O);   // top-right corner outline
    E.px(ctx, tx + farX, ty + 1, h);   // back deltoid highlight (top)
    E.px(ctx, tx + farX - 1, ty + 2, h);   // back deltoid highlight (inner)
  };

  // ---------- VEST ----------
  Parts.drawVest = function (ctx, tx, ty, vest, opts) {
    if (!vest) return;
    opts = opts || {};
    const b = vest.base, s = vest.shade, h = vest.hl, st = vest.strap;
    const O = P.outline;
    // Overlays the torso; spans y ty+1..ty+6
    // Plate carrier body
    const tpl = opts.slender === true ? [
      '.OBBBO.',
      '.OHBBO.',
      '.OBBBO.',
      '.OBBBO.',
      '.OBBBO.',
      '.OOOOO.'
    ] : [
      'OBBBBBO',
      'OBHBBBO',
      'OBBBBBO',
      'OBBBBBO',
      'OBBBBBO',
      'OOOOOOO'
    ];
    E.stamp(ctx, tx, ty + 1, tpl, { O, B: b, H: h, S: s });
    // Shoulder straps
    E.px(ctx, tx + 2, ty, st);
    E.px(ctx, tx + 4, ty, st);
    // Pouches
    E.px(ctx, tx + 2, ty + 4, s);
    E.px(ctx, tx + 3, ty + 4, s);
    E.px(ctx, tx + 4, ty + 4, s);
    E.px(ctx, tx + 2, ty + 5, O);
    E.px(ctx, tx + 3, ty + 5, O);
    E.px(ctx, tx + 4, ty + 5, O);
  };

  // ---------- BACKPACK ----------
  Parts.drawBackpack = function (ctx, tx, ty, pack) {
    if (!pack) return;
    const b = pack.base, s = pack.shade, h = pack.hl;
    const O = P.outline;
    // Behind torso, so sits on LEFT side (back). tx is torso TL.
    // Pack occupies x tx-2..tx-0 (3 wide), y ty+1..ty+6
    const tpl = [
      'OBBO',
      'OBHO',
      'OBBO',
      'OBBO',
      'OBBO',
      'OBBO',
      'OOOO'
    ];
    E.stamp(ctx, tx - 2, ty + 1, tpl, { O, B: b, H: h, S: s });
    // Horizontal strap on pack
    E.px(ctx, tx - 1, ty + 4, s);
    E.px(ctx, tx - 2, ty + 4, O);
  };

  // ---------- LEGS ----------
  // Side-view legs with a wider front leg on the left and a narrower rear leg
  // slightly to the right. Legacy animations still use front/back as whole-leg
  // lift, while walk can pass frontStep/backStep and frontLift/backLift so hips
  // stay fixed to the body.
  Parts.drawLegs = function (ctx, tx, ty, pants, legOffsets) {
    legOffsets = legOffsets || { front: 0, back: 0, frontBend: 0, backBend: 0 };
    const b = pants.base, s = pants.shade;
    const O = P.outline;
    const bootsB = P.boots.base;
    const bootsH = P.boots.hl || bootsB;
    const SO = P.outlineSoft || s;
    const slender = legOffsets.slender === true;

    if (legOffsets.pose === 'kneel') {
      drawKneelLegs(Math.max(0, Math.min(1, legOffsets.kneel == null ? 1 : legOffsets.kneel)));
      return;
    }

    function mix(a, b2, t) {
      return a + (b2 - a) * t;
    }

    function pt(a, b2, t) {
      return { x: mix(a.x, b2.x, t), y: mix(a.y, b2.y, t) };
    }

    function drawLegPath(points, fill) {
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b2 = points[i + 1];
        const seg = linePoints(Math.round(a.x), Math.round(a.y), Math.round(b2.x), Math.round(b2.y));
        for (const p of seg) {
          E.px(ctx, p[0] - 1, p[1], O);
          E.px(ctx, p[0] + 1, p[1], O);
          E.px(ctx, p[0], p[1] - 1, O);
          E.px(ctx, p[0], p[1] + 1, O);
        }
        for (const p of seg) {
          E.px(ctx, p[0], p[1], fill);
          E.px(ctx, p[0], p[1] + 1, fill);
        }
      }
    }

    function drawBoot(x, y, front) {
      x = Math.round(x);
      y = Math.round(y);
      E.px(ctx, x - 1, y, O);
      E.px(ctx, x + 0, y, bootsB);
      E.px(ctx, x + 1, y, bootsH);
      E.px(ctx, x + 2, y, bootsB);
      E.px(ctx, x + 3, y, bootsB);
      E.px(ctx, x + 4, y, O);
      if (front) E.px(ctx, x + 4, y - 1, O);
      for (let i = 0; i < 4; i++) E.px(ctx, x + i, y + 1, O);
    }

    function drawHipPlate() {
      E.px(ctx, tx + 0, ty, O);
      E.px(ctx, tx + 1, ty, b);
      E.px(ctx, tx + 2, ty, b);
      E.px(ctx, tx + 3, ty, b);
      if (slender) {
        E.px(ctx, tx + 4, ty, s);
        E.px(ctx, tx + 5, ty, O);
      } else {
        E.px(ctx, tx + 4, ty, b);
        E.px(ctx, tx + 5, ty, s);
        E.px(ctx, tx + 6, ty, O);
      }
    }

    function drawKneelLegs(t) {
      const backStand = [
        { x: tx + 5, y: ty + 0 },
        { x: tx + 5, y: ty + 3 },
        { x: tx + 5, y: ty + 6 }
      ];
      const backKneel = [
        { x: tx + 5, y: ty + 1 },
        { x: tx + 7, y: ty + 5 },
        { x: tx + 2, y: ty + 6 }
      ];
      const frontStand = [
        { x: tx + 2, y: ty + 0 },
        { x: tx + 2, y: ty + 3 },
        { x: tx + 1, y: ty + 6 }
      ];
      const frontKneel = [
        { x: tx + 2, y: ty + 1 },
        { x: tx + 4, y: ty + 4 },
        { x: tx + 8, y: ty + 6 }
      ];

      const back = backStand.map((p, i) => pt(p, backKneel[i], t));
      const front = frontStand.map((p, i) => pt(p, frontKneel[i], t));
      drawLegPath(back, s);
      drawLegPath(front, b);
      drawBoot(back[2].x - 1, back[2].y, false);
      drawBoot(front[2].x, front[2].y, true);

      drawHipPlate();
    }

    const step = function (bend) {
      bend = bend || 0;
      if (bend > 2) return 2;
      if (bend < -2) return -2;
      return bend;
    };

    const drawSideLeg = function (lx, ly, bend, front, stepX, lift) {
      const height = 6;
      const w = 5;
      const modernStep = typeof stepX === 'number';
      const lowerShift = modernStep ? Math.round(step(stepX)) : (front ? -1 : step(bend));
      const liftPx = Math.round(Math.max(0, Math.min(1.35, lift || 0)));

      for (let i = 0; i < height; i++) {
        const lower = i >= 3;
        const dx = lower ? lowerShift : 0;
        const y = ly + i - (lower ? liftPx : 0);
        for (let x = 0; x < w; x++) {
          let color;
          if (x === 0 || x === w - 1) color = O;
          else if (i === 0) color = s;
          else if (front) color = x >= 3 ? s : b;
          else color = x >= 2 ? s : b;
          E.px(ctx, lx + dx + x, y, color);
        }
        if (i === 3) E.px(ctx, lx + dx + 2, y, SO);
      }

      const bx = lx + lowerShift;
      const by = ly + 6 - liftPx;
      if (front) {
        E.px(ctx, bx + 0, by, O);
        E.px(ctx, bx + 1, by, bootsB);
        E.px(ctx, bx + 2, by, bootsH);
        E.px(ctx, bx + 3, by, bootsB);
        E.px(ctx, bx + 4, by, bootsB);
        E.px(ctx, bx + 5, by, O);
        E.px(ctx, bx + 1, by + 1, O);
        E.px(ctx, bx + 2, by + 1, O);
        E.px(ctx, bx + 3, by + 1, O);
        E.px(ctx, bx + 4, by + 1, O);
      } else {
        E.px(ctx, bx + 0, by, O);
        E.px(ctx, bx + 1, by, bootsB);
        E.px(ctx, bx + 2, by, bootsB);
        E.px(ctx, bx + 3, by, bootsB);
        E.px(ctx, bx + 4, by, bootsB);
        E.px(ctx, bx + 5, by, O);
        E.px(ctx, bx + 1, by + 1, O);
        E.px(ctx, bx + 2, by + 1, O);
        E.px(ctx, bx + 3, by + 1, O);
        E.px(ctx, bx + 4, by + 1, O);
      }
    };

    // Rear/right leg drawn first, wider left leg on top and angled slightly
    // backward so the stance keeps a little side-view spread.
    const frontWalk = typeof legOffsets.frontStep === 'number' || typeof legOffsets.frontLift === 'number';
    const backWalk = typeof legOffsets.backStep === 'number' || typeof legOffsets.backLift === 'number';
    drawSideLeg(
      tx + 3,
      backWalk ? ty : ty + legOffsets.back,
      legOffsets.backBend,
      false,
      backWalk ? legOffsets.backStep : null,
      backWalk ? legOffsets.backLift : 0
    );
    drawSideLeg(
      tx + 0,
      frontWalk ? ty : ty + legOffsets.front,
      legOffsets.frontBend,
      true,
      frontWalk ? legOffsets.frontStep : null,
      frontWalk ? legOffsets.frontLift : 0
    );

    // Colored hip plate keeps the side-view silhouette solid without a
    // separate black filler between the legs.
    drawHipPlate();
  };

  // ---------- ARM ----------
  // Arm drawn as segment from shoulder to hand, at an angle.
  // We render it pixel-wise using Bresenham with given color.
  function linePoints(x0, y0, x1, y1) {
    const points = [];
    x0 = x0 | 0; y0 = y0 | 0; x1 = x1 | 0; y1 = y1 | 0;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx2 = x0 < x1 ? 1 : -1;
    const sy2 = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      points.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx2; }
      if (e2 < dx)  { err += dx; y0 += sy2; }
    }
    return points;
  }

  function drawHand(ctx, hx, hy, glovesCol, opts) {
    opts = opts || {};
    const O = P.outline;
    const gb = glovesCol.base;
    hx = hx | 0; hy = hy | 0;
    if (opts.large) {
      E.rect(ctx, hx - 1, hy - 1, 4, 4, O);
      E.rect(ctx, hx, hy, 2, 2, gb);
      E.px(ctx, hx + 1, hy, glovesCol.hl || gb);
      return;
    }
    E.px(ctx, hx, hy, gb);
    E.px(ctx, hx, hy - 1, O);
    E.px(ctx, hx, hy + 1, O);
    E.px(ctx, hx + 1, hy, O);
    E.px(ctx, hx - 1, hy, O);
    E.px(ctx, hx, hy, gb);
  }

  function drawArmPath(ctx, points, uniform, glovesCol, opts) {
    opts = opts || {};
    const b = uniform.base, s = uniform.shade;
    const O = P.outline;
    const outline = opts.thick ? [[0, -2], [0, 2], [-2, 0], [2, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]] :
      [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const fill = opts.thick ? [[0, 0], [1, 0], [0, 1]] : [[0, 0]];

    for (const [x, y] of points) {
      for (const [ox, oy] of outline) E.px(ctx, x + ox, y + oy, O);
    }
    for (const [x, y] of points) {
      for (const [ox, oy] of fill) E.px(ctx, x + ox, y + oy, b);
      if (opts.thick) E.px(ctx, x + 1, y + 1, s);
    }
    const last = points[points.length - 1];
    if (last) drawHand(ctx, last[0], last[1], glovesCol, { large: opts.handLarge });
  }

  Parts.drawArm = function (ctx, sx, sy, hx, hy, uniform, glovesCol) {
    drawArmPath(ctx, linePoints(sx, sy, hx, hy), uniform, glovesCol, { thick: false, handLarge: false });
  };

  Parts.drawBentArm = function (ctx, sx, sy, ex, ey, hx, hy, uniform, glovesCol, opts) {
    opts = opts || {};
    const a = linePoints(sx, sy, ex, ey);
    const b = linePoints(ex, ey, hx, hy);
    if (a.length && b.length) b.shift();
    drawArmPath(ctx, a.concat(b), uniform, glovesCol, {
      thick: opts.thick !== false,
      handLarge: opts.handLarge !== false
    });
  };

  Parts.drawHand = function (ctx, hx, hy, glovesCol, opts) {
    drawHand(ctx, hx, hy, glovesCol, opts);
  };

  // ---------- HD MIXED RENDERING ----------
  // Smooth variants keep the same anchors as the pixel parts. They are used by
  // the renderer only when the canvas has a high-resolution backing store.
  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function fillRoundRect(ctx, x, y, w, h, r, color) {
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function fillEllipse(ctx, x, y, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function strokeLine(ctx, x1, y1, x2, y2, color, width) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function strokePath(ctx, color, width, draw) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    draw();
    ctx.stroke();
    ctx.restore();
  }

  function fillPath(ctx, color, draw) {
    ctx.beginPath();
    draw();
    ctx.fillStyle = color;
    ctx.fill();
  }

  Parts.drawHeadHD = function (ctx, cx, cy, skin, opts) {
    opts = opts || {};
    const O = P.outline;
    fillPath(ctx, O, function () {
      ctx.moveTo(cx + 0.45, cy + 3.65);
      ctx.quadraticCurveTo(cx + 0.9, cy + 1.05, cx + 3.9, cy + 0.9);
      ctx.quadraticCurveTo(cx + 7.65, cy + 0.8, cx + 8.45, cy + 3.85);
      ctx.quadraticCurveTo(cx + 8.85, cy + 6.2, cx + 6.55, cy + 7.75);
      ctx.quadraticCurveTo(cx + 3.4, cy + 8.65, cx + 1.25, cy + 7.15);
      ctx.quadraticCurveTo(cx + 0.1, cy + 5.9, cx + 0.45, cy + 3.65);
      ctx.closePath();
    });
    fillPath(ctx, skin.base, function () {
      ctx.moveTo(cx + 0.95, cy + 3.8);
      ctx.quadraticCurveTo(cx + 1.3, cy + 1.65, cx + 4.0, cy + 1.45);
      ctx.quadraticCurveTo(cx + 7.05, cy + 1.35, cx + 7.75, cy + 3.9);
      ctx.quadraticCurveTo(cx + 8.05, cy + 5.9, cx + 6.2, cy + 7.05);
      ctx.quadraticCurveTo(cx + 3.5, cy + 7.85, cx + 1.65, cy + 6.65);
      ctx.quadraticCurveTo(cx + 0.75, cy + 5.55, cx + 0.95, cy + 3.8);
      ctx.closePath();
    });
    fillPath(ctx, skin.shade, function () {
      ctx.moveTo(cx + 0.95, cy + 3.85);
      ctx.quadraticCurveTo(cx + 1.25, cy + 1.8, cx + 2.95, cy + 1.55);
      ctx.quadraticCurveTo(cx + 2.25, cy + 4.35, cx + 2.35, cy + 7.05);
      ctx.quadraticCurveTo(cx + 1.48, cy + 6.85, cx + 1.0, cy + 5.55);
      ctx.quadraticCurveTo(cx + 0.8, cy + 4.65, cx + 0.95, cy + 3.85);
      ctx.closePath();
    });
    fillEllipse(ctx, cx + 5.4, cy + 3.75, 1.45, 0.8, skin.hl);
  };

  Parts.drawEyeHD = function (ctx, cx, cy, eyeColor, opts) {
    opts = opts || {};
    const ex = cx + 5.45;
    const ey = cy + 5.45;
    const lashes = opts.lashes === true;
    const eyeOutline = lashes ? P.outline : P.outlineSoft;
    function drawLashesHD() {
      strokeLine(ctx, ex - 0.55, ey - 1.12, ex - 0.72, ey - 1.48, P.outline, 0.26);
      strokeLine(ctx, ex + 0.45, ey - 1.18, ex + 0.5, ey - 1.55, P.outline, 0.26);
      strokeLine(ctx, ex + 1.95, ey - 0.9, ex + 2.18, ey - 1.22, P.outline, 0.24);
    }
    if (opts.closed) {
      strokeLine(ctx, ex - 1.25, ey, ex + 1.0, ey, eyeOutline, lashes ? 0.35 : 0.28);
      strokeLine(ctx, ex + 1.2, ey, ex + 2.55, ey, eyeOutline, lashes ? 0.3 : 0.24);
      if (lashes) drawLashesHD();
      return;
    }
    fillEllipse(ctx, ex, ey, lashes ? 1.3 : 1.16, lashes ? 1.45 : 1.24, eyeOutline);
    fillEllipse(ctx, ex + 0.05, ey, lashes ? 0.88 : 0.84, lashes ? 1.05 : 0.96, P.white);
    fillEllipse(ctx, ex + 0.48, ey + 0.03, 0.38, 0.72, eyeColor);

    fillEllipse(ctx, ex + 1.55, ey, lashes ? 0.92 : 0.74, lashes ? 1.12 : 0.86, eyeOutline);
    fillEllipse(ctx, ex + 1.58, ey, lashes ? 0.58 : 0.52, lashes ? 0.78 : 0.66, P.white);
    fillEllipse(ctx, ex + 1.88, ey + 0.03, 0.28, 0.54, eyeColor);
    if (lashes) drawLashesHD();
  };

  function drawFemaleHairBackHD(ctx, cx, cy, style, hairCol) {
    const O = P.outline;
    const b = hairCol.base;
    const s = hairCol.shade;
    const h = hairCol.hl;

    if (style === 'Short') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 1.25, cy + 4.15);
        ctx.quadraticCurveTo(cx - 2.0, cy + 5.8, cx - 0.35, cy + 7.25);
        ctx.quadraticCurveTo(cx + 1.35, cy + 6.95, cx + 1.6, cy + 5.25);
        ctx.quadraticCurveTo(cx + 0.45, cy + 4.05, cx - 1.25, cy + 4.15);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx - 0.8, cy + 4.55);
        ctx.quadraticCurveTo(cx - 1.35, cy + 5.75, cx - 0.25, cy + 6.7);
        ctx.quadraticCurveTo(cx + 0.95, cy + 6.45, cx + 1.12, cy + 5.35);
        ctx.quadraticCurveTo(cx + 0.28, cy + 4.48, cx - 0.8, cy + 4.55);
        ctx.closePath();
      });
      strokeLine(ctx, cx - 0.55, cy + 5.0, cx + 0.6, cy + 6.25, s, 0.38);
    } else if (style === 'Messy') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 1.0, cy + 3.25);
        ctx.quadraticCurveTo(cx - 3.0, cy + 5.0, cx - 2.25, cy + 8.55);
        ctx.quadraticCurveTo(cx - 0.85, cy + 10.0, cx + 1.45, cy + 8.55);
        ctx.quadraticCurveTo(cx + 2.15, cy + 5.7, cx + 0.75, cy + 3.55);
        ctx.quadraticCurveTo(cx - 0.05, cy + 3.1, cx - 1.0, cy + 3.25);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx - 0.78, cy + 3.85);
        ctx.quadraticCurveTo(cx - 2.28, cy + 5.25, cx - 1.7, cy + 8.05);
        ctx.quadraticCurveTo(cx - 0.65, cy + 9.0, cx + 0.9, cy + 8.0);
        ctx.quadraticCurveTo(cx + 1.45, cy + 5.75, cx + 0.45, cy + 4.0);
        ctx.quadraticCurveTo(cx - 0.1, cy + 3.68, cx - 0.78, cy + 3.85);
        ctx.closePath();
      });
      strokeLine(ctx, cx - 1.25, cy + 5.15, cx - 0.75, cy + 8.0, s, 0.42);
      strokeLine(ctx, cx - 0.15, cy + 4.25, cx - 0.95, cy + 6.45, h, 0.32);
    } else if (style === 'Long') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.55, cy + 2.95);
        ctx.quadraticCurveTo(cx - 3.25, cy + 4.8, cx - 3.05, cy + 8.65);
        ctx.quadraticCurveTo(cx - 2.85, cy + 12.35, cx + 0.1, cy + 12.75);
        ctx.quadraticCurveTo(cx + 2.35, cy + 10.65, cx + 1.5, cy + 6.35);
        ctx.quadraticCurveTo(cx + 1.1, cy + 4.15, cx - 0.55, cy + 2.95);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx - 0.35, cy + 3.55);
        ctx.quadraticCurveTo(cx - 2.45, cy + 5.05, cx - 2.35, cy + 8.45);
        ctx.quadraticCurveTo(cx - 2.1, cy + 11.35, cx - 0.05, cy + 11.85);
        ctx.quadraticCurveTo(cx + 1.52, cy + 10.0, cx + 0.88, cy + 6.55);
        ctx.quadraticCurveTo(cx + 0.62, cy + 4.72, cx - 0.35, cy + 3.55);
        ctx.closePath();
      });
      strokeLine(ctx, cx - 1.35, cy + 5.2, cx - 1.2, cy + 10.25, s, 0.5);
      strokeLine(ctx, cx - 0.35, cy + 4.6, cx - 0.65, cy + 8.0, h, 0.32);
    } else if (style === 'Ponytail') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.5, cy + 4.45);
        ctx.quadraticCurveTo(cx - 3.8, cy + 5.55, cx - 3.55, cy + 8.4);
        ctx.quadraticCurveTo(cx - 2.6, cy + 11.0, cx - 0.2, cy + 10.25);
        ctx.quadraticCurveTo(cx + 0.75, cy + 7.9, cx + 0.05, cy + 4.95);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx - 0.55, cy + 5.05);
        ctx.quadraticCurveTo(cx - 2.9, cy + 5.9, cx - 2.82, cy + 8.2);
        ctx.quadraticCurveTo(cx - 2.18, cy + 10.0, cx - 0.55, cy + 9.55);
        ctx.quadraticCurveTo(cx + 0.12, cy + 7.78, cx - 0.32, cy + 5.25);
        ctx.closePath();
      });
      strokeLine(ctx, cx - 1.62, cy + 6.25, cx - 1.35, cy + 9.0, s, 0.48);
      fillEllipse(ctx, cx + 0.08, cy + 4.42, 1.08, 0.9, O);
      fillEllipse(ctx, cx + 0.08, cy + 4.42, 0.62, 0.5, s);
    } else if (style === 'Bob') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.45, cy + 7.5);
        ctx.quadraticCurveTo(cx - 0.95, cy + 4.4, cx - 0.7, cy + 2.0);
        ctx.quadraticCurveTo(cx + 0.2, cy - 1.7, cx + 4.25, cy - 1.85);
        ctx.quadraticCurveTo(cx + 8.7, cy - 1.5, cx + 9.25, cy + 2.0);
        ctx.quadraticCurveTo(cx + 9.45, cy + 4.4, cx + 8.85, cy + 7.5);
        ctx.quadraticCurveTo(cx + 7.95, cy + 8.5, cx + 7.05, cy + 7.55);
        ctx.lineTo(cx + 7.4, cy + 4.05);
        ctx.quadraticCurveTo(cx + 4.3, cy + 4.7, cx + 1.5, cy + 4.05);
        ctx.lineTo(cx + 1.35, cy + 7.55);
        ctx.quadraticCurveTo(cx + 0.45, cy + 8.5, cx - 0.45, cy + 7.5);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.15, cy + 7.3);
        ctx.quadraticCurveTo(cx - 0.4, cy + 4.4, cx - 0.1, cy + 2.2);
        ctx.quadraticCurveTo(cx + 0.75, cy - 1.0, cx + 4.25, cy - 1.1);
        ctx.quadraticCurveTo(cx + 7.95, cy - 0.8, cx + 8.6, cy + 2.2);
        ctx.quadraticCurveTo(cx + 8.85, cy + 4.4, cx + 8.3, cy + 7.3);
        ctx.quadraticCurveTo(cx + 7.85, cy + 7.95, cx + 7.5, cy + 7.45);
        ctx.lineTo(cx + 7.85, cy + 4.55);
        ctx.quadraticCurveTo(cx + 4.3, cy + 5.15, cx + 1.05, cy + 4.55);
        ctx.lineTo(cx + 0.9, cy + 7.45);
        ctx.quadraticCurveTo(cx + 0.55, cy + 7.95, cx + 0.15, cy + 7.3);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 1.6, cy + 3.95, cx + 7.4, cy + 3.95, s, 0.4);
    } else if (style === 'Wavy') {
      strokeLine(ctx, cx - 0.45, cy + 4.0, cx - 1.05, cy + 7.5, O, 1.45);
      strokeLine(ctx, cx - 0.4, cy + 3.95, cx - 0.9, cy + 7.3, b, 0.9);
      strokeLine(ctx, cx - 0.65, cy + 5.3, cx - 0.88, cy + 7.0, h, 0.3);
    } else if (style === 'Flowing') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx + 0.25, cy + 3.85);
        ctx.quadraticCurveTo(cx - 1.15, cy + 7.0, cx - 1.55, cy + 11.85);
        ctx.quadraticCurveTo(cx - 0.4, cy + 12.85, cx + 0.85, cy + 12.0);
        ctx.quadraticCurveTo(cx + 1.45, cy + 7.0, cx + 1.5, cy + 4.0);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.4, cy + 4.05);
        ctx.quadraticCurveTo(cx - 0.85, cy + 7.0, cx - 1.2, cy + 11.55);
        ctx.quadraticCurveTo(cx - 0.4, cy + 12.35, cx + 0.55, cy + 11.7);
        ctx.quadraticCurveTo(cx + 1.15, cy + 7.0, cx + 1.2, cy + 4.15);
        ctx.closePath();
      });
      strokeLine(ctx, cx - 0.4, cy + 6.5, cx - 0.7, cy + 11.0, s, 0.55);
      strokeLine(ctx, cx + 0.5, cy + 6.0, cx + 0.7, cy + 10.5, h, 0.35);
    } else if (style === 'High Ponytail') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx + 0.55, cy + 3.4);
        ctx.quadraticCurveTo(cx - 1.85, cy + 5.5, cx - 2.95, cy + 8.6);
        ctx.quadraticCurveTo(cx - 2.55, cy + 9.45, cx - 1.75, cy + 9.0);
        ctx.quadraticCurveTo(cx - 0.4, cy + 7.0, cx + 1.55, cy + 4.5);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.6, cy + 3.7);
        ctx.quadraticCurveTo(cx - 1.5, cy + 5.6, cx - 2.55, cy + 8.45);
        ctx.quadraticCurveTo(cx - 2.25, cy + 9.05, cx - 1.7, cy + 8.7);
        ctx.quadraticCurveTo(cx - 0.4, cy + 6.85, cx + 1.35, cy + 4.55);
        ctx.closePath();
      });
      strokeLine(ctx, cx - 0.4, cy + 6.5, cx - 1.6, cy + 8.4, h, 0.35);
      fillEllipse(ctx, cx + 0.7, cy + 3.6, 0.55, 0.35, s);
    }
  }

  function drawFemaleHairFrontHD(ctx, cx, cy, style, hairCol) {
    const O = P.outline;
    const b = hairCol.base;
    const s = hairCol.shade;
    const h = hairCol.hl;

    if (style === 'Short') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.65, cy + 4.25);
        ctx.quadraticCurveTo(cx + 0.12, cy - 1.9, cx + 4.25, cy - 2.05);
        ctx.quadraticCurveTo(cx + 8.72, cy - 1.6, cx + 9.15, cy + 3.3);
        ctx.quadraticCurveTo(cx + 7.8, cy + 4.95, cx + 6.1, cy + 4.75);
        ctx.quadraticCurveTo(cx + 4.55, cy + 3.78, cx + 2.72, cy + 4.72);
        ctx.quadraticCurveTo(cx + 0.85, cy + 5.32, cx - 0.65, cy + 4.25);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.02, cy + 3.8);
        ctx.quadraticCurveTo(cx + 0.72, cy - 1.08, cx + 4.2, cy - 1.25);
        ctx.quadraticCurveTo(cx + 7.88, cy - 0.9, cx + 8.38, cy + 3.0);
        ctx.quadraticCurveTo(cx + 7.12, cy + 4.2, cx + 5.82, cy + 4.05);
        ctx.quadraticCurveTo(cx + 4.32, cy + 3.32, cx + 2.7, cy + 4.05);
        ctx.quadraticCurveTo(cx + 1.0, cy + 4.55, cx + 0.02, cy + 3.8);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 2.0, cy + 0.25, cx + 6.2, cy + 0.95, h, 0.42);
      strokeLine(ctx, cx + 1.0, cy + 3.85, cx + 7.55, cy + 3.9, s, 0.38);
    } else if (style === 'Messy') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.72, cy + 4.35);
        ctx.quadraticCurveTo(cx + 0.1, cy - 1.7, cx + 3.95, cy - 2.12);
        ctx.quadraticCurveTo(cx + 7.65, cy - 1.82, cx + 9.0, cy + 2.72);
        ctx.quadraticCurveTo(cx + 7.95, cy + 5.15, cx + 5.9, cy + 5.05);
        ctx.quadraticCurveTo(cx + 4.0, cy + 3.8, cx + 2.15, cy + 4.75);
        ctx.quadraticCurveTo(cx + 0.45, cy + 5.55, cx - 0.72, cy + 4.35);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx - 0.02, cy + 3.92);
        ctx.quadraticCurveTo(cx + 0.72, cy - 0.95, cx + 3.92, cy - 1.28);
        ctx.quadraticCurveTo(cx + 7.02, cy - 1.02, cx + 8.22, cy + 2.65);
        ctx.quadraticCurveTo(cx + 7.25, cy + 4.45, cx + 5.82, cy + 4.38);
        ctx.quadraticCurveTo(cx + 4.08, cy + 3.38, cx + 2.25, cy + 4.15);
        ctx.quadraticCurveTo(cx + 0.9, cy + 4.75, cx - 0.02, cy + 3.92);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 1.55, cy + 0.35, cx + 5.9, cy + 0.75, h, 0.42);
      strokeLine(ctx, cx + 1.0, cy + 3.95, cx + 7.65, cy + 3.72, s, 0.42);
    } else if (style === 'Long') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.72, cy + 4.15);
        ctx.quadraticCurveTo(cx + 0.1, cy - 2.05, cx + 4.25, cy - 2.22);
        ctx.quadraticCurveTo(cx + 8.7, cy - 1.7, cx + 9.25, cy + 3.28);
        ctx.quadraticCurveTo(cx + 8.22, cy + 5.32, cx + 6.35, cy + 5.35);
        ctx.quadraticCurveTo(cx + 4.2, cy + 3.9, cx + 2.22, cy + 4.85);
        ctx.quadraticCurveTo(cx + 0.45, cy + 5.35, cx - 0.72, cy + 4.15);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.02, cy + 3.7);
        ctx.quadraticCurveTo(cx + 0.78, cy - 1.2, cx + 4.22, cy - 1.42);
        ctx.quadraticCurveTo(cx + 7.92, cy - 1.02, cx + 8.48, cy + 3.02);
        ctx.quadraticCurveTo(cx + 7.52, cy + 4.58, cx + 6.12, cy + 4.62);
        ctx.quadraticCurveTo(cx + 4.1, cy + 3.45, cx + 2.32, cy + 4.15);
        ctx.quadraticCurveTo(cx + 0.95, cy + 4.52, cx + 0.02, cy + 3.7);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 2.0, cy + 0.12, cx + 6.45, cy + 0.82, h, 0.43);
      strokeLine(ctx, cx + 0.85, cy + 3.95, cx + 7.98, cy + 4.0, s, 0.42);
    } else if (style === 'Ponytail') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.58, cy + 4.0);
        ctx.quadraticCurveTo(cx + 0.3, cy - 1.88, cx + 4.4, cy - 2.0);
        ctx.quadraticCurveTo(cx + 8.2, cy - 1.55, cx + 9.02, cy + 2.85);
        ctx.quadraticCurveTo(cx + 7.42, cy + 4.62, cx + 5.55, cy + 4.35);
        ctx.quadraticCurveTo(cx + 3.62, cy + 3.6, cx + 1.82, cy + 4.42);
        ctx.quadraticCurveTo(cx + 0.45, cy + 4.9, cx - 0.58, cy + 4.0);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.12, cy + 3.62);
        ctx.quadraticCurveTo(cx + 0.9, cy - 1.02, cx + 4.38, cy - 1.24);
        ctx.quadraticCurveTo(cx + 7.42, cy - 0.9, cx + 8.22, cy + 2.65);
        ctx.quadraticCurveTo(cx + 6.98, cy + 3.98, cx + 5.48, cy + 3.82);
        ctx.quadraticCurveTo(cx + 3.72, cy + 3.25, cx + 1.95, cy + 3.92);
        ctx.quadraticCurveTo(cx + 0.9, cy + 4.28, cx + 0.12, cy + 3.62);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 1.2, cy + 3.48, cx + 6.55, cy + 0.28, s, 0.36);
      strokeLine(ctx, cx + 2.15, cy + 0.1, cx + 6.25, cy + 0.5, h, 0.4);
      strokeLine(ctx, cx + 0.95, cy + 3.85, cx + 7.25, cy + 3.65, s, 0.36);
    } else if (style === 'Bob') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.45, cy + 7.5);
        ctx.quadraticCurveTo(cx - 0.95, cy + 4.4, cx - 0.7, cy + 2.0);
        ctx.quadraticCurveTo(cx + 0.2, cy - 1.7, cx + 4.25, cy - 1.85);
        ctx.quadraticCurveTo(cx + 8.7, cy - 1.5, cx + 9.25, cy + 2.0);
        ctx.quadraticCurveTo(cx + 9.45, cy + 4.4, cx + 8.85, cy + 7.5);
        ctx.quadraticCurveTo(cx + 7.95, cy + 8.5, cx + 7.05, cy + 7.55);
        ctx.lineTo(cx + 7.4, cy + 4.05);
        ctx.quadraticCurveTo(cx + 4.3, cy + 4.7, cx + 1.5, cy + 4.05);
        ctx.lineTo(cx + 1.35, cy + 7.55);
        ctx.quadraticCurveTo(cx + 0.45, cy + 8.5, cx - 0.45, cy + 7.5);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.15, cy + 7.3);
        ctx.quadraticCurveTo(cx - 0.4, cy + 4.4, cx - 0.1, cy + 2.2);
        ctx.quadraticCurveTo(cx + 0.75, cy - 1.0, cx + 4.25, cy - 1.1);
        ctx.quadraticCurveTo(cx + 7.95, cy - 0.8, cx + 8.6, cy + 2.2);
        ctx.quadraticCurveTo(cx + 8.85, cy + 4.4, cx + 8.3, cy + 7.3);
        ctx.quadraticCurveTo(cx + 7.85, cy + 7.95, cx + 7.5, cy + 7.45);
        ctx.lineTo(cx + 7.85, cy + 4.55);
        ctx.quadraticCurveTo(cx + 4.3, cy + 5.15, cx + 1.05, cy + 4.55);
        ctx.lineTo(cx + 0.9, cy + 7.45);
        ctx.quadraticCurveTo(cx + 0.55, cy + 7.95, cx + 0.15, cy + 7.3);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 2.2, cy + 0.4, cx + 6.1, cy + 1.0, h, 0.45);
      strokeLine(ctx, cx + 1.6, cy + 3.95, cx + 7.4, cy + 3.95, s, 0.4);
    } else if (style === 'Wavy') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.7, cy + 4.05);
        ctx.quadraticCurveTo(cx + 0.1, cy - 2.05, cx + 4.25, cy - 2.15);
        ctx.quadraticCurveTo(cx + 8.75, cy - 1.85, cx + 9.2, cy + 3.45);
        ctx.quadraticCurveTo(cx + 8.05, cy + 4.95, cx + 6.25, cy + 5.25);
        ctx.quadraticCurveTo(cx + 4.3, cy + 4.05, cx + 2.35, cy + 4.55);
        ctx.quadraticCurveTo(cx + 0.45, cy + 5.05, cx - 0.7, cy + 4.05);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.05, cy + 3.65);
        ctx.quadraticCurveTo(cx + 0.65, cy - 1.35, cx + 4.25, cy - 1.45);
        ctx.quadraticCurveTo(cx + 7.95, cy - 1.15, cx + 8.45, cy + 3.15);
        ctx.quadraticCurveTo(cx + 7.35, cy + 4.35, cx + 5.9, cy + 4.55);
        ctx.quadraticCurveTo(cx + 4.1, cy + 3.55, cx + 2.3, cy + 4.05);
        ctx.quadraticCurveTo(cx + 0.75, cy + 4.45, cx + 0.05, cy + 3.65);
        ctx.closePath();
      });
      strokePath(ctx, h, 0.45, function () {
        ctx.moveTo(cx + 1.4, cy - 0.2);
        ctx.quadraticCurveTo(cx + 2.6, cy - 1.05, cx + 3.7, cy - 0.2);
        ctx.moveTo(cx + 4.6, cy - 0.4);
        ctx.quadraticCurveTo(cx + 5.8, cy - 1.25, cx + 6.9, cy - 0.4);
      });
      strokeLine(ctx, cx + 1.0, cy + 3.85, cx + 7.85, cy + 3.95, s, 0.4);
    } else if (style === 'Flowing') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.85, cy + 4.45);
        ctx.quadraticCurveTo(cx + 0.2, cy - 1.85, cx + 4.25, cy - 1.95);
        ctx.quadraticCurveTo(cx + 8.75, cy - 1.65, cx + 9.3, cy + 3.55);
        ctx.quadraticCurveTo(cx + 8.1, cy + 5.05, cx + 6.25, cy + 5.35);
        ctx.quadraticCurveTo(cx + 4.3, cy + 4.15, cx + 2.35, cy + 4.65);
        ctx.quadraticCurveTo(cx + 0.4, cy + 5.35, cx - 0.85, cy + 4.45);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx - 0.05, cy + 3.95);
        ctx.quadraticCurveTo(cx + 0.75, cy - 1.15, cx + 4.25, cy - 1.25);
        ctx.quadraticCurveTo(cx + 7.95, cy - 0.95, cx + 8.5, cy + 3.25);
        ctx.quadraticCurveTo(cx + 7.35, cy + 4.45, cx + 5.9, cy + 4.65);
        ctx.quadraticCurveTo(cx + 4.1, cy + 3.65, cx + 2.3, cy + 4.15);
        ctx.quadraticCurveTo(cx + 0.7, cy + 4.65, cx - 0.05, cy + 3.95);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 2.2, cy + 0.3, cx + 6.1, cy + 0.9, h, 0.5);
      strokeLine(ctx, cx + 1.0, cy + 3.95, cx + 7.85, cy + 4.05, s, 0.4);
    } else if (style === 'High Ponytail') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.7, cy + 4.05);
        ctx.quadraticCurveTo(cx + 0.05, cy - 2.05, cx + 4.25, cy - 2.15);
        ctx.quadraticCurveTo(cx + 8.75, cy - 1.85, cx + 9.2, cy + 3.45);
        ctx.quadraticCurveTo(cx + 8.05, cy + 4.95, cx + 6.25, cy + 5.25);
        ctx.quadraticCurveTo(cx + 4.3, cy + 4.05, cx + 2.35, cy + 4.55);
        ctx.quadraticCurveTo(cx + 0.45, cy + 5.05, cx - 0.7, cy + 4.05);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.05, cy + 3.65);
        ctx.quadraticCurveTo(cx + 0.65, cy - 1.4, cx + 4.25, cy - 1.5);
        ctx.quadraticCurveTo(cx + 7.95, cy - 1.2, cx + 8.45, cy + 3.15);
        ctx.quadraticCurveTo(cx + 7.35, cy + 4.35, cx + 5.9, cy + 4.55);
        ctx.quadraticCurveTo(cx + 4.1, cy + 3.55, cx + 2.3, cy + 4.05);
        ctx.quadraticCurveTo(cx + 0.75, cy + 4.45, cx + 0.05, cy + 3.65);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 2.2, cy + 0.2, cx + 6.1, cy + 0.8, h, 0.5);
      strokeLine(ctx, cx + 1.0, cy + 3.85, cx + 7.85, cy + 3.95, s, 0.4);
      fillEllipse(ctx, cx + 0.7, cy + 3.6, 0.55, 0.35, s);
    }
  }

  Parts.drawHairBackHD = function (ctx, cx, cy, style, hairCol, opts) {
    if (!style || style === 'Bald' || !hairCol) return;
    if (usesFemaleHair(opts, style)) drawFemaleHairBackHD(ctx, cx, cy, style, hairCol);
  };

  Parts.drawHairHD = function (ctx, cx, cy, style, hairCol, opts) {
    if (!style || style === 'Bald') return;
    if (usesFemaleHair(opts, style)) {
      drawFemaleHairFrontHD(ctx, cx, cy, style, hairCol);
      return;
    }
    const O = P.outline;
    const b = hairCol.base;
    const s = hairCol.shade;
    const h = hairCol.hl;
    const slender = opts && opts.slender === true;

    if (slender && style === 'Short') {
      // Chin-length bob: rounded crown with side strands flowing past the cheek.
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.45, cy + 7.5);
        ctx.quadraticCurveTo(cx - 0.95, cy + 4.4, cx - 0.7, cy + 2.0);
        ctx.quadraticCurveTo(cx + 0.2, cy - 1.7, cx + 4.25, cy - 1.85);
        ctx.quadraticCurveTo(cx + 8.7, cy - 1.5, cx + 9.25, cy + 2.0);
        ctx.quadraticCurveTo(cx + 9.45, cy + 4.4, cx + 8.85, cy + 7.5);
        ctx.quadraticCurveTo(cx + 7.95, cy + 8.5, cx + 7.05, cy + 7.55);
        ctx.lineTo(cx + 7.4, cy + 4.05);
        ctx.quadraticCurveTo(cx + 4.3, cy + 4.7, cx + 1.5, cy + 4.05);
        ctx.lineTo(cx + 1.35, cy + 7.55);
        ctx.quadraticCurveTo(cx + 0.45, cy + 8.5, cx - 0.45, cy + 7.5);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.15, cy + 7.3);
        ctx.quadraticCurveTo(cx - 0.4, cy + 4.4, cx - 0.1, cy + 2.2);
        ctx.quadraticCurveTo(cx + 0.75, cy - 1.0, cx + 4.25, cy - 1.1);
        ctx.quadraticCurveTo(cx + 7.95, cy - 0.8, cx + 8.6, cy + 2.2);
        ctx.quadraticCurveTo(cx + 8.85, cy + 4.4, cx + 8.3, cy + 7.3);
        ctx.quadraticCurveTo(cx + 7.85, cy + 7.95, cx + 7.5, cy + 7.45);
        ctx.lineTo(cx + 7.85, cy + 4.55);
        ctx.quadraticCurveTo(cx + 4.3, cy + 5.15, cx + 1.05, cy + 4.55);
        ctx.lineTo(cx + 0.9, cy + 7.45);
        ctx.quadraticCurveTo(cx + 0.55, cy + 7.95, cx + 0.15, cy + 7.3);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 2.2, cy + 0.4, cx + 6.1, cy + 1.0, h, 0.45);
      strokeLine(ctx, cx + 1.6, cy + 3.95, cx + 7.4, cy + 3.95, s, 0.4);
      return;
    }

    if (slender && style === 'Messy') {
      // Soft tousled with gentle waves and back wisps.
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.7, cy + 4.05);
        ctx.quadraticCurveTo(cx + 0.1, cy - 2.05, cx + 4.25, cy - 2.15);
        ctx.quadraticCurveTo(cx + 8.75, cy - 1.85, cx + 9.2, cy + 3.45);
        ctx.quadraticCurveTo(cx + 8.05, cy + 4.95, cx + 6.25, cy + 5.25);
        ctx.quadraticCurveTo(cx + 4.3, cy + 4.05, cx + 2.35, cy + 4.55);
        ctx.quadraticCurveTo(cx + 0.45, cy + 5.05, cx - 0.7, cy + 4.05);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.05, cy + 3.65);
        ctx.quadraticCurveTo(cx + 0.65, cy - 1.35, cx + 4.25, cy - 1.45);
        ctx.quadraticCurveTo(cx + 7.95, cy - 1.15, cx + 8.45, cy + 3.15);
        ctx.quadraticCurveTo(cx + 7.35, cy + 4.35, cx + 5.9, cy + 4.55);
        ctx.quadraticCurveTo(cx + 4.1, cy + 3.55, cx + 2.3, cy + 4.05);
        ctx.quadraticCurveTo(cx + 0.75, cy + 4.45, cx + 0.05, cy + 3.65);
        ctx.closePath();
      });
      // Soft wave highlights along the crown
      strokePath(ctx, h, 0.45, function () {
        ctx.moveTo(cx + 1.4, cy - 0.2);
        ctx.quadraticCurveTo(cx + 2.6, cy - 1.05, cx + 3.7, cy - 0.2);
        ctx.moveTo(cx + 4.6, cy - 0.4);
        ctx.quadraticCurveTo(cx + 5.8, cy - 1.25, cx + 6.9, cy - 0.4);
      });
      strokeLine(ctx, cx + 1.0, cy + 3.85, cx + 7.85, cy + 3.95, s, 0.4);
      // Back wisps trailing down
      strokeLine(ctx, cx - 0.45, cy + 4.0, cx - 1.05, cy + 7.5, O, 1.45);
      strokeLine(ctx, cx - 0.4, cy + 3.95, cx - 0.9, cy + 7.3, b, 0.9);
      return;
    }

    if (slender && style === 'Long') {
      // Voluminous flowing hair — wider crown plus long trailing locks.
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.85, cy + 4.45);
        ctx.quadraticCurveTo(cx + 0.2, cy - 1.85, cx + 4.25, cy - 1.95);
        ctx.quadraticCurveTo(cx + 8.75, cy - 1.65, cx + 9.3, cy + 3.55);
        ctx.quadraticCurveTo(cx + 8.1, cy + 5.05, cx + 6.25, cy + 5.35);
        ctx.quadraticCurveTo(cx + 4.3, cy + 4.15, cx + 2.35, cy + 4.65);
        ctx.quadraticCurveTo(cx + 0.4, cy + 5.35, cx - 0.85, cy + 4.45);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx - 0.05, cy + 3.95);
        ctx.quadraticCurveTo(cx + 0.75, cy - 1.15, cx + 4.25, cy - 1.25);
        ctx.quadraticCurveTo(cx + 7.95, cy - 0.95, cx + 8.5, cy + 3.25);
        ctx.quadraticCurveTo(cx + 7.35, cy + 4.45, cx + 5.9, cy + 4.65);
        ctx.quadraticCurveTo(cx + 4.1, cy + 3.65, cx + 2.3, cy + 4.15);
        ctx.quadraticCurveTo(cx + 0.7, cy + 4.65, cx - 0.05, cy + 3.95);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 2.2, cy + 0.3, cx + 6.1, cy + 0.9, h, 0.5);
      strokeLine(ctx, cx + 1.0, cy + 3.95, cx + 7.85, cy + 4.05, s, 0.4);
      // Long flowing trail down the back, wider and longer than male Long
      fillPath(ctx, O, function () {
        ctx.moveTo(cx + 0.25, cy + 3.85);
        ctx.quadraticCurveTo(cx - 1.15, cy + 7.0, cx - 1.55, cy + 11.85);
        ctx.quadraticCurveTo(cx - 0.4, cy + 12.85, cx + 0.85, cy + 12.0);
        ctx.quadraticCurveTo(cx + 1.45, cy + 7.0, cx + 1.5, cy + 4.0);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.4, cy + 4.05);
        ctx.quadraticCurveTo(cx - 0.85, cy + 7.0, cx - 1.2, cy + 11.55);
        ctx.quadraticCurveTo(cx - 0.4, cy + 12.35, cx + 0.55, cy + 11.7);
        ctx.quadraticCurveTo(cx + 1.15, cy + 7.0, cx + 1.2, cy + 4.15);
        ctx.closePath();
      });
      strokeLine(ctx, cx - 0.4, cy + 6.5, cx - 0.7, cy + 11.0, s, 0.55);
      strokeLine(ctx, cx + 0.5, cy + 6.0, cx + 0.7, cy + 10.5, h, 0.35);
      return;
    }

    if (slender && style === 'Ponytail') {
      // High pony with extra crown volume and a thick curving tail.
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.7, cy + 4.05);
        ctx.quadraticCurveTo(cx + 0.05, cy - 2.05, cx + 4.25, cy - 2.15);
        ctx.quadraticCurveTo(cx + 8.75, cy - 1.85, cx + 9.2, cy + 3.45);
        ctx.quadraticCurveTo(cx + 8.05, cy + 4.95, cx + 6.25, cy + 5.25);
        ctx.quadraticCurveTo(cx + 4.3, cy + 4.05, cx + 2.35, cy + 4.55);
        ctx.quadraticCurveTo(cx + 0.45, cy + 5.05, cx - 0.7, cy + 4.05);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.05, cy + 3.65);
        ctx.quadraticCurveTo(cx + 0.65, cy - 1.4, cx + 4.25, cy - 1.5);
        ctx.quadraticCurveTo(cx + 7.95, cy - 1.2, cx + 8.45, cy + 3.15);
        ctx.quadraticCurveTo(cx + 7.35, cy + 4.35, cx + 5.9, cy + 4.55);
        ctx.quadraticCurveTo(cx + 4.1, cy + 3.55, cx + 2.3, cy + 4.05);
        ctx.quadraticCurveTo(cx + 0.75, cy + 4.45, cx + 0.05, cy + 3.65);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 2.2, cy + 0.2, cx + 6.1, cy + 0.8, h, 0.5);
      strokeLine(ctx, cx + 1.0, cy + 3.85, cx + 7.85, cy + 3.95, s, 0.4);
      // Tail — shaped path curving down-back from the crown
      fillPath(ctx, O, function () {
        ctx.moveTo(cx + 0.55, cy + 3.4);
        ctx.quadraticCurveTo(cx - 1.85, cy + 5.5, cx - 2.95, cy + 8.6);
        ctx.quadraticCurveTo(cx - 2.55, cy + 9.45, cx - 1.75, cy + 9.0);
        ctx.quadraticCurveTo(cx - 0.4, cy + 7.0, cx + 1.55, cy + 4.5);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.6, cy + 3.7);
        ctx.quadraticCurveTo(cx - 1.5, cy + 5.6, cx - 2.55, cy + 8.45);
        ctx.quadraticCurveTo(cx - 2.25, cy + 9.05, cx - 1.7, cy + 8.7);
        ctx.quadraticCurveTo(cx - 0.4, cy + 6.85, cx + 1.35, cy + 4.55);
        ctx.closePath();
      });
      strokeLine(ctx, cx - 0.4, cy + 6.5, cx - 1.6, cy + 8.4, h, 0.35);
      // Hair-tie band hint
      fillEllipse(ctx, cx + 0.7, cy + 3.6, 0.55, 0.35, s);
      return;
    }

    if (style === 'Textured Crop') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.35, cy + 3.75);
        ctx.quadraticCurveTo(cx + 0.75, cy - 1.0, cx + 4.05, cy - 1.18);
        ctx.quadraticCurveTo(cx + 7.95, cy - 0.92, cx + 8.8, cy + 3.0);
        ctx.quadraticCurveTo(cx + 7.15, cy + 4.48, cx + 4.9, cy + 4.2);
        ctx.quadraticCurveTo(cx + 2.45, cy + 4.55, cx - 0.35, cy + 3.75);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.28, cy + 3.35);
        ctx.quadraticCurveTo(cx + 1.12, cy - 0.42, cx + 4.1, cy - 0.55);
        ctx.quadraticCurveTo(cx + 7.25, cy - 0.32, cx + 8.05, cy + 2.82);
        ctx.quadraticCurveTo(cx + 6.9, cy + 3.88, cx + 4.75, cy + 3.65);
        ctx.quadraticCurveTo(cx + 2.62, cy + 3.92, cx + 0.28, cy + 3.35);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 1.8, cy + 0.2, cx + 5.75, cy + 0.62, h, 0.42);
      strokeLine(ctx, cx + 0.9, cy + 3.5, cx + 2.25, cy + 3.85, s, 0.32);
      strokeLine(ctx, cx + 3.4, cy + 3.65, cx + 4.75, cy + 3.48, s, 0.28);
      strokeLine(ctx, cx + 5.65, cy + 2.0, cx + 7.55, cy + 2.48, s, 0.32);
      strokeLine(ctx, cx + 0.72, cy + 3.45, cx + 0.48, cy + 4.55, s, 0.28);
      return;
    }

    if (style === 'Low Fade') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx + 0.28, cy + 3.45);
        ctx.quadraticCurveTo(cx + 1.2, cy + 0.18, cx + 4.25, cy + 0.02);
        ctx.quadraticCurveTo(cx + 7.38, cy + 0.08, cx + 8.42, cy + 3.35);
        ctx.quadraticCurveTo(cx + 5.0, cy + 4.18, cx + 0.28, cy + 3.45);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.95, cy + 3.12);
        ctx.quadraticCurveTo(cx + 1.62, cy + 0.75, cx + 4.28, cy + 0.6);
        ctx.quadraticCurveTo(cx + 6.78, cy + 0.7, cx + 7.62, cy + 3.0);
        ctx.quadraticCurveTo(cx + 4.9, cy + 3.58, cx + 0.95, cy + 3.12);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 1.25, cy + 3.08, cx + 2.55, cy + 3.28, s, 0.32);
      strokeLine(ctx, cx + 5.25, cy + 2.95, cx + 7.2, cy + 2.85, s, 0.32);
      strokeLine(ctx, cx + 0.95, cy + 3.1, cx + 0.72, cy + 4.25, s, 0.26);
      strokeLine(ctx, cx + 2.4, cy + 1.05, cx + 5.65, cy + 0.92, h, 0.35);
      return;
    }

    if (style === 'Side Part') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.5, cy + 3.92);
        ctx.quadraticCurveTo(cx + 0.35, cy - 1.35, cx + 4.05, cy - 1.55);
        ctx.quadraticCurveTo(cx + 8.15, cy - 1.15, cx + 9.0, cy + 3.15);
        ctx.quadraticCurveTo(cx + 7.72, cy + 4.85, cx + 5.9, cy + 4.72);
        ctx.quadraticCurveTo(cx + 4.0, cy + 3.58, cx + 2.05, cy + 4.18);
        ctx.quadraticCurveTo(cx + 0.45, cy + 4.72, cx - 0.5, cy + 3.92);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.12, cy + 3.55);
        ctx.quadraticCurveTo(cx + 0.82, cy - 0.78, cx + 4.05, cy - 0.92);
        ctx.quadraticCurveTo(cx + 7.35, cy - 0.62, cx + 8.2, cy + 2.9);
        ctx.quadraticCurveTo(cx + 7.05, cy + 4.12, cx + 5.78, cy + 4.02);
        ctx.quadraticCurveTo(cx + 4.0, cy + 3.12, cx + 2.18, cy + 3.62);
        ctx.quadraticCurveTo(cx + 0.88, cy + 4.0, cx + 0.12, cy + 3.55);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 3.42, cy - 0.42, cx + 4.15, cy + 3.42, s, 0.42);
      strokeLine(ctx, cx + 4.42, cy + 0.18, cx + 7.0, cy + 1.08, h, 0.38);
      strokeLine(ctx, cx + 0.95, cy + 3.75, cx + 2.55, cy + 4.05, s, 0.3);
      strokeLine(ctx, cx + 5.65, cy + 3.72, cx + 7.75, cy + 3.45, s, 0.3);
      strokeLine(ctx, cx + 0.72, cy + 3.75, cx + 0.5, cy + 4.8, s, 0.26);
      return;
    }

    if (style === 'Quiff') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.45, cy + 4.0);
        ctx.quadraticCurveTo(cx + 0.8, cy - 0.92, cx + 4.1, cy - 1.68);
        ctx.quadraticCurveTo(cx + 7.0, cy - 2.55, cx + 8.95, cy + 1.88);
        ctx.quadraticCurveTo(cx + 8.38, cy + 4.35, cx + 6.05, cy + 4.55);
        ctx.quadraticCurveTo(cx + 4.08, cy + 3.42, cx + 2.22, cy + 4.05);
        ctx.quadraticCurveTo(cx + 0.55, cy + 4.6, cx - 0.45, cy + 4.0);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.18, cy + 3.58);
        ctx.quadraticCurveTo(cx + 1.08, cy - 0.42, cx + 4.2, cy - 0.92);
        ctx.quadraticCurveTo(cx + 6.78, cy - 1.55, cx + 8.15, cy + 1.98);
        ctx.quadraticCurveTo(cx + 7.62, cy + 3.82, cx + 5.95, cy + 3.95);
        ctx.quadraticCurveTo(cx + 4.18, cy + 3.05, cx + 2.3, cy + 3.55);
        ctx.quadraticCurveTo(cx + 0.9, cy + 4.0, cx + 0.18, cy + 3.58);
        ctx.closePath();
      });
      strokePath(ctx, h, 0.4, function () {
        ctx.moveTo(cx + 2.35, cy + 0.0);
        ctx.quadraticCurveTo(cx + 5.2, cy - 1.55, cx + 7.25, cy + 0.85);
      });
      strokeLine(ctx, cx + 1.0, cy + 3.82, cx + 2.5, cy + 4.08, s, 0.3);
      strokeLine(ctx, cx + 5.7, cy + 3.52, cx + 7.78, cy + 3.18, s, 0.32);
      strokeLine(ctx, cx + 0.72, cy + 3.78, cx + 0.48, cy + 4.75, s, 0.26);
      return;
    }

    if (style === 'Curly Top') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.55, cy + 3.88);
        ctx.quadraticCurveTo(cx + 0.1, cy - 0.7, cx + 2.0, cy - 0.92);
        ctx.quadraticCurveTo(cx + 2.8, cy - 2.0, cx + 3.75, cy - 0.98);
        ctx.quadraticCurveTo(cx + 4.92, cy - 2.05, cx + 6.02, cy - 0.88);
        ctx.quadraticCurveTo(cx + 8.28, cy - 0.55, cx + 8.95, cy + 3.32);
        ctx.quadraticCurveTo(cx + 7.75, cy + 4.95, cx + 5.8, cy + 4.75);
        ctx.quadraticCurveTo(cx + 4.08, cy + 3.7, cx + 2.22, cy + 4.28);
        ctx.quadraticCurveTo(cx + 0.45, cy + 4.88, cx - 0.55, cy + 3.88);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.08, cy + 3.52);
        ctx.quadraticCurveTo(cx + 0.68, cy - 0.18, cx + 2.18, cy - 0.22);
        ctx.quadraticCurveTo(cx + 2.82, cy - 1.15, cx + 3.62, cy - 0.22);
        ctx.quadraticCurveTo(cx + 4.82, cy - 1.2, cx + 5.72, cy - 0.12);
        ctx.quadraticCurveTo(cx + 7.52, cy + 0.05, cx + 8.18, cy + 3.0);
        ctx.quadraticCurveTo(cx + 7.12, cy + 4.25, cx + 5.72, cy + 4.08);
        ctx.quadraticCurveTo(cx + 4.05, cy + 3.22, cx + 2.28, cy + 3.72);
        ctx.quadraticCurveTo(cx + 0.9, cy + 4.15, cx + 0.08, cy + 3.52);
        ctx.closePath();
      });
      fillEllipse(ctx, cx + 3.12, cy - 0.2, 0.38, 0.22, h);
      fillEllipse(ctx, cx + 5.35, cy - 0.12, 0.42, 0.24, h);
      fillEllipse(ctx, cx + 1.12, cy + 3.78, 0.22, 0.16, s);
      fillEllipse(ctx, cx + 4.9, cy + 3.55, 0.24, 0.16, s);
      strokeLine(ctx, cx + 6.05, cy + 3.55, cx + 7.55, cy + 3.25, s, 0.3);
      strokeLine(ctx, cx + 0.72, cy + 3.75, cx + 0.48, cy + 4.75, s, 0.26);
      return;
    }

    if (style === 'Buzz Cut') {
      fillEllipse(ctx, cx + 1.25, cy + 2.45, 0.18, 0.1, s);
      fillEllipse(ctx, cx + 2.35, cy + 1.8, 0.18, 0.1, s);
      fillEllipse(ctx, cx + 3.6, cy + 1.45, 0.18, 0.1, s);
      fillEllipse(ctx, cx + 4.85, cy + 1.65, 0.18, 0.1, h);
      fillEllipse(ctx, cx + 6.05, cy + 2.0, 0.18, 0.1, s);
      fillEllipse(ctx, cx + 7.0, cy + 2.65, 0.16, 0.1, s);
      fillEllipse(ctx, cx + 2.0, cy + 3.05, 0.16, 0.1, s);
      fillEllipse(ctx, cx + 3.2, cy + 2.65, 0.16, 0.1, s);
      fillEllipse(ctx, cx + 5.1, cy + 2.85, 0.16, 0.1, s);
      return;
    }

    if (style === 'Crew Cut') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx + 0.3, cy + 3.7);
        ctx.quadraticCurveTo(cx + 0.7, cy + 0.3, cx + 4.25, cy + 0.05);
        ctx.quadraticCurveTo(cx + 7.85, cy + 0.3, cx + 8.2, cy + 3.55);
        ctx.lineTo(cx + 0.3, cy + 3.7);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.85, cy + 3.35);
        ctx.quadraticCurveTo(cx + 1.2, cy + 0.8, cx + 4.25, cy + 0.65);
        ctx.quadraticCurveTo(cx + 7.3, cy + 0.85, cx + 7.65, cy + 3.25);
        ctx.lineTo(cx + 0.85, cy + 3.35);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 2.5, cy + 0.95, cx + 5.8, cy + 0.95, h, 0.38);
      strokeLine(ctx, cx + 1.4, cy + 3.2, cx + 2.85, cy + 3.38, s, 0.3);
      strokeLine(ctx, cx + 5.4, cy + 3.05, cx + 7.1, cy + 2.95, s, 0.3);
      strokeLine(ctx, cx + 0.9, cy + 3.35, cx + 0.72, cy + 4.18, s, 0.24);
      return;
    }

    if (style === 'Slick Back') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.3, cy + 3.85);
        ctx.quadraticCurveTo(cx + 0.5, cy - 1.0, cx + 4.05, cy - 1.4);
        ctx.quadraticCurveTo(cx + 7.85, cy - 1.05, cx + 8.7, cy + 3.2);
        ctx.quadraticCurveTo(cx + 4.5, cy + 4.4, cx - 0.3, cy + 3.85);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.35, cy + 3.5);
        ctx.quadraticCurveTo(cx + 1.0, cy - 0.4, cx + 4.05, cy - 0.78);
        ctx.quadraticCurveTo(cx + 7.25, cy - 0.45, cx + 7.95, cy + 2.95);
        ctx.quadraticCurveTo(cx + 4.5, cy + 3.85, cx + 0.35, cy + 3.5);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 6.0, cy - 0.4, cx + 1.5, cy + 0.5, h, 0.32);
      strokeLine(ctx, cx + 6.5, cy + 0.6, cx + 1.4, cy + 1.5, h, 0.3);
      strokeLine(ctx, cx + 6.8, cy + 1.7, cx + 1.4, cy + 2.4, s, 0.32);
      strokeLine(ctx, cx + 1.0, cy + 3.5, cx + 2.55, cy + 3.82, s, 0.32);
      strokeLine(ctx, cx + 5.5, cy + 3.38, cx + 7.55, cy + 3.05, s, 0.34);
      strokeLine(ctx, cx + 0.72, cy + 3.52, cx + 0.48, cy + 4.5, s, 0.26);
      return;
    }

    if (style === 'Stubble') {
      fillEllipse(ctx, cx + 1.0, cy + 2.0, 0.18, 0.12, s);
      fillEllipse(ctx, cx + 2.2, cy + 1.4, 0.18, 0.12, s);
      fillEllipse(ctx, cx + 3.4, cy + 2.0, 0.18, 0.12, s);
      fillEllipse(ctx, cx + 4.6, cy + 1.4, 0.18, 0.12, s);
      fillEllipse(ctx, cx + 5.8, cy + 2.0, 0.18, 0.12, s);
      fillEllipse(ctx, cx + 7.0, cy + 1.4, 0.18, 0.12, s);
      fillEllipse(ctx, cx + 1.6, cy + 2.8, 0.16, 0.1, s);
      fillEllipse(ctx, cx + 3.0, cy + 2.8, 0.16, 0.1, s);
      fillEllipse(ctx, cx + 4.4, cy + 2.8, 0.16, 0.1, s);
      fillEllipse(ctx, cx + 5.8, cy + 2.8, 0.16, 0.1, s);
      fillEllipse(ctx, cx + 6.4, cy + 2.4, 0.16, 0.1, s);
      return;
    }
  };

  Parts.drawHatHD = function (ctx, cx, cy, hatKind, hatCol) {
    if (!hatCol || hatKind === 'None') return;
    const O = P.outline;
    const b = hatCol.base;
    const s = hatCol.shade;
    const h = hatCol.hl;

    if (hatKind === 'Helmet' || hatKind === 'Combat Helmet') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.85, cy + 6.6);
        ctx.quadraticCurveTo(cx - 0.9, cy + 1.2, cx + 1.65, cy - 1.55);
        ctx.quadraticCurveTo(cx + 4.55, cy - 3.1, cx + 7.45, cy - 1.05);
        ctx.quadraticCurveTo(cx + 8.95, cy + 0.15, cx + 8.72, cy + 3.6);
        ctx.quadraticCurveTo(cx + 6.6, cy + 4.1, cx + 4.75, cy + 3.78);
        ctx.quadraticCurveTo(cx + 3.45, cy + 4.35, cx + 2.78, cy + 5.82);
        ctx.quadraticCurveTo(cx + 1.92, cy + 7.55, cx - 0.85, cy + 6.6);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx - 0.25, cy + 5.9);
        ctx.quadraticCurveTo(cx - 0.2, cy + 1.45, cx + 2.05, cy - 0.95);
        ctx.quadraticCurveTo(cx + 4.55, cy - 2.32, cx + 7.0, cy - 0.62);
        ctx.quadraticCurveTo(cx + 8.08, cy + 0.35, cx + 8.05, cy + 2.9);
        ctx.quadraticCurveTo(cx + 6.35, cy + 3.35, cx + 4.65, cy + 3.1);
        ctx.quadraticCurveTo(cx + 3.0, cy + 3.92, cx + 2.22, cy + 5.28);
        ctx.quadraticCurveTo(cx + 1.45, cy + 6.52, cx - 0.25, cy + 5.9);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 0.35, cy + 3.75, cx + 3.1, cy + 4.0, s, 0.5);
      strokeLine(ctx, cx + 4.8, cy + 3.18, cx + 7.65, cy + 2.82, s, 0.55);
      strokeLine(ctx, cx + 2.75, cy - 0.72, cx + 5.25, cy - 1.05, h, 0.45);
      fillEllipse(ctx, cx + 0.85, cy + 5.2, 0.65, 0.75, s);
      return;
    }

    if (hatKind === 'Cap') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx + 0.4, cy + 2.45);
        ctx.quadraticCurveTo(cx + 1.5, cy - 1.2, cx + 4.8, cy - 1.0);
        ctx.quadraticCurveTo(cx + 7.5, cy - 0.55, cx + 7.65, cy + 2.4);
        ctx.lineTo(cx + 0.4, cy + 2.45);
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.95, cy + 2.0);
        ctx.quadraticCurveTo(cx + 1.8, cy - 0.55, cx + 4.8, cy - 0.45);
        ctx.quadraticCurveTo(cx + 6.85, cy - 0.15, cx + 7.0, cy + 2.0);
        ctx.closePath();
      });
      fillRoundRect(ctx, cx + 6.0, cy + 1.35, 4.0, 0.95, 0.35, O);
      fillRoundRect(ctx, cx + 6.0, cy + 1.05, 3.65, 0.72, 0.3, b);
      strokeLine(ctx, cx + 3.3, cy + 0.1, cx + 4.85, cy + 0.35, h, 0.35);
    } else if (hatKind === 'Beanie') {
      fillRoundRect(ctx, cx + 0.1, cy - 1.45, 7.85, 5.1, 2.2, O);
      fillRoundRect(ctx, cx + 0.65, cy - 0.95, 6.8, 4.05, 1.75, b);
      strokeLine(ctx, cx + 1.1, cy + 2.75, cx + 7.1, cy + 2.75, s, 0.55);
      strokeLine(ctx, cx + 2.7, cy - 0.25, cx + 4.3, cy - 0.4, h, 0.4);
    } else if (hatKind === 'Helmet' || hatKind === 'Combat Helmet') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx - 0.1, cy + 2.8);
        ctx.quadraticCurveTo(cx + 1.2, cy - 2.2, cx + 4.7, cy - 2.1);
        ctx.quadraticCurveTo(cx + 8.2, cy - 1.7, cx + 8.15, cy + 3.2);
        ctx.lineTo(cx - 0.1, cy + 2.8);
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.55, cy + 2.4);
        ctx.quadraticCurveTo(cx + 1.55, cy - 1.45, cx + 4.7, cy - 1.45);
        ctx.quadraticCurveTo(cx + 7.35, cy - 1.15, cx + 7.45, cy + 2.55);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 1.0, cy + 2.8, cx + 7.4, cy + 2.95, s, 0.55);
      strokeLine(ctx, cx + 3.0, cy - 0.75, cx + 5.0, cy - 0.95, h, 0.45);
      if (hatKind === 'Combat Helmet') {
        fillRoundRect(ctx, cx + 5.2, cy - 2.25, 1.7, 0.9, 0.25, O);
        fillRoundRect(ctx, cx + 5.55, cy - 2.05, 1.1, 0.5, 0.2, h);
      }
    } else if (hatKind === 'Boonie') {
      fillRoundRect(ctx, cx - 1.2, cy + 2.0, 10.6, 1.45, 0.65, O);
      fillRoundRect(ctx, cx - 0.75, cy + 1.85, 9.7, 0.95, 0.45, b);
      fillPath(ctx, O, function () {
        ctx.moveTo(cx + 1.0, cy + 2.15);
        ctx.quadraticCurveTo(cx + 2.0, cy - 1.0, cx + 4.35, cy - 0.9);
        ctx.quadraticCurveTo(cx + 6.85, cy - 0.75, cx + 7.15, cy + 2.2);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 1.45, cy + 2.0);
        ctx.quadraticCurveTo(cx + 2.2, cy - 0.45, cx + 4.35, cy - 0.35);
        ctx.quadraticCurveTo(cx + 6.35, cy - 0.2, cx + 6.65, cy + 2.0);
        ctx.closePath();
      });
    } else if (hatKind === 'Bandana') {
      fillRoundRect(ctx, cx + 0.15, cy + 1.8, 7.7, 1.65, 0.45, O);
      fillRoundRect(ctx, cx + 0.55, cy + 2.05, 6.9, 1.05, 0.35, b);
      strokeLine(ctx, cx + 0.45, cy + 3.0, cx - 1.55, cy + 4.25, O, 0.9);
      strokeLine(ctx, cx + 0.45, cy + 3.0, cx - 1.35, cy + 4.1, b, 0.5);
      strokeLine(ctx, cx + 2.8, cy + 2.25, cx + 4.2, cy + 2.25, h, 0.35);
    }
  };

  Parts.drawNeckHD = function (ctx, ox, topY, torsoY, skin) {
    if (topY >= torsoY) return;
    const h = Math.min(0.95, torsoY - topY);
    fillRoundRect(ctx, ox - 0.85, topY - 0.05, 1.7, h + 0.1, 0.3, P.outline);
    fillRoundRect(ctx, ox - 0.38, topY + 0.05, 0.76, h - 0.05, 0.22, skin.base);
    fillRoundRect(ctx, ox - 0.36, topY + 0.05, 0.22, h - 0.05, 0.16, skin.shade);
  };

  Parts.drawTorsoHD = function (ctx, tx, ty, uniform, opts) {
    opts = opts || {};
    const O = P.outline;
    const stretchY = Math.max(0, Math.min(1.2, opts.stretchY || 0));
    const slim = opts.slender === true ? 0.42 : 0;
    // Trapezoidal torso: shoulders wider than belt, with two distinct shoulder
    // balls bulging at the top corners for a 3/4 chibi perspective.
    fillPath(ctx, O, function () {
      ctx.moveTo(tx - 0.5 + slim, ty + 1.6);
      ctx.quadraticCurveTo(tx - 0.2 + slim, ty + 0.3, tx + 1.2 + slim * 0.5, ty + 0.15);
      ctx.quadraticCurveTo(tx + 3.5, ty - 0.4, tx + 5.8, ty + 0.15);
      ctx.quadraticCurveTo(tx + 7.2 - slim, ty + 0.3, tx + 7.55 - slim, ty + 1.6);
      ctx.lineTo(tx + 7.0 - slim, ty + 8.1 + stretchY);
      ctx.lineTo(tx - 0.05 + slim, ty + 8.1 + stretchY);
      ctx.closePath();
    });
    fillPath(ctx, uniform.base, function () {
      ctx.moveTo(tx + 0.2 + slim, ty + 1.7);
      ctx.quadraticCurveTo(tx + 0.5 + slim, ty + 0.85, tx + 1.5 + slim * 0.5, ty + 0.7);
      ctx.quadraticCurveTo(tx + 3.5, ty + 0.2, tx + 5.5, ty + 0.7);
      ctx.quadraticCurveTo(tx + 6.5 - slim, ty + 0.85, tx + 6.85 - slim, ty + 1.7);
      ctx.lineTo(tx + 6.25 - slim, ty + 7.25 + stretchY);
      ctx.lineTo(tx + 0.75 + slim, ty + 7.25 + stretchY);
      ctx.closePath();
    });
    // Front-side shading column (right = front in 3/4 view)
    fillRoundRect(ctx, tx + 5.0 - slim, ty + 1.6, 1.35, 5.25 + stretchY * 0.55, 0.4, uniform.shade);
    // Belt band
    fillRoundRect(ctx, tx + 0.85 + slim, ty + 6.35 + stretchY * 0.35, 5.95 - slim * 2, 1.15, 0.25, uniform.shade);
    // Front shoulder highlight (bigger / closer to viewer — now on the LEFT)
    fillEllipse(ctx, tx + 1.2 + slim * 0.5, ty + 1.4, 0.7, 0.55, uniform.hl);
    // Back shoulder highlight (smaller — now on the RIGHT)
    fillEllipse(ctx, tx + 5.7 - slim * 0.5, ty + 1.4, 0.55, 0.45, uniform.hl);
    // Buttons
    fillEllipse(ctx, tx + 4.5 - slim * 0.35, ty + 3.3, 0.28, 0.28, uniform.hl);
    fillEllipse(ctx, tx + 4.45 - slim * 0.35, ty + 5.1, 0.28, 0.28, uniform.hl);
  };

  Parts.drawVestHD = function (ctx, tx, ty, vest, opts) {
    if (!vest) return;
    opts = opts || {};
    const slim = opts.slender === true ? 0.42 : 0;
    fillRoundRect(ctx, tx + 0.2 + slim, ty + 1.1, 6.75 - slim * 2, 6.7, 0.8, P.outline);
    fillRoundRect(ctx, tx + 0.75 + slim, ty + 1.55, 5.7 - slim * 2, 5.65, 0.65, vest.base);
    fillRoundRect(ctx, tx + 4.9 - slim, ty + 1.9, 0.9, 4.8, 0.35, vest.shade);
    strokeLine(ctx, tx + 2.1, ty + 0.65, tx + 2.5, ty + 2.1, vest.strap, 0.6);
    strokeLine(ctx, tx + 4.7, ty + 0.65, tx + 4.25, ty + 2.1, vest.strap, 0.6);
    fillRoundRect(ctx, tx + 1.65, ty + 4.7, 1.2, 1.2, 0.25, vest.shade);
    fillRoundRect(ctx, tx + 3.0, ty + 4.7, 1.2, 1.2, 0.25, vest.shade);
    fillRoundRect(ctx, tx + 4.35, ty + 4.7, 1.2, 1.2, 0.25, vest.shade);
  };

  Parts.drawBackpackHD = function (ctx, tx, ty, pack) {
    if (!pack) return;
    fillRoundRect(ctx, tx - 2.65, ty + 1.1, 4.2, 7.0, 1.0, P.outline);
    fillRoundRect(ctx, tx - 2.05, ty + 1.55, 3.05, 6.05, 0.75, pack.base);
    fillRoundRect(ctx, tx - 1.6, ty + 2.1, 0.85, 2.5, 0.35, pack.hl);
    strokeLine(ctx, tx - 2.0, ty + 4.9, tx + 0.75, ty + 4.9, pack.shade, 0.55);
  };

  Parts.drawWaistBridgeHD = function (ctx, tx, topY, legsY, pants, opts) {
    if (topY >= legsY) return;
    opts = opts || {};
    const h = legsY - topY + 0.35;
    const b = pants && pants.base ? pants.base : P.outlineSoft;
    const s = pants && pants.shade ? pants.shade : b;
    const slim = opts.slender === true ? 0.85 : 0;
    fillRoundRect(ctx, tx + 0.1, topY - 0.08, 6.9 - slim, h, 0.25, P.outline);
    fillRoundRect(ctx, tx + 0.55, topY + 0.05, 5.95 - slim, Math.max(0.15, h - 0.25), 0.18, b);
    strokeLine(ctx, tx + 4.7 - slim * 0.55, topY + 0.2, tx + 5.9 - slim, topY + 0.2, s, 0.35);
  };

  Parts.drawLegsHD = function (ctx, tx, ty, pants, legOffsets) {
    legOffsets = legOffsets || { front: 0, back: 0, frontBend: 0, backBend: 0 };
    const bootsB = P.boots.base;
    const bootsH = P.boots.hl || bootsB;
    const slender = legOffsets.slender === true;

    if (legOffsets.pose === 'kneel') {
      drawKneelLegsHD(Math.max(0, Math.min(1, legOffsets.kneel == null ? 1 : legOffsets.kneel)));
      return;
    }

    function mix(a, b, t) {
      return a + (b - a) * t;
    }

    function pt(a, b, t) {
      return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) };
    }

    function drawKneelPath(points, fill, shade, front) {
      strokePath(ctx, P.outline, 3.05, function () {
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
      });
      strokePath(ctx, fill, 2.0, function () {
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
      });
      strokeLine(ctx, points[0].x + 0.35, points[0].y + 0.45, points[2].x + 0.05, points[2].y - 0.4, shade, 0.45);
      const footX = points[2].x;
      const footY = points[2].y + 0.45;
      fillRoundRect(ctx, footX - 1.45, footY - 0.12, 4.75, 1.4, 0.42, P.outline);
      fillRoundRect(ctx, footX - 0.95, footY - 0.35, 3.85, 0.9, 0.34, bootsB);
      if (front) fillRoundRect(ctx, footX - 0.55, footY - 0.35, 0.75, 0.42, 0.18, bootsH);
    }

    function drawHipPlateHD() {
      const slim = slender ? 0.85 : 0;
      fillRoundRect(ctx, tx + 0.25, ty - 0.08, 6.75 - slim, 1.25, 0.3, P.outline);
      fillRoundRect(ctx, tx + 0.75, ty + 0.12, 5.75 - slim, 0.78, 0.25, pants.base);
      fillRoundRect(ctx, tx + 4.75 - slim * 0.55, ty + 0.12, Math.max(0.65, 1.3 - slim * 0.35), 0.52, 0.18, pants.shade);
    }

    function drawKneelLegsHD(t) {
      const backStand = [
        { x: tx + 4.35, y: ty + 0.2 },
        { x: tx + 4.53, y: ty + 3.2 },
        { x: tx + 4.8, y: ty + 5.7 }
      ];
      const backKneel = [
        { x: tx + 4.7, y: ty + 1.15 },
        { x: tx + 6.7, y: ty + 5.25 },
        { x: tx + 2.7, y: ty + 6.35 }
      ];
      const frontStand = [
        { x: tx + 1.75, y: ty + 0.2 },
        { x: tx + 1.8, y: ty + 3.2 },
        { x: tx + 1.5, y: ty + 5.7 }
      ];
      const frontKneel = [
        { x: tx + 1.65, y: ty + 1.1 },
        { x: tx + 3.3, y: ty + 3.75 },
        { x: tx + 7.65, y: ty + 6.15 }
      ];

      const back = backStand.map((p, i) => pt(p, backKneel[i], t));
      const front = frontStand.map((p, i) => pt(p, frontKneel[i], t));
      drawKneelPath(back, pants.shade, pants.base, false);
      drawKneelPath(front, pants.base, pants.shade, true);
      drawHipPlateHD();
    }

    const step = function (bend) {
      bend = bend || 0;
      if (bend > 1.85) return 1.85;
      if (bend < -1.85) return -1.85;
      return bend;
    };
    const drawSideLegHD = function (lx, ly, bend, front, stepX, lift) {
      const modernStep = typeof stepX === 'number';
      bend = step(bend);
      const stride = modernStep ? step(stepX) : 0;
      const liftY = Math.max(0, Math.min(1.35, lift || 0));
      const outlineW = 3.05;
      const fillW = 2.0;
      const fill = front ? pants.base : pants.shade;
      const hipX = lx;
      const hipY = ly + 0.2;
      const kneeBaseX = front ? lx + 0.05 : lx + 0.18;
      const footBaseX = front ? lx - 0.25 : lx + 0.45;
      const kneeX = modernStep
        ? kneeBaseX + stride * 0.45 + bend * 0.12
        : (front ? lx + 0.05 - bend * 0.25 : lx + 0.18 + bend * 0.35);
      const kneeY = ly + 3.2 - (modernStep ? liftY * 0.35 : 0);
      const footX = modernStep
        ? footBaseX + stride
        : (front ? lx - 0.25 - bend * 0.45 : lx + 0.45 + bend * 0.75);
      const footY = ly + 6.25 - (modernStep ? liftY : 0);
      const ankleY = footY - 0.55;

      strokePath(ctx, P.outline, outlineW, function () {
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, ankleY);
      });
      strokePath(ctx, fill, fillW, function () {
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, ankleY);
      });
      strokeLine(ctx, hipX + 0.45, hipY + 0.6, footX + 0.1, ankleY, pants.shade, 0.55);

      if (front) {
        fillRoundRect(ctx, footX - 1.45, footY - 0.12, 4.55, 1.4, 0.42, P.outline);
        fillRoundRect(ctx, footX - 0.95, footY - 0.35, 3.7, 0.9, 0.34, bootsB);
        fillRoundRect(ctx, footX - 0.55, footY - 0.35, 0.75, 0.42, 0.18, bootsH);
      } else {
        fillRoundRect(ctx, footX - 1.45, footY - 0.12, 4.55, 1.4, 0.42, P.outline);
        fillRoundRect(ctx, footX - 0.95, footY - 0.35, 3.7, 0.9, 0.34, bootsB);
      }
    };
    // Rear/right leg sits slightly to the right; the wider left leg overlaps
    // it. Walk keeps both hip anchors fixed and only shifts/lifts lower legs.
    const frontWalk = typeof legOffsets.frontStep === 'number' || typeof legOffsets.frontLift === 'number';
    const backWalk = typeof legOffsets.backStep === 'number' || typeof legOffsets.backLift === 'number';
    drawSideLegHD(
      tx + 4.35,
      backWalk ? ty : ty + legOffsets.back,
      legOffsets.backBend,
      false,
      backWalk ? legOffsets.backStep : null,
      backWalk ? legOffsets.backLift : 0
    );
    drawSideLegHD(
      tx + 1.75,
      frontWalk ? ty : ty + legOffsets.front,
      legOffsets.frontBend,
      true,
      frontWalk ? legOffsets.frontStep : null,
      frontWalk ? legOffsets.frontLift : 0
    );
    // Small colored hip plate removes the old black center bridge.
    drawHipPlateHD();
  };

  Parts.drawArmHD = function (ctx, sx, sy, hx, hy, uniform, glovesCol, opts) {
    opts = opts || {};
    const scale = opts.scale || 1;
    strokeLine(ctx, sx, sy, hx, hy, P.outline, 2.35 * scale);
    strokeLine(ctx, sx, sy, hx, hy, uniform.base, 1.35 * scale);
    strokeLine(ctx, sx + 0.15 * scale, sy - 0.15 * scale, hx - 0.2 * scale, hy - 0.15 * scale, uniform.hl || uniform.base, 0.35 * scale);
    fillEllipse(ctx, hx, hy, 1.15 * scale, 1.05 * scale, P.outline);
    fillEllipse(ctx, hx, hy, 0.72 * scale, 0.62 * scale, glovesCol.base);
  };

  Parts.drawBentArmHD = function (ctx, sx, sy, ex, ey, hx, hy, uniform, glovesCol, opts) {
    opts = opts || {};
    const scale = opts.scale || 1;
    strokePath(ctx, P.outline, 2.35 * scale, function () {
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.lineTo(hx, hy);
    });
    strokePath(ctx, uniform.base, 1.35 * scale, function () {
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.lineTo(hx, hy);
    });
    strokePath(ctx, uniform.hl || uniform.base, 0.35 * scale, function () {
      ctx.moveTo(sx + 0.15 * scale, sy - 0.15 * scale);
      ctx.lineTo(ex, ey - 0.1 * scale);
      ctx.lineTo(hx - 0.2 * scale, hy - 0.15 * scale);
    });
    Parts.drawHandHD(ctx, hx, hy, glovesCol, { scale: scale, large: opts.handLarge !== false });
  };

  Parts.drawHandHD = function (ctx, hx, hy, glovesCol, opts) {
    opts = opts || {};
    const scale = opts.scale || 1;
    const large = opts.large !== false;
    const outlineRx = (large ? 1.45 : 1.15) * scale;
    const outlineRy = (large ? 1.3 : 1.05) * scale;
    const fillRx = (large ? 0.95 : 0.72) * scale;
    const fillRy = (large ? 0.82 : 0.62) * scale;
    fillEllipse(ctx, hx, hy, outlineRx, outlineRy, P.outline);
    fillEllipse(ctx, hx, hy, fillRx, fillRy, glovesCol.base);
    fillEllipse(ctx, hx + 0.25 * scale, hy - 0.08 * scale, 0.18 * scale, 0.14 * scale, glovesCol.hl || glovesCol.base);
  };

  window.Parts = Parts;
})();
