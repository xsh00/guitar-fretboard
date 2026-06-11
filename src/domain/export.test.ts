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
  createAnswerCsvExport,
  createChordArpeggioClickCsvExport,
  createChordArpeggioWeakPointCsvExport,
  createJsonExport,
  createNoteMapClickCsvExport,
  createNoteMapWeakPointCsvExport,
  createScalePatternClickCsvExport,
  createScalePatternWeakPointCsvExport,
  createWeakPointCsvExport,
} from "./export";
import { PracticeMemory } from "./storage";

function makeMemory(): PracticeMemory {
  const question = generateQuestionSequence(DEFAULT_CONFIG, 1, () => 0)[0];
  const run: PracticeRun = {
    id: "run-1",
    startedAt: "2026-06-10T00:00:00.000Z",
    completedAt: "2026-06-10T00:01:00.000Z",
    config: DEFAULT_CONFIG,
    answers: [
      {
        question,
        input: "F",
        correct: true,
        elapsedMs: 900,
        answeredAt: "2026-06-10T00:00:01.000Z",
      },
    ],
  };

  const noteMapQuestion = createNoteMapQuestion(0, DEFAULT_CONFIG);
  const noteMapRun: NoteMapRun = {
    id: "note-map-run",
    startedAt: "2026-06-10T00:02:00.000Z",
    completedAt: "2026-06-10T00:03:00.000Z",
    config: DEFAULT_CONFIG,
    questions: [
      {
        question: noteMapQuestion,
        clicks: [createNoteMapClick(noteMapQuestion, noteMapQuestion.positions[0], 700)],
        startedAt: "2026-06-10T00:02:00.000Z",
        completedAt: "2026-06-10T00:02:05.000Z",
        totalElapsedMs: 5000,
      },
    ],
  };
  const scaleQuestion = createScalePatternQuestion(SCALE_PATTERN_STARTS[0], "ascending");
  const scaleClick = createScalePatternClick(
    scaleQuestion,
    [],
    scaleQuestion.steps[0].position,
    800
  );
  const scalePatternRun: ScalePatternRun = {
    id: "scale-pattern-run",
    startedAt: "2026-06-10T00:04:00.000Z",
    completedAt: "2026-06-10T00:05:00.000Z",
    questions: [
      {
        question: scaleQuestion,
        clicks: [scaleClick],
        startedAt: "2026-06-10T00:04:00.000Z",
        completedAt: "2026-06-10T00:04:05.000Z",
        totalElapsedMs: 5000,
      },
    ],
  };
  const arpeggioChord = CHORD_ARPEGGIO_CHORDS[0];
  const arpeggioQuestion = createChordArpeggioQuestion(
    arpeggioChord,
    arpeggioChord.tones[0],
    "ascending"
  );
  const arpeggioClick = createChordArpeggioClick(
    arpeggioQuestion,
    [],
    arpeggioQuestion.steps[0].position,
    850
  );
  const chordArpeggioRun: ChordArpeggioRun = {
    id: "chord-arpeggio-run",
    startedAt: "2026-06-10T00:06:00.000Z",
    completedAt: "2026-06-10T00:07:00.000Z",
    chordId: arpeggioChord.id,
    questions: [
      {
        question: arpeggioQuestion,
        clicks: [arpeggioClick],
        startedAt: "2026-06-10T00:06:00.000Z",
        completedAt: "2026-06-10T00:06:05.000Z",
        totalElapsedMs: 5000,
      },
    ],
  };

  return {
    schemaVersion: 5,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:01:00.000Z",
    runs: [run],
    noteMapRuns: [noteMapRun],
    scalePatternRuns: [scalePatternRun],
    chordArpeggioRuns: [chordArpeggioRun],
  };
}

describe("practice export", () => {
  it("creates a full JSON export bundle", () => {
    const parsed = JSON.parse(createJsonExport(makeMemory()));

    expect(parsed.app).toBe("fretboard-reaction");
    expect(parsed.memory.runs[0].id).toBe("run-1");
    expect(parsed.memory.noteMapRuns[0].id).toBe("note-map-run");
    expect(parsed.memory.scalePatternRuns[0].id).toBe("scale-pattern-run");
    expect(parsed.memory.chordArpeggioRuns[0].id).toBe("chord-arpeggio-run");
    expect(parsed.progress.totalAnswers).toBe(1);
    expect(parsed.weakPoints).toHaveLength(1);
    expect(parsed.noteMapWeakPoints.byNote).toHaveLength(1);
    expect(parsed.scalePatternWeakPoints.byStartNote).toHaveLength(1);
    expect(parsed.chordArpeggioWeakPoints.byChord).toHaveLength(1);
  });

  it("creates answer-level CSV", () => {
    const csv = createAnswerCsvExport(makeMemory());

    expect(csv).toContain("run_id,run_started_at");
    expect(csv).toContain("run-1");
    expect(csv).toContain("1弦 1品");
  });

  it("creates weak-point CSV", () => {
    const csv = createWeakPointCsvExport(makeMemory());

    expect(csv).toContain("position_key,string,fret");
    expect(csv).toContain("1-1");
    expect(csv).toContain("1.0000");
  });

  it("creates note-map click CSV", () => {
    const csv = createNoteMapClickCsvExport(makeMemory());

    expect(csv).toContain("target_pitch_class,target_note");
    expect(csv).toContain("note-map-run");
    expect(csv).toContain("C");
  });

  it("creates note-map weak-point CSV", () => {
    const csv = createNoteMapWeakPointCsvExport(makeMemory());

    expect(csv).toContain("dimension,key,target_pitch_class");
    expect(csv).toContain("note,0,0,C");
    expect(csv).toContain("note-string");
  });

  it("creates scale-pattern click CSV", () => {
    const csv = createScalePatternClickCsvExport(makeMemory());

    expect(csv).toContain("start_note,direction");
    expect(csv).toContain("scale-pattern-run");
    expect(csv).toContain("F,ascending");
  });

  it("creates scale-pattern weak-point CSV", () => {
    const csv = createScalePatternWeakPointCsvExport(makeMemory());

    expect(csv).toContain("dimension,key,start_note");
    expect(csv).toContain("start-note,F,F");
    expect(csv).toContain("direction,ascending");
  });

  it("creates chord-arpeggio click CSV", () => {
    const csv = createChordArpeggioClickCsvExport(makeMemory());

    expect(csv).toContain("chord,quality,start_note,direction");
    expect(csv).toContain("chord-arpeggio-run");
    expect(csv).toContain("Cmaj7,maj7,C,ascending");
  });

  it("creates chord-arpeggio weak-point CSV", () => {
    const csv = createChordArpeggioWeakPointCsvExport(makeMemory());

    expect(csv).toContain("dimension,key,chord,quality");
    expect(csv).toContain("chord,Cmaj7,Cmaj7");
    expect(csv).toContain("degree,1");
  });
});
