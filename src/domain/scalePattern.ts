import {
  FretboardPosition,
  GuitarString,
  SHARP_NOTE_NAMES,
  getPitchClassForPosition,
  positionKey,
  wrapPitchClass,
} from "./fretboard";

export type ScalePatternDirection = "ascending" | "descending";

export type ScalePatternStart = {
  noteName: "F" | "G" | "A" | "B" | "C" | "D" | "E";
  pitchClass: number;
  string: 6;
  fret: number;
};

export type ScalePatternStep = {
  index: number;
  noteName: string;
  position: FretboardPosition;
};

export type ScalePatternQuestion = {
  id: string;
  start: ScalePatternStart;
  direction: ScalePatternDirection;
  ascendingSteps: ScalePatternStep[];
  steps: ScalePatternStep[];
};

export type ScalePatternClick = {
  stepIndex: number;
  expected: FretboardPosition;
  position: FretboardPosition;
  correct: boolean;
  elapsedMs: number;
  clickedAt: string;
};

export type ScalePatternQuestionResult = {
  question: ScalePatternQuestion;
  clicks: ScalePatternClick[];
  startedAt: string;
  completedAt: string;
  totalElapsedMs: number;
};

export type ScalePatternRun = {
  id: string;
  startedAt: string;
  completedAt: string;
  questions: ScalePatternQuestionResult[];
};

export type ScalePatternQuestionSummary = {
  question: ScalePatternQuestion;
  totalClicks: number;
  correctClicks: number;
  wrongClicks: number;
  totalElapsedMs: number;
};

export type ScalePatternRunSummary = {
  questionCount: number;
  totalClicks: number;
  correctClicks: number;
  wrongClicks: number;
  totalElapsedMs: number;
  averageQuestionMs: number;
  weakestStartNote: string | null;
  weakestDirection: ScalePatternDirection | null;
  questionSummaries: ScalePatternQuestionSummary[];
};

const C_MAJOR_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];
const SCALE_STRINGS: GuitarString[] = [6, 5, 4, 3, 2, 1];
const NOTES_PER_STRING = [3, 3, 3, 3, 2, 3];
const SCALE_PATTERN_MIN_FRET = 1;
const SCALE_PATTERN_MAX_FRET = 16;

export const SCALE_PATTERN_FRETS = Array.from(
  { length: SCALE_PATTERN_MAX_FRET },
  (_, index) => index + 1
);

export const SCALE_PATTERN_STARTS: ScalePatternStart[] = [
  { noteName: "F", pitchClass: 5, string: 6, fret: 1 },
  { noteName: "G", pitchClass: 7, string: 6, fret: 3 },
  { noteName: "A", pitchClass: 9, string: 6, fret: 5 },
  { noteName: "B", pitchClass: 11, string: 6, fret: 7 },
  { noteName: "C", pitchClass: 0, string: 6, fret: 8 },
  { noteName: "D", pitchClass: 2, string: 6, fret: 10 },
  { noteName: "E", pitchClass: 4, string: 6, fret: 12 },
];

