import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MessageBody } from "../MessageBody";

describe("MessageBody", () => {
  it("turns links to this app into in-app links and leaves others as text", () => {
    const origin = window.location.origin;
    render(
      <MemoryRouter>
        <MessageBody body={`Verify: ${origin}/verify-email?token=abc\nJoin: https://meet.trialdesk.example/trial/CY-1`} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: `${origin}/verify-email?token=abc` })).toHaveAttribute("href", "/verify-email?token=abc");
    expect(screen.queryByRole("link", { name: /meet\.trialdesk/ })).toBeNull();
    expect(screen.getByText(/meet\.trialdesk\.example/)).toBeInTheDocument();
  });
});
