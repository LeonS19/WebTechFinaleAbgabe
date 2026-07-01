# WebTech Finale Abgabe – Projektdokumentation
 
## Projektübersicht
 
Eine kollaborative Lernplattform mit RPG-Gameplay. Nutzer schreiben Karteikarten, lernen im Team in Lerngruppen und kämpfen gemeinsam in Dungeon-Runs gegen Gegner – wobei das Beantworten von Karteikarten Schaden verursacht.
 
---
 
## Technologiestack
 
| Bereich | Technologie |
|---|---|
| Backend | Node.js + Express.js |
| GraphQL | Apollo Server 5 + @as-integrations/express5 |
| REST | Express Router |
| WebSocket | ws + graphql-ws |
| Frontend | Vue 3 |
| SQL Datenbank | PostgreSQL 16 (Docker) |
| MongoDB | MongoDB 7 (Docker) |
| Auth | Passkeys (WebAuthn) + Google OAuth |
| Token | JWT |
| ORM/DB Client | pg (PostgreSQL), Mongoose (MongoDB) |
| File Upload | Multer |
| API Docs | Swagger UI (swagger-ui-express) |
| PWA | Service Worker + Web App Manifest + IndexedDB |
 
---
 
## Architekturentscheidungen
 
### SQL vs MongoDB Aufteilung
 
**SQL (PostgreSQL)** – strukturierte, relationale Daten mit festen Beziehungen:
- `user`, `passkey`, `oauth_account`
- `study_group`, `membership`
- `map`, `field`, `enemy`
- `run`
**MongoDB** – flexible, dokumentenorientierte Daten:
- `indexcards` – Karteikarten mit eingebetteten Tags, Dateianhängen und Stats
- `messages` – Chat-Nachrichten
**Begründung:** Karteikarten haben variable Inhalte (Tags als Array, eingebettete Stats pro Gruppe und pro User, Dateianhänge) → MongoDB. Alles mit klaren Fremdschlüsselbeziehungen → SQL.
 
### REST vs GraphQL
 
**REST** wird nur für:
- Auth (OAuth Redirect, Passkey Registration/Login)
- Datei-Upload / Download (Multipart Form Data)
- Health Check
**GraphQL** für alles andere:
- Alle CRUD Operationen
- Flexible Abfragen (Filter, Suche)
- Echtzeit via Subscriptions
### Authentifizierung
 
- **Google OAuth** – Redirect Flow, JWT nach erfolgreichem Login
  - Server leitet Browser zu Google weiter (`/api/v1/auth/google`)
  - Google leitet zurück zu `/api/v1/auth/google/callback?code=...`
  - Server tauscht `code` gegen Google-Tokens, liest User-Infos aus dem ID-Token (`payload.sub`, `email`, `name`)
  - Server findet oder legt User an (`user` + `oauth_account` Tabelle)
  - Server erstellt eigenes JWT und leitet Browser zum Frontend weiter: `FRONTEND_URL/auth/callback?token=eyJ...`
  - **Frontend liest Token aus der URL** (`window.location.search`) und speichert ihn für weitere API-Requests
  - ⚠️ Token in URL hat Sicherheitsbedenken (Browser-History, Server-Logs) – für Produktion wäre HttpOnly Cookie oder kurzlebiger Einmal-Code sicherer (siehe Reflexion)
- **Passkeys (WebAuthn)** – Challenge/Response, kein Passwort
  - Challenges werden in eigener `webauthn_challenge` Tabelle gespeichert (mit `expires_at`, automatisch ungültig nach 5 Minuten)
  - `challengeId` (interne DB-UUID) wird zusammen mit den WebAuthn-Options ans Frontend zurückgegeben
  - Frontend schickt `challengeId` + Browser-`response` beim `verify`-Call zurück
  - Public Keys werden als Base64-String in der `passkey` Tabelle gespeichert, beim Login zurück in `Uint8Array` konvertiert
  - Challenges werden nach einmaligem Verbrauch gelöscht (Replay-Schutz)
