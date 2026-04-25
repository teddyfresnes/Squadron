// Sprite engine — pixel-perfect rendering on canvas.
// Coordinate system: 32x32 canvas per frame, origin top-left, pixel units.
// All draw calls are integer-snapped; we use ctx.fillRect(x, y, 1, 1) equivalents via a helper.

(function () {
  const Engine = {};

  // Draw a single pixel. x,y in sprite-space.
  Engine.px = function (ctx, x, y, color) {
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, 1, 1);
  };

  // Draw a filled rect (pixel aligned).
  Engine.rect = function (ctx, x, y, w, h, color) {
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  };

  // Draw from a 2D array template. Template is [[ch, ch, ch, ...], ...]
  // Mapping is { ch: color, ... }. '.' / ' ' / null skipped.
  Engine.stamp = function (ctx, x0, y0, template, mapping, flipX) {
    for (let yy = 0; yy < template.length; yy++) {
      const row = template[yy];
      for (let xx = 0; xx < row.length; xx++) {
        const ch = row[xx];
        if (!ch || ch === '.' || ch === ' ') continue;
        const color = mapping[ch];
        if (!color) continue;
        const dx = flipX ? (row.length - 1 - xx) : xx;
        Engine.px(ctx, x0 + dx, y0 + yy, color);
      }
    }
  };

  // Outline a filled region post-hoc (simple 4-neighbor) — useful for reading pixels and adding outline
  Engine.outlineRegion = function (ctx, w, h, outlineColor) {
    let img;
    // Reading pixel data fails on a canvas that has been tainted by a sprite
    // sheet loaded under a cross-origin policy (e.g. opening the HTML directly
    // via file:// in some browsers). In that case we silently skip the outline
    // pass — the sprite already carries its own baked-in outline.
    try {
      img = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      return;
    }
    const d = img.data;
    const idx = (x, y) => (y * w + x) * 4;
    const isFilled = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      return d[idx(x, y) + 3] > 0;
    };
    const toOutline = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!isFilled(x, y)) {
          if (isFilled(x - 1, y) || isFilled(x + 1, y) || isFilled(x, y - 1) || isFilled(x, y + 1)) {
            toOutline.push([x, y]);
          }
        }
      }
    }
    ctx.fillStyle = outlineColor;
    for (const [x, y] of toOutline) ctx.fillRect(x, y, 1, 1);
  };

  // Clear canvas to transparent
  Engine.clear = function (ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
  };

  // Facing: +1 right, -1 left. We build everything facing RIGHT then flip via canvas transform if needed.

  window.Engine = Engine;
})();
