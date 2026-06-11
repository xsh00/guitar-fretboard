import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Download,
  FileJson,
  Flame,
  Play,
  RefreshCcw,
  Table,
  Timer,
  Trophy,
} from "lucide-react";
import { Fretboard, FretboardMarker } from "./components/Fretboard";
import {
  DEFAULT_CONFIG,
  FretboardPosition,
  PracticeConfig,
  formatPitchClass,
  isCorrectNoteAnswer,
  parseNoteName,
  positionKey,
  positionLabel,
} from "./domain/fretboard";
import {
  PracticeAnswer,
  PracticeQuestion,
  PracticeRun,
  createPracticeSummary,
  getRandomQuestion,
  makeQuestionPool,
} from "./domain/practice";
import {
  NoteMapClick,
  NoteMapQuestion,
  NoteMapQuestionResult,
  NoteMapRun,
  createNoteMapClick,
  createNoteMapRunSummary,
  createNoteMapSession,
  getFoundPositionKeys,
  isDuplicateCorrectClick,
  isNoteMapQuestionComplete,
} from "./domain/noteMap";
import {
  SCALE_PATTERN_FRETS,
  ScalePatternClick,
  ScalePatternQuestion,
  ScalePatternQuestionResult,
  ScalePatternRun,
  createScalePatternClick,
  createScalePatternRunSummary,
  createScalePatternSession,
  getScalePatternStepIndex,
  isScalePatternQuestionComplete,
} from "./domain/scalePattern";
import {
  CHORD_ARPEGGIO_CHORDS,
  CHORD_ARPEGGIO_FRETS,
  ChordArpeggioChord,
  ChordArpeggioClick,
  ChordArpeggioQuestion,
  ChordArpeggioQuestionResult,
  ChordArpeggioRun,
  createChordArpeggioClick,
  createChordArpeggioRunSummary,
  createChordArpeggioSession,
  getChordArpeggioStepIndex,
  isChordArpeggioQuestionComplete,
} from "./domain/chordArpeggio";
import { createProgressSummary, createWeakPointStats } from "./domain/analytics";
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
} from "./domain/export";
import {
  PracticeMemory,
  loadPracticeMemory,
  saveChordArpeggioRun,
  saveNoteMapRun,
  savePracticeRun,
  saveScalePatternRun,
} from "./domain/storage";

type Feedback =
  | { tone: "correct"; text: string }
  | { tone: "wrong"; text: string }
  | { tone: "invalid"; text: string }
  | null;

type AppProps = {
  rng?: () => number;
};

type AppMode =
  | "position-to-note"
  | "note-map"
  | "scale-pattern"
  | "chord-arpeggio";
type ExportFormat =
  | "json"
  | "answers-csv"
  | "weak-points-csv"
  | "note-map-clicks-csv"
  | "note-map-weak-points-csv"
  | "scale-pattern-clicks-csv"
  | "scale-pattern-weak-points-csv"
  | "chord-arpeggio-clicks-csv"
  | "chord-arpeggio-weak-points-csv";

