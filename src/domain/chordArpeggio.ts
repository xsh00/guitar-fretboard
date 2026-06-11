import {
  FretboardPosition,
  GuitarString,
  SHARP_NOTE_NAMES,
  getPitchClassForPosition,
  positionKey,
  wrapPitchClass,
} from "./fretboard";
import { SCALE_PATTERN_FRETS } from "./scalePattern";

export type ChordArpeggioDirection = "ascending" | "descending";
export type ChordArpeggioQuality = "maj7" | "m7" | "7" | "m7b5";

export type ChordTone = {
  noteName: string;
  pitchClass: number;
  degree: "1" | "3" | "5" | "7" | "b3" | "b5" | "b7";
};

export type ChordArpeggioChord = {
  id: "Cmaj7" | "Dm7" | "Em7" | "Fmaj7" | "G7" | "Am7" | "Bm7b5";
  name: string;
  quality: ChordArpeggioQuality;
  tones: ChordTone[];
};

export type ChordArpeggioStep = {
  index: number;
  noteName: string;
  degree: ChordTone["degree"];
  position: FretboardPosition;
};

export type ChordArpeggioQuestion = {
  id: string;
  chord: ChordArpeggioChord;
  startTone: ChordTone;
  direction: ChordArpeggioDirection;
  ascendingSteps: ChordArpeggioStep[];
  steps: ChordArpeggioStep[];
};

export type ChordArpeggioClick = {
  stepIndex: number;
  expected: FretboardPosition;
  expectedDegree: ChordTone["degree"];
  position: FretboardPosition;
  correct: boolean;
  elapsedMs: number;
  clickedAt: string;
};

export type ChordArpeggioQuestionResult = {
  question: ChordArpeggioQuestion;
  clicks: ChordArpeggioClick[];
  startedAt: string;
  completedAt: string;
  totalElapsedMs: number;
};

export type ChordArpeggioRun = {
  id: string;
  startedAt: string;
  completedAt: string;
  chordId: ChordArpeggioChord["id"];
  questions: ChordArpeggioQuestionResult[];
};

export type ChordArpeggioQuestionSummary = {
  question: ChordArpeggioQuestion;
  totalClicks: number;
  correctClicks: number;
  wrongClicks: number;
  totalElapsedMs: number;
};

export type ChordArpeggioRunSummary = {
  questionCount: number;
  totalClicks: number;
  correctClicks: number;
  wrongClicks: number;
  totalElapsedMs: number;
  averageQuestionMs: number;
  weakestStartNote: string | null;
  weakestDirection: ChordArpeggioDirection | null;
  weakestDegree: string | null;
  questionSummaries: ChordArpeggioQuestionSummary[];
};

const OPEN_STRING_ABSOLUTE: Record<GuitarString, number> = {
  6: 0,
  5: 5,
  4: 10,
  3: 15,
  2: 19,
  1: 24,
};
const LOW_E_PITCH_CLASS = 4;
const MIN_FRET = 1;
const MAX_FRET = 16;

export const CHORD_ARPEGGIO_FRETS = SCALE_PATTERN_FRETS;

export const CHORD_ARPEGGIO_CHORDS: ChordArpeggioChord[] = [
  {
    id: "Cmaj7",
    name: "Cmaj7",
    quality: "maj7",
    tones: [
      { noteName: "C", pitchClass: 0, degree: "1" },
      { noteName: "E", pitchClass: 4, degree: "3" },
      { noteName: "G", pitchClass: 7, degree: "5" },
      { noteName: "B", pitchClass: 11, degree: "7" },
    ],
  },
  {
    id: "Dm7",
    name: "Dm7",
    quality: "m7",
    tones: [
      { noteName: "D", pitchClass: 2, degree: "1" },
      { noteName: "F", pitchClass: 5, degree: "b3" },
      { noteName: "A", pitchClass: 9, degree: "5" },
      { noteName: "C", pitchClass: 0, degree: "b7" },
    ],
  },
  {
    id: "Em7",
    name: "Em7",
    quality: "m7",
    tones: [
      { noteName: "E", pitchClass: 4, degree: "1" },
      { noteName: "G", pitchClass: 7, degree: "b3" },
      { noteName: "B", pitchClass: 11, degree: "5" },
      { noteName: "D", pitchClass: 2, degree: "b7" },
    ],
  },
  {
    id: "Fmaj7",
    name: "Fmaj7",
    quality: "maj7",
    tones: [
      { noteName: "F", pitchClass: 5, degree: "1" },
      { noteName: "A", pitchClass: 9, degree: "3" },
      { noteName: "C", pitchClass: 0, degree: "5" },
      { noteName: "E", pitchClass: 4, degree: "7" },
    ],
  },
  {
    id: "G7",
    name: "G7",
    quality: "7",
    tones: [
      { noteName: "G", pitchClass: 7, degree: "1" },
      { noteName: "B", pitchClass: 11, degree: "3" },
      { noteName: "D", pitchClass: 2, degree: "5" },
      { noteName: "F", pitchClass: 5, degree: "b7" },
    ],
  },
  {
    id: "Am7",
    name: "Am7",
    quality: "m7",
    tones: [
      { noteName: "A", pitchClass: 9, degree: "1" },
      { noteName: "C", pitchClass: 0, degree: "b3" },
      { noteName: "E", pitchClass: 4, degree: "5" },
      { noteName: "G", pitchClass: 7, degree: "b7" },
    ],
  },
  {
    id: "Bm7b5",
    name: "Bm7b5",
    quality: "m7b5",
    tones: [
      { noteName: "B", pitchClass: 11, degree: "1" },
      { noteName: "D", pitchClass: 2, degree: "b3" },
      { noteName: "F", pitchClass: 5, degree: "b5" },
      { noteName: "A", pitchClass: 9, degree: "b7" },
    ],
  },
];

