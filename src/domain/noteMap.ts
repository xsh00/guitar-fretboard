import {
  DEFAULT_CONFIG,
  FretboardPosition,
  PracticeConfig,
  findPositionsForPitchClass,
  positionKey,
} from "./fretboard";

export type NoteMapClick = {
  position: FretboardPosition;
  correct: boolean;
  elapsedMs: number;
  clickedAt: string;
};

export type NoteMapQuestion = {
  id: string;
  targetPitchClass: number;
  positions: FretboardPosition[];
};

export type NoteMapQuestionResult = {
  question: NoteMapQuestion;
  clicks: NoteMapClick[];
  startedAt: string;
  completedAt: string;
  totalElapsedMs: number;
};

export type NoteMapRun = {
  id: string;
  startedAt: string;
  completedAt: string;
  config: PracticeConfig;
  questions: NoteMapQuestionResult[];
};

export type NoteMapQuestionSummary = {
  question: NoteMapQuestion;
  totalClicks: number;
  correctClicks: number;
  wrongClicks: number;
  uniqueWrongPositions: FretboardPosition[];
  totalElapsedMs: number;
};

export type NoteMapRunSummary = {
  questionCount: number;
  totalClicks: number;
  correctClicks: number;
  wrongClicks: number;
  totalElapsedMs: number;
  averageQuestionMs: number;
  weakestPitchClass: number | null;
  weakestString: number | null;
  questionSummaries: NoteMapQuestionSummary[];
};

const PITCH_CLASSES = Array.from({ length: 12 }, (_, index) => index);

function makeQuestionId(targetPitchClass: number): string {
  return `${targetPitchClass}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function shufflePitchClasses(rng: () => number = Math.random): number[] {
  const values = [...PITCH_CLASSES];

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }

  return values;
}

export function createNoteMapQuestion(
  targetPitchClass: number,
  config: PracticeConfig = DEFAULT_CONFIG
): NoteMapQuestion {
  return {
    id: makeQuestionId(targetPitchClass),
    targetPitchClass,
    positions: findPositionsForPitchClass(targetPitchClass, config),
  };
}

export function createNoteMapSession(
  config: PracticeConfig = DEFAULT_CONFIG,
  rng: () => number = Math.random
): NoteMapQuestion[] {
  return shufflePitchClasses(rng).map((pitchClass) =>
    createNoteMapQuestion(pitchClass, config)
  );
}

export function isCorrectNoteMapPosition(
  question: NoteMapQuestion,
  position: Pick<FretboardPosition, "string" | "fret">
): boolean {
  const key = positionKey(position);
  return question.positions.some((candidate) => positionKey(candidate) === key);
}

export function isDuplicateCorrectClick(
  question: NoteMapQuestion,
  clicks: NoteMapClick[],
  position: Pick<FretboardPosition, "string" | "fret">
): boolean {
  const key = positionKey(position);
  return (
    isCorrectNoteMapPosition(question, position) &&
    clicks.some((click) => click.correct && positionKey(click.position) === key)
  );
}

export function createNoteMapClick(
  question: NoteMapQuestion,
  position: FretboardPosition,
  elapsedMs: number,
  clickedAt = new Date().toISOString()
): NoteMapClick {
  return {
    position,
    correct: isCorrectNoteMapPosition(question, position),
    elapsedMs: Math.max(1, Math.round(elapsedMs)),
    clickedAt,
  };
}

export function getFoundPositionKeys(clicks: NoteMapClick[]): string[] {
  return Array.from(
    new Set(
      clicks
        .filter((click) => click.correct)
        .map((click) => positionKey(click.position))
    )
  );
}

export function isNoteMapQuestionComplete(
  question: NoteMapQuestion,
  clicks: NoteMapClick[]
): boolean {
  const foundKeys = new Set(getFoundPositionKeys(clicks));
  return question.positions.every((position) => foundKeys.has(positionKey(position)));
}

export function createNoteMapQuestionSummary(
  result: NoteMapQuestionResult
): NoteMapQuestionSummary {
  const uniqueWrongMap = new Map<string, FretboardPosition>();

  for (const click of result.clicks) {
    if (!click.correct) {
      uniqueWrongMap.set(positionKey(click.position), click.position);
    }
  }

  const correctClicks = result.clicks.filter((click) => click.correct).length;
  const wrongClicks = result.clicks.length - correctClicks;

  return {
    question: result.question,
    totalClicks: result.clicks.length,
    correctClicks,
    wrongClicks,
    uniqueWrongPositions: Array.from(uniqueWrongMap.values()),
    totalElapsedMs: result.totalElapsedMs,
  };
}

export function createNoteMapRunSummary(run: NoteMapRun): NoteMapRunSummary {
  const questionSummaries = run.questions.map(createNoteMapQuestionSummary);
  const totalClicks = questionSummaries.reduce(
    (sum, question) => sum + question.totalClicks,
    0
  );
  const correctClicks = questionSummaries.reduce(
    (sum, question) => sum + question.correctClicks,
    0
  );
  const wrongClicks = totalClicks - correctClicks;
  const totalElapsedMs = questionSummaries.reduce(
    (sum, question) => sum + question.totalElapsedMs,
    0
  );
  const pitchScores = new Map<number, number>();
  const stringScores = new Map<number, number>();

  for (const question of questionSummaries) {
    pitchScores.set(
      question.question.targetPitchClass,
      (pitchScores.get(question.question.targetPitchClass) ?? 0) +
        question.totalElapsedMs +
        question.wrongClicks * 1800
    );

    for (const click of question.question.positions) {
      stringScores.set(click.string, stringScores.get(click.string) ?? 0);
    }

    for (const wrongPosition of question.uniqueWrongPositions) {
      stringScores.set(
        wrongPosition.string,
        (stringScores.get(wrongPosition.string) ?? 0) + 1800
      );
    }
  }

  const weakestPitchClass =
    Array.from(pitchScores.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    null;
  const weakestString =
    Array.from(stringScores.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    null;

  return {
    questionCount: run.questions.length,
    totalClicks,
    correctClicks,
    wrongClicks,
    totalElapsedMs,
    averageQuestionMs: run.questions.length
      ? Math.round(totalElapsedMs / run.questions.length)
      : 0,
    weakestPitchClass,
    weakestString,
    questionSummaries,
  };
}
