/**
 * <todo-card> Web Component
 * 
 * Attribute:
 *   todo-id        - ID des Todos
 *   todo-title     - Titel
 *   todo-priority  - Priorität (1-3)
 *   todo-desc      - Beschreibung (optional)
 *   todo-duedate   - Fälligkeitsdatum (optional)
 *   todo-createdate - Erstelldatum
 *   todo-editeddate - Bearbeitungsdatum
 *   todo-completed  - "true" oder "false"
 * 
 * Events die die Komponente feuert:
 *   todo-delete   - User klickt Löschen
 *   todo-complete - User klickt Erledigt
 *   todo-edit     - User klickt Bearbeiten
 *   todo-chat     - User klickt Chat
 */
class TodoCard extends HTMLElement {
  connectedCallback() {
    this.render();
    this.addEventListeners();
  }

  // Wird aufgerufen wenn sich ein Attribut ändert
  static get observedAttributes() {
    return ['todo-completed'];
  }
  attributeChangedCallback() {
    this.render();
    this.addEventListeners();
  }

  render() {
    const id = this.getAttribute('todo-id');
    const title = this.getAttribute('todo-title') || '';
    const priority = this.getAttribute('todo-priority');
    const desc = this.getAttribute('todo-desc');
    const dueDate = this.getAttribute('todo-duedate');
    const createDate = this.getAttribute('todo-createdate');
    const editedDate = this.getAttribute('todo-editeddate');
    const completed = this.getAttribute('todo-completed') === 'true';

    this.className = 'todo-item' + (completed ? ' completed' : '');
    this.dataset.id = id;

    this.innerHTML = `
      <div class="todo-details">
        <h3>${title} (Prio: ${priority})</h3>
        ${desc ? `<p class="todo-description">${desc}</p>` : ''}
        <div class="todo-dates">
          ${dueDate ? `<small><b>Fällig:</b> ${new Date(dueDate).toLocaleDateString('de-DE')}</small>` : ''}
          ${createDate ? `<small><b>Erstellt:</b> ${new Date(createDate).toLocaleString('de-DE')}</small>` : ''}
          ${editedDate ? `<small><b>Bearbeitet:</b> ${new Date(editedDate).toLocaleString('de-DE')}</small>` : ''}
        </div>
      </div>
      <div class="todo-actions">
        <button class="edit-btn">Bearbeiten</button>
        <button class="complete-btn">${completed ? 'Wiedereröffnen' : 'Erledigt'}</button>
        <button class="delete-btn">Löschen</button>
        <button class="chat-btn">💬 Chat</button>
      </div>
      <chat-window todo-id="${id}"></chat-window>
      <attachment-list todo-id="${id}"></attachment-list>
    `;
  }

  addEventListeners() {
    const id = this.getAttribute('todo-id');

    this.querySelector('.delete-btn').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('todo-delete', { bubbles: true, detail: { id } }));
    });

    this.querySelector('.complete-btn').addEventListener('click', () => {
      const completed = this.getAttribute('todo-completed') === 'true';
      this.dispatchEvent(new CustomEvent('todo-complete', { bubbles: true, detail: { id, completed } }));
    });

    this.querySelector('.edit-btn').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('todo-edit', { bubbles: true, detail: { id } }));
    });

    this.querySelector('.chat-btn').addEventListener('click', () => {
      const chatWindow = this.querySelector('chat-window');
      if (chatWindow) chatWindow.toggle();
    });
  }
}

customElements.define('todo-card', TodoCard);
