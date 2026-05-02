# SQUADRON

Prototype web de création et gestion de soldats 2D façon MiniTroopers, avec serveur Node.js pour l'authentification et la génération déterministe de troopers.

---

## Structure du projet

```
Squadron/
├── client/               — Application web (HTML + JS + assets)
│   ├── Sprite Forge.html — Point d'entrée
│   ├── app.jsx           — UI éditeur (mode dev)
│   ├── game.jsx          — UI jeu / squads (mode prod) ← SERVER_URL ici
│   ├── root.jsx          — Switcher dev/prod
│   ├── styles.css
│   ├── palette.js / parts.js / renderer.js / animations.js / weapons.js / sprite-engine.js
│   ├── weapon-config.json
│   └── assets/           — Images de fond et sprite sheets armes (0–33.png)
│
├── server/               — Serveur Node.js (Express)
│   ├── server.js         — Point d'entrée
│   ├── config.js         — Port, JWT secret, chemin DB
│   ├── db.js             — Store JSON (aucun module natif)
│   ├── middleware/auth.js — Vérification JWT
│   ├── routes/auth.js    — POST /api/auth/register  POST /api/auth/login
│   ├── routes/squads.js  — GET  /api/squad/:name
│   ├── routes/troopers.js— GET  /api/troopers
│   └── utils/            — password.js · seed.js · generateTroopers.js
│
├── readme.md
└── AGENTS.md
```

---

## Lancer le projet

### 1. Serveur (port 3001)

```bash
cd server
npm install        # une seule fois
npm start
```

Le serveur démarre sur `http://0.0.0.0:3001`.  
Journal : `[squadron-server] http://0.0.0.0:3001`

### 2. Client (port 8080)

```bash
cd client
python -m http.server 8080
```

Ouvrir : **http://localhost:8080/Sprite%20Forge.html**

> Le client cherche automatiquement le serveur au démarrage.  
> S'il ne répond pas en 10 s, il propose le **mode hors ligne** (données en localStorage).

---

## Mode hors ligne

Sans serveur, l'appli fonctionne normalement en local :  
squads et troopers sont stockés en localStorage, comme avant.

---

## Rendre le serveur public (LAN / internet)

Pour que d'autres joueurs sur des machines différentes se connectent au même serveur :

### 1. Le serveur écoute déjà sur toutes les interfaces

Par défaut `BIND_HOST=0.0.0.0`. Rien à changer.

### 2. Ouvrir le port 3001 dans le pare-feu Windows

```powershell
netsh advfirewall firewall add rule name="Squadron Server" dir=in action=allow protocol=TCP localport=3001
```

### 3. Configurer la redirection de port sur ta box / routeur

| Champ | Valeur |
|---|---|
| Protocole | TCP |
| Port externe | 3001 |
| IP interne | IP locale du PC (`ipconfig` → "Adresse IPv4", ex: `192.168.1.42`) |
| Port interne | 3001 |

Ton IP publique : https://whatismyip.com

### 4. Mettre à jour l'URL du serveur dans le client

Dans **`client/game.jsx`**, ligne ~11 :

```js
// Remplacer :
const SERVER_URL = 'http://127.0.0.1:3001';
// Par :
const SERVER_URL = 'http://TON_IP_PUBLIQUE:3001';
```

### 5. Autoriser l'origine du client dans le CORS (si hébergé ailleurs)

Dans **`server/server.js`**, la condition CORS autorise déjà tous les `localhost:*`.  
Si le client est servi depuis un vrai domaine, l'ajouter dans la regex :

```js
origin === 'https://mondomaine.com' ||
```

### Alternative rapide : ngrok (sans toucher au routeur)

```bash
# ngrok.com → installer, puis :
ngrok http 3001
# → donne une URL publique temporaire, ex: https://abc123.ngrok.io
```

Mettre cette URL dans `SERVER_URL` côté client.

---

## Variables d'environnement (serveur)

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3001` | Port d'écoute |
| `BIND_HOST` | `0.0.0.0` | Interface réseau (`127.0.0.1` pour local only) |
| `DB_PATH` | `server/squadron.json` | Chemin de la base de données JSON |

Exemple :
```bash
PORT=4000 BIND_HOST=127.0.0.1 node server.js
```

---

## Troopers déterministes

Les troopers sont générés par le serveur à partir d'un seed = `hash(date | IP client)`.  
Même jour + même IP = exactement les mêmes 8 soldats.  
Changer d'IP (aller chez quelqu'un d'autre) ou attendre le lendemain = nouveaux troopers.
