import { describe, expect, it } from "vitest";
import { positionKey } from "./fretboard";
import {
  CHORD_ARPEGGIO_CHORDS,
  ChordArpeggioChord,
  createAscendingChordArpeggioSteps,
  createChordArpeggioClick,
  createChordArpeggioQuestion,
  createChordArpeggioSession,
  isChordArpeggioQuestionComplete,
} from "./chordArpeggio";

function chord(id: ChordArpeggioChord["id"]) {
  const found = CHORD_ARPEGGIO_CHORDS.find((candidate) => candidate.id === id);

  if (!found) {
    throw new Error(`Missing chord ${id}`);
  }

  return found;
}

describe("chord arpeggio model", () => {
  it("defines the seven C major seventh chords", () => {
    expect(CHORD_ARPEGGIO_CHORDS.map((candidate) => candidate.id)).toEqual([
      "Cmaj7",
      "Dm7",
      "Em7",
      "Fmaj7",
      "G7",
      "Am7",
      "Bm7b5",
    ]);
    expect(chord("Cmaj7").tones.map((tone) => `${tone.noteName}/${tone.degree}`)).toEqual([
      "C/1",
      "E/3",
      "G/5",
      "B/7",
    ]);
    expect(chord("G7").quality).toBe("7");
    expect(chord("Bm7b5").tones.map((tone) => tone.degree)).toEqual([
      "1",
      "b3",
      "b5",
      "b7",
    ]);
  });

  it("creates one ascending and one descending item for every chord tone", () => {
    const questions = createChordArpeggioSession("Cmaj7", () => 0);
    const keys = questions.map(
      (question) => `${question.chord.id}-${question.startTone.noteName}-${question.direction}`
    );

    expect(questions).toHaveLength(8);
    expect(new Set(keys).size).toBe(8);
  });

  it("creates a predictable Cmaj7 arpeggio from C ascending", () => {
    const targetChord = chord("Cmaj7");
    const steps = createAscendingChordArpeggioSteps(targetChord, targetChord.tones[0]);

    expect(
      steps.map(
        (step) =>
          `${step.position.string}-${step.position.fret}-${step.noteName}/${step.degree}`
      )
    ).toEqual([
      "6-8-C/1",
      "5-7-E/3",
      "5-10-G/5",
      "4-9-B/7",
      "4-10-C/1",
      "3-9-E/3",
      "3-12-G/5",
      "2-12-B/7",
      "1-8-C/1",
    ]);
  });

  it("starts on the sixth string and ends on the first string with the same note", () => {
    for (const targetChord of CHORD_ARPEGGIO_CHORDS) {
      for (const tone of targetChord.tones) {
        const steps = createAscendingChordArpeggioSteps(targetChord, tone);
        const first = steps[0];
        const last = steps[steps.length - 1];

        expect(first.position.string).toBe(6);
        expect(last.position.string).toBe(1);
        expect(first.noteName).toBe(last.noteName);
        expect(first.position.fret).toBe(last.position.fret);
        expect(steps.every((step) => step.position.fret >= 1)).toBe(true);
        expect(steps.every((step) => step.position.fret <= 16)).toBe(true);
      }
    }
  });

  it("uses the reverse order for descending questions", () => {
    const targetChord = chord("Cmaj7");
    const ascending = createChordArpeggioQuestion(
      targetChord,
      targetChord.tones[0],
      "ascending"
    );
    const descending = createChordArpeggioQuestion(
      targetChord,
      targetChord.tones[0],
      "descending"
    );

    expect(descending.steps.map((step) => positionKey(step.position))).toEqual(
      [...ascending.steps].reverse().map((step) => positionKey(step.position))
    );
  });

  it("requires strict sequential clicks", () => {
    const targetChord = chord("Cmaj7");
    const question = createChordArpeggioQuestion(
      targetChord,
      targetChord.tones[0],
      "ascending"
    );
    const wrongClick = createChordArpeggioClick(
      question,
      [],
      question.steps[1].position,
      500
    );

    expect(wrongClick.correct).toBe(false);
    expect(wrongClick.stepIndex).toBe(0);

    let clicks = [
      createChordArpeggioClick(question, [], question.steps[0].position, 600),
    ];

    for (const step of question.steps.slice(1)) {
      clicks = [...clicks, createChordArpeggioClick(question, clicks, step.position, 700)];
    }

    expect(isChordArpeggioQuestionComplete(question, clicks)).toBe(true);
  });
});
