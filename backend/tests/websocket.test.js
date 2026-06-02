const WebSocket = require('ws');
const http = require('http');
const { setupChatHandler } = require('../websocket/chatServer');
const Message = require('../models/Message');
const mongoose = require('mongoose');

let server;
let chatHandler;
const TEST_PORT = 9001;
const TEST_TODO_ID = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
const TEST_TODO_ID_2 = new mongoose.Types.ObjectId('607f1f77bcf86cd799439012');

beforeAll(async () => {
  // Datenbank verbinden
  await mongoose.connect('mongodb://root:root@localhost:27017/todos_test_ws', {
    authSource: 'admin'
  });

  // Alte Daten löschen
  await Message.deleteMany({});

  // Test-Server starten
  chatHandler = setupChatHandler();
  server = http.createServer();

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/chat') {
      chatHandler.handleUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  await new Promise(resolve => server.listen(TEST_PORT, resolve));
}, 15000);

afterAll(async () => {
  await new Promise(resolve => {
    server.close(() => resolve());
  });
  await Message.deleteMany({});
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
}, 15000);

afterEach(async () => {
  // Gründliche Bereinigung zwischen Tests
  await Message.deleteMany({});
  await new Promise(resolve => setTimeout(resolve, 200));
}, 10000);

// ============ REALTIME-TESTS ============

test('WebSocket-Verbindung erfolgreich aufgebaut und beendet', (done) => {
  const ws = new WebSocket(`ws://localhost:${TEST_PORT}/chat?todoId=${TEST_TODO_ID}`);

  ws.on('open', () => {
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  ws.on('close', () => {
    expect(ws.readyState).toBe(WebSocket.CLOSED);
    done();
  });

  ws.on('error', (err) => done(err));
}, 10000);

test('WebSocket-Verbindung wird abgelehnt ohne todoId', (done) => {
  const ws = new WebSocket(`ws://localhost:${TEST_PORT}/chat`);

  ws.on('close', () => {
    // Verbindung wurde geschlossen - Test erfolgreich
    done();
  });

  ws.on('error', () => {
    // Error ist auch OK - Verbindung wurde rejected
    done();
  });

  // Fallback: Wenn nach 2s noch offen, ist es ein Fehler
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
      done(new Error('WebSocket hätte geschlossen sein sollen'));
    }
  }, 2000);
}, 5000);

test('Nachricht wird von Sender zu Empfänger in Echtzeit übertragen', (done) => {
  const sender = new WebSocket(`ws://localhost:${TEST_PORT}/chat?todoId=${TEST_TODO_ID}`);
  const receiver = new WebSocket(`ws://localhost:${TEST_PORT}/chat?todoId=${TEST_TODO_ID}`);

  let receiverReady = false;
  let senderReady = false;
  let testCompleted = false;

  receiver.on('message', (data) => {
    if (testCompleted) return;
    
    const msg = JSON.parse(data);
    if (msg.type === 'NEW_MESSAGE') {
      expect(msg.message.author).toBe('TestUser');
      expect(msg.message.text).toBe('Hallo Realtime!');
      testCompleted = true;
      sender.close();
      receiver.close();
      done();
    }
  });

  receiver.on('open', () => {
    receiverReady = true;
    if (senderReady) sendMessage();
  });

  sender.on('open', () => {
    senderReady = true;
    if (receiverReady) sendMessage();
  });

  function sendMessage() {
    sender.send(JSON.stringify({
      author: 'TestUser',
      text: 'Hallo Realtime!'
    }));
  }

  sender.on('error', (err) => {
    if (!testCompleted) {
      testCompleted = true;
      done(err);
    }
  });
  receiver.on('error', (err) => {
    if (!testCompleted) {
      testCompleted = true;
      done(err);
    }
  });
}, 10000);

