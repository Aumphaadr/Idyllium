import {
  CompileResult,
  compileIdyllium,
} from './runtime/run';
import { formatIdyllium } from './language/formatter';
import { IdylliumProject } from './language/project';
import {
  ConsoleIO,
  IdylliumAudioSnapshot,
  IdylliumCanvasSnapshot,
  IdylliumModalSnapshot,
  IdylliumRuntime,
  IdylliumWindowSnapshot,
  MemoryRuntimeFile,
  RuntimeFileSystem,
  createRuntime,
  createMemoryRuntimeFileSystem,
} from './runtime/runtime';

export type BrowserIdylliumFile = string | MemoryRuntimeFile;

export interface BrowserRunOptions {
  readonly entryFile?: string;
  readonly files: Readonly<Record<string, BrowserIdylliumFile>>;
  readonly input?: readonly string[];
  readonly console?: Partial<ConsoleIO>;
  readonly abortSignal?: import('./runtime/runtime').RuntimeAbortSignal;
}

export interface BrowserRunResult {
  readonly success: boolean;
  readonly output: string;
  readonly runtimeError: string | null;
  readonly compilation: CompileResult;
  readonly runtime: IdylliumRuntime | null;
  readonly files: Readonly<Record<string, BrowserIdylliumFile>>;
  readonly writtenFiles: Readonly<Record<string, BrowserIdylliumFile>>;
  readonly audio: readonly IdylliumAudioSnapshot[];
  readonly windows: readonly IdylliumWindowSnapshot[];
  readonly canvases: readonly IdylliumCanvasSnapshot[];
  readonly modals: readonly IdylliumModalSnapshot[];
}

export interface BrowserPreparedProgram {
  readonly compilation: CompileResult;
  readonly runtime: IdylliumRuntime | null;
  fileSystemSnapshot(): Readonly<Record<string, BrowserIdylliumFile>>;
  writtenFilesSnapshot(): Readonly<Record<string, BrowserIdylliumFile>>;
  run(): Promise<void>;
}

export async function runIdylliumInBrowser(options: BrowserRunOptions): Promise<BrowserRunResult> {
  const prepared = await prepareIdylliumBrowserProgram(options);
  if (!prepared.compilation.success || !prepared.runtime) {
    return {
      success: false,
      output: '',
      runtimeError: null,
      compilation: prepared.compilation,
      runtime: null,
      files: prepared.fileSystemSnapshot(),
      writtenFiles: prepared.writtenFilesSnapshot(),
      audio: [],
      windows: [],
      canvases: [],
      modals: [],
    };
  }

  try {
    await prepared.run();
    return browserRunSuccess(
      prepared.runtime,
      prepared.compilation,
      prepared.fileSystemSnapshot(),
      prepared.writtenFilesSnapshot(),
    );
  } catch (error) {
    return {
      success: false,
      output: prepared.runtime.getOutput(),
      runtimeError: error instanceof Error ? error.message : String(error),
      compilation: prepared.compilation,
      runtime: prepared.runtime,
      files: prepared.fileSystemSnapshot(),
      writtenFiles: prepared.writtenFilesSnapshot(),
      audio: prepared.runtime.getAudio(),
      windows: prepared.runtime.getWindows(),
      canvases: prepared.runtime.getCanvases(),
      modals: prepared.runtime.getModals(),
    };
  }
}

export async function prepareIdylliumBrowserProgram(options: BrowserRunOptions): Promise<BrowserPreparedProgram> {
  const files = normalizeBrowserFiles(options.files);
  const entryFile = normalizeBrowserPath(options.entryFile ?? '/workspace/main.idyl');
  const source = browserFileText(files[entryFile]);
  const fileSystem = createMemoryRuntimeFileSystem(files);
  const fileSystemSnapshot = () => fileSystem.snapshot?.() ?? files;
  const writtenFilesSnapshot = () => fileSystem.writtenFilesSnapshot?.() ?? {};
  const compilation = compileIdyllium(source, {
    file: entryFile,
    sources: browserSources(files),
    resolveModule(moduleName, fromFile) {
      const candidate = resolveBrowserModule(moduleName, fromFile, files);
      return candidate ? { file: candidate, source: browserFileText(files[candidate]) } : null;
    },
  });

  if (!compilation.success || !compilation.jsCode) {
    return {
      compilation,
      runtime: null,
      fileSystemSnapshot,
      writtenFilesSnapshot,
      async run() {
        // The compilation result already contains the diagnostics.
      },
    };
  }

  const runtime = createMemoryRuntime(options, fileSystem);
  const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
  const factory = new AsyncFunction(compilation.jsCode);
  const program = await factory();

  return {
    compilation,
    runtime,
    fileSystemSnapshot,
    writtenFilesSnapshot,
    async run() {
      await program(runtime);
    },
  };
}

export {
  compileIdyllium,
  formatIdyllium,
  IdylliumProject,
};

function createMemoryRuntime(options: BrowserRunOptions, fileSystem: RuntimeFileSystem): IdylliumRuntime {
  return createRuntime({
    console: options.console,
    input: options.input,
    fileSystem,
  });
}

function browserRunSuccess(
  runtime: IdylliumRuntime,
  compilation: CompileResult,
  files: Readonly<Record<string, BrowserIdylliumFile>>,
  writtenFiles: Readonly<Record<string, BrowserIdylliumFile>>,
): BrowserRunResult {
  return {
    success: true,
    output: runtime.getOutput(),
    runtimeError: null,
    compilation,
    runtime,
    files,
    writtenFiles,
    audio: runtime.getAudio(),
    windows: runtime.getWindows(),
    canvases: runtime.getCanvases(),
    modals: runtime.getModals(),
  };
}

function normalizeBrowserFiles(files: Readonly<Record<string, BrowserIdylliumFile>>): Record<string, BrowserIdylliumFile> {
  const normalized: Record<string, BrowserIdylliumFile> = {};
  for (const [file, source] of Object.entries(files)) {
    normalized[normalizeBrowserPath(file)] = source;
  }
  return normalized;
}

function browserSources(files: Readonly<Record<string, BrowserIdylliumFile>>): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const [file, source] of Object.entries(files)) {
    if (file.endsWith('.idyl')) sources[file] = browserFileText(source);
  }
  return sources;
}

function browserFileText(file: BrowserIdylliumFile | undefined): string {
  if (typeof file === 'string') return file;
  return file?.content ?? '';
}

function resolveBrowserModule(
  moduleName: string,
  fromFile: string,
  files: Readonly<Record<string, BrowserIdylliumFile>>,
): string | null {
  const candidates = [
    normalizeBrowserPath(moduleName),
    normalizeBrowserPath(`${moduleName}.idyl`),
    normalizeBrowserPath(`${browserDirname(fromFile)}/${moduleName}.idyl`),
  ];
  return candidates.find((candidate) => Object.prototype.hasOwnProperty.call(files, candidate)) ?? null;
}

function normalizeBrowserPath(value: string, base = '/workspace'): string {
  const raw = value.replace(/\\/gu, '/');
  const parts = (raw.startsWith('/') ? raw : `${base}/${raw}`).split('/');
  const normalized: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  return `/${normalized.join('/')}`;
}

function browserDirname(filePath: string): string {
  const normalized = normalizeBrowserPath(filePath);
  if (normalized === '/') return '/';
  const index = normalized.lastIndexOf('/');
  if (index <= 0) return '/';
  return normalized.slice(0, index);
}
