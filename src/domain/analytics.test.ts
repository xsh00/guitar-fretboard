import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./fretboard";
import { PracticeRun, generateQuestionSequence } from "./practice";
import { NoteMapRun, createNoteMapClick, createNoteMapQuestion } from "./noteMap";
import {
  ScalePatternRun,
  SCALE_PATTERN_STARTS,
  createScalePatternClick,
  createScalePatternQuestion,
} from "./scalePattern";
import {
  CHORD_ARPEGGIO_CHORDS,
  ChordArpeggioRun,
  createChordArpeggioClick,
  createChordArpeggioQuestion,
} from "./chordArpeggio";
import {
  createChordArpeggioWeakPointStats,
  createNoteMapWeakPointStats,
  createProgressSummary,
  createRunTrend,
  createScalePatternWeakPointStats,
  createWeakPointStats,
} from "./analytics";

function makeRun(id: string, completedAt: string, elapsedMs: number, correct: boolean): PracticeRun {
  const question = generateQuestionSequence(DEFAULT_CONFIG, 1, () => 0)[0];

  return {
    id,
    startedAt: completedAt,
    completedAt,
    config: DEFAULT_CONFIG,
    answers: [
      {
        question,
        input: correct ? "F" : "C",
        correct,
        elapsedMs,
        answeredAt: completedAt,
      },
    ],
  };
}

describe("practice analytics", () => {
  it("summarizes progress across saved runs", () => {
    const runs = [
      makeRun("new", "2026-06-11T00:00:00.000Z", 900, true),
      makeRun("old", "2026-06-10T00:00:00.000Z", 2100, false),
    ];

    const summary = createProgressSummary(runs);

    expect(summary.runCount).toBe(2);
    expect(summary.totalAnswers).toBe(2);
    expect(summary.totalCorrect).toBe(1);
    expect(summary.accuracy).toBe(0.5);
    expect(summary.averageMs).toBe(1500);
    expect(summary.firstRunAt).toBe("2026-06-10T00:00:00.000Z");
    expect(summary.lastRunAt).toBe("2026-06-11T00:00:00.000Z");
  });

  it("ranks weak points by mistakes and speed", () => {
    const runs = [
      makeRun("slow-wrong", "2026-06-11T00:00:00.000Z", 2600, false),
      makeRun("fast-right", "2026-06-10T00:00:00.000Z", 800, true),
    ];

    const weakPoints = createWeakPointStats(runs);

    expect(weakPoints[0].attempts).toBe(2);
    expect(weakPoints[0].correct).toBe(1);
    expect(weakPoints[0].mistakes).toBe(1);
    expect(weakPoints[0].averageMs).toBe(1700);
    expect(weakPoints[0].score).toBeGreaterThan(weakPoints[0].averageMs);
  });

  it("returns run trend from oldest to newest", () => {
    const trend = createRunTrend([
      makeRun("new", "2026-06-11T00:00:00.000Z", 900, true),
      makeRun("old", "2026-06-10T00:00:00.000Z", 2100, false),
    ]);

    expect(trend.map((point) => point.runId)).toEqual(["old", "new"]);
  });

  it("summarizes note-map weak points by note, string, and note-string", () => {
    const question = createNoteMapQuestion(0, DEFAULT_CONFIG);
    const wrongClick = createNoteMapClick(
      question,
      { ...question.positions[0], fret: 2, pitchClass: 6 },
      1200
    );
    const correctClicks = question.positions.map((position, index) =>
      createNoteMapClick(question, position, 800 + index)
    );
    const run: NoteMapRun = {
      id: "note-map-run",
      startedAt: "2026-06-10T00:00:00.000Z",
      completedAt: "2026-06-10T00:01:00.000Z",
      config: DEFAULT_CONFIG,
      questions: [
        {
          question,
          clicks: [wrongClick, ...correctClicks],
          startedAt: "2026-06-10T00:00:00.000Z",
          completedAt: "2026-06-10T00:00:05.000Z",
          totalElapsedMs: 5000,
        },
      ],
    };

    const weakPoints = createNoteMapWeakPointStats([run]);

    expect(weakPoints.byNote[0]).toMatchObject({
      dimension: "note",
      targetPitchClass: 0,
      wrongClicks: 1,
    });
    expect(weakPoints.byString.length).toBeGreaterThan(0);
    expect(weakPoints.byNoteString.length).toBeGreaterThan(0);
  });

  it("summarizes scale-pattern weak points by start, direction, string, and step", () => {
    const question = createScalePatternQuestion(SCALE_PATTERN_STARTS[0], "ascending");
    const wrongClick = createScalePatternClick(
      question,
      [],
      question.steps[1].position,
      1200
    );
    const correctClick = createScalePatternClick(
      question,
      [],
      question.steps[0].position,
      800
    );
    const run: ScalePatternRun = {
      id: "scale-pattern-run",
      startedAt: "2026-06-10T00:00:00.000Z",
      completedAt: "2026-06-10T00:01:00.000Z",
      questions: [
        {
          question,
          clicks: [wrongClick, correctClick],
          startedAt: "2026-06-10T00:00:00.000Z",
          completedAt: "2026-06-10T00:00:05.000Z",
          totalElapsedMs: 5000,
        },
      ],
    };

    const weakPoints = createScalePatternWeakPointStats([run]);

    expect(weakPoints.byStartNote[0]).toMatchObject({
      dimension: "start-note",
      startNote: "F",
      wrongClicks: 1,
    });
    expect(weakPoints.byDirection[0].direction).toBe("ascending");
    expect(weakPoints.byString.length).toBeGreaterThan(0);
    expect(weakPoints.byStep[0].stepIndex).toBe(1);
  });

  it("summarizes chord-arpeggio weak points by harmonic dimensions", () => {
    const chord = CHORD_ARPEGGIO_CHORDS[0];
    const question = createChordArpeggioQuestion(chord, chord.tones[0], "ascending");
    const wrongClick = createChordArpeggioClick(
      question,
      [],
      question.steps[1].position,
      1200
    );
    const correctClick = createChordArpeggioClick(
      question,
      [],
      question.steps[0].position,
      800
    );
    const run: ChordArpeggioRun = {
      id: "chord-arpeggio-run",
      startedAt: "2026-06-10T00:00:00.000Z",
      completedAt: "2026-06-10T00:01:00.000Z",
      chordId: chord.id,
      questions: [
        {
          question,
          clicks: [wrongClick, correctClick],
          startedAt: "2026-06-10T00:00:00.000Z",
          completedAt: "2026-06-10T00:00:05.000Z",
          totalElapsedMs: 5000,
        },
      ],
    };

    const weakPoints = createChordArpeggioWeakPointStats([run]);

    expect(weakPoints.byChord[0]).toMatchObject({
      dimension: "chord",
      chord: "Cmaj7",
      wrongClicks: 1,
    });
    expect(weakPoints.byQuality[0].quality).toBe("maj7");
    expect(weakPoints.byStartNote[0].startNote).toBe("C");
    expect(weakPoints.byDirection[0].direction).toBe("ascending");
    expect(weakPoints.byDegree[0].degree).toBe("1");
    expect(weakPoints.byString.length).toBeGreaterThan(0);
    expect(weakPoints.byStep[0].stepIndex).toBe(1);
  });
});
