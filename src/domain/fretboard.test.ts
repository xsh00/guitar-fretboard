import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  STRING_LABELS,
  buildFretboardPositions,
  findPositionsForPitchClass,
  formatPitchClass,
  getPitchClassForPosition,
  isCorrectNoteAnswer,
  parseNoteName,
} from "./fretboard";

describe("fretboard model", () => {
  it("calculates pitch classes for standard tuning", () => {
    expect(getPitchClassForPosition(6, 1)).toBe(5);
    expect(getPitchClassForPosition(5, 2)).toBe(11);
    expect(getPitchClassForPosition(3, 5)).toBe(0);
    expect(getPitchClassForPosition(1, 12)).toBe(4);
  });

  it("builds the default 72-position pool", () => {
    const positions = buildFretboardPositions(DEFAULT_CONFIG);

    expect(positions).toHaveLength(72);
    expect(positions[0]).toMatchObject({ string: 1, fret: 1, pitchClass: 5 });
    expect(positions[71]).toMatchObject({ string: 6, fret: 12, pitchClass: 4 });
  });

  it("keeps string labels free from open-string note hints", () => {
    expect(STRING_LABELS).toEqual({
      1: "1弦",
      2: "2弦",
      3: "3弦",
      4: "4弦",
      5: "5弦",
      6: "6弦",
    });
  });

  it("parses enharmonic spellings", () => {
    expect(parseNoteName("F#")).toBe(6);
    expect(parseNoteName("Gb")).toBe(6);
    expect(parseNoteName("B♭")).toBe(10);
    expect(parseNoteName("h")).toBeNull();
    expect(parseNoteName("C##")).toBeNull();
  });

  it("accepts enharmonic answers", () => {
    expect(isCorrectNoteAnswer("Gb", 6, true)).toBe(true);
    expect(isCorrectNoteAnswer("F#", 6, true)).toBe(true);
    expect(isCorrectNoteAnswer("G", 6, true)).toBe(false);
  });

  it("formats pitch classes with equivalent spellings", () => {
    expect(formatPitchClass(0)).toBe("C");
    expect(formatPitchClass(6)).toBe("F# / Gb");
  });

  it("finds one target note position on each string in the default range", () => {
    for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
      const positions = findPositionsForPitchClass(pitchClass, DEFAULT_CONFIG);

      expect(positions).toHaveLength(6);
      expect(new Set(positions.map((position) => position.string)).size).toBe(6);
      expect(positions.every((position) => position.pitchClass === pitchClass)).toBe(true);
    }
  });
});