function formatMs(value: number): string {
  if (!value) {
    return "0.00s";
  }

  return `${(value / 1000).toFixed(2)}s`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDirection(direction: "ascending" | "descending"): string {
  return direction === "ascending" ? "上行" : "下行";
}

function makeRunId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeDateStamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function scrollWindowTop() {
  try {
    window.scrollTo(0, 0);
  } catch {
    // jsdom exposes scrollTo without implementing it.
  }
}

export function App({ rng = Math.random }: AppProps) {
  const config: PracticeConfig = DEFAULT_CONFIG;
  const questionPool = useMemo(() => makeQuestionPool(config), [config]);
  const inputRef = useRef<HTMLInputElement>(null);

  const [currentQuestion, setCurrentQuestion] = useState<PracticeQuestion | null>(null);
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<PracticeAnswer[]>([]);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [memory, setMemory] = useState<PracticeMemory>(() => loadPracticeMemory());
  const [screen, setScreen] = useState<"ready" | "practice" | "review">("ready");
  const [mode, setMode] = useState<AppMode>("position-to-note");
  const runs = memory.runs;

  const answeredCount = answers.length;
  const summary = useMemo(() => createPracticeSummary(answers), [answers]);
  const currentAccuracy = answeredCount ? summary.correct / answeredCount : 0;
  const currentStep = Math.min(answeredCount + 1, config.questionCount);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    scrollWindowTop();
  }, []);

  useEffect(() => {
    if (screen === "practice") {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [currentQuestion, screen]);

  useEffect(() => {
    if (screen === "review") {
      scrollWindowTop();
    }
  }, [screen]);

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
    }
  }, []);

  function startPractice() {
    if (mode === "note-map") {
      return;
    }

    const startedAt = new Date().toISOString();

    setAnswers([]);
    setInput("");
    setFeedback(null);
    setScreen("practice");
    setRunStartedAt(startedAt);
    setCurrentQuestion(getRandomQuestion(questionPool, undefined, rng));
    setQuestionStartedAt(performance.now());
  }

  function resetPractice() {
    setAnswers([]);
    setInput("");
    setFeedback(null);
    setCurrentQuestion(null);
    setQuestionStartedAt(null);
    setRunStartedAt(null);
    setMode("position-to-note");
    setScreen("ready");
  }

  function completeRun(nextAnswers: PracticeAnswer[]) {
    const run: PracticeRun = {
      id: makeRunId(),
      startedAt: runStartedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      config,
      answers: nextAnswers,
    };

    setMemory(savePracticeRun(run));
    setScreen("review");
  }

  function handleExport(format: ExportFormat) {
    const stamp = makeDateStamp();

    if (format === "json") {
      downloadTextFile(
        `fretboard-reaction-${stamp}.json`,
        createJsonExport(memory),
        "application/json;charset=utf-8"
      );
      return;
    }

    if (format === "answers-csv") {
      downloadTextFile(
        `fretboard-answers-${stamp}.csv`,
        `\uFEFF${createAnswerCsvExport(memory)}`,
        "text/csv;charset=utf-8"
      );
      return;
    }

    if (format === "note-map-clicks-csv") {
      downloadTextFile(
        `fretboard-note-map-clicks-${stamp}.csv`,
        `\uFEFF${createNoteMapClickCsvExport(memory)}`,
        "text/csv;charset=utf-8"
      );
      return;
    }

    if (format === "note-map-weak-points-csv") {
      downloadTextFile(
        `fretboard-note-map-weak-points-${stamp}.csv`,
        `\uFEFF${createNoteMapWeakPointCsvExport(memory)}`,
        "text/csv;charset=utf-8"
      );
      return;
    }

    if (format === "scale-pattern-clicks-csv") {
      downloadTextFile(
        `fretboard-scale-pattern-clicks-${stamp}.csv`,
        `\uFEFF${createScalePatternClickCsvExport(memory)}`,
        "text/csv;charset=utf-8"
      );
      return;
    }

    if (format === "scale-pattern-weak-points-csv") {
      downloadTextFile(
        `fretboard-scale-pattern-weak-points-${stamp}.csv`,
        `\uFEFF${createScalePatternWeakPointCsvExport(memory)}`,
        "text/csv;charset=utf-8"
      );
      return;
    }

    if (format === "chord-arpeggio-clicks-csv") {
      downloadTextFile(
        `fretboard-chord-arpeggio-clicks-${stamp}.csv`,
        `\uFEFF${createChordArpeggioClickCsvExport(memory)}`,
        "text/csv;charset=utf-8"
      );
      return;
    }

    if (format === "chord-arpeggio-weak-points-csv") {
      downloadTextFile(
        `fretboard-chord-arpeggio-weak-points-${stamp}.csv`,
        `\uFEFF${createChordArpeggioWeakPointCsvExport(memory)}`,
        "text/csv;charset=utf-8"
      );
      return;
    }

    downloadTextFile(
      `fretboard-weak-points-${stamp}.csv`,
      `\uFEFF${createWeakPointCsvExport(memory)}`,
      "text/csv;charset=utf-8"
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (screen !== "practice") {
      return;
    }

    if (!currentQuestion || questionStartedAt === null) {
      return;
    }

    const parsed = parseNoteName(input);

    if (parsed === null) {
      setFeedback({ tone: "invalid", text: "音名无效" });
      return;
    }

    const elapsedMs = Math.max(1, Math.round(performance.now() - questionStartedAt));
    const correct = isCorrectNoteAnswer(
      input,
      currentQuestion.position.pitchClass,
      config.acceptEnharmonics
    );
    const answer: PracticeAnswer = {
      question: currentQuestion,
      input,
      correct,
      elapsedMs,
      answeredAt: new Date().toISOString(),
    };
    const expected = formatPitchClass(currentQuestion.position.pitchClass);
    const nextAnswers = [...answers, answer];

    setAnswers(nextAnswers);
    setInput("");
    setFeedback(
      correct
        ? { tone: "correct", text: `正确 · ${expected}` }
        : { tone: "wrong", text: `应为 ${expected}` }
    );

    if (nextAnswers.length >= config.questionCount) {
      completeRun(nextAnswers);
      return;
    }

    const nextQuestion = getRandomQuestion(questionPool, currentQuestion, rng);
    setCurrentQuestion(nextQuestion);
    setQuestionStartedAt(performance.now());
  }

  return (
    <main className="app-shell">
      <section className="practice-stage" aria-labelledby="app-title">
        <header className="topbar">
          <div>
            <p className="eyebrow">Fretboard Reaction</p>
            <h1 id="app-title">指板反应</h1>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              type="button"
              onClick={resetPractice}
              aria-label="回到准备"
              title="回到准备"
            >
              <RefreshCcw size={19} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        {screen === "ready" ? (
          mode === "chord-arpeggio" ? (
            <ChordArpeggioPractice
              memory={memory}
              rng={rng}
              onExport={handleExport}
              onMemoryChange={setMemory}
              onModeChange={setMode}
            />
          ) : mode === "scale-pattern" ? (
            <ScalePatternPractice
              memory={memory}
              rng={rng}
              onExport={handleExport}
              onMemoryChange={setMemory}
              onModeChange={setMode}
            />
          ) : mode === "note-map" ? (
            <NoteMapPractice
              config={config}
              memory={memory}
              rng={rng}
              onExport={handleExport}
              onMemoryChange={setMemory}
              onModeChange={setMode}
            />
          ) : (
            <ReadyPanel
              memory={memory}
              mode={mode}
              questionCount={config.questionCount}
              onExport={handleExport}
              onModeChange={setMode}
              onStart={startPractice}
            />
          )
        ) : screen === "practice" && currentQuestion ? (
          <>
            <div className="metric-strip" aria-label="本局统计">
              <Metric icon={<Activity size={18} />} label="进度" value={`${currentStep}/${config.questionCount}`} />
              <Metric icon={<Trophy size={18} />} label="正确率" value={formatPercent(currentAccuracy)} />
              <Metric icon={<Timer size={18} />} label="平均" value={formatMs(summary.averageMs)} />
              <Metric icon={<Flame size={18} />} label="已答" value={`${answeredCount}`} />
            </div>

            <div className="fretboard-scroll">
              <Fretboard current={currentQuestion.position} />
            </div>

            <form className="answer-console" onSubmit={handleSubmit}>
              <label className="answer-label" htmlFor="note-answer">
                音名
              </label>
              <input
                ref={inputRef}
                id="note-answer"
                aria-label="音名答案"
                autoComplete="off"
                className="answer-input"
                inputMode="text"
                spellCheck={false}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="C / F# / Bb"
              />
              <button className="submit-button" type="submit">
                确认
              </button>
            </form>

            <div className={`feedback ${feedback?.tone ?? ""}`} role="status">
              {feedback?.text ?? " "}
            </div>
          </>
        ) : (
          <Review
            answers={answers}
            memory={memory}
            runs={runs}
            onExport={handleExport}
            onRestart={startPractice}
          />
        )}
      </section>
    </main>
  );
}

type ReadyPanelProps = {
  memory: PracticeMemory;
  mode: AppMode;
  questionCount: number;
  onExport: (format: ExportFormat) => void;
  onModeChange: (mode: AppMode) => void;
  onStart: () => void;
};

function ReadyPanel({
  memory,
  mode,
  questionCount,
  onExport,
  onModeChange,
  onStart,
}: ReadyPanelProps) {
  return (
    <section className="ready-panel" aria-label="练习准备">
      <div className="ready-copy">
        <p className="eyebrow">Position to Note</p>
        <h2>位置到音名</h2>
        <ModeSwitch mode={mode} onModeChange={onModeChange} />
        <div className="ready-tags" aria-label="练习配置">
          <span>{questionCount} 题</span>
          <span>1-12 品</span>
          <span>标准调弦</span>
          <span>接受等音名</span>
        </div>
      </div>

      <button className="start-button" type="button" onClick={onStart}>
        <Play size={20} fill="currentColor" strokeWidth={2.2} />
        开始 {questionCount} 题
      </button>

      <div className="fretboard-scroll ready-board">
        <Fretboard />
      </div>

      <PracticeMemoryPanel memory={memory} onExport={onExport} />
    </section>
  );
}

type ModeSwitchProps = {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
};

function ModeSwitch({ mode, onModeChange }: ModeSwitchProps) {
  return (
    <div className="mode-switch" aria-label="练习模式">
      <button
        className={mode === "position-to-note" ? "is-selected" : ""}
        type="button"
        onClick={() => onModeChange("position-to-note")}
      >
        位置识别
      </button>
      <button
        className={mode === "note-map" ? "is-selected" : ""}
        type="button"
        onClick={() => onModeChange("note-map")}
      >
        音名地图
      </button>
      <button
        className={mode === "scale-pattern" ? "is-selected" : ""}
        type="button"
        onClick={() => onModeChange("scale-pattern")}
      >
        C大调把位
      </button>
      <button
        className={mode === "chord-arpeggio" ? "is-selected" : ""}
        type="button"
        onClick={() => onModeChange("chord-arpeggio")}
      >
        C大调琶音
      </button>
    </div>
  );
}

type NoteMapPracticeProps = {
  config: PracticeConfig;
  memory: PracticeMemory;
  rng: () => number;
  onExport: (format: ExportFormat) => void;
  onMemoryChange: (memory: PracticeMemory) => void;
  onModeChange: (mode: AppMode) => void;
};

type NoteMapScreen = "ready" | "question" | "question-review" | "run-review";

