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
| `weapons.js` | Manifeste visuel armes (bboxes sprite sheet, grip, muzzle) + variantes mk générées | `Weapons` |
| `animations.js` | Animations par clé (idle, walk, run, shoot, aim, reload, hurt, dead, …) | `Anims` |
| `renderer.js` | Compose le soldat complet depuis `cfg` → frames canvas | `Renderer` |
| `app.jsx` | UI éditeur de personnage (mode dev) + composants partagés | `SquadronUI` |
| `combat-sim.js` | Simulateur de combat pur JS (turn-based, déterministe) | `CombatSim` |
| `game.jsx` | UI jeu / squads (mode prod) — gère home, login, SERVER_URL | — |
| `combat-view.jsx` | Composant React battle : drive le sim + rendu arena | `HQBattleScreen` |
| `hq.jsx` | Shell HQ après connexion : navigation, pages, sous-pages | — |
| `root.jsx` | Switcher dev/prod, monte le rendu React | — |
| `weapon-config.json` | Stats gameplay armes (damage, accuracy, range, burst…) + bonus mk — source de vérité | — |
| `assets/weapons/0–33.png` | 34 sprite sheets armes (une par skin uniforme) | — |
| `styles.css` | Tous les styles, variables CSS dans `:root` | — |

---

## Constantes clés dans game.jsx (lignes 9–11)

```js
const SOLDIER_COUNT = 10;
const SKILL1_NAMES  = ['Beretta 93', 'M3 Grease Goon', 'Mossburg 500', 'AKS-74V', 'Steir Scout'];
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
  weaponIdx:     0–61 base, 62+ mk générées, // index dans Weapons.list
  weaponSkinIdx: 0–33,      // quel sprite sheet arme utiliser
}
```

`DEFAULT_CFG` est exporté dans `window.SquadronUI`.  
`normalizeCharacterConfig(cfg)` corrige/comble les champs manquants.

---

## HQ matchmaking / power

Dans `hq.jsx`, le power d'une squad vaut `sum(4 + soldier.level)` : un soldat niveau 1 donne 5 power, puis chaque niveau de soldat ajoute 1 power.

La sélection Armée vs Armée est persistée par squad dans `localStorage` (`squadron-matchmaking-<squad>`), datée au jour courant et verrouillée jusqu'à un combat ou au reset de minuit. Elle fonctionne par paliers de power : au plus une vraie squad par palier, puis des bots complètent les paliers vides. Offline, les HQ locaux sont utilisés puis complétés par bots locaux. Online, `/api/squad/opponents/list?exclude=<name>&power=<n>&cycle=<n>&excludeBots=<ids>` renvoie joueurs + bots serveur. Après un combat, le pack passe `canRefresh:true`, son `cycle` augmente, et les `botId`/noms récemment combattus sont gardés dans `recentBots` pour ne pas reproposer immédiatement le même bot.

---

## Soldat HQ — champs persistés (`squadron-hq-<squad>`)

```js
{
  id, name, config, level, xp,
  unlockedWeapons:  [string],   // noms d'armes
  preferredWeapon:  string|null,
  renameCount:      0+,         // nombre de renommages effectués
  lastRenameAt:     ms,         // Date.now() au dernier renommage
  pendingUpgrade:   null|{ skill1Name, skill2Name }, // offre en attente (option future)
}
```

- Coût d'amélioration (cost to level → level+1) : `UPGRADE_COSTS = [4, 8, 16, 32, 48, 64, 96, 128]` puis ×1.5 arrondi à 8.
- Coût de recrutement (Nème soldat) : `RECRUIT_COSTS = [15, 35, 80, 150, 220, 325, 450, 600, 790]` puis ×1.3 arrondi à 10.
- Cooldown renommage : 0 pour le 1er, puis `6 mois × 2^(renameCount-1)` (≈6 mois → 1 an → 2 ans → 4 ans …).
- L'offre d'amélioration (2 skills proposés) est dérivée d'un seed déterministe `hash(squadName + soldierId + (level+1))` → reproductible à l'identique tant que le soldat n'a pas changé de niveau, ce qui implémente la persistance "tu retrouves le même choix si tu quittes l'écran".
- "Main nue" (`Weapons.list[61]`, type `melee`) reste catalogué côté gameplay mais n'apparaît pas dans la grille de skills de la fiche soldat (filtré via `HIDDEN_WEAPON_NAMES`).
- Les variantes `mk1`/`mk2` sont append-only après l'index 61 et ne sont proposées en upgrade que si la progression base -> mk1 -> mk2 est respectée.

