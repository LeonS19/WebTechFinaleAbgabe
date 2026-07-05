const DB_NAME = 'webtech-offline';
const DB_VERSION = 1;

let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('study_groups')) {
        db.createObjectStore('study_groups', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('indexcards')) {
        const store = db.createObjectStore('indexcards', { keyPath: 'id' });
        store.createIndex('study_group_id', 'studyGroupId');
      }

      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id' });
        store.createIndex('chat_id', 'chatId');
      }

      if (!db.objectStoreNames.contains('runs')) {
        const store = db.createObjectStore('runs', { keyPath: 'id' });
        store.createIndex('study_group_id', 'studyGroupId');
      }

      if (!db.objectStoreNames.contains('rankings')) {
        db.createObjectStore('rankings', { keyPath: 'studyGroupId' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

// ---- Generische Helper ----

async function putAll(storeName, items) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  items.forEach((item) => store.put(item));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllByIndex(storeName, indexName, indexValue) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const index = store.index(indexName);
  return new Promise((resolve, reject) => {
    const request = index.getAll(indexValue);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- Study Groups ----

// Liste von Gruppen-Metadaten cachen (id, name, chatId, createdAt – ohne members)
export async function cacheStudyGroups(groups) {
  return putAll('study_groups', groups)
}

// Members nachträglich in einen bestehenden Eintrag einpatchen
export async function patchStudyGroupMembers(id, members) {
  const db = await openDB()
  const tx = db.transaction('study_groups', 'readwrite')
  const store = tx.objectStore('study_groups')
  return new Promise((resolve, reject) => {
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const existing = getReq.result || { id }
      store.put({ ...existing, members })
      resolve()
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function getCachedStudyGroup(id) {
  const db = await openDB();
  const tx = db.transaction('study_groups', 'readonly');
  return new Promise((resolve, reject) => {
    const request = tx.objectStore('study_groups').get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCachedStudyGroups() {
  const db = await openDB();
  const tx = db.transaction('study_groups', 'readonly');
  return new Promise((resolve, reject) => {
    const request = tx.objectStore('study_groups').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- IndexCards ----

export async function cacheIndexCards(cards) {
  return putAll('indexcards', cards);
}

export async function getCachedIndexCards(studyGroupId) {
  return getAllByIndex('indexcards', 'study_group_id', studyGroupId);
}

// ---- Messages ----

export async function cacheMessages(messages) {
  return putAll('messages', messages);
}

export async function getCachedMessages(chatId) {
  return getAllByIndex('messages', 'chat_id', chatId);
}

// ---- Runs ----

export async function cacheRuns(runs) {
  return putAll('runs', runs);
}

export async function getCachedRuns(studyGroupId) {
  return getAllByIndex('runs', 'study_group_id', studyGroupId);
}

// ---- Rankings ----

export async function cacheRanking(studyGroupId, rankingEntries) {
  return putAll('rankings', [{ studyGroupId, entries: rankingEntries }])
}

export async function getCachedRanking(studyGroupId) {
  const db = await openDB()
  const tx = db.transaction('rankings', 'readonly')
  return new Promise((resolve, reject) => {
    const request = tx.objectStore('rankings').get(studyGroupId)
    request.onsuccess = () => resolve(request.result?.entries || [])
    request.onerror = () => reject(request.error)
  })
}