// Game UI (Prod mode). Composed of:
//   <GameApp> — owns the current page state (home / login / hq) and the
//   selected squad name. Renders one page at a time inside a fading wrapper.
//
//   <HomePage>   — 5 random soldiers + create / join squad forms
//   <LoginPage>  — black hacker-style password screen
//   <HQPage>     — blank white placeholder (we'll fill it later)
//
// All squads are stored in localStorage under `squadron-squads`. Passwords are
// stored in plaintext: this is a local-only prototype with no backend, so it
// is fine for now — must NOT ship to a real server as-is.
//
// Wrapped in an IIFE so our top-level `const` declarations don't collide with
// the ones in app.jsx (Babel-standalone re-injects each script into the global
// lexical scope, which would cause a redeclaration error).

(function () {

const { useState, useEffect, useMemo, useRef, useCallback } = React;

const SQUADS_KEY = 'squadron-squads';

const SKILL1_NAMES = ['Glock 17', 'Uzi', 'Mossberg 500', 'AKS-74U', 'Steyr Scout'];

// ---------------- Squad storage ----------------
function loadSquads() {
  try {
    const raw = localStorage.getItem(SQUADS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function saveSquads(map) {
  try { localStorage.setItem(SQUADS_KEY, JSON.stringify(map)); } catch (e) {}
}

function squadExists(name) {
  return Object.prototype.hasOwnProperty.call(loadSquads(), name);
}

function createSquad(name, password, founder) {
  const map = loadSquads();
  if (map[name]) return { ok: false, error: 'Une squad avec ce nom existe déjà.' };
  map[name] = { password, founder, createdAt: Date.now() };
  saveSquads(map);
  return { ok: true };
}

function verifySquadPassword(name, password) {
  const map = loadSquads();
  const s = map[name];
  return !!(s && s.password === password);
}

function listSquadNames() {
  return Object.keys(loadSquads()).sort();
}

// ---------------- Random helpers ----------------
function randInt(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[randInt(arr.length)]; }

function getWeaponByName(name) {
  return (window.Weapons && window.Weapons.list || []).find((w) => w.name === name) || null;
}

function pickSkills() {
  const skill1Name = pick(SKILL1_NAMES);
  const allNames = (window.Weapons.list || []).map((w) => w.name).filter((n) => n !== skill1Name);
  const skill2Name = pick(allNames);
  return { skill1Name, skill2Name };
}

function randomHomeConfig(skill1Name) {
  const UI = window.SquadronUI;
  const Palette = window.Palette;
  const bodyType = pick(['male', 'female']);
  const hairOptions = UI.hairStyleOptionsForBody(bodyType);
  const hairStyleIdx = hairOptions.length ? pick(hairOptions).idx : 0;

  const skill1 = getWeaponByName(skill1Name);
  const weaponIdx = skill1 ? window.Weapons.list.indexOf(skill1) : 0;

  const cfg = {
    bodyType,
    skinIdx: randInt(Palette.skin.length),
    hairIdx: randInt(Palette.hair.length),
    hairStyleIdx,
    eyeIdx: randInt(Palette.eye.length),
    uniformIdx: randInt(Palette.uniforms.length),
    vestOn: false,
    backpackOn: false,
    hatIdx: 0,
    weaponIdx: Math.max(0, weaponIdx),
    weaponSkinIdx: 33
  };

  return UI.normalizeCharacterConfig(cfg);
}

function buildSoldiers(count = 5) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const skills = pickSkills();
    out.push({
      id: 'soldier-' + i + '-' + Math.random().toString(36).slice(2, 8),
      config: randomHomeConfig(skills.skill1Name),
      skill1Name: skills.skill1Name,
      skill2Name: skills.skill2Name
    });
  }
  return out;
}

// ---------------- ModeToggleFab ----------------
function ModeToggleFab({ onSwitchMode, variant }) {
  return (
    <button
      type="button"
      className={'mode-toggle-fab' + (variant ? ' ' + variant : '')}
      onClick={() => onSwitchMode && onSwitchMode('dev')}
      title="Retour à l'éditeur de personnage"
    >
      ← DEV MODE
    </button>
  );
}

// ---------------- RandomSoldierCard ----------------
function RandomSoldierCard({ soldier, selected, onSelect }) {
  const { AnimPreview, WeaponGameIcon } = window.SquadronUI;
  const skill1 = getWeaponByName(soldier.skill1Name);
  const skill2 = getWeaponByName(soldier.skill2Name);

  return (
    <button
      type="button"
      className={'sq-soldier' + (selected ? ' selected' : '')}
      onClick={() => onSelect(soldier.id)}
      title={'Soldat — ' + soldier.skill1Name + ' / ' + soldier.skill2Name}
    >
      <div className="sq-soldier-stage">
        <AnimPreview cfg={soldier.config} animKey="idle" scale={1.4} facing={1} running={true} />
      </div>
      <div className="sq-skills-row">
        {skill1 ? <WeaponGameIcon weapon={skill1} /> : <span className="sq-skill-fallback" />}
        {skill2 ? <WeaponGameIcon weapon={skill2} /> : <span className="sq-skill-fallback" />}
      </div>
    </button>
  );
}

// ---------------- HomePage ----------------
function HomePage({ soldiers, onCreate, onJoin }) {
  const [selectedId, setSelectedId] = useState(null);
  const [squadName, setSquadName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [squads, setSquads] = useState(() => listSquadNames());

  const refreshSquads = () => setSquads(listSquadNames());

  const selectedSoldier = soldiers.find((s) => s.id === selectedId) || null;
  const canCreate = !!selectedSoldier && squadName.trim().length >= 2 && password.length >= 1;

  const handleCreate = (e) => {
    e.preventDefault();
    setError(null);
    if (!selectedSoldier) { setError('Sélectionne un soldat avant de créer ta squad.'); return; }
    const name = squadName.trim();
    if (name.length < 2) { setError('Le nom de la squad doit faire au moins 2 caractères.'); return; }
    if (password.length < 1) { setError('Le mot de passe ne peut pas être vide.'); return; }
    const founder = {
      config: selectedSoldier.config,
      skill1Name: selectedSoldier.skill1Name,
      skill2Name: selectedSoldier.skill2Name
    };
    const res = createSquad(name, password, founder);
    if (!res.ok) { setError(res.error); refreshSquads(); return; }
    refreshSquads();
    onCreate(name);
  };

  return (
    <div className="gp-page gp-home">
      <div className="gp-bg" />
      <div className="gp-overlay" />

      <div className="sq-card">
        <div className="sq-card-header">
          <div className="sq-card-title">SQUADRON</div>
          <div className="sq-card-sub">Choisis ton soldat fondateur — crée ou rejoins une squad</div>
        </div>

        <div className="sq-soldier-grid">
          {soldiers.map((s) => (
            <RandomSoldierCard
              key={s.id}
              soldier={s}
              selected={selectedId === s.id}
              onSelect={setSelectedId}
            />
          ))}
        </div>

        <div className="sq-actions">
          <form className="sq-create" onSubmit={handleCreate}>
            <div className="sq-section-title">CRÉER MA SQUAD</div>
            <div className="sq-fields">
              <input
                type="text"
                className="sq-input"
                placeholder="Nom de la squad"
                value={squadName}
                maxLength={24}
                onChange={(e) => { setSquadName(e.target.value); setError(null); }}
              />
              <input
                type="password"
                className="sq-input"
                placeholder="Mot de passe"
                value={password}
                maxLength={48}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
              />
              <button
                type="submit"
                className={'sq-btn sq-btn-primary' + (canCreate ? '' : ' is-disabled')}
                disabled={!canCreate}
              >
                CRÉER
              </button>
            </div>
            {!selectedSoldier ? (
              <div className="sq-hint">Clique sur un soldat ci-dessus pour le sélectionner.</div>
            ) : (
              <div className="sq-hint sq-hint-ok">
                Soldat fondateur : {selectedSoldier.skill1Name} + {selectedSoldier.skill2Name}
              </div>
            )}
            {error ? <div className="sq-error">{error}</div> : null}
          </form>

          {squads.length > 0 ? (
            <div className="sq-join">
              <div className="sq-section-title">REJOINDRE UNE SQUAD</div>
              <div className="sq-squad-list">
                {squads.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="sq-squad-entry"
                    onClick={() => onJoin(name)}
                    title={'Se connecter à ' + name}
                  >
                    <span className="sq-squad-name">{name}</span>
                    <span className="sq-squad-arrow">→</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="sq-join sq-join-empty">
              <div className="sq-section-title">REJOINDRE UNE SQUAD</div>
              <div className="sq-hint">Aucune squad enregistrée pour le moment.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- HackerTyper ----------------
function HackerTyper({ text, speed = 38, jitter = 16, onDone }) {
  const [typed, setTyped] = useState('');
  const idxRef = useRef(0);
  const doneRef = useRef(false);
  // Keep onDone in a ref so parent re-renders that pass a fresh function don't
  // restart the typing animation.
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    idxRef.current = 0;
    doneRef.current = false;
    setTyped('');
    let cancelled = false;
    let timeoutId = null;

    const tick = () => {
      if (cancelled) return;
      const next = idxRef.current + 1;
      if (next > text.length) {
        if (!doneRef.current) {
          doneRef.current = true;
          if (onDoneRef.current) onDoneRef.current();
        }
        return;
      }
      idxRef.current = next;
      setTyped(text.slice(0, next));
      const delay = Math.max(10, speed + (Math.random() * 2 - 1) * jitter);
      timeoutId = setTimeout(tick, delay);
    };

    timeoutId = setTimeout(tick, speed);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [text, speed, jitter]);

  return (
    <span className="hk-typer">
      <span className="hk-typed">{typed}</span>
      <span className="hk-caret">▍</span>
    </span>
  );
}

// ---------------- LoginPage ----------------
function LoginPage({ squadName, onSuccess, onBack }) {
  const [typingDone, setTypingDone] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const promptText = `> Entrez le mot de passe de la Squad « ${squadName} »...`;

  useEffect(() => {
    if (typingDone && inputRef.current) {
      const t = setTimeout(() => { inputRef.current && inputRef.current.focus(); }, 80);
      return () => clearTimeout(t);
    }
  }, [typingDone]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (verifySquadPassword(squadName, password)) {
      onSuccess(squadName);
    } else {
      setError('ACCESS DENIED — mot de passe invalide.');
    }
  };

  return (
    <div className="gp-page hk-screen">
      <div className="hk-frame">
        <div className="hk-line">
          <span className="hk-prompt-tag">[SQUADRON-AUTH]</span>
        </div>
        <div className="hk-line hk-prompt">
          <HackerTyper text={promptText} onDone={() => setTypingDone(true)} />
        </div>

        {typingDone && (
          <form className="hk-form" onSubmit={handleSubmit}>
            <div className="hk-input-row">
              <span className="hk-prompt-symbol">$</span>
              <input
                ref={inputRef}
                type="password"
                className="hk-input"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="••••••••"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className="hk-submit">ENTER</button>
            </div>
            {error ? <div className="hk-error">{error}</div> : null}
            <button type="button" className="hk-back" onClick={onBack}>← annuler</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------------- HQPage ----------------
function HQPage() {
  return (
    <div className="gp-page hq-blank" />
  );
}

// ---------------- GameApp ----------------
function GameApp({ onSwitchMode }) {
  const [page, setPage] = useState('home');
  const [currentSquadName, setCurrentSquadName] = useState(null);
  // Random soldiers are generated once per GameApp mount (i.e. once per prod
  // session). Going home → login → back does NOT reshuffle them.
  const [soldiers] = useState(() => buildSoldiers(5));

  // Force a known weapon skin so all home soldiers share the same texture.
  useEffect(() => {
    if (window.Weapons && typeof window.Weapons.setSkinIdx === 'function') {
      window.Weapons.setSkinIdx(33);
    }
  }, []);

  const goHome = useCallback(() => { setCurrentSquadName(null); setPage('home'); }, []);
  const goLogin = useCallback((name) => { setCurrentSquadName(name); setPage('login'); }, []);
  const goHQ = useCallback((name) => { setCurrentSquadName(name); setPage('hq'); }, []);

  let content = null;
  if (page === 'home') {
    content = <HomePage soldiers={soldiers} onCreate={goHQ} onJoin={goLogin} />;
  } else if (page === 'login') {
    content = (
      <LoginPage
        squadName={currentSquadName}
        onSuccess={goHQ}
        onBack={goHome}
      />
    );
  } else if (page === 'hq') {
    content = <HQPage />;
  }

  const fabVariant = page === 'hq' ? 'on-light' : '';

  return (
    <div className="game-app">
      <ModeToggleFab onSwitchMode={onSwitchMode} variant={fabVariant} />
      <div className="gp-viewport" key={page}>
        {content}
      </div>
    </div>
  );
}

window.SquadronGame = { GameApp };

})();
