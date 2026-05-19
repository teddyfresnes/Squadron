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
  const EXPLOSION_FX_MS = 680;
  const BASE_TILE_PX = 24;              // reference tile size that maps to SPRITE_SCALE = 1.0
  const DEFAULT_MAGAZINE_SIZE = 8;
  const HP_FLASH_MS = 1700;
  const SHADOW_FOOT_Y = STAGE_H * 0.82;
  const BANNER_DURATION_MS = 3200;          // matches CSS @keyframes cv-banner-slide
  const RESULT_POPUP_DELAY_MS = 2600;       // time after battle.done before the reward popup opens
  const TOKEN_REWARD_WIN = 2;
  const TOKEN_REWARD_LOSE = 1;

  function frameForState(state, stateT, s) {
    const anim = window.Anims[state] || window.Anims.idle;
    let totalFrames = anim.frames;
    if (state === 'reload' && s && s.animState && s.animState.reloadRounds != null
        && typeof anim.framesForRounds === 'function') {
      totalFrames = anim.framesForRounds(s.animState.reloadRounds);
    }
    const idx = stateT * anim.fps;
    if (anim.loop === false) return Math.min(Math.floor(idx), totalFrames - 1);
    return Math.floor(idx) % totalFrames;
  }

  function animDuration(state) {
    const anim = window.Anims && window.Anims[state];
    return anim ? anim.frames / anim.fps : 0;
  }

  function computeBattleReward(battle) {
    if (!battle) return 0;
    if (battle.winner === 'A') return TOKEN_REWARD_WIN;
    if (battle.winner === 'B') return TOKEN_REWARD_LOSE;
    return TOKEN_REWARD_LOSE;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
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

  function ammoLimitsForWeaponName(name) {
    if (window.CombatSim && typeof window.CombatSim.resolveAmmoLimits === 'function') {
      return window.CombatSim.resolveAmmoLimits(name);
    }
    return { magSize: DEFAULT_MAGAZINE_SIZE, reserveCap: 0 };
  }

  function magazineSizeFor(s) {
    if (s && s.weaponName) {
      const limits = ammoLimitsForWeaponName(s.weaponName);
      if (limits.magSize) return limits.magSize;
    }
    const stats = s.weapon;
    return Math.max(1, Math.round((stats && stats.magazineSize) || DEFAULT_MAGAZINE_SIZE));
  }

  function magazineSizeForWeaponName(name) {
    return ammoLimitsForWeaponName(name).magSize || DEFAULT_MAGAZINE_SIZE;
  }

  function reserveAmmoForWeaponName(name) {
    return ammoLimitsForWeaponName(name).reserveCap || 0;
  }

  function ammoStateForWeapon(s, weaponName) {
    if (s && s.ammo && s.ammo[weaponName]) return s.ammo[weaponName];
    // Fallback when ammo wasn't initialised (older sim or no stats found).
    const limits = ammoLimitsForWeaponName(weaponName);
    return { loaded: limits.magSize, reserve: limits.reserveCap };
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

  // Resolves the actual Anims key from a soldier's state, expanding variants
  // that share a state but use different animations under the same 'dead'
  // combat state.
  function effectiveAnimKey(s) {
    // Tossed bodies (still alive, mid-flight from a rocket blast) reuse the
    // deadExplode anim — same launch -> peak -> fall -> bounce arc. The sim
    // converts the state to 'dead' on the landing frame if fall damage kills.
    if (s.state === 'tossed') return 'deadExplode';
    if (s.state === 'dead' && s.animState && s.animState.deadVariant === 'explode') {
      return 'deadExplode';
    }
    if (s.state === 'dead' && s.animState && s.animState.deadVariant === 'fall') {
      return 'dead2';
    }
    return s.state;
  }

  function flightOffsetY(animKey, frame, spriteScale, s) {
    const anim = window.Anims && window.Anims[animKey];
    if (!anim || typeof anim.flightY !== 'function') return 0;
    // Tossed soldiers carry a random height multiplier so a blast group
    // doesn't lift in lockstep (the user explicitly asked for varied heights,
    // sometimes "tres haut"). The multiplier was rolled by tossSoldier().
    const heightMult = (s && s.animState && s.animState.toss && s.animState.toss.height) || 1;
    return Math.round(anim.flightY(frame) * spriteScale * heightMult);
  }

  // ── Soldier sprite, absolutely positioned on the arena ────────────────────
  function ArenaSoldier({ s, arenaH, pxPerTile, spriteScale, xOffset, isActive, isSelected, showHpBar, onSelect }) {
    const SpriteCanvas = UI.SpriteCanvas;
    const animKey = effectiveAnimKey(s);
    const frame = frameForState(animKey, s.stateT, s);
    const layout = getSoldierLayout(s, arenaH, pxPerTile, spriteScale, xOffset);
    const flightY = flightOffsetY(animKey, frame, spriteScale, s);
    const life = hpPct(s);
    const hpLabel = hpText(s);
    const shadowTop = Math.round(SHADOW_FOOT_Y * spriteScale);
    const hpTop = Math.round(STAGE_H * 0.04 * spriteScale);

    function handleClick(ev) {
      ev.stopPropagation();
      if (onSelect) onSelect(s.id);
    }

    // Visual selection (gold halo + bottom marker) is suppressed for dead
    // soldiers — the cv-soldier <button> is positioned by s.x but the dead
    // animation can drag the rendered body away (death rotation, deathBackShift,
    // bounce), so the circle would dangle next to a corpse that's no longer
    // there. Click still selects so the inspect panel can show their stats.
    const showSelection = isSelected && s.state !== 'dead';
    const soldierStyle = { left: layout.left, top: layout.top, width: layout.stageW, height: layout.stageH };
    if (flightY) soldierStyle.transform = 'translateY(' + flightY + 'px)';

    return (
      <button type="button"
              className={'cv-soldier' + (isActive ? ' is-active' : '') + (showSelection ? ' is-selected' : '') + (animKey === 'deadExplode' ? ' is-exploding' : '') + (s.state === 'tossed' ? ' is-tossed' : '')}
              style={soldierStyle}
              onClick={handleClick}
              aria-label={(s.name || 'Soldat') + ', niveau ' + (s.level || 1)}
              aria-pressed={isSelected}>
        {s.state !== 'dead' && s.state !== 'tossed' && s.state !== 'lain' && (
          <div className="cv-ground-shadow" style={{ top: shadowTop }} />
        )}
        {showSelection && <div className="cv-selected-marker" />}
        <SpriteCanvas
          cfg={s.cfg}
          animKey={animKey}
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
        {s.state === 'reload' && s.reloadProgress && (
          <ReloadIndicator progress={s.reloadProgress} top={hpTop} />
        )}
      </button>
    );
  }

  // Mini magazine shown above the soldier while reloading: total = rounds being
  // loaded this action, filled = rounds already chambered. One new yellow bullet
  // pops in each time the reload animation completes a seating motion.
  function ReloadIndicator({ progress, top }) {
    const total = Math.max(1, Math.round(progress.total || 1));
    const filled = clamp(Math.round(progress.seated || 0), 0, total);
    const bullets = [];
    for (let i = 0; i < total; i++) bullets.push(i);
    return (
      <div className="cv-reload-indicator" style={{ top }} aria-hidden="true">
        <div className="cv-reload-count">{filled}/{total}</div>
        <div className="cv-reload-bullets">
          {bullets.map(i => (
            <span key={i}
                  className={'cv-reload-bullet' + (i < filled ? ' is-full' : ' is-empty')} />
          ))}
        </div>
      </div>
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
    const count = Math.max(0, Math.round(total || 0));
    if (count === 0) return null;
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

  // Yellow bullet = round currently held (loaded magazine row, reserve row);
  // dark slot = the capacity that exists but has no round in it right now.
  function AmmoStack({ magSize, reserveSize, loaded, reserveCur }) {
    const mag = Math.max(1, Math.round(magSize || DEFAULT_MAGAZINE_SIZE));
    const reserve = Math.max(0, Math.round(reserveSize || 0));
    return (
      <div className="cv-ammo-stack" aria-hidden="true">
        <AmmoRow total={mag} filled={loaded} small loaded />
        <AmmoRow total={reserve} filled={reserveCur} small reserve />
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
            const reserveCap = reserveAmmoForWeaponName(w.name);
            const state = ammoStateForWeapon(s, w.name);
            const isActive = w.name === s.weaponName;
            const isReloading = isActive && s.state === 'reload' && s.reloadProgress;
            return (
              <div key={w.name}
                   className={'cv-inspect-weapon-card' + (isActive ? ' is-active' : '') + (isReloading ? ' is-reloading' : '')}
                   aria-label={w.name}
                   onMouseMove={(ev) => trackCursor(ev, w.name)}
                   onMouseLeave={clearCursor}>
                <div className="cv-inspect-weapon-card-img">
                  {WeaponIcon ? <WeaponIcon weapon={w} scale={0.74} /> : <span className="cv-weapon-placeholder" />}
                </div>
                <AmmoStack magSize={mag} reserveSize={reserveCap}
                           loaded={state.loaded} reserveCur={state.reserve} />
                {isReloading && (
                  <div className="cv-inspect-reload-badge"
                       aria-label={'Recharge ' + s.reloadProgress.seated + ' sur ' + s.reloadProgress.total}>
                    RECHARGE {s.reloadProgress.seated}/{s.reloadProgress.total}
                  </div>
                )}
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

  // ── Rocket projectiles + smoke trail (bazooka-class weapons) ────────────
  // Each rocket flies from the shooter's muzzle to its end point over
  // `travelMs`. Hits end at the target's feet; misses keep going off-screen.
  // A train of smoke puffs is emitted along the path, each fading as it ages,
  // leaving the classic comet-tail look. World coords are stored on the
  // rocket entry and resolved to pixels at render so a resize stays correct.
  function RocketsLayer({ rockets, arenaW, arenaH, pxPerTile, spriteScale, xOffset, nowMs }) {
    const laneScale = pxPerTile / BASE_TILE_PX;
    const groundY = arenaH * GROUND_Y_RATIO;
    function worldToPx(tx, ty) {
      return {
        x: xOffset + tx * pxPerTile,
        // ty is laneOffsetPx in world (negative = "back/up the slope"). Match
        // soldier vertical placement so rockets line up with sprites visually.
        y: groundY + ty * laneScale - STAGE_H * spriteScale * 0.42
      };
    }
    // Resolve the launch position to the actual weapon muzzle tip instead of
    // a body-center fallback, otherwise the rocket reads as appearing out of
    // the soldier's chest. Uses the same helper bullet trails use.
    function muzzleFor(r) {
      const muzzle = trailMuzzlePoint(r);
      const stageLeft = xOffset + r.ax * pxPerTile - (STAGE_W * spriteScale) / 2;
      const stageTop = groundY + r.ay * laneScale - STAGE_H * spriteScale;
      if (muzzle) {
        return {
          x: stageLeft + muzzle.x * spriteScale,
          y: stageTop + muzzle.y * spriteScale
        };
      }
      return worldToPx(r.ax, r.ay);
    }
    return (
      <svg className="cv-rockets" width={arenaW} height={arenaH}
           viewBox={`0 0 ${arenaW} ${arenaH}`} preserveAspectRatio="none">
        {rockets.map(r => {
          const age = nowMs - r.bornMs;
          const t = clamp(age / r.travelMs, 0, 1);
          const start = muzzleFor(r);
          const end = worldToPx(r.endX, r.endY);
          // Very small arc for BOTH hits and misses — the rocket should fly
          // fast and nearly straight so the player can't read hit-vs-miss
          // from the trajectory shape. Just enough sag to feel like a
          // ballistic projectile.
          const arcPx = 5 * spriteScale;
          const x = lerp(start.x, end.x, t);
          const arc = Math.sin(t * Math.PI) * arcPx;
          const y = lerp(start.y, end.y, t) - arc;
          // Path heading for sprite rotation.
          const dxTotal = end.x - start.x;
          const dyTotal = (end.y - start.y) - arcPx * Math.PI * Math.cos(t * Math.PI);
          const angle = Math.atan2(dyTotal, dxTotal) * 180 / Math.PI;
          // Smoke puffs along the trail. Dense + white, drifting up and
          // expanding as they age so the trail reads from the back row.
          const puffEveryMs = 14;
          const puffMaxAgeMs = 900;
          const puffs = [];
          for (let pAge = 0; pAge <= Math.min(age, puffMaxAgeMs); pAge += puffEveryMs) {
            const emitAge = age - pAge;
            if (emitAge < 0) break;
            const emitT = clamp(emitAge / r.travelMs, 0, 1);
            // Puff origin = position the rocket was at when this puff was emitted.
            const ppx = lerp(start.x, end.x, emitT);
            const ppyArc = Math.sin(emitT * Math.PI) * arcPx;
            const ppy = lerp(start.y, end.y, emitT) - ppyArc;
            const k = clamp(1 - pAge / puffMaxAgeMs, 0, 1);
            // Each puff grows + drifts upward as it ages so the trail
            // billows like real exhaust smoke.
            const ageK = 1 - k;
            puffs.push({
              x: ppx + (pAge * 0.012 * spriteScale),
              y: ppy - pAge * 0.04 * spriteScale,
              r: (6 + ageK * 16) * spriteScale,
              alpha: 0.85 * k
            });
          }
          const finished = t >= 1;
          // Rocket sprite scale — kept compact so the projectile reads as
          // "fast little missile" rather than a slow blimp. The fast travel
          // time (ROCKET_TRAVEL_T) plus the bright exhaust still make it
          // clearly visible on screen.
          const RS = 1.0;
          return (
            <g key={r.key} className="cv-rocket-fx">
              {puffs.map((p, i) => (
                <g key={i}>
                  <circle className="cv-rocket-smoke-halo"
                          cx={p.x} cy={p.y}
                          r={p.r * 1.4} opacity={p.alpha * 0.35} />
                  <circle className="cv-rocket-smoke"
                          cx={p.x} cy={p.y}
                          r={p.r} opacity={p.alpha} />
                  <circle className="cv-rocket-smoke-core"
                          cx={p.x - 1 * spriteScale} cy={p.y - 1 * spriteScale}
                          r={p.r * 0.55} opacity={p.alpha * 0.85} />
                </g>
              ))}
              {!finished && (
                <g transform={`translate(${x},${y}) rotate(${angle})`}>
                  <polygon className="cv-rocket-fins"
                           points={`${-7 * RS * spriteScale},${-1.8 * RS * spriteScale} ${-10 * RS * spriteScale},${-3.6 * RS * spriteScale} ${-10 * RS * spriteScale},${3.6 * RS * spriteScale} ${-7 * RS * spriteScale},${1.8 * RS * spriteScale}`} />
                  <rect className="cv-rocket-body"
                        x={-7 * RS * spriteScale} y={-1.7 * RS * spriteScale}
                        width={11 * RS * spriteScale} height={3.4 * RS * spriteScale}
                        rx={1.3 * RS * spriteScale} />
                  <polygon className="cv-rocket-tip"
                           points={`${4 * RS * spriteScale},${-1.7 * RS * spriteScale} ${9 * RS * spriteScale},0 ${4 * RS * spriteScale},${1.7 * RS * spriteScale}`} />
                  {/* Bright twin-cone exhaust flame at the tail */}
                  <ellipse className="cv-rocket-flame-outer"
                           cx={-13 * RS * spriteScale} cy={0}
                           rx={5.5 * RS * spriteScale} ry={2.2 * RS * spriteScale} />
                  <ellipse className="cv-rocket-flame"
                           cx={-12 * RS * spriteScale} cy={0}
                           rx={3.6 * RS * spriteScale} ry={1.4 * RS * spriteScale} />
                  <ellipse className="cv-rocket-flame-core"
                           cx={-11 * RS * spriteScale} cy={0}
                           rx={2 * RS * spriteScale} ry={0.7 * RS * spriteScale} />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    );
  }

  // Single explosion sequence under assets/animations/explosion/. 16 large
  // pixel-art frames, frame 12 missing on disk — files numbered 1..11, 13..17.
  const EXPLOSION_VARIANTS = {
    explosion:  { count: 16, dir: 'assets/animations/explosion/',  baseSize: 160, frameForIdx: function (i) { return i < 11 ? (i + 1) : (i + 2); } }
  };
  function explosionFrameSrc(variant, i) {
    const v = EXPLOSION_VARIANTS[variant] || EXPLOSION_VARIANTS.explosion;
    return v.dir + v.frameForIdx(i) + '.png';
  }

  // ── Explosion overlay for explosive death variants ───────────────────────
  function ExplosionLayer({ explosions, arenaW, arenaH, pxPerTile, spriteScale, xOffset, nowMs }) {
    const laneScale = pxPerTile / BASE_TILE_PX;
    return (
      <div className="cv-explosions" style={{ width: arenaW, height: arenaH }}>
        {explosions.map(ex => {
          const age = nowMs - ex.bornMs;
          const t = clamp(age / EXPLOSION_FX_MS, 0, 1);
          if (t >= 1) return null;
          const variantKey = ex.variant || 'explosion';
          const variant = EXPLOSION_VARIANTS[variantKey] || EXPLOSION_VARIANTS.explosion;
          const groundY = arenaH * GROUND_Y_RATIO + ex.y * laneScale;
          const x = xOffset + ex.x * pxPerTile;
          // Rocket impacts blast at the target's feet ("sous ses pieds") —
          // the explosion center sits just above the ground line so the
          // sprite straddles the impact point. Body-explosion deaths can
          // still float higher via ex.atFeet === false.
          const baseSize = variant.baseSize;
          const scale = ex.scale || 1;
          const size = baseSize * spriteScale * scale;
          // Anchor the bottom of the sprite slightly above the ground line
          // so the fire pools at the impact point instead of floating up
          // at chest height. The user explicitly asked: "exploser pile la
          // ou la roquette atterrit".
          const bottomY = ex.atFeet
            ? groundY + 4 * spriteScale
            : groundY - 42 * spriteScale + size / 2;
          const y = bottomY - size / 2;
          // Pick the current animation frame by elapsed wallclock time.
          const frame = clamp(Math.floor(t * variant.count), 0, variant.count - 1);
          return (
            <img key={ex.key}
                 className={'cv-explosion-sprite cv-explosion-' + variantKey}
                 src={explosionFrameSrc(variantKey, frame)}
                 alt=""
                 draggable={false}
                 style={{
                   left: Math.round(x - size / 2),
                   top: Math.round(y - size / 2),
                   width: Math.round(size),
                   height: Math.round(size)
                 }} />
          );
        })}
      </div>
    );
  }

  // ── Big sliding banner shown the moment a winner is decided ───────────────
  function ResultBanner({ winner, isPaused }) {
    const cls = winner === 'A' ? 'cv-banner-win'
              : winner === 'B' ? 'cv-banner-lose'
              : 'cv-banner-draw';
    const text = winner === 'A' ? 'VICTOIRE !'
               : winner === 'B' ? 'DÉFAITE !'
               : 'ÉGALITÉ';
    return (
      <div className={'cv-banner ' + cls + (isPaused ? ' is-paused' : '')} aria-live="polite">
        <span className="cv-banner-text">{text}</span>
      </div>
    );
  }

  // ── Reward popup (dim overlay + tokens + Continue, Enter/Space to skip) ───
  function ResultOverlay({ winner, mySquad, oppSquad, battle, tokensWon, onContinue }) {
    const isWin = winner === 'A';
    const isDraw = winner === 'draw';
    const survivors = battle.all.filter(s => s.team === 'A' && s.hp > 0).length;
    const enemiesDown = battle.all.filter(s => s.team === 'B' && s.hp <= 0).length;

    useEffect(() => {
      function onKey(ev) {
        if (ev.key === 'Enter' || ev.key === ' ' || ev.code === 'Space') {
          ev.preventDefault();
          onContinue();
        }
      }
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [onContinue]);

    const title = isWin ? 'VICTOIRE' : (isDraw ? 'ÉGALITÉ' : 'DÉFAITE');
    let message;
    if (isWin) {
      message = `Vous avez gagné ${tokensWon} token${tokensWon > 1 ? 's' : ''} en battant la squad ${oppSquad.name}.`;
    } else if (isDraw) {
      message = `Match nul face à la squad ${oppSquad.name}.`;
    } else {
      message = `La squad ${oppSquad.name} l'emporte. Vous gagnez quand même ${tokensWon} token.`;
    }

    return (
      <div className="cv-result">
        <div className={'cv-result-card ' + (isWin ? 'cv-win' : 'cv-lose')}
             onClick={(ev) => ev.stopPropagation()}>
          <div className="cv-result-title">{title}</div>
          <div className="cv-result-sub">{message}</div>
          <div className="cv-result-tokens" aria-label={tokensWon + ' tokens gagnés'}>
            <img src="assets/images/icons/coin.png" alt="" aria-hidden="true" />
            <span>+{tokensWon}</span>
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
    const bannerShownRef = useRef(false);
    const resultShownRef = useRef(false);
    const [arenaSize, setArenaSize] = useState({ w: 1200, h: 320 });
    const [, setTick] = useState(0);
    const [trails, setTrails] = useState([]);
    const [rockets, setRockets] = useState([]);
    const [explosions, setExplosions] = useState([]);
    const [hpFlashes, setHpFlashes] = useState({});
    const [bannerShown, setBannerShown] = useState(false);
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
        setRockets([]);
        setExplosions([]);
        bannerShownRef.current = false;
        resultShownRef.current = false;
        setBannerShown(false);
        setResultShown(false);
        setBattle(b);
      });
      return () => {
        alive = false;
      };
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
          const newRockets = [];
          const newExplosions = [];
          const newHpFlashes = {};
          for (let i = lastEventIdx; i < battle.events.length; i++) {
            const ev = battle.events[i];
            if (ev.type === 'shoot' && !ev.melee) {
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
            if (ev.type === 'die' && ev.deadVariant === 'explode' && !ev.fromToss) {
              const target = battle.all.find(s => s.id === ev.targetId);
              if (target) {
                newExplosions.push({
                  key: 'ex' + i,
                  x: target.x,
                  y: target.laneOffsetPx,
                  variant: 'explosion',
                  bornMs: now
                });
              }
            }
            if (ev.type === 'rocketLaunch') {
              const actor = battle.all.find(s => s.id === ev.actorId);
              newRockets.push({
                key: 'rk' + i,
                ax: ev.ax, ay: ev.ay,
                endX: ev.endX, endY: ev.endY,
                hit: !!ev.hit,
                travelMs: Math.max(60, Math.round((ev.travelT || 0.7) * 1000)),
                // Muzzle resolution params — same shape trailMuzzlePoint uses
                // for bullet trails. Lets RocketsLayer anchor the projectile
                // to the actual launcher muzzle tip instead of the body
                // center, which matches the smoke origin the user expects.
                actorCfg: actor && actor.cfg,
                weaponName: ev.weaponName,
                weaponCategory: ev.weaponCategory,
                weaponType: ev.weaponType,
                shotProfile: ev.shotProfile || ev.weaponCategory,
                shotIndex: 0,
                shotCount: 1,
                facing: ev.facing || (ev.endX >= ev.ax ? 1 : -1),
                bornMs: now
              });
            }
            if (ev.type === 'rocketImpact' && ev.hit) {
              newExplosions.push({
                key: 'rkex' + i,
                x: ev.tx,
                y: ev.ty,
                atFeet: true,
                scale: 1.25,
                variant: 'explosion',
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
          if (newRockets.length) {
            setRockets(prev => prev.concat(newRockets));
          }
          if (newExplosions.length) {
            setExplosions(prev => prev.concat(newExplosions));
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
        setExplosions(prev => {
          const kept = prev.filter(ex => now - ex.bornMs < EXPLOSION_FX_MS);
          return kept.length === prev.length ? prev : kept;
        });
        // Rockets live for their flight time plus a generous smoke-fade tail
        // so the last puffs aren't snipped before fully fading out.
        setRockets(prev => {
          const kept = prev.filter(rk => now - rk.bornMs < rk.travelMs + 700);
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

        if (battle.done && !bannerShownRef.current) {
          bannerShownRef.current = true;
          setBannerShown(true);
        }
        // Popup countdown is driven by battle.endHoldT (sim time since the
        // battle ended). The sim doesn't step while paused, so endHoldT stays
        // frozen and the popup waits until the player un-pauses.
        if (battle.done && !resultShownRef.current
            && battle.endHoldT * 1000 >= RESULT_POPUP_DELAY_MS) {
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
          <RocketsLayer rockets={rockets}
                        arenaW={arenaSize.w} arenaH={arenaSize.h}
                        pxPerTile={pxPerTile} spriteScale={spriteScale} xOffset={xOffset}
                        nowMs={nowMs} />
          <ExplosionLayer explosions={explosions}
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
          {bannerShown && <ResultBanner winner={battle.winner} isPaused={isPaused} />}
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
            tokensWon={computeBattleReward(battle)}
            onContinue={() => {
              const tokensWon = computeBattleReward(battle);
              onDone({ winner: battle.winner, tokensWon, oppName: oppSquad.name });
            }}
          />
        )}
      </div>
    );
  }

  window.HQBattleScreen = HQBattleScreen;

})();