- Credentials werden in eigenen Tabellen gespeichert (`passkey`, `oauth_account`) – nicht direkt in `user`
- Ein User kann mehrere Passkeys (verschiedene Geräte) und mehrere OAuth-Provider haben
### Rollen
 
Rollen sind **kontextabhängig pro Lerngruppe** – nicht global am User. Gespeichert in der `membership` Zwischentabelle:
- `ADMIN` – kann alles, auch Mitglieder entfernen
- `MODERATOR` – kann Karteikarten bearbeiten/löschen
- `MEMBER` – kann Karteikarten erstellen, lesen
### Dynamischer Schwierigkeitsgrad
 
Kein gespeichertes Attribut – wird immer berechnet:
```
schwierigkeitsgrad = correct_answers / total_attempts
```
Gespeichert werden nur Rohdaten in `group_stats` (eingebettet in MongoDB Karteikarte).
Zusätzlich `user_stats` pro Karteikarte für persönlichen Lernfortschritt.
 
### Schadensberechnung
 
- **Spieler → Gegner:** `schaden = getSchwierigkeitsgrad()` der beantworteten Karte
- **Gegner → Spieler:** `schaden = f(aktuellePosition)` – je weiter im Run, desto mehr Schaden
### Rangliste
 
Kein eigenes Datenbankmodell – `RanglistenService` filtert direkt auf `run`:
- Nur `successful = true`
- Nur Runs von Mitgliedern der Lerngruppe
- Sortiert nach `hit_rate DESC`, bei Gleichstand `duration ASC`
### PWA
 
- `ServiceWorker` – Cache First für Assets, Network First für API Calls
- `OfflineStorageService` – cached Karteikarten, Runs und Nachrichten via IndexedDB
- `Web App Manifest` – App Name, Icons, Theme Color
### Web Components
 
Zwei eigene Web Components:
1. **Chat Component** – Echtzeit Chat Fenster einer Lerngruppe
2. **IndexCard Component** – Karteikarte mit Frage/Antwort, Tags, Dateianhängen
---
 
## Klassendiagramm Übersicht
 
### Entitäten
 
| Klasse | Beschreibung |
|---|---|
| `User` | Account, Name, Email |
| `Passkey` | WebAuthn Credential pro Gerät |
| `OAuthAccount` | Google OAuth Account |
| `Mitgliedschaft` | Verbindung User ↔ Lerngruppe mit Rolle |
| `Lerngruppe` | Team mit Chat und Karteikarten |
| `Chat` | Chat einer Lerngruppe |
| `Nachricht` | Einzelne Chat-Nachricht |
| `Karteikarte` | Frage, Antwort, Tags, Stats |
| `KarteikarteStat` | Statistik pro Karte+Gruppe und pro Karte+User |
| `Dateianhang` | Datei an einer Karteikarte |
| `Deck` | 20 Karteikarten für einen Run |
| `Handkarten` | 5 gezogene Karten während eines Kampfes |
| `Run` | Ein Dungeon-Run eines Users |
| `Map` | Die (hardcoded) Karte mit Feldern |
| `Feld` | Abstrakt – Start, Normal, Kampf, Heil |
| `Kampf` | Zustand eines einzelnen Kampfes |
| `Gegner` | Abstrakt – Normal oder Boss |
| `Historie` | Alle Runs eines Users |
 
### Enums
 
```
Rolle:    ADMIN | MODERATOR | MEMBER
KampfTyp: NORMAL | BOSS (→ NormalerGegner / BossGegner Klassen)
```
 
### Services
 
| Service | Aufgabe |
|---|---|
| `StatistikService` | Aggregiert User-Statistiken über alle Runs |
| `RanglistenService` | Berechnet Rangliste einer Lerngruppe |
| `ServiceWorker` | PWA Cache-Strategie |
| `OfflineStorageService` | IndexedDB Lese/Schreib-Operationen |
 
---
 
## SQL Schema
 
### Tabellen
 
