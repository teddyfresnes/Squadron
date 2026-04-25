// Body parts — each function draws one layer onto ctx at given anchor position.
// Sprite is 32x32. Character faces RIGHT by default.
// Anatomy map (approximate):
//   y  0-2   : hat / hair top
//   y  3-11  : head (9px tall, ~9px wide)
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
  // Head is an ovoid ~8x9 centered at x=15, y=3..11.
  // Takes skin palette entry.
  Parts.drawHead = function (ctx, cx, cy, skin, opts) {
    opts = opts || {};
    const b = skin.base, s = skin.shade, h = skin.hl;
    const O = P.outline;

    // Head silhouette (facing right; chin slightly forward-right).
    // 8 wide, 9 tall. cx,cy is top-left of bounding box.
    const tpl = [
      ' .OOOO. ',
      '.OBBBBO.',
      'OBBBBBBO',
      'OBBBBBBO',
      'OBBHBBBO',   // cheekbone highlight
      'OBBBBBBO',
      'OBBBBBBO',
      '.OBBBBO.',
      '..OOOO..'
    ];
    const map = { O, B: b, H: h, S: s };
    E.stamp(ctx, cx, cy, tpl, map);

    // Shade on left cheek (back of head from right-facing view)
    E.px(ctx, cx + 1, cy + 3, s);
    E.px(ctx, cx + 1, cy + 4, s);
    E.px(ctx, cx + 1, cy + 5, s);
    E.px(ctx, cx + 1, cy + 6, s);

    // Ear hint (left side = back ear)
    E.px(ctx, cx + 0, cy + 4, O);
    E.px(ctx, cx + 0, cy + 5, s);

    // Nose (front, right side)
    E.px(ctx, cx + 7, cy + 5, O);
    E.px(ctx, cx + 7, cy + 4, b);

    // Mouth
    if (opts.hurt) {
      E.px(ctx, cx + 5, cy + 7, O);
      E.px(ctx, cx + 6, cy + 7, O);
    } else {
      E.px(ctx, cx + 5, cy + 7, O);
    }
  };

  // ---------- WAIST BRIDGE ----------
  // Fills the rows between torso bottom and legs top when bodyDY lifts the
  // torso. Uses outline color so it reads as a belt shadow continuous with the
  // torso bottom outline row.
  Parts.drawWaistBridge = function (ctx, tx, topY, legsY) {
    const O = P.outline;
    // topY is the first row below the torso outline bottom.
    // Draw rows up to (but not including) the legs' top row.
    for (let y = topY; y < legsY; y++) {
      for (let x = 0; x < 7; x++) {
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
    // Stretch as needed so the head never detaches even in dramatic poses.
    const endY = torsoY - 1;
    for (let y = topY; y <= endY; y++) {
      E.px(ctx, ox - 2, y, O);
      E.px(ctx, ox - 1, y, skin.shade);
      E.px(ctx, ox,     y, skin.base);
      E.px(ctx, ox + 1, y, O);
    }
    // Collar-bone shadow where neck meets torso — subtle darker seam.
    E.px(ctx, ox - 1, endY, skin.shade);
  };

  // ---------- EYE ----------
  Parts.drawEye = function (ctx, cx, cy, eyeColor, opts) {
    opts = opts || {};
    // Eye sits at cx + 5, cy + 4
    const ex = cx + 5, ey = cy + 4;
    if (opts.closed) {
      E.px(ctx, ex, ey, P.outline);
      E.px(ctx, ex + 1, ey, P.outline);
      return;
    }
    // white + pupil
    E.px(ctx, ex, ey, P.white);
    E.px(ctx, ex + 1, ey, eyeColor);
  };

  // ---------- HAIR ----------
  Parts.drawHair = function (ctx, cx, cy, style, hairCol) {
    if (!style || style === 'Bald') return;
    const b = hairCol.base, s = hairCol.shade, h = hairCol.hl;
    const O = P.outline;

    if (style === 'Short') {
      // Cap of hair across top of head
      const tpl = [
        ' .OOOO. ',
        '.OBBBBO.',
        'OBBHBBBO',
        'OBBBBBBO'
      ];
      E.stamp(ctx, cx, cy, tpl, { O, B: b, H: h });
      // Sideburn hint back
      E.px(ctx, cx + 1, cy + 4, b);
    } else if (style === 'Buzz') {
      const tpl = [
        ' .OOOO. ',
        '.OBBBBO.',
        'OBBBBBBO'
      ];
      E.stamp(ctx, cx, cy, tpl, { O, B: b });
    } else if (style === 'Messy') {
      const tpl = [
        '.O.OO.O.',
        'OBOBBOBO',
        'OBBHBBBO',
        'OBBBBBBO',
        '.BBBBBB.'
      ];
      E.stamp(ctx, cx, cy - 1, tpl, { O, B: b, H: h });
    } else if (style === 'Long') {
      // flows down the back (left side since facing right)
      const tpl = [
        ' .OOOO. ',
        '.OBBBBO.',
        'OBBHBBBO',
        'OBBBBBBO'
      ];
      E.stamp(ctx, cx, cy, tpl, { O, B: b, H: h });
      // Trail down back
      for (let i = 0; i < 6; i++) {
        E.px(ctx, cx + 0, cy + 3 + i, b);
        E.px(ctx, cx - 1, cy + 4 + i, b);
        E.px(ctx, cx - 1, cy + 3 + i, O);
      }
      E.px(ctx, cx - 1, cy + 9, O);
    } else if (style === 'Mohawk') {
      // Center strip taller
      for (let y = -2; y <= 2; y++) {
        for (let x = 3; x <= 5; x++) {
          E.px(ctx, cx + x, cy + y, b);
        }
      }
      // outline
      for (let y = -3; y <= 2; y++) {
        E.px(ctx, cx + 2, cy + y, O);
        E.px(ctx, cx + 6, cy + y, O);
      }
      E.px(ctx, cx + 3, cy - 3, O);
      E.px(ctx, cx + 4, cy - 3, O);
      E.px(ctx, cx + 5, cy - 3, O);
      // highlight
      E.px(ctx, cx + 4, cy - 2, h);
    } else if (style === 'Ponytail') {
      const tpl = [
        ' .OOOO. ',
        '.OBBBBO.',
        'OBBHBBBO',
        'OBBBBBBO'
      ];
      E.stamp(ctx, cx, cy, tpl, { O, B: b, H: h });
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
  // 7 wide × 8 tall. Character faces RIGHT: left column = back (shaded),
  // right column = front (where buttons / placket live). tx,ty is TL of the box.
  Parts.drawTorso = function (ctx, tx, ty, uniform, opts) {
    opts = opts || {};
    const b = uniform.base, s = uniform.shade, h = uniform.hl;
    const O = P.outline;

    // Base silhouette. Shoulders get a highlight row on the back, front side is
    // pre-shaded so buttons and pocket details read cleanly.
    const tpl = [
      'OBBSBBO', // y0 collar line — center dip (S) reads as the neck opening
      'OBHBBSO', // y1 shoulder highlight (back) + shoulder seam shade (front)
      'OBBBBSO', // y2
      'OBBBBSO', // y3
      'OBBBBSO', // y4
      'OBBBBSO', // y5
      'OSSSSSO', // y6 belt band — darker strip across the waist
      'OOOOOOO'  // y7 base outline (sits flush with top of legs)
    ];
    E.stamp(ctx, tx, ty, tpl, { O, B: b, H: h, S: s });

    // Collar notch inset — a single darker pixel under the V so the collar
    // reads as an opening rather than a single misplaced shade pixel.
    E.px(ctx, tx + 3, ty + 1, s);

    // Placket + buttons down the front (right side of the body).
    E.px(ctx, tx + 4, ty + 2, s);   // placket seam
    E.px(ctx, tx + 4, ty + 3, h);   // upper button
    E.px(ctx, tx + 4, ty + 4, s);   // placket seam
    E.px(ctx, tx + 4, ty + 5, h);   // lower button

    // Chest pocket hint (left of placket, small L-shape of stitching).
    E.px(ctx, tx + 2, ty + 3, s);
    E.px(ctx, tx + 3, ty + 3, s);
    E.px(ctx, tx + 2, ty + 4, s);

    // Belt buckle — one bright pixel centered on the belt row.
    E.px(ctx, tx + 3, ty + 6, h);
    E.px(ctx, tx + 4, ty + 6, O);  // buckle outline edge for contrast
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
  // Legs: 2 legs, 2px wide each, 6 tall. At torso bottom y=22 to 29.
  // Offsets control walking/running. frontLeg and backLeg y offsets and bend.
  Parts.drawLegs = function (ctx, tx, ty, pants, legOffsets) {
    // tx = torso TL (so legs start at tx+1 and tx+4 roughly)
    // ty = top of legs
    legOffsets = legOffsets || { front: 0, back: 0, frontBend: 0, backBend: 0 };
    const b = pants.base, s = pants.shade, h = pants.hl;
    const O = P.outline;
    const bootsB = P.boots.base, bootsS = P.boots.shade;

    const drawLeg = function (lx, ly, bend) {
      // 2 wide, 6 tall. If bend > 0, knee bends forward at row 3.
      const height = 6;
      for (let i = 0; i < height; i++) {
        const dx = (i >= 3 && bend) ? bend : 0;
        // Top row reads as a waistband: shade on both pixels so it visually
        // merges with the torso's bottom outline rather than showing a sudden
        // color shift when pants are lighter than the shirt.
        if (i === 0) {
          E.px(ctx, lx + dx, ly + i, s);
          E.px(ctx, lx + 1 + dx, ly + i, s);
        } else {
          E.px(ctx, lx + dx, ly + i, b);
          E.px(ctx, lx + 1 + dx, ly + i, s);
        }
        // Knee crease — single darker pixel on the front column at the bend row.
        if (i === 3) {
          E.px(ctx, lx + 1 + dx, ly + i, O);
        }
        // outline
        E.px(ctx, lx - 1 + dx, ly + i, O);
        E.px(ctx, lx + 2 + dx, ly + i, O);
      }
      // Boot
      E.px(ctx, lx + (bend || 0), ly + 6, bootsB);
      E.px(ctx, lx + 1 + (bend || 0), ly + 6, bootsB);
      E.px(ctx, lx + (bend || 0) + (bend > 0 ? 1 : 0), ly + 6, bootsB);
      // Boot tip extending forward
      E.px(ctx, lx + 2 + (bend || 0), ly + 6, bootsB);
      E.px(ctx, lx + (bend || 0) - 1, ly + 6, O);
      E.px(ctx, lx + 3 + (bend || 0), ly + 6, O);
      E.px(ctx, lx + (bend || 0), ly + 7, O);
      E.px(ctx, lx + 1 + (bend || 0), ly + 7, O);
      E.px(ctx, lx + 2 + (bend || 0), ly + 7, O);
    };

    // Back leg first
    drawLeg(tx + 1, ty + legOffsets.back, legOffsets.backBend);
    // Front leg on top
    drawLeg(tx + 4, ty + legOffsets.front, legOffsets.frontBend);
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

  window.Parts = Parts;
})();
