// Main React app — UI showcase for custom 2D characters.

const { useState, useEffect, useRef, useMemo, useCallback } = React;
const __I18n = window.I18n;
const __t = __I18n.t;

// Default rifle index in the new sheet-driven list. The list order is
// [smg×11, rifle×10, heavy×14, shotgun×8, sniper×10, pistol×8, melee×1]
// — index 11 is the first rifle (RIFLE-01), index 61 is Main nue.
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

function getBodyTypes() {
  return [
    { name: __t('dev.male'), value: 'male' },
    { name: __t('dev.female'), value: 'female' },
  ];
}

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

function SpriteCanvas({ cfg, animKey, frame, scale, facing, w = STAGE_W, h = STAGE_H, animState }) {
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
      smooth: true,
      animState
    });
  }, [cfg, animKey, frame, facing, w, h, scale, sheetVersion, animState]);

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
function App({ onSwitchMode }) {
  __I18n.useI18n();
  const BODY_TYPES = getBodyTypes();
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
  const [, forceUpdate] = useState(0);

  // Sync weapon names from weapon-config.json (source of truth) into window.Weapons.list
  useEffect(() => {
    fetch('./weapon-config.json?ts=' + Date.now(), { cache: 'no-store' })
      .then(r => r.json())
      .then(config => {
        const metaById = {};
        const statsList = window.Weapons && window.Weapons.expandWeaponStats
          ? window.Weapons.expandWeaponStats(config)
          : (config.weapons || []);
        for (const w of statsList) metaById[w.id] = w;
        for (const w of window.Weapons.list) {
          const meta = metaById[w.id];
          if (!meta) continue;
          w.name = meta.name;
          w.aliases = Array.isArray(meta.aliases) ? meta.aliases.slice() : [];
        }
        if (window.Weapons && window.Weapons.rebuildLookup) window.Weapons.rebuildLookup();
        forceUpdate(n => n + 1);
      })
      .catch(err => console.error('[app] failed to sync weapon names:', err));
  }, []);

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
  const currentBaseWeapon = window.Weapons.getBaseWeapon ? (window.Weapons.getBaseWeapon(currentWeapon) || currentWeapon) : currentWeapon;
  const currentMkLevel = Math.max(0, currentWeapon && currentWeapon.mkLevel || 0);
  const selectedBaseIdx = Math.max(0, window.Weapons.list.indexOf(currentBaseWeapon));
  const setWeaponByObject = (weapon) => {
    const idx = window.Weapons.list.indexOf(weapon);
    if (idx >= 0) set('weaponIdx')(idx);
  };
  const setWeaponBaseIdx = (idx) => {
    const base = window.Weapons.list[idx] || window.Weapons.list[0];
    const variant = window.Weapons.getVariant
      ? (window.Weapons.getVariant(base, currentMkLevel) || window.Weapons.getVariant(base, 0) || base)
      : base;
    setWeaponByObject(variant);
  };
  const setWeaponMkLevel = (mkLevel) => {
    const variant = window.Weapons.getVariant
      ? (window.Weapons.getVariant(currentBaseWeapon, mkLevel) || currentBaseWeapon)
      : currentBaseWeapon;
    setWeaponByObject(variant);
  };
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
          <img className="brand-dot" src="assets/images/icons/favicon.png" alt="Squadron" />
          <div className="brand-text">
            <div className="brand-title">{__t('brand.devTitle')}</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="mode-toggle"
            onClick={() => onSwitchMode && onSwitchMode('prod')}
            title={__t('brand.prodModeTip')}
          >
            {__t('brand.prodModeBtn')}
          </button>
        </div>
      </header>

      <div className="main">
        {/* Left: weapons and skins */}
        <aside className="panel panel-left">
          <div className="panel-title">{__t('dev.weaponSkin')}</div>
          <WeaponSkinPicker
            value={cfg.weaponSkinIdx}
            onChange={set('weaponSkinIdx')}
          />

          <div className="panel-title" style={{marginTop: 16}}>{__t('dev.weaponLevel')}</div>
          <WeaponLevelPicker
            baseWeapon={currentBaseWeapon}
            value={currentMkLevel}
            onChange={setWeaponMkLevel}
          />

          <div className="panel-title" style={{marginTop: 16}}>{__t('dev.weapon')}</div>
          <WeaponPicker
            list={window.Weapons.list}
            byType={window.Weapons.baseByType || window.Weapons.byType}
            selectedIdx={cfg.weaponIdx}
            selectedBaseIdx={selectedBaseIdx}
            onPick={setWeaponBaseIdx}
          />
        </aside>

        {/* Center: main preview + animations */}
        <main className="stage-wrap">
          <div className="center-controls">
            <button onClick={() => setBgMode('light')} className={bgMode === 'light' ? 'on' : ''} title={__t('dev.lightTip')}>{__t('dev.light')}</button>
            <button onClick={() => setBgMode('grid')} className={bgMode === 'grid' ? 'on' : ''} title={__t('dev.gridTip')}>{__t('dev.grid')}</button>
            <button onClick={() => setBgMode('dark')} className={bgMode === 'dark' ? 'on' : ''} title={__t('dev.darkTip')}>{__t('dev.dark')}</button>
            <span style={{ marginLeft: 'auto' }} />
            <button onClick={() => setFacing(f => -f)} title={__t('dev.flipTip')}>⇄</button>
            <button onClick={() => setScale(s => Math.max(1, s - 1))} title={__t('dev.zoomOut')}>−</button>
            <button onClick={() => setScale(s => Math.min(8, s + 1))} title={__t('dev.zoomIn')}>+</button>
            <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: '8px' }}>{STAGE_W} × {STAGE_H} px · ×{scale}</span>
          </div>

          <div className={'stage bg-' + bgMode}>
            <div className="stage-inner">
              <AnimPreview cfg={cfg} animKey={animKey} scale={scale} facing={facing} running={true} />
            </div>
          </div>

          <div className="anims-section">
            <div className="anims-section-label">{__t('dev.animations')}</div>
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
          <div className="panel-title">{__t('dev.character')}</div>

          <Section title={__t('dev.body')}>
            <Chips
              options={BODY_TYPES}
              selectedIdx={Math.max(0, BODY_TYPES.findIndex((bt) => bt.value === (cfg.bodyType || 'male')))}
              onPick={(i) => setBodyType(BODY_TYPES[i].value)}
            />
          </Section>

          <Section title={__t('dev.skin')}>
            <ColorSwatches options={window.Palette.skin} selectedIdx={cfg.skinIdx} onPick={set('skinIdx')} field="base" />
          </Section>

          <Section title={__t('dev.hairStyle')}>
            <Chips
              options={hairStyleOptions}
              selectedIdx={selectedHairStyleOptionIdx}
              onPick={(i) => set('hairStyleIdx')(hairStyleOptions[i].idx)}
            />
          </Section>

          <Section title={__t('dev.hairColor')}>
            <ColorSwatches options={window.Palette.hair} selectedIdx={cfg.hairIdx} onPick={set('hairIdx')} field="base" />
          </Section>

          <Section title={<>{__t('dev.headwear')} <Toggle on={headwearOn} onChange={(on) => set('hatIdx')(on ? 1 : 0)} label="" /></>}>
            {headwearOn && <Chips options={headwearHats} selectedIdx={selectedHeadwearIdx} onPick={(i) => set('hatIdx')(i + 1)} />}
          </Section>

          <Section title={__t('dev.eyes')}>
            <ColorSwatches options={window.Palette.eye} selectedIdx={cfg.eyeIdx} onPick={set('eyeIdx')} field="base" />
          </Section>

          <Section title={__t('dev.uniformColor')}>
            <ColorSwatches options={window.Palette.uniforms} selectedIdx={cfg.uniformIdx} onPick={set('uniformIdx')} field="base" />
          </Section>

          <Section title={<>{__t('dev.vest')} <Toggle on={cfg.vestOn} onChange={set('vestOn')} label="" /></>}>
          </Section>

          <Section title={<>{__t('dev.backpack')} <Toggle on={cfg.backpackOn} onChange={set('backpackOn')} label="" /></>}>
          </Section>
        </aside>
      </div>
    </div>
  );
}


