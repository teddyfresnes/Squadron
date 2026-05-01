// Main React app — UI showcase for custom 2D characters.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Default rifle index in the new sheet-driven list. The list order is
// [smg×11, rifle×10, heavy×14, shotgun×8, sniper×10, pistol×8] — index 11 is
// the first rifle (RIFLE-01).
const DEFAULT_WEAPON_IDX = 11;

const DEFAULT_CFG = {
  bodyType: 'male',
  skinIdx: 0,
  hairIdx: 1,
  hairStyleIdx: 0,  // Textured Crop
  eyeIdx: 1,
  uniformIdx: 0,
  vestOn: true,
  backpackOn: false,
  hatIdx: 1,
  weaponIdx: DEFAULT_WEAPON_IDX,
  weaponSkinIdx: 33  // sheet 33.png — default texture style
};

const BODY_TYPES = [
  { name: 'Male', value: 'male' },
  { name: 'Female', value: 'female' }
];

const HAIRSTYLES_BY_BODY = {
  male: ['Textured Crop', 'Low Fade', 'Side Part', 'Quiff', 'Curly Top', 'Buzz Cut', 'Crew Cut', 'Bald'],
  female: ['Short', 'Messy', 'Long', 'Ponytail', 'Bob', 'Wavy', 'Flowing', 'High Ponytail']
};

function hairStyleOptionsForBody(bodyType) {
  const allowed = HAIRSTYLES_BY_BODY[bodyType || 'male'] || HAIRSTYLES_BY_BODY.male;
  return window.Palette.hairstyles
    .map((style, idx) => ({ ...style, idx }))
    .filter((style) => allowed.includes(style.name));
}

function fallbackHairStyleIdx(bodyType) {
  const options = hairStyleOptionsForBody(bodyType);
  return options.length ? options[0].idx : 0;
}

function normalizeHairStyleForBody(cfg) {
  const bodyType = cfg.bodyType || 'male';
  const options = hairStyleOptionsForBody(bodyType);
  if (options.some((style) => style.idx === cfg.hairStyleIdx)) return cfg;
  return { ...cfg, hairStyleIdx: fallbackHairStyleIdx(bodyType) };
}

function normalizeHeadwear(cfg) {
  const hats = window.Palette.hat || [];
  let hatIdx = Number.isInteger(cfg.hatIdx) ? cfg.hatIdx : DEFAULT_CFG.hatIdx;

  if (hatIdx < 0 || !hats[hatIdx]) hatIdx = DEFAULT_CFG.hatIdx;
  if (!hats[hatIdx]) hatIdx = 0;

  if (hatIdx === cfg.hatIdx) return cfg;
  return { ...cfg, hatIdx };
}

function clampPaletteIdx(value, list, fallback) {
  const idx = Number.isInteger(value) ? value : fallback;
  if (!list || !list.length) return fallback;
  if (idx < 0 || idx >= list.length) return fallback;
  return idx;
}

function normalizePaletteIndices(cfg) {
  const { pantsIdx, backpackIdx, helmetColorIdx, vestIdx, ...cleanCfg } = cfg;
  return {
    ...cleanCfg,
    skinIdx: clampPaletteIdx(cfg.skinIdx, window.Palette.skin, DEFAULT_CFG.skinIdx),
    hairIdx: clampPaletteIdx(cfg.hairIdx, window.Palette.hair, DEFAULT_CFG.hairIdx),
    eyeIdx: clampPaletteIdx(cfg.eyeIdx, window.Palette.eye, DEFAULT_CFG.eyeIdx),
    uniformIdx: clampPaletteIdx(cfg.uniformIdx, window.Palette.uniforms, DEFAULT_CFG.uniformIdx)
  };
}

function normalizeCharacterConfig(cfg) {
  return normalizePaletteIndices(normalizeHeadwear(normalizeHairStyleForBody(cfg)));
}

// Stage is sized to fit the largest weapons plus the 2x soldier body. Snipers
// can now sit on the shoulder without clipping in either facing direction.
const STAGE_W = 256;
const STAGE_H = 112;
const SCALE = 3;    // default display scale for main preview
const MAX_DEVICE_PIXEL_RATIO = 2;

function getRenderRatio() {
  return Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
}

