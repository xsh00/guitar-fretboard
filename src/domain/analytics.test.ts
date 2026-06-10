import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./fretboard";
import { PracticeRun, generateQuestionSequence } from "./practice";
import { createProgressSummary, createRunTrend, createWeakPointStats } from "./analytics";

function makeRun(id: string, completedAt: string, elapsedMs: number, correct: boolean): PracticeRun {
  const question = generateQuestionSequence(DEFAULT_CONFIG, 1, () => 0)[0];

  return {
    id,
    startedAt: completedAt,
    completedAt,
    config: DEFAULT_CONFIG,
    answers: [
      {
        question,
        input: correct ? "F" : "C",
        correct,
        elapsedMs,
        answeredAt: completedAt,
      },
    ],
  };
}

describe("practice analytics", () => {
  it("summarizes progress across saved runs", () => {
    const runs = [
      makeRun("new", "2026-06-11T00:00:00.000Z", 900, true),
      makeRun("old", "2026-06-10T00:00:00.000Z", 2100, false),
    ];

    const summary = createProgressSummary(runs);

    expect(summary.runCount).toBe(2);
    expect(summary.totalAnswers).toBe(2);
    expect(summary.totalCorrect).toBe(1);
    expect(summary.accuracy).toBe(0.5);
    expect(summary.averageMs).toBe(1500);
    expect(summary.firstRunAt).toBe("2026-06-10T00:00:00.000Z");
    expect(summary.lastRunAt).toBe("2026-06-11T00:00:00.000Z");
  });

  it("ranks weak points by mistakes and speed", () => {
    const runs = [
      makeRun("slow-wrong", "2026-06-11T00:00:00.000Z", 2600, false),
      makeRun("fast-right", "2026-06-10T00:00:00.000Z", 800, true),
    ];

    const weakPoints = createWeakPointStats(runs);

    expect(weakPoints[0].attempts).toBe(2);
    expect(weakPoints[0].correct).toBe(1);
    expect(weakPoints[0].mistakes).toBe(1);
    expect(weakPoints[0].averageMs).toBe(1700);
    expect(weakPoints[0].score).toBeGreaterThan(weakPoints[0].averageMs);
  });

  it("returns run trend from oldest to newest", () => {
    const trend = createRunTrend([
      makeRun("new", "2026-06-11T00:00:00.000Z", 900, true),
      makeRun("old", "2026-06-10T00:00:00.000Z", 2100, false),
    ]);

    expect(trend.map((point) => point.runId)).toEqual(["old", "new"]);
  });
});
