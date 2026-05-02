// Game UI (Prod mode). Composed of:
//   <GameApp> — owns the current page state (home / login / hq) and the
//   selected squad name. Renders one page at a time inside a fading wrapper.
//
//   <HomePage>   — 8 random soldiers + create / join squad forms
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
const SOLDIER_COUNT = 8;

const SKILL1_NAMES = ['Glock 17', 'Uzi', 'Mossberg 500', 'AKS-74U', 'Steyr Scout'];

const MALE_NAMES = [
  'Achille', 'Adrien', 'Alaric', 'Albert', 'Aldric', 'Alexandre', 'Amaury', 'Anatole', 'Anselme', 'Antoine',
  'Apollon', 'Archibald', 'Aristide', 'Armand', 'Arnaud', 'Arsène', 'Arthur', 'Aurélien', 'Balthazar',
  'Barnabé', 'Bastien', 'Baudouin', 'Benoît', 'Bertrand', 'Boris', 'Brutus', 'Cassius', 'Célestin',
  'César', 'Charlemagne', 'Christophe', 'Clément', 'Constantin', 'Cyprien', 'Damien', 'Désiré',
  'Dimitri', 'Dorian', 'Edmond', 'Édouard', 'Egon', 'Eliott', 'Émeric', 'Émilien', 'Enguerrand',
  'Étienne', 'Eustache', 'Évrard', 'Fabien', 'Faust', 'Félix', 'Ferdinand', 'Florian', 'Gabriel',
  'Galahad', 'Gaspard', 'Gauthier', 'Geoffroy', 'Georges', 'Gildas', 'Godefroy', 'Grégoire',
  'Guillaume', 'Gustave', 'Hadrien', 'Hannibal', 'Hector', 'Henri', 'Hercule', 'Honoré', 'Hubert',
  'Hugo', 'Ignace', 'Igor', 'Ilan', 'Isidore', 'Ivan', 'Jacques', 'Jasper', 'Jean', 'Jérémie',
  'Joachim', 'Jules', 'Julien', 'Karl', 'Kaspar', 'Kazimir', 'Klaus', 'Lancelot', 'Laurent',
  'Léandre', 'Léon', 'Léonard', 'Léopold', 'Loïc', 'Lothaire', 'Louis', 'Lucien', 'Ludovic',
  'Magnus', 'Marc', 'Marius', 'Martin', 'Matthias', 'Maxence', 'Maximilien', 'Mirko', 'Modeste',
  'Mortimer', 'Nathaniel', 'Nestor', 'Nicéphore', 'Nikolaï', 'Norbert', 'Octave', 'Olaf',
  'Olivier', 'Orphée', 'Oscar', 'Othon', 'Owen', 'Pacôme', 'Pascal', 'Patrice', 'Pierre',
  'Quentin', 'Raphaël', 'Raoul', 'Régis', 'Rémi', 'Renaud', 'Reynold', 'Robin', 'Rodolphe',
  'Roger', 'Roland', 'Roméo', 'Rufus', 'Salomon', 'Samson', 'Saturnin', 'Sébastien', 'Séraphin',
  'Sigismond', 'Silas', 'Stanislas', 'Sven', 'Sylvestre', 'Tancrède', 'Théobald', 'Théodore',
  'Théophile', 'Thibault', 'Thomas', 'Tiago', 'Timothée', 'Titus', 'Tobias', 'Tristan', 'Ulrich',
  'Ulysse', 'Valentin', 'Valère', 'Vasco', 'Victor', 'Vincent', 'Vladimir', 'Wenceslas', 'Wilfried',
  'Wolfgang', 'Xavier', 'Yannick', 'Yorick', 'Zacharie', 'Zéphyr'
];

