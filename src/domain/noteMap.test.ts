import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, positionKey } from "./fretboard";
import {
  createNoteMapClick,
  createNoteMapQuestion,
  createNoteMapRunSummary,
  createNoteMapSession,
  getFoundPositionKeys,
  isDuplicateCorrectClick,
  isNoteMapQuestionComplete,
} from "./noteMap";

describe("note map practice", () => {
  it("generates a 12-note session without repeated targets", () => {
    const session = createNoteMapSession(DEFAULT_CONFIG, () => 0.42);

    expect(session).toHaveLength(12);
    expect(new Set(session.map((question) => question.targetPitchClass)).size).toBe(12);
    expect(session.every((question) => question.positions.length === 6)).toBe(true);
  });

  it("records correct clicks and ignores duplicate correct scoring", () => {
    const question = createNoteMapQuestion(0, DEFAULT_CONFIG);
    const firstPosition = question.positions[0];
    const click = createNoteMapClick(question, firstPosition, 500);

    expect(click.correct).toBe(true);
    expect(getFoundPositionKeys([click])).toEqual([positionKey(firstPosition)]);
    expect(isDuplicateCorrectClick(question, [click], firstPosition)).toBe(true);
  });

  it("records wrong clicks without blocking completion", () => {
    const question = createNoteMapQuestion(0, DEFAULT_CONFIG);
    const wrongPosition = {
      ...question.positions[0],
      fret: question.positions[0].fret === 12 ? 11 : question.positions[0].fret + 1,
      pitchClass: 99,
    };
    const wrongClick = createNoteMapClick(question, wrongPosition, 600);
    const correctClicks = question.positions.map((position, index) =>
      createNoteMapClick(question, position, 700 + index)
    );

    expect(wrongClick.correct).toBe(false);
    expect(isNoteMapQuestionComplete(question, [wrongClick])).toBe(false);
    expect(isNoteMapQuestionComplete(question, [wrongClick, ...correctClicks])).toBe(true);
  });

  it("summarizes a completed note-map run", () => {
    const question = createNoteMapQuestion(0, DEFAULT_CONFIG);
    const clicks = question.positions.map((position, index) =>
      createNoteMapClick(question, position, 500 + index)
    );
    const run = {
      id: "note-map-run",
      startedAt: "2026-06-10T00:00:00.000Z",
      completedAt: "2026-06-10T00:01:00.000Z",
      config: DEFAULT_CONFIG,
      questions: [
        {
          question,
          clicks,
          startedAt: "2026-06-10T00:00:00.000Z",
          completedAt: "2026-06-10T00:00:05.000Z",
          totalElapsedMs: 5000,
        },
      ],
    };

    const summary = createNoteMapRunSummary(run);

    expect(summary.questionCount).toBe(1);
    expect(summary.correctClicks).toBe(6);
    expect(summary.wrongClicks).toBe(0);
    expect(summary.weakestPitchClass).toBe(0);
  });
});
