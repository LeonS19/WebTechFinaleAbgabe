import { useEffect, useState } from 'react';
import { ChatClient } from '../chat.js';
import { saveMessages, loadMessages } from '../db.js';

export function ChatWindow({ todoId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [client, setClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const chatClient = new ChatClient(todoId, (msg) => {
      setMessages(prev => [...prev, msg]);
      saveMessages([msg]);
    });
    
    // Fehler abfangen
    chatClient.ws = new WebSocket(`ws://localhost:4000/chat?todoId=${todoId}`);
    chatClient.ws.onerror = (err) => {
      console.error('WebSocket Fehler:', err);
      setIsConnected(false);
    };
    chatClient.ws.onopen = () => setIsConnected(true);
    
    chatClient.connect();
    setClient(chatClient);

    return () => chatClient?.disconnect();
  }, [todoId]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!isConnected) {
      alert('Nicht verbunden!');
      return;
    }
    client?.send('Ich', input);
    setInput('');
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginTop: '16px' }}>
      <div style={{ marginBottom: '8px', color: isConnected ? 'green' : 'red' }}>
        {isConnected ? '🟢 Verbunden' : '🔴 Getrennt'}
      </div>
      <ul style={{ listStyle: 'none', height: '200px', overflowY: 'auto', border: '1px solid #e5e7eb', padding: '8px' }}>
        {messages.map((msg, i) => (
          <li key={i}>{msg.author}: {msg.text}</li>
        ))}
      </ul>
      <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Nachricht..." 
          required
        />
        <button type="submit">Senden</button>
        <button type="button" onClick={onClose}>Schließen</button>
      </form>
    </div>
  );
}