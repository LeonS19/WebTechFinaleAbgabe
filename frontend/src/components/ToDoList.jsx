import React, { useEffect, useMemo, useState } from 'react'
import { gql } from '@apollo/client'
import { useMutation, useQuery, useSubscription } from '@apollo/client/react'

const GET_TODOS = gql`
  query GetTodos($status: TodoStatus, $tag: String, $priority: Priority) {
    todos(status: $status, tag: $tag, priority: $priority) {
      id
      title
      status
      priority
      dueDate
      tags
      createdAt
      updatedAt
    }
  }
`

const TODO_DETAIL = gql`
  query TodoDetail($id: ID!) {
    todo(id: $id) {
      id
      title
      status
      priority
      dueDate
      tags
      createdAt
      updatedAt
      comments {
        id
        text
        author
        createdAt
      }
      checklistItems {
        id
        label
        description
        checked
      }
      history {
        changedAt
        field
        oldValue
        newValue
      }
    }
  }
`

const CREATE_TODO = gql`
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      id
      title
      status
      priority
      dueDate
      tags
      createdAt
      updatedAt
    }
  }
`

const UPDATE_TODO = gql`
  mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
    updateTodo(id: $id, input: $input) {
      id
      title
      status
      priority
      dueDate
      tags
      createdAt
      updatedAt
    }
  }
`

const DELETE_TODO = gql`
  mutation DeleteTodo($id: ID!) {
    deleteTodo(id: $id)
  }
`

const ADD_COMMENT = gql`
  mutation AddComment($todoId: ID!, $text: String!, $author: String) {
    addComment(todoId: $todoId, text: $text, author: $author) {
      id
      comments {
        id
        text
        author
        createdAt
      }
    }
  }
`

const ADD_CHECKLIST_ITEM = gql`
  mutation AddChecklistItem($todoId: ID!, $label: String!, $description: String) {
    addChecklistItem(todoId: $todoId, label: $label, description: $description) {
      id
      checklistItems {
        id
        label
        description
        checked
      }
    }
  }
`

const UPDATE_CHECKLIST_ITEM = gql`
  mutation UpdateChecklistItem($todoId: ID!, $itemId: ID!, $label: String, $description: String, $checked: Boolean) {
    updateChecklistItem(todoId: $todoId, itemId: $itemId, label: $label, description: $description, checked: $checked) {
      id
      checklistItems {
        id
        label
        description
        checked
      }
    }
  }
`

const DELETE_CHECKLIST_ITEM = gql`
  mutation DeleteChecklistItem($todoId: ID!, $itemId: ID!) {
    deleteChecklistItem(todoId: $todoId, itemId: $itemId) {
      id
      checklistItems {
        id
        label
        description
        checked
      }
    }
  }
`

const TODO_CREATED = gql`
  subscription {
    todoCreated {
      id
      title
      status
      priority
      dueDate
      tags
      createdAt
      updatedAt
    }
  }
`

const TODO_UPDATED = gql`
  subscription {
    todoUpdated {
      id
      title
      status
      priority
      dueDate
      tags
      createdAt
      updatedAt
    }
  }
`

const TODO_DELETED = gql`
  subscription {
    todoDeleted
  }
`

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function emptyTodoForm() {
  return {
    title: '',
    priority: 'MEDIUM',
    dueDate: '',
    tags: '',
    status: 'OPEN',
  }
}