// Strip of individual frames for current animation
function FrameStrip({ cfg, animKey, facing }) {
  __I18n.useI18n();
  const anim = window.Anims[animKey];
  const frames = [];
  for (let i = 0; i < anim.frames; i++) frames.push(i);
  return (
    <div className="frame-strip">
      <div className="frame-strip-label">{__t('dev.frames')}</div>
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
  __I18n.useI18n();
  return (
    <div className="all-anims">
      <div className="all-anims-label">{__t('dev.allAnims')}</div>
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

function WeaponGameIcon({ weapon }) {
  const ref = useRef();
  const sheetVersion = useSheetReady();

  useEffect(() => {
    const c = ref.current;
    if (!c || !weapon) return;
    const ctx = c.getContext('2d');
    const size = c.width;
    // 1 unit = 1 logical pixel relative to the legacy 32px design.
    const k = size / 32;

    function drawBackground() {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#101014';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#c91f2b';
      ctx.fillRect(2 * k, 2 * k, size - 4 * k, size - 4 * k);
      ctx.fillStyle = '#e3363b';
      ctx.fillRect(4 * k, 4 * k, size - 8 * k, 5 * k);
    }

    function drawFallback() {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6 * k, 14 * k, 20 * k, 5 * k);
      ctx.fillRect(10 * k, 19 * k, 5 * k, 7 * k);
      ctx.fillStyle = '#101014';
      ctx.fillRect(7 * k, 15 * k, 18 * k, 3 * k);
      ctx.fillRect(11 * k, 18 * k, 3 * k, 6 * k);
    }

    function strokeStar(cx, cy, rOuter) {
      const rInner = rOuter * 0.45;
      const spikes = 5;
      const step = Math.PI / spikes;
      let rot = -Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rot) * rOuter, cy + Math.sin(rot) * rOuter);
      for (let i = 0; i < spikes; i++) {
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * rInner, cy + Math.sin(rot) * rInner);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * rOuter, cy + Math.sin(rot) * rOuter);
      }
      ctx.closePath();
    }

    function drawBaseBadge() {
      // Tier-0 indicator: a small muted dash centered where the stars would sit.
      const rOuter = 3.1 * k;
      const cy = size - rOuter - 3.2 * k;
      const w = 7 * k;
      const h = 1.6 * k;
      const x = (size - w) / 2;
      const y = cy - h / 2;
      const r = h / 2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(x + r, y + h);
      ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, 1 * k);
      ctx.strokeStyle = '#101014';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 220, 170, 0.78)';
      ctx.fill();
      ctx.restore();
    }

    function drawMkStars() {
      const count = Math.max(0, Math.min(2, weapon.mkLevel || 0));
      if (!count) {
        drawBaseBadge();
        return;
      }
      const rOuter = 3.1 * k;
      const gap = 1.8 * k;
      const totalW = count * (rOuter * 2) + (count - 1) * gap;
      const startX = (size - totalW) / 2 + rOuter;
      // Pushed upward (was size - 7) so the stars sit clearly inside the panel.
      const cy = size - rOuter - 3.2 * k;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, 1.6 * k);
      for (let i = 0; i < count; i++) {
        const cx = startX + i * (rOuter * 2 + gap);
        strokeStar(cx, cy, rOuter);
        ctx.strokeStyle = '#101014';
        ctx.stroke();
        ctx.fillStyle = '#ffd65a';
        ctx.fill();
        // Soft inner highlight for a subtle 3D feel.
        const grad = ctx.createRadialGradient(cx - rOuter * 0.3, cy - rOuter * 0.3, 0, cx, cy, rOuter);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
        grad.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.restore();
    }

    drawBackground();

    const pad = 6;
    const src = document.createElement('canvas');
    src.width = Math.max(1, Math.ceil(weapon.width + pad * 2));
    src.height = Math.max(1, Math.ceil(weapon.height + pad * 2));
    const sctx = src.getContext('2d');
    sctx.imageSmoothingEnabled = false;
    sctx.clearRect(0, 0, src.width, src.height);

    try {
      weapon.draw(sctx, pad + weapon.gripX, pad + weapon.gripY, false);

      const srcData = sctx.getImageData(0, 0, src.width, src.height).data;
      let minX = src.width, minY = src.height, maxX = -1, maxY = -1;
      for (let y = 0; y < src.height; y++) {
        for (let x = 0; x < src.width; x++) {
          if (srcData[(y * src.width + x) * 4 + 3] > 16) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX < minX || maxY < minY) {
        drawFallback();
        drawMkStars();
        return;
      }

      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const angle = -Math.PI / 12;
      const cos = Math.abs(Math.cos(angle));
      const sin = Math.abs(Math.sin(angle));
      // Target footprint expressed in real canvas pixels.
      const maxW = (weapon.type === 'sniper' ? 23 : 22) * k;
      const maxH = (weapon.type === 'heavy' ? 18 : 17) * k;
      const rotW = cropW * cos + cropH * sin;
      const rotH = cropW * sin + cropH * cos;
      const scaleFit = Math.min(maxW / cropW, maxH / cropH);
      const rotScaleFit = Math.min(maxW / rotW, maxH / rotH);
      const finalScale = Math.min(scaleFit, rotScaleFit);
      const drawW = Math.max(8 * k, cropW * finalScale);
      const drawH = Math.max(5 * k, cropH * finalScale);

      // High-res mask of the rotated, smoothly-scaled weapon. We keep the
      // alpha gradient (no binary threshold) for an HD look at large sizes.
      const mask = document.createElement('canvas');
      const maskPad = Math.ceil(5 * k);
      mask.width = Math.ceil(drawW) + maskPad * 2;
      mask.height = Math.ceil(drawH) + maskPad * 2;
      const mctx = mask.getContext('2d');
      mctx.imageSmoothingEnabled = true;
      mctx.imageSmoothingQuality = 'high';
      mctx.translate(mask.width / 2, mask.height / 2);
      mctx.rotate(angle);
      mctx.drawImage(src, minX, minY, cropW, cropH, -drawW / 2, -drawH / 2, drawW, drawH);

      // Compute the visible bbox so we can center the silhouette.
      const maskData = mctx.getImageData(0, 0, mask.width, mask.height).data;
      let sMinX = mask.width, sMinY = mask.height, sMaxX = -1, sMaxY = -1;
      for (let i = 0; i < mask.width * mask.height; i++) {
        if (maskData[i * 4 + 3] > 20) {
          const x = i % mask.width;
          const y = (i / mask.width) | 0;
          if (x < sMinX) sMinX = x;
          if (y < sMinY) sMinY = y;
          if (x > sMaxX) sMaxX = x;
          if (y > sMaxY) sMaxY = y;
        }
      }
      if (sMaxX < sMinX || sMaxY < sMinY) {
        drawFallback();
        drawMkStars();
        return;
      }
      const solidW = sMaxX - sMinX + 1;
      const solidH = sMaxY - sMinY + 1;
      // Leave a bottom band for the stars; center weapon in the usable area.
      const bottomReserve = 7 * k;
      const dx = Math.round((size - solidW) / 2) - sMinX;
      const dy = Math.round((size - bottomReserve - solidH) / 2) - sMinY;

      // White outline: stamp a recolored copy of the mask in a small disc around
      // the silhouette. Smooth alpha + slight feather → crisp HD edge.
      const outline = document.createElement('canvas');
      outline.width = mask.width;
      outline.height = mask.height;
      const octx = outline.getContext('2d');
      octx.drawImage(mask, 0, 0);
      octx.globalCompositeOperation = 'source-in';
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, outline.width, outline.height);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const outlineRadius = Math.max(1, Math.round(1.7 * k));
      for (let oy = -outlineRadius; oy <= outlineRadius; oy++) {
        for (let ox = -outlineRadius; ox <= outlineRadius; ox++) {
          if (ox * ox + oy * oy > outlineRadius * outlineRadius) continue;
          ctx.drawImage(outline, dx + ox, dy + oy);
        }
      }

      // Dark silhouette on top, in full smooth alpha (no chunky pixel art).
      const fill = document.createElement('canvas');
      fill.width = mask.width;
      fill.height = mask.height;
      const fctx = fill.getContext('2d');
      fctx.drawImage(mask, 0, 0);
      fctx.globalCompositeOperation = 'source-in';
      fctx.fillStyle = '#101014';
      fctx.fillRect(0, 0, fill.width, fill.height);
      ctx.drawImage(fill, dx, dy);
    } catch (e) {
      drawFallback();
    }
    drawMkStars();
  }, [weapon, sheetVersion]);

  return (
    <span className="game-icon weapon-game-icon" title={`${__I18n.localizedWeaponName(weapon)} icon`} aria-hidden="true">
      <canvas ref={ref} width="96" height="96" />
    </span>
  );
}

