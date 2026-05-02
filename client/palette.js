// Color palette and helpers — neutral base palette, all customizable colors use OKLCH-ish hue picking
// We stick to a limited palette per layer with shade + highlight + outline for pixel-art feel.

const SOLDIER_COLORS = [
  { name: 'Light Blue', base: '#78b8e8', shade: '#4f82b8', hl: '#a6d8ff' },
  { name: 'Blue',       base: '#2f5f9f', shade: '#183764', hl: '#5f8ed0' },
  { name: 'Light Green', base: '#78b85f', shade: '#4f813b', hl: '#a6da8a' },
  { name: 'Green',      base: '#3d6f2e', shade: '#24451c', hl: '#61944d' },
  { name: 'Pale Red',   base: '#b85b5b', shade: '#7b3434', hl: '#d98a8a' },
  { name: 'Purple',     base: '#7656b4', shade: '#493077', hl: '#9b7add' },
  { name: 'Pink',       base: '#d778a8', shade: '#9a3f70', hl: '#f0a6ca' },
  { name: 'Yellow',     base: '#d8b64a', shade: '#9a7a24', hl: '#f2d978' },
  { name: 'Orange',     base: '#d47a32', shade: '#914514', hl: '#f0a15a' },
  { name: 'Grey',       base: '#74747c', shade: '#44444c', hl: '#a0a0a8' }
];

window.Palette = {
  // Neutral outlines & whites
  outline: '#0a0a10',
  outlineSoft: '#20202a',
  white: '#f4f0e6',
  whiteShade: '#c9c2b0',

  // Skin tones (8 options)
  skin: [
    { name: 'Light',       base: '#f0c9a4', shade: '#c89879', hl: '#ffe0c2' },
    { name: 'Light-Mid',   base: '#e5b99a', shade: '#bd8464', hl: '#f5d4bc' },
    { name: 'Mid',         base: '#daa87e', shade: '#b08551', hl: '#efcfa8' },
    { name: 'Tan',         base: '#d69464', shade: '#a66842', hl: '#eab089' },
    { name: 'Tan-Brown',   base: '#9f6b47', shade: '#714d32', hl: '#b8865c' },
    { name: 'Brown',       base: '#8a5636', shade: '#5c3620', hl: '#a86f4a' },
    { name: 'Brown-Dark',  base: '#6a4226', shade: '#462a16', hl: '#843c1e' },
    { name: 'Dark',        base: '#4f2e1d', shade: '#2e1a11', hl: '#6a4126' }
  ],

  // Hair colors
  hair: [
    { name: 'Black',       base: '#141416', shade: '#000000', hl: '#2a2a2e' },
    { name: 'Very Dark Brown', base: '#24160d', shade: '#100805', hl: '#3a2418' },
    { name: 'Dark Brown',  base: '#3f2818', shade: '#211208', hl: '#5a3824' },
    { name: 'Brown',       base: '#5a3a22', shade: '#35200f', hl: '#7a5132' },
    { name: 'Ginger',      base: '#b8642a', shade: '#6f3218', hl: '#dda24f' },
    { name: 'Blonde',      base: '#e4c37a', shade: '#b89448', hl: '#f7e0a4' },
    { name: 'Grey',        base: '#9a9588', shade: '#66645c', hl: '#d8d4c8' }
  ],

  // Eye colors
  eye: [
    { name: 'Black',       base: '#1a1a22' },
    { name: 'Dark Brown',  base: '#3f2818' },
    { name: 'Brown',       base: '#5a3a22' },
    { name: 'Tan Brown',   base: '#7a5a3a' },
    { name: 'Light Brown', base: '#9a7555' },
    { name: 'Blue',        base: '#3a7aa8' },
    { name: 'Dark Blue',   base: '#1f4a6a' },
    { name: 'Green',       base: '#3a7a4a' },
    { name: 'Grey',        base: '#6a6a7a' }
  ],

  // Uniform / clothing presets. Renderer reuses this single color for shirt,
  // pants, backpack and helmet.
  uniforms: SOLDIER_COLORS,

  // Vest (armor/tactical)
  vest: [
    { name: 'Black', base: '#1a1a22', shade: '#000000', hl: '#2e2e38', strap: '#0a0a10' }
  ],

  // Headwear type. Helmet color follows the uniform color.
  hat: [
    { name: 'None' },
    { name: 'High Helmet' },
    { name: 'Pilot Goggles' },
    { name: 'Cap' },
    { name: 'Beret' },
    { name: 'Military Helmet' },
    { name: 'Tactical Helmet' },
    { name: 'Helmet' }
  ],

  // Hairstyles
  hairstyles: [
    { name: 'Textured Crop' },
    { name: 'Low Fade' },
    { name: 'Side Part' },
    { name: 'Quiff' },
    { name: 'Curly Top' },
    { name: 'Short' },
    { name: 'Messy' },
    { name: 'Long' },
    { name: 'Ponytail' },
    { name: 'Bob' },
    { name: 'Wavy' },
    { name: 'Flowing' },
    { name: 'High Ponytail' },
    { name: 'Buzz Cut' },
    { name: 'Crew Cut' },
    { name: 'Bald' }
  ],

  // Boots / shoes
  boots: { base: '#2a1a12', shade: '#10080a', hl: '#3a2418' },

  // Gloves
  gloves: { base: '#1a1a22', shade: '#0a0a10', hl: '#2e2e38' }
};
