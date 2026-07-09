import { httpServer } from '../src/app.js';
import { pool } from '../src/config/db.postgres.js';
import { connectMongo } from '../src/config/db.mongo.js';
import WebSocket from 'ws';
import crypto from 'crypto';

let testUserId, testToken, testStudyGroupId, testChatId;
let serverPort;
const openSockets = [];

function createChatSocket() {
  const ws = new WebSocket(`ws://localhost:${serverPort}/chat`);
  openSockets.push(ws);
  return ws;
}

function waitForMessage(ws, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout: keine Nachricht erhalten')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()));
    });
  });
}

beforeAll(async () => {
  await connectMongo();
  const { generateToken } = await import('../src/services/auth/token.service.js');

  const userResult = await pool.query(
    'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
    ['Jest WS User', `jest-ws-${Date.now()}@example.com`],
  );
  testUserId = userResult.rows[0].id;
  testToken = generateToken({ userId: testUserId });

  testChatId = crypto.randomUUID();
  const groupResult = await pool.query(
    'INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING id',
    ['Jest WS Gruppe', testChatId],
  );
  testStudyGroupId = groupResult.rows[0].id;

  await pool.query(
    'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
    [testUserId, testStudyGroupId, 'ADMIN'],
  );

  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      serverPort = httpServer.address().port;
      resolve();
    });
  });
});

afterAll(async () => {
  openSockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  });
  await pool.query('DELETE FROM membership WHERE study_group_id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM study_group WHERE id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM "user" WHERE id = $1', [testUserId]);
  await pool.end();
  await new Promise((resolve) => httpServer.close(resolve));
}, 15000);

describe('Chat WebSocket', () => {
    it('verbindet sich, joint einen Chat, und kann eine Nachricht senden/empfangen', async () => {
    const ws = createChatSocket();
    await new Promise((resolve) => ws.once('open', resolve));

    const receivedMessages = [];
    ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
    });

    ws.send(JSON.stringify({ type: 'join', token: testToken, chatId: testChatId }));
    await new Promise((resolve) => setTimeout(resolve, 300)); // etwas mehr Puffer

    ws.send(JSON.stringify({ type: 'message', content: 'Jest Testnachricht' }));
    await new Promise((resolve) => setTimeout(resolve, 300));

    console.log('Alle empfangenen Nachrichten:', JSON.stringify(receivedMessages, null, 2));

    const messageResponse = receivedMessages.find((m) => m.type === 'message');
    expect(messageResponse).toBeDefined();
    expect(messageResponse.message.content).toBe('Jest Testnachricht');

    ws.close();
    });

  it('lehnt Nachricht ohne vorherigen join ab', async () => {
    const ws = createChatSocket();
    await new Promise((resolve) => ws.once('open', resolve));

    ws.send(JSON.stringify({ type: 'message', content: 'Sollte fehlschlagen' }));
    const response = await waitForMessage(ws);

    expect(response.type).toBe('error');
    expect(response.message).toMatch(/nicht eingeloggt|keinem Chat/i);

    ws.close();
  });
});

describe('Chat WebSocket: Nachrichten löschen', () => {
  it('erlaubt ADMIN das Löschen einer Nachricht, broadcastet an alle Clients', async () => {
    const senderWs = createChatSocket();
    await new Promise((resolve) => senderWs.once('open', resolve));

    const senderMessages = [];
    senderWs.on('message', (data) => senderMessages.push(JSON.parse(data.toString())));

    senderWs.send(JSON.stringify({ type: 'join', token: testToken, chatId: testChatId }));
    await new Promise((resolve) => setTimeout(resolve, 200));

    senderWs.send(JSON.stringify({ type: 'message', content: 'Wird gleich gelöscht' }));
    await new Promise((resolve) => setTimeout(resolve, 200));

    const savedMessage = senderMessages.find((m) => m.type === 'message');
    expect(savedMessage).toBeDefined();
    const messageId = savedMessage.message.id;

    // Zweiter Client im selben Chat, um den Broadcast zu prüfen
    const observerWs = createChatSocket();
    await new Promise((resolve) => observerWs.once('open', resolve));
    const observerMessages = [];
    observerWs.on('message', (data) => observerMessages.push(JSON.parse(data.toString())));
    observerWs.send(JSON.stringify({ type: 'join', token: testToken, chatId: testChatId }));
    await new Promise((resolve) => setTimeout(resolve, 200));

    senderWs.send(JSON.stringify({ type: 'delete', messageId }));
    await new Promise((resolve) => setTimeout(resolve, 300));

    const deleteEventAtSender = senderMessages.find((m) => m.type === 'delete');
    const deleteEventAtObserver = observerMessages.find((m) => m.type === 'delete');

    expect(deleteEventAtSender).toBeDefined();
    expect(deleteEventAtSender.messageId).toBe(messageId);
    expect(deleteEventAtObserver).toBeDefined();
    expect(deleteEventAtObserver.messageId).toBe(messageId);

    senderWs.close();
    observerWs.close();
  });

  it('lehnt Löschen durch einfaches MEMBER ab', async () => {
    // Zweiten User als MEMBER anlegen
    const { generateToken } = await import('../src/services/auth/token.service.js');
    const memberResult = await pool.query(
      'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
      ['Jest WS Member', `jest-ws-member-${Date.now()}@example.com`],
    );
    const memberUserId = memberResult.rows[0].id;
    const memberToken = generateToken({ userId: memberUserId });
    await pool.query(
      'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
      [memberUserId, testStudyGroupId, 'MEMBER'],
    );

    // Admin sendet eine Nachricht
    const adminWs = createChatSocket();
    await new Promise((resolve) => adminWs.once('open', resolve));
    const adminMessages = [];
    adminWs.on('message', (data) => adminMessages.push(JSON.parse(data.toString())));
    adminWs.send(JSON.stringify({ type: 'join', token: testToken, chatId: testChatId }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    adminWs.send(JSON.stringify({ type: 'message', content: 'Darf nicht gelöscht werden' }));
    await new Promise((resolve) => setTimeout(resolve, 200));

    const messageId = adminMessages.find((m) => m.type === 'message').message.id;

    // MEMBER versucht zu löschen
    const memberWs = createChatSocket();
    await new Promise((resolve) => memberWs.once('open', resolve));
    const memberMessages = [];
    memberWs.on('message', (data) => memberMessages.push(JSON.parse(data.toString())));
    memberWs.send(JSON.stringify({ type: 'join', token: memberToken, chatId: testChatId }));
    await new Promise((resolve) => setTimeout(resolve, 200));

    memberWs.send(JSON.stringify({ type: 'delete', messageId }));
    await new Promise((resolve) => setTimeout(resolve, 300));

    const errorResponse = memberMessages.find((m) => m.type === 'error');
    expect(errorResponse).toBeDefined();
    expect(errorResponse.message).toMatch(/berechtigung|admin|moderator/i);

    adminWs.close();
    memberWs.close();
    await pool.query('DELETE FROM membership WHERE user_id = $1', [memberUserId]);
    await pool.query('DELETE FROM "user" WHERE id = $1', [memberUserId]);
  });
});