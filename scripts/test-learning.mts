import { applyReview, emptyNotion, masteryScore, reviewQuality } from "../apps/desktop/src/shared/lib/review.ts";
import { classifyError, upsertJournal } from "../apps/desktop/src/shared/lib/errorJournal.ts";
import assert from "node:assert/strict";

const seed = emptyNotion({
  languageId: "python",
  lessonId: "python-l2-print",
  exerciseId: "ex",
  title: "Afficher",
  chapter: 1,
});

assert.equal(reviewQuality({ passed: true, hints: 0, solution: false, attempts: 1 }), 5);
assert.equal(reviewQuality({ passed: false, hints: 0, solution: false, attempts: 1 }), 2);
assert.equal(masteryScore({ successes: 1, failures: 0, hintsUsed: 0, solutionsSeen: 0 }), 22);

const once = applyReview(seed, { passed: true, hints: 0, solution: false, attempts: 1 });
assert.equal(once.mastery, 22);
assert.equal(once.intervalDays, 1);
assert.ok(once.successes === 1);

let card = seed;
for (let i = 0; i < 5; i += 1) {
  card = applyReview(card, { passed: true, hints: 0, solution: false, attempts: 1 });
}
assert.equal(card.mastery, 100);
assert.ok(card.intervalDays >= 3);

const failed = applyReview(card, { passed: false, hints: 1, solution: true, attempts: 2 });
assert.ok(failed.mastery < 100);
assert.equal(failed.intervalDays, 1);
assert.ok(Date.parse(failed.nextReviewAt) <= Date.now() + 1000);

assert.equal(
  classifyError({
    stderr: "SyntaxError: invalid syntax",
    expected: "A",
    got: "",
    outputMatched: false,
    structureRejected: false,
  }),
  "syntax",
);
assert.equal(
  classifyError({
    stderr: "Sortie incorrecte",
    expected: "A",
    got: "B",
    outputMatched: false,
    structureRejected: false,
  }),
  "result",
);
assert.equal(
  classifyError({
    stderr: "utilisez if",
    expected: "A",
    got: "A",
    outputMatched: true,
    structureRejected: true,
  }),
  "logic",
);

const journal = upsertJournal([], {
  id: "1",
  languageId: "python",
  lessonId: "l",
  lessonTitle: "L",
  chapter: 1,
  exerciseId: "e",
  at: new Date().toISOString(),
  kind: "result",
  message: "m",
  expected: "A",
  got: "B",
  attempts: 1,
  hintsUsed: 0,
  solutionConsulted: false,
  understood: false,
  reviewLater: false,
});
const again = upsertJournal(journal, { ...journal[0], attempts: 2, at: new Date().toISOString() });
assert.equal(again.length, 1);
assert.equal(again[0].attempts, 2);

console.log("learning tests ok");
