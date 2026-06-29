/**
 * <attachment-list> Web Component
 *
 * Attribute:
 *   todo-id - ID des Todos, zu dem die Anhänge gehören
 *
 * Wird von <todo-card> verwendet.
 */
class AttachmentList extends HTMLElement {
  connectedCallback() {
    this.render();
    this.loadAttachments();
    this.addEventListeners();
  }

  render() {
    const id = this.getAttribute('todo-id');
    this.innerHTML = `
      <div class="attachment-section">
        <div class="attachment-upload">
          <label class="upload-label">
            📎 Datei anhängen
            <input type="file" class="file-input" style="display:none;" />
          </label>
          <span class="upload-status"></span>
        </div>
        <ul class="attachment-list" id="attachments-${id}"></ul>
      </div>
    `;
  }

  addEventListeners() {
    const fileInput = this.querySelector('.file-input');
    fileInput.addEventListener('change', () => this.uploadFile(fileInput.files[0]));
  }

  // Alle Anhänge vom Server laden und anzeigen
  async loadAttachments() {
    const todoId = this.getAttribute('todo-id');
    try {
      const response = await fetch(`http://localhost:3000/todos/${todoId}/attachments`);
      if (!response.ok) return;
      const attachments = await response.json();
      this.renderAttachments(attachments);
    } catch (err) {
      console.warn('[AttachmentList] Offline oder Fehler:', err);
    }
  }

  renderAttachments(attachments) {
    const list = this.querySelector('.attachment-list');
    list.innerHTML = '';

    if (attachments.length === 0) {
      list.innerHTML = '<li class="no-attachments">Keine Anhänge</li>';
      return;
    }

    attachments.forEach(att => {
      const li = document.createElement('li');
      li.className = 'attachment-item';
      li.dataset.id = att.id;

      // Dateigröße lesbar formatieren
      const size = this.formatSize(att.size);

      li.innerHTML = `
        <span class="attachment-icon">${this.getIcon(att.mimetype)}</span>
        <span class="attachment-name">${att.originalname}</span>
        <span class="attachment-size">${size}</span>
        <a class="attachment-download" href="http://localhost:3000/todos/${att.todo_id}/attachments/${att.id}/download" download="${att.originalname}">⬇</a>
        <button class="attachment-delete-btn" data-id="${att.id}">🗑</button>
      `;
      list.appendChild(li);
    });

    // Löschen-Buttons
    list.querySelectorAll('.attachment-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => this.deleteAttachment(btn.dataset.id));
    });
  }

  // Datei hochladen
  async uploadFile(file) {
    if (!file) return;

    const todoId = this.getAttribute('todo-id');
    const status = this.querySelector('.upload-status');
    status.textContent = 'Wird hochgeladen...';

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`http://localhost:3000/todos/${todoId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload fehlgeschlagen');

      status.textContent = '✓ Hochgeladen';
      setTimeout(() => status.textContent = '', 2000);

      // Liste neu laden
      await this.loadAttachments();

      // File-Input zurücksetzen
      this.querySelector('.file-input').value = '';
    } catch (err) {
      console.error('[AttachmentList] Upload-Fehler:', err);
      status.textContent = '✗ Fehler beim Hochladen';
    }
  }

  // Anhang löschen
  async deleteAttachment(attachmentId) {
    if (!confirm('Anhang wirklich löschen?')) return;

    const todoId = this.getAttribute('todo-id');
    try {
      const response = await fetch(
        `http://localhost:3000/todos/${todoId}/attachments/${attachmentId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Löschen fehlgeschlagen');
      await this.loadAttachments();
    } catch (err) {
      console.error('[AttachmentList] Lösch-Fehler:', err);
    }
  }

  // Dateigröße in lesbare Form bringen
  formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Icon je nach Dateityp
  getIcon(mimetype) {
    if (mimetype.startsWith('image/')) return '🖼';
    if (mimetype === 'application/pdf') return '📄';
    if (mimetype.startsWith('video/')) return '🎥';
    if (mimetype.startsWith('audio/')) return '🎵';
    return '📎';
  }
}

customElements.define('attachment-list', AttachmentList);