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
      subtasks {
        id
        title
        done
      }
      comments {
        id
        text
        author
        createdAt
      }
      checklistItems {
        id
        label
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
    }
  }
`

const ADD_SUBTASK = gql`
  mutation AddSubtask($todoId: ID!, $title: String!) {
    addSubtask(todoId: $todoId, title: $title) {
      id
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
    priority: '',
    dueDate: '',
    tags: '',
  }
}

function emptyCommentForm() {
  return {
    author: '',
    text: '',
  }
}

function emptySubtaskForm() {
  return {
    title: '',
  }
}

function TodoDetail({
  selectedTodo,
  onUpdate,
  onDelete,
  onAddComment,
  onAddSubtask,
}) {
  const [editForm, setEditForm] = useState(emptyTodoForm())
  const [commentForm, setCommentForm] = useState(emptyCommentForm())
  const [subtaskForm, setSubtaskForm] = useState(emptySubtaskForm())

  const { data, loading, error, refetch } = useQuery(TODO_DETAIL, {
    variables: { id: selectedTodo },
    skip: !selectedTodo,
  })

  useEffect(() => {
    if (!data?.todo) return
    const todo = data.todo
    setEditForm({
      title: todo.title || '',
      priority: todo.priority || '',
      dueDate: todo.dueDate ? todo.dueDate.slice(0, 10) : '',
      tags: Array.isArray(todo.tags) ? todo.tags.join(', ') : '',
    })
  }, [data])

  if (!selectedTodo) {
    return <p>Wähle links ein To-Do aus.</p>
  }

  if (loading) return <p>Lade Detailansicht...</p>
  if (error) return <p>Fehler beim Laden der Details.</p>
  if (!data?.todo) return <p>To-Do nicht gefunden.</p>

  const todo = data.todo

  const handleSubmitUpdate = async (e) => {
    e.preventDefault()
    await onUpdate({
      title: editForm.title || undefined,
      priority: editForm.priority || null,
      dueDate: editForm.dueDate || null,
      tags: editForm.tags
        ? editForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : [],
    })
    await refetch()
  }

  const handleCommentSubmit = async (e) => {
    e.preventDefault()
    if (!commentForm.text.trim()) return
    await onAddComment({
      text: commentForm.text.trim(),
      author: commentForm.author.trim() || null,
    })
    setCommentForm(emptyCommentForm())
    await refetch()
  }

  const handleSubtaskSubmit = async (e) => {
    e.preventDefault()
    if (!subtaskForm.title.trim()) return
    await onAddSubtask(subtaskForm.title.trim())
    setSubtaskForm(emptySubtaskForm())
    await refetch()
  }

  return (
    <div className="todo-detail">
      <h2>{todo.title}</h2>
      <p><strong>Status:</strong> {todo.status}</p>
      <p><strong>Priorität:</strong> {todo.priority || '-'}</p>
      <p><strong>Fällig:</strong> {formatDate(todo.dueDate)}</p>
      <p><strong>Tags:</strong> {todo.tags?.length ? todo.tags.join(', ') : '-'}</p>
      <p><strong>Erstellt:</strong> {formatDate(todo.createdAt)}</p>
      <p><strong>Aktualisiert:</strong> {formatDate(todo.updatedAt)}</p>

      <form onSubmit={handleSubmitUpdate} className="todo-form">
        <h3>Todo bearbeiten</h3>
        <label>
          Titel
          <input
            value={editForm.title}
            onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
          />
        </label>

        <label>
          Priorität
          <select
            value={editForm.priority}
            onChange={(e) => setEditForm((prev) => ({ ...prev, priority: e.target.value }))}
          >
            <option value="">Keine</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </label>

        <label>
          Fälligkeitsdatum
          <input
            type="date"
            value={editForm.dueDate}
            onChange={(e) => setEditForm((prev) => ({ ...prev, dueDate: e.target.value }))}
          />
        </label>

        <label>
          Tags
          <input
            value={editForm.tags}
            onChange={(e) => setEditForm((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder="tag1, tag2, tag3"
          />
        </label>

        <button type="submit">Änderungen speichern</button>
      </form>

      <button onClick={onDelete} style={{ background: '#dc2626' }}>
        Todo löschen
      </button>

      <h3>Subtasks</h3>
      {todo.subtasks?.length ? (
        <ul>
          {todo.subtasks.map((subtask) => (
            <li key={subtask.id}>
              {subtask.done ? '✓' : '○'} {subtask.title}
            </li>
          ))}
        </ul>
      ) : (
        <p>Keine Subtasks</p>
      )}

      <form onSubmit={handleSubtaskSubmit} className="todo-form">
        <label>
          Neue Subtask
          <input
            value={subtaskForm.title}
            onChange={(e) => setSubtaskForm({ title: e.target.value })}
            placeholder="Subtask-Titel"
          />
        </label>
        <button type="submit">Subtask hinzufügen</button>
      </form>

      <h3>Kommentare</h3>
      {todo.comments?.length ? (
        <ul>
          {todo.comments.map((comment) => (
            <li key={comment.id}>
              <strong>{comment.author || 'Anonymous'}:</strong> {comment.text}
            </li>
          ))}
        </ul>
      ) : (
        <p>Keine Kommentare</p>
      )}

      <form onSubmit={handleCommentSubmit} className="todo-form">
        <label>
          Autor
          <input
            value={commentForm.author}
            onChange={(e) => setCommentForm((prev) => ({ ...prev, author: e.target.value }))}
            placeholder="Optional"
          />
        </label>
        <label>
          Kommentar
          <textarea
            value={commentForm.text}
            onChange={(e) => setCommentForm((prev) => ({ ...prev, text: e.target.value }))}
            placeholder="Kommentar schreiben"
            rows={3}
          />
        </label>
        <button type="submit">Kommentar hinzufügen</button>
      </form>

      <h3>Checkliste</h3>
      {todo.checklistItems?.length ? (
        <ul>
          {todo.checklistItems.map((item) => (
            <li key={item.id}>
              {item.checked ? '✓' : '○'} {item.label}
            </li>
          ))}
        </ul>
      ) : (
        <p>Keine Checklistenpunkte</p>
      )}

      <h3>Verlauf</h3>
      {todo.history?.length ? (
        <ul>
          {todo.history.map((entry, index) => (
            <li key={`${entry.changedAt}-${index}`}>
              {formatDate(entry.changedAt)}: {entry.field} von "{entry.oldValue}" zu "{entry.newValue}"
            </li>
          ))}
        </ul>
      ) : (
        <p>Kein Verlauf</p>
      )}
    </div>
  )
}

export function TodoList() {
  const [status, setStatus] = useState('')
  const [tag, setTag] = useState('')
  const [priority, setPriority] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [createForm, setCreateForm] = useState(emptyTodoForm())

  const { data, loading, error, refetch } = useQuery(GET_TODOS, {
    variables: {
      status: status || null,
      tag: tag || null,
      priority: priority || null,
    },
    fetchPolicy: 'cache-and-network',
  })

  const todos = useMemo(() => data?.todos || [], [data])

  useEffect(() => {
    if (!selectedId && todos.length > 0) {
      setSelectedId(todos[0].id)
    }
  }, [todos, selectedId])

  const [createTodo] = useMutation(CREATE_TODO)
  const [updateTodo] = useMutation(UPDATE_TODO)
  const [deleteTodo] = useMutation(DELETE_TODO)
  const [addComment] = useMutation(ADD_COMMENT)
  const [addSubtask] = useMutation(ADD_SUBTASK)

  useSubscription(TODO_CREATED, {
    onData: () => {
      refetch()
    },
  })

  useSubscription(TODO_UPDATED, {
    onData: () => {
      refetch()
    },
  })

  useSubscription(TODO_DELETED, {
    onData: () => {
      refetch()
      if (selectedId) {
        setSelectedId(null)
      }
    },
  })

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    await createTodo({
      variables: {
        input: {
          title: createForm.title,
          priority: createForm.priority || null,
          dueDate: createForm.dueDate || null,
          tags: createForm.tags
            ? createForm.tags.split(',').map((tagItem) => tagItem.trim()).filter(Boolean)
            : [],
        },
      },
    })
    setCreateForm(emptyTodoForm())
    refetch()
  }

  const handleDelete = async () => {
    if (!selectedId) return
    await deleteTodo({ variables: { id: selectedId } })
    setSelectedId(null)
    refetch()
  }

  const handleUpdate = async (input) => {
    if (!selectedId) return
    await updateTodo({
      variables: {
        id: selectedId,
        input,
      },
    })
    refetch()
  }

  const handleAddComment = async (input) => {
    if (!selectedId) return
    await addComment({
      variables: {
        todoId: selectedId,
        text: input.text,
        author: input.author || null,
      },
    })
    refetch()
  }

  const handleAddSubtask = async (title) => {
    if (!selectedId) return
    await addSubtask({
      variables: {
        todoId: selectedId,
        title,
      },
    })
    refetch()
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>To-Do Übersicht</h1>
        <p>GraphQL-Frontend mit Live-Updates</p>
      </header>

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
              <option value="">Keine</option>
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

      <main className="layout">
        <section className="todo-list-panel">
          <h2>Übersicht</h2>

          {loading && <p>Lade To-Dos...</p>}
          {error && <p>Fehler beim Laden der To-Dos.</p>}

          {!loading && !error && todos.length === 0 && <p>Keine To-Dos gefunden.</p>}

          <ul className="todo-list">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className={selectedId === todo.id ? 'selected' : ''}
                onClick={() => setSelectedId(todo.id)}
              >
                <strong>{todo.title}</strong>
                <span>{todo.status}</span>
                {todo.priority && <small>{todo.priority}</small>}
              </li>
            ))}
          </ul>
        </section>

        <section className="detail-panel">
          <h2>Detailansicht</h2>
          <TodoDetail
            selectedTodo={selectedId}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAddComment={handleAddComment}
            onAddSubtask={handleAddSubtask}
          />
        </section>
      </main>
    </div>
  )
}