```
user              – id, name, email, created_at
passkey           – id, user_id, credential_id, public_key (Base64), counter, device_name
oauth_account     – id, user_id, provider, provider_user_id, access_token, refresh_token
webauthn_challenge – id, user_id (nullable), challenge, type (REGISTRATION|AUTHENTICATION), expires_at
study_group       – id, name, chat_id (MongoDB Ref), created_at
membership        – user_id, study_group_id, role, joined_at  [PK: user_id + study_group_id]
map               – id, name
field             – id, map_id, position, type, enemy_id
enemy             – id, name, type, base_health, base_damage
run               – id, user_id, study_group_id, map_id, successful, start_time, duration, hit_rate, current_position
```
 
### Wichtige Hinweise
 
- `user` in Anführungszeichen da reserviertes Wort in PostgreSQL
- `field.enemy_id` ist nullable – nur FIGHT und BOSS Felder haben einen Gegner
- `run.successful` ist nullable – `NULL` = Run läuft noch, `true/false` = beendet
- `study_group.chat_id` ist eine UUID Referenz auf ein MongoDB Dokument (kein FK)
- `role` und `field_type` und `enemy_type` sind PostgreSQL ENUMs
- `webauthn_challenge.user_id` ist nullable – beim Login (AUTHENTICATION) ist der User noch nicht bekannt
- `passkey.public_key` wird als Base64-String gespeichert (Uint8Array → Base64 beim Speichern, Base64 → Uint8Array beim Lesen)
### Schema einlesen
 
```bash
docker compose up -d
# Schema wird automatisch beim ersten Start eingespielt via:
# ./schema/schema.sql → /docker-entrypoint-initdb.d/schema.sql
```
 
---
 
## MongoDB Schema
 
### Collection: `indexcards`
 
```javascript
{
  _id: UUID,
  study_group_id: UUID,       // → SQL study_group.id
  creator_id: UUID,           // → SQL user.id
  question: String,
  answer: String,
  tags: [String],
  created_at: Date,
  updated_at: Date,
 
  attachments: [{
    _id: UUID,
    filename: String,
    file_path: String,
    mime_type: String,
    size_in_bytes: Number,
    uploaded_at: Date,
    uploaded_by: UUID         // → SQL user.id
  }],
 
  group_stats: [{
    study_group_id: UUID,
    total_attempts: Number,
    correct_answers: Number
    // difficulty = correct_answers / total_attempts (immer berechnet, nie gespeichert)
  }],
 
  user_stats: [{
    user_id: UUID,
    total_attempts: Number,
    correct_answers: Number,
    last_seen_at: Date
  }]
}
```
 
### Collection: `messages`
 
```javascript
{
  _id: UUID,
  chat_id: UUID,              // → SQL study_group.chat_id
  sender_id: UUID,            // → SQL user.id
  content: String,
  sent_at: Date
}
```
 
### Empfohlene Indexes
 
```javascript
db.indexcards.createIndex({ study_group_id: 1 })
db.indexcards.createIndex({ study_group_id: 1, tags: 1 })
db.messages.createIndex({ chat_id: 1, sent_at: -1 })
```
 
---
 
## GraphQL Schema Übersicht
 
### Queries
 
| Query | Beschreibung |
|---|---|
| `getStudyGroup(id)` | Gruppe mit Mitgliedern |
| `getIndexCards(studyGroupId, tags?, search?, creatorId?)` | Karteikarten gefiltert |
| `getIndexCard(id)` | Einzelne Karte mit Stats |
| `getRanking(studyGroupId)` | Rangliste der Gruppe |
| `getRuns(userId)` | Run-Historie eines Users |
| `getMap` | Die hardcoded Map mit Feldern |
 
### Mutations
 
| Mutation | Beschreibung |
|---|---|
| `createStudyGroup(name)` | Neue Lerngruppe |
| `joinStudyGroup(studyGroupId)` | Gruppe beitreten |
| `leaveStudyGroup(studyGroupId)` | Gruppe verlassen |
| `createIndexCard(...)` | Karteikarte erstellen |
| `updateIndexCard(...)` | Karteikarte bearbeiten |
| `deleteIndexCard(id)` | Karteikarte löschen |
| `startRun(studyGroupId)` | Run starten |
| `endRun(runId)` | Run beenden |
| `answerCard(runId, cardId, userAnswer)` | Karte beantworten (case-insensitive, trimmed) |
| `sendMessage(chatId, content)` | Chat-Nachricht senden |
 
