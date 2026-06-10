import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { DEFAULT_CONFIG, positionKey } from "./domain/fretboard";
import { createNoteMapSession } from "./domain/noteMap";

describe("App", () => {
  it("waits on the ready screen before starting the first timed question", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={() => 0} />);

    expect(screen.getByRole("button", { name: "开始 30 题" })).toBeInTheDocument();
    expect(screen.queryByLabelText("音名答案")).not.toBeInTheDocument();
    expect(container.querySelector(".target-dot")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "开始 30 题" }));

    expect(screen.getByLabelText("音名答案")).toBeInTheDocument();
    expect(container.querySelector(".target-dot")).toBeInTheDocument();
    expect(screen.getByText("1/30")).toBeInTheDocument();
  });

  it("shows export actions on the ready screen", () => {
    render(<App rng={() => 0} />);

    expect(screen.getByRole("button", { name: "JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "明细 CSV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "弱点 CSV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "地图明细 CSV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "地图弱点 CSV" })).toBeInTheDocument();
  });

  it("accepts a correct keyboard answer and advances", async () => {
    const user = userEvent.setup();
    render(<App rng={() => 0} />);

    await user.click(screen.getByRole("button", { name: "开始 30 题" }));
    await user.type(screen.getByLabelText("音名答案"), "F{Enter}");

    expect(screen.getByRole("status")).toHaveTextContent("正确 · F");
    expect(screen.getByText("2/30")).toBeInTheDocument();
  });

  it("completes a 30-question session and shows review", async () => {
    const user = userEvent.setup();
    render(<App rng={() => 0} />);

    await user.click(screen.getByRole("button", { name: "开始 30 题" }));

    for (let index = 0; index < 30; index += 1) {
      await user.type(screen.getByLabelText("音名答案"), "C{Enter}");
    }

    expect(await screen.findByText("本局复盘")).toBeInTheDocument();
    expect(screen.getByText("再练一局")).toBeInTheDocument();
  });

  it("runs one note-map question and shows the short review", async () => {
    const user = userEvent.setup();
    const questions = createNoteMapSession(DEFAULT_CONFIG, () => 0);
    const question = questions[0];
    const correctKeys = new Set(question.positions.map(positionKey));
    const wrongPosition = DEFAULT_CONFIG.strings
      .flatMap((string) => DEFAULT_CONFIG.frets.map((fret) => ({ string, fret })))
      .find((position) => !correctKeys.has(positionKey(position)));

    render(<App rng={() => 0} />);

    await user.click(screen.getByRole("button", { name: "音名地图" }));
    await user.click(screen.getByRole("button", { name: "开始 12 音" }));

    expect(screen.getByText("目标音名")).toBeInTheDocument();

    if (!wrongPosition) {
      throw new Error("Expected a wrong position candidate");
    }

    await user.click(screen.getByTestId(`fret-${wrongPosition.string}-${wrongPosition.fret}`));

    expect(screen.getByRole("status")).toHaveTextContent("这个位置不是当前目标音");

    for (const position of question.positions) {
      await user.click(screen.getByTestId(`fret-${position.string}-${position.fret}`));
    }

    expect(await screen.findByLabelText("音名短复盘")).toBeInTheDocument();
    expect(screen.getByText("下一音名")).toBeInTheDocument();
  });

  it("completes a note-map session and shows the run review", async () => {
    const user = userEvent.setup();
    const questions = createNoteMapSession(DEFAULT_CONFIG, () => 0);

    render(<App rng={() => 0} />);

    await user.click(screen.getByRole("button", { name: "音名地图" }));
    await user.click(screen.getByRole("button", { name: "开始 12 音" }));

    for (const [index, question] of questions.entries()) {
      for (const position of question.positions) {
        await user.click(screen.getByTestId(`fret-${position.string}-${position.fret}`));
      }

      await user.click(screen.getByRole("button", { name: "下一音名" }));

      if (index < questions.length - 1) {
        expect(screen.getByText(`${index + 2}/12`)).toBeInTheDocument();
      }
    }

    expect(await screen.findByText("音名地图复盘")).toBeInTheDocument();
    expect(screen.getByText("再练一轮")).toBeInTheDocument();
  }, 15000);
});
