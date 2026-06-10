import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./fretboard";
import { PracticeRun, generateQuestionSequence } from "./practice";
import { NoteMapRun, createNoteMapQuestion } from "./noteMap";
import {
  HISTORY_STORAGE_KEY,
  LEGACY_MEMORY_STORAGE_KEY,
  MEMORY_STORAGE_KEY,
  clearPracticeRuns,
  loadPracticeMemory,
  loadPracticeRuns,
  saveNoteMapRun,
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
    expect(loadPracticeMemory().schemaVersion).toBe(3);
    expect(loadPracticeMemory().noteMapRuns).toEqual([]);
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

    expect(memory.schemaVersion).toBe(3);
    expect(memory.runs).toEqual([run]);
    expect(window.localStorage.getItem(MEMORY_STORAGE_KEY)).toContain("legacy-run");
  });

  it("migrates v2 memory into v3 memory", () => {
    const question = generateQuestionSequence(DEFAULT_CONFIG, 1, () => 0)[0];
    const run: PracticeRun = {
      id: "v2-run",
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

    window.localStorage.setItem(
      LEGACY_MEMORY_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        createdAt: "2026-06-10T00:00:00.000Z",
        updatedAt: "2026-06-10T00:01:00.000Z",
        runs: [run],
      })
    );

    const memory = loadPracticeMemory();

    expect(memory.schemaVersion).toBe(3);
    expect(memory.runs).toEqual([run]);
    expect(memory.noteMapRuns).toEqual([]);
  });

  it("saves and loads note map runs", () => {
    const question = createNoteMapQuestion(0, DEFAULT_CONFIG);
    const run: NoteMapRun = {
      id: "note-map-run",
      startedAt: "2026-06-10T00:00:00.000Z",
      completedAt: "2026-06-10T00:01:00.000Z",
      config: DEFAULT_CONFIG,
      questions: [
        {
          question,
          clicks: [],
          startedAt: "2026-06-10T00:00:00.000Z",
          completedAt: "2026-06-10T00:00:05.000Z",
          totalElapsedMs: 5000,
        },
      ],
    };

    saveNoteMapRun(run);

    expect(loadPracticeMemory().noteMapRuns).toEqual([run]);
  });
});
