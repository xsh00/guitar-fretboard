import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

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
});