const FEMALE_NAMES = [
  'Adèle', 'Agathe', 'Agnès', 'Aimée', 'Albane', 'Alice', 'Aliénor', 'Alma', 'Amandine', 'Amélie',
  'Anaïs', 'Andromaque', 'Angélique', 'Anouk', 'Apolline', 'Ariane', 'Armance', 'Astrid', 'Athéna',
  'Aude', 'Augustine', 'Aurélie', 'Aurore', 'Avril', 'Aziliz', 'Bathilde', 'Béatrice', 'Bérengère',
  'Bérénice', 'Blanche', 'Bénédicte', 'Bertille', 'Brunehaut', 'Calliope', 'Camille', 'Capucine',
  'Carmen', 'Cassandre', 'Catherine', 'Cécile', 'Célestine', 'Célia', 'Charlotte', 'Chloé',
  'Clara', 'Clarisse', 'Clémence', 'Cléopâtre', 'Clio', 'Clothilde', 'Colette', 'Constance',
  'Coraline', 'Cordélia', 'Cyrielle', 'Daphné', 'Delphine', 'Diane', 'Dione', 'Edwige', 'Éléonore',
  'Élisa', 'Éliane', 'Éloïse', 'Elsa', 'Elvire', 'Émeline', 'Emma', 'Énora', 'Esmée', 'Esther',
  'Eulalie', 'Eustachia', 'Eva', 'Ève', 'Fanny', 'Faustine', 'Félicie', 'Flavie', 'Flore',
  'Florence', 'Fortuna', 'Frédérique', 'Freya', 'Gabrielle', 'Gaëlle', 'Garance', 'Geneviève',
  'Gisèle', 'Gwendoline', 'Hadassa', 'Hannah', 'Hélène', 'Héloïse', 'Hermine', 'Hermione',
  'Hilda', 'Hortense', 'Ilona', 'Inès', 'Irène', 'Iris', 'Isabeau', 'Isaure', 'Iseult', 'Ismérie',
  'Ivana', 'Jacinthe', 'Jade', 'Jeanne', 'Joséphine', 'Judith', 'Julie', 'Juliette', 'Justine',
  'Kalliope', 'Kassia', 'Katarina', 'Lara', 'Laure', 'Léa', 'Léonie', 'Léontine', 'Lila',
  'Lilou', 'Liv', 'Livia', 'Loriane', 'Lou', 'Louise', 'Lucile', 'Lucrèce', 'Lydie', 'Mahaut',
  'Maïa', 'Malika', 'Marceline', 'Margaux', 'Marguerite', 'Mathilde', 'Maud', 'Mélanie',
  'Mélissande', 'Mila', 'Mireille', 'Morgane', 'Muriel', 'Nadia', 'Naïma', 'Naomi', 'Natacha',
  'Nausicaa', 'Nina', 'Nora', 'Norma', 'Nour', 'Océane', 'Octavie', 'Odette', 'Odile', 'Olga',
  'Olympe', 'Ombeline', 'Ondine', 'Ophélie', 'Pauline', 'Pénélope', 'Perrine', 'Philippa',
  'Pomeline', 'Prudence', 'Rachel', 'Reine', 'Rosalie', 'Rose', 'Roxane', 'Sabine', 'Salomé',
  'Sarah', 'Selma', 'Séraphine', 'Sibylle', 'Sienna', 'Sigrid', 'Solange', 'Soline', 'Sonia',
  'Sophie', 'Stella', 'Suzanne', 'Sybille', 'Sylvie', 'Tara', 'Tatiana', 'Théa', 'Thaïs',
  'Théodora', 'Tiphaine', 'Ursula', 'Valentine', 'Vénus', 'Véra', 'Véronique', 'Victoire',
  'Violette', 'Virginie', 'Vivienne', 'Wendy', 'Wilhelmine', 'Xena', 'Yael', 'Ysaline', 'Yseult',
  'Zélie', 'Zoé'
];

const WEAPON_TYPE_LABELS = {
  pistol: 'Pistolet',
  smg: 'Mitraillette',
  shotgun: 'Fusil à pompe',
  rifle: 'Fusil d\'assaut',
  sniper: 'Fusil de précision',
  heavy: 'Arme lourde'
};

const STANCE_LABELS = {
  'one-hand': 'Une main',
  'compact': 'Compacte',
  'shoulder': 'À l\'épaule',
  'low-heavy': 'Basse / lourde',
  'precision': 'Précision',
  'braced': 'Calée'
};

const RECOIL_LABELS = {
  'snap': 'Recul sec',
  'buzz': 'Recul vibrant',
  'medium': 'Recul moyen',
  'pump': 'Recul à pompe',
  'controlled-heavy': 'Recul lourd contrôlé',
  'heavy': 'Recul lourd'
};

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

