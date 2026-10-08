import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const SHOW_AFTER_MS = 150;

/** Thin bar at the top of the viewport while anything is loading or saving (shown after 150 ms to avoid flicker). */
export function GlobalProgress() {
  const busy = useIsFetching() + useIsMutating() > 0;
  const [delayPassed, setDelayPassed] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setDelayPassed(true), SHOW_AFTER_MS);
    return () => {
      clearTimeout(t);
      setDelayPassed(false);
    };
  }, [busy]);
  const visible = busy && delayPassed;
  return (
    <div role="progressbar" aria-label="Loading" aria-hidden={!visible} className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden" style={{ top: "env(safe-area-inset-top, 0px)" }}>
      {visible && <div className="h-full w-1/3 animate-[progress_1.1s_ease-in-out_infinite] rounded-full bg-brand" />}
    </div>
  );
}
