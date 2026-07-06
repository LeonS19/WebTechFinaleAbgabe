import * as IndexCardService from './indexCard.service.js';

const CONFIDENCE_THRESHOLD = 10; // Versuche, ab denen die Statistik als verlässlich gilt
const DECK_SIZE = 20;

function calculateCardWeight(card, userId) {
  const userStat = card.user_stats.find(s => s.user_Id === userId);

  if (!userStat || userStat.total_attempts === 0) { //Karte wurde noch nie abgefragt
    return 1.0;
  }

  const successRate = userStat.correct_answers / userStat.total_attempts;
  const confidence = Math.min(userStat.total_attempts / CONFIDENCE_THRESHOLD, 1);

   // wenig Versuche → Gewicht bleibt nah an 1 (unsicher, eher wieder zeigen)
  // viele Versuche + gute successRate → Gewicht sinkt stark
  return 1.0 - (successRate * confidence);
}

function weightedSampleWithoutReplacement(cards, weights, count) {
  const pool = cards.map((card, i) => ({ card, weight: weights[i] }));
  const selected = [];

  while (selected.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    let index = 0;
    while (random > pool[index].weight) {
      random -= pool[index].weight;
      index++;
    }

    selected.push(pool[index].card);
    pool.splice(index, 1);
  }

  return selected;
}

// Einziger "öffentlicher" Export — wird von run.service.js aufgerufen
export async function buildRunDeck(cards, userId) {
  const weights = cards.map(card => calculateCardWeight(card, userId));
  const deckSize = Math.min(DECK_SIZE, cards.length);

  const drawnCards = weightedSampleWithoutReplacement(cards, weights, deckSize);
  return drawnCards.map(c => c.id);
}