import {
  DEFAULT_CONFIG,
  FretboardPosition,
  PracticeConfig,
  buildFretboardPositions,
  positionKey,
} from "./fretboard";
import { PracticeAnswer, PracticeRun, createPracticeSummary } from "./practice";
import { NoteMapRun } from "./noteMap";

export type ProgressSummary = {
  runCount: number;
  totalAnswers: number;
  totalCorrect: number;
  accuracy: number;
  averageMs: number;
  medianMs: number;
  firstRunAt: string | null;
  lastRunAt: string | null;
  recentAccuracy: number;
  recentAverageMs: number;
  accuracyDelta: number;
  averageMsDelta: number;
};

export type RunTrendPoint = {
  runId: string;
  completedAt: string;
  total: number;
  correct: number;
  mistakes: number;
  accuracy: number;
  averageMs: number;
  medianMs: number;
};

export type WeakPointStat = {
  key: string;
  position: FretboardPosition;
  attempts: number;
  correct: number;
  mistakes: number;
  accuracy: number;
  averageMs: number;
  lastAttemptedAt: string;
  score: number;
};

export type NoteMapWeakPointStat = {
  key: string;
  dimension: "note" | "string" | "note-string";
  targetPitchClass: number | null;
  string: number | null;
  attempts: number;
  wrongClicks: number;
  averageMs: number;
  score: number;
};

export type NoteMapWeakPointSummary = {
  byNote: NoteMapWeakPointStat[];
  byString: NoteMapWeakPointStat[];
  byNoteString: NoteMapWeakPointStat[];
};

function flattenAnswers(runs: PracticeRun[]): PracticeAnswer[] {
  return runs.flatMap((run) => run.answers);
}

function summarizeRuns(runs: PracticeRun[]) {
  return createPracticeSummary(flattenAnswers(runs));
}

function average(values: number[]): number {
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
}

export function createRunTrend(runs: PracticeRun[]): RunTrendPoint[] {
  return [...runs]
    .sort(
      (a, b) =>
        new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    )
    .map((run) => {
      const summary = createPracticeSummary(run.answers);

      return {
        runId: run.id,
        completedAt: run.completedAt,
        total: summary.total,
        correct: summary.correct,
        mistakes: summary.total - summary.correct,
        accuracy: summary.accuracy,
        averageMs: summary.averageMs,
        medianMs: summary.medianMs,
      };
    });
}

export function createProgressSummary(runs: PracticeRun[]): ProgressSummary {
  const allSummary = summarizeRuns(runs);
  const orderedRuns = [...runs].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
  const recentRuns = orderedRuns.slice(0, 5);
  const previousRuns = orderedRuns.slice(5, 10);
  const recentSummary = summarizeRuns(recentRuns);
  const previousSummary = summarizeRuns(previousRuns);
  const completedTimes = orderedRuns
    .map((run) => run.completedAt)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return {
    runCount: runs.length,
    totalAnswers: allSummary.total,
    totalCorrect: allSummary.correct,
    accuracy: allSummary.accuracy,
    averageMs: allSummary.averageMs,
    medianMs: allSummary.medianMs,
    firstRunAt: completedTimes[0] ?? null,
    lastRunAt: completedTimes[completedTimes.length - 1] ?? null,
    recentAccuracy: recentSummary.accuracy,
    recentAverageMs: recentSummary.averageMs,
    accuracyDelta: previousSummary.total
      ? recentSummary.accuracy - previousSummary.accuracy
      : 0,
    averageMsDelta: previousSummary.total
      ? previousSummary.averageMs - recentSummary.averageMs
      : 0,
  };
}

export function createWeakPointStats(
  runs: PracticeRun[],
  config: PracticeConfig = DEFAULT_CONFIG
): WeakPointStat[] {
  const positionMap = new Map(
    buildFretboardPositions(config).map((position) => [positionKey(position), position])
  );
  const groups = new Map<string, PracticeAnswer[]>();

  for (const answer of flattenAnswers(runs)) {
    const key = positionKey(answer.question.position);
    const current = groups.get(key) ?? [];
    current.push(answer);
    groups.set(key, current);

    if (!positionMap.has(key)) {
      positionMap.set(key, answer.question.position);
    }
  }

  return Array.from(groups.entries())
    .map(([key, answers]) => {
      const attempts = answers.length;
      const correct = answers.filter((answer) => answer.correct).length;
      const mistakes = attempts - correct;
      const averageMs = average(answers.map((answer) => answer.elapsedMs));
      const accuracy = attempts ? correct / attempts : 0;
      const lastAttemptedAt = answers
        .map((answer) => answer.answeredAt)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
      const position = positionMap.get(key) ?? answers[0].question.position;

      return {
        key,
        position,
        attempts,
        correct,
        mistakes,
        accuracy,
        averageMs,
        lastAttemptedAt,
        score: Math.round(averageMs + mistakes * 1800 + (1 - accuracy) * 900),
      };
    })
    .sort((a, b) => b.score - a.score);
}

function pushStatValue(
  map: Map<string, { values: number[]; wrongClicks: number; attempts: number }>,
  key: string,
  elapsedMs: number,
  wrongClicks = 0
) {
  const current = map.get(key) ?? { values: [], wrongClicks: 0, attempts: 0 };

  current.values.push(elapsedMs);
  current.wrongClicks += wrongClicks;
  current.attempts += 1;
  map.set(key, current);
}

function toNoteMapStats(
  map: Map<string, { values: number[]; wrongClicks: number; attempts: number }>,
  dimension: NoteMapWeakPointStat["dimension"],
  parseKey: (key: string) => Pick<NoteMapWeakPointStat, "targetPitchClass" | "string">
): NoteMapWeakPointStat[] {
  return Array.from(map.entries())
    .map(([key, stat]) => {
      const averageMs = average(stat.values);
      const parsed = parseKey(key);

      return {
        key,
        dimension,
        targetPitchClass: parsed.targetPitchClass,
        string: parsed.string,
        attempts: stat.attempts,
        wrongClicks: stat.wrongClicks,
        averageMs,
        score: Math.round(averageMs + stat.wrongClicks * 1600),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function createNoteMapWeakPointStats(
  runs: NoteMapRun[]
): NoteMapWeakPointSummary {
  const byNote = new Map<string, { values: number[]; wrongClicks: number; attempts: number }>();
  const byString = new Map<string, { values: number[]; wrongClicks: number; attempts: number }>();
  const byNoteString = new Map<string, { values: number[]; wrongClicks: number; attempts: number }>();

  for (const run of runs) {
    for (const question of run.questions) {
      const wrongClicks = question.clicks.filter((click) => !click.correct).length;
      const noteKey = String(question.question.targetPitchClass);
      pushStatValue(byNote, noteKey, question.totalElapsedMs, wrongClicks);

      for (const click of question.clicks) {
        const stringKey = String(click.position.string);
        const noteStringKey = `${question.question.targetPitchClass}-${click.position.string}`;
        pushStatValue(byString, stringKey, click.elapsedMs, click.correct ? 0 : 1);
        pushStatValue(byNoteString, noteStringKey, click.elapsedMs, click.correct ? 0 : 1);
      }
    }
  }

  return {
    byNote: toNoteMapStats(byNote, "note", (key) => ({
      targetPitchClass: Number(key),
      string: null,
    })),
    byString: toNoteMapStats(byString, "string", (key) => ({
      targetPitchClass: null,
      string: Number(key),
    })),
    byNoteString: toNoteMapStats(byNoteString, "note-string", (key) => {
      const [targetPitchClass, string] = key.split("-").map(Number);
      return { targetPitchClass, string };
    }),
  };
}
