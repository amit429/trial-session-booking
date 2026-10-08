import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CapacityChart } from "../components/CapacityChart";

describe("CapacityChart", () => {
  it("draws one bar per India date and marks full days", () => {
    render(
      <CapacityChart
        data={[
          { istDate: "2026-10-20", booked: 4, capacity: 18 },
          { istDate: "2026-10-21", booked: 18, capacity: 18 }
        ]}
      />
    );
    expect(screen.getByRole("img", { name: /booked versus capacity/i })).toBeInTheDocument();
    expect(screen.getByText("Tue 20 Oct: 4 of 18 booked")).toBeInTheDocument();
    const full = screen.getByText("Wed 21 Oct: 18 of 18 booked").parentElement!;
    expect(full.querySelector("[data-full='true']")).not.toBeNull();
  });
});
