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
- `run` (inkl. Spieler-Fortschritt: Level, HP, Position, Antwort-Statistik)

**MongoDB** – flexible, dokumentenorientierte Daten:
- `indexcards` – Karteikarten mit eingebetteten Tags, Dateianhängen und Stats
- `maps` – die (hardcoded) Karte mit eingebetteten Feldern und Gegnern
- `combats` – Zustand eines einzelnen, laufenden Kampfes
- `run_decks` – Deck/Ablagestapel eines Runs (persistiert über mehrere Kämpfe hinweg)
- `messages` – Chat-Nachrichten

**Begründung:** Karteikarten haben variable Inhalte (Tags als Array, eingebettete Stats pro Gruppe und pro User, Dateianhänge) → MongoDB. Die Map wurde bewusst nach MongoDB verschoben (ursprünglich als SQL-Tabellen `map`/`field`/`enemy` geplant): für zukünftige Random-Map-Generierung ist MongoDB flexibler, verschachtelte Strukturen (Felder mit eingebetteten Gegnern, Koordinaten, `nextFields`) sind dort natürlicher abzubilden, ohne mehrere SQL-Tabellen mit Fremdschlüsseln aufzublähen. `combats` und `run_decks` sind ebenfalls verschachtelte, kurzlebige Zustandsobjekte (Handkarten-Arrays, eingebettetes Gegner-Objekt) – passen ebenfalls besser zu MongoDBs Dokumentmodell als zu starren SQL-Tabellen.

`run` selbst bleibt in SQL, weil es klare 1:1/1:n-Beziehungen zu `user` und `study_group` hat (Fremdschlüssel) und aus einfachen skalaren Werten besteht (kein verschachteltes Array/Objekt) – auch der laufende Spieler-Zustand (Level, HP, Position) gehört fachlich untrennbar zum Run-Datensatz und wird deshalb nicht in eine separate `Player`-Tabelle/Collection ausgelagert (siehe Abschnitt "Player-Modellierung").
 
### REST vs GraphQL
 
**REST** wird nur für:
- Auth (OAuth Redirect, Passkey Registration/Login)
- Datei-Upload / Download (Multipart Form Data)
- Health Check

**GraphQL** für alles andere:
- Alle CRUD Operationen
- Flexible Abfragen (Filter, Suche)
- Echtzeit via Subscriptions (mit einer bewussten Ausnahme, siehe unten)

**Sonderfall Chat:** Live-Chat-Nachrichten (senden, empfangen, löschen) laufen **nicht** über GraphQL Mutations/Subscriptions, sondern über einen eigenen, rohen WebSocket-Endpunkt (`ws://.../chat`, siehe `chat.handler.js`). Grund: der Chat war technisch zuerst als eigenständiges WebSocket-Feature umgesetzt, bevor der Rest der Anwendung auf GraphQL vereinheitlicht wurde — eine spätere Migration auf GraphQL Subscriptions hätte keinen fachlichen Mehrwert gebracht und wurde aus Zeitgründen nicht mehr nachgezogen. Das **historische Laden** älterer Nachrichten (`getMessages`, Pagination via `before`-Cursor) läuft dagegen ganz normal über eine GraphQL Query, da das nicht latenzkritisch ist. Die WebSocket-Nachrichtenformate sind: `{ type: 'join' | 'message' | 'delete' | 'error', ... }`. Das GraphQL-Schema enthält deshalb bewusst **kein** `sendMessage`-Mutation-Feld und **keine** `onNewMessage`-Subscription — beide wurden versucht, aber nie vom Frontend genutzt und wieder entfernt, um kein totes/verwirrendes Schema stehen zu lassen.

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

`answerCard`/`moveToField`/`endRun` prüfen bewusst **nicht** zusätzlich `checkPermission`, sondern nur, ob der aufrufende User der Owner des jeweiligen Runs ist (`run.userId === userId`) – das ist ausreichend, weil man nur Mitglied der Lerngruppe sein konnte, wenn man den Run überhaupt erst starten durfte (Permission-Check läuft einmalig bei `startRun`).

### Dynamischer Schwierigkeitsgrad
 
Kein gespeichertes Attribut – wird immer berechnet:
```
schwierigkeitsgrad = correct_answers / total_attempts
```
Gespeichert werden nur Rohdaten in `group_stats` (eingebettet in MongoDB Karteikarte).
Zusätzlich `user_stats` pro Karteikarte für persönlichen Lernfortschritt.

**Cold-Start-Schutz:** Sowohl bei der Kartenschaden-Berechnung (Gruppen-Statistik) als auch bei der Deck-Priorisierung (User-Statistik) gilt: eine Karte mit weniger als 10 Beantwortungen wird noch nicht als "verlässlich schwer/leicht" eingestuft, um zu vermeiden, dass ein einzelner früher Versuch (z.B. 1x richtig beantwortet = 100% Erfolgsquote) die Bewertung verzerrt. Vor Erreichen der Schwelle wird ein neutraler Default-Wert verwendet.

### Schadensberechnung
 
- **Spieler → Gegner:** `schaden = round(kartenSchaden(1-5) * levelMultiplikator)`
  - `kartenSchaden` wird dynamisch aus der Gruppen-Statistik der Karte berechnet (`1 + (1 - difficulty) * 4`, gerundet), Cold-Start-Schutz ab 10 Versuchen (Default: 3)
  - `levelMultiplikator = 1 + (level - 1) * 0.8` — steigt mit dem Spieler-Level
  - Der Schaden derselben Karte kann sich **innerhalb eines Runs** ändern, da die Gruppen-Statistik durch jede neue Antwort (auch von anderen Gruppenmitgliedern) live aktualisiert wird – bewusste Design-Entscheidung, keine Fixierung pro Run.
