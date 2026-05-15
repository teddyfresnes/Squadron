// HQ — persistent shell after login.
// Floating tabs + left sidebar (stats/soldiers) + main content area.
// Wrapped in an IIFE so top-level consts don't collide with app.jsx / game.jsx.

(function () {

const { useState, useEffect, useMemo, useCallback } = React;

const G = window.SquadronGame.helpers;
const UI = window.SquadronUI;

const HQ_KEY      = (sname) => 'squadron-hq-' + sname;
const RECRUIT_KEY = (sname) => 'squadron-recruit-' + sname;
const MATCH_KEY   = (sname) => 'squadron-matchmaking-' + sname;
const SQUADS_KEY  = 'squadron-squads';

// Upgrade cost per current level (cost to level 1→2, 2→3, …)
const UPGRADE_COSTS  = [4, 8, 16, 32, 48, 64, 96, 128];
// Recruit cost per number of soldiers already owned (1st recruit, 2nd recruit, …)
const RECRUIT_COSTS  = [15, 35, 80, 150, 220, 325, 450, 600, 790];
const STARTING_TOKENS   = 250;
const OPPONENT_COUNT    = 8;
const SIX_MONTHS_MS     = 6 * 30 * 24 * 60 * 60 * 1000; // approx 6 months
const HIDDEN_WEAPON_NAMES = new Set(['Main nue']);
const MAX_PERK_TIER       = 2;   // highest perk tier currently implemented
const PERK_HINT_TIER      = 3;   // one greyed "???" tier shown above implemented ones
const TOKEN_ICON_SRC    = 'assets/images/icons/coin.png';
const POWER_ICON_SRC    = 'assets/images/icons/power.png';

const FAKE_SQUAD_NAMES = [
  'Wolves','Cobra','Phantom','Iron','Viper','Sentinels','Black Hawks','Falcons',
  'Reapers','Crimson','Steel Owls','Nightshade','Rogue','Tempête','Spectre',
  'Garde Noire','Lions','Vautours','Sangliers','Fer de Lance'
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function todayKey() { return new Date().toISOString().slice(0, 10); }

function TokenIcon({ className = '' }) {
  return <img className={'hq-resource-icon hq-token-icon' + (className ? ' ' + className : '')} src={TOKEN_ICON_SRC} alt="" aria-hidden="true" />;
}

function PowerIcon({ className = '' }) {
  return <img className={'hq-resource-icon hq-power-icon' + (className ? ' ' + className : '')} src={POWER_ICON_SRC} alt="" aria-hidden="true" />;
}

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

function soldierFromFounder(founder, squadName) {
  if (!founder || !founder.config) return null;
  const unlocked = [];
  if (founder.skill1Name) unlocked.push(founder.skill1Name);
  if (founder.skill2Name && founder.skill2Name !== founder.skill1Name) unlocked.push(founder.skill2Name);
  return {
    id: 'founder-' + hashStr(squadName || founder.name || 'squad').toString(36),
    name: founder.name || 'Soldat',
    config: founder.config,
    level: 1,
    xp: 0,
    unlockedWeapons: unlocked,
    preferredWeapon: founder.skill1Name || null,
  };
}

function calcSoldierPower(soldier) {
  return 4 + Math.max(1, Number(soldier && soldier.level) || 1);
}
function calcSquadPower(soldiers) {
  return soldiers.reduce((sum, s) => sum + calcSoldierPower(s), 0);
}
function calcSquadLevel(soldiers) {
  const total = soldiers.reduce((s, x) => s + (x.level || 1), 0);
  return Math.max(1, 1 + Math.floor((total + soldiers.length) / 4));
}
function calcUpgradeCost(soldier) {
  const lvl = Math.max(1, (soldier && soldier.level) || 1);
  if (lvl - 1 < UPGRADE_COSTS.length) return UPGRADE_COSTS[lvl - 1];
  // Continue with ×1.5 growth past the hardcoded list, rounded to multiples of 8
  let cost = UPGRADE_COSTS[UPGRADE_COSTS.length - 1];
  for (let i = UPGRADE_COSTS.length; i <= lvl - 1; i++) {
    cost = Math.round((cost * 1.5) / 8) * 8;
  }
  return cost;
}
function calcRecruitCost(currentCount) {
  const idx = Math.max(0, currentCount | 0);
  if (idx < RECRUIT_COSTS.length) return RECRUIT_COSTS[idx];
  // Continue with +30% growth past the hardcoded list, rounded to multiples of 10
  let cost = RECRUIT_COSTS[RECRUIT_COSTS.length - 1];
  for (let i = RECRUIT_COSTS.length; i <= idx; i++) {
    cost = Math.round((cost * 1.3) / 10) * 10;
  }
  return cost;
}
function renameCooldownMs(renameCount) {
  if (!renameCount || renameCount < 1) return 0;
  return SIX_MONTHS_MS * Math.pow(2, renameCount - 1);
}
function formatRemainingCooldown(ms) {
  if (ms <= 0) return '';
  const sec = Math.ceil(ms / 1000);
  const min = Math.ceil(sec / 60);
  const hrs = Math.ceil(min / 60);
  const days = Math.ceil(hrs / 24);
  const months = Math.ceil(days / 30);
  const years = Math.floor(months / 12);
  if (years >= 1) {
    const rem = months - years * 12;
    return rem > 0 ? `${years} an${years > 1 ? 's' : ''} ${rem} mois` : `${years} an${years > 1 ? 's' : ''}`;
  }
  if (months >= 1) return `${months} mois`;
  if (days >= 1) return `${days} j`;
  if (hrs >= 1) return `${hrs} h`;
  if (min >= 1) return `${min} min`;
  return `${sec} s`;
}

// ── Upgrade-offer generation (deterministic per soldier + next level) ──────────
function generateUpgradeOffer(soldier, squadName) {
  const list = (window.Weapons && window.Weapons.list) || [];
  const unlocked = new Set(soldier.unlockedWeapons || []);
  const pool = list.filter(w => !HIDDEN_WEAPON_NAMES.has(w.name) && !unlocked.has(w.name));
  if (pool.length === 0) return null;
  const seed = hashStr(`${squadName || ''}:${soldier.id}:${(soldier.level || 1) + 1}`);
  const rng = mulberry32(seed);
  const i1 = Math.floor(rng() * pool.length);
  let skill2Name = null;
  if (pool.length >= 2) {
    let i2 = Math.floor(rng() * (pool.length - 1));
    if (i2 >= i1) i2 += 1;
    skill2Name = pool[i2].name;
  }
  return { skill1Name: pool[i1].name, skill2Name };
}
function ensureUpgradeOffer(soldier, squadName) {
  if (soldier.pendingUpgrade && soldier.pendingUpgrade.skill1Name) return soldier.pendingUpgrade;
  const offer = generateUpgradeOffer(soldier, squadName);
  return offer || null;
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

function loadLocalSquadMap() {
  try {
    const raw = localStorage.getItem(SQUADS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) { return {}; }
}

function normalizeOpponentSquad(raw, fallbackName, source) {
  if (!raw) return null;
  const soldiers = Array.isArray(raw.soldiers) ? raw.soldiers.filter(s => s && s.config) : [];
  if (!soldiers.length) return null;
  const name = String(raw.name || fallbackName || 'Squad').slice(0, 32);
  return {
    name,
    soldiers,
    source: source || raw.source || 'player',
    level: raw.level || calcSquadLevel(soldiers),
    power: raw.power || calcSquadPower(soldiers),
  };
}

function loadLocalPlayerSquads(currentName) {
  const map = loadLocalSquadMap();
  return Object.keys(map)
    .filter(name => name !== currentName)
    .map(name => {
      const savedHQ = loadHQ(name);
      if (savedHQ && Array.isArray(savedHQ.soldiers) && savedHQ.soldiers.length) {
        return normalizeOpponentSquad(savedHQ, name, 'player');
      }
      const founder = soldierFromFounder(map[name] && map[name].founder, name);
      return founder ? normalizeOpponentSquad({ name, soldiers: [founder] }, name, 'player') : null;
    })
    .filter(Boolean);
}

function getPowerTiers(myPower) {
  const p = Math.max(5, Number(myPower) || 5);
  const raw = p <= 10
    ? [5, 6, 7, 8, 12, 18, 28, 40]
    : [5, p * 0.45, p * 0.7, p * 0.9, p, p * 1.25, p * 1.7, p * 2.4];
  const tiers = [];
  for (const value of raw) {
    const rounded = Math.max(5, Math.round(value));
    if (!tiers.includes(rounded)) tiers.push(rounded);
  }
  return tiers.sort((a, b) => a - b).slice(0, OPPONENT_COUNT);
}

function applyTargetPower(soldiers, targetPower, rng) {
  const target = Math.max(5, Math.round(targetPower));
  let bonus = Math.max(0, target - (soldiers.length * 5));
  for (const s of soldiers) s.level = 1;
  let guard = 0;
  while (bonus > 0 && guard++ < 400) {
    const idx = Math.floor(rng() * soldiers.length);
    soldiers[idx].level += 1;
    bonus -= 1;
  }
}

function buildOpponentSelection({ mySquad, myPower, playerSquads, nonce }) {
  const tiers = getPowerTiers(myPower);
  const picked = (playerSquads || [])
    .map(s => normalizeOpponentSquad(s, s && s.name, 'player'))
    .filter(s => s && s.name !== mySquad.name)
    .sort((a, b) => a.power - b.power || a.name.localeCompare(b.name))
    .slice(0, OPPONENT_COUNT);

  const selected = picked.slice();
  for (const tier of tiers) {
    if (selected.length >= OPPONENT_COUNT) break;
    selected.push(generateEnemySquad('opp-' + todayKey() + '-' + mySquad.name + '-' + nonce + '-' + tier, tier));
  }

  let fill = 0;
  while (selected.length < OPPONENT_COUNT) {
    const tier = tiers[fill % tiers.length] || Math.max(5, myPower);
    selected.push(generateEnemySquad('opp-fill-' + todayKey() + '-' + mySquad.name + '-' + nonce + '-' + fill, tier));
    fill += 1;
  }

  return selected
    .map(s => ({ ...s, power: calcSquadPower(s.soldiers), level: calcSquadLevel(s.soldiers) }))
    .sort((a, b) => a.power - b.power || a.name.localeCompare(b.name));
}

function loadOpponentPack(squadName, myPower) {
  try {
    const raw = localStorage.getItem(MATCH_KEY(squadName));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || parsed.date !== todayKey() || parsed.myPower !== myPower || !Array.isArray(parsed.opponents)) {
      return null;
    }
    return parsed;
  } catch (_) { return null; }
}

function saveOpponentPack(squadName, pack) {
  try { localStorage.setItem(MATCH_KEY(squadName), JSON.stringify(pack)); } catch (_) {}
}

function markOpponentPackRefreshable(squadName) {
  try {
    const parsed = JSON.parse(localStorage.getItem(MATCH_KEY(squadName)) || 'null');
    if (parsed && parsed.date === todayKey()) {
      saveOpponentPack(squadName, { ...parsed, canRefresh: true });
    }
  } catch (_) {}
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
          <span className="hq-stat-icon" aria-hidden="true"><TokenIcon /></span>
          <span className="hq-stat-key">TOKENS</span>
          <span className="hq-stat-val">{tokens}</span>
        </div>
        <div className="hq-stat hq-stat-power" title="Power">
          <span className="hq-stat-icon" aria-hidden="true"><PowerIcon /></span>
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
    label: 'Squad vs Squad',
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
        <h1 className="hq-play-title"><span className="hq-squad-prefix">SQUADRON</span>{squadName}</h1>
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
function generateEnemySquad(seed, targetPower) {
  const rng = mulberry32(hashStr(seed));
  const wantedPower = Math.max(5, Math.round(targetPower || 5));
  const count = Math.max(1, Math.min(8, Math.floor(wantedPower / 5)));
  const squad = G.buildSoldiers(count);
  const uniformCount = (window.Palette && window.Palette.uniform && window.Palette.uniform.length) || 10;
  const uniformIdx = Math.floor(rng() * uniformCount);
  for (const s of squad) {
    s.config = { ...s.config, uniformIdx };
  }
  applyTargetPower(squad, wantedPower, rng);
  const name = FAKE_SQUAD_NAMES[Math.floor(rng() * FAKE_SQUAD_NAMES.length)] +
               ' #' + Math.floor(100 + rng() * 900);
  return { name, level: calcSquadLevel(squad), soldiers: squad, power: calcSquadPower(squad), source: 'bot' };
}

// ── HQOpponentSelect (army-vs-army opponent picker) ─────────────────────────
function HQOpponentSelect({ mySquad, serverOnline, onBack, onAttack }) {
  const myPower = calcSquadPower(mySquad.soldiers);
  const [initialPack] = useState(() => loadOpponentPack(mySquad.name, myPower));
  const [playerSquads, setPlayerSquads] = useState(() => loadLocalPlayerSquads(mySquad.name));
  const [opponents, setOpponents] = useState(() => {
    if (initialPack) return initialPack.opponents;
    const initial = buildOpponentSelection({
      mySquad,
      myPower,
      playerSquads: loadLocalPlayerSquads(mySquad.name),
      nonce: 'initial',
    });
    saveOpponentPack(mySquad.name, { date: todayKey(), myPower, canRefresh: false, opponents: initial });
    return initial;
  });

  const rebuildOpponents = useCallback((players, nonce) => {
    const next = buildOpponentSelection({ mySquad, myPower, playerSquads: players, nonce });
    setOpponents(next);
    saveOpponentPack(mySquad.name, { date: todayKey(), myPower, canRefresh: false, opponents: next });
  }, [mySquad, myPower]);

  useEffect(() => {
    let cancelled = false;
    async function loadPlayers() {
      let players = loadLocalPlayerSquads(mySquad.name);
      if (serverOnline && G.apiFetch) {
        const { ok, data } = await G.apiFetch('/api/squad/opponents/list?exclude=' + encodeURIComponent(mySquad.name));
        if (ok && data && Array.isArray(data.squads)) players = data.squads;
      }
      if (cancelled) return;
      setPlayerSquads(players);
      if (!initialPack) rebuildOpponents(players, 'players-' + players.length);
    }
    loadPlayers();
    return () => { cancelled = true; };
  }, [mySquad.name, myPower, serverOnline, initialPack, rebuildOpponents]);

  return (
    <div className="hq-opponents">
      <button type="button" className="hq-back-btn" onClick={onBack}>← Retour</button>

      <h2 className="hq-section-title hq-opponents-title">Squad vs Squad</h2>

      <div className="hq-opp-grid">
        {opponents.map((opp, i) => (
          <OpponentCard key={(opp.source || 'opp') + '-' + opp.name + '-' + i} opp={opp} myPower={myPower} onAttack={() => onAttack(opp)} />
        ))}
      </div>
    </div>
  );
}

function OpponentCard({ opp, myPower, onAttack }) {
  const { AnimPreview } = UI;
  const ratio = opp.power / Math.max(1, myPower);
  const diffClass = ratio <= 0.75 ? 'easy' : ratio <= 1.15 ? 'even' : ratio <= 1.6 ? 'hard' : 'epic';
  return (
    <div className={'hq-opp-card hq-opp-' + diffClass}>
      <div className="hq-opp-head">
        <div className="hq-opp-name">{opp.name}</div>
        <div className="hq-opp-power">
          <PowerIcon className="hq-opp-power-icon" />
          <strong>{opp.power}</strong>
        </div>
      </div>
      <div className="hq-opp-roster">
        {opp.soldiers.slice(0, 8).map(s => (
          <div key={s.id} className="hq-opp-roster-cell">
            <div className="hq-opp-soldier-level">{s.level || 1}</div>
            <AnimPreview cfg={s.config} animKey="idle" scale={0.58} facing={1} running={true} />
          </div>
        ))}
      </div>
      <button type="button" className="sq-btn hq-opp-attack" onClick={onAttack}>
        ATTAQUER
      </button>
    </div>
  );
}

// ── HQRecruit ───────────────────────────────────────────────────────────────
function HQRecruit({ pool, tokens, soldierCount, onPick, onBack }) {
  const cost = calcRecruitCost(soldierCount);
  return (
    <div className="hq-recruit">
      <button type="button" className="hq-back-btn" onClick={onBack}>← Retour</button>

      <div className="hq-section-eyebrow">RECRUTEMENT</div>
      <h2 className="hq-section-title">5 soldats disponibles aujourd'hui</h2>
      <p className="hq-section-hint">La sélection change chaque jour. Prochain soldat : {cost} <TokenIcon className="hq-resource-icon-inline" />.</p>

      <div className="hq-recruit-grid">
        {pool.map((s, i) => (
          <RecruitCard key={s.id || i} soldier={s} tokens={tokens} cost={cost} onPick={() => onPick(s)} />
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
        RECRUTER · <span className="hq-recruit-cost">{cost} <TokenIcon className="hq-resource-icon-inline" /></span>
      </button>
    </div>
  );
}

// ── Soldier-detail subcomponents ────────────────────────────────────────────
function SoldierSkillGrid({ soldier }) {
  const { WeaponGameIcon } = UI;
  const SkillTooltip = G.SkillTooltip;
  const allWeapons = (window.Weapons && window.Weapons.list) || [];
  const visibleWeapons = useMemo(
    () => allWeapons.filter(w => !HIDDEN_WEAPON_NAMES.has(w.name)),
    [allWeapons.length]
  );
  const unlockedSet = useMemo(() => new Set(soldier.unlockedWeapons || []), [soldier.unlockedWeapons]);

  return (
    <div className="hq-sd-skill-grid" aria-label="Compétences débloquées">
      {visibleWeapons.map(w => {
        const unlocked = unlockedSet.has(w.name);
        const cell = (
          <span className={'hq-sd-skill' + (unlocked ? '' : ' is-locked')}>
            <WeaponGameIcon weapon={w} />
          </span>
        );
        return unlocked
          ? <SkillTooltip key={w.name} weapon={w} tipDir="below">{cell}</SkillTooltip>
          : <React.Fragment key={w.name}>{cell}</React.Fragment>;
      })}
    </div>
  );
}

function RenamePerk({ soldier, onRename }) {
  const [open, setOpen]   = useState(false);
  const [value, setValue] = useState(soldier.name || '');
  const [tick, setTick]   = useState(0);

  const renameCount = soldier.renameCount || 0;
  const lastAt      = soldier.lastRenameAt || 0;
  const cooldown    = renameCooldownMs(renameCount);
  const remaining   = Math.max(0, (lastAt + cooldown) - Date.now());
  const ready       = remaining <= 0;
  const nextCooldown = renameCooldownMs(renameCount + 1);

  useEffect(() => {
    if (ready) return;
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, [ready, lastAt, renameCount]);

  useEffect(() => { setValue(soldier.name || ''); }, [soldier.id, soldier.name]);

  const trimmed = value.trim();
  const isValid = trimmed.length >= 2 && trimmed.length <= 24 && trimmed !== soldier.name;

  return (
    <div className={'hq-sd-perk' + (ready ? '' : ' is-cooldown')}>
      <div className="hq-sd-perk-head">
        <span className="hq-sd-perk-tier">NIV. 1</span>
        <span className="hq-sd-perk-title">Renommer le soldat</span>
      </div>
      {!open && (
        <div className="hq-sd-perk-body">
          <div className="hq-sd-perk-value">{soldier.name}</div>
          <button
            type="button"
            className={'sq-btn hq-sd-perk-btn' + (ready ? '' : ' is-disabled')}
            disabled={!ready}
            onClick={() => ready && setOpen(true)}
            title={ready ? 'Choisir un nouveau nom' : 'Temps d\'attente avant le prochain renommage'}
          >
            {ready ? 'Renommer' : 'En attente : ' + formatRemainingCooldown(remaining)}
          </button>
        </div>
      )}
      {open && (
        <form
          className="hq-sd-perk-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValid) return;
            onRename(trimmed);
            setOpen(false);
          }}
        >
          <input
            type="text"
            className="hq-sd-perk-input"
            value={value}
            maxLength={24}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="hq-sd-perk-form-row">
            <button type="button" className="sq-btn hq-sd-perk-btn-cancel" onClick={() => { setOpen(false); setValue(soldier.name || ''); }}>Annuler</button>
            <button type="submit" className={'sq-btn sq-btn-primary hq-sd-perk-btn' + (isValid ? '' : ' is-disabled')} disabled={!isValid}>Valider</button>
          </div>
          {renameCount === 0
            ? <div className="hq-sd-perk-hint">Premier renommage : gratuit. Ensuite, attente de 6 mois (doublée à chaque fois).</div>
            : <div className="hq-sd-perk-hint">Prochaine attente après ce renommage : {formatRemainingCooldown(nextCooldown)}.</div>}
        </form>
      )}
    </div>
  );
}

function PreferredWeaponPerk({ soldier, onSetPreferred }) {
  const { WeaponGameIcon } = UI;
  const unlocked = (soldier.unlockedWeapons || []).filter(name => !HIDDEN_WEAPON_NAMES.has(name));
  const preferredWeapon = soldier.preferredWeapon ? G.getWeaponByName(soldier.preferredWeapon) : null;
  const unlockedReady = (soldier.level || 1) >= 2;

  if (!unlockedReady) {
    return (
      <div className="hq-sd-perk is-locked">
        <div className="hq-sd-perk-head">
          <span className="hq-sd-perk-tier">NIV. 2</span>
          <span className="hq-sd-perk-title hq-sd-perk-mystery">???</span>
        </div>
        <div className="hq-sd-perk-body">
          <div className="hq-sd-perk-hint">Atteins le niveau 2 pour débloquer cette compétence.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="hq-sd-perk">
      <div className="hq-sd-perk-head">
        <span className="hq-sd-perk-tier">NIV. 2</span>
        <span className="hq-sd-perk-title">Arme préférée</span>
      </div>
      <div className="hq-sd-perk-body hq-sd-perk-weapon-row">
        <div className="hq-sd-perk-weapon-icon">
          {preferredWeapon
            ? <WeaponGameIcon weapon={preferredWeapon} />
            : <span className="hq-muted">—</span>}
        </div>
        <select
          className="hq-sd-perk-select"
          value={soldier.preferredWeapon || ''}
          onChange={(e) => onSetPreferred(e.target.value || null)}
        >
          <option value="">Aucune</option>
          {unlocked.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function MysteryPerk({ tier }) {
  return (
    <div className="hq-sd-perk is-locked is-mystery">
      <div className="hq-sd-perk-head">
        <span className="hq-sd-perk-tier">NIV. {tier}</span>
        <span className="hq-sd-perk-title hq-sd-perk-mystery">???</span>
      </div>
      <div className="hq-sd-perk-body">
        <div className="hq-sd-perk-hint">Compétence à venir.</div>
      </div>
    </div>
  );
}

function SoldierPerksPanel({ soldier, onRename, onSetPreferred }) {
  const level = soldier.level || 1;
  return (
    <div className="hq-sd-perks">
      <div className="hq-sd-perks-title">COMPÉTENCES</div>
      <RenamePerk soldier={soldier} onRename={onRename} />
      <PreferredWeaponPerk soldier={soldier} onSetPreferred={onSetPreferred} />
      {level < PERK_HINT_TIER && <MysteryPerk tier={PERK_HINT_TIER} />}
    </div>
  );
}

function SoldierPortraitPanel({ soldier, tokens, onUpgrade }) {
  const { AnimPreview } = UI;
  const upgradeCost = calcUpgradeCost(soldier);
  const canUpgrade  = tokens >= upgradeCost;
  return (
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
        <span className="hq-sd-upgrade-cost">{upgradeCost} <TokenIcon className="hq-resource-icon-inline" /></span>
      </button>
    </div>
  );
}

// ── HQSoldierDetail ─────────────────────────────────────────────────────────
function HQSoldierDetail({ soldier, tokens, onUpgrade, onSetPreferred, onRename }) {
  return (
    <div className="hq-soldier-detail">
      <div className="hq-sd-layout">
        <div className="hq-sd-skills-cell">
          <SoldierSkillGrid soldier={soldier} />
        </div>
        <div className="hq-sd-perks-cell">
          <SoldierPerksPanel soldier={soldier} onRename={onRename} onSetPreferred={onSetPreferred} />
        </div>
        <div className="hq-sd-portrait-cell">
          <SoldierPortraitPanel soldier={soldier} tokens={tokens} onUpgrade={onUpgrade} />
        </div>
      </div>
    </div>
  );
}

// ── HQUpgradeChoice ─────────────────────────────────────────────────────────
function HQUpgradeChoice({ soldier, squadName, onBack, onConfirm }) {
  const { AnimPreview, WeaponGameIcon } = UI;
  const SkillTooltip = G.SkillTooltip;

  const offer = useMemo(() => ensureUpgradeOffer(soldier, squadName), [soldier.id, soldier.level, squadName, soldier.pendingUpgrade]);
  const options = useMemo(() => {
    if (!offer) return [];
    const list = [];
    if (offer.skill1Name) list.push(offer.skill1Name);
    if (offer.skill2Name && offer.skill2Name !== offer.skill1Name) list.push(offer.skill2Name);
    return list
      .map(name => G.getWeaponByName(name))
      .filter(Boolean);
  }, [offer && offer.skill1Name, offer && offer.skill2Name]);

  return (
    <div className="hq-upgrade-choice">
      <button type="button" className="hq-back-btn" onClick={onBack}>← Retour</button>

      <div className="hq-upgrade-stage">
        <div className="hq-upgrade-soldier">
          <div className="hq-upgrade-soldier-stage">
            <div className="hq-upgrade-soldier-level">NIV. {soldier.level}</div>
            <AnimPreview cfg={soldier.config} animKey="idle" scale={1.6} facing={1} running={true} />
          </div>
          <div className="hq-upgrade-soldier-name">{soldier.name}</div>
        </div>

        <div className="hq-upgrade-options">
          {options.length === 0 && (
            <div className="hq-upgrade-empty">Toutes les compétences sont déjà débloquées.</div>
          )}
          {options.map(w => (
            <div key={w.name} className="hq-upgrade-option">
              <SkillTooltip weapon={w} tipDir="below">
                <span className="hq-upgrade-option-icon"><WeaponGameIcon weapon={w} /></span>
              </SkillTooltip>
              <div className="hq-upgrade-option-name">{w.name}</div>
              <div className="hq-upgrade-option-type">{G.WEAPON_TYPE_LABELS[w.type] || w.type}</div>
              <button
                type="button"
                className="sq-btn sq-btn-primary hq-upgrade-pick-btn"
                onClick={() => onConfirm(w.name)}
              >
                CHOISIR
              </button>
            </div>
          ))}
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
  const [subpage,        setSubpage]        = useState(null);   // 'recruit' | 'opponents' | 'soldier' | 'battle' | 'upgrade'
  const [selectedSldId,  setSelectedSldId]  = useState(null);
  const [recruitPool,    setRecruitPool]    = useState(() => getRecruitPool(squadName) || buildRecruitPool(squadName));
  const [battleTarget,   setBattleTarget]   = useState(null);

  const power = useMemo(() => calcSquadPower(hq.soldiers), [hq.soldiers]);
  const recruitCost = calcRecruitCost(hq.soldiers.length);

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
    // If the soldier has a pending upgrade (paid but skill not yet chosen),
    // send them straight to the skill-choice page instead of the detail page.
    const sld = hq.soldiers.find(s => s.id === id);
    const hasPending = sld && sld.pendingUpgrade && sld.pendingUpgrade.skill1Name;
    setSubpage(hasPending ? 'upgrade' : 'soldier');
  }, [hq.soldiers]);

  const handleAddRecruit = useCallback(() => {
    setSubpage('recruit');
    setSelectedSldId(null);
  }, []);

  const handlePickRecruit = useCallback((gen) => {
    setHQ(prev => {
      const cost = calcRecruitCost(prev.soldiers.length);
      if (prev.tokens < cost) return prev;
      const newSld = soldierFromGenerated(gen);
      return {
        ...prev,
        tokens: prev.tokens - cost,
        soldiers: [...prev.soldiers, newSld],
      };
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

  // Start an upgrade: pay the cost immediately and record the skill offer.
  // The actual level-up + skill unlock happens after the user picks a skill.
  // If a pending upgrade already exists, just re-open the choice page (no extra charge).
  const handleOpenUpgrade = useCallback(() => {
    let serverNotice = null;
    setHQ(prev => {
      const idx = prev.soldiers.findIndex(s => s.id === selectedSldId);
      if (idx < 0) return prev;
      const sld = prev.soldiers[idx];
      if (sld.pendingUpgrade && sld.pendingUpgrade.skill1Name) return prev;
      const cost = calcUpgradeCost(sld);
      if (prev.tokens < cost) return prev;
      const offer = generateUpgradeOffer(sld, prev.name);
      if (!offer) return prev;
      const list = prev.soldiers.slice();
      list[idx] = { ...sld, pendingUpgrade: offer };
      serverNotice = { soldierId: sld.id, fromLevel: sld.level || 1, toLevel: (sld.level || 1) + 1, cost };
      return { ...prev, tokens: prev.tokens - cost, soldiers: list };
    });
    setSubpage('upgrade');
    if (serverNotice && serverOnline && G.apiFetch) {
      G.apiFetch('/api/squad/soldier-upgrade', {
        method: 'POST',
        body: JSON.stringify(serverNotice),
      });
    }
  }, [selectedSldId, serverOnline]);

  // Confirm an upgrade: cost was already paid in handleOpenUpgrade.
  // Just +1 level, unlock the chosen skill, and clear the pending offer.
  const handleConfirmUpgrade = useCallback((weaponName) => {
    setHQ(prev => {
      const idx = prev.soldiers.findIndex(s => s.id === selectedSldId);
      if (idx < 0) return prev;
      const sld  = prev.soldiers[idx];
      const currentUnlocked = sld.unlockedWeapons || [];
      const unlockedWeapons = weaponName && !currentUnlocked.includes(weaponName)
        ? [...currentUnlocked, weaponName]
        : currentUnlocked;
      const updated = {
        ...sld,
        level: (sld.level || 1) + 1,
        unlockedWeapons,
        pendingUpgrade: null,
      };
      const list = prev.soldiers.slice();
      list[idx] = updated;
      return { ...prev, soldiers: list };
    });
    setSubpage('soldier');
  }, [selectedSldId]);

  const handleRename = useCallback((newName) => {
    setHQ(prev => {
      const idx = prev.soldiers.findIndex(s => s.id === selectedSldId);
      if (idx < 0) return prev;
      const sld = prev.soldiers[idx];
      const trimmed = String(newName || '').trim().slice(0, 24);
      if (trimmed.length < 2 || trimmed === sld.name) return prev;
      const lastAt = sld.lastRenameAt || 0;
      const cooldown = renameCooldownMs(sld.renameCount || 0);
      if (Date.now() < lastAt + cooldown) return prev;
      const list = prev.soldiers.slice();
      list[idx] = {
        ...sld,
        name: trimmed,
        renameCount: (sld.renameCount || 0) + 1,
        lastRenameAt: Date.now(),
      };
      return { ...prev, soldiers: list };
    });
  }, [selectedSldId]);

  const handleSetPreferred = useCallback((weaponName) => {
    setHQ(prev => {
      const idx = prev.soldiers.findIndex(s => s.id === selectedSldId);
      if (idx < 0) return prev;
      const sld = prev.soldiers[idx];
      if (!weaponName) {
        const list = prev.soldiers.slice();
        list[idx] = { ...sld, preferredWeapon: null };
        return { ...prev, soldiers: list };
      }
      const unlocked = sld.unlockedWeapons || [];
      if (!unlocked.includes(weaponName)) return prev;
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
        soldierCount={hq.soldiers.length}
        onPick={handlePickRecruit}
        onBack={() => setSubpage(null)}
      />
    );
  } else if ((subpage === 'soldier' || subpage === 'upgrade') && selectedSoldier) {
    // A paid-but-unchosen upgrade always wins: the soldier detail page is
    // locked until the player picks a skill (which is what they paid for).
    const hasPending = selectedSoldier.pendingUpgrade && selectedSoldier.pendingUpgrade.skill1Name;
    if (subpage === 'upgrade' || hasPending) {
      main = (
        <HQUpgradeChoice
          soldier={selectedSoldier}
          squadName={hq.name}
          onBack={() => { setSubpage(null); setSelectedSldId(null); }}
          onConfirm={handleConfirmUpgrade}
        />
      );
    } else {
      main = (
        <HQSoldierDetail
          soldier={selectedSoldier}
          tokens={hq.tokens}
          onUpgrade={handleOpenUpgrade}
          onSetPreferred={handleSetPreferred}
          onRename={handleRename}
        />
      );
    }
  } else if (subpage === 'opponents') {
    main = (
      <HQOpponentSelect
        mySquad={hq}
        serverOnline={serverOnline}
        onBack={() => setSubpage(null)}
        onAttack={handleAttack}
      />
    );
  } else if (subpage === 'battle' && battleTarget) {
    const BattleScreen = window.HQBattleScreen;
    const handleBattleDone = (result) => {
      const tokensWon = (result && Number(result.tokensWon)) || 0;
      if (tokensWon > 0) {
        setHQ(prev => ({ ...prev, tokens: (prev.tokens || 0) + tokensWon }));
      }
      markOpponentPackRefreshable(hq.name);
      setSubpage(null);
      setBattleTarget(null);
    };
    main = BattleScreen ? (
      <BattleScreen
        mySquad={hq}
        oppSquad={battleTarget}
        onDone={handleBattleDone}
      />
    ) : (
      <HQBattleSplash
        opp={battleTarget}
        onDone={handleBattleDone}
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
          selectedId={(subpage === 'soldier' || subpage === 'upgrade') ? selectedSldId : null}
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