function NoteMapPractice({
  config,
  memory,
  rng,
  onExport,
  onMemoryChange,
  onModeChange,
}: NoteMapPracticeProps) {
  const [screen, setScreen] = useState<NoteMapScreen>("ready");
  const [questions, setQuestions] = useState<NoteMapQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [clicks, setClicks] = useState<NoteMapClick[]>([]);
  const [results, setResults] = useState<NoteMapQuestionResult[]>([]);
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null);
  const [questionStartedAtIso, setQuestionStartedAtIso] = useState<string | null>(null);
  const [runStartedAtIso, setRunStartedAtIso] = useState<string | null>(null);
  const [lastWrongKey, setLastWrongKey] = useState<string | null>(null);
  const [savedRun, setSavedRun] = useState<NoteMapRun | null>(null);

  const currentQuestion = questions[questionIndex] ?? null;
  const foundKeys = useMemo(() => new Set(getFoundPositionKeys(clicks)), [clicks]);
  const lastResult = results[results.length - 1] ?? null;

  function startNoteMap() {
    const now = new Date().toISOString();

    setQuestions(createNoteMapSession(config, rng));
    setQuestionIndex(0);
    setClicks([]);
    setResults([]);
    setSavedRun(null);
    setRunStartedAtIso(now);
    setQuestionStartedAtIso(now);
    setQuestionStartedAt(performance.now());
    setLastWrongKey(null);
    setScreen("question");
  }

  function finishQuestion(nextClicks: NoteMapClick[]) {
    if (!currentQuestion || !questionStartedAtIso || questionStartedAt === null) {
      return;
    }

    const result: NoteMapQuestionResult = {
      question: currentQuestion,
      clicks: nextClicks,
      startedAt: questionStartedAtIso,
      completedAt: new Date().toISOString(),
      totalElapsedMs: Math.max(1, Math.round(performance.now() - questionStartedAt)),
    };

    setResults((current) => [...current, result]);
    setScreen("question-review");
  }

  function handlePositionClick(position: FretboardPosition) {
    if (screen !== "question" || !currentQuestion || questionStartedAt === null) {
      return;
    }

    if (isDuplicateCorrectClick(currentQuestion, clicks, position)) {
      return;
    }

    const click = createNoteMapClick(
      currentQuestion,
      position,
      performance.now() - questionStartedAt
    );
    const nextClicks = [...clicks, click];

    setClicks(nextClicks);

    if (!click.correct) {
      const wrongKey = positionKey(position);
      setLastWrongKey(wrongKey);
      window.setTimeout(() => {
        setLastWrongKey((current) => (current === wrongKey ? null : current));
      }, 900);
      return;
    }

    if (isNoteMapQuestionComplete(currentQuestion, nextClicks)) {
      finishQuestion(nextClicks);
    }
  }

  function goNextQuestion() {
    if (questionIndex >= questions.length - 1) {
      const completedAt = new Date().toISOString();
      const run: NoteMapRun = {
        id: makeRunId(),
        startedAt: runStartedAtIso ?? completedAt,
        completedAt,
        config,
        questions: results,
      };

      setSavedRun(run);
      onMemoryChange(saveNoteMapRun(run));
      setScreen("run-review");
      return;
    }

    const now = new Date().toISOString();
    setQuestionIndex((current) => current + 1);
    setClicks([]);
    setLastWrongKey(null);
    setQuestionStartedAtIso(now);
    setQuestionStartedAt(performance.now());
    setScreen("question");
  }

  const markerMap = useMemo(() => {
    const markers: Record<string, "found" | "wrong" | "answer"> = {};

    if (screen === "question-review" && lastResult) {
      for (const position of lastResult.question.positions) {
        markers[positionKey(position)] = "answer";
      }
    }

    for (const click of clicks) {
      if (click.correct) {
        markers[positionKey(click.position)] = "found";
      }
    }

    if (lastWrongKey) {
      markers[lastWrongKey] = "wrong";
    }

    return markers;
  }, [clicks, lastResult, lastWrongKey, screen]);

  return (
    <section className="note-map-panel" aria-label="音名地图练习">
      <div className="note-map-head">
        <div>
          <p className="eyebrow">Note Map</p>
          <h2>音名地图</h2>
          <ModeSwitch mode="note-map" onModeChange={(nextMode) => {
            if (nextMode !== "note-map") {
              onModeChange(nextMode);
            }
          }} />
        </div>

        {screen === "ready" ? (
          <button className="start-button" type="button" onClick={startNoteMap}>
            <Play size={20} fill="currentColor" strokeWidth={2.2} />
            开始 12 音
          </button>
        ) : null}
      </div>

      {screen === "ready" ? (
        <>
          <div className="ready-tags" aria-label="音名地图配置">
            <span>12 个音名</span>
            <span>每题 6 个位置</span>
            <span>1-12 品</span>
            <span>任意顺序</span>
          </div>
          <div className="fretboard-scroll ready-board">
            <Fretboard />
          </div>
          <PracticeMemoryPanel memory={memory} onExport={onExport} />
        </>
      ) : null}

      {screen === "question" && currentQuestion ? (
        <>
          <div className="note-map-status">
            <div>
              <span>目标音名</span>
              <strong>{formatPitchClass(currentQuestion.targetPitchClass)}</strong>
            </div>
            <div>
              <span>进度</span>
              <strong>{questionIndex + 1}/12</strong>
            </div>
            <div>
              <span>已找到</span>
              <strong>{foundKeys.size}/6</strong>
            </div>
            <div>
              <span>错点</span>
              <strong>{clicks.filter((click) => !click.correct).length}</strong>
            </div>
          </div>
          <div className="fretboard-scroll">
            <Fretboard markers={markerMap} onPositionClick={handlePositionClick} />
          </div>
          <div className="feedback" role="status">
            {lastWrongKey ? "这个位置不是当前目标音" : " "}
          </div>
        </>
      ) : null}

      {screen === "question-review" && lastResult ? (
        <NoteMapQuestionReview result={lastResult} onNext={goNextQuestion} />
      ) : null}

      {screen === "run-review" && savedRun ? (
        <NoteMapRunReview run={savedRun} onExport={onExport} onRestart={startNoteMap} />
      ) : null}
    </section>
  );
}

type NoteMapQuestionReviewProps = {
  result: NoteMapQuestionResult;
  onNext: () => void;
};

function NoteMapQuestionReview({ result, onNext }: NoteMapQuestionReviewProps) {
  const wrongClicks = result.clicks.filter((click) => !click.correct).length;
  const markers = Object.fromEntries(
    result.question.positions.map((position) => [positionKey(position), "answer" as const])
  );

  return (
    <section className="note-map-review" aria-label="音名短复盘">
      <div className="review-heading">
        <div>
          <p className="eyebrow">Note Review</p>
          <h2>{formatPitchClass(result.question.targetPitchClass)}</h2>
        </div>
        <button className="submit-button compact" type="button" onClick={onNext}>
          下一音名
        </button>
      </div>
      <div className="metric-strip review-metrics">
        <Metric icon={<Timer size={18} />} label="用时" value={formatMs(result.totalElapsedMs)} />
        <Metric icon={<Activity size={18} />} label="正确点" value="6" />
        <Metric icon={<Flame size={18} />} label="错点" value={`${wrongClicks}`} />
        <Metric icon={<Trophy size={18} />} label="点击" value={`${result.clicks.length}`} />
      </div>
      <div className="fretboard-scroll">
        <Fretboard markers={markers} />
      </div>
    </section>
  );
}

