/**
 * Lightweight logger for AI API requests.
 *
 * Logs: timestamp, method name, model, duration, and success/failure.
 *
 * Deliberately does NOT log:
 *   - API keys
 *   - Prompt content (could contain sensitive client data)
 *   - Full response content
 */

export interface AiLogEntry {
  method: string;
  model: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export function logAiRequest(entry: AiLogEntry): void {
  const timestamp = new Date().toISOString();
  const status = entry.success ? 'OK' : 'FAIL';
  const errorSuffix = entry.error ? ` | ${entry.error}` : '';

  console.log(
    `[AI ${timestamp}] ${entry.method} | ${entry.model} | ${entry.durationMs}ms | ${status}${errorSuffix}`
  );
}
