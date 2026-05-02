// Game UI (Prod mode).
// Wrapped in an IIFE so top-level `const` declarations don't collide with app.jsx.

(function () {

const { useState, useEffect, useRef, useCallback } = React;

const SQUADS_KEY    = 'squadron-squads';
const SOLDIER_COUNT = 8;
const SKILL1_NAMES  = ['Glock 17', 'Uzi', 'Mossberg 500', 'AKS-74U', 'Steyr Scout'];
const SERVER_URL    = 'http://127.0.0.1:3001';

// ── Weapon stats (from weapon-config.json) ──────────────────────────────────
const weaponStats = {};
fetch('./weapon-config.json')
  .then(r => r.json())
  .then(data => { for (const w of data.weapons) weaponStats[w.id] = w; })
  .catch(() => {});

// ── Name lists ───────────────────────────────────────────────────────────────
const MALE_NAMES = [
  'Achille','Adrien','Alaric','Albert','Aldric','Alexandre','Amaury','Anatole','Anselme','Antoine',
  'Apollon','Archibald','Aristide','Armand','Arnaud','Arsène','Arthur','Aurélien','Balthazar',
  'Barnabé','Bastien','Baudouin','Benoît','Bertrand','Boris','Brutus','Cassius','Célestin',
  'César','Charlemagne','Christophe','Clément','Constantin','Cyprien','Damien','Désiré',
  'Dimitri','Dorian','Edmond','Édouard','Egon','Eliott','Émeric','Émilien','Enguerrand',
  'Étienne','Eustache','Évrard','Fabien','Faust','Félix','Ferdinand','Florian','Gabriel',
  'Galahad','Gaspard','Gauthier','Geoffroy','Georges','Gildas','Godefroy','Grégoire',
  'Guillaume','Gustave','Hadrien','Hannibal','Hector','Henri','Hercule','Honoré','Hubert',
  'Hugo','Ignace','Igor','Ilan','Isidore','Ivan','Jacques','Jasper','Jean','Jérémie',
  'Joachim','Jules','Julien','Karl','Kaspar','Kazimir','Klaus','Lancelot','Laurent',
  'Léandre','Léon','Léonard','Léopold','Loïc','Lothaire','Louis','Lucien','Ludovic',
  'Magnus','Marc','Marius','Martin','Matthias','Maxence','Maximilien','Mirko','Modeste',
  'Mortimer','Nathaniel','Nestor','Nicéphore','Nikolaï','Norbert','Octave','Olaf',
  'Olivier','Orphée','Oscar','Othon','Owen','Pacôme','Pascal','Patrice','Pierre',
  'Quentin','Raphaël','Raoul','Régis','Rémi','Renaud','Reynold','Robin','Rodolphe',
  'Roger','Roland','Roméo','Rufus','Salomon','Samson','Saturnin','Sébastien','Séraphin',
  'Sigismond','Silas','Stanislas','Sven','Sylvestre','Tancrède','Théobald','Théodore',
  'Théophile','Thibault','Thomas','Tiago','Timothée','Titus','Tobias','Tristan','Ulrich',
  'Ulysse','Valentin','Valère','Vasco','Victor','Vincent','Vladimir','Wenceslas','Wilfried',
  'Wolfgang','Xavier','Yannick','Yorick','Zacharie','Zéphyr'
];

const FEMALE_NAMES = [
  'Adèle','Agathe','Agnès','Aimée','Albane','Alice','Aliénor','Alma','Amandine','Amélie',
  'Anaïs','Andromaque','Angélique','Anouk','Apolline','Ariane','Armance','Astrid','Athéna',
  'Aude','Augustine','Aurélie','Aurore','Avril','Aziliz','Bathilde','Béatrice','Bérengère',
  'Bérénice','Blanche','Bénédicte','Bertille','Brunehaut','Calliope','Camille','Capucine',
  'Carmen','Cassandre','Catherine','Cécile','Célestine','Célia','Charlotte','Chloé',
  'Clara','Clarisse','Clémence','Cléopâtre','Clio','Clothilde','Colette','Constance',
  'Coraline','Cordélia','Cyrielle','Daphné','Delphine','Diane','Dione','Edwige','Éléonore',
  'Élisa','Éliane','Éloïse','Elsa','Elvire','Émeline','Emma','Énora','Esmée','Esther',
  'Eulalie','Eustachia','Eva','Ève','Fanny','Faustine','Félicie','Flavie','Flore',
  'Florence','Fortuna','Frédérique','Freya','Gabrielle','Gaëlle','Garance','Geneviève',
  'Gisèle','Gwendoline','Hadassa','Hannah','Hélène','Héloïse','Hermine','Hermione',
  'Hilda','Hortense','Ilona','Inès','Irène','Iris','Isabeau','Isaure','Iseult','Ismérie',
  'Ivana','Jacinthe','Jade','Jeanne','Joséphine','Judith','Julie','Juliette','Justine',
  'Kalliope','Kassia','Katarina','Lara','Laure','Léa','Léonie','Léontine','Lila',
  'Lilou','Liv','Livia','Loriane','Lou','Louise','Lucile','Lucrèce','Lydie','Mahaut',
  'Maïa','Malika','Marceline','Margaux','Marguerite','Mathilde','Maud','Mélanie',
  'Mélissande','Mila','Mireille','Morgane','Muriel','Nadia','Naïma','Naomi','Natacha',
  'Nausicaa','Nina','Nora','Norma','Nour','Océane','Octavie','Odette','Odile','Olga',
  'Olympe','Ombeline','Ondine','Ophélie','Pauline','Pénélope','Perrine','Philippa',
  'Pomeline','Prudence','Rachel','Reine','Rosalie','Rose','Roxane','Sabine','Salomé',
  'Sarah','Selma','Séraphine','Sibylle','Sienna','Sigrid','Solange','Soline','Sonia',
  'Sophie','Stella','Suzanne','Sybille','Sylvie','Tara','Tatiana','Théa','Thaïs',
  'Théodora','Tiphaine','Ursula','Valentine','Vénus','Véra','Véronique','Victoire',
  'Violette','Virginie','Vivienne','Wendy','Wilhelmine','Xena','Yael','Ysaline','Yseult',
  'Zélie','Zoé'
];

const WEAPON_TYPE_LABELS = {
  pistol:'Pistolet', smg:"Mitraillette", shotgun:"Fusil à pompe",
  rifle:"Fusil d'assaut", sniper:"Fusil de précision", heavy:"Arme lourde"
};

// ── Squad storage (offline mode — localStorage) ──────────────────────────────
function loadSquads() {
  try {
    const raw = localStorage.getItem(SQUADS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? p : {};
  } catch (e) { return {}; }
}
function saveSquads(map) {
  try { localStorage.setItem(SQUADS_KEY, JSON.stringify(map)); } catch (e) {}
}
function squadExists(name) {
  return Object.prototype.hasOwnProperty.call(loadSquads(), name);
}
function squadHasPassword(name) {
  const s = loadSquads()[name];
  return !!(s && s.password && s.password.length > 0);
}
function createSquad(name, password, founder) {
  const map = loadSquads();
  if (map[name]) return { ok: false, error: 'Une squad avec ce nom existe déjà.' };
  map[name] = { password, founder, createdAt: Date.now() };
  saveSquads(map);
  return { ok: true };
}
function verifySquadPassword(name, password) {
  const s = loadSquads()[name];
  return !!(s && s.password === password);
}

// ── Server API helper ─────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res  = await fetch(SERVER_URL + path, {
      ...opts,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Délai dépassé.' : 'Serveur inaccessible.';
    return { ok: false, status: 0, data: { error: msg } };
  } finally {
    clearTimeout(tid);
  }
}

// ── Random helpers (offline mode) ────────────────────────────────────────────
function randInt(n) { return Math.floor(Math.random() * n); }
function pick(arr)  { return arr[randInt(arr.length)]; }
function getWeaponByName(name) {
  return (window.Weapons && window.Weapons.list || []).find(w => w.name === name) || null;
}
function pickSkills() {
  const skill1Name = pick(SKILL1_NAMES);
  const allNames = (window.Weapons.list || []).map(w => w.name).filter(n => n !== skill1Name);
  return { skill1Name, skill2Name: pick(allNames) };
}
function randomHomeConfig(skill1Name) {
  const UI = window.SquadronUI;
  const Pal = window.Palette;
  const bodyType = pick(['male','female']);
  const hairOptions = UI.hairStyleOptionsForBody(bodyType);
  const hairStyleIdx = hairOptions.length ? pick(hairOptions).idx : 0;
  const skill1 = getWeaponByName(skill1Name);
  const weaponIdx = skill1 ? window.Weapons.list.indexOf(skill1) : 0;
  return UI.normalizeCharacterConfig({
    bodyType, hairStyleIdx, weaponSkinIdx: 33,
    skinIdx: randInt(Pal.skin.length),
    hairIdx: randInt(Pal.hair.length),
    eyeIdx: randInt(Pal.eye.length),
    uniformIdx: randInt(Pal.uniforms.length),
    vestOn: false, backpackOn: false, hatIdx: 0,
    weaponIdx: Math.max(0, weaponIdx)
  });
}
function buildSoldiers(count = SOLDIER_COUNT) {
  return Array.from({ length: count }, (_, i) => {
    const skills = pickSkills();
    const config = randomHomeConfig(skills.skill1Name);
    return {
      id: 'soldier-' + i + '-' + Math.random().toString(36).slice(2, 8),
      config,
      name: pick(config.bodyType === 'female' ? FEMALE_NAMES : MALE_NAMES),
      skill1Name: skills.skill1Name,
      skill2Name: skills.skill2Name
    };
  });
}

// ── ServerCheckPage ───────────────────────────────────────────────────────────
function ServerCheckPage({ onOnline, onOffline }) {
  const [progress,  setProgress]  = useState(0);
  const [timedOut,  setTimedOut]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    // Animate bar to 85 % over ~9.5 s
    const ticker = setInterval(() => {
      if (cancelled) return;
      setProgress(Math.min(85, ((Date.now() - start) / 9500) * 85));
    }, 80);

    const ctrl      = new AbortController();
    const hardLimit = setTimeout(() => {
      if (cancelled) return;
      ctrl.abort();
      clearInterval(ticker);
      setProgress(100);
      setTimedOut(true);
    }, 10000);

    fetch(SERVER_URL + '/api/health', { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d && d.status === 'ok') {
          clearInterval(ticker);
          clearTimeout(hardLimit);
          setProgress(100);
          setTimeout(() => { if (!cancelled) onOnline(); }, 280);
        }
      })
      .catch(err => {
        if (cancelled || err.name === 'AbortError') return;
        clearInterval(ticker);
        clearTimeout(hardLimit);
        setProgress(100);
        setTimedOut(true);
      });

    return () => {
      cancelled = true;
      clearInterval(ticker);
      clearTimeout(hardLimit);
      ctrl.abort();
    };
  }, [onOnline]);

  return (
    <div className="gp-page srv-check-page">
      <div className="gp-bg" /><div className="gp-overlay" />
      <div className="srv-check-card">
        <div className="srv-check-badge">◈ SQUADRON ◈</div>
        <div className="srv-check-title">CONNEXION AU SERVEUR</div>
        <div className="srv-check-bar-wrap">
          <div
            className="srv-check-bar"
            style={{
              width: progress + '%',
              transition: timedOut ? 'none' : 'width 80ms linear',
            }}
          />
        </div>
        {timedOut ? (
          <div className="srv-check-error-block">
            <div className="srv-check-error-msg">Serveur introuvable</div>
            <button className="sq-btn" onClick={onOffline}>Mode hors ligne</button>
          </div>
        ) : (
          <div className="srv-check-sub">Recherche du serveur…</div>
        )}
      </div>
    </div>
  );
}

