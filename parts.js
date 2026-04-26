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
  // torso. Uses outline color so it reads as a belt shadow continuous with the
  // torso bottom outline row.
  Parts.drawWaistBridge = function (ctx, tx, topY, legsY) {
    const O = P.outline;
    // Fills any gap between torso bottom and legs top (e.g. when bodyDY lifts
    // the upper body during walk/run/aim). 9 wide so the outer leg outlines
    // (which now extend past the 7-wide torso) are connected too.
    for (let y = topY; y < legsY; y++) {
      for (let x = -1; x < 8; x++) {
        E.px(ctx, tx + x, y, O);
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
    if (opts.closed) {
      E.px(ctx, ex - 1, ey, P.outline);
      E.px(ctx, ex, ey, P.outline);
      E.px(ctx, ex + 1, ey, P.outline);
      E.px(ctx, ex + 2, ey, P.outline);
      return;
    }
    // Big rear eye.
    E.px(ctx, ex - 1, ey - 1, P.outline);
    E.px(ctx, ex,     ey - 1, P.outline);
    E.px(ctx, ex + 1, ey - 1, P.outline);
    E.px(ctx, ex - 1, ey,     P.outline);
    E.px(ctx, ex - 1, ey + 1, P.outline);
    E.px(ctx, ex,     ey + 2, P.outline);
    E.px(ctx, ex + 1, ey + 2, P.outline);
    E.px(ctx, ex,     ey,     P.white);
    E.px(ctx, ex,     ey + 1, P.white);
    E.px(ctx, ex + 1, ey,     eyeColor);
    E.px(ctx, ex + 1, ey + 1, eyeColor);

    // Smaller front eye, glued to the big one.
    E.px(ctx, ex + 2, ey - 1, P.outline);
    E.px(ctx, ex + 3, ey - 1, P.outline);
    E.px(ctx, ex + 3, ey,     P.outline);
    E.px(ctx, ex + 3, ey + 1, P.outline);
    E.px(ctx, ex + 2, ey + 2, P.outline);
    E.px(ctx, ex + 2, ey,     P.white);
    E.px(ctx, ex + 2, ey + 1, eyeColor);
  };

  // ---------- HAIR ----------
  Parts.drawHair = function (ctx, cx, cy, style, hairCol) {
    if (!style || style === 'Bald') return;
    const b = hairCol.base, s = hairCol.shade, h = hairCol.hl;
    const O = P.outline;

    if (style === 'Short') {
      // Heavy cap across the upper half of the head.
      const tpl = [
        '..OOOOOO...',
        '.OBBBBBBO..',
        'OBBHHBBBBO.',
        'OBBBBBBBBO.',
        '.BBBBBBBBO.',
        '..BBBBBB...'
      ];
      E.stamp(ctx, cx - 1, cy - 1, tpl, { O, B: b, H: h });
      // Sideburn hint back
      E.px(ctx, cx + 1, cy + 4, b);
      E.px(ctx, cx + 0, cy + 4, O);
    } else if (style === 'Buzz') {
      const tpl = [
        '..OOOOOO...',
        '.OBBBBBBO..',
        'OBBBBBBBBO.',
        '.BBBBBBBB..'
      ];
      E.stamp(ctx, cx - 1, cy - 1, tpl, { O, B: b });
    } else if (style === 'Messy') {
      const tpl = [
        '..O.OOO.O..',
        '.OBBBBBBBO.',
        'OBBHHBBBBBO',
        'OBBBBBBBBBO',
        'OBBBBBBBBO.',
        '.BBBBBBBBO.',
        '..BBBBBB...'
      ];
      E.stamp(ctx, cx - 1, cy - 2, tpl, { O, B: b, H: h });
    } else if (style === 'Long') {
      // flows down the back (left side since facing right)
      const tpl = [
        '..OOOOOO...',
        '.OBBBBBBO..',
        'OBBHHBBBBO.',
        'OBBBBBBBBO.',
        'OBBBBBBBBO.',
        '.BBBBBBBBO.'
      ];
      E.stamp(ctx, cx - 1, cy - 1, tpl, { O, B: b, H: h });
      // Trail down back
      for (let i = 0; i < 6; i++) {
        E.px(ctx, cx + 0, cy + 3 + i, b);
        E.px(ctx, cx - 1, cy + 4 + i, b);
        E.px(ctx, cx - 1, cy + 3 + i, O);
      }
      E.px(ctx, cx - 1, cy + 9, O);
    } else if (style === 'Mohawk') {
      // Center strip taller
      for (let y = -3; y <= 3; y++) {
        for (let x = 3; x <= 6; x++) {
          E.px(ctx, cx + x, cy + y, b);
        }
      }
      // outline
      for (let y = -4; y <= 3; y++) {
        E.px(ctx, cx + 2, cy + y, O);
        E.px(ctx, cx + 7, cy + y, O);
      }
      E.px(ctx, cx + 3, cy - 3, O);
      E.px(ctx, cx + 4, cy - 3, O);
      E.px(ctx, cx + 5, cy - 3, O);
      E.px(ctx, cx + 6, cy - 3, O);
      // highlight
      E.px(ctx, cx + 4, cy - 2, h);
      E.px(ctx, cx + 5, cy - 2, h);
    } else if (style === 'Ponytail') {
      const tpl = [
        '..OOOOOO...',
        '.OBBBBBBO..',
        'OBBHHBBBBO.',
        'OBBBBBBBBO.',
        '.BBBBBBBBO.'
      ];
      E.stamp(ctx, cx - 1, cy - 1, tpl, { O, B: b, H: h });
      // Ponytail behind (left side)
      E.px(ctx, cx + 0, cy + 3, O);
      E.px(ctx, cx - 1, cy + 4, O);
      E.px(ctx, cx - 1, cy + 5, b);
      E.px(ctx, cx - 2, cy + 6, O);
      E.px(ctx, cx - 2, cy + 7, b);
      E.px(ctx, cx - 2, cy + 8, O);
    }
  };

  // ---------- HAT ----------
  Parts.drawHat = function (ctx, cx, cy, hatKind, hatCol) {
    if (!hatCol || hatKind === 'None') return;
    const b = hatCol.base, s = hatCol.shade, h = hatCol.hl;
    const O = P.outline;

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

    // Slightly-tapered base silhouette (collar narrower than shoulders).
    const tpl = [
      '.OBSBO.', // y0 collar — narrow neck opening (S = neck dip)
      'OBHBBSO', // y1 shoulder line (back HL + front seam)
      'OBBBBSO', // y2
      'OBBBBSO', // y3
      'OBBBBSO', // y4
      'OBBBBSO', // y5
      'OSSSSSO', // y6 belt band
      'OOOOOOO'  // y7 base outline (flush with leg tops)
    ];
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
    E.px(ctx, tx + 0, ty + 0, O);   // top-left corner outline
    E.px(ctx, tx + 0, ty + 1, h);   // front deltoid highlight (top)
    E.px(ctx, tx + 1, ty + 2, h);   // front deltoid highlight (inner)
    E.px(ctx, tx + 0, ty + 2, s);   // armhole seam shadow

    // Back shoulder ball (right, further from viewer): tiny shaded bump above
    // the corner so the shoulder reads as a rounded joint at distance.
    E.px(ctx, tx + 6, ty + 0, O);   // top-right corner outline
    E.px(ctx, tx + 6, ty + 1, h);   // back deltoid highlight (top)
    E.px(ctx, tx + 5, ty + 2, h);   // back deltoid highlight (inner)
  };

  // ---------- VEST ----------
  Parts.drawVest = function (ctx, tx, ty, vest) {
    if (!vest) return;
    const b = vest.base, s = vest.shade, h = vest.hl, st = vest.strap;
    const O = P.outline;
    // Overlays the torso; spans y ty+1..ty+6
    // Plate carrier body
    const tpl = [
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
  // Two legs, 2 px wide × 6 px tall + boot. legOffsets is the modular
  // animation interface — front/back y offsets drive lift, frontBend/backBend
  // drive knee forward bend. Anchors (hips at ty=0, knees at ty=3, feet at
  // ty=6) stay constant so walk/run/crouch/jump/dead poses just reuse them.
  //
  // Spread layout: back leg sits at tx+0, front leg at tx+5 (5 col stride).
  // A single outline "hip bridge" pixel at tx+3 fills the visible gap
  // between leg tops so the silhouette stays solid even as legs lift.
  Parts.drawLegs = function (ctx, tx, ty, pants, legOffsets) {
    legOffsets = legOffsets || { front: 0, back: 0, frontBend: 0, backBend: 0 };
    const b = pants.base, s = pants.shade;
    const O = P.outline;
    const bootsB = P.boots.base;

    const drawLeg = function (lx, ly, bend) {
      const height = 6;
      for (let i = 0; i < height; i++) {
        const dx = (i >= 3 && bend) ? bend : 0;
        if (i === 0) {
          // Waistband row — shade both pixels so it merges with the torso base.
          E.px(ctx, lx + dx, ly + i, s);
          E.px(ctx, lx + 1 + dx, ly + i, s);
        } else {
          E.px(ctx, lx + dx, ly + i, b);
          E.px(ctx, lx + 1 + dx, ly + i, s);
        }
        if (i === 3) {
          // Knee crease — single darker pixel on the front column.
          E.px(ctx, lx + 1 + dx, ly + i, O);
        }
        // Leg outline
        E.px(ctx, lx - 1 + dx, ly + i, O);
        E.px(ctx, lx + 2 + dx, ly + i, O);
      }
      // Boot — 4 px wide with a forward tip
      const bx = lx + (bend || 0);
      E.px(ctx, bx,     ly + 6, bootsB);
      E.px(ctx, bx + 1, ly + 6, bootsB);
      E.px(ctx, bx + 2, ly + 6, bootsB);
      E.px(ctx, bx - 1, ly + 6, O);
      E.px(ctx, bx + 3, ly + 6, O);
      E.px(ctx, bx,     ly + 7, O);
      E.px(ctx, bx + 1, ly + 7, O);
      E.px(ctx, bx + 2, ly + 7, O);
    };

    // Back leg drawn first, front leg drawn on top — natural depth ordering.
    drawLeg(tx + 0, ty + legOffsets.back, legOffsets.backBend);
    drawLeg(tx + 5, ty + legOffsets.front, legOffsets.frontBend);

    // Hip bridge — fills the 1-px gap between leg outlines at the natural
    // hip row so the silhouette never shows a hole, even mid-stride.
    E.px(ctx, tx + 3, ty, O);
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
    if (opts.closed) {
      strokeLine(ctx, ex - 1.25, ey, ex + 1.0, ey, P.outline, 0.35);
      strokeLine(ctx, ex + 1.2, ey, ex + 2.55, ey, P.outline, 0.3);
      return;
    }
    fillEllipse(ctx, ex, ey, 1.3, 1.45, P.outline);
    fillEllipse(ctx, ex + 0.05, ey, 0.88, 1.05, P.white);
    fillEllipse(ctx, ex + 0.48, ey + 0.03, 0.38, 0.72, eyeColor);

    fillEllipse(ctx, ex + 1.55, ey, 0.92, 1.12, P.outline);
    fillEllipse(ctx, ex + 1.58, ey, 0.58, 0.78, P.white);
    fillEllipse(ctx, ex + 1.88, ey + 0.03, 0.28, 0.54, eyeColor);
  };

  Parts.drawHairHD = function (ctx, cx, cy, style, hairCol) {
    if (!style || style === 'Bald') return;
    const O = P.outline;
    const b = hairCol.base;
    const s = hairCol.shade;
    const h = hairCol.hl;

    if (style === 'Mohawk') {
      fillRoundRect(ctx, cx + 2.05, cy - 4.0, 5.15, 7.7, 1.05, O);
      fillRoundRect(ctx, cx + 2.65, cy - 3.45, 3.95, 6.65, 0.9, b);
      strokeLine(ctx, cx + 4.25, cy - 3.0, cx + 4.25, cy + 1.7, h, 0.55);
      return;
    }

    if (style === 'Buzz') {
      fillPath(ctx, O, function () {
        ctx.moveTo(cx + 0.25, cy + 3.55);
        ctx.quadraticCurveTo(cx + 1.1, cy + 0.1, cx + 4.35, cy + 0.0);
        ctx.quadraticCurveTo(cx + 7.55, cy + 0.05, cx + 8.45, cy + 3.45);
        ctx.quadraticCurveTo(cx + 5.0, cy + 4.2, cx + 0.25, cy + 3.55);
        ctx.closePath();
      });
      fillPath(ctx, b, function () {
        ctx.moveTo(cx + 0.95, cy + 3.15);
        ctx.quadraticCurveTo(cx + 1.55, cy + 0.65, cx + 4.35, cy + 0.55);
        ctx.quadraticCurveTo(cx + 6.95, cy + 0.65, cx + 7.7, cy + 3.05);
        ctx.quadraticCurveTo(cx + 4.85, cy + 3.65, cx + 0.95, cy + 3.15);
        ctx.closePath();
      });
      strokeLine(ctx, cx + 2.25, cy + 2.9, cx + 7.0, cy + 2.95, s, 0.35);
      return;
    }

    fillPath(ctx, O, function () {
      ctx.moveTo(cx - 0.7, cy + 4.05);
      ctx.quadraticCurveTo(cx + 0.25, cy - 1.65, cx + 4.25, cy - 1.8);
      ctx.quadraticCurveTo(cx + 8.65, cy - 1.45, cx + 9.2, cy + 3.45);
      ctx.quadraticCurveTo(cx + 8.05, cy + 4.95, cx + 6.25, cy + 5.25);
      ctx.quadraticCurveTo(cx + 4.3, cy + 4.05, cx + 2.35, cy + 4.55);
      ctx.quadraticCurveTo(cx + 0.45, cy + 5.05, cx - 0.7, cy + 4.05);
      ctx.closePath();
    });
    fillPath(ctx, b, function () {
      ctx.moveTo(cx + 0.05, cy + 3.65);
      ctx.quadraticCurveTo(cx + 0.8, cy - 0.95, cx + 4.25, cy - 1.05);
      ctx.quadraticCurveTo(cx + 7.9, cy - 0.75, cx + 8.45, cy + 3.15);
      ctx.quadraticCurveTo(cx + 7.35, cy + 4.35, cx + 5.9, cy + 4.55);
      ctx.quadraticCurveTo(cx + 4.1, cy + 3.55, cx + 2.3, cy + 4.05);
      ctx.quadraticCurveTo(cx + 0.75, cy + 4.45, cx + 0.05, cy + 3.65);
      ctx.closePath();
    });
    strokeLine(ctx, cx + 2.2, cy + 0.4, cx + 6.1, cy + 1.0, h, 0.45);
    strokeLine(ctx, cx + 1.0, cy + 3.85, cx + 7.85, cy + 3.95, s, 0.4);

    if (style === 'Messy') {
      strokePath(ctx, O, 0.75, function () {
        ctx.moveTo(cx + 0.9, cy + 0.75);
        ctx.lineTo(cx + 0.0, cy - 1.8);
        ctx.moveTo(cx + 2.85, cy - 0.25);
        ctx.lineTo(cx + 2.25, cy - 2.45);
        ctx.moveTo(cx + 5.15, cy - 0.45);
        ctx.lineTo(cx + 6.05, cy - 2.1);
        ctx.moveTo(cx + 7.25, cy + 0.75);
        ctx.lineTo(cx + 8.75, cy - 0.95);
      });
      strokePath(ctx, b, 0.46, function () {
        ctx.moveTo(cx + 0.9, cy + 0.75);
        ctx.lineTo(cx + 0.08, cy - 1.55);
        ctx.moveTo(cx + 2.85, cy - 0.25);
        ctx.lineTo(cx + 2.32, cy - 2.2);
        ctx.moveTo(cx + 5.15, cy - 0.45);
        ctx.lineTo(cx + 5.9, cy - 1.85);
        ctx.moveTo(cx + 7.25, cy + 0.75);
        ctx.lineTo(cx + 8.55, cy - 0.75);
      });
    } else if (style === 'Long') {
      strokeLine(ctx, cx - 0.25, cy + 3.65, cx - 1.15, cy + 9.35, O, 2.1);
      strokeLine(ctx, cx - 0.2, cy + 3.55, cx - 0.95, cy + 9.05, b, 1.35);
      strokeLine(ctx, cx - 0.5, cy + 5.15, cx - 0.95, cy + 8.2, s, 0.45);
    } else if (style === 'Ponytail') {
      strokeLine(ctx, cx + 0.05, cy + 4.35, cx - 2.1, cy + 7.85, O, 2.4);
      strokeLine(ctx, cx + 0.05, cy + 4.35, cx - 1.85, cy + 7.65, b, 1.55);
    }
  };

  Parts.drawHatHD = function (ctx, cx, cy, hatKind, hatCol) {
    if (!hatCol || hatKind === 'None') return;
    const O = P.outline;
    const b = hatCol.base;
    const s = hatCol.shade;
    const h = hatCol.hl;

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

  Parts.drawTorsoHD = function (ctx, tx, ty, uniform) {
    const O = P.outline;
    // Trapezoidal torso: shoulders wider than belt, with two distinct shoulder
    // balls bulging at the top corners for a 3/4 chibi perspective.
    fillPath(ctx, O, function () {
      ctx.moveTo(tx - 0.5, ty + 1.6);
      ctx.quadraticCurveTo(tx - 0.2, ty + 0.3, tx + 1.2, ty + 0.15);
      ctx.quadraticCurveTo(tx + 3.5, ty - 0.4, tx + 5.8, ty + 0.15);
      ctx.quadraticCurveTo(tx + 7.2, ty + 0.3, tx + 7.55, ty + 1.6);
      ctx.lineTo(tx + 7.0, ty + 8.1);
      ctx.lineTo(tx - 0.05, ty + 8.1);
      ctx.closePath();
    });
    fillPath(ctx, uniform.base, function () {
      ctx.moveTo(tx + 0.2, ty + 1.7);
      ctx.quadraticCurveTo(tx + 0.5, ty + 0.85, tx + 1.5, ty + 0.7);
      ctx.quadraticCurveTo(tx + 3.5, ty + 0.2, tx + 5.5, ty + 0.7);
      ctx.quadraticCurveTo(tx + 6.5, ty + 0.85, tx + 6.85, ty + 1.7);
      ctx.lineTo(tx + 6.25, ty + 7.25);
      ctx.lineTo(tx + 0.75, ty + 7.25);
      ctx.closePath();
    });
    // Front-side shading column (right = front in 3/4 view)
    fillRoundRect(ctx, tx + 5.0, ty + 1.6, 1.35, 5.25, 0.4, uniform.shade);
    // Belt band
    fillRoundRect(ctx, tx + 0.85, ty + 6.35, 5.95, 1.15, 0.25, uniform.shade);
    // Front shoulder highlight (bigger / closer to viewer — now on the LEFT)
    fillEllipse(ctx, tx + 1.2, ty + 1.4, 0.7, 0.55, uniform.hl);
    // Back shoulder highlight (smaller — now on the RIGHT)
    fillEllipse(ctx, tx + 5.7, ty + 1.4, 0.55, 0.45, uniform.hl);
    // Buttons
    fillEllipse(ctx, tx + 4.5, ty + 3.3, 0.28, 0.28, uniform.hl);
    fillEllipse(ctx, tx + 4.45, ty + 5.1, 0.28, 0.28, uniform.hl);
  };

  Parts.drawVestHD = function (ctx, tx, ty, vest) {
    if (!vest) return;
    fillRoundRect(ctx, tx + 0.2, ty + 1.1, 6.75, 6.7, 0.8, P.outline);
    fillRoundRect(ctx, tx + 0.75, ty + 1.55, 5.7, 5.65, 0.65, vest.base);
    fillRoundRect(ctx, tx + 4.9, ty + 1.9, 0.9, 4.8, 0.35, vest.shade);
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

  Parts.drawWaistBridgeHD = function (ctx, tx, topY, legsY) {
    if (topY >= legsY) return;
    fillRoundRect(ctx, tx - 1.2, topY - 0.1, 9.35, legsY - topY + 0.35, 0.25, P.outline);
  };

  Parts.drawLegsHD = function (ctx, tx, ty, pants, legOffsets) {
    legOffsets = legOffsets || { front: 0, back: 0, frontBend: 0, backBend: 0 };
    const bootsB = P.boots.base;
    const drawLeg = function (lx, ly, bend) {
      const kneeX = lx + 0.9 + bend * 0.45;
      const kneeY = ly + 3.2;
      const footX = lx + 1.25 + bend;
      const footY = ly + 6.25;
      strokePath(ctx, P.outline, 2.45, function () {
        ctx.moveTo(lx + 0.8, ly + 0.2);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
      });
      strokePath(ctx, pants.base, 1.45, function () {
        ctx.moveTo(lx + 0.8, ly + 0.2);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
      });
      strokeLine(ctx, lx + 1.25, ly + 0.7, footX + 0.25, footY - 0.4, pants.shade, 0.45);
      fillRoundRect(ctx, footX - 0.9, footY - 0.1, 3.2, 1.35, 0.45, P.outline);
      fillRoundRect(ctx, footX - 0.45, footY - 0.35, 2.5, 0.9, 0.35, bootsB);
    };
    // Spread stance — back leg on the left, front leg on the right.
    drawLeg(tx + 0, ty + legOffsets.back, legOffsets.backBend);
    drawLeg(tx + 5, ty + legOffsets.front, legOffsets.frontBend);
    // Hip bridge between leg tops so HD silhouette stays solid.
    fillRoundRect(ctx, tx + 2.7, ty - 0.1, 1.6, 1.0, 0.25, P.outline);
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