### Subscriptions
 
| Subscription | Beschreibung |
|---|---|
| `onNewMessage(chatId)` | Neue Chat-Nachricht |
| `onRunUpdated(runId)` | Run-Status Änderung |
| `onIndexCardCreated(studyGroupId)` | Neue Karteikarte in Gruppe |
 
### `answerCard` Rückgabe
 
```graphql
type AnswerResult {
  correct:       Boolean!   # richtig oder falsch
  damageDealt:   Int!       # Schaden wenn richtig (= Schwierigkeitsgrad der Karte)
  correctAnswer: String!    # wird immer zurückgegeben für Frontend-Anzeige
}
```
 
---
 
## REST Endpunkte Übersicht
 
### Authentication
 
| Method | Endpunkt | Beschreibung |
|---|---|---|
| GET | `/api/v1/auth/google` | Google OAuth starten |
| GET | `/api/v1/auth/google/callback` | OAuth Callback → JWT |
| POST | `/api/v1/auth/passkey/user` | User anlegen oder finden (für Passkey-Registrierung) |
| POST | `/api/v1/auth/passkey/register/options` | WebAuthn Registrierungsoptionen |
| POST | `/api/v1/auth/passkey/register/verify` | Passkey speichern |
| POST | `/api/v1/auth/passkey/login/options` | WebAuthn Login-Optionen |
| POST | `/api/v1/auth/passkey/login/verify` | Passkey verifizieren → JWT |
| DELETE | `/api/v1/auth/passkey/:id` | Passkey entfernen |
 
### Files
 
| Method | Endpunkt | Beschreibung |
|---|---|---|
| POST | `/api/v1/index-cards/:cardId/attachments` | Datei hochladen |
| GET | `/api/v1/index-cards/:cardId/attachments` | Alle Anhänge auflisten |
| GET | `/api/v1/index-cards/:cardId/attachments/:id` | Datei herunterladen |
| DELETE | `/api/v1/index-cards/:cardId/attachments/:id` | Datei löschen |
 
### Infrastructure
 
| Method | Endpunkt | Beschreibung |
|---|---|---|
| GET | `/api/v1/health` | Health Check |
| GET | `/api/docs` | Swagger UI |
 
---
 
## Ordnerstruktur
 
```
WebTechFinaleAbgabe/
├── .gitignore
├── backend/
│   ├── .env                          # nicht im Repo!
│   ├── docs/
│   │   ├── openapi.yaml              # REST Dokumentation
│   │   ├── docker-compose.yml
│   │   └── env.example
│   ├── schema/
│   │   ├── schema.sql                # PostgreSQL Schema
│   │   ├── mongodb_schema.js         # MongoDB Dokumentation
│   │   └── schema.graphql            # GraphQL Schema
│   ├── src/
│   │   ├── app.js                    # Einstiegspunkt
│   │   ├── config/
│   │   │   ├── db.postgres.js
│   │   │   └── db.mongo.js
│   │   ├── api/rest/
│   │   │   ├── routes/
│   │   │   │   ├── auth.routes.js
│   │   │   │   └── file.routes.js
│   │   │   ├── controllers/
│   │   │   │   ├── auth.controller.js
│   │   │   │   └── file.controller.js
│   │   │   └── middleware/
│   │   │       ├── auth.middleware.js
│   │   │       ├── role.middleware.js
│   │   │       └── upload.middleware.js
│   │   ├── graphql/
│   │   │   ├── context.js
│   │   │   └── resolvers/
│   │   │       ├── studyGroup.resolver.js
│   │   │       ├── indexCard.resolver.js
│   │   │       ├── run.resolver.js
│   │   │       ├── chat.resolver.js
│   │   │       └── ranking.resolver.js
│   │   ├── services/
│   │   │   ├── auth/
│   │   │   │   ├── oauth.service.js
│   │   │   │   ├── passkey.service.js
│   │   │   │   └── token.service.js
│   │   │   ├── studyGroup.service.js
│   │   │   ├── indexCard.service.js
│   │   │   ├── file.service.js
│   │   │   ├── run.service.js
│   │   │   ├── combat.service.js
│   │   │   ├── chat.service.js
│   │   │   ├── ranking.service.js
│   │   │   └── statistics.service.js
│   │   ├── models/
│   │   │   ├── sql/
│   │   │   │   ├── user.model.js
│   │   │   │   ├── passkey.model.js
│   │   │   │   ├── oauth.model.js
│   │   │   │   ├── studyGroup.model.js
│   │   │   │   ├── membership.model.js
│   │   │   │   ├── map.model.js
│   │   │   │   ├── field.model.js
│   │   │   │   ├── enemy.model.js
│   │   │   │   └── run.model.js
│   │   │   └── mongo/
│   │   │       ├── indexCard.model.js
│   │   │       └── message.model.js
│   │   └── realtime/
│   │       ├── websocket.js
│   │       └── handlers/
│   │           └── chat.handler.js
│   └── uploads/
└── frontend/
    └── ...
```
 
