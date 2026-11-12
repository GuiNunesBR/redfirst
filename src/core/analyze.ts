import type ts from 'typescript';
import { findAssertions, type Assertion } from './assertions.js';
import { detectFramework } from './framework.js';
import { parseSource } from './source.js';
import { findBlocks, type InlineSkip, type TestBlock } from './tests.js';
import type { Framework } from './types.js';

export interface AnalyzedTest {
  block: TestBlock;
  assertions: Assertion[];
}

export interface Analysis {
  file: string;
  text: string;
  sf: ts.SourceFile;
  framework: Framework;
  blocks: TestBlock[];
  tests: AnalyzedTest[];
  inlineSkips: InlineSkip[];
  /** Every assertion in the file, including the ones in helpers and hooks. */
  assertions: Assertion[];
}

export function analyze(file: string, text: string, framework?: Framework): Analysis {
  const sf = parseSource(file, text);
  const { blocks, inlineSkips } = findBlocks(sf);
  const tests = blocks
    .filter((b) => b.kind === 'test')
    .map((block) => ({ block, assertions: findAssertions(block.fn.body, sf) }));
  return {
    file,
    text,
    sf,
    framework: framework && framework !== 'unknown' ? framework : detectFramework(sf, file),
    blocks,
    tests,
    inlineSkips,
    assertions: findAssertions(sf, sf),
  };
}