// ---------------- Animation player hook ----------------
function useAnim(animKey, running) {
  const [frame, setFrame] = useState(0);
  const anim = window.Anims[animKey];
  const ref = useRef({ last: 0, idx: 0 });

  useEffect(() => {
    if (!running) return;
    let raf;
    const loop = (t) => {
      const dt = t - ref.current.last;
      const frameTime = 1000 / anim.fps;
      if (dt >= frameTime) {
        ref.current.last = t;
        ref.current.idx = (ref.current.idx + 1);
        if (anim.loop === false) {
          if (ref.current.idx >= anim.frames) ref.current.idx = anim.frames - 1;
        } else {
          ref.current.idx = ref.current.idx % anim.frames;
        }
        setFrame(ref.current.idx);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animKey, running, anim]);

  // Reset on anim change
  useEffect(() => {
    ref.current.idx = 0;
    setFrame(0);
  }, [animKey]);

  return frame;
}

// ---------------- Canvas renderer component ----------------
// Returns a counter that bumps every time a weapon sheet loads or the active
// skin changes, so canvases that read from window.Weapons re-run their effect.
function useSheetReady() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const handler = () => setVersion((n) => n + 1);
    window.addEventListener('weapons:sheetLoaded', handler);
    return () => window.removeEventListener('weapons:sheetLoaded', handler);
  }, []);
  return version;
}

function SpriteCanvas({ cfg, animKey, frame, scale, facing, w = STAGE_W, h = STAGE_H }) {
  const ref = useRef();
  const sheetVersion = useSheetReady();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = getRenderRatio();
    const cssW = w * scale;
    const cssH = h * scale;
    const targetW = Math.round(cssW * ratio);
    const targetH = Math.round(cssH * ratio);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    window.CharacterRenderer.renderFrame(ctx, w, h, cfg, window.Anims[animKey], frame, facing || 1, {
      renderScale: scale * ratio,
      smooth: true
    });
  }, [cfg, animKey, frame, facing, w, h, scale, sheetVersion]);

  return (
    <canvas
      ref={ref}
      style={{
        width: w * scale,
        height: h * scale,
        display: 'block'
      }}
    />
  );
}

// Plays the animation inside a small canvas
function AnimPreview({ cfg, animKey, scale, facing, running }) {
  const frame = useAnim(animKey, running !== false);
  return <SpriteCanvas cfg={cfg} animKey={animKey} frame={frame} scale={scale} facing={facing} />;
}

// ---------------- UI components ----------------
function Section({ title, children }) {
  return (
    <div className="section">
      <h3>{title}</h3>
      {children ? <div className="section-body">{children}</div> : null}
    </div>
  );
}

function ColorSwatches({ options, selectedIdx, onPick, field = 'base' }) {
  return (
    <div className="swatches">
      {options.map((opt, i) => (
        <button
          key={i}
          className={'swatch' + (selectedIdx === i ? ' selected' : '')}
          onClick={() => onPick(i)}
          title={opt.name}
          style={{ background: opt[field] || '#333' }}
        >
          <span className="swatch-name">{opt.name}</span>
        </button>
      ))}
    </div>
  );
}