type NoteMapRunReviewProps = {
  run: NoteMapRun;
  onExport: (format: ExportFormat) => void;
  onRestart: () => void;
};

function NoteMapRunReview({ run, onExport, onRestart }: NoteMapRunReviewProps) {
  const summary = createNoteMapRunSummary(run);

  return (
    <section className="note-map-review" aria-label="音名地图整轮复盘">
      <div className="review-heading">
        <div>
          <p className="eyebrow">Map Complete</p>
          <h2>音名地图复盘</h2>
        </div>
        <button className="submit-button compact" type="button" onClick={onRestart}>
          再练一轮
        </button>
      </div>
      <div className="metric-strip review-metrics">
        <Metric icon={<Activity size={18} />} label="音名" value={`${summary.questionCount}`} />
        <Metric icon={<Timer size={18} />} label="平均每音" value={formatMs(summary.averageQuestionMs)} />
        <Metric icon={<Flame size={18} />} label="总错点" value={`${summary.wrongClicks}`} />
        <Metric
          icon={<Trophy size={18} />}
          label="最弱音"
          value={
            summary.weakestPitchClass === null
              ? "-"
              : formatPitchClass(summary.weakestPitchClass)
          }
        />
      </div>
      <section className="review-list">
        <h3>每个音名</h3>
        {summary.questionSummaries.map((question) => (
          <div className="review-row" key={question.question.id}>
            <span>{formatPitchClass(question.question.targetPitchClass)}</span>
            <strong>
              {formatMs(question.totalElapsedMs)} · 错 {question.wrongClicks}
            </strong>
          </div>
        ))}
      </section>
      <div className="export-actions note-map-export">
        <ExportButton
          icon={<Table size={16} />}
          label="音名地图明细 CSV"
          title="导出音名地图明细 CSV"
          onClick={() => onExport("note-map-clicks-csv")}
        />
        <ExportButton
          icon={<Download size={16} />}
          label="音名地图弱点 CSV"
          title="导出音名地图弱点 CSV"
          onClick={() => onExport("note-map-weak-points-csv")}
        />
      </div>
    </section>
  );
}

type ScalePatternPracticeProps = {
  memory: PracticeMemory;
  rng: () => number;
  onExport: (format: ExportFormat) => void;
  onMemoryChange: (memory: PracticeMemory) => void;
  onModeChange: (mode: AppMode) => void;
};

type ScalePatternScreen =
  | "ready"
  | "answer"
  | "recall"
  | "question-review"
  | "run-review";

function makeScaleAnswerMarkers(question: ScalePatternQuestion): Record<string, FretboardMarker> {
  return Object.fromEntries(
    question.ascendingSteps.map((step) => [
      positionKey(step.position),
      { tone: "answer", label: step.noteName } satisfies FretboardMarker,
    ])
  );
}

function groupScaleStepsByString(question: ScalePatternQuestion) {
  return [6, 5, 4, 3, 2, 1].map((string) => ({
    string,
    steps: question.ascendingSteps.filter((step) => step.position.string === string),
  }));
}

function ScalePatternPractice({
  memory,
  rng,
  onExport,
  onMemoryChange,
  onModeChange,
}: ScalePatternPracticeProps) {
  const [screen, setScreen] = useState<ScalePatternScreen>("ready");
  const [questions, setQuestions] = useState<ScalePatternQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [clicks, setClicks] = useState<ScalePatternClick[]>([]);
  const [results, setResults] = useState<ScalePatternQuestionResult[]>([]);
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null);
  const [questionStartedAtIso, setQuestionStartedAtIso] = useState<string | null>(null);
  const [runStartedAtIso, setRunStartedAtIso] = useState<string | null>(null);
  const [lastWrongKey, setLastWrongKey] = useState<string | null>(null);
  const [savedRun, setSavedRun] = useState<ScalePatternRun | null>(null);

  const currentQuestion = questions[questionIndex] ?? null;
  const currentStepIndex = useMemo(() => getScalePatternStepIndex(clicks), [clicks]);
  const lastResult = results[results.length - 1] ?? null;

  function startScalePattern() {
    const now = new Date().toISOString();

    setQuestions(createScalePatternSession(rng));
    setQuestionIndex(0);
    setClicks([]);
    setResults([]);
    setSavedRun(null);
    setRunStartedAtIso(now);
    setQuestionStartedAtIso(null);
    setQuestionStartedAt(null);
    setLastWrongKey(null);
    setScreen("answer");
  }

  function startRecall() {
    const now = new Date().toISOString();

    setClicks([]);
    setLastWrongKey(null);
    setQuestionStartedAtIso(now);
    setQuestionStartedAt(performance.now());
    setScreen("recall");
  }

  function finishQuestion(nextClicks: ScalePatternClick[]) {
    if (!currentQuestion || !questionStartedAtIso || questionStartedAt === null) {
      return;
    }

    const result: ScalePatternQuestionResult = {
      question: currentQuestion,
      clicks: nextClicks,
      startedAt: questionStartedAtIso,
      completedAt: new Date().toISOString(),
      totalElapsedMs: Math.max(1, Math.round(performance.now() - questionStartedAt)),
    };

    setResults((current) => [...current, result]);
    setScreen("question-review");
  }

  function handlePositionClick(position: FretboardPosition) {
    if (screen !== "recall" || !currentQuestion || questionStartedAt === null) {
      return;
    }

    const click = createScalePatternClick(
      currentQuestion,
      clicks,
      position,
      performance.now() - questionStartedAt
    );
    const nextClicks = [...clicks, click];

    setClicks(nextClicks);

    if (!click.correct) {
      const wrongKey = positionKey(position);
      setLastWrongKey(wrongKey);
      window.setTimeout(() => {
        setLastWrongKey((current) => (current === wrongKey ? null : current));
      }, 900);
      return;
    }

    if (isScalePatternQuestionComplete(currentQuestion, nextClicks)) {
      finishQuestion(nextClicks);
    }
  }

  function goNextQuestion() {
    if (questionIndex >= questions.length - 1) {
      const completedAt = new Date().toISOString();
      const run: ScalePatternRun = {
        id: makeRunId(),
        startedAt: runStartedAtIso ?? completedAt,
        completedAt,
        questions: results,
      };

      setSavedRun(run);
      onMemoryChange(saveScalePatternRun(run));
      setScreen("run-review");
      return;
    }

    setQuestionIndex((current) => current + 1);
    setClicks([]);
    setLastWrongKey(null);
    setQuestionStartedAtIso(null);
    setQuestionStartedAt(null);
    setScreen("answer");
  }

  const markerMap = useMemo(() => {
    const markers: Record<string, FretboardMarker> = {};

    if (screen === "answer" && currentQuestion) {
      return makeScaleAnswerMarkers(currentQuestion);
    }

    if (screen === "question-review" && lastResult) {
      return makeScaleAnswerMarkers(lastResult.question);
    }

    for (const click of clicks) {
      if (click.correct) {
        markers[positionKey(click.position)] = "found";
      }
    }

    if (lastWrongKey) {
      markers[lastWrongKey] = "wrong";
    }

    return markers;
  }, [clicks, currentQuestion, lastResult, lastWrongKey, screen]);

  return (
    <section className="note-map-panel scale-pattern-panel" aria-label="C大调把位练习">
      <div className="note-map-head">
        <div>
          <p className="eyebrow">C Major Positions</p>
          <h2>C大调把位</h2>
          <ModeSwitch
            mode="scale-pattern"
            onModeChange={(nextMode) => {
              if (nextMode !== "scale-pattern") {
                onModeChange(nextMode);
              }
            }}
          />
        </div>

        {screen === "ready" ? (
          <button className="start-button" type="button" onClick={startScalePattern}>
            <Play size={20} fill="currentColor" strokeWidth={2.2} />
            开始 14 项
          </button>
        ) : null}
      </div>

      {screen === "ready" ? (
        <>
          <div className="ready-tags" aria-label="C大调把位配置">
            <span>7 个起始音</span>
            <span>上行 + 下行</span>
            <span>1-16 品</span>
            <span>严格顺序</span>
          </div>
          <div className="fretboard-scroll ready-board">
            <Fretboard frets={SCALE_PATTERN_FRETS} />
          </div>
          <PracticeMemoryPanel memory={memory} onExport={onExport} />
        </>
      ) : null}

      {screen === "answer" && currentQuestion ? (
        <>
          <div className="note-map-status scale-pattern-status">
            <div>
              <span>起始音</span>
              <strong>{currentQuestion.start.noteName}</strong>
            </div>
            <div>
              <span>方向</span>
              <strong>{formatDirection(currentQuestion.direction)}</strong>
            </div>
            <div>
              <span>项目</span>
              <strong>{questionIndex + 1}/14</strong>
            </div>
            <div>
              <span>音符</span>
              <strong>{currentQuestion.steps.length}</strong>
            </div>
          </div>
          <ScalePatternStringMap question={currentQuestion} />
          <div className="fretboard-scroll">
            <Fretboard frets={SCALE_PATTERN_FRETS} markers={markerMap} />
          </div>
          <button className="start-button scale-start-recall" type="button" onClick={startRecall}>
            <Play size={20} fill="currentColor" strokeWidth={2.2} />
            开始回忆
          </button>
        </>
      ) : null}

      {screen === "recall" && currentQuestion ? (
        <>
          <div className="note-map-status scale-pattern-status">
            <div>
              <span>起始音</span>
              <strong>{currentQuestion.start.noteName}</strong>
            </div>
            <div>
              <span>方向</span>
              <strong>{formatDirection(currentQuestion.direction)}</strong>
            </div>
            <div>
              <span>步骤</span>
              <strong>
                {Math.min(currentStepIndex + 1, currentQuestion.steps.length)}/
                {currentQuestion.steps.length}
              </strong>
            </div>
            <div>
              <span>错点</span>
              <strong>{clicks.filter((click) => !click.correct).length}</strong>
            </div>
          </div>
          <div className="fretboard-scroll">
            <Fretboard
              frets={SCALE_PATTERN_FRETS}
              markers={markerMap}
              onPositionClick={handlePositionClick}
            />
          </div>
          <div className="feedback" role="status">
            {lastWrongKey ? "这个位置不是当前步骤" : " "}
          </div>
        </>
      ) : null}

      {screen === "question-review" && lastResult ? (
        <ScalePatternQuestionReview
          result={lastResult}
          isLast={questionIndex >= questions.length - 1}
          onNext={goNextQuestion}
        />
      ) : null}

      {screen === "run-review" && savedRun ? (
        <ScalePatternRunReview run={savedRun} onExport={onExport} onRestart={startScalePattern} />
      ) : null}
    </section>
  );
}

