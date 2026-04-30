# Todo-App - WebTech Projekt

Dies ist eine voll funktionsfähige Full-Stack Todo-Anwendung, die im Rahmen des Web-Technologie-Kurses entwickelt wurde. Sie besteht aus einem Node.js/Express-Backend mit einer PostgreSQL-Datenbank und einem Vanilla-JS-Frontend.

## Features

* **Backend:**
  * RESTful API zum Erstellen, Lesen, Aktualisieren und Löschen (CRUD) von Todos.
  * Datenbank-Anbindung an PostgreSQL.
  * Dynamische Filterung (Suche) und Sortierung (nach Priorität, Fälligkeitsdatum, Titel).
  * Automatisierte API-Tests mit Jest und Supertest.
* **Frontend:**
  * Benutzeroberfläche zum Verwalten von Todos.
  * Erstellen, Bearbeiten, Löschen und als "erledigt" markieren von Todos direkt im UI.
  * Live-Suche und Sortierung der angezeigten Todos.
* **API-Dokumentation:**
  * Vollständige OpenAPI 3.0 Spezifikation.
  * Interaktive Swagger-UI zur direkten Interaktion mit der API.

---

## Installation & Start

### 1. Repository klonen

```bash
git clone https://github.com/elisabeth-gdt/WebTech.git
cd WebTech
```

### 2. Backend einrichten und starten

Das Backend verwendet Docker, um eine PostgreSQL-Datenbank zu starten.

```bash
# Ins Backend-Verzeichnis wechseln
cd backend

# Abhängigkeiten installieren
npm install

# Docker-Container für die Datenbank starten (-d für "detached mode")
docker compose up -d

# Backend-Server starten (stellt die API auf Port 3000 bereit)
npm start
```

Das Backend läuft nun auf `http://localhost:3000`.

### 3. Frontend starten

Das Frontend ist eine einfache HTML/CSS/JS-Anwendung. Sie können die `index.html` direkt im Browser öffnen. Für eine realistischere Umgebung wird die Verwendung eines Live-Servers empfohlen.

* **Mit VS Code und der "Live Server"-Extension:**
    1. Öffnen Sie das `frontend`-Verzeichnis in VS Code.
    2. Klicken Sie mit der rechten Maustaste auf die Datei `index.html`.
    3. Wählen Sie "Open with Live Server".

* **Ohne Live Server:**
  * Öffnen Sie die Datei `frontend/index.html` einfach per Doppelklick in Ihrem Webbrowser.

Die Anwendung ist nun in Ihrem Browser verfügbar (typischerweise unter `http://127.0.0.1:5500` bei Verwendung von Live Server).

---

## API-Dokumentation

Die API ist nach dem OpenAPI 3.0 Standard spezifiziert.

* **Spezifikations-Datei:** Die rohe YAML-Datei befindet sich unter `backend/docs/openapi.yaml`.
* **Interaktive Swagger-UI:** Nachdem das Backend gestartet wurde, können Sie die interaktive Dokumentation unter folgender URL aufrufen:
  * [http://localhost:3000/docs](http://localhost:3000/docs)

---

## Testen

* **Test-Datei:** Die Test-Datei befindet sich unter `backend/todo/test.js`.

Die Backend-API ist mit automatisierten Tests abgedeckt.

**Tests ausführen:**

1. Stellen Sie sicher, dass Sie sich im `backend`-Verzeichnis befinden.
2. Führen Sie den folgenden Befehl aus:

```bash
npm test
```

Jest wird alle Test-Suites ausführen und einen Bericht über die erfolgreichen und fehlgeschlagenen Tests ausgeben.