function Chips({ options, selectedIdx, onPick, labelKey = 'name' }) {
  return (
    <div className="chips">
      {options.map((opt, i) => (
        <button
          key={i}
          className={'chip' + (selectedIdx === i ? ' selected' : '')}
          onClick={() => onPick(i)}
        >
          {opt[labelKey] || opt}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-slider" />
      <span className="toggle-label">{label}</span>
    </label>
  );
}

// ---------------- App ----------------
function App() {
  const [cfg, setCfg] = useState(() => {
    try {
      const saved = localStorage.getItem('char-cfg');
      if (saved) return normalizeCharacterConfig({ ...DEFAULT_CFG, ...JSON.parse(saved) });
    } catch (e) {}
    return normalizeCharacterConfig(DEFAULT_CFG);
  });
  const [animKey, setAnimKey] = useState(() => localStorage.getItem('char-anim') || 'idle');
  const [facing, setFacing] = useState(1);
  const [bgMode, setBgMode] = useState('light');
  const [scale, setScale] = useState(SCALE);

  useEffect(() => { localStorage.setItem('char-cfg', JSON.stringify(cfg)); }, [cfg]);
  useEffect(() => { localStorage.setItem('char-anim', animKey); }, [animKey]);
  useEffect(() => {
    setCfg((c) => normalizeCharacterConfig(c));
  }, [cfg.bodyType, cfg.hairStyleIdx, cfg.hatIdx]);

  // Push the active weapon skin into the Weapons module whenever it changes.
  useEffect(() => {
    if (window.Weapons && typeof window.Weapons.setSkinIdx === 'function') {
      window.Weapons.setSkinIdx(cfg.weaponSkinIdx);
    }
  }, [cfg.weaponSkinIdx]);

  const set = (key) => (v) => setCfg((c) => ({ ...c, [key]: v }));
  const setBodyType = (bodyType) => setCfg((c) => normalizeCharacterConfig({ ...c, bodyType }));

  const currentWeapon = window.Weapons.list[cfg.weaponIdx] || window.Weapons.list[0];
  const hairStyleOptions = useMemo(() => hairStyleOptionsForBody(cfg.bodyType || 'male'), [cfg.bodyType]);
  const selectedHairStyleOptionIdx = Math.max(0, hairStyleOptions.findIndex((style) => style.idx === cfg.hairStyleIdx));
  
  // Headwear: index 0 is "None", indices 1+ are actual hats
  const headwearOn = (cfg.hatIdx || 0) > 0;
  const headwearHats = (window.Palette.hat || []).slice(1); // All except "None"
  const selectedHeadwearIdx = Math.max(0, Math.min((cfg.hatIdx || 1) - 1, headwearHats.length - 1));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-dot" />
          <div className="brand-text">
            <div className="brand-title">SQUADRON DEV PART</div>
          </div>
        </div>
      </header>

      <div className="main">
        {/* Left: weapons and skins */}
        <aside className="panel panel-left">
          <div className="panel-title">WEAPON SKIN</div>
          <WeaponSkinPicker
            value={cfg.weaponSkinIdx}
            onChange={set('weaponSkinIdx')}
          />

          <div className="panel-title" style={{marginTop: 16}}>WEAPON</div>
          <WeaponPicker
            list={window.Weapons.list}
            byType={window.Weapons.byType}
            selectedIdx={cfg.weaponIdx}
            onPick={set('weaponIdx')}
          />
        </aside>

        {/* Center: main preview + animations */}
        <main className="stage-wrap">
          <div className="center-controls">
            <button onClick={() => setBgMode('light')} className={bgMode === 'light' ? 'on' : ''} title="Light background">light</button>
            <button onClick={() => setBgMode('grid')} className={bgMode === 'grid' ? 'on' : ''} title="Grid background">grid</button>
            <button onClick={() => setBgMode('dark')} className={bgMode === 'dark' ? 'on' : ''} title="Dark background">dark</button>
            <span style={{ marginLeft: 'auto' }} />
            <button onClick={() => setFacing(f => -f)} title="Flip facing">⇄</button>
            <button onClick={() => setScale(s => Math.max(1, s - 1))} title="Zoom out">−</button>
            <button onClick={() => setScale(s => Math.min(8, s + 1))} title="Zoom in">+</button>
            <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: '8px' }}>{STAGE_W} × {STAGE_H} px · ×{scale}</span>
          </div>

          <div className={'stage bg-' + bgMode}>
            <div className="stage-inner">
              <AnimPreview cfg={cfg} animKey={animKey} scale={scale} facing={facing} running={true} />
            </div>
          </div>

          <div className="anims-section">
            <div className="anims-section-label">ANIMATIONS</div>
            <div className="anim-grid">
              {window.AnimList.map((k) => (
                <button
                  key={k}
                  className={'anim-card' + (animKey === k ? ' selected' : '')}
                  onClick={() => setAnimKey(k)}
                >
                  <div className="anim-preview-wrap">
                    <AnimPreview cfg={cfg} animKey={k} scale={0.35} facing={1} />
                  </div>
                  <div className="anim-label">{window.Anims[k].name}</div>
                  <div className="anim-meta">{window.Anims[k].frames}f</div>
                  <div className="anim-frames-tooltip">
                    {(() => {
                      const anim = window.Anims[k];
                      const frames = [];
                      for (let i = 0; i < anim.frames; i++) frames.push(i);
                      return frames.map(i => <div key={i} className="anim-frames-item">{String(i).padStart(2, '0')}</div>);
                    })()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>

        {/* Right: customization */}
        <aside className="panel panel-right">
          <div className="panel-title">CHARACTER</div>

          <Section title="Body">
            <Chips
              options={BODY_TYPES}
              selectedIdx={Math.max(0, BODY_TYPES.findIndex((t) => t.value === (cfg.bodyType || 'male')))}
              onPick={(i) => setBodyType(BODY_TYPES[i].value)}
            />
          </Section>

          <Section title="Skin">
            <ColorSwatches options={window.Palette.skin} selectedIdx={cfg.skinIdx} onPick={set('skinIdx')} field="base" />
          </Section>

          <Section title="Hair Style">
            <Chips
              options={hairStyleOptions}
              selectedIdx={selectedHairStyleOptionIdx}
              onPick={(i) => set('hairStyleIdx')(hairStyleOptions[i].idx)}
            />
          </Section>

          <Section title="Hair Color">
            <ColorSwatches options={window.Palette.hair} selectedIdx={cfg.hairIdx} onPick={set('hairIdx')} field="base" />
          </Section>

          <Section title={<>Headwear <Toggle on={headwearOn} onChange={(on) => set('hatIdx')(on ? 1 : 0)} label="" /></>}>
            {headwearOn && <Chips options={headwearHats} selectedIdx={selectedHeadwearIdx} onPick={(i) => set('hatIdx')(i + 1)} />}
          </Section>

          <Section title="Eyes">
            <ColorSwatches options={window.Palette.eye} selectedIdx={cfg.eyeIdx} onPick={set('eyeIdx')} field="base" />
          </Section>

          <Section title="Uniform Color">
            <ColorSwatches options={window.Palette.uniforms} selectedIdx={cfg.uniformIdx} onPick={set('uniformIdx')} field="base" />
          </Section>

          <Section title={<>Vest <Toggle on={cfg.vestOn} onChange={set('vestOn')} label="" /></>}>
          </Section>

          <Section title={<>Backpack <Toggle on={cfg.backpackOn} onChange={set('backpackOn')} label="" /></>}>
          </Section>
        </aside>
      </div>
    </div>
  );
}


// Strip of individual frames for current animation
function FrameStrip({ cfg, animKey, facing }) {
  const anim = window.Anims[animKey];
  const frames = [];
  for (let i = 0; i < anim.frames; i++) frames.push(i);
  return (
    <div className="frame-strip">
      <div className="frame-strip-label">FRAMES</div>
      <div className="frame-strip-inner">
        {frames.map((i) => (
          <div key={i} className="frame-cell">
            <SpriteCanvas cfg={cfg} animKey={animKey} frame={i} scale={2} facing={facing} />
            <div className="frame-idx">{String(i).padStart(2, '0')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Grid of all animations playing in parallel
function AllAnimsRow({ cfg, facing }) {
  return (
    <div className="all-anims">
      <div className="all-anims-label">ALL ANIMATIONS · LIVE</div>
      <div className="all-anims-grid">
        {window.AnimList.map((k) => (
          <div key={k} className="all-anim-cell">
            <div className="all-anim-preview">
              <AnimPreview cfg={cfg} animKey={k} scale={2} facing={facing} running={true} />
            </div>
            <div className="all-anim-name">{window.Anims[k].name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- WeaponIcon ----------------
// Renders a weapon thumbnail by cropping the sprite sheet directly. We pad the
// canvas a few px around the weapon so the silhouette never gets clipped on
// long snipers or weapons with bipods.
function WeaponIcon({ weapon, scale = 1 }) {
  const ref = useRef();
  const sheetVersion = useSheetReady();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    const offX = Math.floor((c.width - weapon.width) / 2);
    const offY = Math.floor((c.height - weapon.height) / 2);
    ctx.save();
    ctx.translate(offX + weapon.gripX, offY + weapon.gripY);
    weapon.draw(ctx, 0, 0, false);
    ctx.restore();
  }, [weapon, scale, sheetVersion]);

  // Each thumbnail canvas is sized to comfortably hold the weapon (max width
  // 120, max height 32 from the sprite sheet) with a couple of pixels of padding.
  const w = Math.max(weapon.width + 4, 40);
  const h = Math.max(weapon.height + 4, 18);
  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      style={{
        width: w * scale,
        height: h * scale,
        imageRendering: 'pixelated',
        display: 'block'
      }}
    />
  );
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function WeaponGameIcon({ weapon }) {
  const type = weapon.type || 'rifle';
  const seed = hashString(`${weapon.id || ''}|${weapon.name || ''}|${type}`);
  const serialMatch = String(weapon.id || '').match(/(\d+)$/);
  const serial = serialMatch ? parseInt(serialMatch[1], 10) : (seed % 31) + 1;
  const black = '#101014';
  const outline = '#efe6d0';
  const redDark = '#78111a';
  const stripe = '#d9c8a8';
  const variant = serial % 6;
  const hasOptic = (seed & 1) !== 0;
  const hasLongBarrel = (seed & 2) !== 0;
  const hasStock = type !== 'pistol' && (seed & 4) !== 0;
  const shape = {
    fill: black,
    stroke: outline,
    strokeWidth: 1.25,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };

  const bgAccent = (() => {
    if (variant === 0) {
      return (
        <>
          <path d="M5 28h4l6-6h-4z" fill={stripe} opacity="0.9" />
          <path d="M13 28h4l6-6h-4z" fill={stripe} opacity="0.9" />
          <path d="M21 28h4l4-4v4z" fill={stripe} opacity="0.9" />
        </>
      );
    }
    if (variant === 1) {
      return (
        <>
          <path d="M27 5v5l-5 5v-5z" fill={stripe} opacity="0.88" />
          <path d="M27 15v5l-5 5v-5z" fill={stripe} opacity="0.88" />
        </>
      );
    }
    if (variant === 2) {
      return (
        <>
          <path d="M3 6l3-3 23 23-3 3z" fill={redDark} opacity="0.95" />
          <path d="M26 3l3 3L6 29H3z" fill={redDark} opacity="0.95" />
        </>
      );
    }
    if (variant === 3) {
      return (
        <>
          <path d="M3 24h26v5H3z" fill={stripe} opacity="0.82" />
          <path d="M7 24l-4 5M15 24l-4 5M23 24l-4 5" stroke={redDark} strokeWidth="1.4" />
        </>
      );
    }
    if (variant === 4) {
      return (
        <>
          <path d="M3 3h10L3 13z" fill={stripe} opacity="0.8" />
          <path d="M29 29H19l10-10z" fill={stripe} opacity="0.8" />
        </>
      );
    }
    return (
      <>
        <path d="M4 5h24v4H4z" fill={redDark} opacity="0.9" />
        <path d="M8 5l-4 4M16 5l-4 4M24 5l-4 4" stroke={stripe} strokeWidth="1.2" opacity="0.9" />
      </>
    );
  })();

  const glyph = (() => {
    if (type === 'pistol') {
      return (
        <>
          <rect {...shape} x="7" y="13" width={hasLongBarrel ? 15 : 12} height="4" rx="1" />
          <rect {...shape} x={hasLongBarrel ? 21 : 18} y="14" width="3" height="1.8" rx="0.5" />
          <path {...shape} d="M11 17h5l2 7h-4z" />
          {variant > 2 ? <rect {...shape} x="8" y="10" width="5" height="2" rx="0.6" /> : null}
        </>
      );
    }
    if (type === 'smg') {
      return (
        <>
          {hasStock ? <path {...shape} d="M4 15l5-4v6l-5 3z" /> : null}
          <rect {...shape} x="8" y="13" width={variant % 2 ? 14 : 12} height="5" rx="1" />
          <rect {...shape} x={variant % 2 ? 21 : 19} y="14.2" width={hasLongBarrel ? 5 : 3} height="1.8" rx="0.5" />
          <path {...shape} d={variant > 2 ? 'M12 18h4l1 7h-4z' : 'M13 18h3v6h-3z'} />
          {hasOptic ? <rect {...shape} x="10" y="9" width="6" height="2" rx="0.7" /> : null}
        </>
      );
    }
    if (type === 'shotgun') {
      return (
        <>
          <path {...shape} d="M3 16l6-5v6l-6 4z" />
          <rect {...shape} x="8" y="13" width={hasLongBarrel ? 18 : 15} height="3" rx="1" />
          <rect {...shape} x="9" y="17" width={variant === 3 ? 10 : 7} height="2" rx="0.7" />
          {hasOptic ? <rect {...shape} x="14" y="10" width="5" height="2" rx="0.7" /> : null}
        </>
      );
    }
    if (type === 'sniper') {
      return (
        <>
          <path {...shape} d="M3 16l6-5v5l-6 4z" />
          <rect {...shape} x="8" y="14" width="18" height="2.4" rx="1" />
          <rect {...shape} x="10" y="10.5" width={variant > 2 ? 10 : 8} height="2.3" rx="0.9" />
          <rect {...shape} x="23" y="13.4" width="5" height="1.2" rx="0.5" />
          {hasStock ? <rect {...shape} x="14" y="17" width="2" height="5" rx="0.5" /> : null}
        </>
      );
    }
    if (type === 'heavy') {
      return (
        <>
          <path {...shape} d="M4 12h16l6 4-6 4H4z" />
          <rect {...shape} x="7" y="20" width={variant > 2 ? 10 : 7} height="3" rx="1" />
          {hasOptic ? <rect {...shape} x="8" y="8" width="8" height="2" rx="0.7" /> : null}
          {hasLongBarrel ? <circle cx="20" cy="16" r="2" fill={redDark} stroke={outline} strokeWidth="1.2" /> : null}
        </>
      );
    }
    return (
      <>
        {hasStock ? <path {...shape} d="M3 15l6-4v6l-6 4z" /> : null}
        <rect {...shape} x="8" y="13" width={variant % 2 ? 15 : 13} height="4.5" rx="1" />
        <rect {...shape} x={variant % 2 ? 22 : 20} y="14.3" width={hasLongBarrel ? 5 : 3} height="1.8" rx="0.5" />
        <path {...shape} d={variant > 2 ? 'M11 18h5l2 6h-5z' : 'M12 18h4v5h-4z'} />
        {hasOptic ? <rect {...shape} x="10" y="9.5" width="7" height="2.2" rx="0.8" /> : null}
      </>
    );
  })();

  return (
    <span className="game-icon weapon-game-icon" title={`${weapon.name} icon`} aria-hidden="true">
      <svg viewBox="0 0 32 32" focusable="false">
        <rect x="1" y="1" width="30" height="30" rx="2" fill="#111116" />
        <rect x="3" y="3" width="26" height="26" rx="1" fill="#c91f2b" />
        <path d="M3 3h26v6c-6-1.8-13.2-1-26 2.5z" fill="#ef3b3f" opacity="0.45" />
        {bgAccent}
        <g transform="rotate(-6 16 16)">{glyph}</g>
      </svg>
    </span>
  );
}

// ---------------- WeaponPicker ----------------
// Categorised list — Pistol / SMG / Rifle / Shotgun / Sniper / Heavy. Each
// weapon shows its sprite-sheet thumbnail plus its name. Rendering is cheap
// because canvases just blit from the active sheet.
const TYPE_ORDER = ['pistol', 'smg', 'shotgun', 'rifle', 'sniper', 'heavy'];
const TYPE_LABELS = {
  pistol:  'Pistols',
  smg:     'SMGs',
  shotgun: 'Shotguns',
  rifle:   'Rifles',
  sniper:  'Snipers',
  heavy:   'Heavy'
};

function WeaponPicker({ list, byType, selectedIdx, onPick }) {
  // Map weapon -> list index for stable keys / clicks.
  const idxOf = useMemo(() => {
    const m = new Map();
    list.forEach((w, i) => m.set(w, i));
    return m;
  }, [list]);

  return (
    <div className="weapon-picker">
      {TYPE_ORDER.map((t) => {
        const items = byType[t] || [];
        if (!items.length) return null;
        return (
          <div key={t} className="weapon-group">
            <div className="weapon-group-title">{TYPE_LABELS[t]} <span className="weapon-group-count">{items.length}</span></div>
            <div className="weapon-grid">
              {items.map((w) => {
                const i = idxOf.get(w);
                return (
                  <button
                    key={i}
                    className={'weapon-card' + (selectedIdx === i ? ' selected' : '')}
                    onClick={() => onPick(i)}
                    title={w.name}
                  >
                    <div className="weapon-card-main">
                      <WeaponIcon weapon={w} />
                      <div className="weapon-name">{w.name}</div>
                    </div>
                    <WeaponGameIcon weapon={w} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- WeaponSkinPicker ----------------
// 34 skins (0..33). We render each one as a tiny number chip and show a live
// preview of the currently-selected skin using the active weapon.
function WeaponSkinPicker({ value, onChange }) {
  const NUM = (window.Weapons && window.Weapons.NUM_SKINS) || 34;
  return (
    <div className="skin-picker">
      <div className="skin-grid">
        {Array.from({ length: NUM }, (_, i) => (
          <button
            key={i}
            className={'skin-chip' + (value === i ? ' selected' : '')}
            onClick={() => onChange(i)}
            title={`Skin ${i}`}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
