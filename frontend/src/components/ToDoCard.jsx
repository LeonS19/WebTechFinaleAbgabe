export function TodoCard({ todo, onOpenChat }) {
  const colors = { OPEN: '#3b82f6', IN_PROGRESS: '#f59e0b', DONE: '#10b981' };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
      <strong>{todo.title}</strong>
      <span style={{ 
        display: 'inline-block', 
        padding: '2px 8px',
        borderRadius: '9999px',
        color: 'white',
        fontSize: '12px',
        background: colors[todo.status] 
      }}>
        {todo.status}
      </span>
      {todo.priority && <span style={{ fontSize: '12px', color: '#6b7280' }}>[{todo.priority}]</span>}
      <button onClick={() => onOpenChat(todo.id)}>Chat öffnen</button>
    </div>
  );
}