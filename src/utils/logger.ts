/**
 * Lightweight logger for AI API requests.
 *
 * Logs: timestamp, method name, provider, model, duration, success/failure,
 * and HTTP status code on errors.
 *
 * Deliberately does NOT log:
 *   - API keys
 *   - Prompt content (could contain sensitive client data)
 *   - Full response content
 */

export interface AiLogEntry {
  provider: string;
  method: string;
  model: string;
  durationMs: number;
  success: boolean;
  error?: string;
  statusCode?: number;
}

export function logAiRequest(entry: AiLogEntry): void {
  const timestamp = new Date().toISOString();
  const status = entry.success ? 'OK' : 'FAIL';
  const errorSuffix = entry.error ? ` | ${entry.error}` : '';
  const statusSuffix = entry.statusCode !== undefined ? ` | HTTP ${entry.statusCode}` : '';

  console.log(
    `[AI ${timestamp}] ${entry.method} | ${entry.provider} | ${entry.model} | ${entry.durationMs}ms | ${status}${errorSuffix}${statusSuffix}`
  );
}