// ---------------- WeaponPicker ----------------
// Categorised list — Pistol / SMG / Rifle / Shotgun / Sniper / Heavy. Each
// weapon shows its sprite-sheet thumbnail plus its name. Rendering is cheap
// because canvases just blit from the active sheet.
const TYPE_ORDER = ['melee', 'pistol', 'smg', 'shotgun', 'rifle', 'sniper', 'heavy'];

function WeaponLevelPicker({ baseWeapon, value, onChange }) {
  __I18n.useI18n();
  const levels = [
    { label: __t('dev.weaponBase'), value: 0 },
    { label: __t('dev.mk1'), value: 1 },
    { label: __t('dev.mk2'), value: 2 }
  ];
  return (
    <div className="weapon-level-picker" role="group" aria-label={__t('dev.weaponLevelAria')}>
      {levels.map(level => {
        const variant = level.value === 0
          ? baseWeapon
          : (window.Weapons.getVariant ? window.Weapons.getVariant(baseWeapon, level.value) : null);
        const disabled = !variant;
        return (
          <button
            key={level.value}
            type="button"
            className={'weapon-level-chip' + (value === level.value ? ' selected' : '')}
            onClick={() => !disabled && onChange(level.value)}
            disabled={disabled}
            title={disabled ? __t('dev.noVariant') : level.label}
          >
            {level.label}
          </button>
        );
      })}
    </div>
  );
}

