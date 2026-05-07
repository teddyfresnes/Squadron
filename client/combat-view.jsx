// Combat view — drives CombatSim and renders the battle on screen.
// Each soldier is a positioned <SpriteCanvas> on top of an arena background.
// HP bars and bullet trails are an SVG overlay above the soldiers.

(function () {

  const { useState, useEffect, useRef } = React;
  const UI = window.SquadronUI;

  const STAGE_W = (UI && UI.STAGE_W) || 256;
  const STAGE_H = (UI && UI.STAGE_H) || 112;
  const GROUND_Y_RATIO = 0.78;          // where the ground line sits inside the arena
  const BULLET_TRAIL_MS = 260;          // default visual life for bullet streaks
  const BULLET_TRAIL_MAX_MS = 360;
  const BASE_TILE_PX = 24;              // reference tile size that maps to SPRITE_SCALE = 1.0
  const DEFAULT_MAGAZINE_SIZE = 8;
  const HP_FLASH_MS = 1700;
  const SHADOW_FOOT_Y = STAGE_H * 0.705;
  const BODY_PART_META = [
    { key: 'head', className: 'head', label: 'Tete' },
    { key: 'chestLeft', className: 'chest-left', label: 'Torse gauche', fallbackKey: 'torso' },
    { key: 'chestRight', className: 'chest-right', label: 'Torse droit', fallbackKey: 'torso' },
    { key: 'abdomen', className: 'abdomen', label: 'Ventre', fallbackKey: 'torso' },
    { key: 'leftArm', className: 'left-arm', label: 'Bras gauche' },
    { key: 'rightArm', className: 'right-arm', label: 'Bras droit' },
    { key: 'leftLeg', className: 'left-leg', label: 'Jambe gauche' },
    { key: 'rightLeg', className: 'right-leg', label: 'Jambe droite' }
  ];

  function frameForState(state, stateT) {
    const anim = window.Anims[state] || window.Anims.idle;
    const idx = stateT * anim.fps;
    if (anim.loop === false) return Math.min(Math.floor(idx), anim.frames - 1);
    return Math.floor(idx) % anim.frames;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function getSoldierLayout(s, arenaH, pxPerTile, spriteScale, xOffset) {
    const stageW = STAGE_W * spriteScale;
    const stageH = STAGE_H * spriteScale;
    const cx = xOffset + s.x * pxPerTile;
    const laneScale = pxPerTile / BASE_TILE_PX;
    const groundY = arenaH * GROUND_Y_RATIO + s.laneOffsetPx * laneScale;
    return {
      stageW,
      stageH,
      cx,
      groundY,
      left: Math.round(cx - stageW / 2),
      top: Math.round(groundY - stageH)
    };
  }

  function hpPct(s) {
    return clamp(100 * (s.hp || 0) / Math.max(1, s.hpMax || 1), 0, 100);
  }

  function hpText(s) {
    return Math.ceil(Math.max(0, s.hp || 0)) + '/' + Math.max(1, s.hpMax || 1) + ' PV';
  }

  function getWeaponByName(name) {
    if (!name) return null;
    const G = window.SquadronGame && window.SquadronGame.helpers;
    if (G && typeof G.getWeaponByName === 'function') {
      const w = G.getWeaponByName(name);
      if (w) return w;
    }
    const list = window.Weapons && window.Weapons.list || [];
    return list.find(w => w.name === name) || null;
  }

  function uniqueWeaponNames(s) {
    const seen = new Set();
    return [s.weaponName, s.preferredWeapon, s.skill1Name, s.skill2Name]
      .filter(Boolean)
      .filter(name => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
  }

  function magazineSizeFor(s) {
    const stats = s.weapon || (window.CombatSim && window.CombatSim.getWeaponStats(s.weaponName));
    return Math.max(1, Math.round((stats && stats.magazineSize) || DEFAULT_MAGAZINE_SIZE));
  }

  const TRAIL_BODY_POINTS = {
    head:       { x:  0, y: 0.48 },
    chestLeft:  { x: -5, y: 0.41 },
    chestRight: { x:  5, y: 0.41 },
    abdomen:    { x:  0, y: 0.37 },
    leftArm:    { x: -13, y: 0.41 },
    rightArm:   { x:  13, y: 0.41 },
    leftLeg:    { x: -5, y: 0.32 },
    rightLeg:   { x:  5, y: 0.32 },
    torso:      { x:  0, y: 0.40 },
    feet:       { x:  0, y: 0.30 }
  };

  // Muzzle position per weapon category. x = stage-pixels forward of soldier
  // center (≈ gripX + barrel length). y = ratio above groundY (gun is held at
  // shoulder height, slightly higher than chest).
  const MUZZLE_OFFSETS = {
    pistol:  { x: 14, y: 0.45 },
    smg:     { x: 22, y: 0.46 },
    rifle:   { x: 32, y: 0.46 },
    shotgun: { x: 28, y: 0.46 },
    sniper:  { x: 44, y: 0.46 },
    heavy:   { x: 38, y: 0.45 },
    default: { x: 22, y: 0.46 }
  };

  const TRAIL_AIM_PARTS = ['head', 'chestLeft', 'chestRight', 'abdomen', 'leftLeg', 'rightLeg', 'feet'];
  const SHOT_TRAIL_PROFILES = {
    pistol:  { duration: 150, travel: 2.6, segment: 110, width: 1.7 },
    smg:     { duration: 140, travel: 2.8, segment: 130, width: 1.6 },
    rifle:   { duration: 170, travel: 2.7, segment: 180, width: 2.0 },
    shotgun: { duration: 180, travel: 2.2, segment: 130, width: 2.0, spread: true },
    sniper:  { duration: 220, travel: 2.4, segment: 240, width: 2.6 },
    heavy:   { duration: 230, travel: 2.1, segment: 210, width: 2.8 },
    default: { duration: 170, travel: 2.7, segment: 150, width: 1.9 }
  };

  function randomTrailPart(rng) {
    return TRAIL_AIM_PARTS[Math.floor(rng() * TRAIL_AIM_PARTS.length)] || 'torso';
  }

  function shotTrailProfile(category) {
    return SHOT_TRAIL_PROFILES[category] || SHOT_TRAIL_PROFILES.default;
  }

  function pointsToString(points) {
    return points.map(p => p[0] + ',' + p[1]).join(' ');
  }

  function trailMissOffset(rng, ax, tx) {
    const dir = tx >= ax ? 1 : -1;
    const r = rng();
    // Every miss pierces past the target — bullets don't stop at the trooper.
    const passBy = 90 + rng() * 130;
    if (r < 0.30) return { kind: 'over',   x: dir * passBy + (rng() - 0.5) * 28, y: -(22 + rng() * 38) };
    if (r < 0.55) return { kind: 'behind', x: dir * (passBy + 30 + rng() * 70), y: (rng() - 0.5) * 24 };
    if (r < 0.80) return { kind: 'ground', x: dir * (60 + rng() * 90) + (rng() - 0.5) * 24, y: rng() * 8 };
    return                                 { kind: 'wide',   x: dir * passBy + (rng() < 0.5 ? -1 : 1) * (16 + rng() * 28), y: (rng() - 0.5) * 32 };
  }

  function bodyTrailPoint(part, spriteScale) {
    const p = TRAIL_BODY_POINTS[part] || TRAIL_BODY_POINTS.torso;
    return {
      x: p.x * spriteScale,
      y: STAGE_H * spriteScale * p.y
    };
  }

  // ── Soldier sprite, absolutely positioned on the arena ────────────────────
  function ArenaSoldier({ s, arenaH, pxPerTile, spriteScale, xOffset, isActive, isSelected, showHpBar, onSelect }) {
    const SpriteCanvas = UI.SpriteCanvas;
    const frame = frameForState(s.state, s.stateT);
    const layout = getSoldierLayout(s, arenaH, pxPerTile, spriteScale, xOffset);
    const life = hpPct(s);
    const hpLabel = hpText(s);
    const shadowTop = Math.round(SHADOW_FOOT_Y * spriteScale);
    const hpTop = Math.round(STAGE_H * 0.39 * spriteScale);

    function handleClick(ev) {
      ev.stopPropagation();
      if (onSelect) onSelect(s.id);
    }

    return (
      <button type="button"
              className={'cv-soldier' + (isActive ? ' is-active' : '') + (isSelected ? ' is-selected' : '')}
              style={{ left: layout.left, top: layout.top, width: layout.stageW, height: layout.stageH }}
              onClick={handleClick}
              aria-label={(s.name || 'Soldat') + ', niveau ' + (s.level || 1)}
              aria-pressed={isSelected}>
        <div className="cv-ground-shadow" style={{ top: shadowTop }} />
        <SpriteCanvas
          cfg={s.cfg}
          animKey={s.state}
          frame={frame}
          scale={spriteScale}
          facing={s.facing}
          animState={s.animState}
        />
        {showHpBar && (
          <div className="cv-hpbar" style={{ top: hpTop }} title={hpLabel} aria-label={hpLabel}>
            <div className="cv-hpbar-fill" style={{ width: life + '%' }} />
          </div>
        )}
        {isSelected && <div className="cv-selected-marker" />}
      </button>
    );
  }

  function hitLevelFor(hits, part) {
    const direct = clamp(hits[part.key] || 0, 0, 2);
    if (direct > 0) return direct;
    return part.fallbackKey ? clamp(hits[part.fallbackKey] || 0, 0, 2) : 0;
  }

  function BodyGraph({ s }) {
    const hits = s.bodyHits || {};
    const hpLabel = hpText(s);
    return (
      <div className="cv-body-graph" role="img" aria-label={'Etat du corps, ' + hpLabel} title={hpLabel} data-hp={hpLabel}>
        {BODY_PART_META.map(part => {
          const hitLevel = hitLevelFor(hits, part);
          return (
            <span key={part.key}
                  className={'cv-body-node cv-body-' + part.className + ' hit-' + hitLevel}
                  title={part.label + ' : ' + hitLevel} />
          );
        })}
      </div>
    );
  }

  function AmmoRow({ total, filled, small }) {
    const count = Math.max(1, Math.round(total || DEFAULT_MAGAZINE_SIZE));
    const full = clamp(filled == null ? count : Math.round(filled), 0, count);
    const bullets = [];
    for (let i = 0; i < count; i++) bullets.push(i);
    return (
      <div className={'cv-ammo-row' + (small ? ' cv-ammo-row-small' : '')} aria-hidden="true">
        {bullets.map(i => (
          <span key={i} className={'cv-ammo-bullet' + (i < full ? ' is-full' : ' is-empty')} />
        ))}
      </div>
    );
  }

  function SoldierInspectMenu({ s, arenaW, arenaH, pxPerTile, spriteScale, xOffset, onClose }) {
    const G = window.SquadronGame && window.SquadronGame.helpers;
    const SkillTooltip = G && G.SkillTooltip;
    const WeaponGameIcon = UI.WeaponGameIcon;
    const activeWeapon = getWeaponByName(s.weaponName);
    const skillWeapons = uniqueWeaponNames(s).map(getWeaponByName).filter(Boolean);
    const magSize = magazineSizeFor(s);
    const life = hpPct(s);
    const hpLabel = hpText(s);
    const layout = getSoldierLayout(s, arenaH, pxPerTile, spriteScale, xOffset);
    const panelW = Math.max(282, Math.min(376, arenaW - 16));
    const panelH = 320;
    const rawLeft = s.team === 'A'
      ? layout.left + layout.stageW - 18
      : layout.left - panelW + 18;
    const left = clamp(rawLeft, 8, Math.max(8, arenaW - panelW - 8));
    const top = clamp(layout.top + Math.min(18, layout.stageH * 0.18), 8, Math.max(8, arenaH - panelH - 8));

    function stop(ev) {
      ev.stopPropagation();
    }

    return (
      <div className={'cv-inspect-panel cv-inspect-team-' + s.team}
           style={{ left, top, width: panelW }}
           onClick={stop}>
        <button type="button" className="cv-inspect-close" onClick={onClose} aria-label="Fermer">×</button>
        <div className="cv-inspect-head">
          <div className="cv-inspect-name">{s.name || 'Soldat'}</div>
          <div className="cv-inspect-level">NIV {s.level || 1}</div>
        </div>
        <div className="cv-inspect-main">
          <div className="cv-inspect-vitals">
            <div className={'cv-life-rail' + (life <= 35 ? ' is-low' : '')}
                 title={hpLabel}
                 data-hp={hpLabel}
                 aria-label={hpLabel}>
              <div className="cv-life-fill" style={{ height: life + '%' }} />
            </div>
            <BodyGraph s={s} />
          </div>
          <div className="cv-inspect-loadout">
            <div className="cv-inspect-weapon">
              <div className="cv-inspect-weapon-head">
                {activeWeapon && WeaponGameIcon ? <WeaponGameIcon weapon={activeWeapon} /> : <span className="cv-weapon-placeholder" />}
                <div className="cv-inspect-weapon-name">{s.weaponName || 'Arme'}</div>
              </div>
              <AmmoRow total={magSize} filled={magSize} />
              <AmmoRow total={magSize} filled={magSize} small />
            </div>
            <div className="cv-inspect-skills">
              {skillWeapons.map(w => {
                const icon = (
                  <span className="cv-inspect-skill">
                    {WeaponGameIcon ? <WeaponGameIcon weapon={w} /> : null}
                  </span>
                );
                return SkillTooltip
                  ? <SkillTooltip key={w.name} weapon={w} tipDir="below">{icon}</SkillTooltip>
                  : React.cloneElement(icon, { key: w.name });
              })}
            </div>
          </div>
        </div>
        <div className="cv-inspect-hp">{Math.ceil(s.hp)}/{s.hpMax}</div>
      </div>
    );
  }

  // ── Bullet trails layer (SVG overlay) ─────────────────────────────────────
  function TrailsLayer({ trails, arenaW, arenaH, pxPerTile, spriteScale, xOffset, nowMs }) {
    const laneScale = pxPerTile / BASE_TILE_PX;
    return (
      <svg className="cv-trails" width={arenaW} height={arenaH}
           viewBox={`0 0 ${arenaW} ${arenaH}`} preserveAspectRatio="none">
        {trails.map(tr => {
          const age = nowMs - tr.bornMs;
          const profile = shotTrailProfile(tr.weaponCategory);
          const duration = profile.duration || BULLET_TRAIL_MS;
          const k = Math.max(0, 1 - age / duration);
          if (k <= 0) return null;
          const groundY = arenaH * GROUND_Y_RATIO;
          const dir = tr.tx >= tr.ax ? 1 : -1;
          const cat = tr.weaponCategory || 'default';
          const mz = MUZZLE_OFFSETS[cat] || MUZZLE_OFFSETS.default;
          const target = bodyTrailPoint(tr.aimPart || tr.bodyPart || 'torso', spriteScale);
          const x1 = xOffset + tr.ax * pxPerTile + dir * mz.x * spriteScale;
          const y1 = groundY + tr.ay * laneScale - STAGE_H * spriteScale * mz.y;
          let x2 = xOffset + tr.tx * pxPerTile + target.x + (tr.hit ? tr.impactDx : tr.missDx);
          let y2 = groundY + tr.ty * laneScale - target.y + (tr.hit ? tr.impactDy : tr.missDy);
          if (!tr.hit && tr.missKind === 'ground') {
            x2 = xOffset + tr.tx * pxPerTile + tr.missDx;
            y2 = groundY + tr.ty * laneScale - 3 * spriteScale + tr.missDy;
          }
          if (!tr.hit && tr.missKind === 'behind') {
            x2 = clamp(x2, -80, arenaW + 80);
          }
          y2 = clamp(y2, -60, arenaH + 30);
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const ux = dx / len;
          const uy = dy / len;
          const nx = -uy;
          const ny = ux;
          const headT = clamp(age / duration * profile.travel, 0, 1);
          const segmentPx = (profile.segment || 90) * Math.max(0.8, spriteScale);
          const segmentT = clamp(segmentPx / len, 0.1, 0.68);
          const tailT = clamp(headT - segmentT, 0, 1);
          const sx = x1 + dx * tailT;
          const sy = y1 + dy * tailT;
          const ex = x1 + dx * headT;
          const ey = y1 + dy * headT;
          const showImpact = headT > 0.9;
          const impactK = showImpact ? Math.max(0, 1 - (headT - 0.9) / 0.1) : 0;
          const width = profile.width || 1.25;
          return (
            <g key={tr.key} className={'cv-bullet-fx cv-bullet-' + (tr.hit ? 'hit' : tr.missKind) + ' cv-bullet-cat-' + (tr.weaponCategory || 'default')}>
              {profile.spread && (
                <g className="cv-bullet-spread">
                  <line className="cv-bullet-pellet"
                        x1={sx + nx * 3 * spriteScale}
                        y1={sy + ny * 3 * spriteScale}
                        x2={ex + nx * 9 * spriteScale * headT}
                        y2={ey + ny * 9 * spriteScale * headT}
                        strokeWidth={Math.max(1, width * 0.75)}
                        strokeOpacity={0.42 * k} />
                  <line className="cv-bullet-pellet"
                        x1={sx - nx * 3 * spriteScale}
                        y1={sy - ny * 3 * spriteScale}
                        x2={ex - nx * 9 * spriteScale * headT}
                        y2={ey - ny * 9 * spriteScale * headT}
                        strokeWidth={Math.max(1, width * 0.75)}
                        strokeOpacity={0.35 * k} />
                </g>
              )}
              <line className="cv-bullet-glint"
                    x1={sx - ux * 6} y1={sy - uy * 6}
                    x2={ex} y2={ey}
                    strokeWidth={width + 2.2}
                    strokeOpacity={0.6 * k} />
              <line className="cv-bullet-line"
                    x1={sx} y1={sy}
                    x2={ex} y2={ey}
                    strokeWidth={width}
                    strokeOpacity={k} />
              <line className="cv-bullet-tip"
                    x1={ex - ux * Math.min(24, segmentPx * 0.32)}
                    y1={ey - uy * Math.min(24, segmentPx * 0.32)}
                    x2={ex} y2={ey}
                    strokeWidth={width + 1.1}
                    strokeOpacity={Math.min(1, 1.15 * k)} />
              {!tr.hit && tr.missKind === 'ground' && showImpact && (
                <g className="cv-bullet-ground-impact" opacity={impactK}>
                  <ellipse className="cv-bullet-dust" cx={x2} cy={y2 + 2 * spriteScale} rx={7 * spriteScale} ry={2.4 * spriteScale} />
                  <line className="cv-bullet-chip" x1={x2 - 4 * spriteScale} y1={y2} x2={x2 - 1 * spriteScale} y2={y2 - 4 * spriteScale} />
                  <line className="cv-bullet-chip" x1={x2 + 1 * spriteScale} y1={y2} x2={x2 + 5 * spriteScale} y2={y2 - 3 * spriteScale} />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    );
  }

  // ── Result overlay shown when a winner is decided ─────────────────────────
  function ResultOverlay({ winner, mySquad, oppSquad, battle, onContinue }) {
    const isWin = winner === 'A';
    const survivors = battle.all.filter(s => s.team === 'A' && s.hp > 0).length;
    const enemiesDown = battle.all.filter(s => s.team === 'B' && s.hp <= 0).length;
    return (
      <div className="cv-result">
        <div className={'cv-result-card ' + (isWin ? 'cv-win' : 'cv-lose')}>
          <div className="cv-result-title">{isWin ? 'VICTOIRE' : 'DÉFAITE'}</div>
          <div className="cv-result-sub">
            {isWin
              ? `${survivors}/${mySquad.soldiers.length} soldats survivants — ${enemiesDown} ennemis abattus`
              : `${oppSquad.name} a survécu — ${enemiesDown}/${oppSquad.soldiers.length} ennemis abattus`}
          </div>
          <button type="button" className="sq-btn cv-result-btn"
                  onClick={onContinue}>CONTINUER</button>
        </div>
      </div>
    );
  }

  // ── Main battle screen component ──────────────────────────────────────────
  function HQBattleScreen({ mySquad, oppSquad, onDone }) {
    const containerRef = useRef(null);
    const pausedRef = useRef(false);
    const resultShownRef = useRef(false);
    const [arenaSize, setArenaSize] = useState({ w: 1200, h: 320 });
    const [, setTick] = useState(0);
    const [trails, setTrails] = useState([]);
    const [hpFlashes, setHpFlashes] = useState({});
    const [resultShown, setResultShown] = useState(false);
    const [selectedSoldierId, setSelectedSoldierId] = useState(null);
    const [pauseMode, setPauseMode] = useState(null);

    // Build the battle once stats are loaded.
    const [battle, setBattle] = useState(null);
    useEffect(() => {
      let alive = true;
      window.CombatSim.loadWeaponStats().then(() => {
        if (!alive) return;
        const seed = `${mySquad.name || 'me'}-vs-${oppSquad.name || 'opp'}-${Date.now()}`;
        const b = window.CombatSim.createBattle({
          teamA: mySquad,
          teamB: oppSquad,
          seed
        });
        setSelectedSoldierId(null);
        setPauseMode(null);
        setHpFlashes({});
        setTrails([]);
        resultShownRef.current = false;
        setResultShown(false);
        setBattle(b);
      });
      return () => { alive = false; };
    }, [mySquad, oppSquad]);

    useEffect(() => {
      pausedRef.current = pauseMode !== null;
    }, [pauseMode]);

    // Resize observer to keep the arena width matching its container.
    // Height tuned so we see most of the forest scene (it's ~4:3) without
    // wasting too much vertical space.
    useEffect(() => {
      function measure() {
        const el = containerRef.current;
        if (!el) return;
        const w = el.clientWidth;
        const h = Math.max(320, Math.min(520, Math.round(w * 0.42)));
        setArenaSize({ w, h });
      }
      measure();
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }, []);

    // Main loop — drive the sim with fixed-step accumulator, advance trails by
    // wallclock time so they fade naturally regardless of frame rate.
    useEffect(() => {
      if (!battle) return;
      const DT = window.CombatSim.DT;
      let raf;
      let lastT = performance.now();
      let acc = 0;
      let lastEventIdx = 0;
      const trailRng = (function () {
        let s = 0x12345 ^ (battle.all.length * 7919);
        return function () {
          s = (s * 1664525 + 1013904223) >>> 0;
          return s / 4294967296;
        };
      })();

      function loop(t) {
        const now = t;
        if (pausedRef.current) {
          lastT = now;
          acc = 0;
          raf = requestAnimationFrame(loop);
          return;
        }

        const dt = (now - lastT) / 1000;
        lastT = now;
        acc += Math.min(dt, 0.1); // cap to avoid spiral after tab switch

        let stepped = 0;
        while (acc >= DT && stepped < 6) {
          battle.step(DT);
          acc -= DT;
          stepped++;
        }

        // Pull new shoot events into the trails list.
        if (battle.events.length > lastEventIdx) {
          const newOnes = [];
          const newHpFlashes = {};
          for (let i = lastEventIdx; i < battle.events.length; i++) {
            const ev = battle.events[i];
            if (ev.type === 'shoot') {
              const aimPart = ev.bodyPart || randomTrailPart(trailRng);
              const miss = ev.hit ? { x: 0, y: 0 } : trailMissOffset(trailRng, ev.ax, ev.tx);
              newOnes.push({
                key: 'tr' + i,
                ax: ev.ax, ay: ev.ay,
                tx: ev.tx, ty: ev.ty,
                hit: ev.hit,
                weaponCategory: ev.weaponCategory,
                bodyPart: ev.bodyPart,
                aimPart,
                missKind: miss.kind || null,
                impactDx: (trailRng() - 0.5) * 5,
                impactDy: (trailRng() - 0.5) * 5,
                missDx: miss.x,
                missDy: miss.y,
                bornMs: now
              });
            }
            if (ev.type === 'hit' || ev.type === 'die') {
              newHpFlashes[ev.targetId] = now + HP_FLASH_MS;
            }
          }
          if (newOnes.length) {
            setTrails(prev => prev.concat(newOnes));
          }
          if (Object.keys(newHpFlashes).length) {
            setHpFlashes(prev => Object.assign({}, prev, newHpFlashes));
          }
          lastEventIdx = battle.events.length;
        }

        // Garbage-collect expired trails — only re-set if anything actually expired.
        setTrails(prev => {
          const kept = prev.filter(tr => now - tr.bornMs < BULLET_TRAIL_MAX_MS);
          return kept.length === prev.length ? prev : kept;
        });
        setHpFlashes(prev => {
          const keys = Object.keys(prev);
          if (!keys.length) return prev;
          let changed = false;
          const next = {};
          for (const key of keys) {
            if (prev[key] > now) next[key] = prev[key];
            else changed = true;
          }
          return changed ? next : prev;
        });
        setTick(n => (n + 1) % 1000000);

        if (battle.done && battle.endHoldT >= 1.2 && !resultShownRef.current) {
          resultShownRef.current = true;
          setResultShown(true);
        }

        raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
      // tick is intentionally omitted — the loop owns its own cadence
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [battle]);

    if (!battle) {
      return (
        <div className="cv-screen" ref={containerRef}>
          <div className="cv-loading">Préparation du combat…</div>
        </div>
      );
    }

    const nowMs = performance.now();
    // Fit the battlefield horizontally. Keep only a small gutter: SpriteCanvas
    // has a lot of transparent width, so half-canvas padding makes edge spawns
    // look far inside the arena.
    const ARENA_TILES = window.CombatSim.ARENA_TILES;
    const spriteScale = Math.min(1.0, arenaSize.w / 1200);
    const sidePad = Math.round(42 * spriteScale);
    const usableW = Math.max(200, arenaSize.w - 2 * sidePad);
    const pxPerTile = usableW / ARENA_TILES;
    const xOffset = sidePad;
    const selectedSoldier = battle.all.find(s => s.id === selectedSoldierId) || null;
    const isPaused = pauseMode !== null;

    function handleArenaClick() {
      if (selectedSoldierId) {
        setSelectedSoldierId(null);
        setPauseMode(null);
        return;
      }
      setPauseMode(prev => prev === 'manual' ? null : 'manual');
    }

    function handleSelectSoldier(id) {
      const next = selectedSoldierId === id ? null : id;
      setSelectedSoldierId(next);
      setPauseMode(next ? 'inspect' : null);
    }

    function closeInspect() {
      setSelectedSoldierId(null);
      setPauseMode(null);
    }

    return (
      <div className={'cv-screen' + (isPaused ? ' is-paused' : '')} ref={containerRef}>
        <div className={'cv-arena' + (isPaused ? ' is-paused' : '')}
             style={{ width: arenaSize.w, height: arenaSize.h }}
             onClick={handleArenaClick}>
          <div className="cv-bg" />
          {/* Soldiers, sorted so the one at the back lane renders first */}
          {battle.all.slice().sort((a, b) => a.laneOffsetPx - b.laneOffsetPx).map(s => (
            <ArenaSoldier key={s.id} s={s} arenaH={arenaSize.h}
                          pxPerTile={pxPerTile} spriteScale={spriteScale} xOffset={xOffset}
                          isActive={(battle.activeActions || []).some(a => a.actorId === s.id)}
                          isSelected={selectedSoldierId === s.id}
                          showHpBar={!!(hpFlashes[s.id] && hpFlashes[s.id] > nowMs)}
                          onSelect={handleSelectSoldier} />
          ))}
          <TrailsLayer trails={trails}
                       arenaW={arenaSize.w} arenaH={arenaSize.h}
                       pxPerTile={pxPerTile} spriteScale={spriteScale} xOffset={xOffset}
                       nowMs={nowMs} />
          {isPaused && (
            <div className="cv-pause-overlay" aria-hidden="true">
              <div className="cv-pause-text">PAUSE</div>
            </div>
          )}
          {selectedSoldier && (
            <SoldierInspectMenu
              s={selectedSoldier}
              arenaW={arenaSize.w}
              arenaH={arenaSize.h}
              pxPerTile={pxPerTile}
              spriteScale={spriteScale}
              xOffset={xOffset}
              onClose={closeInspect}
            />
          )}
        </div>
        <div className="cv-hud">
          <div className="cv-team cv-team-a">
            <div className="cv-team-name">{mySquad.name}</div>
            <div className="cv-team-count">{battle.aliveCount('A')}/{mySquad.soldiers.length}</div>
          </div>
          <div className="cv-vs">VS</div>
          <div className="cv-team cv-team-b">
            <div className="cv-team-name">{oppSquad.name}</div>
            <div className="cv-team-count">{battle.aliveCount('B')}/{oppSquad.soldiers.length}</div>
          </div>
        </div>
        {resultShown && (
          <ResultOverlay
            winner={battle.winner}
            mySquad={mySquad}
            oppSquad={oppSquad}
            battle={battle}
            onContinue={onDone}
          />
        )}
      </div>
    );
  }

  window.HQBattleScreen = HQBattleScreen;

})();
