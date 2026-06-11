import { describe, expect, it } from "vitest";
import { positionKey } from "./fretboard";
import {
  SCALE_PATTERN_STARTS,
  createAscendingScalePatternSteps,
  createScalePatternClick,
  createScalePatternQuestion,
  createScalePatternSession,
  isScalePatternQuestionComplete,
} from "./scalePattern";

function stepLabels(startNote: string) {
  const start = SCALE_PATTERN_STARTS.find((candidate) => candidate.noteName === startNote);

  if (!start) {
    throw new Error(`Missing start ${startNote}`);
  }

  return createAscendingScalePatternSteps(start).map(
    (step) => `${step.position.string}-${step.position.fret}-${step.noteName}`
  );
}

describe("scale pattern model", () => {
  it("generates 17 positions for every C major start note", () => {
    for (const start of SCALE_PATTERN_STARTS) {
      const steps = createAscendingScalePatternSteps(start);

      expect(steps).toHaveLength(17);
      expect(steps.every((step) => step.position.fret >= 1)).toBe(true);
      expect(steps.every((step) => step.position.fret <= 16)).toBe(true);
    }
  });

  it("matches the F-start ascending pattern", () => {
    expect(stepLabels("F")).toEqual([
      "6-1-F",
      "6-3-G",
      "6-5-A",
      "5-2-B",
      "5-3-C",
      "5-5-D",
      "4-2-E",
      "4-3-F",
      "4-5-G",
      "3-2-A",
      "3-4-B",
      "3-5-C",
      "2-3-D",
      "2-5-E",
      "1-1-F",
      "1-3-G",
      "1-5-A",
    ]);
  });

  it("keeps the sixth-string and first-string note names identical", () => {
    for (const start of SCALE_PATTERN_STARTS) {
      const steps = createAscendingScalePatternSteps(start);
      const sixthStringNotes = steps
        .filter((step) => step.position.string === 6)
        .map((step) => step.noteName);
      const firstStringNotes = steps
        .filter((step) => step.position.string === 1)
        .map((step) => step.noteName);

      expect(firstStringNotes).toEqual(sixthStringNotes);
    }
  });

  it("uses the reverse order for descending questions", () => {
    const start = SCALE_PATTERN_STARTS[0];
    const ascending = createScalePatternQuestion(start, "ascending");
    const descending = createScalePatternQuestion(start, "descending");

    expect(descending.steps.map((step) => positionKey(step.position))).toEqual(
      [...ascending.steps].reverse().map((step) => positionKey(step.position))
    );
  });

  it("creates one ascending and one descending question for each start note", () => {
    const questions = createScalePatternSession(() => 0);
    const keys = questions.map(
      (question) => `${question.start.noteName}-${question.direction}`
    );

    expect(questions).toHaveLength(14);
    expect(new Set(keys).size).toBe(14);
  });

  it("requires strict sequential clicks", () => {
    const question = createScalePatternQuestion(SCALE_PATTERN_STARTS[0], "ascending");
    const wrongPosition = question.steps[1].position;
    const wrongClick = createScalePatternClick(question, [], wrongPosition, 500);

    expect(wrongClick.correct).toBe(false);
    expect(wrongClick.stepIndex).toBe(0);

    let clicks = [createScalePatternClick(question, [], question.steps[0].position, 600)];
    expect(clicks[0].correct).toBe(true);

    for (const step of question.steps.slice(1)) {
      clicks = [...clicks, createScalePatternClick(question, clicks, step.position, 700)];
    }

    expect(isScalePatternQuestionComplete(question, clicks)).toBe(true);
  });
});