- **Gegner → Spieler:** `schaden = enemy.base_damage` des aktuellen Kampf-Feldes, skaliert nach Spalten-Position auf der Map (`base_damage = x * 3`, `base_health = x * 30`) – je weiter im Run, desto mehr Schaden.
- **Boss** (Position 60, letzte Spalte): bewusst **hardcoded**, nicht formelbasiert (`base_health: 600`, `base_damage: 55`), da er als klarer Höhepunkt spürbar stärker als der letzte reguläre Gegner (Spalte 14: `420 HP`/`42 Schaden`) bleiben soll.

**Balancing-Historie (durch Playtesting entstanden, siehe Reflexion):**
- Ursprünglicher Level-Multiplikator (`+0.15`/Level) führte in Kombination mit linear wachsender Gegner-HP zu einem Teufelskreis aus sehr langen frühen Kämpfen und dadurch seltenen Level-Ups – auf `+0.8`/Level erhöht, um spürbare Progression zu gewährleisten.
- Gegner-`base_damage`-Formel von `x * 5` auf `x * 3` gesenkt, um die Fehlertoleranz im späteren Run-Verlauf zu erhöhen, ohne den Boss (der unabhängig davon hardcoded bleibt) zu entwerten.
- Die tatsächlich im Code verwendete Formel für `base_health`/`base_damage` war zwischenzeitlich `(x+1) * 30`/`(x+1) * 5` (Diskrepanz zur Doku) – wurde wieder auf die ursprünglich dokumentierte Formel `x * 30`/`x * 3` angeglichen, wodurch frühe Gegner (niedrige Spalten) spürbar leichter wurden.

### Level-Up-System

Nach jedem gewonnenen Kampf (Gegner-HP ≤ 0):
- `level += 1`
- `max_health` wird neu berechnet: `100 + (level - 1) * 20`
- `current_health` bleibt **prozentual** erhalten (nicht absolut): `current_health_neu = round(max_health_neu * (current_health_alt / max_health_alt))` – ein Level-Up bei niedrigem HP-Stand heilt also nicht künstlich auf, sondern skaliert den bestehenden Prozentsatz auf die neue Maximalgrenze.
- Kein automatisches Voll-Heal – Heilung passiert nur über `HEAL`-Felder oder die Perfekt-Runden-Belohnung (s.u.).

### Kampfsystem (Karten-Zug-Mechanik)

Jeder Kampf läuft rundenbasiert ab, Spieler zuerst:
1. Spieler zieht (zu Kampfbeginn oder nach Reshuffle) bis zu 5 Handkarten aus dem Run-Deck.
2. Spieler spielt Handkarten einzeln nacheinander (`answerCard`). Drei Szenarien:
   - **Alle 5 Handkarten richtig beantwortet** ("perfekte Runde"): Belohnung = Heilung um 100% des aktuellen Gegner-Schadens. Zug endet danach automatisch (keine Handkarten mehr), Gegner greift an, nächste Runde werden sofort wieder 5 neue Karten gezogen.
   - **Letzte/einzige Handkarte richtig beantwortet, aber keine perfekte Runde** (z.B. nur noch 1 Karte übrig, richtig beantwortet): keine Heilung, kein Gegner-Schaden, aber **3 neue Karten** statt nur 1 — verhindert einen sonst entstehenden Limbo-Zustand, in dem man dauerhaft nur mit 1 Handkarte pro Zug weiterspielt.
   - **Spieler beendet den Zug freiwillig**, ohne alle Handkarten gespielt zu haben: keine Belohnung, Zug endet, Gegner greift an, nächste Runde wird nur 1 Karte nachgezogen (Resthand + 1 neue Karte, gedeckelt auf maximal 5 Handkarten insgesamt).
   - **Falsche Antwort**: Zug endet sofort (unabhängig vom Hand-Zustand), keine Belohnung, Gegner greift an, nächste Runde wird nur 1 Karte nachgezogen (auch wenn die Hand dadurch leer wurde — die 3-Karten-Regel gilt ausdrücklich nur bei richtiger Antwort).
3. Die "perfekte Runde"-Belohnung gilt nur, wenn die Runde mit **genau 5** Handkarten gestartet ist (nicht bei einer kleineren Resthand, die z.B. wegen eines fast leeren Decks entstanden ist).
4. **Deck-Nachschub:** Solange noch Karten im Deck sind, werden diese zuerst gezogen (auch wenn das bedeutet, dass eine neue Hand kleiner als 5 ist). Erst wenn **Deck UND Hand** gleichzeitig leer sind, wird der Ablagestapel gemischt und zurück ins Deck gelegt (Reshuffle). Die Reshuffle-Prüfung berücksichtigt dabei die tatsächlich benötigte Kartenanzahl (`ensureDeckHasCards`), nicht nur "Deck ist komplett leer" – sonst würde z.B. nach einer perfekten Runde (5 Karten sollen gezogen werden, aber nur noch 4 sind im Deck) kein Reshuffle ausgelöst und der Spieler bekäme nur 4 statt 5 Karten. `reshuffleDiscardIntoDeck` mischt außerdem etwaige verbleibende Deck-Karten *zusammen* mit dem Ablagestapel neu, statt sie zu überschreiben.
5. Wird der Gegner besiegt: Level-Up, verbleibende Handkarten wandern zurück ins Deck (nicht in den Ablagestapel). War es ein `BOSS`-Kampf, ist damit der gesamte Run erfolgreich beendet.
6. Sinkt die Spieler-HP auf 0: Run gilt als gescheitert (`successful = false`), verbleibende Handkarten wandern ebenfalls zurück ins Deck.
7. **Freiwilliger Zugabbruch (`endTurn`):** Der Spieler kann seinen Zug jederzeit beenden, ohne eine weitere Karte zu spielen (Szenario 2). Der Ablauf ist identisch zum normalen Zugende nach einer Antwort (Gegner greift an, nur 1 neue Karte wird nachgezogen, kein Perfekt-Bonus), nur dass keine Karte beantwortet/abgelegt wird.

