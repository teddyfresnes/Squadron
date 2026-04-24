// Main React app — UI showcase for custom 2D characters.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

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
  weaponIdx: 2  // Rifle
};

const STAGE = 64;   // stage size per frame
const SCALE = 6;    // default display scale for main preview

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
function SpriteCanvas({ cfg, animKey, frame, scale, facing }) {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    window.CharacterRenderer.renderFrame(ctx, STAGE, STAGE, cfg, window.Anims[animKey], frame, facing || 1);
  }, [cfg, animKey, frame, facing]);

  return (
    <canvas
      ref={ref}
      width={STAGE}
      height={STAGE}
      style={{
        width: STAGE * scale,
        height: STAGE * scale,
        imageRendering: 'pixelated',
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
  const [scale, setScale] = useState(8);

  useEffect(() => { localStorage.setItem('char-cfg', JSON.stringify(cfg)); }, [cfg]);
  useEffect(() => { localStorage.setItem('char-anim', animKey); }, [animKey]);

  const set = (key) => (v) => setCfg((c) => ({ ...c, [key]: v }));

  const currentWeapon = window.Weapons.list[cfg.weaponIdx];

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
                  <AnimPreview cfg={cfg} animKey={k} scale={2} facing={1} />
                </div>
                <div className="anim-label">{window.Anims[k].name}</div>
                <div className="anim-meta">{window.Anims[k].frames}f</div>
              </button>
            ))}
          </div>

          <div className="panel-title" style={{marginTop: 16}}>WEAPON</div>
          <div className="weapon-grid">
            {window.Weapons.list.map((w, i) => (
              <button
                key={i}
                className={'weapon-card' + (cfg.weaponIdx === i ? ' selected' : '')}
                onClick={() => set('weaponIdx')(i)}
              >
                <WeaponIcon weapon={w} />
                <div className="weapon-name">{w.name}</div>
              </button>
            ))}
          </div>
        </aside>

        {/* Center: main preview */}
        <main className="stage-wrap">
          <div className={'stage bg-' + bgMode}>
            <div className="stage-inner">
              <AnimPreview cfg={cfg} animKey={animKey} scale={scale} facing={facing} running={true} />
            </div>
            <div className="stage-chrome">
              <div className="stage-coords">32 × 32 px · ×{scale}</div>
              <div className="stage-controls">
                <button onClick={() => setFacing(f => -f)} title="Flip facing">⇄</button>
                <button onClick={() => setBgMode('grid')} className={bgMode === 'grid' ? 'on' : ''}>grid</button>
                <button onClick={() => setBgMode('dark')} className={bgMode === 'dark' ? 'on' : ''}>dark</button>
                <button onClick={() => setBgMode('light')} className={bgMode === 'light' ? 'on' : ''}>light</button>
                <button onClick={() => setScale(s => Math.max(2, s - 2))}>−</button>
                <button onClick={() => setScale(s => Math.min(14, s + 2))}>+</button>
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
            <SpriteCanvas cfg={cfg} animKey={animKey} frame={i} scale={3} facing={facing} />
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
              <AnimPreview cfg={cfg} animKey={k} scale={3} facing={facing} running={true} />
            </div>
            <div className="all-anim-name">{window.Anims[k].name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeaponIcon({ weapon }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    const offX = Math.floor((32 - weapon.width) / 2);
    const offY = Math.floor((14 - weapon.height) / 2);
    ctx.save();
    ctx.translate(offX + weapon.gripX, offY + weapon.gripY);
    weapon.draw(ctx, 0, 0, false);
    ctx.restore();
  }, [weapon]);
  return (
    <canvas
      ref={ref}
      width={32}
      height={14}
      style={{ width: 96, height: 42, imageRendering: 'pixelated' }}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
