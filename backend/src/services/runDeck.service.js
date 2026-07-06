import { RunDeck } from '../models/mongo/runDeck.model.js';

export async function createRunDeck(runId, deck) {
  return await RunDeck.create({ run_id: runId, deck, discard_pile: [] });
}

export async function findRunDeck(runId) {
  return await RunDeck.findOne({ run_id: runId });
}

export async function drawCards(runId, count) {
  const runDeck = await findRunDeck(runId);
  if (!runDeck) {
    throw new Error('Kein Deck für diesen Run gefunden');
  }

  const actualCount = Math.min(count, runDeck.deck.length);
  const drawn = runDeck.deck.slice(0, actualCount);
  runDeck.deck = runDeck.deck.slice(actualCount);

  await runDeck.save();
  return drawn; // kann weniger als `count` Karten enthalten, oder auch leer sein
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// export async function reshuffleDiscardIntoDeck(runId) {
//   const runDeck = await findRunDeck(runId);
//   if (!runDeck) {
//     throw new Error('Kein Deck für diesen Run gefunden');
//   }

//   runDeck.deck = shuffle(runDeck.discard_pile);
//   runDeck.discard_pile = [];

//   await runDeck.save();
//   return runDeck.deck;
// }

export async function reshuffleDiscardIntoDeck(runId) {
  const runDeck = await findRunDeck(runId);
  if (!runDeck) throw new Error('Kein Deck für diesen Run gefunden');

  runDeck.deck = shuffle([...runDeck.deck, ...runDeck.discard_pile]);
  runDeck.discard_pile = [];

  await runDeck.save();
  return runDeck.deck;
}

export async function discardCard(runId, cardId) {
  const runDeck = await findRunDeck(runId);
  if (!runDeck) {
    throw new Error('Kein Deck für diesen Run gefunden');
  }

  runDeck.discard_pile.push(cardId);
  await runDeck.save();

  return runDeck.discard_pile;
}

export async function returnCardsToDeck(runId, cardIds) {
  const runDeck = await findRunDeck(runId);
  if (!runDeck) {
    throw new Error('Kein Deck für diesen Run gefunden');
  }

  runDeck.deck.push(...cardIds);
  await runDeck.save();

  return runDeck.deck;
}