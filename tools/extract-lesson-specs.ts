const fs: any = require('fs');
const path: any = require('path');
const nodeCrypto: any = require('crypto');

interface LessonExample {
  readonly id: string;
  readonly section: string;
  readonly lessonPath: string;
  readonly lessonTitle: string;
  readonly blockIndex: number;
  readonly sourceLine: number;
  readonly codeFile: string;
  readonly sha256: string;
  readonly form: 'program' | 'module' | 'snippet';
  readonly expectation: 'reject' | 'unspecified';
  readonly tags: readonly string[];
  readonly reasons: readonly string[];
}

interface LessonManifest {
  readonly version: 1;
  readonly sourceRoot: string;
  readonly normalization: string;
  readonly totalExamples: number;
  readonly contentSha256: string;
  readonly examples: readonly LessonExample[];
}

const DEFAULT_SOURCE_ROOT = path.resolve(process.cwd(), 'packages/docs/lessons');
const DEFAULT_OUTPUT_ROOT = path.resolve(process.cwd(), 'spec/lessons');

function main(): void {
  const sourceRoot = path.resolve(readArg('--source') ?? DEFAULT_SOURCE_ROOT);
  const outputRoot = path.resolve(readArg('--out') ?? DEFAULT_OUTPUT_ROOT);
  const examplesRoot = path.join(outputRoot, 'examples');

  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`lesson source root does not exist: ${sourceRoot}`);
  }

  fs.mkdirSync(examplesRoot, { recursive: true });

  const htmlFiles = listHtmlFiles(sourceRoot);
  const examples: LessonExample[] = [];

  for (const htmlFile of htmlFiles) {
    const html = fs.readFileSync(htmlFile, 'utf8').replace(/\r\n/g, '\n');
    const lessonPath = normalizePath(path.relative(sourceRoot, htmlFile));
    const lessonTitle = extractTitle(html);
    const section = lessonPath.includes('/') ? lessonPath.split('/')[0] : 'root';
    const lessonSlug = lessonPath.replace(/\.html$/u, '');
    const matches = extractCodeBlocks(html);

    matches.forEach((block, index) => {
      const blockIndex = index + 1;
      const id = `${lessonSlug.replace(/\//gu, '.')}.${String(blockIndex).padStart(3, '0')}`;
      const codeFile = normalizePath(path.join('examples', lessonSlug, `${String(blockIndex).padStart(3, '0')}.idyl`));
      const absoluteCodeFile = path.join(outputRoot, codeFile);
      const classification = classify(block.code);

      fs.mkdirSync(path.dirname(absoluteCodeFile), { recursive: true });
      fs.writeFileSync(absoluteCodeFile, block.code, 'utf8');

      examples.push({
        id,
        section,
        lessonPath,
        lessonTitle,
        blockIndex,
        sourceLine: block.sourceLine,
        codeFile,
        sha256: sha256(block.code),
        form: classification.form,
        expectation: classification.expectation,
        tags: classification.tags,
        reasons: classification.reasons,
      });
    });
  }

  examples.sort((left, right) => left.id.localeCompare(right.id));

  const manifest: LessonManifest = {
    version: 1,
    sourceRoot,
    normalization: "IdylCodeBlock visible code: raw.replace(/^\\n/, '').replace(/\\n\\s*$/, '') with LF line endings",
    totalExamples: examples.length,
    contentSha256: sha256(examples.map((example) => `${example.id}:${example.sha256}`).join('\n')),
    examples,
  };

  fs.writeFileSync(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputRoot, 'README.md'), lessonSpecReadme(manifest), 'utf8');

  const bySection = countBy(examples, (example) => example.section);
  console.log(`extracted ${examples.length} lesson examples`);
  for (const section of Object.keys(bySection).sort()) {
    console.log(`  ${section}: ${bySection[section]}`);
  }
  console.log(`manifest: ${path.join(outputRoot, 'manifest.json')}`);
}

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
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

function extractTitle(html: string): string {
  const h1 = /<h1>([\s\S]*?)<\/h1>/iu.exec(html);
  if (h1) return stripTags(h1[1]).trim();

  const title = /<title>([\s\S]*?)<\/title>/iu.exec(html);
  if (title) return stripTags(title[1]).trim();

  return 'Untitled lesson';
}

