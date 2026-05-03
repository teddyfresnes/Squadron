// HQ — persistent shell after login.
// Floating tabs + left sidebar (stats/soldiers) + main content area.
// Wrapped in an IIFE so top-level consts don't collide with app.jsx / game.jsx.

(function () {

const { useState, useEffect, useMemo, useCallback, useRef } = React;

const G = window.SquadronGame.helpers;
const UI = window.SquadronUI;

const HQ_KEY      = (sname) => 'squadron-hq-' + sname;
const RECRUIT_KEY = (sname) => 'squadron-recruit-' + sname;

const RECRUIT_COST_BASE = 100;
const UPGRADE_COST_BASE = 80;
const STARTING_TOKENS   = 250;

const FAKE_SQUAD_NAMES = [
  'Wolves','Cobra','Phantom','Iron','Viper','Sentinels','Black Hawks','Falcons',
  'Reapers','Crimson','Steel Owls','Nightshade','Rogue','Tempête','Spectre',
  'Garde Noire','Lions','Vautours','Sangliers','Fer de Lance'
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function todayKey() { return new Date().toISOString().slice(0, 10); }

function loadHQ(sname) {
  try {
    const raw = localStorage.getItem(HQ_KEY(sname));
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}
function saveHQ(sname, data) {
  try { localStorage.setItem(HQ_KEY(sname), JSON.stringify(data)); } catch (_) {}
}

function hashStr(s) {
  let h = 1779033703 ^ String(s).length;
  for (let i = 0; i < String(s).length; i++) {
    h = Math.imul(h ^ String(s).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function newId(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function soldierFromGenerated(gen) {
  // gen has { id, config, name, skill1Name, skill2Name }
  const unlocked = [];
  if (gen.skill1Name) unlocked.push(gen.skill1Name);
  if (gen.skill2Name && gen.skill2Name !== gen.skill1Name) unlocked.push(gen.skill2Name);
  return {
    id: gen.id || newId('sld'),
    name: gen.name,
    config: gen.config,
    level: 1,
    xp: 0,
    unlockedWeapons: unlocked,        // array of weapon names
    preferredWeapon: gen.skill1Name || null,
  };
}

function calcSquadPower(soldiers) {
  return soldiers.reduce((sum, s) => {
    return sum + 10 * (s.level || 1) + 2 * ((s.unlockedWeapons || []).length);
  }, 0);
}
function calcSquadLevel(soldiers) {
  const total = soldiers.reduce((s, x) => s + (x.level || 1), 0);
  return Math.max(1, 1 + Math.floor((total + soldiers.length) / 4));
}
function calcUpgradeCost(soldier) {
  return UPGRADE_COST_BASE * (soldier.level || 1);
}

// ── Initial HQ state ─────────────────────────────────────────────────────────
function initialHQState(squadName, founder) {
  const soldiers = [];
  if (founder) soldiers.push(soldierFromGenerated({
    id: newId('sld'),
    name: founder.name,
    config: founder.config,
    skill1Name: founder.skill1Name,
    skill2Name: founder.skill2Name,
  }));
  return {
    name:   squadName,
    tokens: STARTING_TOKENS,
    soldiers,
    createdAt: Date.now(),
  };
}

// Recruit pool — 5 random soldiers, refreshed daily, persisted per squad.
function getRecruitPool(squadName) {
  try {
    const raw = localStorage.getItem(RECRUIT_KEY(squadName));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.date === todayKey() && Array.isArray(parsed.soldiers)) {
        return parsed.soldiers;
      }
    }
  } catch (_) {}
  return null;
}
function buildRecruitPool(squadName) {
  const list = G.buildSoldiers(5);
  try {
    localStorage.setItem(RECRUIT_KEY(squadName), JSON.stringify({ date: todayKey(), soldiers: list }));
  } catch (_) {}
  return list;
}
function rerollRecruitPool(squadName) {
  try { localStorage.removeItem(RECRUIT_KEY(squadName)); } catch (_) {}
  return buildRecruitPool(squadName);
}

// ── HQHeader ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'play',     label: 'Jouer' },
  { id: 'squad',    label: 'Ma squad' },
  { id: 'market',   label: 'Marché' },
  { id: 'settings', label: 'Paramètres' },
];

function HQHeader({ tab, onTab }) {
  return (
    <header className="hq-header">
      <nav className="hq-tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={'hq-tab' + (tab === t.id ? ' active' : '')}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

// ── HQSidebar ────────────────────────────────────────────────────────────────
function HQSidebar({ soldiers, selectedId, onSelect, onAdd, isRecruiting, tokens, power, serverOnline }) {
  const { AnimPreview } = UI;
  return (
    <aside className="hq-sidebar">
      <div className="hq-sidebar-stats">
        <div className="hq-stat hq-stat-tokens" title="Tokens">
          <span className="hq-stat-icon" aria-hidden="true">●</span>
          <span className="hq-stat-key">TOKENS</span>
          <span className="hq-stat-val">{tokens}</span>
        </div>
        <div className="hq-stat hq-stat-power" title="Power">
          <span className="hq-stat-icon" aria-hidden="true">⚡</span>
          <span className="hq-stat-key">POWER</span>
          <span className="hq-stat-val">{power}</span>
        </div>
        {!serverOnline && <div className="hq-offline-pill" title="Mode hors ligne">HORS LIGNE</div>}
      </div>
      <div className="hq-sidebar-title">MES SOLDATS <span className="hq-sidebar-count">{soldiers.length}</span></div>
      <div className="hq-sidebar-list">
        {soldiers.map(s => (
          <button
            key={s.id}
            type="button"
            className={'hq-sb-soldier' + (selectedId === s.id ? ' active' : '')}
            onClick={() => onSelect(s.id)}
          >
            <div className="hq-sb-stage">
              <div className="hq-sb-level">{s.level}</div>
              <div className="hq-sb-char">
                <AnimPreview cfg={s.config} animKey="idle" scale={0.72} facing={1} running={false} />
              </div>
            </div>
            <div className="hq-sb-name" title={s.name}>{s.name}</div>
          </button>
        ))}

        <button
          type="button"
          className={'hq-sb-add' + (isRecruiting ? ' active' : '')}
          onClick={onAdd}
          title="Recruter un nouveau soldat"
        >
          <div className="hq-sb-add-plus">＋</div>
          <div className="hq-sb-add-label">Recruter</div>
        </button>
      </div>
    </aside>
  );
}

// ── HQPlay (default Jouer page — modes grid + battles counter) ──────────────
const PLAY_MODES = [
  {
    id: 'army-vs-army',
    label: 'Armée vs Armée',
    cover: 'assets/images/covers_mode/armyvsarmy.png',
    available: true,
  },
  {
    id: 'survival',
    label: 'Survie',
    accent: 'mode-accent-green',
    available: false,
  },
  {
    id: 'tournament',
    label: 'Tournoi',
    accent: 'mode-accent-amber',
    available: false,
  },
  {
    id: 'boss',
    label: 'Boss du jour',
    accent: 'mode-accent-red',
    available: false,
  },
];

function HQPlay({ squadName, onPickMode }) {
  return (
    <div className="hq-play">
      <div className="hq-play-header">
        <div className="hq-play-eyebrow">QUARTIER GÉNÉRAL</div>
        <h1 className="hq-play-title">{squadName}</h1>
      </div>

      <div className="hq-modes">
        {PLAY_MODES.map(m => (
          <div
            key={m.id}
            className={'hq-mode-shell' + (m.accent ? ' ' + m.accent : '') + (m.available ? '' : ' is-locked')}
          >
            <div className="hq-mode-card">
              <div className="hq-mode-card-header">{m.label.toUpperCase()}</div>

              {/* Cover — decorative only, not interactive */}
              <div className="hq-mode-cover-area">
                {m.cover
                  ? <img src={m.cover} alt="" className="hq-mode-cover-img" />
                  : <div className="hq-mode-cover-placeholder" />
                }
                {!m.available && <div className="hq-mode-empty">À VENIR</div>}
              </div>

              {/* Footer */}
              {m.available ? (
                <div className="hq-mode-card-footer">
                  {[0, 1, 2].map(slot => (
                    <button
                      key={slot}
                      type="button"
                      className="hq-mode-go-btn"
                      onClick={() => onPickMode(m.id)}
                    >GO !</button>
                  ))}
                </div>
              ) : (
                <div className="hq-mode-card-footer hq-mode-card-footer-locked">
                  <button type="button" className="hq-mode-unlock-btn" disabled>
                    À DÉBLOQUER
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Random enemy squad generator ────────────────────────────────────────────
function generateEnemySquad(seed, lvlBase) {
  const rng = mulberry32(hashStr(seed));
  const count = 4 + Math.floor(rng() * 4); // 4–7
  const squad = G.buildSoldiers(count);
  const lvl = Math.max(1, Math.floor(lvlBase + (rng() - 0.5) * 4));
  const uniformCount = (window.Palette && window.Palette.uniform && window.Palette.uniform.length) || 10;
  const uniformIdx = Math.floor(rng() * uniformCount);
  for (const s of squad) {
    s.level = Math.max(1, lvl + (rng() < 0.3 ? -1 : rng() < 0.3 ? 1 : 0));
    s.config = { ...s.config, uniformIdx };
  }
  const name = FAKE_SQUAD_NAMES[Math.floor(rng() * FAKE_SQUAD_NAMES.length)] +
               ' #' + Math.floor(100 + rng() * 900);
  const power = squad.reduce((s, x) => s + 10 * x.level + 4, 0);
  return { name, level: lvl, soldiers: squad, power };
}

// ── HQOpponentSelect (army-vs-army opponent picker) ─────────────────────────
function HQOpponentSelect({ mySquad, onBack, onAttack }) {
  const { AnimPreview } = UI;
  const myLvl = calcSquadLevel(mySquad.soldiers);
  const [opponents, setOpponents] = useState(() => [
    generateEnemySquad('opp-' + todayKey() + '-1-' + mySquad.name, Math.max(1, myLvl - 1)),
    generateEnemySquad('opp-' + todayKey() + '-2-' + mySquad.name, myLvl),
    generateEnemySquad('opp-' + todayKey() + '-3-' + mySquad.name, myLvl + 1),
  ]);

  const handleReroll = () => {
    const seed = Math.random().toString(36).slice(2);
    setOpponents([
      generateEnemySquad('opp-' + seed + '-1', Math.max(1, myLvl - 1)),
      generateEnemySquad('opp-' + seed + '-2', myLvl),
      generateEnemySquad('opp-' + seed + '-3', myLvl + 1),
    ]);
  };

  return (
    <div className="hq-opponents">
      <button type="button" className="hq-back-btn" onClick={onBack}>← Retour</button>

      <h2 className="hq-section-title hq-opponents-title">Armée vs Armée</h2>

      <div className="hq-opp-grid">
        {opponents.map((opp, i) => (
          <OpponentCard key={i} opp={opp} myLvl={myLvl} onAttack={() => onAttack(opp)} />
        ))}
      </div>

      <div className="hq-opp-actions">
        <button type="button" className="sq-btn" onClick={handleReroll}>↻</button>
      </div>
    </div>
  );
}

function OpponentCard({ opp, myLvl, onAttack }) {
  const { AnimPreview } = UI;
  const diff = opp.level - myLvl;
  const diffClass = diff <= -2 ? 'easy' : diff <= 0 ? 'even' : diff === 1 ? 'hard' : 'epic';
  return (
    <div className={'hq-opp-card hq-opp-' + diffClass}>
      <div className="hq-opp-roster">
        {opp.soldiers.slice(0, 7).map(s => (
          <div key={s.id} className="hq-opp-roster-cell">
            <AnimPreview cfg={s.config} animKey="idle" scale={0.58} facing={1} running={true} />
          </div>
        ))}
      </div>
      <div className="hq-opp-name">{opp.name}</div>
      <div className="hq-opp-meta">
        <span>NIV. {opp.level}</span>
        <span>{opp.power} ⚡</span>
      </div>
      <button type="button" className="sq-btn sq-btn-primary hq-opp-attack" onClick={onAttack}>
        GO!
      </button>
    </div>
  );
}

// ── HQRecruit ───────────────────────────────────────────────────────────────
function HQRecruit({ pool, tokens, onPick, onBack, onReroll, canAffordReroll }) {
  return (
    <div className="hq-recruit">
      <button type="button" className="hq-back-btn" onClick={onBack}>← Retour</button>

      <div className="hq-section-eyebrow">RECRUTEMENT</div>
      <h2 className="hq-section-title">5 soldats disponibles aujourd'hui</h2>
      <p className="hq-section-hint">La sélection change chaque jour. Coût : {RECRUIT_COST_BASE} tokens par soldat.</p>

      <div className="hq-recruit-grid">
        {pool.map((s, i) => (
          <RecruitCard key={s.id || i} soldier={s} tokens={tokens} cost={RECRUIT_COST_BASE} onPick={() => onPick(s)} />
        ))}
      </div>
    </div>
  );
}

function RecruitCard({ soldier, tokens, cost, onPick }) {
  const { AnimPreview, WeaponGameIcon } = UI;
  const skill1 = G.getWeaponByName(soldier.skill1Name);
  const skill2 = G.getWeaponByName(soldier.skill2Name);
  const SkillTooltip = G.SkillTooltip;
  const canAfford = tokens >= cost;
  return (
    <div className="hq-recruit-card">
      <div className="hq-recruit-stage">
        <div className="hq-recruit-level">1</div>
        <div className="hq-recruit-char">
          <AnimPreview cfg={soldier.config} animKey="idle" scale={1.1} facing={1} running={true} />
        </div>
      </div>
      <div className="hq-recruit-name">{soldier.name}</div>
      <div className="hq-recruit-skills">
        {skill1 && (
          <SkillTooltip weapon={skill1} tipDir="below"><WeaponGameIcon weapon={skill1} /></SkillTooltip>
        )}
        {skill2 && (
          <SkillTooltip weapon={skill2} tipDir="below"><WeaponGameIcon weapon={skill2} /></SkillTooltip>
        )}
      </div>
      <button
        type="button"
        className={'sq-btn sq-btn-primary hq-recruit-btn' + (canAfford ? '' : ' is-disabled')}
        disabled={!canAfford}
        onClick={onPick}
      >
        RECRUTER · <span className="hq-recruit-cost">{cost} ●</span>
      </button>
    </div>
  );
}

// ── HQSoldierDetail ─────────────────────────────────────────────────────────
function HQSoldierDetail({ soldier, tokens, onUpgrade, onSetPreferred, onRename }) {
  const { AnimPreview, WeaponGameIcon } = UI;
  const SkillTooltip = G.SkillTooltip;
  const allWeapons = (window.Weapons && window.Weapons.list) || [];
  const upgradeCost = calcUpgradeCost(soldier);
  const canUpgrade = tokens >= upgradeCost;
  const unlockedSet = new Set(soldier.unlockedWeapons || []);
  const preferredWeapon = soldier.preferredWeapon ? G.getWeaponByName(soldier.preferredWeapon) : null;

  // Group weapons by type
  const grouped = useMemo(() => {
    const g = { smg: [], rifle: [], heavy: [], shotgun: [], sniper: [], pistol: [] };
    for (const w of allWeapons) {
      if (g[w.type]) g[w.type].push(w);
    }
    return g;
  }, [allWeapons.length]);

  const types = [
    { key: 'pistol',  label: 'Pistolets' },
    { key: 'smg',     label: 'Mitraillettes' },
    { key: 'shotgun', label: 'Fusils à pompe' },
    { key: 'rifle',   label: "Fusils d'assaut" },
    { key: 'sniper',  label: 'Snipers' },
    { key: 'heavy',   label: 'Armes lourdes' },
  ];

  return (
    <div className="hq-soldier-detail">
      <div className="hq-sd-top">
        <div className="hq-sd-skills">
          <div className="hq-sd-skills-groups">
            {types.map(({ key, label }) => grouped[key] && grouped[key].length > 0 && (
              <div key={key} className="hq-sd-skill-group">
                <div className="hq-sd-skill-group-title">{label}</div>
                <div className="hq-sd-skill-grid">
                  {grouped[key].map(w => {
                    const unlocked = unlockedSet.has(w.name);
                    const preferred = soldier.preferredWeapon === w.name;
                    return (
                      <SkillTooltip key={w.name} weapon={w} tipDir="below">
                        <button
                          type="button"
                          className={'hq-sd-skill' + (unlocked ? ' unlocked' : ' locked') + (preferred ? ' preferred' : '')}
                          disabled={!unlocked}
                          onClick={() => unlocked && onSetPreferred(w.name)}
                          title={unlocked ? (preferred ? 'Arme préférée' : 'Définir comme arme préférée') : 'Non débloquée'}
                        >
                          <WeaponGameIcon weapon={w} />
                          {!unlocked && <div className="hq-sd-skill-lock">🔒</div>}
                          {preferred && <div className="hq-sd-skill-star">★</div>}
                        </button>
                      </SkillTooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hq-sd-params">
          <div className="hq-sd-param">
            <div className="hq-sd-param-key">Arme préférée</div>
            <div className="hq-sd-param-val hq-sd-param-weapon">
              {preferredWeapon
                ? (
                  <>
                    <WeaponGameIcon weapon={preferredWeapon} />
                    <span>{preferredWeapon.name}</span>
                  </>
                )
                : <span className="hq-muted">Aucune</span>}
            </div>
          </div>
        </div>

        <div className="hq-sd-actions">
          <div className="hq-sd-portrait">
            <div className="hq-sd-portrait-stage" title={soldier.name}>
              <div className="hq-sd-portrait-level">NIV. {soldier.level}</div>
              <div className="hq-sd-portrait-char">
                <AnimPreview cfg={soldier.config} animKey="idle" scale={2.4} facing={1} running={true} />
              </div>
            </div>
            <button
              type="button"
              className={'sq-btn sq-btn-primary hq-sd-upgrade-btn' + (canUpgrade ? '' : ' is-disabled')}
              disabled={!canUpgrade}
              onClick={() => canUpgrade && onUpgrade()}
            >
              <span className="hq-sd-upgrade-title">AMÉLIORER</span>
              <span className="hq-sd-upgrade-cost">{upgradeCost} ●</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Placeholder pages ───────────────────────────────────────────────────────
function HQSquadPage({ mySquad, onSelectSoldier }) {
  const { AnimPreview } = UI;
  return (
    <div className="hq-squad-page">
      <h2 className="hq-section-title">{mySquad.name}</h2>

      <div className="hq-squad-grid">
        {mySquad.soldiers.map(s => (
          <button key={s.id} type="button" className="hq-squad-cell" onClick={() => onSelectSoldier(s.id)}>
            <div className="hq-sb-stage">
              <div className="hq-sb-level">{s.level}</div>
              <div className="hq-sb-char">
                <AnimPreview cfg={s.config} animKey="idle" scale={1.0} facing={1} running={false} />
              </div>
            </div>
            <div className="hq-sb-name">{s.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function HQMarketPage() {
  return (
    <div className="hq-placeholder">
      <div className="hq-placeholder-icon">🏪</div>
      <h2 className="hq-section-title">Marché</h2>
      <p className="hq-section-hint">Skins d'armes, équipements, boosters de tokens. Le marché ouvrira bientôt ses portes.</p>
      <div className="hq-coming-soon">EN CONSTRUCTION</div>
    </div>
  );
}

function HQSettingsPage({ onLeave }) {
  return (
    <div className="hq-placeholder hq-settings-page">
      <div className="hq-settings-list">
        <button className="sq-btn sq-btn-primary" onClick={onLeave}>Se déconnecter</button>
      </div>
    </div>
  );
}

// ── Battle splash (placeholder until combat is implemented) ─────────────────
function HQBattleSplash({ opp, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="hq-battle-splash">
      <div className="hq-battle-vs">
        <div className="hq-battle-name">VS</div>
        <div className="hq-battle-target">{opp.name}</div>
        <div className="hq-battle-pending">⚔ COMBAT À VENIR — la mécanique de bataille sera implémentée ensuite.</div>
      </div>
    </div>
  );
}

// ── HQPage (root component) ─────────────────────────────────────────────────
function HQPage({ squadName, founder, serverOnline, onSwitchMode, onLeave }) {
  // Initialize/persist HQ state
  const [hq, setHQ] = useState(() => {
    const saved = loadHQ(squadName);
    if (saved && Array.isArray(saved.soldiers) && saved.soldiers.length > 0) return saved;
    if (founder) return initialHQState(squadName, founder);
    // Fallback : login on a squad we don't know — give them a starter random soldier
    const starter = G.buildSoldiers(1)[0];
    return initialHQState(squadName, {
      name: starter.name, config: starter.config,
      skill1Name: starter.skill1Name, skill2Name: starter.skill2Name,
    });
  });

  useEffect(() => { saveHQ(squadName, hq); }, [squadName, hq]);

  const [tab,            setTab]            = useState('play');
  const [subpage,        setSubpage]        = useState(null);   // 'recruit' | 'opponents' | 'soldier' | 'battle'
  const [selectedSldId,  setSelectedSldId]  = useState(null);
  const [recruitPool,    setRecruitPool]    = useState(() => getRecruitPool(squadName) || buildRecruitPool(squadName));
  const [battleTarget,   setBattleTarget]   = useState(null);

  const power = useMemo(() => calcSquadPower(hq.soldiers), [hq.soldiers]);
  const level = useMemo(() => calcSquadLevel(hq.soldiers), [hq.soldiers]);

  // Daily refresh check on mount + every minute
  useEffect(() => {
    const check = () => {
      const fresh = getRecruitPool(squadName);
      if (!fresh) {
        const newPool = buildRecruitPool(squadName);
        setRecruitPool(newPool);
      }
    };
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [squadName]);

  const handleTab = useCallback((id) => {
    setTab(id);
    setSubpage(null);
    setSelectedSldId(null);
    setBattleTarget(null);
  }, []);

  const handleSelectSoldier = useCallback((id) => {
    setTab('squad');
    setSelectedSldId(id);
    setSubpage('soldier');
  }, []);

  const handleAddRecruit = useCallback(() => {
    setSubpage('recruit');
    setSelectedSldId(null);
  }, []);

  const handlePickRecruit = useCallback((gen) => {
    setHQ(prev => {
      if (prev.tokens < RECRUIT_COST_BASE) return prev;
      const newSld = soldierFromGenerated(gen);
      const next = {
        ...prev,
        tokens: prev.tokens - RECRUIT_COST_BASE,
        soldiers: [...prev.soldiers, newSld],
      };
      return next;
    });
    // Remove from recruit pool
    setRecruitPool(pool => {
      const filtered = pool.filter(p => p.id !== gen.id);
      try {
        localStorage.setItem(RECRUIT_KEY(squadName), JSON.stringify({ date: todayKey(), soldiers: filtered }));
      } catch (_) {}
      return filtered;
    });
    setSubpage(null);
  }, [squadName]);

  const handleUpgrade = useCallback(() => {
    setHQ(prev => {
      const idx = prev.soldiers.findIndex(s => s.id === selectedSldId);
      if (idx < 0) return prev;
      const sld  = prev.soldiers[idx];
      const cost = calcUpgradeCost(sld);
      if (prev.tokens < cost) return prev;
      const updated = { ...sld, level: sld.level + 1 };
      const list = prev.soldiers.slice();
      list[idx] = updated;
      return { ...prev, tokens: prev.tokens - cost, soldiers: list };
    });
  }, [selectedSldId]);

  const handleSetPreferred = useCallback((weaponName) => {
    setHQ(prev => {
      const idx = prev.soldiers.findIndex(s => s.id === selectedSldId);
      if (idx < 0) return prev;
      const sld = prev.soldiers[idx];
      // Update preferredWeapon and weaponIdx in config to match
      const w = G.getWeaponByName(weaponName);
      const wIdx = w ? (window.Weapons.list || []).indexOf(w) : null;
      const list = prev.soldiers.slice();
      list[idx] = {
        ...sld,
        preferredWeapon: weaponName,
        config: wIdx != null && wIdx >= 0 ? { ...sld.config, weaponIdx: wIdx } : sld.config,
      };
      return { ...prev, soldiers: list };
    });
  }, [selectedSldId]);

  const handlePickMode = useCallback((id) => {
    if (id === 'army-vs-army') setSubpage('opponents');
  }, []);

  const handleAttack = useCallback((opp) => {
    setBattleTarget(opp);
    setSubpage('battle');
  }, []);

  // Choose what main content to render
  let main = null;
  const selectedSoldier = hq.soldiers.find(s => s.id === selectedSldId);

  if (subpage === 'recruit') {
    main = (
      <HQRecruit
        pool={recruitPool}
        tokens={hq.tokens}
        onPick={handlePickRecruit}
        onBack={() => setSubpage(null)}
      />
    );
  } else if (subpage === 'soldier' && selectedSoldier) {
    main = (
      <HQSoldierDetail
        soldier={selectedSoldier}
        tokens={hq.tokens}
        onUpgrade={handleUpgrade}
        onSetPreferred={handleSetPreferred}
      />
    );
  } else if (subpage === 'opponents') {
    main = (
      <HQOpponentSelect
        mySquad={hq}
        onBack={() => setSubpage(null)}
        onAttack={handleAttack}
      />
    );
  } else if (subpage === 'battle' && battleTarget) {
    const BattleScreen = window.HQBattleScreen;
    main = BattleScreen ? (
      <BattleScreen
        mySquad={hq}
        oppSquad={battleTarget}
        onDone={() => { setSubpage(null); setBattleTarget(null); }}
      />
    ) : (
      <HQBattleSplash
        opp={battleTarget}
        onDone={() => { setSubpage(null); setBattleTarget(null); }}
      />
    );
  } else if (tab === 'play') {
    main = <HQPlay squadName={hq.name} onPickMode={handlePickMode} />;
  } else if (tab === 'squad') {
    main = <HQSquadPage mySquad={hq} onSelectSoldier={handleSelectSoldier} />;
  } else if (tab === 'market') {
    main = <HQMarketPage />;
  } else if (tab === 'settings') {
    main = <HQSettingsPage onLeave={onLeave} />;
  }

  return (
    <div className="gp-page hq-page">
      <div className="hq-bg" />
      <div className="hq-overlay" />

      <HQHeader
        tab={tab}
        onTab={handleTab}
      />

      <div className="hq-body">
        <HQSidebar
          soldiers={hq.soldiers}
          selectedId={subpage === 'soldier' ? selectedSldId : null}
          onSelect={handleSelectSoldier}
          onAdd={handleAddRecruit}
          isRecruiting={subpage === 'recruit'}
          tokens={hq.tokens}
          power={power}
          serverOnline={serverOnline}
        />

        <main className="hq-main">
          <div className="hq-main-inner" key={tab + ':' + (subpage || '_')}>
            {main}
          </div>
        </main>
      </div>
    </div>
  );
}

window.SquadronHQ = { HQPage };

})();