function makeQuestionId(start: ScalePatternStart, direction: ScalePatternDirection): string {
  return `${start.noteName}-${direction}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function nextScalePitchClass(current: number): number {
  const currentIndex = C_MAJOR_PITCH_CLASSES.indexOf(wrapPitchClass(current));

  if (currentIndex === -1) {
    throw new Error(`Pitch class ${current} is not in C major`);
  }

  return C_MAJOR_PITCH_CLASSES[(currentIndex + 1) % C_MAJOR_PITCH_CLASSES.length];
}

function findFretInPatternWindow(
  string: GuitarString,
  pitchClass: number,
  startFret: number
): number {
  for (
    let fret = Math.max(SCALE_PATTERN_MIN_FRET, startFret);
    fret <= Math.min(SCALE_PATTERN_MAX_FRET, startFret + 4);
    fret += 1
  ) {
    if (getPitchClassForPosition(string, fret) === wrapPitchClass(pitchClass)) {
      return fret;
    }
  }

  throw new Error(
    `No fret found for ${SHARP_NOTE_NAMES[wrapPitchClass(pitchClass)]} on string ${string}`
  );
}

export function createAscendingScalePatternSteps(
  start: ScalePatternStart
): ScalePatternStep[] {
  const steps: ScalePatternStep[] = [];
  let pitchClass = start.pitchClass;

  for (const [stringIndex, string] of SCALE_STRINGS.entries()) {
    const noteCount = NOTES_PER_STRING[stringIndex];

    for (let noteIndex = 0; noteIndex < noteCount; noteIndex += 1) {
      const fret = findFretInPatternWindow(string, pitchClass, start.fret);
      steps.push({
        index: steps.length,
        noteName: SHARP_NOTE_NAMES[wrapPitchClass(pitchClass)],
        position: {
          string,
          fret,
          pitchClass: wrapPitchClass(pitchClass),
        },
      });
      pitchClass = nextScalePitchClass(pitchClass);
    }
  }

  return steps;
}

export function createScalePatternQuestion(
  start: ScalePatternStart,
  direction: ScalePatternDirection
): ScalePatternQuestion {
  const ascendingSteps = createAscendingScalePatternSteps(start);
  const orderedSteps =
    direction === "ascending" ? ascendingSteps : [...ascendingSteps].reverse();

  return {
    id: makeQuestionId(start, direction),
    start,
    direction,
    ascendingSteps,
    steps: orderedSteps.map((step, index) => ({ ...step, index })),
  };
}

export function createScalePatternSession(
  rng: () => number = Math.random
): ScalePatternQuestion[] {
  const questions = SCALE_PATTERN_STARTS.flatMap((start) => [
    createScalePatternQuestion(start, "ascending"),
    createScalePatternQuestion(start, "descending"),
  ]);

  for (let index = questions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [questions[index], questions[swapIndex]] = [
      questions[swapIndex],
      questions[index],
    ];
  }

  return questions;
}

export function getScalePatternStepIndex(clicks: ScalePatternClick[]): number {
  return clicks.filter((click) => click.correct).length;
}

export function createScalePatternClick(
  question: ScalePatternQuestion,
  clicks: ScalePatternClick[],
  position: FretboardPosition,
  elapsedMs: number,
  clickedAt = new Date().toISOString()
): ScalePatternClick {
  const stepIndex = Math.min(getScalePatternStepIndex(clicks), question.steps.length - 1);
  const expected = question.steps[stepIndex].position;

  return {
    stepIndex,
    expected,
    position,
    correct: positionKey(position) === positionKey(expected),
    elapsedMs: Math.max(1, Math.round(elapsedMs)),
    clickedAt,
  };
}

export function isScalePatternQuestionComplete(
  question: ScalePatternQuestion,
  clicks: ScalePatternClick[]
): boolean {
  return getScalePatternStepIndex(clicks) >= question.steps.length;
}

export function createScalePatternQuestionSummary(
  result: ScalePatternQuestionResult
): ScalePatternQuestionSummary {
  const correctClicks = result.clicks.filter((click) => click.correct).length;

  return {
    question: result.question,
    totalClicks: result.clicks.length,
    correctClicks,
    wrongClicks: result.clicks.length - correctClicks,
    totalElapsedMs: result.totalElapsedMs,
  };
}

function strongestKey(scores: Map<string, number>): string | null {
  return Array.from(scores.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function createScalePatternRunSummary(
  run: ScalePatternRun
): ScalePatternRunSummary {
  const questionSummaries = run.questions.map(createScalePatternQuestionSummary);
  const totalClicks = questionSummaries.reduce(
    (sum, question) => sum + question.totalClicks,
    0
  );
  const correctClicks = questionSummaries.reduce(
    (sum, question) => sum + question.correctClicks,
    0
  );
  const totalElapsedMs = questionSummaries.reduce(
    (sum, question) => sum + question.totalElapsedMs,
    0
  );
  const startScores = new Map<string, number>();
  const directionScores = new Map<string, number>();

  for (const question of questionSummaries) {
    const score = question.totalElapsedMs + question.wrongClicks * 1800;
    startScores.set(
      question.question.start.noteName,
      (startScores.get(question.question.start.noteName) ?? 0) + score
    );
    directionScores.set(
      question.question.direction,
      (directionScores.get(question.question.direction) ?? 0) + score
    );
  }

  return {
    questionCount: run.questions.length,
    totalClicks,
    correctClicks,
    wrongClicks: totalClicks - correctClicks,
    totalElapsedMs,
    averageQuestionMs: run.questions.length
      ? Math.round(totalElapsedMs / run.questions.length)
      : 0,
    weakestStartNote: strongestKey(startScores),
    weakestDirection: strongestKey(directionScores) as ScalePatternDirection | null,
    questionSummaries,
  };
}
