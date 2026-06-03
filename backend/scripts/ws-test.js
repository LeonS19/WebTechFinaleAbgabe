// scripts/ws-test.js
// Realtime (WebSocket) integration test for the Todo-App
// Dependencies: ws, node-fetch
const WebSocket = require('ws');
const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000/todos';
const WS_URL = 'ws://localhost:3000';
const TIMEOUT = 5000;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  try {
    // 1) Erzeuge ein Test-Todo
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'ws-test-todo', priority: 1 })
    });
    if (!res.ok) throw new Error('Todo create failed: ' + res.status);
    const todo = await res.json();
    const todoId = todo.id;
    console.log('Created todo id=', todoId);

    // 2) Verbinde zwei WebSocket-Clients
    const a = new WebSocket(WS_URL);
    const b = new WebSocket(WS_URL);

    let aReady=false, bReady=false;
    let bReceivedMessage = false;

    a.on('open', () => {
      a.send(JSON.stringify({ type: 'join', todoId }));
      aReady = true;
      console.log('[A] open');
    });

    b.on('open', () => {
      b.send(JSON.stringify({ type: 'join', todoId }));
      bReady = true;
      console.log('[B] open');
    });

    b.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'message' && data.message && data.message.username === 'TesterA') {
          bReceivedMessage = true;
          console.log('[B] received broadcast from A:', data.message.message);
        }
      } catch (e) {}
    });

    // Wait until both are ready (or timeout)
    const start = Date.now();
    while (!(aReady && bReady) && (Date.now() - start) < TIMEOUT) { await wait(50); }

    if (!(aReady && bReady)) throw new Error('WebSocket clients did not connect in time');

    // 3) Sende Nachricht von A
    a.send(JSON.stringify({ type: 'message', todoId, username: 'TesterA', message: 'Hallo von A' }));

    // 4) Warte auf Broadcast
    const start2 = Date.now();
    while (!bReceivedMessage && (Date.now() - start2) < TIMEOUT) { await wait(50); }

    a.close(); b.close();

    if (!bReceivedMessage) {
      console.error('B hat die Nachricht nicht erhalten — Test fehlgeschlagen');
      process.exit(2);
    }

    console.log('WebSocket broadcast test: OK');
    process.exit(0);
  } catch (err) {
    console.error('Fehler im WS-Test:', err);
    process.exit(1);
  }
})();
