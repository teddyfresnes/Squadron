# Squadron — Système de combat (détails agent)

→ Lire d'abord [AGENTS.md](../AGENTS.md).

---

## Vue d'ensemble

Le combat est **semi-simultané et déterministe**. L'ordre des actions reste géré par un `cooldown` par soldat, mais le scheduler peut parfois lancer une deuxième action pendant qu'une première est encore en cours (maximum 2 actions actives). Les autres soldats restent en idle, ou finissent leur anim hurt/dead.

**Deux fichiers** :
- `combat-sim.js` — simulateur pur JS (pas de DOM), exposed via `window.CombatSim`
- `combat-view.jsx` — React component, drive le sim via `requestAnimationFrame`, rendu de l'arène

---

## CombatSim API

```js
// Charger les stats armes (fetch weapon-config.json) — à appeler avant createBattle
await window.CombatSim.loadWeaponStats();

// Créer une bataille
const battle = window.CombatSim.createBattle({
  teamA: { soldiers: [...] },  // chaque soldier : {id, name, config, skill1Name, level?}
  teamB: { soldiers: [...] },
  seed: 'string déterministe'  // même seed = même combat bit-for-bit
});

// Avancer d'un pas (DT = 1/60 s)
battle.step(DT);

// Lecture état
battle.all          // [{id, name, team, cfg, level, weaponName, skill1Name, skill2Name, hp, hpMax, bodyHits, x, facing, state, stateT, lane, laneOffsetPx, …}]
battle.events       // [{t, type:'turn'|'shoot'|'hit'|'die'|'end', …}]
battle.done         // bool
battle.winner       // 'A' | 'B' | 'draw' | null
battle.phase        // 'entry' | 'combat'
battle.time         // worldT en secondes
battle.endHoldT     // temps écoulé depuis la fin (pour délai avant overlay résultat)
battle.currentAction // première action active, compat ancienne API
battle.activeActions // actions actives [{actorId, type, startT, duration, …}], max 2
battle.aliveCount('A')  // soldats vivants de l'équipe A
```

---

## Phases de bataille

```
'entry'  → tous les soldats courent simultanément depuis hors-écran vers leurs positions spawn
           (ENTRY_DIST = 4 tuiles). Pas de combat pendant cette phase.
           Quand tous sont arrivés → switch vers 'combat'.

'combat' → semi-simultané. Le premier acteur prêt démarre selon pickNextActor()
           (cooldown minimal). Pendant son action, une deuxième action peut démarrer
           selon OVERLAP_CHANCE, avec une chance plus forte pendant une visée.
           Tie-break : initiative (V1 = 0 partout), puis orderIdx (interleaved A/B à l'init).
```

---

## Types d'actions d'un tour

| Type | Condition | Durée |
|---|---|---|
| `move` | Cible trop loin (> rangeMax) ou trop proche (< rangeMin) | dist / SPEED_TILES_PER_SEC |
| `shoot` | Dans la portée | aimDur + rafale visuelle + recovery + unaim |
| `idle` | Pas de cible vivante | 0.4 s |

Après chaque action : `cooldown += duration + TURN_GAP (0.04s)`.

---

## Tunables (combat-sim.js)

```js
DT = 1/60                  // pas de simulation
SPEED_TILES_PER_SEC = 6    // vitesse de déplacement
TILE_PX = 24               // taille référence d'une tuile en px
ARENA_TILES = 50           // largeur de l'arène en tuiles
ENTRY_DIST = 4             // distance d'entrée depuis hors-écran
SPAWN_EDGE_GUTTER = 0.1    // spawn le plus proche du bord logique
SPAWN_SPACING_TILES = 0.9  // écart horizontal entre slots de spawn
SOLO_SPAWN_FROM_EDGE = 2.2 // position d'un soldat seul dans sa zone de côté
MOVE_STEP_TILES = 4        // distance max d'un tour de déplacement
TURN_GAP = 0.04            // pause entre tours
MAX_ACTIVE_ACTIONS = 2     // nombre max d'actions simultanées
OVERLAP_CHANCE = 0.18      // chance de lancer une action pendant une autre
AIM_OVERLAP_CHANCE = 0.34  // chance pendant qu'un soldat vise
OVERLAP_RETRY_DELAY = 0.28 // délai avant de retenter un chevauchement refusé
LANE_OFFSETS = { front:0, mid:-80, back:-180 }  // décalage Y par lane (en px)
LANE_Y_SPREAD = [0, 12, -12, 22, -22, 6, -6]
SPAWN_Y_MIN/MAX = -202/22  // limites verticales conservées depuis les anciennes lanes
SPAWN_Y_CENTER = -90       // soldat seul centré verticalement dans l'herbe
FORMATION_FULL_SIZE = 8    // une équipe de 8 utilise toute l'enveloppe verticale
FORMATION_Y_JITTER = 7     // petite variation Y pseudo-aléatoire, clampée aux limites
ENTRY_DELAY_MAX = 0.72     // retard d'entrée maximal dans une vague d'équipe
ENTRY_DELAY_STEP = 0.08    // décalage de base entre soldats d'une même équipe
ENTRY_DELAY_RANDOM = 0.18  // micro-retard aléatoire additionnel
ENTRY_CLOSE_LINE_PX = 34   // seuil de ligne presque identique
```

