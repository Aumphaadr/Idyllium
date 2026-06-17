import { compileIdyllium } from '../src';

const fs: any = require('fs');
const path: any = require('path');

interface OldLessonsJson {
  readonly sections: readonly OldSection[];
}

interface OldSection {
  readonly id: string;
  readonly title: string;
  readonly icon?: string;
  readonly lessons: readonly OldLessonRef[];
}

interface OldLessonRef {
  readonly id: string;
  readonly file: string;
  readonly title: string;
}

interface CodeBlockInfo {
  readonly blockIndex: number;
  readonly sourceLine: number;
  readonly lineCount: number;
  readonly form: 'program' | 'module' | 'snippet';
  readonly compileStatus: 'success' | 'failure' | 'skipped';
  readonly diagnosticsText?: string;
  readonly reviewFlags: readonly string[];
}

interface OutputBlockInfo {
  readonly blockIndex: number;
  readonly sourceLine: number;
  readonly preview: string;
}

interface LessonInventory {
  readonly sectionId: string;
  readonly sectionTitle: string;
  readonly lessonId: string;
  readonly lessonPath: string;
  readonly lessonTitle: string;
  readonly htmlTitle: string;
  readonly subtitle: string;
  readonly codeBlocks: readonly CodeBlockInfo[];
  readonly outputBlocks: readonly OutputBlockInfo[];
  readonly reviewFlags: readonly string[];
}

interface InventoryResult {
  readonly version: 1;
  readonly sourceRoot: string;
  readonly generatedAt: string;
  readonly targetStudyLine: readonly string[];
  readonly sections: readonly {
    readonly id: string;
    readonly title: string;
    readonly lessonCount: number;
  }[];
  readonly lessons: readonly LessonInventory[];
  readonly orphanHtmlFiles: readonly string[];
  readonly totals: {
    readonly lessons: number;
    readonly codeBlocks: number;
    readonly outputBlocks: number;
    readonly programCodeBlocks: number;
    readonly moduleCodeBlocks: number;
    readonly snippetCodeBlocks: number;
    readonly compiledPrograms: number;
    readonly failedPrograms: number;
    readonly reviewLessons: number;
  };
}

const DEFAULT_SOURCE_ROOT = '/home/nathaniel/IdylliumProjects/Idyllium/docs/lessons';
const DEFAULT_OUTPUT_ROOT = path.resolve(process.cwd(), 'docs/migration');
const TARGET_STUDY_LINE = ['Консоль', 'Виджеты', 'ООП', 'Canvas', 'JSON'];

function main(): void {
  const sourceRoot = path.resolve(readArg('--source') ?? DEFAULT_SOURCE_ROOT);
  const outputRoot = path.resolve(readArg('--out') ?? DEFAULT_OUTPUT_ROOT);

  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`old documentation root does not exist: ${sourceRoot}`);
  }

  const lessonsJsonPath = path.join(sourceRoot, 'lessons.json');
  if (!fs.existsSync(lessonsJsonPath)) {
    throw new Error(`old lessons.json does not exist: ${lessonsJsonPath}`);
  }

  fs.mkdirSync(outputRoot, { recursive: true });

  const lessonsJson = JSON.parse(fs.readFileSync(lessonsJsonPath, 'utf8')) as OldLessonsJson;
  const referencedFiles = new Set<string>();
  const lessons: LessonInventory[] = [];

  for (const section of lessonsJson.sections) {
    for (const lessonRef of section.lessons) {
      const lessonPath = normalizePath(lessonRef.file);
      referencedFiles.add(lessonPath);
      const absolutePath = path.join(sourceRoot, lessonPath);
      if (!fs.existsSync(absolutePath)) {
        lessons.push(missingLesson(section, lessonRef));
        continue;
      }
      lessons.push(inspectLesson(sourceRoot, absolutePath, section, lessonRef));
    }
  }

  const allHtmlFiles = listHtmlFiles(sourceRoot)
    .map((file) => normalizePath(path.relative(sourceRoot, file)));
  const orphanHtmlFiles = allHtmlFiles
    .filter((file) => !referencedFiles.has(file))
    .sort();

  const inventory: InventoryResult = {
    version: 1,
    sourceRoot,
    generatedAt: new Date().toISOString(),
    targetStudyLine: TARGET_STUDY_LINE,
    sections: lessonsJson.sections.map((section) => ({
      id: section.id,
      title: section.title,
      lessonCount: section.lessons.length,
    })),
    lessons,
    orphanHtmlFiles,
    totals: inventoryTotals(lessons),
  };

  const inventoryPath = path.join(outputRoot, 'lesson-inventory.json');
  const reportPath = path.join(outputRoot, 'outdated-syntax-report.md');
  fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  fs.writeFileSync(reportPath, markdownReport(inventory), 'utf8');

  console.log(`documentation inventory: ${inventory.totals.lessons} lessons`);
  console.log(`code blocks: ${inventory.totals.codeBlocks}, output blocks: ${inventory.totals.outputBlocks}`);
  console.log(`program compile failures: ${inventory.totals.failedPrograms}/${inventory.totals.programCodeBlocks}`);
  console.log(`review lessons: ${inventory.totals.reviewLessons}`);
  console.log(`inventory: ${inventoryPath}`);
  console.log(`report: ${reportPath}`);
}