type ScalePatternStringMapProps = {
  question: ScalePatternQuestion;
};

function ScalePatternStringMap({ question }: ScalePatternStringMapProps) {
  return (
    <div className="scale-string-map" aria-label="把位音名">
      {groupScaleStepsByString(question).map((row) => (
        <div className="scale-string-row" key={row.string}>
          <span>{row.string}弦</span>
          <strong>{row.steps.map((step) => step.noteName).join(" ")}</strong>
        </div>
      ))}
    </div>
  );
}

type ScalePatternQuestionReviewProps = {
  result: ScalePatternQuestionResult;
  isLast: boolean;
  onNext: () => void;
};

function ScalePatternQuestionReview({
  result,
  isLast,
  onNext,
}: ScalePatternQuestionReviewProps) {
  const wrongClicks = result.clicks.filter((click) => !click.correct).length;
  const markers = makeScaleAnswerMarkers(result.question);

  return (
    <section className="note-map-review" aria-label="C大调把位短复盘">
      <div className="review-heading">
        <div>
          <p className="eyebrow">Pattern Review</p>
          <h2>
            {result.question.start.noteName} · {formatDirection(result.question.direction)}
          </h2>
        </div>
        <button className="submit-button compact" type="button" onClick={onNext}>
          {isLast ? "完成整轮" : "下一项目"}
        </button>
      </div>
      <div className="metric-strip review-metrics">
        <Metric icon={<Timer size={18} />} label="用时" value={formatMs(result.totalElapsedMs)} />
        <Metric icon={<Activity size={18} />} label="步骤" value={`${result.question.steps.length}`} />
        <Metric icon={<Flame size={18} />} label="错点" value={`${wrongClicks}`} />
        <Metric icon={<Trophy size={18} />} label="点击" value={`${result.clicks.length}`} />
      </div>
      <ScalePatternStringMap question={result.question} />
      <div className="fretboard-scroll">
        <Fretboard frets={SCALE_PATTERN_FRETS} markers={markers} />
      </div>
    </section>
  );
}

type ScalePatternRunReviewProps = {
  run: ScalePatternRun;
  onExport: (format: ExportFormat) => void;
  onRestart: () => void;
};

function ScalePatternRunReview({ run, onExport, onRestart }: ScalePatternRunReviewProps) {
  const summary = createScalePatternRunSummary(run);

  return (
    <section className="note-map-review" aria-label="C大调把位整轮复盘">
      <div className="review-heading">
        <div>
          <p className="eyebrow">Scale Complete</p>
          <h2>C大调把位复盘</h2>
        </div>
        <button className="submit-button compact" type="button" onClick={onRestart}>
          再练一轮
        </button>
      </div>
      <div className="metric-strip review-metrics">
        <Metric icon={<Activity size={18} />} label="项目" value={`${summary.questionCount}`} />
        <Metric icon={<Timer size={18} />} label="平均每项" value={formatMs(summary.averageQuestionMs)} />
        <Metric icon={<Flame size={18} />} label="总错点" value={`${summary.wrongClicks}`} />
        <Metric
          icon={<Trophy size={18} />}
          label="最弱把位"
          value={
            summary.weakestStartNote && summary.weakestDirection
              ? `${summary.weakestStartNote} ${formatDirection(summary.weakestDirection)}`
              : "-"
          }
        />
      </div>
      <section className="review-list">
        <h3>每个项目</h3>
        {summary.questionSummaries.map((question) => (
          <div className="review-row" key={question.question.id}>
            <span>
              {question.question.start.noteName} · {formatDirection(question.question.direction)}
            </span>
            <strong>
              {formatMs(question.totalElapsedMs)} · 错 {question.wrongClicks}
            </strong>
          </div>
        ))}
      </section>
      <div className="export-actions note-map-export">
        <ExportButton
          icon={<Table size={16} />}
          label="C大调把位明细 CSV"
          title="导出 C 大调把位明细 CSV"
          onClick={() => onExport("scale-pattern-clicks-csv")}
        />
        <ExportButton
          icon={<Download size={16} />}
          label="C大调把位弱点 CSV"
          title="导出 C 大调把位弱点 CSV"
          onClick={() => onExport("scale-pattern-weak-points-csv")}
        />
      </div>
    </section>
  );
}