function WeaponPicker({ list, byType, selectedIdx, selectedBaseIdx, onPick }) {
  __I18n.useI18n();
  // Map weapon -> list index for stable keys / clicks.
  const idxOf = useMemo(() => {
    const m = new Map();
    list.forEach((w, i) => m.set(w, i));
    return m;
  }, [list]);
  const activeIdx = selectedBaseIdx == null ? selectedIdx : selectedBaseIdx;

  return (
    <div className="weapon-picker">
      {TYPE_ORDER.map((typeKey) => {
        const items = byType[typeKey] || [];
        if (!items.length) return null;
        return (
          <div key={typeKey} className="weapon-group">
            <div className="weapon-group-title">{__t('wt.' + typeKey)} <span className="weapon-group-count">{items.length}</span></div>
            <div className="weapon-grid">
              {items.map((w) => {
                const i = idxOf.get(w);
                const displayName = __I18n.localizedWeaponName(w);
                return (
                  <button
                    key={i}
                    className={'weapon-card' + (activeIdx === i ? ' selected' : '')}
                    onClick={() => onPick(i)}
                    title={displayName}
                  >
                    <div className="weapon-card-main">
                      <WeaponIcon weapon={w} />
                      <div className="weapon-name">{displayName}</div>
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
  __I18n.useI18n();
  const NUM = (window.Weapons && window.Weapons.NUM_SKINS) || 34;
  return (
    <div className="skin-picker">
      <div className="skin-grid">
        {Array.from({ length: NUM }, (_, i) => (
          <button
            key={i}
            className={'skin-chip' + (value === i ? ' selected' : '')}
            onClick={() => onChange(i)}
            title={__t('dev.skinTip', { n: i })}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

// Expose UI helpers used by game.jsx (Babel-standalone scripts don't share top-level scope).
window.SquadronUI = {
  App,
  SpriteCanvas,
  AnimPreview,
  WeaponGameIcon,
  WeaponIcon,
  DEFAULT_CFG,
  STAGE_W,
  STAGE_H,
  normalizeCharacterConfig,
  hairStyleOptionsForBody
};

// Mount is performed in root.jsx so it can switch between editor (Dev) and game (Prod).
