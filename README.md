# Todo-App – WebTech Projekt (Abgabe 3 - REST)

Dies ist eine Full-Stack Todo-Anwendung mit Realtime-Chat und PWA-Funktionalität. Das Projekt besteht aus einem Node.js/Express-Backend mit PostgreSQL sowie einem Vanilla-JavaScript-Frontend.

Gruppe:
Elmo

Repo:
```bash
git clone https://github.com/elisabeth-gdt/WebTech.git
cd WebTech
git checkout Abgabe3_REST
```
---

## Funktionen

* CRUD für Todos
* Suche, Filter und Sortierung der Todos
* Realtime-Chat pro Todo über WebSockets
* PWA-Unterstützung über Manifest und Service Worker
* Automatisierte Tests für REST-, WebSocket- und PWA-Funktionen

---

## Projektarchitektur

architekturDiagramm.png

## Projektstruktur

```text
WebTech/
├── backend/
│   ├── attachment/
│   │   ├── index.js          # Dateianhang-Router (multer)
│   │   └── model.js          # Dateianhang-Datenbankoperationen
│   ├── docs/
│   │   └── openapi.yaml      # OpenAPI-Spezifikation
│   ├── scripts/
│   │   ├── pwa-check.test.js # PWA-Tests
│   │   └── ws.test.js        # WebSocket-Tests
│   ├── todo/
│   │   ├── controller.js     # Todo-Geschäftslogik
│   │   ├── index.js          # Todo-Router
│   │   ├── model.js          # Todo-Datenbankoperationen
│   │   └── test.js           # REST-Tests
│   ├── uploads/              # Hochgeladene Dateien
│   ├── app.js                # Express-Server + WebSocket-Setup
│   ├── chat.js               # WebSocket-Logik & Chat-Räume
│   ├── db.js                 # PostgreSQL-Verbindung
│   └── swagger.js            # Swagger-Konfiguration
│
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── js/
│   │   ├── components/
│   │   │   ├── todo-card.js        # Web Component 
│   │   │   ├── chat-window.js      # Web Component 
│   │   │   └── attachment-list.js  # Web Component 
│   │   ├── db.js                   # IndexedDB-Hilfsfunktionen
│   │   └── script.js               # Haupt-Frontend-Logik
│   ├── index.html
│   ├── manifest.json               # PWA Web App Manifest
│   └── service-worker.js           # Service Worker (Caching & Offline)
│
├── architekturDiagramm.mmd         # Architekturdiagramm (Mermaid)
├── architekturDiagramm.png         # Architekturdiagramm (PNG)
├── compose.yaml                    # Docker Compose für PostgreSQL
└── README.md
```

### Backend

* Express-Server
* REST-API für Todos
* WebSocket-Chat
* PostgreSQL-Anbindung
* Automatisierte Tests

### Frontend

* HTML, CSS und JavaScript
* PWA-Manifest
* Service Worker
* UI-Logik für Todos und Chat

---

## Installation

### Voraussetzungen

* Node.js
* npm
* PostgreSQL
* Optional: Docker für den Datenbankbetrieb

### Backend einrichten

```bash
cd backend
npm install
```

### Datenbank starten

```bash
docker-compose up -d
```

### Backend starten

```bash
npm start
```

Das Backend läuft anschließend unter:

```text
http://localhost:3000
```

### Frontend starten

Beispielsweise mit einem lokalen HTTP-Server:

```bash
cd frontend
npx http-server .
```

Danach ist die Anwendung erreichbar unter:

```text
http://localhost:8080/frontend/
```

---

## Nutzung

* Neue Todos können über das Formular angelegt werden.
* Todos können bearbeitet, als erledigt markiert und gelöscht werden.
* Über den Chat-Button wird der Realtime-Chat zu einem Todo geöffnet.
* Nachrichten werden live an alle verbundenen Clients im selben Todo-Raum gesendet.

---

## Tests

### REST-Tests

Die REST-Tests prüfen die Todo-API.

```bash
npm test
```

### WebSocket-Tests

Die WebSocket-Tests prüfen die Realtime-Kommunikation.

```bash
npm run test:ws
```

### PWA-Tests

Die PWA-Tests prüfen Service Worker, Cache und Offline-Verhalten.

```bash
npm run test:pwa
```

---

# Technische Dokumentation

## Architekturüberblick

Die Anwendung ist in drei Hauptschichten aufgebaut:

### Frontend

Eine Vanilla-JavaScript-Oberfläche in `frontend/`, die:

* Todos rendert
* Benutzereingaben verarbeitet
* den Realtime-Chat öffnet

### Backend

Ein Express-Server in `backend/app.js`, der:

* REST-Endpunkte für Todos bereitstellt
* den WebSocket-Server initialisiert
* Datenbankzugriffe verwaltet

### Datenbank

PostgreSQL speichert:

* Todos
* Chat-Nachrichten

dauerhaft und konsistent.