type ChordArpeggioPracticeProps = {
  memory: PracticeMemory;
  rng: () => number;
  onExport: (format: ExportFormat) => void;
  onMemoryChange: (memory: PracticeMemory) => void;
  onModeChange: (mode: AppMode) => void;
};

type ChordArpeggioScreen =
  | "ready"
  | "answer"
  | "recall"
  | "question-review"
  | "run-review";

function makeChordAnswerMarkers(
  question: ChordArpeggioQuestion
): Record<string, FretboardMarker> {
  return Object.fromEntries(
    question.ascendingSteps.map((step) => [
      positionKey(step.position),
      { tone: "answer", label: `${step.noteName}/${step.degree}` } satisfies FretboardMarker,
    ])
  );
}

function groupChordStepsByString(question: ChordArpeggioQuestion) {
  return [6, 5, 4, 3, 2, 1].map((string) => ({
    string,
    steps: question.ascendingSteps.filter((step) => step.position.string === string),
  }));
}

function ChordArpeggioPractice({
  memory,
  rng,
  onExport,
  onMemoryChange,
  onModeChange,
}: ChordArpeggioPracticeProps) {
  const [screen, setScreen] = useState<ChordArpeggioScreen>("ready");
  const [selectedChordId, setSelectedChordId] =
    useState<ChordArpeggioChord["id"]>("Cmaj7");
  const [questions, setQuestions] = useState<ChordArpeggioQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [clicks, setClicks] = useState<ChordArpeggioClick[]>([]);
  const [results, setResults] = useState<ChordArpeggioQuestionResult[]>([]);
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null);
  const [questionStartedAtIso, setQuestionStartedAtIso] = useState<string | null>(null);
  const [runStartedAtIso, setRunStartedAtIso] = useState<string | null>(null);
  const [lastWrongKey, setLastWrongKey] = useState<string | null>(null);
  const [savedRun, setSavedRun] = useState<ChordArpeggioRun | null>(null);

  const selectedChord =
    CHORD_ARPEGGIO_CHORDS.find((chord) => chord.id === selectedChordId) ??
    CHORD_ARPEGGIO_CHORDS[0];
  const currentQuestion = questions[questionIndex] ?? null;
  const currentStepIndex = useMemo(() => getChordArpeggioStepIndex(clicks), [clicks]);
  const lastResult = results[results.length - 1] ?? null;

  function startChordArpeggio() {
    const now = new Date().toISOString();

    setQuestions(createChordArpeggioSession(selectedChord.id, rng));
    setQuestionIndex(0);
    setClicks([]);
    setResults([]);
    setSavedRun(null);
    setRunStartedAtIso(now);
    setQuestionStartedAtIso(null);
    setQuestionStartedAt(null);
    setLastWrongKey(null);
    setScreen("answer");
  }

  function startRecall() {
    const now = new Date().toISOString();

    setClicks([]);
    setLastWrongKey(null);
    setQuestionStartedAtIso(now);
    setQuestionStartedAt(performance.now());
    setScreen("recall");
  }

  function finishQuestion(nextClicks: ChordArpeggioClick[]) {
    if (!currentQuestion || !questionStartedAtIso || questionStartedAt === null) {
      return;
    }

    const result: ChordArpeggioQuestionResult = {
      question: currentQuestion,
      clicks: nextClicks,
      startedAt: questionStartedAtIso,
      completedAt: new Date().toISOString(),
      totalElapsedMs: Math.max(1, Math.round(performance.now() - questionStartedAt)),
    };

    setResults((current) => [...current, result]);
    setScreen("question-review");
  }

  function handlePositionClick(position: FretboardPosition) {
    if (screen !== "recall" || !currentQuestion || questionStartedAt === null) {
      return;
    }

    const click = createChordArpeggioClick(
      currentQuestion,
      clicks,
      position,
      performance.now() - questionStartedAt
    );
    const nextClicks = [...clicks, click];

    setClicks(nextClicks);

    if (!click.correct) {
      const wrongKey = positionKey(position);
      setLastWrongKey(wrongKey);
      window.setTimeout(() => {
        setLastWrongKey((current) => (current === wrongKey ? null : current));
      }, 900);
      return;
    }

    if (isChordArpeggioQuestionComplete(currentQuestion, nextClicks)) {
      finishQuestion(nextClicks);
    }
  }

  function goNextQuestion() {
    if (questionIndex >= questions.length - 1) {
      const completedAt = new Date().toISOString();
      const run: ChordArpeggioRun = {
        id: makeRunId(),
        startedAt: runStartedAtIso ?? completedAt,
        completedAt,
        chordId: selectedChord.id,
        questions: results,
      };

      setSavedRun(run);
      onMemoryChange(saveChordArpeggioRun(run));
      setScreen("run-review");
      return;
    }

    setQuestionIndex((current) => current + 1);
    setClicks([]);
    setLastWrongKey(null);
    setQuestionStartedAtIso(null);
    setQuestionStartedAt(null);
    setScreen("answer");
  }

  const markerMap = useMemo(() => {
    const markers: Record<string, FretboardMarker> = {};

    if (screen === "answer" && currentQuestion) {
      return makeChordAnswerMarkers(currentQuestion);
    }

    if (screen === "question-review" && lastResult) {
      return makeChordAnswerMarkers(lastResult.question);
    }

    for (const click of clicks) {
      if (click.correct) {
        markers[positionKey(click.position)] = "found";
      }
    }

    if (lastWrongKey) {
      markers[lastWrongKey] = "wrong";
    }

    return markers;
  }, [clicks, currentQuestion, lastResult, lastWrongKey, screen]);

  return (
    <section className="note-map-panel scale-pattern-panel" aria-label="C大调琶音练习">
      <div className="note-map-head">
        <div>
          <p className="eyebrow">C Major Arpeggios</p>
          <h2>C大调琶音</h2>
          <ModeSwitch
            mode="chord-arpeggio"
            onModeChange={(nextMode) => {
              if (nextMode !== "chord-arpeggio") {
                onModeChange(nextMode);
              }
            }}
          />
        </div>

        {screen === "ready" ? (
          <button className="start-button" type="button" onClick={startChordArpeggio}>
            <Play size={20} fill="currentColor" strokeWidth={2.2} />
            开始 8 项
          </button>
        ) : null}
      </div>

      {screen === "ready" ? (
        <>
          <ChordArpeggioChordPicker
            selectedChordId={selectedChordId}
            onSelect={setSelectedChordId}
          />
          <div className="ready-tags" aria-label="C大调琶音配置">
            <span>{selectedChord.name}</span>
            <span>4 个和弦内音</span>
            <span>上行 + 下行</span>
            <span>1-16 品</span>
            <span>严格顺序</span>
          </div>
          <div className="fretboard-scroll ready-board">
            <Fretboard frets={CHORD_ARPEGGIO_FRETS} />
          </div>
          <PracticeMemoryPanel memory={memory} onExport={onExport} />
        </>
      ) : null}

      {screen === "answer" && currentQuestion ? (
        <>
          <div className="note-map-status scale-pattern-status chord-arpeggio-status">
            <div>
              <span>和弦 / 质量</span>
              <strong>
                {currentQuestion.chord.name} · {currentQuestion.chord.quality}
              </strong>
            </div>
            <div>
              <span>起始音</span>
              <strong>{currentQuestion.startTone.noteName}</strong>
            </div>
            <div>
              <span>方向</span>
              <strong>{formatDirection(currentQuestion.direction)}</strong>
            </div>
            <div>
              <span>项目</span>
              <strong>{questionIndex + 1}/8</strong>
            </div>
          </div>
          <ChordArpeggioStringMap question={currentQuestion} />
          <div className="fretboard-scroll">
            <Fretboard frets={CHORD_ARPEGGIO_FRETS} markers={markerMap} />
          </div>
          <button className="start-button scale-start-recall" type="button" onClick={startRecall}>
            <Play size={20} fill="currentColor" strokeWidth={2.2} />
            开始回忆
          </button>
        </>
      ) : null}

      {screen === "recall" && currentQuestion ? (
        <>
          <div className="note-map-status scale-pattern-status chord-arpeggio-status">
            <div>
              <span>和弦</span>
              <strong>{currentQuestion.chord.name}</strong>
            </div>
            <div>
              <span>方向</span>
              <strong>{formatDirection(currentQuestion.direction)}</strong>
            </div>
            <div>
              <span>步骤</span>
              <strong>
                {Math.min(currentStepIndex + 1, currentQuestion.steps.length)}/
                {currentQuestion.steps.length}
              </strong>
            </div>
            <div>
              <span>错点</span>
              <strong>{clicks.filter((click) => !click.correct).length}</strong>
            </div>
          </div>
          <div className="fretboard-scroll">
            <Fretboard
              frets={CHORD_ARPEGGIO_FRETS}
              markers={markerMap}
              onPositionClick={handlePositionClick}
            />
          </div>
          <div className="feedback" role="status">
            {lastWrongKey ? "这个位置不是当前步骤" : " "}
          </div>
        </>
      ) : null}

      {screen === "question-review" && lastResult ? (
        <ChordArpeggioQuestionReview
          result={lastResult}
          isLast={questionIndex >= questions.length - 1}
          onNext={goNextQuestion}
        />
      ) : null}

      {screen === "run-review" && savedRun ? (
        <ChordArpeggioRunReview
          run={savedRun}
          onExport={onExport}
          onRestart={startChordArpeggio}
        />
      ) : null}
    </section>
  );
}

