# Squadron — Documentation Agent

Lire ce fichier en premier. Il évite de relire tout le code en donnant la carte complète du projet.
Pour les détails, suivre les liens vers les sous-docs.

---

## Architecture

```
client/  — App web statique (React CDN + Babel client-side, pas de bundler)
server/  — Node.js / Express (auth JWT, squads, troopers déterministes)
docs/    — Sous-docs agents (client, server, combat)
```

Démarrage :
- **Client** : `cd client && python -m http.server 8080` → http://localhost:8080/Squadron.html
- **Serveur** : `cd server && npm start` → port 3001

---

## Globals window (ordre de chargement)

Tous les scripts sont chargés dans `Squadron.html` dans cet ordre **exact** :

| Ordre | Fichier | Expose |
|---|---|---|
| 1 | `palette.js` | `Palette` |
| 2 | `sprite-engine.js` | `Engine` |
| 3 | `parts.js` | `Parts` |
| 4 | `weapons.js` | `Weapon` |
| 5 | `animations.js` | `Anims` |
| 6 | `renderer.js` | `Renderer` |
| 7 | `app.jsx` | `SquadronUI` (App, SpriteCanvas, AnimPreview, WeaponGameIcon, WeaponIcon, DEFAULT_CFG, STAGE_W, STAGE_H, normalizeCharacterConfig, hairStyleOptionsForBody) |
| 8 | `combat-sim.js` | `CombatSim` (loadWeaponStats, getWeaponStats, createBattle, DT, TILE_PX, ARENA_TILES, SPEED_TILES_PER_SEC, LANE_OFFSETS) |
| 9 | `game.jsx` | composants React jeu (pas de global direct) |
| 10 | `combat-view.jsx` | `HQBattleScreen` |
| 11 | `hq.jsx` | composants React HQ (pas de global direct) |
| 12 | `root.jsx` | monte le rendu React racine |

---

## API serveur (résumé)

```
GET  /api/health                 → {status:'ok', version:'1.0.0'}
GET  /api/troopers               → {troopers:[8 soldats], date}
GET  /api/squad/:name            → {exists, hasPassword}
GET  /api/squad/opponents/list   → {squads:[armées joueurs]} (fondateur seul tant que le HQ complet n'est pas sync serveur)
POST /api/auth/register          body:{squadName,password,founder}  → {token,squadName}
POST /api/auth/login             body:{squadName,password}           → {token,squadName}
```

Auth : `Authorization: Bearer <jwt>` · JWT exp=7j · Rate-limit auth 15req/15min · Global 120req/min

---

## Flux app (game.jsx)

```
server-check (10s timeout)
  ↓ online                    ↓ offline
  home                        home [badge HORS LIGNE]
    ├─ créer squad → FallingLines → hq
    ├─ rejoindre (sans mdp) → FallingLines → hq
    └─ rejoindre (avec mdp) → BootIntro → Login → TVOn → hq

hq (tabs: play / squad / market / settings)
  └─ play → opponents → battle (HQBattleScreen)
```

Online : API calls. Offline : localStorage (`squadron-squads`). JWT en `sessionStorage` (`sq-token`).

---

## Invariants de synchronisation

Ces correspondances **doivent rester cohérentes** entre plusieurs fichiers :

| Ce qui doit rester en sync | Fichiers concernés |
|---|---|
| Indices de hairstyles par bodyType | `client/app.jsx` (HAIRSTYLES_BY_BODY) ↔ `server/utils/generateTroopers.js` (HAIR_STYLES) |
| Ordre et indices des armes (0–60) | `client/weapon-config.json` ↔ `client/weapons.js` ↔ `server/utils/generateTroopers.js` (WEAPON_NAMES) |
| Tailles palette (SKIN, HAIR, EYE, UNIFORM) | `client/palette.js` ↔ `server/utils/generateTroopers.js` |
| SKILL1_NAMES / SKILL1_INDICES | `client/game.jsx` ↔ `server/utils/generateTroopers.js` |
| Animations référencées par le sim | `client/animations.js` (Anims) ↔ `client/combat-sim.js` (clés 'aim','shoot','unaim','hurt','run','idle','dead') |
| Calcul du power squad | `client/hq.jsx` ↔ `server/routes/squads.js` (1 soldat niv.1 = 5 power, +1 par niveau soldat) |

---

## Économie de tokens

Lire ce fichier, puis **uniquement** les fichiers touchés par la tâche :

| Tâche | Fichiers à lire |
|---|---|
| UI / couleurs | `app.jsx`, `palette.js`, `renderer.js` |
| Animations / poses / recoil | `animations.js`, `renderer.js` |
| Armes (visuel) | `weapons.js` |
| Armes (gameplay / stats) | `weapon-config.json` |
| Dessin pixel-art des membres | `parts.js` (gros fichier — grep d'abord) |
| Logique de combat | `combat-sim.js` + `docs/agents-combat.md` |
| Rendu de combat | `combat-view.jsx` + `docs/agents-combat.md` |
| Logique serveur | `server/routes/` + `server/utils/` + `docs/agents-server.md` |
| Connexion client↔serveur | début de `game.jsx` (apiFetch, handleServerOnline/Offline) |
| Génération troopers | `server/utils/generateTroopers.js` + `server/utils/seed.js` |

Utiliser Grep/`rg` pour localiser les symboles avant d'ouvrir de gros fichiers.

---

## Sous-documentations

- **[docs/agents-client.md](docs/agents-client.md)** — Tous les fichiers client, constantes, format config soldat, hairstyles, armes
- **[docs/agents-server.md](docs/agents-server.md)** — Fichiers serveur, DB schema, sécurité, troopers déterministes
- **[docs/agents-combat.md](docs/agents-combat.md)** — Système de combat : sim API, phases, événements, rendu

---

## Mettre à jour cette documentation quand

- Un nouveau fichier devient central ou expose un global `window.*`
- L'ordre de chargement des scripts change
- Un endpoint API est ajouté, modifié ou supprimé
- Un invariant de synchronisation est créé ou change
- Une convention importante change (config soldat, rendu, DB schema)
- Une décision significative évite de relire beaucoup de code plus tard
