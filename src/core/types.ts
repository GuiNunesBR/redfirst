export type Framework = 'playwright' | 'cypress' | 'unknown';

export type Severity = 'error' | 'warn';

export interface Finding {
  rule: string;
  severity: Severity;
  file: string;
  line: number;
  column: number;
  message: string;
  /** Full title of the test the finding belongs to, when there is one. */
  test?: string;
}