type ChordArpeggioChordPickerProps = {
  selectedChordId: ChordArpeggioChord["id"];
  onSelect: (chordId: ChordArpeggioChord["id"]) => void;
};

function ChordArpeggioChordPicker({
  selectedChordId,
  onSelect,
}: ChordArpeggioChordPickerProps) {
  return (
    <div className="chord-picker" aria-label="琶音和弦选择">
      {CHORD_ARPEGGIO_CHORDS.map((chord) => (
        <button
          className={chord.id === selectedChordId ? "is-selected" : ""}
          key={chord.id}
          type="button"
          onClick={() => onSelect(chord.id)}
        >
          <strong>{chord.name}</strong>
          <span>{chord.quality}</span>
        </button>
      ))}
    </div>
  );
}

type ChordArpeggioStringMapProps = {
  question: ChordArpeggioQuestion;
};

function ChordArpeggioStringMap({ question }: ChordArpeggioStringMapProps) {
  return (
    <div className="scale-string-map" aria-label="琶音答案">
      {groupChordStepsByString(question).map((row) => (
        <div className="scale-string-row" key={row.string}>
          <span>{row.string}弦</span>
          <strong>
            {row.steps.map((step) => `${step.noteName}/${step.degree}`).join(" ")}
          </strong>
        </div>
      ))}
    </div>
  );
}

type ChordArpeggioQuestionReviewProps = {
  result: ChordArpeggioQuestionResult;
  isLast: boolean;
  onNext: () => void;
};

function ChordArpeggioQuestionReview({
  result,
  isLast,
  onNext,
}: ChordArpeggioQuestionReviewProps) {
  const wrongClicks = result.clicks.filter((click) => !click.correct).length;
  const markers = makeChordAnswerMarkers(result.question);

  return (
    <section className="note-map-review" aria-label="C大调琶音短复盘">
      <div className="review-heading">
        <div>
          <p className="eyebrow">Arpeggio Review</p>
          <h2>
            {result.question.chord.name} · {result.question.startTone.noteName} ·{" "}
            {formatDirection(result.question.direction)}
          </h2>
        </div>
        <button className="submit-button compact" type="button" onClick={onNext}>
          {isLast ? "完成整轮" : "下一项目"}
        </button>
      </div>
      <div className="metric-strip review-metrics">
        <Metric icon={<Timer size={18} />} label="用时" value={formatMs(result.totalElapsedMs)} />
        <Metric icon={<Activity size={18} />} label="步骤" value={`${result.question.steps.length}`} />
        <Metric icon={<Flame size={18} />} label="错点" value={`${wrongClicks}`} />
        <Metric icon={<Trophy size={18} />} label="点击" value={`${result.clicks.length}`} />
      </div>
      <ChordArpeggioStringMap question={result.question} />
      <div className="fretboard-scroll">
        <Fretboard frets={CHORD_ARPEGGIO_FRETS} markers={markers} />
      </div>
    </section>
  );
}

type ChordArpeggioRunReviewProps = {
  run: ChordArpeggioRun;
  onExport: (format: ExportFormat) => void;
  onRestart: () => void;
};

function ChordArpeggioRunReview({
  run,
  onExport,
  onRestart,
}: ChordArpeggioRunReviewProps) {
  const summary = createChordArpeggioRunSummary(run);
  const weakest =
    summary.weakestStartNote || summary.weakestDirection || summary.weakestDegree
      ? [
          summary.weakestStartNote,
          summary.weakestDirection ? formatDirection(summary.weakestDirection) : null,
          summary.weakestDegree,
        ]
          .filter(Boolean)
          .join(" · ")
      : "-";

  return (
    <section className="note-map-review" aria-label="C大调琶音整轮复盘">
      <div className="review-heading">
        <div>
          <p className="eyebrow">Arpeggio Complete</p>
          <h2>{run.chordId} 琶音复盘</h2>
        </div>
        <button className="submit-button compact" type="button" onClick={onRestart}>
          再练一轮
        </button>
      </div>
      <div className="metric-strip review-metrics">
        <Metric icon={<Activity size={18} />} label="项目" value={`${summary.questionCount}`} />
        <Metric icon={<Timer size={18} />} label="平均每项" value={formatMs(summary.averageQuestionMs)} />
        <Metric icon={<Flame size={18} />} label="总错点" value={`${summary.wrongClicks}`} />
        <Metric icon={<Trophy size={18} />} label="最弱" value={weakest} />
      </div>
      <section className="review-list">
        <h3>每个项目</h3>
        {summary.questionSummaries.map((question) => (
          <div className="review-row" key={question.question.id}>
            <span>
              {question.question.startTone.noteName} ·{" "}
              {formatDirection(question.question.direction)}
            </span>
            <strong>
              {formatMs(question.totalElapsedMs)} · 错 {question.wrongClicks}
            </strong>
          </div>
        ))}
      </section>
      <div className="export-actions note-map-export">
        <ExportButton
          icon={<Table size={16} />}
          label="琶音明细 CSV"
          title="导出 C 大调琶音明细 CSV"
          onClick={() => onExport("chord-arpeggio-clicks-csv")}
        />
        <ExportButton
          icon={<Download size={16} />}
          label="琶音弱点 CSV"
          title="导出 C 大调琶音弱点 CSV"
          onClick={() => onExport("chord-arpeggio-weak-points-csv")}
        />
      </div>
    </section>
  );
}

