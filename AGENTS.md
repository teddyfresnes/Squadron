# Squadron — Agent Notes

Lire ce fichier en premier. Il économise des tokens en évitant de relire tout le code.

---

## Architecture

```
client/  — App web statique (React CDN + Babel client-side)
server/  — Node.js/Express (auth, squads, troopers)
```

Démarrage :
- **Client** : `cd client && python -m http.server 8080` → http://localhost:8080/Sprite%20Forge.html
- **Serveur** : `cd server && npm start` → port 3001

---

## Fichiers client (client/)

| Fichier | Rôle |
|---|---|
| `Sprite Forge.html` | Point d'entrée, ordre de chargement des scripts |
| `app.jsx` | UI éditeur de personnage (mode dev) |
| `game.jsx` | UI jeu / squads (mode prod) — contient aussi `SERVER_URL`, `buildSoldiers()` et délègue le HQ à `hq.jsx` |
| `hq.jsx` | Shell HQ après connexion : navigation, sidebar soldats, pages Jouer / Ma squad / Recrutement / Paramètres |
| `root.jsx` | Switcher dev / prod |
| `palette.js` | Palettes couleurs (skin×8, hair×7, eye×9, uniform×10, hat×8, hairstyles×16) |
| `parts.js` | Dessin pixel-art des membres du soldat |
| `renderer.js` | Composition finale soldat (config → canvas frames) |
| `animations.js` | 8 animations, frames par frame (idle, walk, run, shoot…) |
| `weapons.js` | Manifeste visuel armes (bboxes sprite sheet, grip, muzzle) |
| `weapon-config.json` | Stats gameplay (damage, accuracy, range…) — source de vérité gameplay |
| `assets/weapons/0–33.png` | 34 sprite sheets armes (une par skin) |
| `styles.css` | Tous les styles, variables CSS dans `:root` |

### Constantes clés dans game.jsx
- `SERVER_URL = 'http://127.0.0.1:3001'` — à changer si serveur public
- `SOLDIER_COUNT = 8`
- `SKILL1_NAMES` — pool de compétences primaires (5 armes)
- `buildSoldiers()` — génération locale (mode hors ligne uniquement)

### Ordre de chargement des scripts (Sprite Forge.html)
`palette.js` → `sprite-engine.js` → `parts.js` → `weapons.js` → `animations.js` → `renderer.js` → `app.jsx` → `game.jsx` → `hq.jsx` → `root.jsx`

### Hairstyles par bodyType (app.jsx HAIRSTYLES_BY_BODY, indices dans palette.js)
- `male`   : indices `[0,1,2,3,4,13,14,15]` (Textured Crop, Low Fade, Side Part, Quiff, Curly Top, Buzz Cut, Crew Cut, Bald)
- `female` : indices `[5,6,7,8,9,10,11,12]` (Short, Messy, Long, Ponytail, Bob, Wavy, Flowing, High Ponytail)

### Liste armes (weapon-config.json → weapons.js, indices 0–60)
`smg×11` (0–10) · `rifle×10` (11–20) · `heavy×14` (21–34) · `shotgun×8` (35–42) · `sniper×10` (43–52) · `pistol×8` (53–60)

---

## Fichiers serveur (server/)

| Fichier | Rôle |
|---|---|
| `server.js` | Express app, Helmet, CORS, rate-limit, mount routes |
| `config.js` | Port (3001), JWT secret (persisté dans `.jwt_secret`), DB_PATH |
| `db.js` | Store JSON pur JS — pas de module natif. Fichier : `squadron.json` |
| `middleware/auth.js` | Vérifie `Authorization: Bearer <jwt>` |
| `routes/auth.js` | `POST /api/auth/register` · `POST /api/auth/login` |
| `routes/squads.js` | `GET /api/squad/:name` → `{exists, hasPassword}` |
| `routes/troopers.js` | `GET /api/troopers` → 8 troopers déterministes |
| `utils/password.js` | `isSecurePassword()` — ≥8 cars + chiffre + majuscule |
| `utils/seed.js` | `createSeed(date, ip)` + PRNG Mulberry32 |
| `utils/generateTroopers.js` | Génère 8 troopers à partir du seed IP+date |

### API endpoints
```
GET  /api/health                 → {status:'ok'}
GET  /api/troopers               → {troopers:[8 soldats], date}
GET  /api/squad/:name            → {exists, hasPassword}
POST /api/auth/register          body: {squadName, password, founder}  → {token, squadName}
POST /api/auth/login             body: {squadName, password}           → {token, squadName}
```

### Sécurité serveur
- bcryptjs rounds=12, JWT exp=7j, issuer='squadron'
- Rate-limit auth : 15 req / 15 min par IP
- Rate-limit global : 120 req / min par IP
- CORS : localhost:* et 127.0.0.1:* uniquement (adapter si serveur public)
- Marquage silencieux `is_secure=0` si mdp vide / <8 cars / sans chiffre / sans majuscule

### Troopers déterministes
Seed = `MurmurHash3(YYYY-MM-DD | IP normalisée)` → PRNG Mulberry32.
Même jour + même IP = mêmes 8 soldats. Fichier : `server/utils/generateTroopers.js`.
Les indices de hairstyles et l'ordre des armes **doivent rester synchronisés** avec `client/palette.js` et `client/weapon-config.json`.

### Schéma DB (squadron.json)
```json
{ "squads": [ { "id", "name", "passwordHash", "founderName", "founderConfig",
                "founderSkill1", "founderSkill2", "isSecure", "createdAt" } ],
  "nextId": 1 }
```

---

## Flux app (game.jsx)

```
server-check → (online)  → home
             → (offline) → home  [badge HORS LIGNE]
home → créer squad → FallingLines → hq
home → rejoindre (sans mdp) → FallingLines → hq
home → rejoindre (avec mdp) → BootIntro → Login → TVOn → hq
```

Quand online : create/login/check passent par l'API.  
Quand offline : create/login/check passent par localStorage (clé `squadron-squads`).  
JWT stocké en `sessionStorage` (clé `sq-token`).

---

## Conventions

- Couleur uniforme : `cfg.uniformIdx` → haut, pantalon, backpack, casque
- Veste pare-balles : toujours noire (`Palette.vest[0]`), pas de choix couleur
- Stats armes dans `weapon-config.json` ; rendu visuel dans `weapons.js`
- IDs armes : `SMG-01`, `RIFLE-01`, etc. — doivent correspondre entre les deux fichiers
- Icônes jeu : classe `.game-icon` ; armes = rouge/noir via `WeaponGameIcon` dans `app.jsx`

---

## Économie de tokens

- Lire ce fichier en premier, puis seulement les fichiers touchés par la demande
- Pour UI/couleurs → `app.jsx`, `palette.js`, `renderer.js`
- Pour animations/poses/recoil → `animations.js`, `renderer.js`
- Pour armes → `weapons.js` (rendu) + `weapon-config.json` (gameplay)
- Pour dessin pixel-art des membres → `parts.js` (gros fichier, lire seulement si nécessaire)
- Pour la logique serveur → `server/routes/` + `server/utils/`
- Pour la connexion client↔serveur → début de `game.jsx` (fonctions `apiFetch`, `handleServerOnline/Offline`)
- Utiliser `rg` / Grep pour localiser les symboles avant d'ouvrir de gros fichiers

---

## Mettre à jour ce fichier quand

- Un nouveau fichier devient central
- Une convention de config ou de rendu change
- Un endpoint API est ajouté ou modifié
- Une décision importante évite de relire beaucoup de code plus tard
