import {
  DEFAULT_CONFIG,
  FretboardPosition,
  PracticeConfig,
  buildFretboardPositions,
  positionKey,
} from "./fretboard";

export type PracticeQuestion = {
  id: string;
  position: FretboardPosition;
};

export type PracticeAnswer = {
  question: PracticeQuestion;
  input: string;
  correct: boolean;
  elapsedMs: number;
  answeredAt: string;
};

export type PracticeRun = {
  id: string;
  startedAt: string;
  completedAt: string;
  config: PracticeConfig;
  answers: PracticeAnswer[];
};

export type PositionStat = {
  position: FretboardPosition;
  attempts: number;
  correct: number;
  mistakes: number;
  averageMs: number;
  score: number;
};

export type PracticeSummary = {
  total: number;
  correct: number;
  accuracy: number;
  averageMs: number;
  medianMs: number;
  slowest: PracticeAnswer[];
  mistakes: PracticeAnswer[];
  positionStats: PositionStat[];
};

export function makeQuestionPool(
  config: PracticeConfig = DEFAULT_CONFIG
): FretboardPosition[] {
  return buildFretboardPositions(config);
}

export function getRandomQuestion(
  pool: FretboardPosition[],
  previous?: PracticeQuestion,
  rng: () => number = Math.random
): PracticeQuestion {
  if (pool.length === 0) {
    throw new Error("Question pool cannot be empty.");
  }

  let index = Math.floor(rng() * pool.length);
  let position = pool[index];

  if (previous && pool.length > 1 && positionKey(position) === positionKey(previous.position)) {
    index = (index + 1) % pool.length;
    position = pool[index];
  }

  return {
    id: `${position.string}-${position.fret}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    position,
  };
}

export function generateQuestionSequence(
  config: PracticeConfig = DEFAULT_CONFIG,
  count = config.questionCount,
  rng: () => number = Math.random
): PracticeQuestion[] {
  const pool = makeQuestionPool(config);
  const questions: PracticeQuestion[] = [];

  for (let index = 0; index < count; index += 1) {
    questions.push(getRandomQuestion(pool, questions[index - 1], rng));
  }

  return questions;
}

export function createPracticeSummary(answers: PracticeAnswer[]): PracticeSummary {
  const total = answers.length;
  const correct = answers.filter((answer) => answer.correct).length;
  const elapsed = answers.map((answer) => answer.elapsedMs).sort((a, b) => a - b);
  const averageMs = total
    ? Math.round(answers.reduce((sum, answer) => sum + answer.elapsedMs, 0) / total)
    : 0;
  const medianMs = total
    ? Math.round(
        total % 2 === 0
          ? (elapsed[total / 2 - 1] + elapsed[total / 2]) / 2
          : elapsed[Math.floor(total / 2)]
      )
    : 0;

  const grouped = new Map<string, PracticeAnswer[]>();

  for (const answer of answers) {
    const key = positionKey(answer.question.position);
    const current = grouped.get(key) ?? [];
    current.push(answer);
    grouped.set(key, current);
  }

  const positionStats = Array.from(grouped.values())
    .map((group) => {
      const position = group[0].question.position;
      const correctCount = group.filter((answer) => answer.correct).length;
      const mistakes = group.length - correctCount;
      const average = Math.round(
        group.reduce((sum, answer) => sum + answer.elapsedMs, 0) / group.length
      );

      return {
        position,
        attempts: group.length,
        correct: correctCount,
        mistakes,
        averageMs: average,
        score: average + mistakes * 1200,
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    total,
    correct,
    accuracy: total ? correct / total : 0,
    averageMs,
    medianMs,
    slowest: [...answers].sort((a, b) => b.elapsedMs - a.elapsedMs).slice(0, 5),
    mistakes: answers.filter((answer) => !answer.correct),
    positionStats,
  };
}
