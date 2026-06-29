const request = require('supertest');
const WebSocket = require('ws');
const http = require('http');
const app = require('../app');
const db = require('../db');
const { setupWebSocket } = require('../chat');

let server;
let port;
let WS_URL;
const TIMEOUT = 5000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

jest.setTimeout(10000);

describe('WebSocket Realtime Chat', () => {
  let testTodo;

  beforeAll(async () => {
    await db.initializeDatabase();

    server = http.createServer(app);
    setupWebSocket(server);

    await new Promise((resolve) => {
      server.listen(0, resolve);
    });

    port = server.address().port;
    WS_URL = `ws://127.0.0.1:${port}`;
  });

  beforeEach(async () => {
    await db.query('TRUNCATE TABLE chat_messages RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE todos RESTART IDENTITY CASCADE');

    const response = await request(app)
      .post('/todos')
      .send({ title: 'WS Test Todo', priority: 1 });

    testTodo = response.body;
  });

  afterAll(async () => {
    await db.query('TRUNCATE TABLE chat_messages RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE todos RESTART IDENTITY CASCADE');
    await db.pool.end();

    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  it('broadcastet Nachrichten an alle Clients im selben Todo-Raum', async () => {
    const a = new WebSocket(WS_URL);
    const b = new WebSocket(WS_URL);

    let aReady = false;
    let bReady = false;
    let receivedByB = false;

    a.on('open', () => {
      a.send(JSON.stringify({ type: 'join', todoId: testTodo.id }));
      aReady = true;
    });

    b.on('open', () => {
      b.send(JSON.stringify({ type: 'join', todoId: testTodo.id }));
      bReady = true;
    });

    b.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'message' && data.message?.username === 'TesterA') {
        receivedByB = true;
      }
    });

    a.on('error', (error) => {
      throw error;
    });

    b.on('error', (error) => {
      throw error;
    });

    const start = Date.now();
    while (!(aReady && bReady) && Date.now() - start < TIMEOUT) {
      await wait(50);
    }

    expect(aReady).toBe(true);
    expect(bReady).toBe(true);

    a.send(
      JSON.stringify({
        type: 'message',
        todoId: testTodo.id,
        username: 'TesterA',
        message: 'Hallo von A',
      })
    );

    const start2 = Date.now();
    while (!receivedByB && Date.now() - start2 < TIMEOUT) {
      await wait(50);
    }

    expect(receivedByB).toBe(true);

    a.close();
    b.close();
  });
});