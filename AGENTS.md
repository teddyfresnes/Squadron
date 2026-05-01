# Squadron Agent Notes

## Projet

Squadron est un prototype web statique de creation/rendu de soldats 2D facon MiniTroopers. Il tourne directement dans le navigateur avec React charge par CDN et Babel cote client.

Lancement local :

```bash
python -m http.server 8000
```

Puis ouvrir :

```text
http://localhost:8000/Sprite%20Forge.html
```

## Carte Rapide

- `Sprite Forge.html` : point d'entree HTML, ordre de chargement des scripts.
- `app.jsx` : UI React, selection personnage, animations, armes et skins.
- `palette.js` : palettes de couleurs disponibles.
- `parts.js` : dessin des morceaux du corps en pixel art et HD.
- `renderer.js` : composition finale du soldat, mapping config -> rendu.
- `animations.js` : frames et poses qui pilotent corps, bras, armes, recoil.
- `weapons.js` : manifeste visuel des armes, coordonnees de sprites, grips, muzzle, hold metadata.
- `weapon-config.json` : stats gameplay des armes, separees du rendu visuel.
- `assets/weapons/*.png` : sprite sheets d'armes, une image par skin.
- `styles.css` : layout et styles de l'outil.

## Conventions Actuelles

- La couleur d'uniforme vient de `cfg.uniformIdx` et s'applique au haut, pantalon, backpack et casque.
- La veste pare-balles reste noire (`P.vest[0]`) et n'a pas de choix de couleur dans l'UI.
- Les couvre-chefs recents (`High Helmet`, `Pilot Goggles`, `Cap`, `Beret`, `Military Helmet`, `Tactical Helmet`) sont dessines directement dans `parts.js`.
- Les couleurs soldat sont dans `SOLDIER_COLORS`; noir et blanc n'y sont plus disponibles.
- Les cheveux utilisent `window.Palette.hair`; la couleur `Ginger` sert de roux melange marron/jaune.
- Les stats d'armes doivent rester dans `weapon-config.json`; les infos de rendu restent dans `weapons.js`.
- Les IDs de `weapon-config.json` doivent correspondre aux IDs generes dans `weapons.js` (`SMG-01`, `RIFLE-01`, etc.).

## Economie De Tokens

Pour du vibe coding efficace :

- Lire d'abord ce fichier, puis seulement les fichiers touches par la demande.
- Utiliser `rg` pour localiser les symboles avant d'ouvrir de gros fichiers comme `parts.js`.
- Eviter de relire tout `parts.js` sauf si la demande concerne directement une fonction de dessin.
- Pour les armes, consulter `weapons.js` pour les sprites/ancres et `weapon-config.json` pour le gameplay.
- Pour une demande UI/couleurs, commencer par `app.jsx`, `palette.js`, puis `renderer.js`.
- Pour une demande animation/pose/recoil, commencer par `animations.js`, puis `renderer.js`.

## Suivi

Mettre ce fichier a jour quand :

- un nouveau fichier devient central au projet ;
- une convention de config ou de rendu change ;
- un fichier JSON devient source de verite ;
- une decision importante evite de relire beaucoup de code plus tard.

Garder les notes courtes, pratiques et orientees action. Le but est d'aider le prochain agent a comprendre vite sans bruler le contexte.
