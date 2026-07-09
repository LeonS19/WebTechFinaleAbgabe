// ============================================
// Seed: komplette Demo-Lerngruppe
// ============================================
// Erzeugt eine Lerngruppe mit 3 Demo-Usern (ADMIN/MODERATOR/MEMBER),
// einem Batch an Karteikarten mit garantiert hoher Versuchszahl
// (>= 1000 total_attempts, damit der Cold-Start-Schutz nie greift),
// verteilt über alle 5 möglichen Schadensstufen (1-5) für Balancing-Tests,
// dazu Dummy-Chat-Nachrichten und Dummy-Runs für die Rangliste.
//
// Nutzung: npm run seed:demo
// Idempotent: löscht vorher eine gleichnamige Demo-Gruppe samt Daten.

import { randomUUID } from 'crypto';
import { pool } from '../config/db.postgres.js';
import { connectMongo } from '../config/db.mongo.js';
import { IndexCard } from '../models/mongo/indexCard.model.js';
import { Message } from '../models/mongo/message.model.js';
import { Map } from '../models/mongo/map.model.js';

const GROUP_NAME = 'Demo Lerngruppe';

const DEMO_USERS = [
  { name: 'Alice (Demo)', email: 'demo-alice@example.com', role: 'ADMIN' },
  { name: 'Bob (Demo)', email: 'demo-bob@example.com', role: 'MODERATOR' },
  { name: 'Carol (Demo)', email: 'demo-carol@example.com', role: 'MEMBER' },
];

// Zielwerte für die Schwierigkeit, damit alle 5 Schadensstufen entstehen:
// damage = round(1 + (1 - difficulty) * 4)
// difficulty 1.0 -> damage 1 | 0.75 -> 2 | 0.5 -> 3 | 0.25 -> 4 | 0.0 -> 5
const DIFFICULTY_TARGETS = [1.0, 0.75, 0.5, 0.25, 0.0];

const GENERIC_QUESTIONS = [
  { question: 'Wie viele Kontinente gibt es?', answer: '7', tags: ['geographie'] },
  { question: 'Was ist die Hauptstadt von Frankreich?', answer: 'Paris', tags: ['geographie', 'hauptstädte'] },
  { question: 'Wie viele Beine hat eine Spinne?', answer: '8', tags: ['biologie', 'tiere'] },
  { question: 'In welchem Jahr endete der Zweite Weltkrieg?', answer: '1945', tags: ['geschichte'] },
  { question: 'Was ist die chemische Formel von Wasser?', answer: 'H2O', tags: ['chemie'] },
  { question: 'Wie viele Planeten hat unser Sonnensystem?', answer: '8', tags: ['astronomie'] },
  { question: 'Wer schrieb "Faust"?', answer: 'Goethe', tags: ['literatur', 'geschichte'] },
  { question: 'Was ist die größte Wüste der Welt?', answer: 'Sahara', tags: ['geographie'] },
  { question: 'Wie viele Saiten hat eine klassische Gitarre?', answer: '6', tags: ['musik'] },
  { question: 'Was ist die Hauptstadt von Japan?', answer: 'Tokio', tags: ['geographie', 'hauptstädte'] },
  { question: 'Wie viele Herzkammern hat ein Mensch?', answer: '4', tags: ['biologie', 'anatomie'] },
  { question: 'Welches Element hat das Symbol "O"?', answer: 'Sauerstoff', tags: ['chemie'] },
  { question: 'Wie viele Bundesländer hat Deutschland?', answer: '16', tags: ['geographie', 'politik'] },
  { question: 'Was ist die kleinste Primzahl?', answer: '2', tags: ['mathematik'] },
  { question: 'Wer malte die Mona Lisa?', answer: 'Leonardo da Vinci', tags: ['kunst', 'geschichte'] },
  { question: 'Wie viele Zähne hat ein erwachsener Mensch normalerweise?', answer: '32', tags: ['biologie', 'anatomie'] },
  { question: 'Was ist die Hauptstadt von Italien?', answer: 'Rom', tags: ['geographie', 'hauptstädte'] },
  { question: 'Wie viele Farben hat ein Regenbogen?', answer: '7', tags: ['physik'] },
  { question: 'In welchem Ozean liegen die Bahamas?', answer: 'Atlantik', tags: ['geographie'] },
  { question: 'Wie viele Spieler hat eine Fußballmannschaft auf dem Feld?', answer: '11', tags: ['sport'] },
  { question: 'Was ist die längste Fluss der Welt?', answer: 'Nil', tags: ['geographie'] },
  { question: 'Wie viele Monate haben 31 Tage?', answer: '7', tags: ['mathematik', 'allgemeinwissen'] },
  { question: 'Was ist die Hauptstadt von Spanien?', answer: 'Madrid', tags: ['geographie', 'hauptstädte'] },
  { question: 'Wie viele Ringe hat das Olympia-Symbol?', answer: '5', tags: ['sport', 'allgemeinwissen'] },
  { question: 'Welches Tier ist das größte Landtier?', answer: 'Elefant', tags: ['biologie', 'tiere'] },
];