// ── ModeToggleFab ────────────────────────────────────────────────────────────
function ModeToggleFab({ onSwitchMode, variant }) {
  return (
    <button
      type="button"
      className={'mode-toggle-fab' + (variant ? ' ' + variant : '')}
      onClick={() => onSwitchMode && onSwitchMode('dev')}
      title="Retour à l'éditeur de personnage"
    >← DEV MODE</button>
  );
}

// ── SkillTooltip ─────────────────────────────────────────────────────────────
function SkillTooltip({ weapon, text, children }) {
  const WeaponIcon = window.SquadronUI && window.SquadronUI.WeaponIcon;
  const wrapRef = useRef(null);
  const [anchor, setAnchor] = useState(null);

  const updateAnchor = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({ cx: r.left + r.width / 2, top: r.top });
  }, []);

  useEffect(() => {
    if (!anchor) return;
    window.addEventListener('scroll', updateAnchor, true);
    window.addEventListener('resize', updateAnchor);
    return () => {
      window.removeEventListener('scroll', updateAnchor, true);
      window.removeEventListener('resize', updateAnchor);
    };
  }, [anchor, updateAnchor]);

  const stats = weapon ? weaponStats[weapon.id] : null;

  const tipBody = weapon ? (
    <>
      <div className="sq-skill-tip-head">
        <div className="sq-skill-tip-name">{weapon.name}</div>
        <div className="sq-skill-tip-type">{WEAPON_TYPE_LABELS[weapon.type] || weapon.type}</div>
      </div>
      <div className="sq-skill-tip-image">
        {WeaponIcon ? <WeaponIcon weapon={weapon} scale={2} /> : null}
      </div>
      {stats ? (
        <div className="sq-skill-tip-specs">
          <div className="sq-skill-tip-spec">
            <span className="sq-skill-tip-spec-key">Dégâts</span>
            <span className="sq-skill-tip-spec-val">{stats.damage} <span className="sq-skill-tip-unit">HP</span></span>
          </div>
          <div className="sq-skill-tip-spec">
            <span className="sq-skill-tip-spec-key">Précision</span>
            <span className="sq-skill-tip-spec-val">{Math.round(stats.accuracy * 100)}<span className="sq-skill-tip-unit">%</span></span>
          </div>
          <div className="sq-skill-tip-spec">
            <span className="sq-skill-tip-spec-key">Critique</span>
            <span className="sq-skill-tip-spec-val">{Math.round(stats.criticalChance * 100)}<span className="sq-skill-tip-unit">%</span></span>
          </div>
          <div className="sq-skill-tip-spec">
            <span className="sq-skill-tip-spec-key">Portée</span>
            <span className="sq-skill-tip-spec-val">{stats.rangeMin}–{stats.rangeMax} <span className="sq-skill-tip-unit">cases</span></span>
          </div>
        </div>
      ) : null}
    </>
  ) : (
    <div className="sq-skill-tip-text">{text || 'Skill inconnue.'}</div>
  );

  const tipNode = anchor && ReactDOM.createPortal(
    <div className="sq-skill-tip" role="tooltip" style={{ left: anchor.cx, top: anchor.top }}>
      {tipBody}
    </div>,
    document.body
  );

  return (
    <span
      ref={wrapRef}
      className="sq-skill-wrap"
      onMouseEnter={updateAnchor}
      onMouseLeave={() => setAnchor(null)}
      onFocus={updateAnchor}
      onBlur={() => setAnchor(null)}
    >
      {children}{tipNode}
    </span>
  );
}