function inspectLesson(sourceRoot: string, absolutePath: string, section: OldSection, lessonRef: OldLessonRef): LessonInventory {
  const html = fs.readFileSync(absolutePath, 'utf8').replace(/\r\n/g, '\n');
  const lessonPath = normalizePath(path.relative(sourceRoot, absolutePath));
  const codeBlocks = extractCodeBlocks(html).map((block, index) => inspectCodeBlock(lessonPath, block, index + 1));
  const outputBlocks = extractOutputBlocks(html).map((block, index) => ({
    blockIndex: index + 1,
    sourceLine: block.sourceLine,
    preview: previewText(block.text),
  }));
  const reviewFlags = lessonReviewFlags(lessonPath, html, codeBlocks, outputBlocks);

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    lessonId: lessonRef.id,
    lessonPath,
    lessonTitle: lessonRef.title,
    htmlTitle: extractTitle(html),
    subtitle: extractSubtitle(html),
    codeBlocks,
    outputBlocks,
    reviewFlags,
  };
}

function missingLesson(section: OldSection, lessonRef: OldLessonRef): LessonInventory {
  return {
    sectionId: section.id,
    sectionTitle: section.title,
    lessonId: lessonRef.id,
    lessonPath: normalizePath(lessonRef.file),
    lessonTitle: lessonRef.title,
    htmlTitle: '',
    subtitle: '',
    codeBlocks: [],
    outputBlocks: [],
    reviewFlags: ['missing-html-file'],
  };
}

function inspectCodeBlock(lessonPath: string, block: { code: string; sourceLine: number }, blockIndex: number): CodeBlockInfo {
  const form = codeForm(block.code);
  const reviewFlags = codeReviewFlags(block.code);

  if (form !== 'program') {
    return {
      blockIndex,
      sourceLine: block.sourceLine,
      lineCount: lineCount(block.code),
      form,
      compileStatus: 'skipped',
      reviewFlags,
    };
  }

  const result = compileIdyllium(block.code, { file: lessonPath });
  return {
    blockIndex,
    sourceLine: block.sourceLine,
    lineCount: lineCount(block.code),
    form,
    compileStatus: result.success ? 'success' : 'failure',
    diagnosticsText: result.success ? undefined : result.diagnosticsText,
    reviewFlags,
  };
}

function lessonReviewFlags(
  lessonPath: string,
  html: string,
  codeBlocks: readonly CodeBlockInfo[],
  outputBlocks: readonly OutputBlockInfo[],
): string[] {
  const flags = new Set<string>();
  const lowerPath = lessonPath.toLowerCase();

  if (codeBlocks.some((block) => block.compileStatus === 'failure')) flags.add('program-compile-failure');
  if (codeBlocks.some((block) => block.reviewFlags.length > 0)) flags.add('code-needs-review');
  if (lowerPath.includes('/009_increment.')) flags.add('rewrite-increment-lesson-no-plus-plus');
  if (lowerPath.includes('/003_progressbar.')) flags.add('review-progressbar-colors');
  if (lowerPath.includes('/005_colors.')) flags.add('review-console-colors-and-clear');
  if (lowerPath.includes('/016_errors.') || lowerPath.includes('/027_errors.') || lowerPath.includes('/012_errors.')) {
    flags.add('teaching-errors');
  }
  if (!/Canvas/u.test(html) && lowerPath.includes('widgets')) {
    flags.add('pre-canvas-widget-doc');
  }

  return [...flags].sort();
}