### Deck-Zusammenstellung (`deckBuilder.service.js`)

Beim `startRun` werden bis zu 20 Karten aus dem Kartenpool der Lerngruppe für das Run-Deck ausgewählt (weniger, falls der Pool kleiner ist – Mindestanforderung: 5 Karten in der Lerngruppe). Die Auswahl ist **gewichtet nach individueller Lernschwäche**: Karten, die der User schlecht beantwortet (niedrige persönliche Erfolgsquote in `user_stats`), werden bevorzugt gezogen (gewichtetes Sampling ohne Zurücklegen). Auch hier greift der Cold-Start-Schutz (ab 10 Versuchen "verlässlich"), damit eine einzelne frühe Antwort nicht überproportional die Gewichtung verzerrt. Das Deck bleibt für die gesamte Dauer des Runs bestehen (über mehrere Kämpfe hinweg), nur der Ablagestapel und die aktuelle Hand ändern sich pro Kampf.

### HEAL-Felder

Betritt der Spieler ein `HEAL`-Feld (außerhalb eines Kampfes), wird er um 50% seiner `max_health` geheilt (geclampt, kann `max_health` nicht überschreiten).

### Player-Modellierung

Das ursprüngliche Klassendiagramm sah `Player` als eigenständige Entität mit eigenem Zustand vor. Da der Spieler-Zustand (Level, HP) 1:1 an einen laufenden `Run` gebunden ist und nie unabhängig davon existiert, wurde bewusst darauf verzichtet, eine eigene Tabelle/Collection dafür anzulegen – die Werte leben direkt in `run` (SQL). Im **GraphQL-Schema** gibt es trotzdem einen eigenen `Player`-Typ (Level, maxHealth, currentHealth) als reinen Value-Typ, der im Resolver aus den `run`-Feldern zusammengesetzt wird – das bildet die fachliche Trennung (Run-Metadaten vs. Spieler-Zustand) im API-Design ab, ohne eine zusätzliche Persistenzschicht zu benötigen.

### Rangliste
 
Kein eigenes Datenbankmodell – `RanglistenService` filtert direkt auf `run`:
- Nur `successful = true`
- Nur Runs von Mitgliedern der Lerngruppe
- Sortiert dreistufig: 1. `correctAnswers` (absolute Anzahl richtiger Antworten) DESC, 2. `hitRate` (Genauigkeit, berechnet aus `correctAnswers / totalAnswers`) DESC, 3. `duration` ASC

### PWA
 
**Service Worker & Cache-Strategie:** Umgesetzt über `vite-plugin-pwa` (Workbox-basiert) statt eines handgeschriebenen Service Workers – automatische App-Shell-Precaching, Versionierung/Cache-Busting bei neuen Builds. `runtimeCaching`-Regeln:
- **Cache First** für Datei-Anhänge (`GET /api/v1/index-cards/:id/attachments/:attachmentId`) – einmal hochgeladene Dateien ändern sich nie
- **Network First** für die Anhänge-Liste und den GraphQL-Endpunkt (`/graphql`) – aktuelle Daten haben Vorrang, mit Timeout-Fallback
- `devOptions.enabled: true` gesetzt, damit Manifest/Service Worker auch im Dev-Server (`npm run dev`, Port 5173) aktiv sind – ohne das wird der Service Worker teils nur im Produktions-Build (`npm run build && npm run preview`) injiziert, was beim Testen zu CORS-Problemen führen kann (Preview läuft auf einem anderen Port als `FRONTEND_URL` in der `.env`)

**Web App Manifest:** eigenes Icon-Set (Karteikarte mit gekreuzten Schwertern, passend zum Lern-+RPG-Konzept) in drei Größen (192px, 512px, 512px maskable), `display: standalone`, installierbar als eigenständige App.

**IndexedDB (`offlineStorage.service.js` + `apollo/offlineCacheLink.js`):** GraphQL-Antworten lassen sich nicht sinnvoll pauschal über Workbox cachen (Workbox unterscheidet nur nach URL/Methode, nicht nach GraphQL-Query-Inhalt) – deshalb eigener Layer:
- Ein zentraler Apollo Link (`offlineCacheLink`) fängt jede erfolgreiche Query-Response ab und schreibt die relevanten Felder automatisch in die passenden IndexedDB-Stores
- Object Stores: `study_groups` (inkl. eingebetteter `members`, per `patchStudyGroupMembers` nachträglich ergänzt, da `getStudyGroup` selbst keine Gruppen-Metadaten mitliefert), `indexcards` (indexiert nach `study_group_id`), `messages` (indexiert nach `chat_id`), `rankings` (ganzes Array pro Gruppe, da `RankingEntry` keinen eigenen Primärschlüssel hat)
- Lesender Zugriff über das Composable `useOfflineAwareQuery` – versucht zunächst die normale Apollo-Query, fällt bei Netzwerkfehler oder `navigator.onLine === false` automatisch auf den passenden IndexedDB-Store zurück; liefert zusätzlich `isOffline`/`error`, damit Views einen Hinweis anzeigen können
- **Scope-Grenze:** offline verfügbar sind nur bereits online besuchte Lerngruppen – eine neue Gruppe kann naturgemäß nicht offline zum ersten Mal geladen werden. Schreibaktionen, die einen Server-Request brauchen (Gruppe beitreten/erstellen, Run starten, Nachricht senden), werden bei fehlender Verbindung im Frontend blockiert und mit einem Hinweistext versehen, statt eine Aktion zu erlauben, die ohnehin fehlschlagen würde
- Die Chat-Web-Component (Vanilla Custom Element, kein Vue/Apollo) bindet denselben `offlineStorage.service.js` direkt an, da ihre Nachrichten über einen rohen `fetch()`-Call laufen, nicht über Apollo – der zentrale Link fängt das nicht automatisch ab

