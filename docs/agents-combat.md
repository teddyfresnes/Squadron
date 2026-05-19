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
| `move` | Cible trop loin (> rangeMax) ou trop proche (< rangeMin). Le `move` supporte aussi `fromY`/`toY` pour les déplacements 2D (kite snipers, voir plus bas). | dist / SPEED_TILES_PER_SEC |
| `shoot` | Dans la portée et magazine > 0 | aimDur + rafale visuelle + recovery + unaim |
| `switch` | Arme courante vide et autre arme chargée disponible | animDur('holster') + animDur('drawWeapon') |
| `reload` | Arme courante vide, pas d'autre arme chargée, mais réserve > 0 | `Anims.reload.durationForRounds(rounds)` |
| `punch` | Bare-handed et cible vivante à portée (`MELEE-01.rangeMax = 1`) | `Anims.punch.frames / fps` |
| `idle` | Pas de cible vivante (ou bare-handed sans cible) | 0.4 s (0.8 s pour bare-hands) |

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
3. Sinon **décision basée sur la distance** :
   - Si la cible est proche (`d ≤ BARE_HANDS_CLOSE_RANGE = 4` tiles) → bare-hands (le poing arrive plus vite qu'un reload).
   - Sinon, si un reload est possible (réserve `> 0` sur n'importe quelle arme) → `Reload` (avec switch préalable si une autre arme a de la réserve). Couvre aussi le cas "redraw" : un soldat qui s'était mis à mains nues retourne à une vraie arme dès qu'il a de la distance.
   - Sinon **bare-hands**.

   Bare-hands : `cfg.weaponIdx` passe sur `MELEE-01`, `outOfAmmo = true`. Le soldat s'approche de la cible la plus proche puis joue `Anims.punch` (anticipation → frappe → impact → récupération). Les dégâts (`damageMin=1, damageMax=2` de MELEE-01) sont appliqués à la frame `Anims.punch.impactFrame` (F5 par défaut). Si la cible disparaît, retour à `idle` (0.8 s).

### Kite snipers (escape 2D)

Quand `tooClose` (cible dans la `rangeMin`) **et** `rangeMin ≥ KITE_RANGE_MIN_TILES = 5` (snipers et la plupart des heavies), `planKiteAction` remplace le simple recul horizontal :
- Budget de déplacement = `MOVE_STEP_TILES`, dépensé d'abord en horizontal (loin de la cible), puis en vertical sur l'axe `laneOffsetPx` quand le mur d'arène est proche.
- Direction Y : côté avec le plus de place (par défaut opposé à la Y de la cible).
- Clamp final aux bornes (`x ∈ [0.5, ARENA_TILES-0.5]`, `y ∈ [SPAWN_Y_MIN, SPAWN_Y_MAX]`) — le soldat ne sort jamais du décor.
- Quand les deux axes sont déjà bloqués, retour au `move` 1D classique (filet de sécurité).

L'animation `Anims.reload` reçoit `animState.reloadRounds` ; `combat-view.frameForState` lit `framesForRounds(rounds)` pour clipper correctement sur la dernière frame quand le nombre de balles diffère du défaut.

### Reload progressif et interruption

Chaque cycle de l'anim reload (`RELOAD_ROUND_FRAMES = 7 frames @ 12 fps`) transfère **une** balle de la réserve vers le chargeur (et incrémente `actor.reloadProgress = { seated, total }`, lu par `combat-view.ReloadIndicator` pour afficher un mini-chargeur au-dessus du soldat, à la même hauteur que la barre de vie).

`isUnderThreat(actor)` retourne `true` si :
- `actor.state === 'hurt'` (vient d'être touché), OU
- une action `shoot` active vise cet actor (`a.targetId === actor.id`).

Tant que `seated < 1`, le reload est insécable. Dès que **≥ 1 balle est chambrée** ET `isUnderThreat()` est vrai, l'action est coupée (`a.aborted = true`, `a.duration = a.elapsed`) — le soldat repart immédiatement avec ses munitions partielles et peut planifier un tir au prochain tour.

---

## Lance-roquettes (bazookas, RPG, AT4, Carl Gustaf, MGL, etc.)

`combat-sim.isRocketLauncher(stats)` détecte les armes à roquette : `category === 'heavy'`, `weaponType !== 'automatic'`, nom/alias contient l'un de `launcher|grenade|lobber|rpg|at4|at5|stinger|gustaf|mgl|m202|flare|toob|tube|cannon|recoilless`, et **n'est pas** un faisceau (`lazor|laser|beam` exclus → le Lazor Cannon garde son `deadVariant: 'explode'` mais ne devient pas un lance-roquette).

L'action `shoot` d'un lance-roquette est marquée `action.isRocket = true` et déroule :

```
aim (aimDur)
  → launchT = aimDur + AIM_HOLD            [event 'rocketLaunch' émis, magasin -1]
  → ROCKET_TRAVEL_T = 0.35 s de vol        [vue : sprite roquette rapide + traînée de fumée]
  → impactT = shot.atT                     [event 'rocketImpact', AoE si hit]
  → ROCKET_RECOVERY_T = 0.18 s
  → unaim
```

**Miss** : `endX = target.x + missDir * (1.0 + rng * 1.8)` (frôle la cible à 1–3 tuiles près au lieu de partir hors arène) et `endY = target.laneOffsetPx ± (22 + rng * 26)` px (passe à côté latéralement). But : trajectoire visuellement identique à un hit jusqu'au dernier instant — c'est l'absence d'explosion qui révèle le miss.

**Hit** : `applyRocketAoE(shooter, tx, ty)` projette en l'air tous les ennemis (pas d'allié) vivants à `|x - tx| ≤ ROCKET_AOE_TILES (= 3 tuiles)` **ET** `|laneOffsetPx - ty| ≤ ROCKET_AOE_Y_PX (= 55 px)` via `tossSoldier()` — la clamp verticale empêche le blast d'aspirer des soldats des lanes voisines :
- `state = 'tossed'` ; toute action en cours sur la cible est avortée (`a.duration = a.elapsed`)
- `animState.toss = { damage, height ∈ [0.55, ~3.7], heightRatio ∈ [0,1], knockFromX, knockToX, landed }`
- `cooldown = Math.max(cooldown, worldT + animDur('deadExplode'))`

**Hauteur de toss** : `height = 0.55 + min(rng, rng) * 1.35` (biais bas, mean ~1.0) + `20% chance` d'ajouter `0.4 + rng*1.4` (kicker, pour des envols spectaculaires). `combat-view.flightOffsetY` lit `s.animState.toss.height` et multiplie `deadExplode.flightY(frame)` — donc un soldat avec `height = 3.0` monte 3× plus haut que la trajectoire de base. La trajectoire de base est une demi-sinusoïde (peak ~-238 px inner à F5-F6) → **ease-in-out** : lift-off rapide, hover au sommet, chute qui ré-accélère jusqu'à l'impact.

**Direction de toss** : `knockTiles = (0.25 + rng² * 2.4)` (sqrt-biaisé → la plupart restent près du point d'impact, mais la queue laisse parfois partir un corps loin). Direction normalement **away from impact**, mais **35 % de chance** d'inverser le sens ET de flipper `s.facing` — le corps part dans l'autre direction en mode miroir, comme s'il avait pivoté de 180° avant d'être éjecté.

**Dégâts de chute biaisés par la hauteur** : `rollFallDamage(rng, heightRatio)` mélange deux tirages :
- `heightRatio = 0` (mini-pop) → `Math.min(a, b)` → quasi tout le temps 1-2
- `heightRatio = 1` (envol max) → `Math.max(a, b)` → quasi tout le temps 5-6
- entre les deux : interpolation via `mid = (a+b)/2`

`driveTossedSoldier()` (appelée depuis `driveInactiveAnimations`) lerp la position X de `knockFromX` → `knockToX` sur `[0, landT = TOSS_LAND_FRAME/fps]`, puis applique les dégâts à `landT`. Si HP ≤ 0, bascule en `'dead'` en gardant `deadVariant: 'explode'` + `fromToss: true` (l'event `die` indique à la vue de ne PAS spawner une seconde explosion). Sinon, à la fin de l'anim (`frames/fps`), bascule en `'lain'` pour `1.0 + min(2.0, height*0.5) + rng*0.5` s, puis `'getUp'` (~1 s), puis `'idle'`.

`combat-view.flightOffsetY(animKey, frame, spriteScale, s)` lit `s.animState.toss.height` pour multiplier `deadExplode.flightY(frame)` — un groupe touché par la même explosion ne décolle pas en bloc.

**Tunables** : `ROCKET_TRAVEL_T`, `ROCKET_AOE_TILES`, `ROCKET_AOE_Y_PX`, `ROCKET_RECOVERY_T`, `ROCKET_TOSS_DMG_MIN/MAX`, `TOSS_LAND_FRAME` (combat-sim.js).

**Rendu (combat-view.jsx)** :
- `RocketsLayer` (SVG, z-index 8) anime le sprite roquette (compact — `RS = 1.0` × scale de base, 3 couches de flamme) + train de fumée blanche dense (puffs toutes les 14 ms : halo flouté + corps + cœur). Le point de départ est résolu via `trailMuzzlePoint(r)` (même helper que les balles) pour partir du **muzzle de l'arme**, pas du centre du soldat. **Arc minuscule** (`arcPx = 5 * spriteScale`) identique pour hit et miss — la roquette file droit et vite, on ne peut pas lire l'issue depuis la trajectoire.
- `ExplosionLayer` (DIV, z-index 9) — **sprite-based**, une seule variante `'explosion'` : `assets/animations/explosion/{1..11,13..17}.png` (16 frames, 512×512, frame 12 absente du disque, mappée par `frameForIdx`). Pour les impacts de roquette (`atFeet: true`), le bottom du sprite est ancré à `groundY + 4 * spriteScale` — donc l'explosion sort vraiment du sol pile où la roquette atterrit. Pour `deadVariant: 'explode'` (corps qui pète en l'air), `atFeet: false` garde l'ancien comportement (centre à ~42 px au-dessus du sol).

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
{ t, type: 'rocketLaunch', actorId, targetId, ax, ay, tx, ty, endX, endY, hit: bool, travelT, aoeRadius, weaponName, weaponCategory, weaponType, facing }
{ t, type: 'rocketImpact', actorId, targetId, ax, ay, tx, ty, hit: bool, weaponName, weaponCategory, weaponType }
{ t, type: 'toss',  targetId, damage, height }
{ t, type: 'hit',   targetId, hp, bodyPart, damage, bodyHits, fromToss?: bool }
{ t, type: 'die',   targetId, bodyPart, damage, deadVariant?: 'project'|'fall'|'explode' }
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
| `'punch'` | Coup de poing mains nues (anticipation, frappe, impact, recovery). Damage à `Anims.punch.impactFrame` (F5) |
| `'holster'` | Fin de combat : les survivants gagnants rangent leur arme (puis `victory`, puis `walk`/`run` mains nues) |
| `'hurt'` | Vient d'être touché (dure `Anims.hurt.frames/fps`, puis → idle) |
| `'tossed'` | Projeté en l'air par l'explosion d'une roquette AoE. Joue `Anims.deadExplode` via `combat-view.effectiveAnimKey`. À la frame d'atterrissage (`TOSS_LAND_FRAME = 11`) le simulateur tire `damage ∈ [1,6]` biaisé par `animState.toss.heightRatio` (haut → plus de 6 ; bas → plus de 1, voir `rollFallDamage()`). Si HP ≤ 0 → bascule en `'dead'` (même clé d'anim) sans saut visuel, sinon → `'lain'`. La hauteur `animState.toss.height` ∈ `[0.55, ~3.7]` (queue longue : 20 % de chance d'un gros bonus) multiplie `deadExplode.flightY(frame)` dans `combat-view.flightOffsetY`. |
| `'lain'` | Survivant d'une roquette, allongé sur le dos, **yeux ouverts**, légère respiration (`bodyDY` oscille de 1 px). Boucle `Anims.lain` (12 frames @ 6 fps). Durée tirée à la transition `tossed → lain` : `1.0 + min(2.0, height*0.5) + rng*0.5` secondes (plus on a volé haut, plus on reste sonné). Verrouille `cooldown` jusqu'à la fin de `lain + getUp`. |
| `'getUp'` | Transition `lain → idle` : `Anims.getUp` (10 frames @ 10 fps, ~1 s). Le `deathAngle` revient de `-π/2` à `0`, le soldat s'appuie sur son coude puis se met à genoux puis debout. Endpoint pose = IDLE bare-hands → aucun snap au retour `'idle'`. |
| `'dead'` | HP ≤ 0, animation finale. Le simulateur tire (RNG seedé) `animState.deadVariant ∈ {'project','fall','explode'}` au moment du kill ; `combat-view.effectiveAnimKey` mappe `'fall'` → `Anims.dead2` (chute raide en arrière, pas de skid), `'project'` → `Anims.dead` (projection + skid arrière) et `'explode'` → `Anims.deadExplode` (projection verticale en demi-sinusoïde, ventre vers le sol à la montée, flip d'une frame au sommet, puis chute **dos au sol / membres vers le ciel** jusqu'à l'atterrissage — `deathAngleWorld=false` pour que les deux facings atterrissent dans la même orientation que `Anims.lain`, sans flip 180° à la transition). |

`deadVariant: 'explode'` est choisi pour les armes lourdes non automatiques et les armes de type launcher/grenade launcher ; les futures mines devront réutiliser cette même variante sans ajouter un nouvel état de combat.

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
- `ResultBanner` : grand label `VICTOIRE` / `DÉFAITE` / `ÉGALITÉ` qui glisse de la gauche, s'arrête au centre puis sort vers la droite (CSS `cv-banner-slide`, 3.2s). Police `SairaStencilOne` chargée via `@font-face` depuis `assets/fonts/`. Affiché dès que `battle.done`. **Se met en pause** quand `pauseMode !== null` : la classe `.is-paused` applique `animation-play-state: paused` sur le slide et le shine sweep
- `ResultOverlay` : popup de récompense, fond légèrement assombri (rgba alpha 0.42), apparaît quand `battle.endHoldT * 1000 ≥ RESULT_POPUP_DELAY_MS` (2.6 s). Comme `endHoldT` n'avance que pendant les pas de sim, **mettre en pause gèle le compteur** : tant que le joueur reste en pause après la fin du combat, le popup attend. Le popup laisse le temps au banner de défiler et aux survivants gagnants d'enchaîner `holster → victory → walk/run mains nues` (combat-sim.js `startCelebrateWalk`, chance 1/2 walk vs run, vitesse jitter). Skippable via le bouton Continuer, touche `Entrée` ou `Espace`. **Le clic backdrop ne ferme plus le popup** (volontaire — évite les fermetures involontaires). `onDone` reçoit `{ winner, tokensWon, oppName }` et `hq.jsx` crédite les tokens (base 30 + 10 par ennemi abattu, 10 sur égalité, 0 sur défaite)

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
