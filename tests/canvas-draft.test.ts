import { compileIdyllium, compileProject } from '../src';

const fs: any = require('fs');
const path: any = require('path');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertCompiles(file: string): void {
  const source = fs.readFileSync(file, 'utf8');
  const result = compileIdyllium(source, { file });
  assert(result.success, `expected ${file} to compile, got:\n${result.diagnosticsText}`);
}

function collectIdylliumFiles(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.idyl')) continue;
    files[entry.name] = fs.readFileSync(path.join(dir, entry.name), 'utf8');
  }
  return files;
}

function assertProjectCompiles(dir: string): number {
  const files = collectIdylliumFiles(dir);
  assert(Object.keys(files).length > 0, `expected Idyllium files in ${dir}`);
  assert(files['main.idyl'] !== undefined, `expected project ${dir} to contain main.idyl`);

  const result = compileProject({ entryFile: 'main.idyl', files });
  assert(result.success, `expected project ${dir} to compile, got:\n${result.diagnosticsText}`);
  return Object.keys(files).length;
}

function assertCanvasLessonExamples(root: string): { readonly programs: number; readonly projects: number; readonly files: number } {
  let programs = 0;
  let projects = 0;
  let files = 0;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const lessonDir = path.join(root, entry.name);
    const mainFile = path.join(lessonDir, 'main.idyl');

    if (fs.existsSync(mainFile)) {
      files += assertProjectCompiles(lessonDir);
      projects += 1;
      continue;
    }

    for (const fileEntry of fs.readdirSync(lessonDir, { withFileTypes: true })) {
      if (!fileEntry.isFile() || !fileEntry.name.endsWith('.idyl')) continue;
      assertCompiles(path.join(lessonDir, fileEntry.name));
      programs += 1;
      files += 1;
    }
  }

  return { programs, projects, files };
}

function main(): void {
  const root = process.cwd();
  const canvasSpecRoot = path.join(root, 'spec/some_canvas_game');
  const canvasLessonsRoot = path.join(root, 'spec/lessons/examples/canvas');

  let projects = 1;
  let files = assertProjectCompiles(canvasSpecRoot);
  let programs = 0;

  if (fs.existsSync(canvasLessonsRoot)) {
    const lessonResult = assertCanvasLessonExamples(canvasLessonsRoot);
    programs += lessonResult.programs;
    projects += lessonResult.projects;
    files += lessonResult.files;
  }

  console.log(`canvas draft spec: ${programs} standalone programs, ${projects} projects, ${files} files compile`);
}

main();
