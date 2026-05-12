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
  const BULLET_TRAIL_MAX_MS = 560;
  const MUZZLE_FLASH_MS = 95;
  const HIT_IMPACT_MS = 280;
  const GROUND_IMPACT_MS = 360;
  const BASE_TILE_PX = 24;              // reference tile size that maps to SPRITE_SCALE = 1.0
  const DEFAULT_MAGAZINE_SIZE = 8;
  const HP_FLASH_MS = 1700;
  const SHADOW_FOOT_Y = STAGE_H * 0.82;
  const RESULT_OVERLAY_BASE_DELAY = 1.2;
  const RESULT_OVERLAY_VICTORY_PAD = 0.3;

  function frameForState(state, stateT) {
    const anim = window.Anims[state] || window.Anims.idle;
    const idx = stateT * anim.fps;
    if (anim.loop === false) return Math.min(Math.floor(idx), anim.frames - 1);
    return Math.floor(idx) % anim.frames;
  }

  function animDuration(state) {
    const anim = window.Anims && window.Anims[state];
    return anim ? anim.frames / anim.fps : 0;
  }

  function resultOverlayDelay(winner) {
    if (winner === 'draw') return RESULT_OVERLAY_BASE_DELAY;
    return Math.max(
      RESULT_OVERLAY_BASE_DELAY,
      animDuration('holster') + animDuration('victory') + RESULT_OVERLAY_VICTORY_PAD
    );
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
    return list.find(w => (
      w.name === name ||
      w.id === name ||
      (Array.isArray(w.aliases) && w.aliases.includes(name))
    )) || null;
  }

  function uniqueWeaponNames(s) {
    const seen = new Set();
    const names = [s.weaponName, s.preferredWeapon, s.skill1Name, s.skill2Name, ...(s.unlockedWeapons || [])]
      .map(w => typeof w === 'string' ? w : (w && (w.name || w.id)) || null)
      .filter(Boolean)
      .filter(name => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
    if (s.cfg && window.Weapons && window.Weapons.list && window.Weapons.list[s.cfg.weaponIdx]) {
      const configured = window.Weapons.list[s.cfg.weaponIdx].name;
      if (configured && !seen.has(configured)) names.push(configured);
    }
    return names;
  }

  function uniqueWeapons(s) {
    const seen = new Set();
    return uniqueWeaponNames(s)
      .map(getWeaponByName)
      .filter(Boolean)
      .filter(w => {
        const key = w.id || w.name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function magazineSizeFor(s) {
    const stats = s.weapon || (window.CombatSim && window.CombatSim.getWeaponStats(s.weaponName));
    return Math.max(1, Math.round((stats && stats.magazineSize) || DEFAULT_MAGAZINE_SIZE));
  }

  function magazineSizeForWeaponName(name) {
    const stats = window.CombatSim && window.CombatSim.getWeaponStats(name);
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
    // Every miss ends on the ground so a dust impact is visible at the line tip.
    // Variety is in WHERE on the ground (short, close behind, far behind, wide).
    if (r < 0.18) return { kind: 'short',     x: -dir * (50 + rng() * 90) + (rng() - 0.5) * 20, y: rng() * 6 };
    if (r < 0.48) return { kind: 'ground',    x: dir * (60 + rng() * 100) + (rng() - 0.5) * 24, y: rng() * 6 };
    if (r < 0.72) return { kind: 'farground', x: dir * (220 + rng() * 200), y: rng() * 4 };
    return                                   { kind: 'wide',     x: dir * (80 + rng() * 70) + (rng() < 0.5 ? -1 : 1) * (40 + rng() * 60), y: rng() * 8 };
  }

  function bodyTrailPoint(part, spriteScale) {
    const p = TRAIL_BODY_POINTS[part] || TRAIL_BODY_POINTS.torso;
    return {
      x: p.x * spriteScale,
      y: STAGE_H * spriteScale * p.y
    };
  }

  function trailMuzzlePoint(tr) {
    const R = window.CharacterRenderer;
    const anim = window.Anims && window.Anims.shoot;
    if (!R || typeof R.weaponMuzzlePoint !== 'function' || !anim) return null;
    const weapon = getWeaponByName(tr.weaponName);
    const list = window.Weapons && window.Weapons.list || [];
    const weaponIdx = weapon ? list.indexOf(weapon) : -1;
    const cfg = Object.assign({}, tr.actorCfg || {});
    if (weaponIdx >= 0) cfg.weaponIdx = weaponIdx;
    if (cfg.weaponIdx == null || cfg.weaponIdx < 0) cfg.weaponIdx = 0;
    return R.weaponMuzzlePoint(STAGE_W, STAGE_H, cfg, anim, 0, tr.facing || 1, {
      weapon,
      animState: {
        shotProfile: tr.shotProfile,
        weaponCategory: tr.weaponCategory,
        weaponType: tr.weaponType,
        shotIndex: tr.shotIndex,
        shotCount: tr.shotCount
      }
    });
  }

  // ── Soldier sprite, absolutely positioned on the arena ────────────────────
  function ArenaSoldier({ s, arenaH, pxPerTile, spriteScale, xOffset, isActive, isSelected, showHpBar, onSelect }) {
    const SpriteCanvas = UI.SpriteCanvas;
    const frame = frameForState(s.state, s.stateT);
    const layout = getSoldierLayout(s, arenaH, pxPerTile, spriteScale, xOffset);
    const life = hpPct(s);
    const hpLabel = hpText(s);
    const shadowTop = Math.round(SHADOW_FOOT_Y * spriteScale);
    const hpTop = Math.round(STAGE_H * 0.12 * spriteScale);

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
        {s.state !== 'dead' && (
          <div className="cv-ground-shadow" style={{ top: shadowTop }} />
        )}
        {isSelected && <div className="cv-selected-marker" />}
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
      </button>
    );
  }

  function hitLevelFor(hits, part) {
    const direct = clamp(hits[part.key] || 0, 0, 2);
    if (direct > 0) return direct;
    return part.fallbackKey ? clamp(hits[part.fallbackKey] || 0, 0, 2) : 0;
  }

  // Stylized soldier silhouette in SVG. Each region is colored by hit level.
  // Coordinates target a 88x150 viewBox so the shape stays crisp at any size.
  const BODY_SVG_PATHS = {
    head:       'M44 13 C55 13 64 22 64 33 C64 44 55 53 44 53 C33 53 24 44 24 33 C24 22 33 13 44 13 Z',
    chestLeft:  'M27 56 H43 V89 H34 L27 78 Z',
    chestRight: 'M45 56 H61 L61 78 L54 89 H45 Z',
    abdomen:    'M33 91 H55 L58 106 H30 Z',
    leftArm:    'M16 58 L29 62 L24 88 L17 110 L7 106 L12 84 Z',
    rightArm:   'M59 62 L72 58 L76 84 L81 106 L71 110 L64 88 Z',
    leftLeg:    'M30 108 H43 L39 136 H24 Z',
    rightLeg:   'M45 108 H58 L64 136 H49 Z'
  };

  const BODY_SVG_PARTS = [
    { key: 'leftArm',    label: 'Bras gauche' },
    { key: 'rightArm',   label: 'Bras droit' },
    { key: 'leftLeg',    label: 'Jambe gauche' },
    { key: 'rightLeg',   label: 'Jambe droite' },
    { key: 'abdomen',    label: 'Ventre',       fallbackKey: 'torso' },
    { key: 'chestLeft',  label: 'Torse gauche', fallbackKey: 'torso' },
    { key: 'chestRight', label: 'Torse droit',  fallbackKey: 'torso' },
    { key: 'head',       label: 'Tete' }
  ];

  function BodyGraph({ s, onCursor, onLeave }) {
    const hits = s.bodyHits || {};
    const hpLabel = hpText(s);
    return (
      <div className="cv-body-graph"
           role="img"
           aria-label={'Etat du corps, ' + hpLabel}
           onMouseMove={onCursor}
           onMouseLeave={onLeave}>
        <svg className="cv-body-svg" viewBox="0 0 88 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <pattern id="cv-body-grid" width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M6 0 L0 0 0 6" fill="none" stroke="rgba(174, 196, 220, 0.06)" strokeWidth="0.5" />
            </pattern>
            <linearGradient id="cv-body-fill-0" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6a6d6b" />
              <stop offset="100%" stopColor="#4a4e4b" />
            </linearGradient>
            <linearGradient id="cv-body-fill-1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b65a38" />
              <stop offset="100%" stopColor="#77301f" />
            </linearGradient>
            <linearGradient id="cv-body-fill-2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d3372e" />
              <stop offset="100%" stopColor="#5c1717" />
            </linearGradient>
          </defs>
          <g className="cv-body-corners" stroke="rgba(220,230,240,0.46)" strokeWidth="1" fill="none" strokeLinecap="square">
            <path d="M2 2 H8 M2 2 V8" />
            <path d="M86 2 H80 M86 2 V8" />
            <path d="M2 148 H8 M2 148 V142" />
            <path d="M86 148 H80 M86 148 V142" />
          </g>
          <line className="cv-body-axis" x1="44" y1="6" x2="44" y2="144"
                stroke="rgba(174,196,220,0.12)" strokeWidth="0.5" strokeDasharray="2 3" />
          <g className="cv-body-shape">
            {BODY_SVG_PARTS.map(part => {
              const lvl = hitLevelFor(hits, part);
              return (
                <path key={part.key}
                      d={BODY_SVG_PATHS[part.key]}
                      className={'cv-body-zone hit-' + lvl}
                      fill={'url(#cv-body-fill-' + lvl + ')'}>
                  <title>{part.label + ' : ' + lvl}</title>
                </path>
              );
            })}
          </g>
        </svg>
      </div>
    );
  }

  function AmmoRow({ total, filled, small, loaded, reserve }) {
    const count = Math.max(1, Math.round(total || DEFAULT_MAGAZINE_SIZE));
    const full = clamp(filled == null ? count : Math.round(filled), 0, count);
    const bullets = [];
    for (let i = 0; i < count; i++) bullets.push(i);
    return (
      <div className={'cv-ammo-row' + (small ? ' cv-ammo-row-small' : '') + (loaded ? ' cv-ammo-row-loaded' : '') + (reserve ? ' cv-ammo-row-reserve' : '')} aria-hidden="true">
        {bullets.map(i => (
          <span key={i} className={'cv-ammo-bullet' + (i < full ? ' is-full' : ' is-empty')} />
        ))}
      </div>
    );
  }

  function AmmoStack({ total }) {
    const count = Math.max(1, Math.round(total || DEFAULT_MAGAZINE_SIZE));
    return (
      <div className="cv-ammo-stack" aria-hidden="true">
        <AmmoRow total={count} filled={count} small loaded />
        <AmmoRow total={count} filled={count} small reserve />
      </div>
    );
  }

  function SoldierInspectMenu({ s, arenaW, arenaH, pxPerTile, spriteScale, xOffset, onClose }) {
    const G = window.SquadronGame && window.SquadronGame.helpers;
    const SkillTooltip = G && G.SkillTooltip;
    const WeaponGameIcon = UI.WeaponGameIcon;
    const WeaponIcon = UI.WeaponIcon;
    const allWeapons = uniqueWeapons(s);
    const skillWeapons = allWeapons;
    const life = hpPct(s);
    const hpLabel = hpText(s);
    const layout = getSoldierLayout(s, arenaH, pxPerTile, spriteScale, xOffset);
    const panelW = Math.max(300, Math.min(390, arenaW - 16));
    const panelH = 300;
    const rawLeft = s.team === 'A'
      ? layout.left + layout.stageW - 18
      : layout.left - panelW + 18;
    const left = clamp(rawLeft, 8, Math.max(8, arenaW - panelW - 8));
    const top = clamp(layout.top + Math.min(18, layout.stageH * 0.18), 8, Math.max(8, arenaH - panelH - 8));

    const panelRef = useRef(null);
    const [cursorTip, setCursorTip] = useState(null);

    function stop(ev) {
      ev.stopPropagation();
    }

    function trackCursor(ev, text) {
      const el = panelRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setCursorTip({ text, x: ev.clientX - rect.left, y: ev.clientY - rect.top });
    }
    function trackHpCursor(ev) { trackCursor(ev, hpLabel); }
    function clearCursor() { setCursorTip(null); }

    return (
      <div ref={panelRef}
           className={'cv-inspect-panel cv-inspect-team-' + s.team}
           style={{ left, top, width: panelW }}
           onClick={stop}>
        <button type="button" className="cv-inspect-close" onClick={onClose} aria-label="Fermer">×</button>
        <div className="cv-inspect-head">
          <div className="cv-inspect-name">{s.name || 'Soldat'}</div>
          <div className="cv-inspect-level">NIV {s.level || 1}</div>
        </div>

        <div className="cv-inspect-weapons">
          {allWeapons.length === 0 && (
            <div className="cv-inspect-weapons-empty">Aucune arme</div>
          )}
          {allWeapons.map(w => {
            const mag = magazineSizeForWeaponName(w.name);
            return (
              <div key={w.name}
                   className="cv-inspect-weapon-card"
                   aria-label={w.name}
                   onMouseMove={(ev) => trackCursor(ev, w.name)}
                   onMouseLeave={clearCursor}>
                <div className="cv-inspect-weapon-card-img">
                  {WeaponIcon ? <WeaponIcon weapon={w} scale={0.74} /> : <span className="cv-weapon-placeholder" />}
                </div>
                <AmmoStack total={mag} />
              </div>
            );
          })}
        </div>

        <div className="cv-inspect-main">
          <div className="cv-inspect-vitals">
            <div className={'cv-life-rail' + (life <= 35 ? ' is-low' : '')}
                 aria-label={hpLabel}
                 onMouseMove={trackHpCursor}
                 onMouseLeave={clearCursor}>
              <div className="cv-life-fill" style={{ height: life + '%' }} />
            </div>
            <BodyGraph s={s} onCursor={trackHpCursor} onLeave={clearCursor} />
          </div>
          <div className="cv-inspect-skills" aria-label="Armes débloquées">
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

        {cursorTip && (
          <div className="cv-hp-cursor-tooltip"
               style={{ left: cursorTip.x + 12, top: cursorTip.y - 22 }}
               aria-hidden="true">
            {cursorTip.text}
          </div>
        )}
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
          const streakK = Math.max(0, 1 - age / duration);
          const muzzleK = Math.max(0, 1 - age / MUZZLE_FLASH_MS);
          const arrivalAge = duration / Math.max(1, profile.travel || 1);
          const sinceArrival = age - arrivalAge;
          const hitImpactK = tr.hit && sinceArrival >= 0
            ? Math.max(0, 1 - sinceArrival / HIT_IMPACT_MS)
            : 0;
          const groundImpactK = !tr.hit && sinceArrival >= 0
            ? Math.max(0, 1 - sinceArrival / GROUND_IMPACT_MS)
            : 0;
          if (streakK <= 0 && muzzleK <= 0 && hitImpactK <= 0 && groundImpactK <= 0) return null;
          const groundY = arenaH * GROUND_Y_RATIO;
          const muzzle = trailMuzzlePoint(tr);
          const target = bodyTrailPoint(tr.aimPart || tr.bodyPart || 'torso', spriteScale);
          const stageLeft = xOffset + tr.ax * pxPerTile - (STAGE_W * spriteScale) / 2;
          const stageTop = groundY + tr.ay * laneScale - STAGE_H * spriteScale;
          const x1 = muzzle ? stageLeft + muzzle.x * spriteScale : xOffset + tr.ax * pxPerTile;
          const y1 = muzzle ? stageTop + muzzle.y * spriteScale : groundY + tr.ay * laneScale - STAGE_H * spriteScale * 0.46;
          let x2 = xOffset + tr.tx * pxPerTile + target.x + (tr.hit ? tr.impactDx : tr.missDx);
          let y2 = groundY + tr.ty * laneScale - target.y + (tr.hit ? tr.impactDy : tr.missDy);
          if (!tr.hit) {
            // All misses land on the ground — endpoint is centered on target X plus the miss offset.
            x2 = xOffset + tr.tx * pxPerTile + tr.missDx;
            y2 = groundY + tr.ty * laneScale - 3 * spriteScale + tr.missDy;
          }
          // Keep endpoints inside the arena so dust impact stays visible.
          x2 = clamp(x2, 8, arenaW - 8);
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
          const showGroundImpact = groundImpactK > 0;
          const width = profile.width || 1.25;
          const muzzleScale = (profile.width || 1.25) * 0.55 + 0.6;
          return (
            <g key={tr.key} className={'cv-bullet-fx cv-bullet-' + (tr.hit ? 'hit' : tr.missKind) + ' cv-bullet-cat-' + (tr.weaponCategory || 'default')}>
              {profile.spread && streakK > 0 && (
                <g className="cv-bullet-spread">
                  <line className="cv-bullet-pellet"
                        x1={sx + nx * 3 * spriteScale}
                        y1={sy + ny * 3 * spriteScale}
                        x2={ex + nx * 9 * spriteScale * headT}
                        y2={ey + ny * 9 * spriteScale * headT}
                        strokeWidth={Math.max(1, width * 0.75)}
                        strokeOpacity={0.42 * streakK} />
                  <line className="cv-bullet-pellet"
                        x1={sx - nx * 3 * spriteScale}
                        y1={sy - ny * 3 * spriteScale}
                        x2={ex - nx * 9 * spriteScale * headT}
                        y2={ey - ny * 9 * spriteScale * headT}
                        strokeWidth={Math.max(1, width * 0.75)}
                        strokeOpacity={0.35 * streakK} />
                </g>
              )}
              {streakK > 0 && (
                <g>
                  <line className="cv-bullet-glint"
                        x1={sx - ux * 6} y1={sy - uy * 6}
                        x2={ex} y2={ey}
                        strokeWidth={width + 2.2}
                        strokeOpacity={0.6 * streakK} />
                  <line className="cv-bullet-line"
                        x1={sx} y1={sy}
                        x2={ex} y2={ey}
                        strokeWidth={width}
                        strokeOpacity={streakK} />
                  <line className="cv-bullet-tip"
                        x1={ex - ux * Math.min(24, segmentPx * 0.32)}
                        y1={ey - uy * Math.min(24, segmentPx * 0.32)}
                        x2={ex} y2={ey}
                        strokeWidth={width + 1.1}
                        strokeOpacity={Math.min(1, 1.15 * streakK)} />
                </g>
              )}
              {!tr.hit && showGroundImpact && (
                <g className="cv-bullet-ground-impact" opacity={groundImpactK}>
                  <ellipse className="cv-bullet-dust" cx={x2} cy={y2 + 2 * spriteScale}
                           rx={(tr.missKind === 'farground' ? 10 : 7) * spriteScale}
                           ry={(tr.missKind === 'farground' ? 3.2 : 2.4) * spriteScale} />
                  <line className="cv-bullet-chip" x1={x2 - 4 * spriteScale} y1={y2} x2={x2 - 1 * spriteScale} y2={y2 - 4 * spriteScale} />
                  <line className="cv-bullet-chip" x1={x2 + 1 * spriteScale} y1={y2} x2={x2 + 5 * spriteScale} y2={y2 - 3 * spriteScale} />
                  {tr.missKind === 'farground' && (
                    <g className="cv-bullet-farground-extra">
                      <ellipse className="cv-bullet-dust" cx={x2} cy={y2 + 1 * spriteScale} rx={5.5 * spriteScale} ry={1.8 * spriteScale} opacity={0.7} />
                      <line className="cv-bullet-chip" x1={x2 - 2 * spriteScale} y1={y2} x2={x2 - 5 * spriteScale} y2={y2 - 6 * spriteScale} />
                      <line className="cv-bullet-chip" x1={x2 + 3 * spriteScale} y1={y2} x2={x2 + 7 * spriteScale} y2={y2 - 1 * spriteScale} />
                      <circle cx={x2} cy={y2 - 1 * spriteScale} r={1.4 * spriteScale} fill="rgba(255,220,140,0.92)" />
                    </g>
                  )}
                </g>
              )}
              {muzzleK > 0 && (
                <g className="cv-bullet-muzzle" opacity={muzzleK}>
                  <circle cx={x1} cy={y1}
                          r={(4 + 5 * (1 - muzzleK)) * spriteScale * muzzleScale}
                          fill="rgba(255,180,60,0.55)" />
                  <circle cx={x1} cy={y1}
                          r={(1.7 + 1.7 * (1 - muzzleK)) * spriteScale * muzzleScale}
                          fill="rgba(255,250,220,0.95)" />
                  <line x1={x1} y1={y1}
                        x2={x1 + ux * 18 * spriteScale * muzzleScale}
                        y2={y1 + uy * 18 * spriteScale * muzzleScale}
                        stroke="rgba(255,235,170,0.95)"
                        strokeWidth={(width + 0.6)}
                        strokeLinecap="round" />
                  <line x1={x1 - nx * 6 * spriteScale * muzzleScale} y1={y1 - ny * 6 * spriteScale * muzzleScale}
                        x2={x1 + nx * 6 * spriteScale * muzzleScale} y2={y1 + ny * 6 * spriteScale * muzzleScale}
                        stroke="rgba(255,210,120,0.7)"
                        strokeWidth={Math.max(0.9, width * 0.65)}
                        strokeLinecap="round"
                        strokeOpacity={0.75} />
                  <line x1={x1} y1={y1}
                        x2={x1 - ux * 5 * spriteScale * muzzleScale}
                        y2={y1 - uy * 5 * spriteScale * muzzleScale}
                        stroke="rgba(255,180,80,0.65)"
                        strokeWidth={Math.max(0.9, width * 0.6)}
                        strokeLinecap="round"
                        strokeOpacity={0.6} />
                </g>
              )}
              {hitImpactK > 0 && (
                <g className="cv-bullet-hitimpact">
                  <circle cx={x2} cy={y2}
                          r={(2.8 + 4 * (1 - hitImpactK)) * spriteScale}
                          fill="rgba(170,20,20,0.55)"
                          opacity={hitImpactK} />
                  <circle cx={x2} cy={y2}
                          r={(1.3 + 1.4 * (1 - hitImpactK)) * spriteScale}
                          fill="rgba(255,80,40,0.92)"
                          opacity={hitImpactK} />
                  {tr.impactSpread && tr.impactSpread.map((s, i) => {
                    const r = s.r * (0.4 + 1.1 * (1 - hitImpactK));
                    const sxp = x2 + Math.cos(s.ang) * r * spriteScale;
                    const syp = y2 + Math.sin(s.ang) * r * spriteScale + (1 - hitImpactK) * 4 * spriteScale;
                    return (
                      <circle key={i} cx={sxp} cy={syp}
                              r={s.sz * spriteScale}
                              fill="rgba(160,15,15,0.85)"
                              opacity={hitImpactK} />
                    );
                  })}
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
              const actor = battle.all.find(s => s.id === ev.actorId);
              const aimPart = ev.bodyPart || randomTrailPart(trailRng);
              const miss = ev.hit ? { x: 0, y: 0 } : trailMissOffset(trailRng, ev.ax, ev.tx);
              const impactSpread = ev.hit
                ? [0, 1, 2, 3, 4, 5].map(() => ({
                    ang: trailRng() * Math.PI * 2,
                    r: 5 + trailRng() * 7,
                    sz: 0.6 + trailRng() * 0.7
                  }))
                : null;
              newOnes.push({
                key: 'tr' + i,
                ax: ev.ax, ay: ev.ay,
                tx: ev.tx, ty: ev.ty,
                hit: ev.hit,
                actorCfg: actor && actor.cfg,
                weaponName: ev.weaponName || (actor && actor.weaponName),
                weaponCategory: ev.weaponCategory,
                bodyPart: ev.bodyPart,
                weaponType: ev.weaponType,
                shotProfile: ev.shotProfile,
                shotIndex: ev.shotIndex,
                shotCount: ev.shotCount,
                facing: ev.facing || (ev.tx >= ev.ax ? 1 : -1),
                aimPart,
                missKind: miss.kind || null,
                impactDx: (trailRng() - 0.5) * 5,
                impactDy: (trailRng() - 0.5) * 5,
                missDx: miss.x,
                missDy: miss.y,
                impactSpread,
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

        if (battle.done && battle.endHoldT >= resultOverlayDelay(battle.winner) && !resultShownRef.current) {
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
                          showHpBar={!!(hpFlashes[s.id] && hpFlashes[s.id] > nowMs && s.hp > 0 && s.state !== 'dead')}
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
