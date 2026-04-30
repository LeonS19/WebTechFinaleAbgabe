const todoList = document.getElementById('todo-list');
const newTodoForm = document.getElementById('new-todo-form');
const titleInput = document.getElementById('todo-title-input');
const priorityInput = document.getElementById('todo-priority-input');
const descriptionInput = document.getElementById('todo-description-input');
const dueDateInput = document.getElementById('todo-duedate-input');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const filterSelect = document.getElementById('filter-select');

const API_URL = 'http://localhost:3000/todos';

async function fetchAndRenderTodos() {
    const searchTerm = searchInput.value;
    const sortValue = sortSelect.value;
    const filterValue = filterSelect.value;

    const url = new URL(API_URL);
    if (searchTerm) url.searchParams.append('search', searchTerm);
    if (sortValue) {
        const [sortBy, order] = sortValue.split('-');
        url.searchParams.append('sortBy', sortBy);
        url.searchParams.append('order', order);
    }

    if (filterValue && filterValue !== 'all') {
        const [filterBy, value] = filterValue.split('-');
        url.searchParams.append(filterBy, value);
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP-Fehler! Status: ${response.status}`);
        const todos = await response.json();

        todoList.innerHTML = '';
        todos.forEach(todo => {
            const li = document.createElement('li');
            li.className = 'todo-item';
            if (todo.completed) li.classList.add('completed');
            li.dataset.id = todo.id;

            li.innerHTML = `
                <div class="todo-details">
                    <h3>${todo.title} (Prio: ${todo.priority})</h3>
                    ${todo.description ? `<p class="todo-description">${todo.description}</p>` : ''}
                    <div class="todo-dates">
                        ${todo.dueDate ? `<small><b>Fällig:</b> ${new Date(todo.dueDate).toLocaleDateString('de-DE')}</small>` : ''}
                        <small><b>Erstellt:</b> ${new Date(todo.createDate).toLocaleString('de-DE')}</small>
                        <small><b>Bearbeitet:</b> ${new Date(todo.editedDate).toLocaleString('de-DE')}</small>
                    </div>
                </div>
                <div class="todo-actions">
                    <button class="edit-btn">Bearbeiten</button>
                    <button class="complete-btn">Erledigt</button>
                    <button class="delete-btn">Löschen</button>
                </div>
            `;
            todoList.appendChild(li);
        });
    } catch (error) {
        console.error("Fehler beim Abrufen der Todos:", error);
        todoList.innerHTML = '<li>Fehler beim Laden der Todos.</li>';
    }
}

document.addEventListener('DOMContentLoaded', fetchAndRenderTodos);
searchInput.addEventListener('input', fetchAndRenderTodos);
sortSelect.addEventListener('change', fetchAndRenderTodos);
filterSelect.addEventListener('change', fetchAndRenderTodos);

newTodoForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const priority = parseInt(priorityInput.value, 10);
    const description = descriptionInput.value.trim();
    const dueDate = dueDateInput.value;

    if (!title || !priority) return;

    const newTodo = { title, priority };
    if (description) newTodo.description = description;
    if (dueDate) newTodo.dueDate = dueDate;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTodo),
        });
        if (!response.ok) throw new Error(`HTTP-Fehler! Status: ${response.status}`);
        newTodoForm.reset();
        await fetchAndRenderTodos();
    } catch (error) {
        console.error("Fehler beim Erstellen des Todos:", error);
    }
});

todoList.addEventListener('click', async (event) => {
    const todoItem = event.target.closest('.todo-item');
    if (!todoItem) return;

    const todoId = todoItem.dataset.id;

    // --- Logik für den LÖSCHEN-Button ---
    if (event.target.classList.contains('delete-btn')) {
        if (confirm('Bist du sicher, dass du dieses Todo löschen möchtest?')) {
            try {
                const response = await fetch(`${API_URL}/${todoId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error(`HTTP-Fehler! Status: ${response.status}`);
                await fetchAndRenderTodos();
            } catch (error) {
                console.error('Fehler beim Löschen des Todos:', error);
            }
        }
    }

    // --- Logik für den ERLEDIGT-Button ---
    if (event.target.classList.contains('complete-btn')) {
        const isCompleted = todoItem.classList.contains('completed');
        try {
            const response = await fetch(`${API_URL}/${todoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: !isCompleted }),
            });
            if (!response.ok) throw new Error(`HTTP-Fehler! Status: ${response.status}`);
            await fetchAndRenderTodos();
        } catch (error) {
            console.error('Fehler beim Aktualisieren des Todos:', error);
        }
    }

    // --- Logik für den BEARBEITEN-Button ---
    if (event.target.classList.contains('edit-btn')) {
        const response = await fetch(`${API_URL}/${todoId}`);
        const currentTodo = await response.json();
        todoItem.innerHTML = `
            <div class="edit-form">
                <input type="text" class="edit-title" value="${currentTodo.title}">
                <input type="number" class="edit-priority" value="${currentTodo.priority}">
                <textarea class="edit-description">${currentTodo.description || ''}</textarea>
                <input type="date" class="edit-dueDate" value="${currentTodo.dueDate ? new Date(currentTodo.dueDate).toISOString().split('T')[0] : ''}">
                <div class="edit-actions">
                    <button class="save-btn">Speichern</button>
                    <button class="cancel-btn">Abbrechen</button>
                </div>
            </div>
        `;
    }

    // --- Logik für den SPEICHERN-Button ---
    if (event.target.classList.contains('save-btn')) {
        const updatedData = {
            title: todoItem.querySelector('.edit-title').value,
            priority: parseInt(todoItem.querySelector('.edit-priority').value, 10),
            description: todoItem.querySelector('.edit-description').value,
            dueDate: todoItem.querySelector('.edit-dueDate').value || null,
        };
        try {
            const response = await fetch(`${API_URL}/${todoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData),
            });
            if (!response.ok) throw new Error('Update fehlgeschlagen');
            await fetchAndRenderTodos();
        } catch (error) {
            console.error("Fehler beim Speichern:", error);
        }
    }

    // --- Logik für den ABBRECHEN-Button ---
    if (event.target.classList.contains('cancel-btn')) {
        await fetchAndRenderTodos();
    }
});