### Ablauf

1. Das Frontend lädt Todos per REST-API.
2. Änderungen an Todos werden über die API an das Backend gesendet.
3. Der Chat verbindet sich per WebSocket mit dem Server.
4. Nachrichten werden gespeichert und live an alle Clients im gleichen Todo-Raum verteilt.

---

## Rolle von WebSockets

WebSockets werden für den Realtime-Chat pro Todo verwendet.

### Funktionsweise

* Jeder Client sendet eine `join`-Nachricht mit einer `todoId`.
* Der Server verwaltet Räume für jedes Todo.
* Nachrichten werden nur an Clients desselben Raums übertragen.

### Vorteile

* Nachrichten erscheinen ohne Seitenreload.
* Mehrere Nutzer sehen denselben Chat in Echtzeit.
* Die Chat-Historie kann beim Beitritt geladen werden.

---

## Eingesetzte PWA-Technologien

Die Anwendung verwendet folgende Progressive-Web-App-Technologien:

### Web App Manifest

Datei:

```text
frontend/manifest.json
```

Definiert:

* App-Name
* Icons
* Start-URL
* Anzeigeverhalten

### Service Worker

Datei:

```text
frontend/service-worker.js
```

Aufgaben:

* Caching der App-Shell
* Offline-Unterstützung
* Laden gecachter Ressourcen

### Cache API

Wird verwendet für:

* HTML-Dateien
* CSS-Dateien
* JavaScript-Dateien
* Icons
* Manifest-Dateien
* optional API-Antworten

Dadurch bleibt die Anwendung auch bei fehlender Netzwerkverbindung teilweise nutzbar.

---

## Verwendete Browser-Persistenz

Es werden zwei Persistenzschichten eingesetzt:

### Cache API (Service Worker)
Gecacht werden die App-Shell-Dateien (HTML, CSS, JS, Icons, Manifest) sowie
erfolgreiche GET-Antworten der REST-API, damit sie offline verfügbar bleiben.

### IndexedDB
Für strukturierte lokale Datenhaltung wird IndexedDB über die `idb`-Bibliothek
verwendet. Gespeichert werden:

| Daten | Grund |
|---|---|
| **Todos** | Offline-Lesezugriff auf zuletzt geladene Todos |
| **Chat-Nachrichten** | Offline-Lesezugriff auf zuletzt geladene Nachrichten pro Todo |

Bei vorhandener Verbindung werden Daten vom Server geladen und direkt lokal
gespeichert. Bei fehlender Verbindung werden die lokal gespeicherten Daten
angezeigt. Schreiboperationen sind offline nicht möglich – der Nutzer wird
darüber informiert.

---

## Beschreibung der entwickelten Web Components

## Beschreibung der entwickelten Web Components

Es wurden drei eigene Custom Elements implementiert, alle ohne Shadow DOM,
sodass sie die globalen CSS-Styles erben.

### `<todo-card>`
Stellt einen einzelnen Todo-Eintrag dar. Erhält alle Todo-Daten als HTML-Attribute
und feuert Custom Events (`todo-delete`, `todo-complete`, `todo-edit`) nach oben,
die in `script.js` behandelt werden. Enthält `<chat-window>` und
`<attachment-list>` als Kind-Komponenten.

### `<chat-window>`
Kapselt den gesamten Chat-Bereich eines Todos. Verwaltet die WebSocket-Verbindung
selbstständig (`connect()`, `disconnect()`, `toggle()`). Speichert eingehende
Nachrichten in IndexedDB und zeigt bei Offline-Status lokal gespeicherte
Nachrichten an.

### `<attachment-list>`
Zeigt alle Dateianhänge eines Todos an und ermöglicht Upload (via `multer`),
Download und Löschen. Lädt die Anhänge beim Öffnen automatisch vom Server.

---

## Wichtige Dateien

| Datei                               | Beschreibung             |
| ----------------------------------- | ------------------------ |
| `backend/app.js`                    | Hauptserver und REST-API |
| `backend/chat.js`                   | WebSocket-Logik          |
| `backend/db.js`                     | Datenbankanbindung       |
| `backend/todo/test.js`              | REST-Tests               |
| `backend/scripts/ws.test.js`        | WebSocket-Tests          |
| `backend/scripts/pwa-check.test.js` | PWA-Tests                |
| `frontend/index.html`               | Benutzeroberfläche       |
| `frontend/script.js`                | Frontend-Logik           |
| `frontend/service-worker.js`        | Service Worker           |
| `frontend/manifest.json`            | PWA-Manifest             |

---

## API-Dokumentation

Die OpenAPI-Spezifikation befindet sich unter:

```text
backend/docs/openapi.yaml
```

Die Swagger-UI ist nach dem Start des Backends erreichbar unter:

```text
http://localhost:3000/docs
```

Dort können sämtliche REST-Endpunkte interaktiv getestet und dokumentiert eingesehen werden.
