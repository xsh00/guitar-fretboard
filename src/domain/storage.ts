import { PracticeRun } from "./practice";

export const HISTORY_STORAGE_KEY = "fretboard-reaction-history-v1";
export const MEMORY_STORAGE_KEY = "fretboard-reaction-memory-v2";
const MAX_HISTORY_RUNS = 365;

export type PracticeMemory = {
  schemaVersion: 2;
  createdAt: string;
  updatedAt: string;
  runs: PracticeRun[];
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
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
    runs: [],
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
      const parsed = JSON.parse(rawMemory) as Partial<PracticeMemory>;

      if (parsed.schemaVersion === 2 && Array.isArray(parsed.runs)) {
        return {
          schemaVersion: 2,
          createdAt: parsed.createdAt ?? empty.createdAt,
          updatedAt: parsed.updatedAt ?? empty.updatedAt,
          runs: normalizeRuns(parsed.runs),
        };
      }
    } catch {
      return empty;
    }
  }

  const migratedRuns = parseV1Runs(window.localStorage.getItem(HISTORY_STORAGE_KEY));

  if (!migratedRuns.length) {
    return empty;
  }

  const migratedMemory: PracticeMemory = {
    schemaVersion: 2,
    createdAt: migratedRuns[migratedRuns.length - 1].completedAt ?? empty.createdAt,
    updatedAt: new Date().toISOString(),
    runs: migratedRuns,
  };

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

export function clearPracticeRuns(): void {
  if (canUseStorage()) {
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    window.localStorage.removeItem(MEMORY_STORAGE_KEY);
  }
}
