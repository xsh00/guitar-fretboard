import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./fretboard";
import { PracticeRun, generateQuestionSequence } from "./practice";
import {
  createAnswerCsvExport,
  createJsonExport,
  createWeakPointCsvExport,
} from "./export";
import { PracticeMemory } from "./storage";

function makeMemory(): PracticeMemory {
  const question = generateQuestionSequence(DEFAULT_CONFIG, 1, () => 0)[0];
  const run: PracticeRun = {
    id: "run-1",
    startedAt: "2026-06-10T00:00:00.000Z",
    completedAt: "2026-06-10T00:01:00.000Z",
    config: DEFAULT_CONFIG,
    answers: [
      {
        question,
        input: "F",
        correct: true,
        elapsedMs: 900,
        answeredAt: "2026-06-10T00:00:01.000Z",
      },
    ],
  };

  return {
    schemaVersion: 2,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:01:00.000Z",
    runs: [run],
  };
}

describe("practice export", () => {
  it("creates a full JSON export bundle", () => {
    const parsed = JSON.parse(createJsonExport(makeMemory()));

    expect(parsed.app).toBe("fretboard-reaction");
    expect(parsed.memory.runs[0].id).toBe("run-1");
    expect(parsed.progress.totalAnswers).toBe(1);
    expect(parsed.weakPoints).toHaveLength(1);
  });

  it("creates answer-level CSV", () => {
    const csv = createAnswerCsvExport(makeMemory());

    expect(csv).toContain("run_id,run_started_at");
    expect(csv).toContain("run-1");
    expect(csv).toContain("1弦 1品");
  });

  it("creates weak-point CSV", () => {
    const csv = createWeakPointCsvExport(makeMemory());

    expect(csv).toContain("position_key,string,fret");
    expect(csv).toContain("1-1");
    expect(csv).toContain("1.0000");
  });
});