function codeReviewFlags(code: string): string[] {
  const flags = new Set<string>();

  if (/(^|[^+])\+\+($|[^+])/u.test(code) || /(^|[^-])--($|[^-])/u.test(code)) {
    flags.add('uses-plus-plus-or-minus-minus');
  }
  if (/\.[ \t]*color\s*=\s*["']#[0-9a-fA-F]{6,8}["']/u.test(code)) {
    flags.add('legacy-widget-color-string');
  }
  if (/#[0-9a-fA-F]{6,8}/u.test(code) && !/\bcolors\s*\.\s*HEX\s*\(/u.test(code)) {
    flags.add('raw-hex-color-string');
  }
  if (/\bgui\s*\.\s*ProgressBar\b/u.test(code)) {
    flags.add('progressbar-example');
  }
  if (/\bconsole\s*\.\s*write\s*\(/u.test(code) && !/\bconsole\s*\.\s*writeln\s*\(/u.test(code)) {
    flags.add('console-write-style');
  }
  if (/\btry\b|\bcatch\b|ОШИБК|Ошибка|ошибка|не скомпилируется|runtime error/iu.test(code)) {
    flags.add('teaching-error-or-error-handling');
  }
  if (/\bmain\s*\(/u.test(code) && !/\buse\s+[A-Za-z_][A-Za-z0-9_]*\s*;/u.test(code)) {
    flags.add('standalone-without-use');
  }
  if (/\bCanvas\b|\bdrawable\s*\./u.test(code)) {
    flags.add('canvas-related');
  }

  return [...flags].sort();
}

function extractCodeBlocks(html: string): Array<{ code: string; sourceLine: number }> {
  const blocks: Array<{ code: string; sourceLine: number }> = [];
  const regex = /<idyl-code-block>\s*<script\s+type="text\/plain">([\s\S]*?)<\/script>\s*<\/idyl-code-block>/giu;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].replace(/\r\n/g, '\n');
    blocks.push({
      code: raw.replace(/^\n/u, '').replace(/\n\s*$/u, ''),
      sourceLine: countNewlines(html.slice(0, match.index)) + 1,
    });
  }

  return blocks;
}

function extractOutputBlocks(html: string): Array<{ text: string; sourceLine: number }> {
  const blocks: Array<{ text: string; sourceLine: number }> = [];
  const regex = /<idyl-output-block(?:\s[^>]*)?>([\s\S]*?)<\/idyl-output-block>/giu;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    blocks.push({
      text: htmlDecode(stripTags(match[1])).replace(/\r\n/g, '\n').trim(),
      sourceLine: countNewlines(html.slice(0, match.index)) + 1,
    });
  }

  return blocks;
}

function codeForm(code: string): 'program' | 'module' | 'snippet' {
  if (/\bmain\s*\(/u.test(code)) return 'program';
  if (/\b(function|class)\b/u.test(code)) return 'module';
  return 'snippet';
}

function extractTitle(html: string): string {
  const h1 = /<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/iu.exec(html);
  if (h1) return htmlDecode(stripTags(h1[1])).trim();

  const title = /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/iu.exec(html);
  if (title) return htmlDecode(stripTags(title[1])).trim();

  return '';
}

function extractSubtitle(html: string): string {
  const subtitle = /<p\s+class="docs-subtitle"[^>]*>([\s\S]*?)<\/p>/iu.exec(html);
  return subtitle ? htmlDecode(stripTags(subtitle[1])).trim() : '';
}

function markdownReport(inventory: InventoryResult): string {
  const flagCounts = new Map<string, number>();
  const codeFlagCounts = new Map<string, number>();

  for (const lesson of inventory.lessons) {
    for (const flag of lesson.reviewFlags) {
      flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
    }
    for (const block of lesson.codeBlocks) {
      for (const flag of block.reviewFlags) {
        codeFlagCounts.set(flag, (codeFlagCounts.get(flag) ?? 0) + 1);
      }
    }
  }

  const reviewLessons = inventory.lessons.filter((lesson) => lesson.reviewFlags.length > 0);
  const failedBlocks = inventory.lessons.flatMap((lesson) => lesson.codeBlocks
    .filter((block) => block.compileStatus === 'failure')
    .map((block) => ({ lesson, block })));

  return `# Documentation Migration Inventory

Generated from:

\`\`\`text
${inventory.sourceRoot}
\`\`\`

Generated at: ${inventory.generatedAt}

## Target Study Line

${inventory.targetStudyLine.map((item, index) => `${index + 1}. ${item}`).join('\n')}

## Summary

- Lessons referenced by old \`lessons.json\`: ${inventory.totals.lessons}
- Code blocks: ${inventory.totals.codeBlocks}
- Output blocks: ${inventory.totals.outputBlocks}
- Program code blocks: ${inventory.totals.programCodeBlocks}
- Module code blocks: ${inventory.totals.moduleCodeBlocks}
- Snippet code blocks: ${inventory.totals.snippetCodeBlocks}
- Program compile failures: ${inventory.totals.failedPrograms}/${inventory.totals.programCodeBlocks}
- Lessons needing manual review: ${inventory.totals.reviewLessons}

## Old Sections

${inventory.sections.map((section) => `- ${section.title} (\`${section.id}\`): ${section.lessonCount}`).join('\n')}

## Lesson Review Flags

${mapTable(flagCounts, ['Flag', 'Lessons'])}

## Code Review Flags

${mapTable(codeFlagCounts, ['Flag', 'Blocks'])}

## Program Compile Failures

${failedBlocks.length === 0 ? 'No standalone program compile failures found.' : failedBlocks.map(({ lesson, block }) => {
    const firstLine = (block.diagnosticsText ?? '').split('\n')[0] ?? '';
    return `- \`${lesson.lessonPath}\` block ${block.blockIndex} line ${block.sourceLine}: ${escapeMarkdown(firstLine)}`;
  }).join('\n')}

## Manual Review Lessons

${reviewLessons.map((lesson) => `- \`${lesson.lessonPath}\` — ${lesson.lessonTitle}: ${lesson.reviewFlags.map((flag) => `\`${flag}\``).join(', ')}`).join('\n')}

## Orphan HTML Files

${inventory.orphanHtmlFiles.length === 0 ? 'No orphan HTML files found.' : inventory.orphanHtmlFiles.map((file) => `- \`${file}\``).join('\n')}

