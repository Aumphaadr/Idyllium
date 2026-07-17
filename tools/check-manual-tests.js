const fs = require('fs');
const path = require('path');
const { compileProject } = require('../dist/src');

const repoRoot = path.resolve(__dirname, '..');
const suiteRoot = path.join(repoRoot, 'spec', 'some_tests');
const manifest = JSON.parse(fs.readFileSync(path.join(suiteRoot, 'manifest.json'), 'utf8'));

let passed = 0;
const failures = [];
const categoryCounts = new Map();

for (const entry of manifest.entries) {
  const projectRoot = path.join(suiteRoot, entry.projectRoot);
  const files = {};
  for (const sourceFile of entry.sourceFiles) {
    files[sourceFile] = fs.readFileSync(path.join(projectRoot, sourceFile), 'utf8');
  }

  const entryFile = path.relative(entry.projectRoot, entry.entry).split(path.sep).join('/');
  const result = compileProject({ entryFile, files });
  if (result.success) {
    passed += 1;
    categoryCounts.set(entry.category, (categoryCounts.get(entry.category) ?? 0) + 1);
  } else {
    failures.push({ entry, diagnostics: result.diagnosticsText });
  }
}

for (const [category, count] of categoryCounts) {
  console.log(`${category}: ${count} compiled`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} manual test entries failed to compile:\n`);
  for (const failure of failures) {
    console.error(`[${failure.entry.id}] ${failure.entry.entry}`);
    console.error(failure.diagnostics);
    console.error('');
  }
  process.exitCode = 1;
} else {
  console.log(`\nmanual test suite: ${passed}/${manifest.total} entry points compile`);
}
