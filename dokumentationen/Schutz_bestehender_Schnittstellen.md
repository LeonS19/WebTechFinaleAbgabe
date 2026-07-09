# Technische Dokumentation: Schutz bestehender Schnittstellen

## 1. Überblick

Die Anwendung hat vier unterschiedliche Kommunikationskanäle, die jeweils eigene Authentifizierungs-Mechanismen brauchen, weil JWT nicht überall auf die gleiche Weise übertragen werden kann:

| Kanal | Transportweg des JWT | Geprüft in |
| --- | --- | --- |
| REST | HTTP-Header `Authorization: Bearer <token>` | `auth.middleware.js` |
| GraphQL Query/Mutation | HTTP-Header `Authorization: Bearer <token>` | `context.js` |
| GraphQL Subscription | `connectionParams` beim WebSocket-Handshake | `context.js`, aufgerufen aus `app.js` |
| Chat-WebSocket | Im Payload der ersten `join`-Nachricht | `chat.handler.js` |
| Datei-Upload/-Download | HTTP-Header, wie REST | `auth.middleware.js` + `permission.service.js` in `file.service.js` |

Dieses Dokument ergänzt die Rollen- und Rechtekonzept-Doku um die Kanäle, die **keinen** klassischen HTTP-Header nutzen können (WebSockets), sowie um die Details des Datei-Uploads.

## 2. REST und GraphQL Query/Mutation (Wiederholung mit Fokus Transportweg)

Beide senden das Token im selben Format über einen normalen HTTP-Request:

