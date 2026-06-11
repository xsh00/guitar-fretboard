export type ExerciseMode =
  | "position-to-note"
  | "note-to-position"
  | "note-map"
  | "scale-pattern"
  | "chord-arpeggio";

export type GuitarString = 1 | 2 | 3 | 4 | 5 | 6;

export type FretboardPosition = {
  string: GuitarString;
  fret: number;
  pitchClass: number;
};

export type PracticeConfig = {
  mode: ExerciseMode;
  strings: GuitarString[];
  frets: number[];
  questionCount: number;
  acceptEnharmonics: boolean;
};

export const DEFAULT_CONFIG: PracticeConfig = {
  mode: "position-to-note",
  strings: [1, 2, 3, 4, 5, 6],
  frets: Array.from({ length: 12 }, (_, index) => index + 1),
  questionCount: 30,
  acceptEnharmonics: true,
};

export const SHARP_NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export const FLAT_NOTE_NAMES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

export const STANDARD_TUNING_PITCH_CLASSES: Record<GuitarString, number> = {
  1: 4,
  2: 11,
  3: 7,
  4: 2,
  5: 9,
  6: 4,
};

export const STRING_LABELS: Record<GuitarString, string> = {
  1: "1弦",
  2: "2弦",
  3: "3弦",
  4: "4弦",
  5: "5弦",
  6: "6弦",
};

const NATURAL_PITCH_CLASSES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export function wrapPitchClass(value: number): number {
  return ((value % 12) + 12) % 12;
}

export function getPitchClassForPosition(
  string: GuitarString,
  fret: number
): number {
  return wrapPitchClass(STANDARD_TUNING_PITCH_CLASSES[string] + fret);
}

export function buildFretboardPositions(
  config: PracticeConfig = DEFAULT_CONFIG
): FretboardPosition[] {
  return config.strings.flatMap((string) =>
    config.frets.map((fret) => ({
      string,
      fret,
      pitchClass: getPitchClassForPosition(string, fret),
    }))
  );
}

export function findPositionsForPitchClass(
  pitchClass: number,
  config: PracticeConfig = DEFAULT_CONFIG
): FretboardPosition[] {
  return buildFretboardPositions(config)
    .filter((position) => position.pitchClass === wrapPitchClass(pitchClass))
    .sort((a, b) => a.string - b.string);
}

export function parseNoteName(input: string): number | null {
  const compact = input.trim().replace(/\s+/g, "").replace(/♯/g, "#").replace(/♭/g, "b");

  if (!compact) {
    return null;
  }

  const noteLetter = compact[0].toUpperCase();
  const accidental = compact.slice(1);
  const naturalPitchClass = NATURAL_PITCH_CLASSES[noteLetter];

  if (naturalPitchClass === undefined) {
    return null;
  }

  if (accidental === "") {
    return naturalPitchClass;
  }

  if (accidental === "#") {
    return wrapPitchClass(naturalPitchClass + 1);
  }

  if (accidental.toLowerCase() === "b") {
    return wrapPitchClass(naturalPitchClass - 1);
  }

  return null;
}

export function isCorrectNoteAnswer(
  input: string,
  pitchClass: number,
  acceptEnharmonics = true
): boolean {
  const parsed = parseNoteName(input);

  if (parsed === null) {
    return false;
  }

  if (acceptEnharmonics) {
    return parsed === pitchClass;
  }

  return SHARP_NOTE_NAMES[pitchClass].toUpperCase() === input.trim().toUpperCase();
}

export function formatPitchClass(pitchClass: number): string {
  const sharp = SHARP_NOTE_NAMES[pitchClass];
  const flat = FLAT_NOTE_NAMES[pitchClass];
  return sharp === flat ? sharp : `${sharp} / ${flat}`;
}

export function positionKey(position: Pick<FretboardPosition, "string" | "fret">): string {
  return `${position.string}-${position.fret}`;
}

export function positionLabel(position: Pick<FretboardPosition, "string" | "fret">): string {
  return `${position.string}弦 ${position.fret}品`;
}