**Während der PWA-Integration gefundene und behobene Bugs** (nicht ursprünglich geplant, fielen beim Offline-Testen auf):
- Chat-Web-Component behielt beim Wechsel der Lerngruppe (neue `chat-id`) die alten Nachrichten im DOM/State und hängte die neuen nur an, statt den Zustand zurückzusetzen (`resetMessages()` ergänzt, vor jedem `connect()` aufgerufen)
- Chat reagierte nicht auf Browser-`online`/`offline`-Events, solange das Chatfenster bereits offen war – Reconnect/Status-Update passierte nur beim (Neu-)Öffnen (Event-Listener in `connectedCallback`/`disconnectedCallback` ergänzt)
- `useOfflineAwareQuery` hatte `ref(null)` als Default für Listen-Queries – bei einem Render, bevor die erste Antwort (online oder aus dem Cache) eintraf, hätte `liste.length` mit einem `TypeError` abstürzen können; auf `ref([])` korrigiert

### OfflineStorage / Reload-Robustheit
 
- `OfflineStorageService` – cached Lerngruppen (inkl. Mitglieder), Karteikarten, Chat-Nachrichten und Rangliste via IndexedDB; Runs/Historie sind vorgesehen, aber noch nicht angebunden (identisches Muster, TODO)
- `useOfflineAwareQuery` – Composable, das jede betroffene View einzeln einbindet (siehe oben)

### Web Components
 
Zwei eigene Web Components:
1. **Chat Component** – Echtzeit Chat Fenster einer Lerngruppe
2. **IndexCard Component** – Karteikarte mit Frage/Antwort, Tags, Dateianhängen

### Reload-Robustheit (`getActiveRun`)

Da Run- und Kampf-Zustand serverseitig persistiert werden (nicht nur im Frontend-State), kann das Frontend beim Mounten der `RunView` einmalig `getActiveRun(studyGroupId)` abfragen: Kommt `null` zurück, existiert kein aktiver Run (Startfeld-Auswahl anzeigen). Kommt ein `Run` zurück, wird `currentPosition` direkt übernommen; ist zusätzlich `Run.activeCombat` gesetzt, wechselt das Frontend sofort in die Kampfansicht statt die Map zu zeigen. Ein Seiten-Reload verliert dadurch keinen Fortschritt.

### Bekannte Einschränkungen (Scope-Cuts)

- **Nur ein Gegner pro Kampf** – `combat.enemy` ist aktuell ein einzelnes Objekt statt eines Arrays. Die Architektur wäre grundsätzlich auf mehrere Gegner erweiterbar, wurde aber aus Zeitgründen bewusst auf einen Gegner reduziert, um die Zug-Logik (Zielauswahl, Schadensverteilung, Sieg-Bedingung) nicht unnötig zu verkomplizieren.
- **Kämpfe sind rein solo** – kein gemeinsames Kämpfen mehrerer Gruppenmitglieder in Echtzeit, keine Subscription für den Kampf-Zustand nötig.

**Während der Frontend-Anbindung behobener Bug:** Die ursprüngliche Reshuffle-Prüfung (`ensureDeckNotEmpty`) prüfte nur "ist das Deck komplett leer", nicht "reicht die verbleibende Deck-Größe für die angeforderte Kartenanzahl". Bei einer perfekten Runde (5 Karten sollen gezogen werden, aber z.B. nur noch 4 im Deck) wurde dadurch fälschlich kein Reshuffle ausgelöst – der Spieler bekam dann nur 4 statt 5 Karten. Zusätzlich überschrieb `reshuffleDiscardIntoDeck` das `deck`-Array komplett mit dem gemischten Ablagestapel, statt eventuell noch vorhandene Deck-Karten mit einzubeziehen (potenzieller Datenverlust). Beide Stellen wurden korrigiert (`ensureDeckHasCards` prüft die benötigte Menge, Reshuffle mischt Deck+Discard zusammen).
 
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
| `Run` | Ein Dungeon-Run eines Users – enthält auch den Spieler-Zustand (Level, HP, Position) |
| `RunDeck` | Deck + Ablagestapel eines Runs (MongoDB, persistiert über mehrere Kämpfe) |
| `Combat` | Zustand eines einzelnen, laufenden Kampfes (Handkarten, Gegner-HP, wer am Zug ist) |
| `Map` | Die (hardcoded) Karte mit eingebetteten Feldern und Gegnern (MongoDB) |
| `Historie` | Alle Runs eines Users |

> Hinweis: `Deck`/`Handkarten` und `Player` aus dem ursprünglichen Klassendiagramm wurden zu `RunDeck`/`Combat.hand` bzw. in `run`-Felder + GraphQL-`Player`-Typ umgesetzt (siehe "Player-Modellierung" oben). `Feld`/`Gegner` sind keine eigenständigen Model-Klassen mehr, sondern eingebettete Sub-Dokumente innerhalb von `Map`.
 
### Enums
 
```
Rolle:      ADMIN | MODERATOR | MEMBER
FeldTyp:    START | NORMAL | FIGHT | BOSS | HEAL
GegnerTyp:  NORMAL | BOSS
KampfStatus: ACTIVE | WON | LOST
```
 
### Services
 
