import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, positionKey } from "./fretboard";
import {
  PracticeAnswer,
  createPracticeSummary,
  generateQuestionSequence,
} from "./practice";

describe("practice engine", () => {
  it("generates a sequence without immediate repeated positions", () => {
    const questions = generateQuestionSequence(DEFAULT_CONFIG, 80, () => 0);

    for (let index = 1; index < questions.length; index += 1) {
      expect(positionKey(questions[index].position)).not.toBe(
        positionKey(questions[index - 1].position)
      );
    }
  });

  it("summarizes speed, accuracy, mistakes, and slow positions", () => {
    const questions = generateQuestionSequence(DEFAULT_CONFIG, 3, () => 0);
    const answers: PracticeAnswer[] = [
      {
        question: questions[0],
        input: "F",
        correct: true,
        elapsedMs: 1000,
        answeredAt: "2026-06-10T00:00:00.000Z",
      },
      {
        question: questions[1],
        input: "C",
        correct: false,
        elapsedMs: 2400,
        answeredAt: "2026-06-10T00:00:01.000Z",
      },
      {
        question: questions[2],
        input: "F",
        correct: true,
        elapsedMs: 1600,
        answeredAt: "2026-06-10T00:00:02.000Z",
      },
    ];

    const summary = createPracticeSummary(answers);

    expect(summary.total).toBe(3);
    expect(summary.correct).toBe(2);
    expect(summary.accuracy).toBeCloseTo(2 / 3);
    expect(summary.averageMs).toBe(1667);
    expect(summary.medianMs).toBe(1600);
    expect(summary.slowest[0].elapsedMs).toBe(2400);
    expect(summary.mistakes).toHaveLength(1);
    expect(summary.positionStats[0].score).toBeGreaterThan(summary.positionStats[1].score);
  });
});
