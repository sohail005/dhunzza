/** Dev-only console logging for Firebase read/listener/cache activity — a no-op in production builds. */
export function debugLog(scope: string, message: string, data?: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  if (data !== undefined) {
    console.debug(`[firebase:${scope}] ${message}`, data);
  } else {
    console.debug(`[firebase:${scope}] ${message}`);
  }
}
