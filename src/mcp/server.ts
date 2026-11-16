import path from 'node:path';
import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { diagnoseProject, formatDiagnosis } from '../diagnose/run.js';
import { format } from '../report/format.js';
import { gateProject, lintProject, UsageError, type Report } from '../run.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

const framework = z.enum(['playwright', 'cypress']).optional().describe('Override framework detection.');

const paths = z
  .array(z.string())
  .optional()
  .describe('Files, folders or globs relative to the project root. Default: tests/, cypress/ and e2e/.');

function text(result: Report): CallToolResult {
  return { content: [{ type: 'text', text: format(result.findings, result.summary, 'text') }] };
}

function failure(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: 'text', text: error instanceof UsageError ? message : `redfirst: ${message}` }] };
}

/** The agent works on this project only: no absolute paths, nothing above the root. */
function inside(root: string, requested: string[] | undefined): string[] | undefined {
  for (const p of requested ?? []) {
    const relative = path.relative(root, path.resolve(root, p));
    if (path.isAbsolute(p) || relative.startsWith('..')) throw new UsageError(`${p} is outside the project.`);
  }
  return requested;
}

/**
 * lint and gate for the project at `root`. The gate's human overrides (allow removal, protected files,
 * dependencies) are deliberately not exposed: an agent that could pass them could wave its own change through.
 */
export function createServer(root: string, version: string): McpServer {
  const server = new McpServer({ name: 'redfirst', version });

  server.registerTool(
    'lint',
    {
      title: 'Lint test files',
      description:
        'Static checks on Playwright and Cypress test files: floating assertions, hard waits, focused tests, ' +
        'tests with no or presence-only assertions, swallowed failures, tautologies, brittle selectors. ' +
        'Run it on every test file you write or change, and fix errors without weakening any assertion.',
      inputSchema: z.object({ paths, framework }),
      annotations: READ_ONLY,
    },
    async (input) => {
      try {
        return text(await lintProject(root, { paths: inside(root, input.paths), framework: input.framework }));
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'gate',
    {
      title: 'Check a change for weakened tests',
      description:
        'Compares the tests at a git ref with the working tree (or a second ref) and fails when the change ' +
        'removes a test or an assertion, weakens a matcher, changes an expected value, adds skip/only, adds new ' +
        'lint findings, or touches test/CI config, dependencies or the guards themselves. Run it before you say a ' +
        'test fix is done. A failure is for a human to decide; there is no override here.',
      inputSchema: z.object({
        base: z.string().min(1).describe('Git ref to compare against, for example origin/main or HEAD.'),
        head: z.string().min(1).optional().describe('Git ref to check. Default: the working tree.'),
        mode: z
          .enum(['review', 'heal'])
          .optional()
          .describe('heal when the change repairs failing tests: then a changed expected value is an error.'),
        paths: paths.describe('Only compare test files matching these globs.'),
        framework,
      }),
      annotations: READ_ONLY,
    },
    async (input) => {
      try {
        return text(
          gateProject(root, {
            base: input.base,
            head: input.head,
            mode: input.mode,
            paths: inside(root, input.paths),
            framework: input.framework,
          }),
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'classify_failure',
    {
      title: 'Diagnose a failing test',
      description:
        'Reads a Playwright JSON report with traces and says, for each failed test, why it failed with the ' +
        'evidence (the calls and steps of the run, and what changed since a passing run), the probable cause, ' +
        'what a fix may and must not do, the questions only a human can answer, and a bug report draft when ' +
        'the app is at fault. Run it before you change a failing test. If the action is not update-test, do not ' +
        'change the test: report and ask.',
      inputSchema: z.object({
        report: z.string().min(1).describe('JSON report of the failing run, relative to the project root.'),
        passing: z.string().min(1).optional().describe('JSON report of a run where the tests passed, with traces.'),
        base: z.string().min(1).optional().describe('Git ref of the passing run, to show test code changed since then.'),
      }),
      annotations: READ_ONLY,
    },
    async (input) => {
      try {
        const [report, passing] = inside(root, [input.report, ...(input.passing ? [input.passing] : [])]) ?? [];
        const diagnoses = diagnoseProject(root, { report: report!, passing, base: input.base });
        return {
          content: [{ type: 'text', text: diagnoses.length ? diagnoses.map(formatDiagnosis).join('\n\n') : 'No failed tests in the report.' }],
        };
      } catch (error) {
        return failure(error);
      }
    },
  );

  return server;
}

export async function serve(root: string, version: string): Promise<void> {
  await createServer(root, version).connect(new StdioServerTransport());
}
