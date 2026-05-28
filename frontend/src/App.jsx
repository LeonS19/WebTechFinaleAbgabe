// src/App.jsx
import { useEffect, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { saveTodos, loadTodos } from './db.js';
import { TodoCard } from './components/ToDoCard.jsx';
import { ChatWindow } from './components/ChatWindow.jsx';

const TODOS_QUERY = gql`
  query {
    todos {
      id title status priority
    }
  }
`;

export default function App() {
  const [todos, setTodos] = useState([]);
  const [selectedTodoId, setSelectedTodoId] = useState(null);
  const { data, loading } = useQuery(TODOS_QUERY);

  useEffect(() => {
    if (data?.todos) {
      setTodos(data.todos);
      saveTodos(data.todos);
    }
  }, [data]);

  useEffect(() => {
    if (loading) return;
    loadTodos().then(setTodos);
  }, [loading]);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Todos</h1>
      <div id="todo-list">
        {todos.map(todo => (
          <TodoCard 
            key={todo.id} 
            todo={todo} 
            onOpenChat={() => setSelectedTodoId(todo.id)}
          />
        ))}
      </div>
      {selectedTodoId && (
        <ChatWindow todoId={selectedTodoId} onClose={() => setSelectedTodoId(null)} />
      )}
    </div>
  );
}