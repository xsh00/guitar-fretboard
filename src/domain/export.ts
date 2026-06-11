import { formatPitchClass, positionLabel } from "./fretboard";
import {
  createNoteMapWeakPointStats,
  createProgressSummary,
  createRunTrend,
  createScalePatternWeakPointStats,
  createWeakPointStats,
} from "./analytics";
import { PracticeMemory } from "./storage";

export type ExportBundle = {
  app: "fretboard-reaction";
  schemaVersion: number;
  exportedAt: string;
  memory: PracticeMemory;
  progress: ReturnType<typeof createProgressSummary>;
  weakPoints: ReturnType<typeof createWeakPointStats>;
  noteMapWeakPoints: ReturnType<typeof createNoteMapWeakPointStats>;
  scalePatternWeakPoints: ReturnType<typeof createScalePatternWeakPointStats>;
  runTrend: ReturnType<typeof createRunTrend>;
};

function csvCell(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function csvRow(values: Array<string | number | boolean | null | undefined>): string {
  return values.map(csvCell).join(",");
}

export function createExportBundle(memory: PracticeMemory): ExportBundle {
  return {
    app: "fretboard-reaction",
    schemaVersion: memory.schemaVersion,
    exportedAt: new Date().toISOString(),
    memory,
    progress: createProgressSummary(memory.runs),
    weakPoints: createWeakPointStats(memory.runs),
    noteMapWeakPoints: createNoteMapWeakPointStats(memory.noteMapRuns),
    scalePatternWeakPoints: createScalePatternWeakPointStats(memory.scalePatternRuns),
    runTrend: createRunTrend(memory.runs),
  };
}

export function createJsonExport(memory: PracticeMemory): string {
  return JSON.stringify(createExportBundle(memory), null, 2);
}

export function createAnswerCsvExport(memory: PracticeMemory): string {
  const rows = [
    csvRow([
      "run_id",
      "run_started_at",
      "run_completed_at",
      "question_index",
      "string",
      "fret",
      "position",
      "pitch_class",
      "expected_note",
      "input",
      "correct",
      "elapsed_ms",
      "answered_at",
    ]),
  ];

  for (const run of memory.runs) {
    run.answers.forEach((answer, index) => {
      rows.push(
        csvRow([
          run.id,
          run.startedAt,
          run.completedAt,
          index + 1,
          answer.question.position.string,
          answer.question.position.fret,
          positionLabel(answer.question.position),
          answer.question.position.pitchClass,
          formatPitchClass(answer.question.position.pitchClass),
          answer.input,
          answer.correct,
          answer.elapsedMs,
          answer.answeredAt,
        ])
      );
    });
  }

  return rows.join("\n");
}

export function createWeakPointCsvExport(memory: PracticeMemory): string {
  const rows = [
    csvRow([
      "position_key",
      "string",
      "fret",
      "position",
      "pitch_class",
      "note",
      "attempts",
      "correct",
      "mistakes",
      "accuracy",
      "average_ms",
      "last_attempted_at",
      "weakness_score",
    ]),
  ];

  for (const weakPoint of createWeakPointStats(memory.runs)) {
    rows.push(
      csvRow([
        weakPoint.key,
        weakPoint.position.string,
        weakPoint.position.fret,
        positionLabel(weakPoint.position),
        weakPoint.position.pitchClass,
        formatPitchClass(weakPoint.position.pitchClass),
        weakPoint.attempts,
        weakPoint.correct,
        weakPoint.mistakes,
        weakPoint.accuracy.toFixed(4),
        weakPoint.averageMs,
        weakPoint.lastAttemptedAt,
        weakPoint.score,
      ])
    );
  }

  return rows.join("\n");
}

export function createNoteMapClickCsvExport(memory: PracticeMemory): string {
  const rows = [
    csvRow([
      "run_id",
      "run_started_at",
      "run_completed_at",
      "question_index",
      "target_pitch_class",
      "target_note",
      "click_index",
      "string",
      "fret",
      "position",
      "pitch_class",
      "clicked_note",
      "correct",
      "elapsed_ms",
      "clicked_at",
      "question_total_elapsed_ms",
    ]),
  ];

  for (const run of memory.noteMapRuns) {
    run.questions.forEach((question, questionIndex) => {
      question.clicks.forEach((click, clickIndex) => {
        rows.push(
          csvRow([
            run.id,
            run.startedAt,
            run.completedAt,
            questionIndex + 1,
            question.question.targetPitchClass,
            formatPitchClass(question.question.targetPitchClass),
            clickIndex + 1,
            click.position.string,
            click.position.fret,
            positionLabel(click.position),
            click.position.pitchClass,
            formatPitchClass(click.position.pitchClass),
            click.correct,
            click.elapsedMs,
            click.clickedAt,
            question.totalElapsedMs,
          ])
        );
      });
    });
  }

  return rows.join("\n");
}

export function createNoteMapWeakPointCsvExport(memory: PracticeMemory): string {
  const rows = [
    csvRow([
      "dimension",
      "key",
      "target_pitch_class",
      "target_note",
      "string",
      "attempts",
      "wrong_clicks",
      "average_ms",
      "weakness_score",
    ]),
  ];
  const weakPoints = createNoteMapWeakPointStats(memory.noteMapRuns);

  for (const group of [
    ...weakPoints.byNote,
    ...weakPoints.byString,
    ...weakPoints.byNoteString,
  ]) {
    rows.push(
      csvRow([
        group.dimension,
        group.key,
        group.targetPitchClass,
        group.targetPitchClass === null
          ? null
          : formatPitchClass(group.targetPitchClass),
        group.string,
        group.attempts,
        group.wrongClicks,
        group.averageMs,
        group.score,
      ])
    );
  }

  return rows.join("\n");
}

export function createScalePatternClickCsvExport(memory: PracticeMemory): string {
  const rows = [
    csvRow([
      "run_id",
      "run_started_at",
      "run_completed_at",
      "question_index",
      "start_note",
      "direction",
      "click_index",
      "step_index",
      "expected_string",
      "expected_fret",
      "expected_position",
      "expected_note",
      "clicked_string",
      "clicked_fret",
      "clicked_position",
      "clicked_note",
      "correct",
      "elapsed_ms",
      "clicked_at",
      "question_total_elapsed_ms",
    ]),
  ];

  for (const run of memory.scalePatternRuns) {
    run.questions.forEach((question, questionIndex) => {
      question.clicks.forEach((click, clickIndex) => {
        rows.push(
          csvRow([
            run.id,
            run.startedAt,
            run.completedAt,
            questionIndex + 1,
            question.question.start.noteName,
            question.question.direction,
            clickIndex + 1,
            click.stepIndex + 1,
            click.expected.string,
            click.expected.fret,
            positionLabel(click.expected),
            formatPitchClass(click.expected.pitchClass),
            click.position.string,
            click.position.fret,
            positionLabel(click.position),
            formatPitchClass(click.position.pitchClass),
            click.correct,
            click.elapsedMs,
            click.clickedAt,
            question.totalElapsedMs,
          ])
        );
      });
    });
  }

  return rows.join("\n");
}

export function createScalePatternWeakPointCsvExport(memory: PracticeMemory): string {
  const rows = [
    csvRow([
      "dimension",
      "key",
      "start_note",
      "direction",
      "string",
      "step_index",
      "attempts",
      "wrong_clicks",
      "average_ms",
      "weakness_score",
    ]),
  ];
  const weakPoints = createScalePatternWeakPointStats(memory.scalePatternRuns);

  for (const group of [
    ...weakPoints.byStartNote,
    ...weakPoints.byDirection,
    ...weakPoints.byString,
    ...weakPoints.byStep,
  ]) {
    rows.push(
      csvRow([
        group.dimension,
        group.key,
        group.startNote,
        group.direction,
        group.string,
        group.stepIndex,
        group.attempts,
        group.wrongClicks,
        group.averageMs,
        group.score,
      ])
    );
  }

  return rows.join("\n");
}