// ── RandomSoldierCard ────────────────────────────────────────────────────────
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

// ── HomePage ─────────────────────────────────────────────────────────────────
function HomePage({ soldiers, onCreate, onJoin, onCreateSquad, serverOnline }) {
  const [selectedId,   setSelectedId]   = useState(null);
  const [squadName,    setSquadName]    = useState('');
  const [password,     setPassword]     = useState('');
  const [joinName,     setJoinName]     = useState('');
  const [createError,  setCreateError]  = useState(null);
  const [joinError,    setJoinError]    = useState(null);
  const [creating,     setCreating]     = useState(false);

  const selectedSoldier = soldiers.find(s => s.id === selectedId) || null;
  const trimmedName     = squadName.trim();
  const canCreate       = !!selectedSoldier && trimmedName.length >= 2 && !creating;

  let disabledReason = '';
  if (!selectedSoldier && trimmedName.length < 2) disabledReason = 'Choisis un soldat et donne un nom à ta squad.';
  else if (!selectedSoldier)                       disabledReason = 'Choisis un soldat fondateur.';
  else if (trimmedName.length < 2)                 disabledReason = 'Le nom doit faire au moins 2 caractères.';

  const handleCreate = async e => {
    e.preventDefault();
    setCreateError(null);
    if (!canCreate) return;
    setCreating(true);
    const res = await onCreateSquad(trimmedName, password, {
      name:       selectedSoldier.name,
      config:     selectedSoldier.config,
      skill1Name: selectedSoldier.skill1Name,
      skill2Name: selectedSoldier.skill2Name,
    });
    setCreating(false);
    if (!res.ok) { setCreateError(res.error); return; }
    onCreate(trimmedName);
  };

  const handleJoin = e => {
    e.preventDefault();
    setJoinError(null);
    const name = joinName.trim();
    if (name.length < 2) { setJoinError('Entre un nom de squad valide.'); return; }
    onJoin(name);
  };

  return (
    <div className="gp-page gp-home">
      <div className="gp-bg" /><div className="gp-overlay" />
      {!serverOnline && (
        <div className="srv-offline-badge" title="Mode hors ligne — données locales">
          HORS LIGNE
        </div>
      )}
      <div className="sq-card">
        <div className="sq-card-header">
          <div className="sq-card-title">SQUADRON</div>
          <div className="sq-card-sub">Une squad pour les gouverner tous</div>
        </div>

        <div className="sq-soldier-strip">
          <div className="sq-soldier-grid">
            {soldiers.map(s => (
              <RandomSoldierCard key={s.id} soldier={s} selected={selectedId === s.id} onSelect={setSelectedId} />
            ))}
          </div>
        </div>

        <div className="sq-actions">
          <form className="sq-create sq-col" onSubmit={handleCreate}>
            <div className="sq-section-title">CRÉER MA SQUAD</div>
            <div className="sq-fields">
              <input type="text"     className="sq-input" placeholder="Nom de la squad"          value={squadName} maxLength={24} onChange={e => { setSquadName(e.target.value); setCreateError(null); }} />
              <input type="password" className="sq-input" placeholder="Mot de passe (optionnel)" value={password}  maxLength={128} onChange={e => { setPassword(e.target.value);  setCreateError(null); }} />
            </div>
            <div className="sq-col-spacer" />
            <div className="sq-btn-wrap" data-tooltip={canCreate ? '' : disabledReason}>
              <button type="submit" className={'sq-btn sq-btn-primary' + (canCreate ? '' : ' is-disabled')} disabled={!canCreate}>
                {creating ? '…' : 'CRÉER'}
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
              <input type="text" className="sq-input" placeholder="Nom de la squad" value={joinName} maxLength={24} onChange={e => { setJoinName(e.target.value); setJoinError(null); }} />
            </div>
            <div className="sq-col-spacer" />
            <div className="sq-btn-wrap">
              <button type="submit" className={'sq-btn' + (joinName.trim().length >= 2 ? '' : ' is-disabled')} disabled={joinName.trim().length < 2}>REJOINDRE</button>
            </div>
            {joinError ? <div className="sq-error">{joinError}</div> : null}
          </form>
        </div>
      </div>
    </div>
  );
}

