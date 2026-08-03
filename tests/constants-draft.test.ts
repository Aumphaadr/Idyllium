import { compileIdyllium, compileProject, runIdyllium } from '../src';

const fs: any = require('fs');
const path: any = require('path');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const root = process.cwd();
  const specRoot = path.join(root, 'spec/some_constants');
  const bindingsFile = path.join(specRoot, '01_bindings.idyl');
  const bindingsSource = fs.readFileSync(bindingsFile, 'utf8');
  const bindings = await runIdyllium(bindingsSource, {}, { file: bindingsFile });

  assert(bindings.compilation.success, bindings.compilation.diagnosticsText);
  assert(bindings.success, bindings.runtimeError ?? 'bindings example failed');
  assert(
    bindings.output === 'Лимит: 100\nОчки: [10, 25, 30]\nСчётчик: 5\n',
    `unexpected bindings output: ${JSON.stringify(bindings.output)}`,
  );

  const moduleRoot = path.join(specRoot, '02_module_constants');
  const mainSource = fs.readFileSync(path.join(moduleRoot, 'main.idyl'), 'utf8');
  const settingsSource = fs.readFileSync(path.join(moduleRoot, 'settings.idyl'), 'utf8');
  const files = {
    'main.idyl': mainSource,
    'settings.idyl': settingsSource,
  };
  const project = compileProject({ entryFile: 'main.idyl', files });
  assert(project.success, `module constants project did not compile:\n${project.diagnosticsText}`);

  const moduleResult = await runIdyllium(mainSource, {}, {
    file: 'main.idyl',
    sources: { 'settings.idyl': settingsSource },
  });
  assert(moduleResult.compilation.success, moduleResult.compilation.diagnosticsText);
  assert(moduleResult.success, moduleResult.runtimeError ?? 'module constants example failed');
  assert(
    moduleResult.output === 'Игра: Космический курьер\nМаксимальный уровень: 12\nОбучение включено: true\n',
    `unexpected module constants output: ${JSON.stringify(moduleResult.output)}`,
  );

  const reassignment = compileIdyllium(
    mainSource.replace('// settings.MAX_LEVEL = 20;', 'settings.MAX_LEVEL = 20;'),
    { file: 'main.idyl', sources: { 'settings.idyl': settingsSource } },
  );
  assert(!reassignment.success, 'expected imported constant reassignment to fail');
  assert(
    reassignment.diagnosticsText.includes("cannot assign to constant 'settings.MAX_LEVEL'"),
    `unexpected imported constant diagnostic:\n${reassignment.diagnosticsText}`,
  );

  console.log('constants draft spec: bindings and module constants manual tests pass');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