| Service | Aufgabe |
|---|---|
| `run.service.js` | Run starten/beenden, Feldbewegung, HEAL-Feld-Logik |
| `combat.service.js` | Kampf starten, Karten beantworten, Schaden/Heilung/Level-Up, Sieg/Niederlage |
| `deckBuilder.service.js` | Gewichtete Auswahl der 20 Run-Deck-Karten (Cold-Start-geschützt) |
| `runDeck.service.js` | Deck/Ablagestapel-Verwaltung (ziehen, ablegen, reshuffle) |
| `utils/playerStats.util.js` | Gemeinsame Kampf-Mathematik (heal, takeDamage, levelUp, damageMultiplier) – genutzt von `run.service.js` und `combat.service.js`, um zirkuläre Imports zu vermeiden |
| `RanglistenService` | Berechnet Rangliste einer Lerngruppe (dreistufige Sortierung), publisht `RANKING_UPDATED` bei jedem Run-Abschluss |
| `ServiceWorker` (`vite-plugin-pwa`) | PWA Cache-Strategie (Cache First für Anhänge, Network First für GraphQL/Anhänge-Liste) |
| `OfflineStorageService` (Frontend) | IndexedDB Lese/Schreib-Operationen (Study Groups, Karteikarten, Nachrichten, Rangliste) |
| `offlineCacheLink` (Frontend, Apollo Link) | Schreibt GraphQL-Query-Antworten automatisch in IndexedDB |
| `useOfflineAwareQuery` (Frontend, Composable) | Liest online über Apollo, fällt bei Netzwerkfehler/Offline auf IndexedDB zurück |
 
---
 
## SQL Schema
 
### Tabellen
 
```
user               – id, name, email, created_at
passkey            – id, user_id, credential_id, public_key (Base64), counter, device_name
oauth_account      – id, user_id, provider, provider_user_id, access_token, refresh_token
webauthn_challenge – id, user_id (nullable), challenge, type (REGISTRATION|AUTHENTICATION), expires_at
study_group        – id, name, chat_id (MongoDB Ref), created_at
membership         – user_id, study_group_id, role, joined_at  [PK: user_id + study_group_id]
run                – id, user_id, study_group_id, map_id, successful, start_time, duration,
                     correct_answers, total_answers, current_position, level, max_health, current_health
```
 
### Wichtige Hinweise
 
- `user` in Anführungszeichen da reserviertes Wort in PostgreSQL
- `run.successful` ist nullable – `NULL` = Run läuft noch, `true/false` = beendet
- `run.hit_rate` gibt es **nicht** als Spalte – wird immer live aus `correct_answers / total_answers` berechnet (analog zum Karten-`Schwierigkeitsgrad`-Prinzip), um keine redundanten/inkonsistenten Daten zu speichern
- `run.duration` wird in **Sekunden** gespeichert (nicht Minuten), um Rundungsverluste bei knappen Rangliste-Platzierungen zu vermeiden; Formatierung (z.B. `mm:ss`) übernimmt das Frontend
- `study_group.chat_id` ist eine UUID Referenz auf ein MongoDB Dokument (kein FK)
- `role` ist PostgreSQL ENUM
- `webauthn_challenge.user_id` ist nullable – beim Login (AUTHENTICATION) ist der User noch nicht bekannt
- `passkey.public_key` wird als Base64-String gespeichert (Uint8Array → Base64 beim Speichern, Base64 → Uint8Array beim Lesen)
- `map`, `field`, `enemy` existieren **nicht** als SQL-Tabellen (ursprünglich so geplant) – komplett nach MongoDB (`maps`-Collection) verschoben, siehe Architekturentscheidungen

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
    study_group_id: String,
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

### Collection: `maps`
 
```javascript
{
  _id: ObjectId,
  name: String,
  fields: [{
    position: Number,         // eindeutige Positions-Nummer (0-60)
    x: Number,                // Spalte (für Frontend-Darstellung)
    y: Number,                // Zeile (für Frontend-Darstellung)
    type: String,             // 'START' | 'NORMAL' | 'FIGHT' | 'BOSS' | 'HEAL'
    nextFields: [Number],     // erreichbare nächste Positionen (Pfeile)
    enemies: [{               // leer bei nicht-Kampf-Feldern, aktuell max. 1 Eintrag genutzt
      name: String,
      type: String,           // 'NORMAL' | 'BOSS'
      base_health: Number,    // x * 30
      base_damage: Number     // x * 5
    }]
  }]
}
```
 
**Damage-Skalierung:** `base_health = x * 30`, `base_damage = x * 5` — je weiter rechts (höhere x-Koordinate / Spalte), desto stärker der Gegner.
 
**Branching:** Spieler wählt aktiv welches `nextField` er betritt. Keine Rückwärtsbewegung.
 
**4 Startfelder** (Position 0-3) — Spieler wählt beim `startRun` den Einstiegspunkt (`selectedStartFieldPosition`).

### Collection: `combats`

```javascript
{
  _id: ObjectId,
  run_id: UUID,                     // → SQL run.id
  field_position: Number,           // welches Map-Feld den Kampf ausgelöst hat

  enemy: {
    name: String,
    type: String,                   // 'NORMAL' | 'BOSS'
    max_health: Number,
    current_health: Number,         // sinkt bei richtigen Antworten
    base_damage: Number
  },

  hand: [ObjectId],                 // Referenzen auf indexcards._id, max. 5 Karten
  turn_start_hand_size: Number,     // Hand-Größe zu Rundenbeginn (für "perfekte Runde"-Erkennung)
  is_player_turn: Boolean,
  status: String                    // 'ACTIVE' | 'WON' | 'LOST'
}
```