test('Message-History wird beim Connect gesendet', (done) => {
  (async () => {
    try {
      // Verwende eindeutige TODO-ID für diesen Test
      const uniqueTodoId = TEST_TODO_ID_2;
      
      // Historie erstellen
      await Message.create([
        { todoId: uniqueTodoId, author: 'User1', text: 'Erste Nachricht', createdAt: new Date(Date.now() - 2000) },
        { todoId: uniqueTodoId, author: 'User2', text: 'Zweite Nachricht', createdAt: new Date(Date.now() - 1000) }
      ]);

      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/chat?todoId=${uniqueTodoId}`);
      let historyReceived = false;

      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'HISTORY' && !historyReceived) {
          historyReceived = true;
          try {
            expect(msg.messages).toHaveLength(2);
            expect(msg.messages[0].text).toBe('Erste Nachricht');
            expect(msg.messages[1].text).toBe('Zweite Nachricht');
            ws.close();
            done();
          } catch (err) {
            ws.close();
            done(err);
          }
        }
      });

      ws.on('error', (err) => {
        if (!historyReceived) {
          done(err);
        }
      });

      setTimeout(() => {
        if (!historyReceived) {
          ws.close();
          done(new Error('HISTORY-Event nicht erhalten'));
        }
      }, 8000);
    } catch (err) {
      done(err);
    }
  })();
}, 12000);

test('Multi-User-Chat: Mehrere User erhalten Nachrichten', (done) => {
  const user1 = new WebSocket(`ws://localhost:${TEST_PORT}/chat?todoId=${TEST_TODO_ID}`);
  const user2 = new WebSocket(`ws://localhost:${TEST_PORT}/chat?todoId=${TEST_TODO_ID}`);
  const user3 = new WebSocket(`ws://localhost:${TEST_PORT}/chat?todoId=${TEST_TODO_ID}`);

  let user2Received = false;
  let user3Received = false;
  let testCompleted = false;

  const closeAll = () => {
    user1.close();
    user2.close();
    user3.close();
  };

  user2.on('message', (data) => {
    if (testCompleted) return;
    
    const msg = JSON.parse(data);
    if (msg.type === 'NEW_MESSAGE' && msg.message.author === 'User1') {
      user2Received = true;
      checkComplete();
    }
  });

  user3.on('message', (data) => {
    if (testCompleted) return;
    
    const msg = JSON.parse(data);
    if (msg.type === 'NEW_MESSAGE' && msg.message.author === 'User1') {
      user3Received = true;
      checkComplete();
    }
  });

  function checkComplete() {
    if (user2Received && user3Received && !testCompleted) {
      testCompleted = true;
      closeAll();
      done();
    }
  }

  let readyCount = 0;
  const onReady = () => {
    readyCount++;
    if (readyCount === 3) {
      user1.send(JSON.stringify({
        author: 'User1',
        text: 'Nachricht an alle'
      }));
    }
  };

  user1.on('open', onReady);
  user2.on('open', onReady);
  user3.on('open', onReady);

  user1.on('error', (err) => {
    if (!testCompleted) {
      testCompleted = true;
      closeAll();
      done(err);
    }
  });
  user2.on('error', (err) => {
    if (!testCompleted) {
      testCompleted = true;
      closeAll();
      done(err);
    }
  });
  user3.on('error', (err) => {
    if (!testCompleted) {
      testCompleted = true;
      closeAll();
      done(err);
    }
  });

  setTimeout(() => {
    if (!testCompleted) {
      testCompleted = true;
      closeAll();
      done(new Error('Test-Timeout: nicht alle User erhielten Nachricht'));
    }
  }, 8000);
}, 12000);

test('Nachrichten werden persistent in Datenbank gespeichert', (done) => {
  (async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}/chat?todoId=${TEST_TODO_ID}`);
    let messageReceived = false;
    let testCompleted = false;

    ws.on('open', () => {
      ws.send(JSON.stringify({
        author: 'TestUser',
        text: 'Persistente Nachricht'
      }));
    });

    ws.on('message', async (data) => {
      if (testCompleted) return;
      
      const msg = JSON.parse(data);
      if (msg.type === 'NEW_MESSAGE' && !messageReceived) {
        messageReceived = true;

        try {
          await new Promise(resolve => setTimeout(resolve, 200)); // Warte auf DB-Flush
          
          const savedMsg = await Message.findById(msg.message._id);
          expect(savedMsg).toBeDefined();
          expect(savedMsg.text).toBe('Persistente Nachricht');
          expect(savedMsg.todoId.toString()).toBe(TEST_TODO_ID.toString());
          
          testCompleted = true;
          ws.close();
          done();
        } catch (err) {
          testCompleted = true;
          ws.close();
          done(err);
        }
      }
    });

    ws.on('error', (err) => {
      if (!testCompleted) {
        testCompleted = true;
        done(err);
      }
    });

    setTimeout(() => {
      if (!testCompleted) {
        testCompleted = true;
        ws.close();
        done(new Error('Keine NEW_MESSAGE erhalten'));
      }
    }, 8000);
  })();
}, 12000);

test('Disconnect: Offline-User erhält keine neuen Nachrichten', (done) => {
  (async () => {
    const user1 = new WebSocket(`ws://localhost:${TEST_PORT}/chat?todoId=${TEST_TODO_ID}`);
    const user2 = new WebSocket(`ws://localhost:${TEST_PORT}/chat?todoId=${TEST_TODO_ID}`);

    let user2MessageReceived = false;
    let testCompleted = false;

    user2.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'NEW_MESSAGE') {
        user2MessageReceived = true;
      }
    });

    let readyCount = 0;
    const onReady = () => {
      readyCount++;
      if (readyCount === 2) {
        // User2 disconnecten
        user2.close();
        setTimeout(() => {
          // User1 sendet Nachricht
          user1.send(JSON.stringify({
            author: 'User1',
            text: 'Nach Disconnect'
          }));
        }, 200);
      }
    };

    user1.on('open', onReady);
    user2.on('open', onReady);

    setTimeout(() => {
      if (!testCompleted) {
        testCompleted = true;
        try {
          expect(user2MessageReceived).toBe(false);
          user1.close();
          done();
        } catch (err) {
          user1.close();
          done(err);
        }
      }
    }, 1500);

    user1.on('error', (err) => {
      if (!testCompleted) {
        testCompleted = true;
        done(err);
      }
    });
  })();
}, 12000);