---
 
## Wichtige Konventionen
 
### Benennung
- Dateien: `camelCase.js` (z.B. `indexCard.service.js`)
- Klassen: `PascalCase`
- Variablen/Funktionen: `camelCase`
- Datenbank-Spalten: `snake_case`
- GraphQL Felder: `camelCase`
### Architektur Pattern
```
Route/Resolver → Controller/Resolver → Service → Model → Datenbank
```
Controller und Resolver rufen **nur Services** auf – nie direkt die Datenbank.
 
### Auth
- JWT Token kommt im Header: `Authorization: Bearer <token>`
- `authMiddleware` verifiziert Token und hängt `req.user` ans Request
- GraphQL Context bekommt den User über `createContext({ token })`
- **Google OAuth Callback:** JWT wird als Query-Parameter ans Frontend übergeben: `FRONTEND_URL/auth/callback?token=eyJ...`
  - Frontend liest Token aus URL: `new URLSearchParams(window.location.search).get('token')`
  - Frontend speichert Token und navigiert zur Hauptseite
### Antwortvergleich (answerCard)
```javascript
answer.toLowerCase().trim() === userAnswer.toLowerCase().trim()
```
 
---
 
## npm Packages
 
```bash
npm install express @apollo/server @as-integrations/express5 @graphql-tools/schema graphql-ws ws cors dotenv swagger-ui-express yamljs mongoose pg multer jsonwebtoken @simplewebauthn/server @simplewebauthn/browser google-auth-library
```
 
---
 
## Starten
 
```bash
# 1. Datenbanken starten
docker compose -f docs/docker-compose.yml up -d
 
# 2. Dependencies installieren
npm install
 
# 3. .env anlegen
cp docs/env.example .env
# .env mit echten Werten befüllen
 
# 4. Backend starten
node src/app.js
# oder mit nodemon:
npx nodemon src/app.js
```
 
Erreichbar unter:
- GraphQL: `http://localhost:3000/graphql`
- Swagger: `http://localhost:3000/api/docs`
- Health:  `http://localhost:3000/api/v1/health`
---
 
## TODOs / Offene Punkte
 
- [x] `env.js` in `src/config/` anlegen
- [x] Auth Middleware implementieren (JWT Token Middleware)
- [x] Passkey Registration + Login implementieren
- [x] Google OAuth implementieren
- [x] Refactoring: `mapRow` Pattern konsistent in allen SQL-Models einführen (`passkey.model.js`, `webauthnChallenge.model.js`)
- [ ] Frontend Vue 3 Struktur aufsetzen
- [ ] GraphQL Resolvers implementieren
- [ ] Services implementieren
- [ ] Mongoose Models anlegen
- [ ] Service Worker + Web App Manifest
- [ ] IndexedDB Offline Storage
- [ ] Tests schreiben
- [ ] README.md für Abgabe
- [ ] Reflexion schreiben (inkl. JWT-in-URL Sicherheitsbedenken)
- [ ] Präsentation erstellen