## Notes

- This is an inventory and review radar, not the final migrated documentation.
- The script intentionally does not rewrite lesson prose or code examples.
- Any syntax rewrite must preserve the original pedagogical voice.
`;
}

function mapTable(map: ReadonlyMap<string, number>, headers: [string, string]): string {
  if (map.size === 0) return `| ${headers[0]} | ${headers[1]} |\n| --- | --- |\n| none | 0 |`;
  const rows = [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, value]) => `| \`${key}\` | ${value} |`);
  return `| ${headers[0]} | ${headers[1]} |\n| --- | --- |\n${rows.join('\n')}`;
}

function inventoryTotals(lessons: readonly LessonInventory[]): InventoryResult['totals'] {
  const codeBlocks = lessons.flatMap((lesson) => lesson.codeBlocks);
  const outputBlocks = lessons.flatMap((lesson) => lesson.outputBlocks);

  return {
    lessons: lessons.length,
    codeBlocks: codeBlocks.length,
    outputBlocks: outputBlocks.length,
    programCodeBlocks: codeBlocks.filter((block) => block.form === 'program').length,
    moduleCodeBlocks: codeBlocks.filter((block) => block.form === 'module').length,
    snippetCodeBlocks: codeBlocks.filter((block) => block.form === 'snippet').length,
    compiledPrograms: codeBlocks.filter((block) => block.compileStatus === 'success').length,
    failedPrograms: codeBlocks.filter((block) => block.compileStatus === 'failure').length,
    reviewLessons: lessons.filter((lesson) => lesson.reviewFlags.length > 0).length,
  };
}

function listHtmlFiles(root: string): string[] {
  const result: string[] = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...listHtmlFiles(absolute));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      result.push(absolute);
    }
  }

  return result.sort();
}

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function lineCount(text: string): number {
  if (text.length === 0) return 0;
  return text.split('\n').length;
}

function previewText(text: string): string {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  return normalized.length > 100 ? `${normalized.slice(0, 97)}...` : normalized;
}

function countNewlines(text: string): number {
  return (text.match(/\n/gu) ?? []).length;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/gu, '');
}

function htmlDecode(text: string): string {
  return text
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'");
}

function escapeMarkdown(text: string): string {
  return text.replace(/\|/gu, '\\|');
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}

main();

export {};