```text
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

- REST: `auth.middleware.js` bricht bei fehlendem/ungültigem Token hart mit `401` ab, bevor der Controller überhaupt erreicht wird.
- GraphQL: `context.js` liefert bei fehlendem/ungültigem Token lediglich `{ user: null }`; jeder Resolver muss selbst prüfen (siehe Rollen-Rechtekonzept-Doku, Abschnitt 3.2). Details zur Rollenprüfung selbst: siehe dortige Doku, Abschnitt 4.

## 3. GraphQL Subscriptions: Auth beim WebSocket-Handshake

Da eine dauerhafte WebSocket-Verbindung keinen HTTP-Header pro Nachricht mitschickt, übernimmt `graphql-ws` die Auth stattdessen einmalig beim Verbindungsaufbau über `connectionParams`.

**Frontend** (`main.js`):

```js
const wsLink = new GraphQLWsLink(createClient({
  url: 'ws://localhost:3000/graphql',
  connectionParams: () => ({
    authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  }),
}))
```

**Backend** (`app.js`):

```js
const wsServerCleanup = useServer(
  {
    schema,
    context: async (ctx) => {
      const token = ctx.connectionParams?.authorization?.replace('Bearer ', '')
      return createContext({ token })
    },
  },
  wsServer,
)
```

Der Server ruft dieselbe `createContext()`-Funktion auf wie beim normalen GraphQL-Endpunkt, die Subscriptions bekommen also denselben `context.user` wie Queries/Mutations, nur dass das Token einmalig beim Verbindungsaufbau statt pro Nachricht übergeben wird. Die eigentliche Rollenprüfung (z. B. ist der User Mitglied der Lerngruppe, deren `onMembersUpdated` er abonniert) findet in den `subscribe`-Resolvern über `withFilter` statt. Dort wird aber nur nach `studyGroupId` gefiltert, nicht ob der anfragende User überhaupt Mitglied dieser Gruppe ist (siehe Abschnitt 6, bekannte Lücke).

## 4. Chat-WebSocket: Auth ohne HTTP-Header

Der Chat verwendet einen rohen WebSocket ohne `graphql-ws`, daher gibt es keinen automatischen Handshake-Mechanismus wie bei Subscriptions. Stattdessen wird das Token als Teil der ersten Anwendungsnachricht übertragen.

### 4.1 Ablauf

```mermaid
sequenceDiagram
    participant Client as ChatWindowElement.js
    participant WS as chat.handler.js
    participant Token as token.service.js
    participant DB as PostgreSQL

    Client->>WS: WebSocket Verbindung oeffnen (ws://.../chat)
    Client->>WS: type join, token, chatId

    WS->>Token: verifyToken(token)
    alt Token ungueltig
        Token--xWS: wirft Fehler
        WS-->>Client: type error, message
    else Token gueltig
        Token-->>WS: payload mit userId
        WS->>DB: findById(userId)
        alt User nicht gefunden
            WS-->>Client: type error, message
        else User gefunden
            WS->>WS: Verbindung dem chatRooms Set fuer chatId hinzufuegen
        end
    end

    Note over Client,WS: Erst nach erfolgreichem join sind message/delete moeglich

    Client->>WS: type message, content
    WS->>WS: pruefen currentUser und currentChatId gesetzt
    WS-->>Client: type message an alle Clients im Room
```

### 4.2 Code-Ausschnitt (`chat.handler.js`)

```js
if (data.type === 'join') {
  currentUser = verifyToken(data.token)
  currentChatId = data.chatId
  const user = await findById(currentUser.userId)
  if (!user) {
    throw new Error("User nicht gefunden")
  }
  currentUserName = user.name
  if (!chatRooms.has(currentChatId)) {
    chatRooms.set(currentChatId, new Set())
  }
  chatRooms.get(currentChatId).add(ws)
}

if (data.type === 'message') {
  if (!currentUser) throw new Error('Nicht eingeloggt')
  if (!currentChatId) throw new Error('keinem Chat beigetreten')
  // ...
}
```

`message` und `delete` prüfen jeweils, ob zuvor erfolgreich `join` durchlaufen wurde (`currentUser`/`currentChatId` gesetzt). Ohne gültigen `join`-Schritt lässt sich keine Nachricht senden oder löschen. Zusätzlich rufen die dahinterliegenden Service-Funktionen `saveMessage()` und `deleteMessage()` (in `chat.service.js`) bei jeder einzelnen Aktion erneut `checkPermission()` auf. Der `join`-Schritt selbst prüft mittlerweile ebenfalls die Mitgliedschaft (siehe Abschnitt 4.3), sodass an keiner Stelle im Chat-Ablauf mehr eine ungeprüfte Rollen-/Mitgliedschaftsannahme besteht:

```js
// chat.service.js
export async function saveMessage(chatId, senderId, content) {
  const studyGroup = await findByChatId(chatId)
  if (!studyGroup) throw new Error('Lerngruppe nicht gefunden')
  await checkPermission(senderId, studyGroup.id, ['ADMIN', 'MODERATOR', 'MEMBER'])
  return await Message.create({ chat_id: chatId, sender_id: senderId, content })
}
```

### 4.3 Rollenprüfung beim Chat-Beitritt

Anders als ursprünglich umgesetzt, prüft `join` mittlerweile ebenfalls, ob der User Mitglied der Lerngruppe ist, zu der die `chatId` gehört: Nach der Token-Verifizierung ruft `chat.handler.js` `verifyChatMembership(chatId, userId)` aus `chat.service.js` auf, das intern `findByChatId()` und `checkPermission()` nutzt, also dieselbe Funktion, die auch `saveMessage()`/`deleteMessage()` verwenden:

```js
export async function verifyChatMembership(chatId, userId) {
  const studyGroup = await findByChatId(chatId)
  if (!studyGroup) throw new Error('Lerngruppe nicht gefunden')
  await checkPermission(userId, studyGroup.id, ['ADMIN', 'MODERATOR', 'MEMBER'])
}
```

Ist der User kein Mitglied der Gruppe, schlägt `join` fehl und der Client erhält `type: 'error'`, ohne dass die Verbindung dem `chatRooms`-Set hinzugefügt wird. Damit ist auch das passive Mitlesen (wie es in früheren Projektständen der Fall war) nicht mehr möglich, nicht nur das Schreiben.

## 5. Datei-Upload/-Download: Middleware und Berechtigungen

### 5.1 Multer-Konfiguration (`upload.middleware.js`)

```js
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
})

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
})
```

- Dateigröße wird über `MAX_FILE_SIZE_MB` aus der `.env` begrenzt.
- Dateiname wird mit einem Zeitstempel-Präfix versehen (`Date.now()-originalname`), um Namenskollisionen bei gleichzeitigen Uploads zu vermeiden.
- Speicherort ist ein lokaler, fester Ordner (`./uploads`), außerhalb des über HTTP direkt erreichbaren Bereichs. Downloads laufen ausschließlich über den REST-Endpunkt, nicht über einen direkten Datei-URL-Zugriff.

### 5.2 Zusammenspiel mit Rollenprüfung

Die Multer-Middleware selbst prüft keine Berechtigungen, sie ist rein technisch (Parsen von `multipart/form-data`, Größenlimit). Die eigentliche Autorisierung passiert danach in `file.service.js` über `checkPermission()`, wie in der Rollen-Rechtekonzept-Doku beschrieben (Abschnitt 4.1: Upload/Löschen erfordert `ADMIN`/`MODERATOR`, Lesen erlaubt zusätzlich `MEMBER`).

Reihenfolge einer Upload-Anfrage:

```text
Request → auth.middleware.js (JWT prüfen) → upload.middleware.js (Datei parsen, Größe prüfen) → file.controller.js → file.service.js (checkPermission)
```

## 6. Bekannte Lücken im Schutz der Schnittstellen

- **Subscriptions filtern nur nach `studyGroupId`, nicht nach Mitgliedschaft**: `withFilter` in den Resolvern (siehe `studyGroup.resolver.js`, `indexCard.resolver.js`) prüft, ob die `studyGroupId` im Event mit der abonnierten übereinstimmt, aber nicht, ob der abonnierende `context.user` tatsächlich Mitglied dieser Gruppe ist. Ein authentifizierter, aber gruppenfremder Nutzer könnte theoretisch Events einer fremden Lerngruppe empfangen, wenn er deren ID kennt.