function makeQuestionId(
  chord: ChordArpeggioChord,
  startTone: ChordTone,
  direction: ChordArpeggioDirection
): string {
  return `${chord.id}-${startTone.noteName}-${direction}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function absoluteForPosition(position: Pick<FretboardPosition, "string" | "fret">): number {
  return OPEN_STRING_ABSOLUTE[position.string] + position.fret;
}

function pitchClassForAbsolute(absolute: number): number {
  return wrapPitchClass(LOW_E_PITCH_CLASS + absolute);
}

function findSixthStringFret(pitchClass: number): number {
  for (let fret = MIN_FRET; fret <= 12; fret += 1) {
    if (getPitchClassForPosition(6, fret) === pitchClass) {
      return fret;
    }
  }

  throw new Error(`No sixth-string start found for ${SHARP_NOTE_NAMES[pitchClass]}`);
}

function nextAbsoluteForPitchClass(currentAbsolute: number, pitchClass: number): number {
  const currentPitchClass = pitchClassForAbsolute(currentAbsolute);
  let delta = wrapPitchClass(pitchClass - currentPitchClass);

  if (delta === 0) {
    delta = 12;
  }

  return currentAbsolute + delta;
}

function positionsForAbsolute(absolute: number): FretboardPosition[] {
  return ([6, 5, 4, 3, 2, 1] as GuitarString[])
    .map((string) => ({
      string,
      fret: absolute - OPEN_STRING_ABSOLUTE[string],
      pitchClass: pitchClassForAbsolute(absolute),
    }))
    .filter((position) => position.fret >= MIN_FRET && position.fret <= MAX_FRET);
}

function chooseMiddlePosition(
  absolute: number,
  previous: FretboardPosition,
  startFret: number
): FretboardPosition {
  const windowStart = Math.max(MIN_FRET, startFret - 2);
  const windowEnd = Math.min(MAX_FRET, startFret + 5);
  const candidates = positionsForAbsolute(absolute).filter(
    (position) => position.string <= previous.string
  );
  const filtered = candidates.filter((position) => position.string !== 1);
  const usable = filtered.length ? filtered : candidates;

  if (!usable.length) {
    throw new Error(`No playable position found for absolute pitch ${absolute}`);
  }

  return [...usable].sort((a, b) => {
    const score = (position: FretboardPosition) => {
      const outsideWindow =
        position.fret < windowStart || position.fret > windowEnd ? 30 : 0;
      const fretDistance = Math.abs(position.fret - previous.fret);
      const sameString =
        position.string === previous.string ? (fretDistance <= 3 ? -2 : 1) : 0;
      const lowerFret = position.fret < previous.fret ? 1 : 0;
      const stringDistance = Math.abs(position.string - previous.string);

      return outsideWindow + sameString + lowerFret + fretDistance + stringDistance * 0.6;
    };

    return score(a) - score(b);
  })[0];
}

function createAbsoluteSequence(
  chord: ChordArpeggioChord,
  startTone: ChordTone,
  startAbsolute: number,
  endAbsolute: number
): Array<{ absolute: number; tone: ChordTone }> {
  const sequence: Array<{ absolute: number; tone: ChordTone }> = [];
  let absolute = startAbsolute;
  let toneIndex = chord.tones.findIndex(
    (tone) => tone.pitchClass === startTone.pitchClass
  );

  if (toneIndex === -1) {
    throw new Error(`${startTone.noteName} is not a tone of ${chord.name}`);
  }

  for (let guard = 0; guard < 32; guard += 1) {
    const tone = chord.tones[toneIndex];
    sequence.push({ absolute, tone });

    if (absolute === endAbsolute) {
      return sequence;
    }

    toneIndex = (toneIndex + 1) % chord.tones.length;
    absolute = nextAbsoluteForPitchClass(absolute, chord.tones[toneIndex].pitchClass);

    if (absolute > endAbsolute) {
      throw new Error(`Arpeggio for ${chord.name} overshot the target string`);
    }
  }

  throw new Error(`Arpeggio for ${chord.name} did not reach the target string`);
}

export function createAscendingChordArpeggioSteps(
  chord: ChordArpeggioChord,
  startTone: ChordTone
): ChordArpeggioStep[] {
  const startFret = findSixthStringFret(startTone.pitchClass);
  const startPosition: FretboardPosition = {
    string: 6,
    fret: startFret,
    pitchClass: startTone.pitchClass,
  };
  const endPosition: FretboardPosition = {
    string: 1,
    fret: startFret,
    pitchClass: startTone.pitchClass,
  };
  const sequence = createAbsoluteSequence(
    chord,
    startTone,
    absoluteForPosition(startPosition),
    absoluteForPosition(endPosition)
  );
  const steps: ChordArpeggioStep[] = [];
  let previous = startPosition;

  sequence.forEach(({ absolute, tone }, index) => {
    const position =
      index === 0
        ? startPosition
        : index === sequence.length - 1
          ? endPosition
          : chooseMiddlePosition(absolute, previous, startFret);

    steps.push({
      index,
      noteName: tone.noteName,
      degree: tone.degree,
      position,
    });
    previous = position;
  });

  return steps;
}

export function createChordArpeggioQuestion(
  chord: ChordArpeggioChord,
  startTone: ChordTone,
  direction: ChordArpeggioDirection
): ChordArpeggioQuestion {
  const ascendingSteps = createAscendingChordArpeggioSteps(chord, startTone);
  const orderedSteps =
    direction === "ascending" ? ascendingSteps : [...ascendingSteps].reverse();

  return {
    id: makeQuestionId(chord, startTone, direction),
    chord,
    startTone,
    direction,
    ascendingSteps,
    steps: orderedSteps.map((step, index) => ({ ...step, index })),
  };
}

export function createChordArpeggioSession(
  chordId: ChordArpeggioChord["id"] = "Cmaj7",
  rng: () => number = Math.random
): ChordArpeggioQuestion[] {
  const chord = CHORD_ARPEGGIO_CHORDS.find((candidate) => candidate.id === chordId);

  if (!chord) {
    throw new Error(`Unknown chord ${chordId}`);
  }

  const questions = chord.tones.flatMap((tone) => [
    createChordArpeggioQuestion(chord, tone, "ascending"),
    createChordArpeggioQuestion(chord, tone, "descending"),
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

export function getChordArpeggioStepIndex(clicks: ChordArpeggioClick[]): number {
  return clicks.filter((click) => click.correct).length;
}

export function createChordArpeggioClick(
  question: ChordArpeggioQuestion,
  clicks: ChordArpeggioClick[],
  position: FretboardPosition,
  elapsedMs: number,
  clickedAt = new Date().toISOString()
): ChordArpeggioClick {
  const stepIndex = Math.min(getChordArpeggioStepIndex(clicks), question.steps.length - 1);
  const expectedStep = question.steps[stepIndex];

  return {
    stepIndex,
    expected: expectedStep.position,
    expectedDegree: expectedStep.degree,
    position,
    correct: positionKey(position) === positionKey(expectedStep.position),
    elapsedMs: Math.max(1, Math.round(elapsedMs)),
    clickedAt,
  };
}

export function isChordArpeggioQuestionComplete(
  question: ChordArpeggioQuestion,
  clicks: ChordArpeggioClick[]
): boolean {
  return getChordArpeggioStepIndex(clicks) >= question.steps.length;
}

export function createChordArpeggioQuestionSummary(
  result: ChordArpeggioQuestionResult
): ChordArpeggioQuestionSummary {
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

export function createChordArpeggioRunSummary(
  run: ChordArpeggioRun
): ChordArpeggioRunSummary {
  const questionSummaries = run.questions.map(createChordArpeggioQuestionSummary);
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
  const degreeScores = new Map<string, number>();

  for (const result of run.questions) {
    const wrongClicks = result.clicks.filter((click) => !click.correct).length;
    const score = result.totalElapsedMs + wrongClicks * 1800;

    startScores.set(
      result.question.startTone.noteName,
      (startScores.get(result.question.startTone.noteName) ?? 0) + score
    );
    directionScores.set(
      result.question.direction,
      (directionScores.get(result.question.direction) ?? 0) + score
    );

    for (const step of result.question.steps) {
      degreeScores.set(step.degree, degreeScores.get(step.degree) ?? 0);
    }

    for (const click of result.clicks) {
      degreeScores.set(
        click.expectedDegree,
        (degreeScores.get(click.expectedDegree) ?? 0) +
          click.elapsedMs +
          (click.correct ? 0 : 1800)
      );
    }
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
    weakestDirection: strongestKey(directionScores) as ChordArpeggioDirection | null,
    weakestDegree: strongestKey(degreeScores),
    questionSummaries,
  };
}
