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
import { Fretboard } from "./components/Fretboard";
import {
  DEFAULT_CONFIG,
  PracticeConfig,
  formatPitchClass,
  isCorrectNoteAnswer,
  parseNoteName,
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
import { createProgressSummary, createWeakPointStats } from "./domain/analytics";
import {
  createAnswerCsvExport,
  createJsonExport,
  createWeakPointCsvExport,
} from "./domain/export";
import { PracticeMemory, loadPracticeMemory, savePracticeRun } from "./domain/storage";

type Feedback =
  | { tone: "correct"; text: string }
  | { tone: "wrong"; text: string }
  | { tone: "invalid"; text: string }
  | null;

type AppProps = {
  rng?: () => number;
};

type ExportFormat = "json" | "answers-csv" | "weak-points-csv";

function formatMs(value: number): string {
  if (!value) {
    return "0.00s";
  }

  return `${(value / 1000).toFixed(2)}s`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
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
          <ReadyPanel
            memory={memory}
            questionCount={config.questionCount}
            onExport={handleExport}
            onStart={startPractice}
          />
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
  questionCount: number;
  onExport: (format: ExportFormat) => void;
  onStart: () => void;
};

function ReadyPanel({ memory, questionCount, onExport, onStart }: ReadyPanelProps) {
  return (
    <section className="ready-panel" aria-label="练习准备">
      <div className="ready-copy">
        <p className="eyebrow">Position to Note</p>
        <h2>位置到音名</h2>
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