function extractCodeBlocks(html: string): Array<{ code: string; sourceLine: number }> {
  const blocks: Array<{ code: string; sourceLine: number }> = [];
  const regex = /<idyl-code-block>\s*<script\s+type="text\/plain">([\s\S]*?)<\/script>\s*<\/idyl-code-block>/giu;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].replace(/\r\n/g, '\n');
    const code = raw.replace(/^\n/u, '').replace(/\n\s*$/u, '');
    blocks.push({
      code,
      sourceLine: countNewlines(html.slice(0, match.index)) + 1,
    });
  }

  return blocks;
}

function classify(code: string): Omit<LessonExample, 'id' | 'section' | 'lessonPath' | 'lessonTitle' | 'blockIndex' | 'sourceLine' | 'codeFile' | 'sha256'> {
  const tags = new Set<string>();
  const reasons: string[] = [];

  if (/\bmain\s*\(/u.test(code)) tags.add('entry:main');
  if (/\buse\s+console\s*;/u.test(code)) tags.add('module:console');
  if (/\buse\s+gui\s*;/u.test(code)) tags.add('module:gui');
  if (/\buse\s+math\s*;/u.test(code)) tags.add('module:math');
  if (/\buse\s+random\s*;/u.test(code)) tags.add('module:random');
  if (/\buse\s+time\s*;/u.test(code)) tags.add('module:time');
  if (/\buse\s+file\s*;/u.test(code)) tags.add('module:file');
  if (/\buse\s+types\s*;/u.test(code)) tags.add('module:types');
  if (/\buse\s+encoding\s*;/u.test(code)) tags.add('module:encoding');
  if (/\bclass\s+[A-Za-z_]/u.test(code)) tags.add('feature:class');
  if (/\bconstructor\s*\(/u.test(code)) tags.add('feature:constructor');
  if (/\bdestructor\s*\(/u.test(code)) tags.add('feature:destructor');
  if (/\bfunction\b/u.test(code)) tags.add('feature:function');
  if (/\bfor\s*\(/u.test(code)) tags.add('feature:for');
  if (/\bwhile\s*\(/u.test(code)) tags.add('feature:while');
  if (/\bif\s*\(/u.test(code)) tags.add('feature:if');
  if (/\barray\s*</u.test(code)) tags.add('feature:array');
  if (/\bdyn_array\s*</u.test(code)) tags.add('feature:dyn_array');
  if (/\btry\b|\bcatch\b/u.test(code)) tags.add('feature:errors');
  if (/gui\./u.test(code)) tags.add('feature:gui');

  const form = /\bmain\s*\(/u.test(code)
    ? 'program'
    : /\b(function|class)\b/u.test(code)
      ? 'module'
      : 'snippet';

  const expectation = /(ОШИБК|Ошибка|ошибка|нельзя|не скомпилируется|error)/iu.test(code)
    ? 'reject'
    : 'unspecified';

  if (expectation === 'reject') reasons.push('code contains an explicit teaching error marker');
  if (form === 'snippet') reasons.push('code block is not a complete standalone program');
  if (form === 'module') reasons.push('code block declares reusable entities and may need another file to run');

  return {
    form,
    expectation,
    tags: [...tags].sort(),
    reasons,
  };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/gu, '');
}

function countNewlines(text: string): number {
  return (text.match(/\n/gu) ?? []).length;
}

function sha256(text: string): string {
  return nodeCrypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}

function countBy<T>(items: readonly T[], keyFn: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function lessonSpecReadme(manifest: LessonManifest): string {
  return `# Frozen Lesson Spec

This directory is generated from the original Idyllium lessons:

\`\`\`text
${manifest.sourceRoot}
\`\`\`

It contains ${manifest.totalExamples} code examples extracted from \`<idyl-code-block>\` elements.

The extractor uses the same visible-code normalization as the old docs web component:

\`\`\`text
${manifest.normalization}
\`\`\`

Do not manually edit generated examples that are listed in \`manifest.json\`.
Update the source lessons or rerun:

\`\`\`text
npm run spec:extract
\`\`\`

Manual draft lessons may live next to the generated tree only when they have a local
README and an explicit test. They are not part of the frozen legacy manifest until
they are promoted into the real documentation source.
`;
}

main();

export {};
