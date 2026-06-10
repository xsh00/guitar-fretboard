import { PracticeRun } from "./practice";
import { NoteMapRun } from "./noteMap";

export const HISTORY_STORAGE_KEY = "fretboard-reaction-history-v1";
export const LEGACY_MEMORY_STORAGE_KEY = "fretboard-reaction-memory-v2";
export const MEMORY_STORAGE_KEY = "fretboard-reaction-memory-v3";
const MAX_HISTORY_RUNS = 365;

export type PracticeMemory = {
  schemaVersion: 3;
  createdAt: string;
  updatedAt: string;
  runs: PracticeRun[];
  noteMapRuns: NoteMapRun[];
};

type StoredPracticeMemory = {
  schemaVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  runs?: PracticeRun[];
  noteMapRuns?: NoteMapRun[];
};

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    typeof window.localStorage.getItem === "function" &&
    typeof window.localStorage.setItem === "function" &&
    typeof window.localStorage.removeItem === "function"
  );
}

function createEmptyMemory(): PracticeMemory {
  const now = new Date().toISOString();

  return {
    schemaVersion: 3,
    createdAt: now,
    updatedAt: now,
    runs: [],
    noteMapRuns: [],
  };
}

function normalizeRuns(runs: PracticeRun[]): PracticeRun[] {
  return [...runs]
    .filter((run) => run && Array.isArray(run.answers))
    .sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    )
    .slice(0, MAX_HISTORY_RUNS);
}

function normalizeNoteMapRuns(runs: NoteMapRun[]): NoteMapRun[] {
  return [...runs]
    .filter((run) => run && Array.isArray(run.questions))
    .sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    )
    .slice(0, MAX_HISTORY_RUNS);
}

function parseV1Runs(raw: string | null): PracticeRun[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeRuns(parsed as PracticeRun[]) : [];
  } catch {
    return [];
  }
}

function createMemoryFromRuns(
  runs: PracticeRun[],
  noteMapRuns: NoteMapRun[] = [],
  createdAt?: string,
  updatedAt?: string
): PracticeMemory {
  const now = new Date().toISOString();

  return {
    schemaVersion: 3,
    createdAt: createdAt ?? runs[runs.length - 1]?.completedAt ?? noteMapRuns[noteMapRuns.length - 1]?.completedAt ?? now,
    updatedAt: updatedAt ?? now,
    runs: normalizeRuns(runs),
    noteMapRuns: normalizeNoteMapRuns(noteMapRuns),
  };
}

function persistPracticeMemory(memory: PracticeMemory): void {
  if (canUseStorage()) {
    window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memory));
  }
}

export function loadPracticeMemory(): PracticeMemory {
  const empty = createEmptyMemory();

  if (!canUseStorage()) {
    return empty;
  }

  const rawMemory = window.localStorage.getItem(MEMORY_STORAGE_KEY);

  if (rawMemory) {
    try {
      const parsed = JSON.parse(rawMemory) as StoredPracticeMemory;

      if (parsed.schemaVersion === 3 && Array.isArray(parsed.runs)) {
        return createMemoryFromRuns(
          parsed.runs,
          Array.isArray(parsed.noteMapRuns) ? parsed.noteMapRuns : [],
          parsed.createdAt ?? empty.createdAt,
          parsed.updatedAt ?? empty.updatedAt
        );
      }
    } catch {
      return empty;
    }
  }

  const rawLegacyMemory = window.localStorage.getItem(LEGACY_MEMORY_STORAGE_KEY);

  if (rawLegacyMemory) {
    try {
      const parsed = JSON.parse(rawLegacyMemory) as StoredPracticeMemory;

      if (parsed.schemaVersion === 2 && Array.isArray(parsed.runs)) {
        const migrated = createMemoryFromRuns(
          parsed.runs,
          [],
          parsed.createdAt ?? empty.createdAt,
          new Date().toISOString()
        );

        persistPracticeMemory(migrated);

        return migrated;
      }
    } catch {
      return empty;
    }
  }

  const migratedRuns = parseV1Runs(window.localStorage.getItem(HISTORY_STORAGE_KEY));

  if (!migratedRuns.length) {
    return empty;
  }

  const migratedMemory = createMemoryFromRuns(
    migratedRuns,
    [],
    migratedRuns[migratedRuns.length - 1].completedAt ?? empty.createdAt,
    new Date().toISOString()
  );

  persistPracticeMemory(migratedMemory);

  return migratedMemory;
}

export function loadPracticeRuns(): PracticeRun[] {
  return loadPracticeMemory().runs;
}

export function savePracticeRun(run: PracticeRun): PracticeMemory {
  const memory = loadPracticeMemory();
  const nextMemory: PracticeMemory = {
    ...memory,
    updatedAt: new Date().toISOString(),
    runs: normalizeRuns([run, ...memory.runs]),
  };

  persistPracticeMemory(nextMemory);

  return nextMemory;
}

export function saveNoteMapRun(run: NoteMapRun): PracticeMemory {
  const memory = loadPracticeMemory();
  const nextMemory: PracticeMemory = {
    ...memory,
    updatedAt: new Date().toISOString(),
    noteMapRuns: normalizeNoteMapRuns([run, ...memory.noteMapRuns]),
  };

  persistPracticeMemory(nextMemory);

  return nextMemory;
}

export function clearPracticeRuns(): void {
  if (canUseStorage()) {
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_MEMORY_STORAGE_KEY);
    window.localStorage.removeItem(MEMORY_STORAGE_KEY);
  }
}