type PracticeMemoryPanelProps = {
  compact?: boolean;
  memory: PracticeMemory;
  onExport: (format: ExportFormat) => void;
};

function PracticeMemoryPanel({ compact = false, memory, onExport }: PracticeMemoryPanelProps) {
  const progress = useMemo(() => createProgressSummary(memory.runs), [memory.runs]);
  const weakPoints = useMemo(
    () => createWeakPointStats(memory.runs).slice(0, compact ? 3 : 5),
    [compact, memory.runs]
  );

  return (
    <section className={`memory-panel ${compact ? "compact" : ""}`} aria-label="练习记忆">
      <div className="memory-heading">
        <div>
          <p className="eyebrow">Practice Memory</p>
          <h3>练习记忆</h3>
        </div>

        <div className="export-actions">
          <ExportButton
            icon={<FileJson size={16} />}
            label="JSON"
            title="导出 JSON"
            onClick={() => onExport("json")}
          />
          <ExportButton
            icon={<Table size={16} />}
            label="明细 CSV"
            title="导出答题明细 CSV"
            onClick={() => onExport("answers-csv")}
          />
          <ExportButton
            icon={<Download size={16} />}
            label="弱点 CSV"
            title="导出薄弱点 CSV"
            onClick={() => onExport("weak-points-csv")}
          />
          <ExportButton
            icon={<Table size={16} />}
            label="地图明细 CSV"
            title="导出音名地图明细 CSV"
            onClick={() => onExport("note-map-clicks-csv")}
          />
          <ExportButton
            icon={<Download size={16} />}
            label="地图弱点 CSV"
            title="导出音名地图弱点 CSV"
            onClick={() => onExport("note-map-weak-points-csv")}
          />
          <ExportButton
            icon={<Table size={16} />}
            label="把位明细 CSV"
            title="导出 C 大调把位明细 CSV"
            onClick={() => onExport("scale-pattern-clicks-csv")}
          />
          <ExportButton
            icon={<Download size={16} />}
            label="把位弱点 CSV"
            title="导出 C 大调把位弱点 CSV"
            onClick={() => onExport("scale-pattern-weak-points-csv")}
          />
          <ExportButton
            icon={<Table size={16} />}
            label="琶音明细 CSV"
            title="导出 C 大调琶音明细 CSV"
            onClick={() => onExport("chord-arpeggio-clicks-csv")}
          />
          <ExportButton
            icon={<Download size={16} />}
            label="琶音弱点 CSV"
            title="导出 C 大调琶音弱点 CSV"
            onClick={() => onExport("chord-arpeggio-weak-points-csv")}
          />
        </div>
      </div>

      <div className="memory-metrics" aria-label="长期统计">
        <MiniStat label="总局数" value={`${progress.runCount}`} />
        <MiniStat label="总题数" value={`${progress.totalAnswers}`} />
        <MiniStat label="总正确率" value={formatPercent(progress.accuracy)} />
        <MiniStat label="近5局均速" value={formatMs(progress.recentAverageMs)} />
      </div>

      <div className="weak-list" aria-label="当前薄弱点">
        <h4>当前薄弱点</h4>
        {weakPoints.length ? (
          weakPoints.map((weakPoint) => (
            <div className="weak-row" key={weakPoint.key}>
              <span>{positionLabel(weakPoint.position)}</span>
              <strong>
                {formatMs(weakPoint.averageMs)} · {formatPercent(weakPoint.accuracy)}
              </strong>
            </div>
          ))
        ) : (
          <p className="empty-state">暂无记录</p>
        )}
      </div>
    </section>
  );
}

type MiniStatProps = {
  label: string;
  value: string;
};

function MiniStat({ label, value }: MiniStatProps) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type ExportButtonProps = {
  icon: ReactNode;
  label: string;
  title: string;
  onClick: () => void;
};

function ExportButton({ icon, label, title, onClick }: ExportButtonProps) {
  return (
    <button className="export-button" type="button" onClick={onClick} title={title}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

type MetricProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

function Metric({ icon, label, value }: MetricProps) {
  return (
    <div className="metric">
      <span className="metric-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type ReviewProps = {
  answers: PracticeAnswer[];
  memory: PracticeMemory;
  onExport: (format: ExportFormat) => void;
  runs: PracticeRun[];
  onRestart: () => void;
};

function Review({ answers, memory, onExport, runs, onRestart }: ReviewProps) {
  const summary = useMemo(() => createPracticeSummary(answers), [answers]);
  const recentRuns = runs.slice(0, 4);

  return (
    <section className="review-grid" aria-labelledby="review-title">
      <div className="review-main">
        <div className="review-heading">
          <div>
            <p className="eyebrow">Session Complete</p>
            <h2 id="review-title">本局复盘</h2>
          </div>
          <button className="submit-button compact" type="button" onClick={onRestart}>
            再练一局
          </button>
        </div>

        <div className="metric-strip review-metrics" aria-label="复盘统计">
          <Metric icon={<Trophy size={18} />} label="正确率" value={formatPercent(summary.accuracy)} />
          <Metric icon={<Timer size={18} />} label="平均" value={formatMs(summary.averageMs)} />
          <Metric icon={<BarChart3 size={18} />} label="中位" value={formatMs(summary.medianMs)} />
          <Metric icon={<Activity size={18} />} label="错题" value={`${summary.mistakes.length}`} />
        </div>

        <div className="fretboard-scroll review-board">
          <Fretboard heatmap={summary.positionStats} />
        </div>
      </div>

      <aside className="review-side" aria-label="弱点复盘">
        <PracticeMemoryPanel compact memory={memory} onExport={onExport} />

        <section className="review-list">
          <h3>最慢 5 个位置</h3>
          {summary.slowest.map((answer, index) => (
            <div className="review-row" key={`${answer.question.id}-${index}`}>
              <span>{positionLabel(answer.question.position)}</span>
              <strong>{formatMs(answer.elapsedMs)}</strong>
            </div>
          ))}
        </section>

        <section className="review-list">
          <h3>错误位置</h3>
          {summary.mistakes.length ? (
            summary.mistakes.map((answer, index) => (
              <div className="review-row mistake" key={`${answer.question.id}-mistake-${index}`}>
                <span>{positionLabel(answer.question.position)}</span>
                <strong>{formatPitchClass(answer.question.position.pitchClass)}</strong>
              </div>
            ))
          ) : (
            <p className="empty-state">全对</p>
          )}
        </section>

        <section className="review-list">
          <h3>最近记录</h3>
          {recentRuns.map((run) => {
            const runSummary = createPracticeSummary(run.answers);
            return (
              <div className="review-row history" key={run.id}>
                <span>
                  {new Intl.DateTimeFormat("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(run.completedAt))}
                </span>
                <strong>
                  {formatPercent(runSummary.accuracy)} · {formatMs(runSummary.averageMs)}
                </strong>
              </div>
            );
          })}
        </section>
      </aside>
    </section>
  );
}
