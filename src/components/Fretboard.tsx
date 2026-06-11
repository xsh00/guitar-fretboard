import { CSSProperties } from "react";
import {
  FretboardPosition,
  GuitarString,
  STRING_LABELS,
  formatPitchClass,
  getPitchClassForPosition,
  positionKey,
} from "../domain/fretboard";
import { PositionStat } from "../domain/practice";

const DISPLAY_STRINGS: GuitarString[] = [1, 2, 3, 4, 5, 6];
const DEFAULT_FRETS = Array.from({ length: 12 }, (_, index) => index + 1);
const MARKER_FRETS = new Set([3, 5, 7, 9, 12, 15]);

export type FretboardMarkerTone = "found" | "wrong" | "answer";
export type FretboardMarker =
  | FretboardMarkerTone
  | {
      tone: FretboardMarkerTone;
      label?: string;
    };

type FretboardProps = {
  current?: FretboardPosition;
  frets?: number[];
  heatmap?: PositionStat[];
  markers?: Record<string, FretboardMarker>;
  onPositionClick?: (position: FretboardPosition) => void;
};

function getHeatForPosition(position: Pick<FretboardPosition, "string" | "fret">, heatmap?: PositionStat[]) {
  if (!heatmap?.length) {
    return undefined;
  }

  return heatmap.find((stat) => positionKey(stat.position) === positionKey(position));
}

function normalizeMarker(marker: FretboardMarker | undefined) {
  if (!marker) {
    return null;
  }

  return typeof marker === "string" ? { tone: marker, label: undefined } : marker;
}

export function Fretboard({
  current,
  frets = DEFAULT_FRETS,
  heatmap,
  markers,
  onPositionClick,
}: FretboardProps) {
  const strongestScore = heatmap?.[0]?.score ?? 0;
  const isInteractive = Boolean(onPositionClick);

  return (
    <div
      className="fretboard-shell"
      aria-label="六弦指板"
      style={{ "--fret-count": frets.length } as CSSProperties}
    >
      <div className="fret-numbers" aria-hidden="true">
        <span />
        {frets.map((fret) => (
          <span key={fret}>{fret}</span>
        ))}
      </div>

      <div className="fretboard">
        {DISPLAY_STRINGS.map((string) => (
          <div className="string-row" key={string}>
            <div className="string-label">{STRING_LABELS[string]}</div>
            {frets.map((fret) => {
              const position = {
                string,
                fret,
                pitchClass: getPitchClassForPosition(string, fret),
              };
              const key = positionKey(position);
              const marker = normalizeMarker(markers?.[key]);
              const isCurrent =
                current?.string === string && current?.fret === fret;
              const stat = getHeatForPosition(position, heatmap);
              const heat = stat && strongestScore ? Math.max(0.18, stat.score / strongestScore) : 0;
              const style = stat
                ? ({
                    "--heat": heat.toFixed(2),
                  } as CSSProperties)
                : undefined;

              return (
                <div
                  className={[
                    "fret-cell",
                    isInteractive ? "is-interactive" : "",
                    isCurrent ? "is-current" : "",
                    marker ? `marker-${marker.tone}` : "",
                    marker?.label ? "has-marker-label" : "",
                    stat ? "has-heat" : "",
                    stat?.mistakes ? "has-mistake" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-testid={`fret-${string}-${fret}`}
                  key={`${string}-${fret}`}
                  role={isInteractive ? "button" : undefined}
                  tabIndex={isInteractive ? 0 : undefined}
                  style={style}
                  title={
                    stat
                      ? `${string}弦 ${fret}品 ${formatPitchClass(
                          stat.position.pitchClass
                        )} · ${stat.averageMs}ms`
                      : undefined
                  }
                  onClick={() => onPositionClick?.(position)}
                  onKeyDown={(event) => {
                    if (!onPositionClick) {
                      return;
                    }

                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onPositionClick(position);
                    }
                  }}
                >
                  <span className="string-line" />
                  {MARKER_FRETS.has(fret) ? <span className="fret-marker" /> : null}
                  {isCurrent ? <span className="target-dot" aria-hidden="true" /> : null}
                  {marker ? (
                    <span className="map-dot" aria-hidden="true">
                      {marker.label ? (
                        <span className="map-dot-label">{marker.label}</span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
