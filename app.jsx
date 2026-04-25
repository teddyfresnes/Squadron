// Main React app — UI showcase for custom 2D characters.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Default rifle index in the new sheet-driven list. The list order is
// [smg×11, rifle×10, heavy×14, shotgun×8, sniper×10, pistol×8] — index 11 is
// the first rifle (RIFLE-01).
const DEFAULT_WEAPON_IDX = 11;

const DEFAULT_CFG = {
  skinIdx: 0,
  hairIdx: 1,
  hairStyleIdx: 2,  // Messy
  eyeIdx: 1,
  uniformIdx: 0,
  pantsIdx: 0,
  vestOn: true,
  vestIdx: 0,
  backpackOn: false,
  backpackIdx: 1,
  hatIdx: 4,  // Combat Helmet
  weaponIdx: DEFAULT_WEAPON_IDX,
  weaponSkinIdx: 33  // sheet 33.png — default texture style
};

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
      <div className="section-body">{children}</div>
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
      if (saved) return { ...DEFAULT_CFG, ...JSON.parse(saved) };
    } catch (e) {}
    return DEFAULT_CFG;
  });
  const [animKey, setAnimKey] = useState(() => localStorage.getItem('char-anim') || 'idle');
  const [facing, setFacing] = useState(1);
  const [bgMode, setBgMode] = useState('grid');
  const [showAll, setShowAll] = useState(false);
  const [scale, setScale] = useState(SCALE);

  useEffect(() => { localStorage.setItem('char-cfg', JSON.stringify(cfg)); }, [cfg]);
  useEffect(() => { localStorage.setItem('char-anim', animKey); }, [animKey]);

  // Push the active weapon skin into the Weapons module whenever it changes.
  useEffect(() => {
    if (window.Weapons && typeof window.Weapons.setSkinIdx === 'function') {
      window.Weapons.setSkinIdx(cfg.weaponSkinIdx);
    }
  }, [cfg.weaponSkinIdx]);

  const set = (key) => (v) => setCfg((c) => ({ ...c, [key]: v }));

  const currentWeapon = window.Weapons.list[cfg.weaponIdx] || window.Weapons.list[0];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-dot" />
          <div className="brand-text">
            <div className="brand-title">SPRITE.FORGE</div>
            <div className="brand-sub">32×32 character system · side profile · minitroopers-inspired</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="pill">{currentWeapon.name}</div>
          <div className="pill">{window.Anims[animKey].name}</div>
          <div className="pill">{window.Anims[animKey].frames}f @ {window.Anims[animKey].fps}fps</div>
        </div>
      </header>

      <div className="main">
        {/* Left: animation list */}
        <aside className="panel panel-left">
          <div className="panel-title">ANIMATIONS</div>
          <div className="anim-grid">
            {window.AnimList.map((k) => (
              <button
                key={k}
                className={'anim-card' + (animKey === k ? ' selected' : '')}
                onClick={() => setAnimKey(k)}
              >
                <div className="anim-preview-wrap">
                  <AnimPreview cfg={cfg} animKey={k} scale={1} facing={1} />
                </div>
                <div className="anim-label">{window.Anims[k].name}</div>
                <div className="anim-meta">{window.Anims[k].frames}f</div>
              </button>
            ))}
          </div>

          <div className="panel-title" style={{marginTop: 16}}>WEAPON SKIN</div>
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

        {/* Center: main preview */}
        <main className="stage-wrap">
          <div className={'stage bg-' + bgMode}>
            <div className="stage-inner">
              <AnimPreview cfg={cfg} animKey={animKey} scale={scale} facing={facing} running={true} />
            </div>
            <div className="stage-chrome">
              <div className="stage-coords">{STAGE_W} × {STAGE_H} px · ×{scale}</div>
              <div className="stage-controls">
                <button onClick={() => setFacing(f => -f)} title="Flip facing">⇄</button>
                <button onClick={() => setBgMode('grid')} className={bgMode === 'grid' ? 'on' : ''}>grid</button>
                <button onClick={() => setBgMode('dark')} className={bgMode === 'dark' ? 'on' : ''}>dark</button>
                <button onClick={() => setBgMode('light')} className={bgMode === 'light' ? 'on' : ''}>light</button>
                <button onClick={() => setScale(s => Math.max(1, s - 1))}>−</button>
                <button onClick={() => setScale(s => Math.min(8, s + 1))}>+</button>
              </div>
            </div>
          </div>

          <FrameStrip cfg={cfg} animKey={animKey} facing={facing} />

          <AllAnimsRow cfg={cfg} facing={facing} />
        </main>

        {/* Right: customization */}
        <aside className="panel panel-right">
          <div className="panel-title">CHARACTER</div>

          <Section title="Skin">
            <ColorSwatches options={window.Palette.skin} selectedIdx={cfg.skinIdx} onPick={set('skinIdx')} field="base" />
          </Section>

          <Section title="Hair Style">
            <Chips options={window.Palette.hairstyles} selectedIdx={cfg.hairStyleIdx} onPick={set('hairStyleIdx')} />
          </Section>

          <Section title="Hair Color">
            <ColorSwatches options={window.Palette.hair} selectedIdx={cfg.hairIdx} onPick={set('hairIdx')} field="base" />
          </Section>

          <Section title="Headwear">
            <Chips options={window.Palette.hat} selectedIdx={cfg.hatIdx} onPick={set('hatIdx')} />
          </Section>

          <Section title="Eyes">
            <ColorSwatches options={window.Palette.eye} selectedIdx={cfg.eyeIdx} onPick={set('eyeIdx')} field="base" />
          </Section>

          <Section title="Uniform (shirt)">
            <ColorSwatches options={window.Palette.uniforms} selectedIdx={cfg.uniformIdx} onPick={set('uniformIdx')} field="base" />
          </Section>

          <Section title="Pants">
            <ColorSwatches options={window.Palette.pants} selectedIdx={cfg.pantsIdx} onPick={set('pantsIdx')} field="base" />
          </Section>

          <Section title={<>Vest <Toggle on={cfg.vestOn} onChange={set('vestOn')} label="" /></>}>
            {cfg.vestOn && <ColorSwatches options={window.Palette.vest} selectedIdx={cfg.vestIdx} onPick={set('vestIdx')} field="base" />}
          </Section>

          <Section title={<>Backpack <Toggle on={cfg.backpackOn} onChange={set('backpackOn')} label="" /></>}>
            {cfg.backpackOn && <ColorSwatches options={window.Palette.backpack} selectedIdx={cfg.backpackIdx} onPick={set('backpackIdx')} field="base" />}
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
                    <WeaponIcon weapon={w} />
                    <div className="weapon-name">{w.name}</div>
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
