# Squadron — Serveur (détails agent)

→ Lire d'abord [AGENTS.md](../AGENTS.md).

---

## Fichiers serveur

| Fichier | Rôle |
|---|---|
| `server.js` | Express app, Helmet, CORS, rate-limit, mount routes |
| `config.js` | Port (3001), BIND_HOST (0.0.0.0), JWT_SECRET (persisté dans `.jwt_secret`), DB_PATH |
| `db.js` | Store JSON pur JS — pas de module natif. Fichier : `squadron.json` |
| `middleware/auth.js` | Vérifie `Authorization: Bearer <jwt>` |
| `routes/auth.js` | `POST /api/auth/register` · `POST /api/auth/login` |
| `routes/squads.js` | `GET /api/squad/:name` |
| `routes/troopers.js` | `GET /api/troopers` |
| `utils/password.js` | `isSecurePassword()` — ≥8 chars + chiffre + majuscule |
| `utils/seed.js` | `createSeed(date, ip)` + PRNG Mulberry32 + `normalizeIp` + `todayString` |
| `utils/generateTroopers.js` | Génère 8 troopers à partir du seed IP+date |

---

## API endpoints

```
GET  /api/health                 → {status:'ok', version:'1.0.0'}
GET  /api/troopers               → {troopers:[8 soldats], date}
GET  /api/squad/:name            → {exists, hasPassword}
GET  /api/squad/opponents/list?exclude=<name>
                                → {squads:[{name,soldiers,power,level,source:'player'}]}
POST /api/auth/register          body:{squadName,password,founder{name,config,skill1Name,skill2Name}}
                                 → 201 {token, squadName}
POST /api/auth/login             body:{squadName,password}
                                 → 200 {token, squadName}
```

`/api/squad/opponents/list` expose les squads enregistrées pour le matchmaking. Tant que le serveur ne synchronise pas le HQ complet, chaque armée serveur contient uniquement le fondateur enregistré, donc power 5.

---

## Schéma DB (squadron.json)

```json
{
  "squads": [
    {
      "id": 1,
      "name": "string (2–24)",
      "passwordHash": "bcrypt ou ''",
      "founderName": "string (≤64)",
      "founderConfig": "JSON stringifié du cfg soldat",
      "founderSkill1": "string (≤64)",
      "founderSkill2": "string (≤64)",
      "isSecure": 0 | 1,
      "createdAt": "timestamp ms"
    }
  ],
  "nextId": 1
}
```

Persistance atomique : écriture dans `squadron.json.tmp` puis rename.

---

## Sécurité serveur

- bcryptjs rounds=12, JWT exp=7j, issuer='squadron'
- Rate-limit auth : 15 req / 15 min par IP
- Rate-limit global : 120 req / min par IP
- CORS : `localhost:*`, `127.0.0.1:*`, et `origin === 'null'` (file://) — adapter si serveur public
- Body parser limité à 32 KB
- Marquage silencieux `isSecure=0` si mdp vide / <8 chars / sans chiffre / sans majuscule (pas de retour client)
- Login avec squad sans mdp → accès libre sans bcrypt
- Login avec squad introuvable → dummy bcrypt hash pour éviter l'énumération par timing

---

## Troopers déterministes

```
Seed = MurmurHash3(YYYY-MM-DD | IP normalisée) → PRNG Mulberry32
Même jour + même IP = mêmes 8 soldats
```

La génération se fait dans `server/utils/generateTroopers.js`.  
Les listes WEAPON_NAMES, HAIR_STYLES, SKILL1_INDICES doivent **rester en sync** avec le client.

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3001` | Port d'écoute |
| `BIND_HOST` | `0.0.0.0` | Interface réseau (`127.0.0.1` pour local only) |
| `DB_PATH` | `server/squadron.json` | Chemin de la base JSON |

---

## Lancer le serveur public (LAN / internet)

1. Port déjà ouvert sur toutes les interfaces (`BIND_HOST=0.0.0.0`)
2. Ouvrir port 3001 dans le pare-feu Windows (`netsh advfirewall firewall add rule …`)
3. Rediriger port 3001 sur la box/routeur vers l'IP locale
4. Dans `client/game.jsx` ligne 11 : remplacer `http://127.0.0.1:3001` par l'IP publique
5. Si client hébergé sur domaine tiers : ajouter l'origine dans la regex CORS de `server.js`
