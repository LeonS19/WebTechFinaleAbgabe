# WebTech Finale Abgabe — Kollaborative Lernplattform mit RPG-Gameplay Gruppe: elmo (Elisabeth Gehdt, Leon Schäfer)

Eine kollaborative Lernplattform: Nutzer schreiben Karteikarten, lernen gemeinsam in Lerngruppen und kämpfen in Dungeon-Runs gegen Gegner, das korrekte Beantworten von Karteikarten verursacht Schaden.

## Inhaltsverzeichnis

- [Voraussetzungen](#voraussetzungen)
- [Installation](#installation)
- [Technologiestack](#technologiestack)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Anwendung starten](#anwendung-starten)
- [Testdaten / Demo-Lerngruppe](#testdaten--demo-lerngruppe)
- [Nutzung](#nutzung)
- [Testen](#testen)
- [API-Dokumentation](#api-dokumentation)
- [Weitere Dokumentation](#weitere-dokumentation)

## Voraussetzungen

- Node.js
- npm
- Docker + Docker Compose (für PostgreSQL und MongoDB)
- Ein Google Cloud Projekt mit OAuth-Client (für Google Login) siehe [Umgebungsvariablen](#umgebungsvariablen)

## Installation

```bash
git clone https://github.com/LeonS19/WebTechFinaleAbgabe.git
cd WebTechFinaleAbgabe
```

### Backend

Eine fertig befüllte `.env` liegt der Abgabe bei. Einfach nach `backend/.env` kopieren, dann kann dieser Abschnitt übersprungen werden. Davor aber die Backend-Dependencies installieren:

```bash
cd backend
npm install
```

Falls die `.env` neu angelegt werden muss:

```bash
cd backend
npm install
cp docs/env.example .env
```

`docs/env.example` enthält nur Platzhalter-Werte, die `.env` muss danach mit echten Werten befüllt werden, siehe [Umgebungsvariablen](#umgebungsvariablen).

### Frontend

```bash
cd frontend
npm install
```


## Technologiestack

| Bereich | Technologie |
|---|---|
| Backend | Node.js + Express.js |
| GraphQL | Apollo Server 5 |
| REST | Express Router |
| Realtime | WebSockets (ws + graphql-ws) |
| Frontend | Vue 3 |
| SQL-Datenbank | PostgreSQL 16 (Docker) |
| Dokumentenorientierte DB | MongoDB 7 (Docker) |
| Auth | Passkeys (WebAuthn) + Google OAuth |
| PWA | Service Worker + Web App Manifest + IndexedDB |

## Umgebungsvariablen

Die `.env` liegt im `backend/`-Ordner und wird **nicht** mit ins Repo eingecheckt. Folgende Variablen müssen gesetzt sein:

| Variable | Beschreibung |
|---|---|
| `PORT` | Port des Backend-Servers (Standard: `3000`) |
| `FRONTEND_URL` | URL des Frontend-Dev-Servers, z.B. `http://localhost:5173` wird für OAuth-Redirects benötigt |
| `JWT_SECRET` | Geheimer Schlüssel zum Signieren der JWTs |
| `DATABASE_URL` | PostgreSQL Connection String |
| `MONGODB_URI` | MongoDB Connection String |
| `GOOGLE_CLIENT_ID` | Client-ID aus der Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Client-Secret aus der Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | Muss exakt mit der in der Google Cloud Console hinterlegten Redirect-URI übereinstimmen, z.B. `http://localhost:3000/api/v1/auth/google/callback` |

**Google OAuth einrichten:**
1. In der [Google Cloud Console](https://console.cloud.google.com) unter *APIs & Services → Credentials* einen OAuth 2.0 Client (Typ „Webanwendung") anlegen.
2. Unter *Authorized redirect URIs* die o.g. `GOOGLE_CALLBACK_URL` eintragen.
3. Client-ID und Client-Secret in die `.env` übernehmen.

⚠️ Ohne befüllte `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` schlägt der Google-Login mit `Error 401: invalid_client` fehl. Passkey-Login funktioniert unabhängig davon.

## Anwendung starten

### 1. Datenbanken starten

```bash
cd backend
docker compose -f docs/docker-compose.yml up -d
```

Das PostgreSQL-Schema wird beim ersten Start automatisch eingespielt (`schema/schema.sql`).

### 2. Backend starten

```bash
cd backend
npm run dev
```

Erreichbar unter:
- GraphQL: `http://localhost:3000/graphql`
- Swagger UI: `http://localhost:3000/api/docs`
- Health Check: `http://localhost:3000/api/v1/health`

### 3. Frontend starten

```bash
cd frontend
npm run dev
```

Erreichbar unter `http://localhost:5173`.

## Testdaten / Demo-Lerngruppe

Es gibt keine festen Test-Zugangsdaten (Login läuft ausschließlich über echten Google OAuth oder eine selbst registrierte Passkey-Identität). Stattdessen kann eine Demo-Lerngruppe mit Beispieldaten (Karteikarten, Stats, etc.) über ein Seed-Skript erzeugt werden:

```bash
cd backend
npm run seed:demo
```

Damit lässt sich die Anwendung sofort mit realistischen Daten ausprobieren, ohne manuell Karteikarten anlegen zu müssen.

## Nutzung

1. Frontend öffnen (`http://localhost:5173`)
2. Registrieren/Anmelden via Google OAuth oder Passkey
3. Einer bestehenden Lerngruppe beitreten (z.B. der per `seed:demo` erzeugten) oder eine neue erstellen
4. Karteikarten anlegen, bearbeiten, taggen, kommentieren
5. Einen Dungeon-Run starten und Karteikarten im Kampf beantworten

## Testen

```bash
cd backend
npm test
```

Testet REST-Endpunkte, GraphQL Queries/Mutations, WebSocket-/Subscription-Kommunikation, Datei-Upload, Login/Logout sowie rollen- und rechtebasierte Zugriffe. Details siehe technische Dokumentation.

## API-Dokumentation

- REST: [`docs/openapi.yaml`](./docs/openapi.yaml), interaktiv unter `http://localhost:3000/api/docs`
- GraphQL: [`schema/schema.graphql`](./schema/schema.graphql)

## Weitere Dokumentation

- Architektur, Datenmodell, Rollen-/Rechtekonzept: siehe technische Dokumentation
- Reflexion der Architekturentscheidungen: siehe Reflexion