Kein `deck`/`discard_pile` in `combats` – die liegen separat in `run_decks`, weil sie über mehrere Kämpfe hinweg innerhalb eines Runs bestehen bleiben, während `combats` pro Kampf neu erstellt wird. Kein `timestamps`-Feld, da `combats` ein kurzlebiges, run-gebundenes Zustandsobjekt ist, für das keine eigenständige Zeithistorie gebraucht wird.

### Collection: `run_decks`

```javascript
{
  _id: ObjectId,
  run_id: UUID,                     // → SQL run.id
  deck: [ObjectId],                 // Referenzen auf indexcards._id
  discard_pile: [ObjectId]          // Referenzen auf indexcards._id
}
```

Ein Dokument pro Run, bleibt über mehrere Kämpfe hinweg bestehen. Wird beim `startRun` mit bis zu 20 gewichtet ausgewählten Karten befüllt (siehe `deckBuilder.service.js`).
 
### Empfohlene Indexes
 
```javascript
db.indexcards.createIndex({ study_group_id: 1 })
db.indexcards.createIndex({ study_group_id: 1, tags: 1 })
db.messages.createIndex({ chat_id: 1, sent_at: -1 })
db.combats.createIndex({ run_id: 1, status: 1 })
db.run_decks.createIndex({ run_id: 1 })
```
 
---
 
## GraphQL Schema Übersicht
 
### Queries
 
| Query | Beschreibung |
|---|---|
| `getStudyGroup(id)` | Gruppe mit Mitgliedern |
| `getIndexCards(studyGroupId, tags?, search?, creatorId?)` | Karteikarten gefiltert |
| `getIndexCard(id)` | Einzelne Karte mit Stats |
| `getRanking(studyGroupId)` | Rangliste der Gruppe (dreistufig sortiert) |
| `getRuns(userId)` | Run-Historie eines Users |
| `getActiveRun(studyGroupId)` | Aktueller aktiver Run des Users in dieser Gruppe (`null` falls keiner) – für Reload-Robustheit im Frontend |
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
| `startRun(studyGroupId, selectedStartFieldPosition)` | Run starten (mit gewähltem Startfeld) – gibt bestehenden aktiven Run zurück, falls schon einer läuft (idempotent) |
| `endRun(runId, successful)` | Run manuell beenden/abbrechen |
| `moveToField(runId, targetPosition)` | Zu einem erreichbaren Feld bewegen – löst je nach Feldtyp automatisch Kampf (`FIGHT`/`BOSS`) oder Heilung (`HEAL`) aus |
| `answerCard(runId, cardId, userAnswer)` | Karte im aktiven Kampf beantworten (case-insensitive, trimmed) |
| `endTurn(runId)` | Aktuellen Zug freiwillig beenden, ohne eine weitere Karte zu spielen |

Hinweis: Chat-Nachrichten senden/löschen laufen bewusst nicht über eine GraphQL-Mutation, sondern über den WebSocket-Handler (siehe "Sonderfall Chat" oben).
 
### Subscriptions
 
| Subscription | Beschreibung |
|---|---|
| `onRunUpdated(runId)` | Run-Status Änderung |
| `onIndexCardCreated(studyGroupId)` | Neue Karteikarte in Gruppe |
| `onIndexCardUpdated(studyGroupId)` | Karteikarte bearbeitet/Anhang hinzugefügt |
| `onIndexCardDeleted(studyGroupId)` | Karteikarte gelöscht (liefert nur die ID) |
| `onRankingUpdated(studyGroupId)` | Rangliste neu berechnet (nach jedem beendeten Run) |
| `onMembersUpdated(studyGroupId)` | Mitgliederliste geändert (Join/Leave/Kick/Rollenänderung) |
 
### `answerCard` Rückgabe
 
```graphql
type AnswerResult {
  correct:       Boolean!   # richtig oder falsch
  damageDealt:   Int!       # tatsächlich verursachter Schaden (Kartenschaden × Level-Multiplikator)
  correctAnswer: String!    # wird immer zurückgegeben für Frontend-Anzeige
  combat:        Combat!    # vollständiger aktualisierter Kampf-Zustand (neue Hand, Gegner-HP, Status)
  player:        Player!    # vollständiger aktualisierter Spieler-Zustand (HP, Level) nach diesem Zug
}
```

`combat`/`player` werden mitgeliefert, damit das Frontend nach jedem Zug (Gegenangriff, Perfekt-Heilung, Level-Up) den serverseitig bereits berechneten Zustand 1:1 übernehmen kann, statt ihn selbst anzunähern.

### `endTurn` Rückgabe

```graphql
type EndTurnResult {
  combat: Combat!   # aktualisierter Kampf-Zustand nach dem freiwilligen Zugende
  player: Player!   # aktualisierter Spieler-Zustand (Gegenangriff wurde angewendet)
}
```

### `moveToField` Rückgabe

```graphql
type MoveResult {
  run:    Run!      # aktualisierter Run-Zustand (neue Position, ggf. Heilung)
  combat: Combat     # nur befüllt, wenn das Zielfeld ein FIGHT/BOSS-Feld war
}
```

### `Combat.deckCount`