function pickSoldierName(bodyType) {
  const list = bodyType === 'female' ? FEMALE_NAMES : MALE_NAMES;
  return pick(list);
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

function buildSoldiers(count = SOLDIER_COUNT) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const skills = pickSkills();
    const config = randomHomeConfig(skills.skill1Name);
    out.push({
      id: 'soldier-' + i + '-' + Math.random().toString(36).slice(2, 8),
      config,
      name: pickSoldierName(config.bodyType),
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

// ---------------- SkillTooltip ----------------
// Wraps a skill icon and shows a contextual tooltip on hover. For weapon
// skills the tooltip contains the weapon name, key specs, and a sprite preview.
// For non-weapon skills (future), `text` provides plain description content.
//
// Rendered through a portal so the tooltip can escape the parent strip's
// horizontal-scroll overflow clipping.
function SkillTooltip({ weapon, text, children }) {
  const hasWeapon = !!weapon;
  const WeaponIcon = window.SquadronUI && window.SquadronUI.WeaponIcon;
  const wrapRef = useRef(null);
  const [anchor, setAnchor] = useState(null);

  const updateAnchor = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({ cx: r.left + r.width / 2, top: r.top });
  }, []);

  const handleEnter = () => updateAnchor();
  const handleLeave = () => setAnchor(null);

  // Re-anchor on scroll/resize so the tooltip tracks its source while open.
  useEffect(() => {
    if (!anchor) return;
    window.addEventListener('scroll', updateAnchor, true);
    window.addEventListener('resize', updateAnchor);
    return () => {
      window.removeEventListener('scroll', updateAnchor, true);
      window.removeEventListener('resize', updateAnchor);
    };
  }, [anchor, updateAnchor]);

  const tipBody = hasWeapon ? (
    <>
      <div className="sq-skill-tip-head">
        <div className="sq-skill-tip-name">{weapon.name}</div>
        <div className="sq-skill-tip-type">{WEAPON_TYPE_LABELS[weapon.type] || weapon.type}</div>
      </div>
      <div className="sq-skill-tip-image">
        {WeaponIcon ? <WeaponIcon weapon={weapon} scale={2} /> : null}
      </div>
      <div className="sq-skill-tip-specs">
        <div className="sq-skill-tip-spec">
          <span className="sq-skill-tip-spec-key">Mains</span>
          <span className="sq-skill-tip-spec-val">{weapon.twoHanded ? '2H' : '1H'}</span>
        </div>
        <div className="sq-skill-tip-spec">
          <span className="sq-skill-tip-spec-key">Taille</span>
          <span className="sq-skill-tip-spec-val">{weapon.width}×{weapon.height}px</span>
        </div>
        <div className="sq-skill-tip-spec">
          <span className="sq-skill-tip-spec-key">Stance</span>
          <span className="sq-skill-tip-spec-val">{STANCE_LABELS[weapon.stanceProfile] || weapon.stanceProfile || '—'}</span>
        </div>
        <div className="sq-skill-tip-spec">
          <span className="sq-skill-tip-spec-key">Recul</span>
          <span className="sq-skill-tip-spec-val">{RECOIL_LABELS[weapon.recoilProfile] || weapon.recoilProfile || '—'}</span>
        </div>
      </div>
    </>
  ) : (
    <div className="sq-skill-tip-text">{text || 'Skill inconnue.'}</div>
  );

  const tipNode = anchor && ReactDOM.createPortal(
    <div
      className="sq-skill-tip"
      role="tooltip"
      style={{ left: anchor.cx, top: anchor.top }}
    >
      {tipBody}
    </div>,
    document.body
  );

  return (
    <span
      ref={wrapRef}
      className="sq-skill-wrap"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      {tipNode}
    </span>
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
    >
      <div className="sq-soldier-stage">
        <AnimPreview cfg={soldier.config} animKey="idle" scale={0.85} facing={1} running={true} />
      </div>
      <div className="sq-soldier-name">{soldier.name}</div>
      <div className="sq-skills-row">
        {skill1
          ? <SkillTooltip weapon={skill1}><WeaponGameIcon weapon={skill1} /></SkillTooltip>
          : <span className="sq-skill-fallback" />}
        {skill2
          ? <SkillTooltip weapon={skill2}><WeaponGameIcon weapon={skill2} /></SkillTooltip>
          : <span className="sq-skill-fallback" />}
      </div>
    </button>
  );
}

// ---------------- HomePage ----------------
function HomePage({ soldiers, onCreate, onJoin }) {
  const [selectedId, setSelectedId] = useState(null);
  const [squadName, setSquadName] = useState('');
  const [password, setPassword] = useState('');
  const [joinName, setJoinName] = useState('');
  const [createError, setCreateError] = useState(null);
  const [joinError, setJoinError] = useState(null);

  const selectedSoldier = soldiers.find((s) => s.id === selectedId) || null;
  const trimmedName = squadName.trim();
  const canCreate = !!selectedSoldier && trimmedName.length >= 2;

  // Reason shown on hover over the disabled CRÉER button.
  let disabledReason = '';
  if (!selectedSoldier && trimmedName.length < 2) {
    disabledReason = 'Choisis un soldat et donne un nom à ta squad.';
  } else if (!selectedSoldier) {
    disabledReason = 'Choisis un soldat fondateur.';
  } else if (trimmedName.length < 2) {
    disabledReason = 'Le nom de la squad doit faire au moins 2 caractères.';
  }

  const handleCreate = (e) => {
    e.preventDefault();
    setCreateError(null);
    if (!canCreate) return;
    const founder = {
      config: selectedSoldier.config,
      name: selectedSoldier.name,
      skill1Name: selectedSoldier.skill1Name,
      skill2Name: selectedSoldier.skill2Name
    };
    const res = createSquad(trimmedName, password, founder);
    if (!res.ok) { setCreateError(res.error); return; }
    onCreate(trimmedName);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    setJoinError(null);
    const name = joinName.trim();
    if (name.length < 2) { setJoinError('Entre un nom de squad valide.'); return; }
    onJoin(name);
  };

  return (
    <div className="gp-page gp-home">
      <div className="gp-bg" />
      <div className="gp-overlay" />

      <div className="sq-card">
        <div className="sq-card-header">
          <div className="sq-card-title">SQUADRON</div>
          <div className="sq-card-sub">Une squad pour les gouverner tous</div>
        </div>

        <div className="sq-soldier-strip">
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
        </div>

        <div className="sq-actions">
          <form className="sq-create sq-col" onSubmit={handleCreate}>
            <div className="sq-section-title">CRÉER MA SQUAD</div>
            <div className="sq-fields">
              <input
                type="text"
                className="sq-input"
                placeholder="Nom de la squad"
                value={squadName}
                maxLength={24}
                onChange={(e) => { setSquadName(e.target.value); setCreateError(null); }}
              />
              <input
                type="password"
                className="sq-input"
                placeholder="Mot de passe (optionnel)"
                value={password}
                maxLength={48}
                onChange={(e) => { setPassword(e.target.value); setCreateError(null); }}
              />
            </div>
            <div className="sq-col-spacer" />
            <div
              className="sq-btn-wrap"
              data-tooltip={canCreate ? '' : disabledReason}
            >
              <button
                type="submit"
                className={'sq-btn sq-btn-primary' + (canCreate ? '' : ' is-disabled')}
                disabled={!canCreate}
              >
                CRÉER
              </button>
            </div>
            {createError ? <div className="sq-error">{createError}</div> : null}
          </form>

          <div className="sq-or" aria-hidden="true">
            <span className="sq-or-line" />
            <span className="sq-or-text">OU</span>
            <span className="sq-or-line" />
          </div>

          <form className="sq-join sq-col" onSubmit={handleJoin}>
            <div className="sq-section-title">REJOINDRE UNE SQUAD</div>
            <div className="sq-fields">
              <input
                type="text"
                className="sq-input"
                placeholder="Nom de la squad"
                value={joinName}
                maxLength={24}
                onChange={(e) => { setJoinName(e.target.value); setJoinError(null); }}
              />
            </div>
            <div className="sq-col-spacer" />
            <div className="sq-btn-wrap">
              <button
                type="submit"
                className={'sq-btn' + (joinName.trim().length >= 2 ? '' : ' is-disabled')}
                disabled={joinName.trim().length < 2}
              >
                REJOINDRE
              </button>
            </div>
            {joinError ? <div className="sq-error">{joinError}</div> : null}
          </form>
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
    if (!squadExists(squadName)) {
      setError('ACCESS DENIED — squad introuvable.');
      return;
    }
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
  const [soldiers] = useState(() => buildSoldiers(SOLDIER_COUNT));

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