const DUMMY_MESSAGES = [
  'Hat jemand die Karteikarten zu den Hauptstädten schon durchgearbeitet?',
  'Ich starte gleich einen Run, wer kommt mit (na ja, jeder für sich, ist ja solo) 😄',
  'Die Frage zum Nil hab ich immer wieder falsch, richtig nervig',
  'Neue Karten sind online, schaut mal rein!',
  'Wer hat den Endboss schon geschafft?',
  'Kann mir jemand nochmal erklären, wie die Rangliste sortiert wird?',
  'Level 5 erreicht, fühlt sich gut an',
  'Die Heilfelder retten einen echt oft',
  'Perfekte Runde geschafft, direkt geheilt worden',
  'Ich glaub ich muss nochmal die Grundlagen wiederholen',
  'Schwierigkeitsgrad passt sich echt gut an, merkt man deutlich',
  'Wie viele Karten hat unser Pool eigentlich aktuell?',
  'Der Schleim auf Feld 4 ist immer noch mein Endgegner 😅',
  'Nice, neuer Highscore in der Gruppe!',
  'Bis morgen, weiterlernen!',
  'Guten Morgen alle zusammen ☀️',
  'Hat jemand Tipps für die Chemie-Karten?',
  'Ich häng bei der Frage mit dem Element "O" immer',
  'Sauerstoff ist doch logisch, oder verwechsel ich da was',
  'Ne ne, du hast recht, war nur ein Tippfehler bei mir',
  'Wer erstellt eigentlich die meisten Karten hier?',
  'Ich glaub das war ich, aber nur weil ich Langeweile hatte',
  'Läuft der Chat hier auch offline oder nur online?',
  'Sollte laut den Docs auch offline die letzten Nachrichten zeigen',
  'Ah stimmt, hab ich gerade getestet, funktioniert',
  'Krass, dass das mit IndexedDB geht',
  'Wie oft kann man am Tag einen Run starten?',
  'Sooft du willst, ist nicht limitiert',
  'Achtung, der Boss auf Feld 60 macht richtig Schaden',
  'Ja, war knapp, aber mit Heilfeld vorher hats gereicht',
  'Wer ist aktuell auf Platz 1?',
  'Aktuell glaub ich Alice, aber das kann sich schnell ändern',
  'Challenge angenommen 💪',
  'Kann man die Reihenfolge der Karteikarten im Deck beeinflussen?',
  'Nicht direkt, das ist ja gewichtet nach deiner Fehlerquote',
  'Ah verstehe, macht Sinn',
  'Die Frage zur Mona Lisa kam bei mir schon 3x dran',
  'Vielleicht schwächst du dich da grad selbst, weil du sie oft falsch hast',
  'Stimmt eigentlich, war mir nicht bewusst',
  'Wer hat Bock auf eine gemeinsame Lernsession heute Abend?',
  'Bin dabei, ab wann?',
  'Sagen wir 19 Uhr?',
  'Passt mir auch',
  'Ich bin raus, hab noch was anderes vor, viel Erfolg!',
  'Kein Stress, dann halt ohne dich 😉',
  'Weiß jemand, wie die Kartenanhänge funktionieren?',
  'Du kannst Bilder oder PDFs an eine Karteikarte hängen',
  'Cool, das probier ich gleich mal aus',
  'Hat wer schon offline getestet, ob der Upload auch geht?',
  'Nein, das sollte eigentlich blockiert sein ohne Internet',
  'Ergibt Sinn, Dateien kann man ja nicht zwischenspeichern zum Hochladen',
  'Was ist eigentlich der Unterschied zwischen Moderator und Admin hier?',
  'Admin kann Mitglieder entfernen, Moderator nicht, aber beide können Karten verwalten',
  'Ah okay, danke für die Erklärung',
  'Ich hab grad ne perfekte Runde hingelegt, 5/5!',
  'Nice, was gabs als Belohnung?',
  'Direkt Heilung um den Gegnerschaden, ziemlich stark',
  'Muss ich auch mal probieren',
  'Ist ganz schön schwer, wenn man erstmal 5 Handkarten braucht',
  'Ja genau, das ist der Trick an der Sache',
  'Wie tief ist die Map eigentlich, gibts ein Limit?',
  '61 Felder insgesamt, Boss ganz am Ende',
  'Ah verstehe, dann weiß ich ungefähr wie weit ich noch muss',
  'Kann man eigentlich zurückgehen auf der Map?',
  'Nein, nur vorwärts, keine Rückwärtsbewegung erlaubt',
  'Macht auch Sinn fürs Balancing, sonst zu einfach',
  'Stimmt, sonst würde man immer zum leichtesten Pfad zurück',
  'So, ich mach für heute Feierabend, bis morgen!',
  'Gute Nacht, viel Erfolg noch euch allen',
  'Bis morgen! 🌙',
  'Letzte Frage für heute: Wie viele Ringe hat das Olympia-Symbol nochmal?',
  '5, steht doch auf der Karte 😄',
  'Ach stimmt, war grad wie vernagelt',
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function upsertUser(name, email) {
  const existing = await pool.query('SELECT id FROM "user" WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }
  const result = await pool.query(
    'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
    [name, email],
  );
  return result.rows[0].id;
}

async function deleteExistingDemoGroup() {
  const existing = await pool.query('SELECT id, chat_id FROM study_group WHERE name = $1', [GROUP_NAME]);
  if (existing.rows.length === 0) return;

  const { id: studyGroupId, chat_id: chatId } = existing.rows[0];

  await IndexCard.deleteMany({ study_group_id: studyGroupId });
  if (chatId) {
    await Message.deleteMany({ chat_id: chatId });
  }
  await pool.query('DELETE FROM run WHERE study_group_id = $1', [studyGroupId]);
  await pool.query('DELETE FROM membership WHERE study_group_id = $1', [studyGroupId]);
  await pool.query('DELETE FROM study_group WHERE id = $1', [studyGroupId]);

  console.log(`Alte Demo-Gruppe "${GROUP_NAME}" (samt Daten) gelöscht.`);
}

async function createIndexCards(studyGroupId, userIds) {
  const cards = [];

  GENERIC_QUESTIONS.forEach((qa, i) => {
    const targetDifficulty = DIFFICULTY_TARGETS[i % DIFFICULTY_TARGETS.length];
    const totalAttempts = randomInt(1000, 3000); // immer >= 1000 -> Cold-Start-Schutz greift nie
    // etwas Rauschen um den Zielwert, aber innerhalb des Damage-Buckets bleibend
    const noise = (Math.random() - 0.5) * 0.08;
    const difficulty = Math.min(1, Math.max(0, targetDifficulty + noise));
    const correctAnswers = Math.round(totalAttempts * difficulty);

    // pro User eine eigene, zufällige persönliche Statistik (beeinflusst Deck-Priorisierung)
    const userStats = userIds.map((userId) => {
      const personalAttempts = randomInt(0, 40);
      const personalCorrect = randomInt(0, personalAttempts);
      return {
        user_id: userId,
        total_attempts: personalAttempts,
        correct_answers: personalCorrect,
        last_seen_at: personalAttempts > 0 ? new Date() : null,
      };
    });

    cards.push({
      study_group_id: studyGroupId,
      creator_id: userIds[0],
      question: qa.question,
      answer: qa.answer,
      tags: qa.tags,
      attachments: [],
      group_stats: [
        {
          study_group_id: studyGroupId,
          total_attempts: totalAttempts,
          correct_answers: correctAnswers,
        },
      ],
      user_stats: userStats,
    });
  });

  await IndexCard.insertMany(cards);
  console.log(`${cards.length} Karteikarten angelegt (Difficulty verteilt über alle 5 Schadensstufen).`);
}

async function createChatMessages(chatId, userIds) {
  const messages = DUMMY_MESSAGES.map((content, i) => ({
    chat_id: chatId,
    sender_id: userIds[i % userIds.length],
    content,
    sent_at: new Date(Date.now() - (DUMMY_MESSAGES.length - i) * 1000 * 60 * 7), // ca. alle 7 Min. gestaffelt
  }));

  await Message.insertMany(messages);
  console.log(`${messages.length} Dummy-Chat-Nachrichten angelegt.`);
}

async function createDummyRuns(studyGroupId, userIds, mapId) {
  const runsToCreate = [
    { userId: userIds[0], correctAnswers: 42, totalAnswers: 45, duration: 620 },
    { userId: userIds[0], correctAnswers: 30, totalAnswers: 38, duration: 900 },
    { userId: userIds[1], correctAnswers: 40, totalAnswers: 44, duration: 540 },
    { userId: userIds[1], correctAnswers: 25, totalAnswers: 33, duration: 780 },
    { userId: userIds[2], correctAnswers: 35, totalAnswers: 40, duration: 610 },
    { userId: userIds[2], correctAnswers: 42, totalAnswers: 45, duration: 500 }, // gleiche correctAnswers wie Run 1, schnellere Zeit -> testet duration-Tiebreak
  ];

  for (const r of runsToCreate) {
    await pool.query(
      `INSERT INTO run
         (user_id, study_group_id, map_id, successful, start_time, duration,
          correct_answers, total_answers, current_position, level, max_health, current_health)
       VALUES ($1, $2, $3, true, NOW() - INTERVAL '1 day', $4, $5, $6, 60, $7, 100, 100)`,
      [
        r.userId,
        studyGroupId,
        mapId,
        r.duration,
        r.correctAnswers,
        r.totalAnswers,
        Math.floor(r.correctAnswers / 10) + 1, // grobes Demo-Level
      ],
    );
  }

  console.log(`${runsToCreate.length} abgeschlossene Dummy-Runs für die Rangliste angelegt.`);
}

async function seed() {
  await connectMongo();

  console.log('Starte Seed der Demo-Lerngruppe...');

  await deleteExistingDemoGroup();

  const userIds = [];
  for (const u of DEMO_USERS) {
    const id = await upsertUser(u.name, u.email);
    console.log(id)
    userIds.push(id);
  }
  console.log(`${userIds.length} Demo-User bereit.`);

  const chatId = randomUUID();
  const groupResult = await pool.query(
    'INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING id',
    [GROUP_NAME, chatId],
  );
  const studyGroupId = groupResult.rows[0].id;
  console.log(`Lerngruppe "${GROUP_NAME}" angelegt (${studyGroupId}).`);

  for (let i = 0; i < DEMO_USERS.length; i++) {
    await pool.query(
      'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
      [userIds[i], studyGroupId, DEMO_USERS[i].role],
    );
  }
  console.log('Mitgliedschaften (ADMIN/MODERATOR/MEMBER) angelegt.');

  await createIndexCards(studyGroupId, userIds);
  await createChatMessages(chatId, userIds);

  const map = await Map.findOne();
  if (!map) {
    console.warn('Keine Map gefunden — Runs werden übersprungen. Vorher "npm run seed" (Map) ausführen.');
  } else {
    await createDummyRuns(studyGroupId, userIds, map.id.toString());
  }

  console.log('\nFertig! Demo-Login (Passkey-Registrierung nötig, da keine Zugangsdaten gesetzt sind):');
  DEMO_USERS.forEach((u) => console.log(`  - ${u.name} <${u.email}> (${u.role})`));
  console.log(`\nLerngruppe: "${GROUP_NAME}" (${studyGroupId})`);

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed fehlgeschlagen:', err);
  process.exit(1);
});