Zusätzliches Feld am `Combat`-Typ, das die Anzahl verbleibender Karten im Run-Deck zurückgibt (über `run_decks` nachgeschlagen). Dient dem Frontend als verlässliche Anzeige für den Deck-Stapel, statt die Anzahl lokal mitzuzählen (was nach einem Reshuffle sonst aus dem Sync laufen würde).
 
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
│   │   │   ├── env.js
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
│   │   │       ├── run.resolver.js   # inkl. Run/Map/Combat-Feld-Resolver
│   │   │       ├── chat.resolver.js
│   │   │       └── ranking.resolver.js
│   │   ├── services/
│   │   │   ├── auth/
│   │   │   │   ├── oauth.service.js
│   │   │   │   ├── passkey.service.js
│   │   │   │   └── token.service.js
│   │   │   ├── utils/
│   │   │   │   └── playerStats.util.js   # gemeinsame Kampf-Mathematik (heal, takeDamage, levelUp)
│   │   │   ├── permission.service.js
│   │   │   ├── studyGroup.service.js
│   │   │   ├── indexCard.service.js
│   │   │   ├── file.service.js
│   │   │   ├── map.service.js
│   │   │   ├── run.service.js
│   │   │   ├── combat.service.js
│   │   │   ├── deckBuilder.service.js    # gewichtete Deck-Zusammenstellung
│   │   │   ├── runDeck.service.js        # Deck/Ablagestapel-Verwaltung
│   │   │   ├── chat.service.js
│   │   │   ├── ranking.service.js
│   │   │   └── statistics.service.js
│   │   ├── models/
│   │   │   ├── sql/
│   │   │   │   ├── user.model.js
│   │   │   │   ├── passkey.model.js
│   │   │   │   ├── oauth.model.js
│   │   │   │   ├── webauthnChallenge.model.js
│   │   │   │   ├── studyGroup.model.js
│   │   │   │   ├── membership.model.js
│   │   │   │   └── run.model.js
│   │   │   └── mongo/
│   │   │       ├── indexCard.model.js
│   │   │       ├── message.model.js
│   │   │       ├── map.model.js
│   │   │       ├── combat.model.js
│   │   │       └── runDeck.model.js
│   │   ├── realtime/
│   │   │   ├── websocket.js
│   │   │   └── handlers/
│   │   │       └── chat.handler.js
│   │   └── scripts/
│   │       └── seedMap.js
│   └── uploads/
└── frontend/
    └── ...
