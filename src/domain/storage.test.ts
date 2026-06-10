import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./fretboard";
import { PracticeRun, generateQuestionSequence } from "./practice";
import {
  HISTORY_STORAGE_KEY,
  MEMORY_STORAGE_KEY,
  clearPracticeRuns,
  loadPracticeMemory,
  loadPracticeRuns,
  savePracticeRun,
} from "./storage";

describe("practice history storage", () => {
  beforeEach(() => {
    clearPracticeRuns();
  });

  it("saves and loads practice runs", () => {
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

    savePracticeRun(run);

    expect(loadPracticeRuns()).toEqual([run]);
    expect(loadPracticeMemory().schemaVersion).toBe(2);
  });

  it("returns an empty list for corrupted history", () => {
    window.localStorage.setItem(MEMORY_STORAGE_KEY, "{broken");

    expect(loadPracticeRuns()).toEqual([]);
  });

  it("migrates v1 history into versioned memory", () => {
    const question = generateQuestionSequence(DEFAULT_CONFIG, 1, () => 0)[0];
    const run: PracticeRun = {
      id: "legacy-run",
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

    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([run]));

    const memory = loadPracticeMemory();

    expect(memory.schemaVersion).toBe(2);
    expect(memory.runs).toEqual([run]);
    expect(window.localStorage.getItem(MEMORY_STORAGE_KEY)).toContain("legacy-run");
  });
});
