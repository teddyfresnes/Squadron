// Color palette and helpers — neutral base palette, all customizable colors use OKLCH-ish hue picking
// We stick to a limited palette per layer with shade + highlight + outline for pixel-art feel.

window.Palette = {
  // Neutral outlines & whites
  outline: '#0a0a10',
  outlineSoft: '#20202a',
  white: '#f4f0e6',
  whiteShade: '#c9c2b0',

  // Skin tones (4 options)
  skin: [
    { name: 'Light',   base: '#f0c9a4', shade: '#c89879', hl: '#ffe0c2' },
    { name: 'Tan',     base: '#d69464', shade: '#a66842', hl: '#eab089' },
    { name: 'Brown',   base: '#8a5636', shade: '#5c3620', hl: '#a86f4a' },
    { name: 'Dark',    base: '#4f2e1d', shade: '#2e1a11', hl: '#6a4126' }
  ],

  // Hair colors (derived but more saturated)
  hair: [
    { name: 'Black',   base: '#1b1b20', shade: '#000000', hl: '#33333a' },
    { name: 'Brown',   base: '#5a3a22', shade: '#35200f', hl: '#7a5132' },
    { name: 'Blonde',  base: '#e4c37a', shade: '#b89448', hl: '#f7e0a4' },
    { name: 'Red',     base: '#a84423', shade: '#6e2a12', hl: '#d26a3e' },
    { name: 'White',   base: '#e0dccb', shade: '#a8a594', hl: '#ffffff' },
    { name: 'Green',   base: '#4a7a3a', shade: '#2d4c21', hl: '#6da057' }
  ],

  // Eye colors
  eye: [
    { name: 'Brown',  base: '#5a3a22' },
    { name: 'Blue',   base: '#3a7aa8' },
    { name: 'Green',  base: '#3a7a4a' },
    { name: 'Grey',   base: '#6a6a7a' },
    { name: 'Amber',  base: '#b88a2a' }
  ],

  // Uniform / clothing presets (top = shirt)
  uniforms: [
    { name: 'Olive',    base: '#5a6a3a', shade: '#3a4a22', hl: '#7a8a52' },
    { name: 'Khaki',    base: '#8a7a4a', shade: '#5a4a22', hl: '#a89a6a' },
    { name: 'Navy',     base: '#2a3a5a', shade: '#12203a', hl: '#42527a' },
    { name: 'Black',    base: '#2a2a30', shade: '#10101a', hl: '#42424a' },
    { name: 'Red',      base: '#8a2a2a', shade: '#5a1010', hl: '#b04242' },
    { name: 'Urban',    base: '#4a4a52', shade: '#2a2a30', hl: '#6a6a72' },
    { name: 'Desert',   base: '#b89864', shade: '#8a6a3a', hl: '#d2b88a' },
    { name: 'White',    base: '#d8d2c2', shade: '#a8a494', hl: '#f0ecd8' }
  ],

  // Pants
  pants: [
    { name: 'Black',    base: '#20202a', shade: '#0a0a10', hl: '#36363e' },
    { name: 'Brown',    base: '#4a3a22', shade: '#2a200f', hl: '#6a5432' },
    { name: 'Jeans',    base: '#2a4a7a', shade: '#12305a', hl: '#4a6aa0' },
    { name: 'Camo',     base: '#5a6a3a', shade: '#3a4a22', hl: '#7a8a52' },
    { name: 'Grey',     base: '#52525a', shade: '#32323a', hl: '#72727a' }
  ],

  // Vest (armor/tactical)
  vest: [
    { name: 'Tactical Black',  base: '#1a1a22', shade: '#000000', hl: '#2e2e38', strap: '#0a0a10' },
    { name: 'Coyote',          base: '#8a6a42', shade: '#5a4020', hl: '#a88a5a', strap: '#3a2a12' },
    { name: 'Olive',           base: '#3a4a22', shade: '#22321a', hl: '#5a6a3a', strap: '#12200a' },
    { name: 'Urban Grey',      base: '#52525a', shade: '#32323a', hl: '#72727a', strap: '#20202a' }
  ],

  // Backpack
  backpack: [
    { name: 'Black',  base: '#20202a', shade: '#10101a', hl: '#36363e' },
    { name: 'Olive',  base: '#3a4a22', shade: '#22321a', hl: '#5a6a3a' },
    { name: 'Coyote', base: '#8a6a42', shade: '#5a4020', hl: '#a88a5a' },
    { name: 'Red',    base: '#8a2a2a', shade: '#5a1010', hl: '#b04242' }
  ],

  // Hat presets
  hat: [
    { name: 'None' },
    { name: 'Beanie',        base: '#2a2a30', shade: '#10101a', hl: '#42424a' },
    { name: 'Cap',           base: '#2a3a5a', shade: '#12203a', hl: '#42527a' },
    { name: 'Helmet',        base: '#5a6a3a', shade: '#3a4a22', hl: '#7a8a52' },
    { name: 'Combat Helmet', base: '#2a2a30', shade: '#10101a', hl: '#42424a' },
    { name: 'Boonie',        base: '#8a7a4a', shade: '#5a4a22', hl: '#a89a6a' },
    { name: 'Bandana',       base: '#8a2a2a', shade: '#5a1010', hl: '#b04242' }
  ],

  // Hairstyles
  hairstyles: [
    { name: 'Short' },
    { name: 'Buzz' },
    { name: 'Messy' },
    { name: 'Long' },
    { name: 'Mohawk' },
    { name: 'Ponytail' },
    { name: 'Bald' }
  ],

  // Boots / shoes
  boots: { base: '#2a1a12', shade: '#10080a', hl: '#3a2418' },

  // Gloves
  gloves: { base: '#1a1a22', shade: '#0a0a10', hl: '#2e2e38' }
};
