// Combat view — drives CombatSim and renders the battle on screen.
// Each soldier is a positioned <SpriteCanvas> on top of an arena background.
// HP bars and bullet trails are an SVG overlay above the soldiers.

(function () {

  const { useState, useEffect, useRef } = React;
  const UI = window.SquadronUI;

  const STAGE_W = (UI && UI.STAGE_W) || 256;
  const STAGE_H = (UI && UI.STAGE_H) || 112;
  const GROUND_Y_RATIO = 0.78;          // where the ground line sits inside the arena
  const BULLET_TRAIL_MS = 220;          // turn-based pacing → trails linger longer
  const BASE_TILE_PX = 24;              // reference tile size that maps to SPRITE_SCALE = 1.0
  const DEFAULT_MAGAZINE_SIZE = 8;
  const BODY_PART_META = [
    { key: 'head', className: 'head', label: 'Tete' },
    { key: 'torso', className: 'torso', label: 'Torse' },
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

  // ── Soldier sprite, absolutely positioned on the arena ────────────────────
  function ArenaSoldier({ s, arenaH, pxPerTile, spriteScale, xOffset, isActive, isSelected, onSelect }) {
    const SpriteCanvas = UI.SpriteCanvas;
    const frame = frameForState(s.state, s.stateT);
    const layout = getSoldierLayout(s, arenaH, pxPerTile, spriteScale, xOffset);
    const life = hpPct(s);

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
        <SpriteCanvas
          cfg={s.cfg}
          animKey={s.state}
          frame={frame}
          scale={spriteScale}
          facing={s.facing}
        />
        {s.hp > 0 && (
          <div className="cv-hpbar">
            <div className="cv-hpbar-fill" style={{ width: life + '%' }} />
          </div>
        )}
        {isActive && s.hp > 0 && <div className="cv-active-marker" />}
        {isSelected && <div className="cv-selected-marker" />}
      </button>
    );
  }

  function BodyGraph({ s }) {
    const hits = s.bodyHits || {};
    return (
      <div className="cv-body-graph" role="img" aria-label="Etat du corps">
        {BODY_PART_META.map(part => {
          const hitLevel = clamp(hits[part.key] || 0, 0, 2);
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
    const layout = getSoldierLayout(s, arenaH, pxPerTile, spriteScale, xOffset);
    const panelW = Math.max(252, Math.min(332, arenaW - 16));
    const panelH = 278;
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
            <div className={'cv-life-rail' + (life <= 35 ? ' is-low' : '')} aria-hidden="true">
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
          const k = Math.max(0, 1 - age / BULLET_TRAIL_MS);
          if (k <= 0) return null;
          const groundY = arenaH * GROUND_Y_RATIO;
          const chestY = STAGE_H * spriteScale * 0.55;
          const x1 = xOffset + tr.ax * pxPerTile;
          const y1 = groundY + tr.ay * laneScale - chestY;
          const x2 = xOffset + tr.tx * pxPerTile + (tr.hit ? 0 : tr.missDx);
          const y2 = groundY + tr.ty * laneScale - chestY + (tr.hit ? 0 : tr.missDy);
          return (
            <line key={tr.key}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={tr.hit ? '#ffd87a' : '#ffe9a8'}
                  strokeOpacity={k}
                  strokeWidth={1.4} />
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
    const [arenaSize, setArenaSize] = useState({ w: 1200, h: 320 });
    const [, setTick] = useState(0);
    const [trails, setTrails] = useState([]);
    const [resultShown, setResultShown] = useState(false);
    const [selectedSoldierId, setSelectedSoldierId] = useState(null);

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
        setBattle(b);
      });
      return () => { alive = false; };
    }, [mySquad, oppSquad]);

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
          for (let i = lastEventIdx; i < battle.events.length; i++) {
            const ev = battle.events[i];
            if (ev.type !== 'shoot') continue;
            newOnes.push({
              key: 'tr' + i,
              ax: ev.ax, ay: ev.ay,
              tx: ev.tx, ty: ev.ty,
              hit: ev.hit,
              missDx: (trailRng() - 0.5) * 24,
              missDy: (trailRng() - 0.5) * 14,
              bornMs: now
            });
          }
          if (newOnes.length) {
            setTrails(prev => prev.concat(newOnes));
          }
          lastEventIdx = battle.events.length;
        }

        // Garbage-collect expired trails — only re-set if anything actually expired.
        setTrails(prev => {
          const kept = prev.filter(tr => now - tr.bornMs < BULLET_TRAIL_MS);
          return kept.length === prev.length ? prev : kept;
        });
        setTick(n => (n + 1) % 1000000);

        if (battle.done && battle.endHoldT >= 1.2 && !resultShown) {
          setResultShown(true);
        }

        raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
      // tick is intentionally omitted — the loop owns its own cadence
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [battle, resultShown]);

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

    return (
      <div className="cv-screen" ref={containerRef}>
        <div className="cv-arena"
             style={{ width: arenaSize.w, height: arenaSize.h }}
             onClick={() => setSelectedSoldierId(null)}>
          <div className="cv-bg" />
          {/* Soldiers, sorted so the one at the back lane renders first */}
          {battle.all.slice().sort((a, b) => a.laneOffsetPx - b.laneOffsetPx).map(s => (
            <ArenaSoldier key={s.id} s={s} arenaH={arenaSize.h}
                          pxPerTile={pxPerTile} spriteScale={spriteScale} xOffset={xOffset}
                          isActive={(battle.activeActions || []).some(a => a.actorId === s.id)}
                          isSelected={selectedSoldierId === s.id}
                          onSelect={(id) => setSelectedSoldierId(prev => prev === id ? null : id)} />
          ))}
          <TrailsLayer trails={trails}
                       arenaW={arenaSize.w} arenaH={arenaSize.h}
                       pxPerTile={pxPerTile} spriteScale={spriteScale} xOffset={xOffset}
                       nowMs={nowMs} />
          {selectedSoldier && (
            <SoldierInspectMenu
              s={selectedSoldier}
              arenaW={arenaSize.w}
              arenaH={arenaSize.h}
              pxPerTile={pxPerTile}
              spriteScale={spriteScale}
              xOffset={xOffset}
              onClose={() => setSelectedSoldierId(null)}
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
