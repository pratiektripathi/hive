const TOUR_COMPLETED_PREFIX = "hive:tourCompleted:";
const GETTING_STARTED_UNTIL_KEY = "hive:gettingStartedUntil";
const AUTO_START_SESSION_KEY = "hive:tourAutoStarted";
export const GETTING_STARTED_MS = 5 * 60_000;

export function hasCompletedTour(userId: string): boolean {
  if (!userId) return false;
  return localStorage.getItem(`${TOUR_COMPLETED_PREFIX}${userId}`) === "1";
}

export function markTourCompleted(userId: string): void {
  if (!userId) return;
  localStorage.setItem(`${TOUR_COMPLETED_PREFIX}${userId}`, "1");
}

export function markGettingStartedWindow(): void {
  sessionStorage.setItem(
    GETTING_STARTED_UNTIL_KEY,
    String(Date.now() + GETTING_STARTED_MS)
  );
}

export function isGettingStartedVisible(): boolean {
  const raw = sessionStorage.getItem(GETTING_STARTED_UNTIL_KEY);
  if (!raw) return false;
  const until = Number(raw);
  if (!Number.isFinite(until)) return false;
  return Date.now() < until;
}

export function gettingStartedRemainingMs(): number {
  const raw = sessionStorage.getItem(GETTING_STARTED_UNTIL_KEY);
  if (!raw) return 0;
  const until = Number(raw);
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - Date.now());
}

export function hasAutoStartedTourThisSession(): boolean {
  return sessionStorage.getItem(AUTO_START_SESSION_KEY) === "1";
}

export function markTourAutoStartedThisSession(): void {
  sessionStorage.setItem(AUTO_START_SESSION_KEY, "1");
}
