# Squadron — Client (détails agent)

→ Lire d'abord [AGENTS.md](../AGENTS.md).

---

## Fichiers client

| Fichier | Rôle | Global exposé |
|---|---|---|
| `Squadron.html` | Point d'entrée, ordre de chargement | — |
| `palette.js` | Palettes couleurs | `Palette` |
| `sprite-engine.js` | Helpers canvas bas niveau (px, rect, stamp, outlineRegion) | `Engine` |
| `parts.js` | Dessin pixel-art de chaque membre du soldat | `Parts` |
| `weapons.js` | Manifeste visuel armes (bboxes sprite sheet, grip, muzzle) | `Weapon` |
| `animations.js` | 8 animations définies par clé (idle, walk, run, shoot, aim, hurt, dead, …) | `Anims` |
| `renderer.js` | Compose le soldat complet depuis `cfg` → frames canvas | `Renderer` |
| `app.jsx` | UI éditeur de personnage (mode dev) + composants partagés | `SquadronUI` |
| `combat-sim.js` | Simulateur de combat pur JS (turn-based, déterministe) | `CombatSim` |
| `game.jsx` | UI jeu / squads (mode prod) — gère home, login, SERVER_URL | — |
| `combat-view.jsx` | Composant React battle : drive le sim + rendu arena | `HQBattleScreen` |
| `hq.jsx` | Shell HQ après connexion : navigation, pages, sous-pages | — |
| `root.jsx` | Switcher dev/prod, monte le rendu React | — |
| `weapon-config.json` | Stats gameplay armes (damage, accuracy, range, burst…) — source de vérité | — |
| `assets/weapons/0–33.png` | 34 sprite sheets armes (une par skin uniforme) | — |
| `styles.css` | Tous les styles, variables CSS dans `:root` | — |

---

## Constantes clés dans game.jsx (lignes 9–11)

```js
const SOLDIER_COUNT = 10;
const SKILL1_NAMES  = ['Glok 17', 'Ozi', 'Mossburg 500', 'AKS-74V', 'Steir Scout'];
const SERVER_URL    = 'http://127.0.0.1:3001';  // changer si serveur public
```

---

## Format config soldat (`cfg`)

Tous les composants (renderer, SpriteCanvas, combat-sim, DB) échangent ce même objet :

```js
{
  bodyType:      'male' | 'female',
  skinIdx:       0–7,
  hairIdx:       0–6,       // teinte cheveux (couleur dans palette.js)
  hairStyleIdx:  0–15,      // forme hairstyle (voir section hairstyles)
  eyeIdx:        0–8,
  uniformIdx:    0–9,
  vestOn:        bool,
  backpackOn:    bool,
  hatIdx:        0–7,
  weaponIdx:     0–60,      // index dans weapon-config.json / weapons.js
  weaponSkinIdx: 0–33,      // quel sprite sheet arme utiliser
}
```

`DEFAULT_CFG` est exporté dans `window.SquadronUI`.  
`normalizeCharacterConfig(cfg)` corrige/comble les champs manquants.

---

## HQ matchmaking / power

Dans `hq.jsx`, le power d'une squad vaut `sum(4 + soldier.level)` : un soldat niveau 1 donne 5 power, puis chaque niveau de soldat ajoute 1 power.

La sélection Armée vs Armée est persistée par squad dans `localStorage` (`squadron-matchmaking-<squad>`), datée au jour courant et verrouillée jusqu'à un combat ou au reset de minuit. Elle privilégie les armées joueurs : HQ locaux en offline, `/api/squad/opponents/list` en online. Les bots complètent ensuite les paliers de power.

---

## Hairstyles par bodyType

Les indices de `hairStyleIdx` sont globaux (0–15). Chaque bodyType n'utilise qu'un sous-ensemble :

| bodyType | Indices autorisés | Styles |
|---|---|---|
| `male` | 0,1,2,3,4,13,14,15 | Textured Crop, Low Fade, Side Part, Quiff, Curly Top, Buzz Cut, Crew Cut, Bald |
| `female` | 5,6,7,8,9,10,11,12 | Short, Messy, Long, Ponytail, Bob, Wavy, Flowing, High Ponytail |

Défini dans `app.jsx` (`HAIRSTYLES_BY_BODY`) et répliqué dans `server/utils/generateTroopers.js` (`HAIR_STYLES`).

---

## Armes (indices 0–60)

```
smg×11      : 0–10   (Ozi, MAK-10, TEK-9, Skorpian, HX MP7, PN P90, PN P90 Tac, MP5Q, MPX9, Thompsen, KRYSS)
rifle×10    : 11–20  (AK-48, AKS-74V, AK-74N, M4A2, Mk18S, HX G3, PN FAL, PN FAL Tac, FAMAZ, FAMAZ-C)
heavy×14    : 21–34  (M202 FLARE, Lazor, Karl Gustov, XM26, RPG-8, Recoillite, Stingar, AT5, Twin, M80, M61, M248, M135, M33)
shotgun×8   : 35–42  (SPAX-12, Dbl-Barrel, 870, 500, M4, Blunderbus, Sawed-Off, O/U)
sniper×10   : 43–52  (Accurazy, AWN, SVD, HX PSG1, M200, M82A2, HS50, Hekate, Scout, CMR)
pistol×8    : 53–60  (Walthar, Kolt, Modal 29, Redhauk, Glok17, Dezert, M1912, Makarovv)
```

Stats gameplay dans `weapon-config.json` ; rendu visuel dans `weapons.js`. Depuis `schemaVersion: 2`, les dégâts utilisent `damageMin`/`damageMax` par balle, et `damage` reste une moyenne/fallback d'affichage.
Les noms publics sont volontairement legerement fictifs ; `aliases` dans `weapon-config.json` garde les anciens noms pour les sauvegardes et les squads deja crees.
IDs texte : `SMG-01`, `RIFLE-01`, etc. — doivent correspondre entre les deux fichiers.

---

## Conventions de rendu

- Couleur uniforme : `cfg.uniformIdx` → haut, pantalon, backpack, casque
- Veste pare-balles : toujours noire (`Palette.vest[0]`), pas de choix couleur
- Sprite built facing RIGHT ; `Engine.stamp` ou transform canvas pour face LEFT
- `STAGE_W = 256`, `STAGE_H = 112` (taille du canvas de rendu d'un soldat)

---

## Combinaisons couleur interdites

Dans le générateur de troopers, deux associations sont exclues :
- `uniformIdx === 8` (orange) + `hairIdx === 4` (roux) → retiré
- `uniformIdx === 7` (jaune) + `hairIdx === 5` (blond) → retiré