La formation verticale est assignée par équipe après la création des combattants : un soldat seul est placé à `SPAWN_Y_CENTER`; les escouades plus grandes remplissent progressivement l'enveloppe `SPAWN_Y_MIN..SPAWN_Y_MAX`, sans dépasser ces anciennes limites. Les rôles d'arme gardent leur ordre visuel (`back`, `mid`, `front`), puis un léger jitter déterministe évite une grille trop rigide.

---

## Lanes par catégorie d'arme

```
sniper             → 'back'  (lane Y la plus haute à l'écran)
rifle, pistol      → 'mid'
smg, heavy, shotgun → 'front'
```

---

## Types d'événements (battle.events)

```js
{ t, type: 'turn',  actorId, action: 'move'|'shoot'|'idle' }
{ t, type: 'shoot', actorId, targetId, ax, ay, tx, ty, hit: bool, visualOnly?: bool, shotIndex?: number, shotCount?: number, weaponCategory?: string, weaponType?: string, bodyPart?: 'head'|'chestLeft'|'chestRight'|'abdomen'|'leftArm'|'rightArm'|'leftLeg'|'rightLeg', damage }
{ t, type: 'hit',   targetId, hp, bodyPart, damage, bodyHits }
{ t, type: 'die',   targetId, bodyPart, damage }
{ t, type: 'end',   winner: 'A'|'B'|'draw' }
```

---

## États d'animation d'un soldat (champ `state`)

| State | Quand |
|---|---|
| `'idle'` | En attente de son tour |
| `'run'` | Tour de déplacement ou phase d'entrée |
| `'aim'` | Début d'un tir (si pas encore aimed) |
| `'shoot'` | Tir en cours |
| `'unaim'` | Baisse l'arme après la fin d'une action de tir |
| `'hurt'` | Vient d'être touché (dure `Anims.hurt.frames/fps`, puis → idle) |
| `'dead'` | HP ≤ 0, animation finale |

`stateT` = temps écoulé dans l'état courant (en secondes), passé à `frameForState()` dans combat-view.

Les armes automatiques avec `burst:1` produisent une rafale réelle courte en combat. Pour préserver l'équilibrage, le simulateur garde le budget de dégâts de l'arme et le répartit entre les balles de la rafale qui touchent. Les armes qui ont `burst > 1` dans `weapon-config.json` gardent leurs tirs réels multiples avec les dégâts par balle de la config.

---

## Composant React HQBattleScreen (combat-view.jsx)

```jsx
<HQBattleScreen
  mySquad={{ name, soldiers: [...] }}
  oppSquad={{ name, soldiers: [...] }}
  onDone={() => {}}
/>
```

- Crée la bataille au mount (après `loadWeaponStats()`)
- Loop `requestAnimationFrame` : accumulator fixe-step (`DT`), max 6 pas par frame
- `ArenaSoldier` : `<button>` positionné absolument avec `<SpriteCanvas>` + ombre au sol ; la barre de vie au-dessus du soldat n'apparait que brièvement après un hit
- `SoldierInspectMenu` : panneau contextuel (nom, niveau, corps touché, vie verticale, munitions, inventaire armes en vignettes 2D avec tooltip)
- `TrailsLayer` : SVG overlay, trails disparaissent en 220 ms
- `ResultOverlay` : affiché quand `battle.done && battle.endHoldT >= 1.2`

---

## HP des soldats

```js
hpMax = 10 + 2 * (level - 1)   // level par défaut = 1 → hpMax = 10
```

Le niveau est lu depuis `soldier.level` si présent, sinon `1`.

---

## Zones du corps

Chaque combattant expose `bodyHits` :

```js
{
  head: 0,
  chestLeft: 0, chestRight: 0, abdomen: 0,
  leftArm: 0, rightArm: 0,
  leftLeg: 0, rightLeg: 0,
  torso: 0 // compat anciennes sauvegardes/events
}
```

À chaque tir réussi, le simulateur choisit une zone de façon déterministe et incrémente cette zone jusqu'à 2. Le rendu utilise 0 = neutre, 1 = rouge clair, 2 = rouge foncé.

## Dégâts armes

`weapon-config.json` schemaVersion 2 expose `damageMin` et `damageMax`. À chaque balle, `combat-sim.js` tire un entier déterministe dans cette plage ; `damage` reste une moyenne/fallback pour les UI anciennes.

---

## Intégration dans hq.jsx

Le sous-état `subpage === 'battle'` monte `HQBattleScreen` avec `mySquad = hq` (état HQ courant) et `battleTarget` (squad adverse choisie via `HQOpponentSelect`). `onDone` revient à `subpage = null`.
