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
| `shoot` | Dans la portée et magazine > 0 | aimDur + rafale visuelle + recovery + unaim |
| `switch` | Arme courante vide et autre arme chargée disponible | animDur('holster') + animDur('drawWeapon') |
| `reload` | Arme courante vide, pas d'autre arme chargée, mais réserve > 0 | `Anims.reload.durationForRounds(rounds)` |
| `idle` | Pas de cible vivante, ou bare-handed (plus de balles nulle part) | 0.4 s (0.8 s pour bare-hands) |

Après chaque action : `cooldown += duration + TURN_GAP (0.04s)`.

---

## Munitions et rechargement

Chaque combattant porte une map `ammo[weaponName] = { loaded, reserve }` initialisée au début de la bataille via `rollInitialAmmo()`. Chargeur et réserve sont tirés indépendamment :

- `loaded ∈ [1, magazineSize - 1]` (toujours au moins 1 round chambré, jamais plein)
- `reserve ∈ [0, reserveCap - 1]` (jamais plein, peut être vide)

Le cap effectif de la réserve est `reserveCap = min(weapon.reserveAmmo, reserveDisplayCap(magSize))` où `reserveDisplayCap(mag) = floor(5 * mag / 3)`. Cette borne garantit que la rangée de balles de réserve (slot 2 px + 1 px gap) ne dépasse jamais la largeur de la rangée du chargeur principal (slot 4 px + 1 px gap). `window.CombatSim.resolveAmmoLimits(name)` expose `{ magSize, reserveCap }` pour que `combat-view.jsx` rende le même nombre de slots que le sim génère.

La rafale (`burst`) est cappée à la volée par `Math.min(burstCount, loaded)`, donc une rafale partielle peut se produire si le magasin se vide en cours d'action. Chaque coup tiré décrémente `loaded` de 1 (visible en temps réel dans le panneau d'inspection).

Quand le magasin courant atteint 0 lors du planning :
1. **Switch** vers une autre arme chargée (priorité : celle qui a le plus de balles).
2. Sinon **Reload** depuis la réserve (arme courante si elle a de la réserve, sinon switch d'abord vers une arme qui en a).
3. Sinon **bare-hands** : `cfg.weaponIdx` passe sur `MELEE-01`, `outOfAmmo = true`, le soldat enchaîne des `idle` jusqu'à la fin du combat (pas de mécanique mêlée pour l'instant).

L'animation `Anims.reload` reçoit `animState.reloadRounds` ; `combat-view.frameForState` lit `framesForRounds(rounds)` pour clipper correctement sur la dernière frame quand le nombre de balles diffère du défaut.

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
rifle, pistol        → 'mid'
smg, heavy, shotgun  → 'front'
melee                → 'front' par défaut (catalogue seulement pour l'instant)
```

---

## Types d'événements (battle.events)

```js
{ t, type: 'turn',  actorId, action: 'move'|'shoot'|'idle' }
{ t, type: 'shoot', actorId, targetId, ax, ay, tx, ty, hit: bool, shotIndex?: number, shotCount?: number, weaponName?: string, weaponCategory?: string, weaponType?: string, shotProfile?: string, facing?: 1|-1, bodyPart?: 'head'|'chestLeft'|'chestRight'|'abdomen'|'leftArm'|'rightArm'|'leftLeg'|'rightLeg', damage }
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
| `'reload'` | Recharge : genou à terre, arme verticale, boucle `reloadRounds` balles, puis retour idle |
| `'holster'` | Fin de combat : les survivants gagnants rangent leur arme (puis `victory`, puis `walk`/`run` mains nues) |
| `'hurt'` | Vient d'être touché (dure `Anims.hurt.frames/fps`, puis → idle) |
| `'dead'` | HP ≤ 0, animation finale |

`stateT` = temps écoulé dans l'état courant (en secondes), passé à `frameForState()` dans combat-view.

`Anims.reload` expose `framesForRounds(n)` et `durationForRounds(n)` pour câbler plus tard une durée dépendante du nombre de balles rechargées.

`burst` dans `weapon-config.json` est la source de vérité du nombre de coups dans une action de tir. Chaque coup a son propre jet d'accuracy, sa propre zone visée/touchée, ses dégâts, son trail et peut relancer l'animation `hurt` de la cible.

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
- `ArenaSoldier` : `<button>` positionné absolument avec `<SpriteCanvas>` + ombre au sol ; la barre de vie au-dessus du soldat n'apparait que brièvement après un hit, et jamais quand `hp <= 0` ou `state === 'dead'`
- Sélection en pause : tout l'arène reste en effet VHS (grayscale), mais le soldat sélectionné garde ses couleurs et reçoit un halo doré (CSS `.cv-soldier.is-selected` dans `.cv-arena.is-paused`)
- `SoldierInspectMenu` : panneau contextuel structuré en 3 sections — header (nom + niveau), liste de toutes les armes débloquées (icône + nom + barre de munitions), puis vitals (jauge de vie verticale + silhouette SVG du corps) et icônes skills d'armes en bas avec tooltip. La vie s'affiche uniquement en tooltip suiveur de curseur sur la jauge ou la silhouette (pas d'affichage statique 10/10)
- `TrailsLayer` : SVG overlay, trails disparaissent en 300 ms
- `ResultBanner` : grand label `VICTOIRE` / `DÉFAITE` / `ÉGALITÉ` qui glisse de la gauche, s'arrête au centre puis sort vers la droite (CSS `cv-banner-slide`, 3.2s). Police `SairaStencilOne` chargée via `@font-face` depuis `assets/fonts/`. Affiché dès que `battle.done`
- `ResultOverlay` : popup de récompense, fond légèrement assombri (rgba alpha 0.42), apparaît `RESULT_POPUP_DELAY_MS` (2.6s) après `battle.done` — laisse le temps au banner de défiler et aux survivants gagnants d'enchaîner `holster → victory → walk/run mains nues` (combat-sim.js `startCelebrateWalk`, chance 1/2 walk vs run, vitesse jitter). Le popup est skippable via le bouton Continuer, clic backdrop, touche `Entrée` ou `Espace`. `onDone` reçoit `{ winner, tokensWon, oppName }` et `hq.jsx` crédite les tokens (base 30 + 10 par ennemi abattu, 10 sur égalité, 0 sur défaite)

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

`weapon-config.json` schemaVersion 2 expose `damageMin` et `damageMax`. À chaque balle, `combat-sim.js` tire un entier déterministe dans cette plage ; `damage` reste une moyenne/fallback pour les UI anciennes. L'equilibrage actuel part d'une base niveau 1 a 10 PV : les armes a forte rafale infligent peu par tir, les armes lourdes/snipers frappent fort mais restent plus lentes ou moins fiables.

---

## Intégration dans hq.jsx

Le sous-état `subpage === 'battle'` monte `HQBattleScreen` avec `mySquad = hq` (état HQ courant) et `battleTarget` (squad adverse choisie via `HQOpponentSelect`). `onDone` revient à `subpage = null`.