function TodoDetailView({ todoId, onClose, onEdit }) {
  const { data, loading, error, refetch } = useQuery(TODO_DETAIL, {
    variables: { id: todoId },
    skip: !todoId,
  })

  const [addComment] = useMutation(ADD_COMMENT)
  const [addChecklistItem] = useMutation(ADD_CHECKLIST_ITEM)
  const [updateChecklistItem] = useMutation(UPDATE_CHECKLIST_ITEM)
  const [deleteChecklistItem] = useMutation(DELETE_CHECKLIST_ITEM)

  const [commentForm, setCommentForm] = useState({ author: '', text: '' })
  const [checklistForm, setChecklistForm] = useState({ label: '', description: '' })

  if (!todoId) return null
  if (loading) return <div className="detail-panel"><p>Lade Details...</p></div>
  if (error) return <div className="detail-panel"><p>Fehler beim Laden: {error.message}</p></div>
  if (!data?.todo) return <div className="detail-panel"><p>To-Do nicht gefunden.</p></div>

  const todo = data.todo

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentForm.text.trim()) return
    try {
      await addComment({
        variables: {
          todoId,
          text: commentForm.text.trim(),
          author: commentForm.author.trim() || null,
        },
      })
      setCommentForm({ author: '', text: '' })
      await refetch()
    } catch (error) {
      console.error('Fehler beim Kommentar:', error)
    }
  }

  const handleAddChecklistItem = async (e) => {
    e.preventDefault()
    if (!checklistForm.label.trim()) return
    try {
      await addChecklistItem({
        variables: {
          todoId,
          label: checklistForm.label.trim(),
          description: checklistForm.description.trim() || '',
        },
      })
      setChecklistForm({ label: '', description: '' })
      await refetch()
    } catch (error) {
      console.error('Fehler beim Checklistenpunkt:', error)
    }
  }

  const handleToggleChecklist = async (itemId, checked) => {
    try {
      await updateChecklistItem({
        variables: {
          todoId,
          itemId,
          checked: !checked,
        },
      })
      await refetch()
    } catch (error) {
      console.error('Fehler beim Update:', error)
    }
  }

  const handleDeleteChecklistItem = async (itemId) => {
    try {
      await deleteChecklistItem({
        variables: { todoId, itemId },
      })
      await refetch()
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
    }
  }

  return (
    <div className="detail-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>{todo.title}</h2>
        <button
          onClick={() => onEdit(todo)}
          style={{ background: '#3b82f6', color: 'white', padding: '8px 14px', border: 'none', cursor: 'pointer', borderRadius: '8px' }}
        >
          Bearbeiten
        </button>
      </div>
      <p><strong>Status:</strong> {todo.status}</p>
      <p><strong>Priorität:</strong> {todo.priority}</p>
      <p><strong>Fällig:</strong> {formatDate(todo.dueDate)}</p>
      <p><strong>Tags:</strong> {todo.tags?.length ? todo.tags.join(', ') : '-'}</p>

      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }} />

      <h3>Checkliste</h3>
      {todo.checklistItems?.length ? (
        <ul>
          {todo.checklistItems.map((item) => (
            <li key={item.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px', padding: '10px', background: 'rgba(255,255,255,0.6)', borderRadius: '10px' }}>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => handleToggleChecklist(item.id, item.checked)}
                style={{ marginTop: '4px', cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <strong style={{ textDecoration: item.checked ? 'line-through' : 'none' }}>{item.label}</strong>
                {item.description && <p style={{ fontSize: '0.9rem', margin: '4px 0 0 0' }}>{item.description}</p>}
              </div>
              <button onClick={() => handleDeleteChecklistItem(item.id)} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem' }}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#999' }}>Keine Checklistenpunkte</p>
      )}

      <form onSubmit={handleAddChecklistItem} className="todo-form" style={{ background: 'rgba(37, 99, 235, 0.05)', padding: '12px', borderRadius: '10px', marginTop: '10px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Checklistenpunkt hinzufügen</h4>
        <label>
          Label
          <input
            value={checklistForm.label}
            onChange={(e) => setChecklistForm({ ...checklistForm, label: e.target.value })}
            placeholder="z.B. Einkaufen"
            required
          />
        </label>
        <label>
          Beschreibung (optional)
          <input
            value={checklistForm.description}
            onChange={(e) => setChecklistForm({ ...checklistForm, description: e.target.value })}
            placeholder="Details..."
          />
        </label>
        <button type="submit">Hinzufügen</button>
      </form>

      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }} />

      <h3>Kommentare</h3>
      {todo.comments?.length ? (
        <ul>
          {todo.comments.map((comment) => (
            <li key={comment.id} style={{ background: 'rgba(255,255,255,0.6)', padding: '10px', borderRadius: '10px', marginBottom: '8px', listStyle: 'none' }}>
              <strong>{comment.author || 'Anonym'}:</strong> {comment.text}
              <small style={{ display: 'block', marginTop: '4px', color: '#999' }}>
                {formatDate(comment.createdAt)}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#999' }}>Keine Kommentare</p>
      )}

      <form onSubmit={handleAddComment} className="todo-form" style={{ background: 'rgba(37, 99, 235, 0.05)', padding: '12px', borderRadius: '10px', marginTop: '10px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Kommentar hinzufügen</h4>
        <label>
          Autor
          <input
            value={commentForm.author}
            onChange={(e) => setCommentForm({ ...commentForm, author: e.target.value })}
            placeholder="Optional"
          />
        </label>
        <label>
          Kommentar
          <textarea
            value={commentForm.text}
            onChange={(e) => setCommentForm({ ...commentForm, text: e.target.value })}
            placeholder="Schreibe einen Kommentar..."
            rows={3}
            required
          />
        </label>
        <button type="submit">Kommentar hinzufügen</button>
      </form>

      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }} />

      {/* <h3>Verlauf</h3>
      {todo.history?.length ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          {todo.history.map((entry, index) => (
            <div
              key={`${entry.changedAt}-${index}`}
              style={{
                background: 'rgba(255,255,255,0.6)',
                padding: '12px',
                borderRadius: '10px',
                borderLeft: '3px solid #3b82f6'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ color: '#2563eb' }}>{entry.field}</strong>
                <small style={{ color: '#999' }}>{formatDate(entry.changedAt)}</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#475569' }}>
                <span style={{ background: '#fee2e2', padding: '4px 8px', borderRadius: '6px', wordBreak: 'break-word' }}>
                  {entry.oldValue || '(leer)'}
                </span>
                <span style={{ color: '#999' }}>→</span>
                <span style={{ background: '#dcfce7', padding: '4px 8px', borderRadius: '6px', wordBreak: 'break-word' }}>
                  {entry.newValue || '(leer)'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: '#999' }}>Kein Verlauf</p>
      )} */}
    </div>
  )
}

function EditView({ todo, onSave, onCancel }) {
  const [form, setForm] = useState(emptyTodoForm())

  useEffect(() => {
    if (todo) {
      setForm({
        title: todo.title || '',
        priority: todo.priority || 'MEDIUM',
        dueDate: todo.dueDate ? todo.dueDate.split('T')[0] : '',
        tags: Array.isArray(todo.tags) ? todo.tags.join(', ') : '',
        status: todo.status || 'OPEN',
      })
    }
  }, [todo])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      title: form.title || undefined,
      priority: form.priority || 'MEDIUM',
      dueDate: form.dueDate || null,
      tags: form.tags
        ? form.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : [],
      status: form.status || 'OPEN',
    })
  }

  return (
    <div className="detail-panel">
      <h2>To-Do bearbeiten</h2>
      <form onSubmit={handleSubmit} className="todo-form">
        <label>
          Titel
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
          />
        </label>

        <label>
          Status
          <select
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="DONE">DONE</option>
          </select>
        </label>

        <label>
          Priorität
          <select
            value={form.priority}
            onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </label>

        <label>
          Fälligkeitsdatum
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
          />
        </label>

        <label>
          Tags
          <input
            value={form.tags}
            onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder="tag1, tag2, tag3"
          />
        </label>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" style={{ background: '#16a34a' }}>
            Speichern
          </button>
          <button type="button" onClick={onCancel} style={{ background: '#6b7280' }}>
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}

export function TodoList() {
  const [status, setStatus] = useState('')
  const [tag, setTag] = useState('')
  const [priority, setPriority] = useState('')
  const [createForm, setCreateForm] = useState(emptyTodoForm())
  const [detailTodoId, setDetailTodoId] = useState(null)
  const [editingTodo, setEditingTodo] = useState(null)

  const { data, loading, error, refetch } = useQuery(GET_TODOS, {
    variables: {
      status: status || null,
      tag: tag || null,
      priority: priority || null,
    },
    fetchPolicy: 'cache-and-network',
  })

  const todos = useMemo(() => data?.todos || [], [data])

  const [createTodo] = useMutation(CREATE_TODO)
  const [updateTodo] = useMutation(UPDATE_TODO)
  const [deleteTodo] = useMutation(DELETE_TODO)

  useSubscription(TODO_CREATED, {
    onData: () => refetch(),
  })

  useSubscription(TODO_UPDATED, {
    onData: () => refetch(),
  })

  useSubscription(TODO_DELETED, {
    onData: () => {
      refetch()
      setDetailTodoId(null)
    },
  })

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    try {
      await createTodo({
        variables: {
          input: {
            title: createForm.title,
            priority: createForm.priority || 'MEDIUM',
            dueDate: createForm.dueDate || null,
            tags: createForm.tags
              ? createForm.tags.split(',').map((item) => item.trim()).filter(Boolean)
              : [],
          },
        },
      })
      setCreateForm(emptyTodoForm())
      await refetch()
    } catch (error) {
      console.error('Fehler beim Erstellen:', error)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Wirklich löschen?')) {
      try {
        await deleteTodo({ variables: { id } })
        await refetch()
      } catch (error) {
        console.error('Fehler beim Löschen:', error)
      }
    }
  }

  const handleUpdate = async (input) => {
    try {
      await updateTodo({
        variables: {
          id: editingTodo.id,
          input: {
            ...input,
            priority: input.priority || 'MEDIUM',
          },
        },
      })
      await refetch()
      setEditingTodo(null)
      setDetailTodoId(editingTodo.id)
    } catch (error) {
      console.error('Fehler beim Update:', error)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>To-Do Übersicht</h1>
        <p>GraphQL-Frontend mit Live-Updates</p>
      </header>

      <section className="todo-form-panel">
        <h2>Neues To-Do</h2>
        <form onSubmit={handleCreateSubmit} className="todo-form">
          <label>
            Titel
            <input
              value={createForm.title}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Titel eingeben"
              required
            />
          </label>

          <label>
            Priorität
            <select
              value={createForm.priority}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, priority: e.target.value }))}
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </label>

          <label>
            Fälligkeitsdatum
            <input
              type="date"
              value={createForm.dueDate}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
          </label>

          <label>
            Tags
            <input
              value={createForm.tags}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, tags: e.target.value }))}
              placeholder="tag1, tag2, tag3"
            />
          </label>

          <button type="submit">To-Do erstellen</button>
        </form>
      </section>

      <section className="filters">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Alle</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="DONE">DONE</option>
          </select>
        </label>

        <label>
          Tag
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="z. B. uni"
          />
        </label>

        <label>
          Priorität
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Alle</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </label>
      </section>

      <section className="todo-list-section">
        <h2>Übersicht</h2>

        {loading && <p>Lade To-Dos...</p>}
        {error && <p>Fehler beim Laden: {error.message}</p>}

        {!loading && !error && todos.length === 0 && <p>Keine To-Dos gefunden.</p>}

        <ul className="todo-list">
          {todos.map((todo) => (
            <li key={todo.id} className="todo-item">
              <div className="todo-info" onClick={() => {
                setDetailTodoId(todo.id)
                setEditingTodo(null)
              }}>
                <strong>{todo.title}</strong>
                <span className="status">{todo.status}</span>
                {todo.priority && <small className="priority">{todo.priority}</small>}
              </div>
              <div className="todo-actions">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingTodo(todo)
                  }}
                  style={{ background: '#3b82f6', color: 'white', padding: '6px 12px', border: 'none', cursor: 'pointer', marginRight: '5px', borderRadius: '8px', fontSize: '0.9rem' }}
                >
                  Bearbeiten
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(todo.id)
                  }}
                  style={{ background: '#dc2626', color: 'white', padding: '6px 12px', border: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '0.9rem' }}
                >
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {editingTodo && (
        <EditView
          todo={editingTodo}
          onSave={handleUpdate}
          onCancel={() => setEditingTodo(null)}
        />
      )}

      {detailTodoId && !editingTodo && (
        <TodoDetailView
          todoId={detailTodoId}
          onEdit={(todo) => setEditingTodo(todo)}
        />
      )}
    </div>
  )
}