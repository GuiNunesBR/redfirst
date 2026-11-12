import type { Rule } from './rule.js';
import { floatingAssertion } from './rules/tl001-floating-assertion.js';
import { hardWait } from './rules/tl002-hard-wait.js';
import { focusedTest } from './rules/tl003-focused-test.js';
import { unexplainedSkip } from './rules/tl004-unexplained-skip.js';
import { noAssertion } from './rules/tl005-no-assertion.js';
import { presenceOnly } from './rules/tl006-presence-only.js';
import { brittleSelector } from './rules/tl007-brittle-selector.js';
import { conditionalTestLogic } from './rules/tl008-conditional-test-logic.js';
import { legacySelectorApi } from './rules/tl009-legacy-selector-api.js';
import { cypressAsyncMisuse } from './rules/tl010-cypress-async-misuse.js';
import { swallowedFailure } from './rules/tl011-swallowed-failure.js';
import { tautologicalAssertion } from './rules/tl012-tautological-assertion.js';

export const RULES: Rule[] = [
  floatingAssertion,
  hardWait,
  focusedTest,
  unexplainedSkip,
  noAssertion,
  presenceOnly,
  brittleSelector,
  conditionalTestLogic,
  legacySelectorApi,
  cypressAsyncMisuse,
  swallowedFailure,
  tautologicalAssertion,
];

/** Reported by the engine itself, not by a rule. */
export const DISABLE_WITHOUT_REASON = {
  id: 'TL000',
  name: 'disable-without-reason',
  severity: 'error' as const,
  description: 'A redfirst-disable comment must name the rules and give a reason after "--".',
  fix: '// redfirst-disable-next-line TL007 -- why this is fine here',
};