---

## Hairstyles par bodyType

Les indices de `hairStyleIdx` sont globaux (0–15). Chaque bodyType n'utilise qu'un sous-ensemble :

| bodyType | Indices autorisés | Styles |
|---|---|---|
| `male` | 0,1,2,3,4,13,14,15 | Textured Crop, Low Fade, Side Part, Quiff, Curly Top, Buzz Cut, Crew Cut, Bald |
| `female` | 5,6,7,8,9,10,11,12 | Short, Messy, Long, Ponytail, Bob, Wavy, Flowing, High Ponytail |

Défini dans `app.jsx` (`HAIRSTYLES_BY_BODY`) et répliqué dans `server/utils/generateTroopers.js` (`HAIR_STYLES`).

---

## Armes (indices 0–61 + mk append-only)

```
smg×11      : 0–10   (M3 Grease Goon, TEK-9, MAK-11, Skorpian, HX MP7, PN P90, PN F2001, Ozi, Kolt SCAMP, TPX, MPX9)
rifle×10    : 11–20  (AK-48, AKS-74V, AK-74N, M4A2, Mk18S, HX G3, PN FAL, M204, FAMAZ, FAMAZ-C)
heavy×14    : 21–34  (Infernal Toob, Lazor, Karl Gustov, XM26, RPG-8, Recoillite, Stingar, AT5, M202 FLARE, M80, M61, M248, M135, M33)
shotgun×8   : 35–42  (SPAX-12, Stooger, Ithaka, Mossburg, Dbl-Barrel, Blunderbus, Flintlok, O/U)
sniper×10   : 43–52  (AWQ, AWN, SVD, HX PSG1, M200, M82A2, HS50, Hekate, Scout, CMR)
pistol×8    : 53–60  (Makarovv, Ruger Silenst, Sovyet PB, Standart HDM, Beretta 93, Revolvair, M1912, Makarovv Mk.II)
melee×1     : 61     (Main nue — catalogue seulement pour l'instant)
mk générées : 62+    (`<arme> mk1`, `<arme> mk2`, append-only après Main nue)
```

Stats gameplay dans `weapon-config.json` ; rendu visuel dans `weapons.js`. Depuis `schemaVersion: 3`, les dégâts utilisent `damageMin`/`damageMax` par balle, `damage` reste une moyenne/fallback d'affichage, et `mkUpgradeBonuses` génère les stats mk côté client via `Weapons.expandWeaponStats`.
Les noms publics sont volontairement legerement fictifs ; `aliases` dans `weapon-config.json` garde les anciens noms pour les sauvegardes et les squads deja crees.
IDs texte : `SMG-01`, `RIFLE-01`, etc. — doivent correspondre entre les deux fichiers.
IDs mk : `<BASE-ID>-MK1` et `<BASE-ID>-MK2`; `server/utils/generateTroopers.js` garde uniquement les noms de base dans `WEAPON_NAMES`.

---

### Variantes mk

Les indices 0-61 restent stables pour les armes de base; `Weapons.list[61]` reste `Main nue`. Les variantes mk sont generees par `weapons.js` et ajoutees apres l'index 61 avec les IDs `<BASE-ID>-MK1` et `<BASE-ID>-MK2`.

`weapon-config.json` est en `schemaVersion: 3` : `mkUpgradeBonuses` genere les stats mk cote client via `Weapons.expandWeaponStats`, sans ajouter ces variantes a `server/utils/generateTroopers.js` (`WEAPON_NAMES` reste base-only).

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
