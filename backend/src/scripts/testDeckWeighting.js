// backend/src/scripts/testDeckWeighting.js
import { connectMongo } from '../config/db.mongo.js';
import { pool } from '../config/db.postgres.js';
import * as IndexCardService from '../services/indexCard.service.js';
import { buildRunDeck } from '../services/deckBuilder.service.js';

const STUDY_GROUP_ID = process.argv[2]; // als Argument übergeben
const USER_ID = process.argv[3];
const ITERATIONS = 200;

await connectMongo();

const cards = await IndexCardService.getIndexCards(STUDY_GROUP_ID, undefined, undefined, undefined, USER_ID);

const drawCount = new Map();
cards.forEach((c) => drawCount.set(c.id.toString(), 0));

for (let i = 0; i < ITERATIONS; i++) {
  const deckIds = await buildRunDeck(cards, USER_ID);
  deckIds.forEach((id) => {
    const key = id.toString();
    drawCount.set(key, (drawCount.get(key) || 0) + 1);
  });
}

console.log(`\nErgebnis nach ${ITERATIONS} simulierten Deck-Ziehungen:\n`);
console.log('Frage'.padEnd(50), 'gezogen', 'meine Erfolgsquote');

cards.forEach((c) => {
  const stat = c.user_stats.find((s) => s.user_id === USER_ID);
  const rate = stat && stat.total_attempts > 0
    ? `${Math.round((stat.correct_answers / stat.total_attempts) * 100)}% (${stat.total_attempts}x)`
    : 'nie versucht';
  const count = drawCount.get(c.id.toString());
  console.log(c.question.slice(0, 48).padEnd(50), String(count).padEnd(8), rate);
});

process.exit(0);