// ── FallingLinesEffect ────────────────────────────────────────────────────────
const FX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%■□▪▫▸▾';

function FallingLinesEffect({ headline, detail, onDone, duration = 2400 }) {
  const canvasRef = useRef(null);
  const doneRef   = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width  = window.innerWidth;
    const H = canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const FS  = 13;
    const cols = Math.floor(W / FS);
    const drops = Array.from({ length: cols }, () => (Math.random() * -30) | 0);

    let raf, last = 0;
    const tick = t => {
      if (t - last < 38) { raf = requestAnimationFrame(tick); return; }
      last = t;
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = `bold ${FS}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * FS;
        if (y <= 0) { drops[i]++; continue; }
        const ch = FX_CHARS[Math.random() * FX_CHARS.length | 0];
        const bright = Math.random() > 0.92;
        ctx.fillStyle = bright
          ? `rgba(160,230,255,${0.7 + Math.random() * 0.3})`
          : `rgba(40,140,220,${0.25 + Math.random() * 0.45})`;
        ctx.fillText(ch, i * FS, y);
        if (y > H && Math.random() > 0.974) drops[i] = (Math.random() * -18) | 0;
        drops[i]++;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (!doneRef.current) { doneRef.current = true; onDone(); } }, duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  return (
    <div className="fx-falling gp-page">
      <canvas ref={canvasRef} className="fx-falling-canvas" />
      <div className="fx-falling-content">
        <div className="fx-falling-badge">◈ SQUADRON ◈</div>
        <div className="fx-falling-headline">{headline}</div>
        <div className="fx-falling-detail">{detail}</div>
        <div className="fx-falling-cursor">▍</div>
      </div>
    </div>
  );
}

// ── BootIntroEffect ──────────────────────────────────────────────────────────
const BOOT_LINES = [
  '> SQUADRON-NET v3.7.1',
  '> Initialisation du module crypto...',
  '> Tunnel sécurisé établi            [OK]',
  '> Localisation du nœud squad...',
  '> Nœud trouvé — latence 4 ms        [OK]',
  '> Protocole AUTH activé             [OK]',
  '> Mode CHALLENGE/RESPONSE',
  '> En attente des identifiants...',
];

function BootIntroEffect({ onDone }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timers = BOOT_LINES.map((_, i) =>
      setTimeout(() => setCount(n => Math.max(n, i + 1)), i * 110)
    );
    const done = setTimeout(onDone, BOOT_LINES.length * 110 + 250);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, [onDone]);

  return (
    <div className="gp-page hk-screen fx-boot">
      <div className="fx-boot-frame">
        <div className="fx-boot-tag">[SQUADRON-SYS]</div>
        {BOOT_LINES.slice(0, count).map((line, i) => (
          <div key={i} className="fx-boot-line" style={{ animationDelay: '0ms' }}>{line}</div>
        ))}
        {count < BOOT_LINES.length && <div className="fx-boot-cursor">▍</div>}
      </div>
    </div>
  );
}

// ── TVOnEffect ───────────────────────────────────────────────────────────────
function TVOnEffect({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1100);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="fx-tv-on" aria-hidden="true" />;
}

// ── HackerTyper ──────────────────────────────────────────────────────────────
function HackerTyper({ text, speed = 38, jitter = 16, onDone }) {
  const [typed, setTyped] = useState('');
  const idxRef  = useRef(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    idxRef.current = 0; doneRef.current = false; setTyped('');
    let cancelled = false, tid = null;
    const tick = () => {
      if (cancelled) return;
      const next = idxRef.current + 1;
      if (next > text.length) {
        if (!doneRef.current) { doneRef.current = true; if (onDoneRef.current) onDoneRef.current(); }
        return;
      }
      idxRef.current = next;
      setTyped(text.slice(0, next));
      tid = setTimeout(tick, Math.max(10, speed + (Math.random() * 2 - 1) * jitter));
    };
    tid = setTimeout(tick, speed);
    return () => { cancelled = true; if (tid) clearTimeout(tid); };
  }, [text, speed, jitter]);

  return (
    <span className="hk-typer">
      <span className="hk-typed">{typed}</span>
      <span className="hk-caret">▍</span>
    </span>
  );
}

// ── LoginPage ────────────────────────────────────────────────────────────────
function LoginPage({ squadName, onSuccess, onBack, onLogin }) {
  const [typingDone, setTypingDone] = useState(false);
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (typingDone && inputRef.current) {
      const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [typingDone]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await onLogin(password);
    setLoading(false);
    if (result.ok) onSuccess();
    else setError(result.error);
  };

  return (
    <div className="gp-page hk-screen">
      <div className="hk-frame">
        <div className="hk-line"><span className="hk-prompt-tag">[SQUADRON-AUTH]</span></div>
        <div className="hk-line hk-prompt">
          <HackerTyper
            text={`> Entrez le mot de passe de la Squad « ${squadName} »...`}
            onDone={() => setTypingDone(true)}
          />
        </div>
        {typingDone && (
          <form className="hk-form" onSubmit={handleSubmit}>
            <div className="hk-input-row">
              <span className="hk-prompt-symbol">$</span>
              <input ref={inputRef} type="password" className="hk-input"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null); }}
                placeholder="••••••••"
                autoComplete="off" spellCheck={false}
                disabled={loading}
              />
              <button type="submit" className="hk-submit" disabled={loading}>
                {loading ? '…' : 'ENTER'}
              </button>
            </div>
            {error ? <div className="hk-error">{error}</div> : null}
            <button type="button" className="hk-back" onClick={onBack} disabled={loading}>← annuler</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── HQPage ───────────────────────────────────────────────────────────────────
function HQPage() {
  return <div className="gp-page hq-blank" />;
}

// ── GameApp ──────────────────────────────────────────────────────────────────
// States:
//   server-check → (online) → home   server-check → (offline) → home
//   home → creating (FallingLines) → hq
//   home → direct-access (FallingLines) → hq
//   home → boot-intro → login → tv-on → hq
function GameApp({ onSwitchMode }) {
  const [page,         setPage]         = useState('server-check');
  const [squad,        setSquad]        = useState(null);
  const [soldiers,     setSoldiers]     = useState(null);
  const [serverOnline, setServerOnline] = useState(false);

  useEffect(() => {
    if (window.Weapons && typeof window.Weapons.setSkinIdx === 'function')
      window.Weapons.setSkinIdx(33);
  }, []);

  // ── Server connection result ─────────────────────────────────────────────
  const handleServerOnline = useCallback(async () => {
    setServerOnline(true);
    try {
      const { ok, data } = await apiFetch('/api/troopers');
      setSoldiers(ok && Array.isArray(data.troopers) ? data.troopers : buildSoldiers(SOLDIER_COUNT));
    } catch (_) {
      setSoldiers(buildSoldiers(SOLDIER_COUNT));
    }
    setPage('home');
  }, []);

  const handleServerOffline = useCallback(() => {
    setServerOnline(false);
    setSoldiers(buildSoldiers(SOLDIER_COUNT));
    setPage('home');
  }, []);

  // ── Server-aware squad operations ────────────────────────────────────────
  const createSquadApi = useCallback(async (squadName, password, founder) => {
    if (!serverOnline) return createSquad(squadName, password, founder);
    const { ok, data } = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ squadName, password, founder }),
    });
    if (!ok) return { ok: false, error: data.error || 'Erreur serveur.' };
    try { sessionStorage.setItem('sq-token', data.token); } catch (_) {}
    return { ok: true };
  }, [serverOnline]);

  const loginSquadApi = useCallback(async (password) => {
    if (!serverOnline) {
      if (!squadExists(squad)) return { ok: false, error: 'ACCESS DENIED — squad introuvable.' };
      if (verifySquadPassword(squad, password)) return { ok: true };
      return { ok: false, error: 'ACCESS DENIED — mot de passe invalide.' };
    }
    const { ok, data } = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ squadName: squad, password }),
    });
    if (!ok) return { ok: false, error: data.error || 'ACCESS DENIED — erreur serveur.' };
    try { sessionStorage.setItem('sq-token', data.token); } catch (_) {}
    return { ok: true };
  }, [serverOnline, squad]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const goHome         = useCallback(() => { setSquad(null); setPage('home'); }, []);
  const goHQ           = useCallback(() => setPage('hq'), []);
  const goTVOn         = useCallback(() => setPage('tv-on'), []);
  const goBootIntro    = useCallback((name) => { setSquad(name); setPage('boot-intro'); }, []);
  const goDirectAccess = useCallback((name) => { setSquad(name); setPage('direct-access'); }, []);
  const goCreating     = useCallback((name) => { setSquad(name); setPage('creating'); }, []);

  const handleJoin = useCallback(async (name) => {
    if (!serverOnline) {
      if (squadExists(name) && !squadHasPassword(name)) goDirectAccess(name);
      else goBootIntro(name);
      return;
    }
    try {
      const { ok, data } = await apiFetch(`/api/squad/${encodeURIComponent(name)}`);
      if (ok && data.exists && !data.hasPassword) goDirectAccess(name);
      else goBootIntro(name);
    } catch (_) {
      goBootIntro(name);
    }
  }, [serverOnline, goDirectAccess, goBootIntro]);

  // ── Render ───────────────────────────────────────────────────────────────
  let content = null;

  if (page === 'server-check') {
    content = <ServerCheckPage onOnline={handleServerOnline} onOffline={handleServerOffline} />;

  } else if (page === 'home') {
    content = (
      <HomePage
        soldiers={soldiers || []}
        onCreate={goCreating}
        onJoin={handleJoin}
        onCreateSquad={createSquadApi}
        serverOnline={serverOnline}
      />
    );

  } else if (page === 'creating') {
    content = (
      <FallingLinesEffect
        headline="CRÉATION DU QG"
        detail={squad || 'ESCADRON'}
        onDone={goHQ}
        duration={2400}
      />
    );

  } else if (page === 'direct-access') {
    content = (
      <FallingLinesEffect
        headline="ACCÈS AU QG"
        detail={squad || 'ESCADRON'}
        onDone={goHQ}
        duration={2200}
      />
    );

  } else if (page === 'boot-intro') {
    content = <BootIntroEffect onDone={() => setPage('login')} />;

  } else if (page === 'login') {
    content = (
      <LoginPage
        squadName={squad}
        onSuccess={goTVOn}
        onBack={goHome}
        onLogin={loginSquadApi}
      />
    );

  } else if (page === 'tv-on') {
    content = <TVOnEffect onDone={goHQ} />;

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
