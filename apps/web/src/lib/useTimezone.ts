import { isValidZone, normalizeZone } from "@trial/shared";
import { useCallback, useState } from "react";

const KEY = "trialdesk.timezone";

function detect(): string | null {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return z && isValidZone(z) ? normalizeZone(z) : null;
  } catch {
    return null;
  }
}
function stored(): string | null {
  try {
    const z = localStorage.getItem(KEY);
    return z && isValidZone(z) ? normalizeZone(z) : null;
  } catch {
    return null;
  }
}

/** Parent's zone: their saved choice, else the browser's, else null (picker opens). */
export function useTimezone() {
  const [detected] = useState(detect);
  const [chosen, setChosen] = useState(stored);
  const setTz = useCallback((z: string) => {
    setChosen(z);
    try {
      localStorage.setItem(KEY, z);
    } catch {
      /* private mode: keep it in memory */
    }
  }, []);
  return { tz: chosen ?? detected, setTz, isDetected: !chosen && !!detected, browserTz: detected };
}
