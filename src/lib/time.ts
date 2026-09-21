const IST_TIME_ZONE = "Asia/Kolkata";

/**
 * Current hour (0-23) in IST, independent of the visitor's local timezone.
 */
export function getISTHour(date: Date = new Date()): number {
  const hourString = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIME_ZONE,
    hour: "numeric",
    hour12: false,
  }).format(date);
  // "24" is returned for midnight by some environments; normalize to 0.
  return Number(hourString) % 24;
}

/**
 * Current time in IST formatted as HH:mm (24-hour).
 */
export function formatISTClock(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Formats seconds as m:ss (or h:mm:ss for long tracks).
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
