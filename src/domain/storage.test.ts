import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./fretboard";
import { PracticeRun, generateQuestionSequence } from "./practice";
import { NoteMapRun, createNoteMapQuestion } from "./noteMap";
import {
  ScalePatternRun,
  createScalePatternQuestion,
  SCALE_PATTERN_STARTS,
} from "./scalePattern";
import {
  HISTORY_STORAGE_KEY,
  LEGACY_MEMORY_STORAGE_KEY,
  LEGACY_V3_MEMORY_STORAGE_KEY,
  MEMORY_STORAGE_KEY,
  clearPracticeRuns,
  loadPracticeMemory,
  loadPracticeRuns,
  saveNoteMapRun,
  savePracticeRun,
  saveScalePatternRun,
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
    expect(loadPracticeMemory().schemaVersion).toBe(4);
    expect(loadPracticeMemory().noteMapRuns).toEqual([]);
    expect(loadPracticeMemory().scalePatternRuns).toEqual([]);
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

    expect(memory.schemaVersion).toBe(4);
    expect(memory.runs).toEqual([run]);
    expect(window.localStorage.getItem(MEMORY_STORAGE_KEY)).toContain("legacy-run");
  });

  it("migrates v2 memory into v4 memory", () => {
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

    expect(memory.schemaVersion).toBe(4);
    expect(memory.runs).toEqual([run]);
    expect(memory.noteMapRuns).toEqual([]);
    expect(memory.scalePatternRuns).toEqual([]);
  });

  it("migrates v3 memory into v4 memory", () => {
    const question = generateQuestionSequence(DEFAULT_CONFIG, 1, () => 0)[0];
    const run: PracticeRun = {
      id: "v3-run",
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
    const noteMapRun: NoteMapRun = {
      id: "v3-note-map-run",
      startedAt: "2026-06-10T00:00:00.000Z",
      completedAt: "2026-06-10T00:01:00.000Z",
      config: DEFAULT_CONFIG,
      questions: [],
    };

    window.localStorage.setItem(
      LEGACY_V3_MEMORY_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 3,
        createdAt: "2026-06-10T00:00:00.000Z",
        updatedAt: "2026-06-10T00:01:00.000Z",
        runs: [run],
        noteMapRuns: [noteMapRun],
      })
    );

    const memory = loadPracticeMemory();

    expect(memory.schemaVersion).toBe(4);
    expect(memory.runs).toEqual([run]);
    expect(memory.noteMapRuns).toEqual([noteMapRun]);
    expect(memory.scalePatternRuns).toEqual([]);
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

  it("saves and loads scale pattern runs", () => {
    const question = createScalePatternQuestion(SCALE_PATTERN_STARTS[0], "ascending");
    const run: ScalePatternRun = {
      id: "scale-pattern-run",
      startedAt: "2026-06-10T00:00:00.000Z",
      completedAt: "2026-06-10T00:01:00.000Z",
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

    saveScalePatternRun(run);

    expect(loadPracticeMemory().scalePatternRuns).toEqual([run]);
  });
});