```

> Hinweis: `models/sql/map.model.js`, `field.model.js`, `enemy.model.js` gab es in einer früheren Planungsphase – wurden komplett entfernt, da Map/Feld/Gegner ausschließlich in MongoDB leben (`models/mongo/map.model.js`).
 
---
 
## Wichtige Konventionen
 
### Benennung
- Dateien: `camelCase.js` (z.B. `indexCard.service.js`)
- Klassen: `PascalCase`
- Variablen/Funktionen: `camelCase`
- Datenbank-Spalten: `snake_case`
- GraphQL Felder: `camelCase`
- Mongoose-Feldresolver übersetzen `snake_case` (DB) ↔ `camelCase` (GraphQL) explizit im Resolver, wo kein automatisches Mapping greift (z.B. `Combat.isPlayerTurn`, `Run.player`)

### Architektur Pattern
```
Route/Resolver → Controller/Resolver → Service → Model → Datenbank
```
Controller und Resolver rufen **nur Services** auf – nie direkt die Datenbank. Bei MongoDB greifen Services aus Pragmatismus direkt auf die Mongoose-Models zu (kein zusätzlicher Repository-Layer), da Mongoose selbst schon die Abstraktionsebene zur Datenbank darstellt – konsistent gehandhabt in `chat.service.js`, `combat.service.js`, `runDeck.service.js`.

Services dürfen sich gegenseitig aufrufen, wenn fachliche Logik zusammengehört (z.B. `combat.service.js` nutzt `indexCard.service.js` für Statistik-Updates). Zirkuläre Imports zwischen zwei Services werden vermieden, indem gemeinsam genutzte, reine Berechnungsfunktionen (ohne Seiteneffekte) in eine neutrale Utility-Datei ausgelagert werden (`utils/playerStats.util.js`), statt dass sich zwei Services direkt gegenseitig importieren.

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

## Technische Notizen

### Manuelles WebSocket-Routing

Die `ws` Library hat einen bekannten Bug: wenn mehrere `WebSocketServer`-Instanzen mit der `path`-Option auf demselben `httpServer` registriert werden, überschreibt die zweite Instanz den `upgrade`-Event-Handler der ersten — einer der Server akzeptiert dann keine Verbindungen mehr (400 Bad Request). Gelöst mit `noServer: true` für beide Server (GraphQL Subscriptions + Chat) und manuellem Routing über den `upgrade`-Event des `httpServer`, wo anhand des URL-Pfads (`/graphql` vs. `/chat`) entschieden wird, welcher Server die Verbindung behandelt.

---

## Tests & Verifikation

### Automatisierte Backend-Tests (Jest + Supertest)

Setup: `npm test` (bzw. `npm run test:coverage` für den Coverage-Report). Tests laufen gegen die echte lokale Postgres-/MongoDB-Instanz (keine separate Test-DB) — jede Testdatei legt ihre eigenen Test-User/-Gruppen/-Runs an und räumt sie in `afterAll` wieder auf. Kein Mocking der Datenbank-Schicht, damit auch echte SQL-/Mongoose-Query-Fehler auffallen, nicht nur Business-Logik-Fehler.

| Testdatei | Deckt ab |
|---|---|
| `tests/health.test.js` | Health-Check-Endpunkt |
| `tests/auth.test.js` | Auth-Kantenfälle (fehlender/kaputter Token), Passkey-Vorbereitung (`passkey/user`, `register/options`, `login/options`), Passkey-Löschen inkl. Kantenfälle |
| `tests/token.test.js` | JWT-Generierung/-Verifikation, manipulierte/ungültige Tokens |
| `tests/permission.test.js` | Kernlogik der Rollen-/Rechteprüfung (`checkPermission`) für alle vier Rollen-Konstellationen |
| `tests/attachments.test.js` | Datei-Upload/-Download/-Löschen, Rollen-Einschränkungen (MEMBER darf nicht löschen), fremder User wird abgelehnt |
| `tests/chat.test.js` | `getMessages`-Query, `senderRole`-Feldresolver, Platzhalter für gelöschte User |
| `tests/websocket.test.js` | Chat-WebSocket: verbinden, Nachricht senden/empfangen, Nachricht löschen (inkl. Broadcast an mehrere Clients), Rollen-Einschränkung beim Löschen |
| `tests/graphql/studyGroup.test.js` | `createStudyGroup`, `joinStudyGroup`, `leaveStudyGroup` inkl. Kantenfälle |
| `tests/graphql/indexCard.test.js` | `createIndexCard`/`deleteIndexCard` Rollen-Einschränkungen, `getIndexCards`-Tag-Filter |
| `tests/graphql/run.test.js` | `getMap`, `startRun` (Mindest-Karten-Guard, Idempotenz), `moveToField`, `answerCard` |
| `tests/graphql/ranking.test.js` | Dreistufige Sortierung (`correctAnswers` → `hitRate` → `duration`) einzeln nachgewiesen, geteilte Plätze bei echtem Gleichstand (`RANK()`), Ausschluss gescheiterter Runs |

**Stand:** 62 Tests, alle grün. Coverage insgesamt ~55% (Statements), mit gezielt hoher Abdeckung in sicherheitskritischen Modulen (`permission.service.js`, `ranking.service.js`: 100%; alle Mongo-Models: 100%; `chat.handler.js`: 92%).

**Bewusst nicht automatisiert getestet:** Der eigentliche WebAuthn-Verify-Schritt (`register/verify`, `login/verify`) und der Google-OAuth-Callback lassen sich nicht sinnvoll mit Supertest simulieren, da sie einen echten Browser mit WebAuthn-Authenticator bzw. eine echte Google-Weiterleitung voraussetzen. Das schlägt sich in niedrigerer Coverage bei `passkey.service.js`/`oauth.service.js` nieder — der Login/Logout-Flow selbst wurde stattdessen wiederholt manuell über den Browser verifiziert.

### Offline-Verhalten (manuelle Verifikation statt automatisiertem Test)

Da Offline-Verhalten (Service Worker, IndexedDB) reines Browser-Verhalten ist und sich nicht sinnvoll mit den Backend-Testwerkzeugen (Jest/Supertest) abbilden lässt, wurde dieser Bereich manuell und wiederholt über Chrome DevTools verifiziert, statt einen browserbasierten Test (z.B. Puppeteer) aufzusetzen:

**Vorgehen:** Chrome DevTools → Tab *Application* → *Service Workers*, Häkchen bei „Offline" (bzw. Tab *Network* → Drosselung auf „Offline"), anschließend Reload bzw. Navigation innerhalb der App.

**Verifizierte Fälle:**
- App bleibt nach Offline-Schalten bedienbar, Navigation zwischen bereits besuchten Lerngruppen funktioniert weiterhin
- Karteikarten, Mitgliederliste und Rangliste einer zuvor online besuchten Gruppe werden weiterhin aus IndexedDB angezeigt (`useOfflineAwareQuery` fällt korrekt auf den Cache zurück)
- Chat zeigt die zuletzt geladenen Nachrichten weiterhin an, Status wechselt sichtbar auf „Offline"
- Schreibaktionen, die eine Verbindung brauchen (Lerngruppe beitreten/erstellen, Run starten), werden im Frontend blockiert und mit Hinweistext versehen, statt eine Aktion zuzulassen, die ohnehin fehlschlagen würde
- Beim Wiederherstellen der Verbindung (Häkchen entfernen) reconnected der Chat automatisch und lädt aktuelle Nachrichten nach
- Eine noch nie online besuchte Lerngruppe kann erwartungsgemäß nicht offline zum ersten Mal geladen werden (dokumentierte Scope-Grenze, siehe Abschnitt „PWA" oben)

Diese Fälle wurden während der PWA-Integration (Tag 6) mehrfach nach jeder Änderung erneut manuell durchgespielt, u. a. auch nachdem dabei zwei echte Bugs gefunden wurden (Chat-Nachrichten-Duplizierung beim Gruppenwechsel, `TypeError` bei `null`-Listen vor dem ersten Cache-Treffer — siehe Bugfix-Liste im PWA-Abschnitt).

---
 
## TODOs / Offene Punkte
 
- [x] `env.js` in `src/config/` anlegen
- [x] Auth Middleware implementieren (JWT Token Middleware)
- [x] Passkey Registration + Login implementieren
- [x] Google OAuth implementieren
- [x] Refactoring: `mapRow` Pattern konsistent in allen SQL-Models einführen (`passkey.model.js`, `webauthnChallenge.model.js`)
- [x] Run-Logik (start/end/Feldbewegung, inkl. HEAL-Felder)
- [x] Deck-Zusammenstellung (gewichtet, Cold-Start-geschützt)
- [x] Kampfsystem (`answerCard`, Schaden, Heilung, Level-Up, Sieg/Niederlage, Boss-Erkennung)
- [x] Karteikarten-Statistik-Update nach jeder Antwort
- [ ] Frontend Vue 3 Struktur aufsetzen
- [ ] Restliche GraphQL Resolvers implementieren (StudyGroup, IndexCard, Ranking, Chat)
- [ ] Restliche Services implementieren (statistics, ranking)
- [ ] Service Worker + Web App Manifest
- [ ] IndexedDB Offline Storage
- [x] Tests schreiben (Backend: Jest + Supertest, 62 Tests; Offline-Verhalten: dokumentierte manuelle Verifikation, siehe Abschnitt „Tests & Verifikation")
- [ ] README.md für Abgabe
- [ ] Reflexion schreiben (inkl. JWT-in-URL Sicherheitsbedenken, Scope-Cuts wie "nur 1 Gegner pro Kampf", Balancing-Historie, WebAuthn/OAuth nicht automatisiert testbar)
- [ ] Präsentation erstellen