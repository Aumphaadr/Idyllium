// ─── Файловые системы рантайма: настоящая (Node) и виртуальная (память) ────
// Вынесено из runtime.ts при декомпозиции (этап Б, 2026-08-29); как было.
import { IdylliumRuntimeError } from './runtime-errors';
import { errorMessage, memoryDirname, normalizeMemoryPath, runtimeDirname } from './runtime-shared';
import { MemoryRuntimeFile, RuntimeFileSystem } from './runtime-state';

const nodeFs: any = require('fs');
const nodePath: any = require('path');
const nodeBuffer: any = require('buffer').Buffer;

export function createMemoryRuntimeFileSystem(
  entries: Readonly<Record<string, string | MemoryRuntimeFile>> = {},
  cwd = '/workspace',
): RuntimeFileSystem {
  const files = new Map<string, { content: string; bytes?: Uint8Array; resourceUri: string | null }>();
  const directories = new Set<string>();
  const touchedPaths = new Set<string>();
  const normalizedCwd = normalizeMemoryPath(cwd);
  addMemoryDirectory(directories, '/');
  addMemoryDirectory(directories, normalizedCwd);

  for (const [rawPath, rawEntry] of Object.entries(entries)) {
    const filePath = normalizeMemoryPath(rawPath, normalizedCwd);
    if (typeof rawEntry !== 'string' && rawEntry.kind === 'directory') {
      addMemoryDirectory(directories, filePath);
      continue;
    }

    addMemoryDirectory(directories, memoryDirname(filePath));
    files.set(filePath, {
      content: typeof rawEntry === 'string' ? rawEntry : rawEntry.content ?? '',
      bytes: typeof rawEntry === 'string' || !rawEntry.bytes ? undefined : new Uint8Array(rawEntry.bytes),
      resourceUri: typeof rawEntry === 'string' ? null : rawEntry.resourceUri ?? null,
    });
  }

  return {
    resolvePath(requestedPath: string, sourceFile: string): string {
      const sourceDirectory = sourceFile.trim() === '' ? normalizedCwd : memoryDirname(normalizeMemoryPath(sourceFile, normalizedCwd));
      return normalizeMemoryPath(requestedPath, sourceDirectory);
    },
    humanizePaths(text: string): string {
      const prefix = normalizedCwd.endsWith('/') ? normalizedCwd : `${normalizedCwd}/`;
      return text.split(prefix).join('').split(normalizedCwd).join('.');
    },
    exists(filePath: string): boolean {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      return files.has(normalized) || directories.has(normalized);
    },
    isFile(filePath: string): boolean {
      return files.has(normalizeMemoryPath(filePath, normalizedCwd));
    },
    isDirectory(filePath: string): boolean {
      return directories.has(normalizeMemoryPath(filePath, normalizedCwd));
    },
    readText(filePath: string): string {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      const file = files.get(normalized);
      if (!file) throw new Error(`file does not exist: ${normalized}`);
      return file.content;
    },
    writeText(filePath: string, text: string): void {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      assertMemoryProjectPath(normalized, normalizedCwd, 'file write');
      const parent = memoryDirname(normalized);
      if (!directories.has(parent)) throw new Error(`directory does not exist: ${parent}`);
      if (directories.has(normalized)) throw new Error(`path is a directory: ${normalized}`);
      files.set(normalized, { content: text, resourceUri: null });
      touchedPaths.add(normalized);
    },
    appendText(filePath: string, text: string): void {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      assertMemoryProjectPath(normalized, normalizedCwd, 'file write');
      const file = files.get(normalized);
      if (!file) throw new Error(`file does not exist: ${normalized}`);
      files.set(normalized, { content: file.content + text, resourceUri: null });
      touchedPaths.add(normalized);
    },
    createDirectory(filePath: string, parents: boolean): void {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      assertMemoryProjectPath(normalized, normalizedCwd, 'file.create_directory()');
      if (files.has(normalized) || directories.has(normalized)) {
        throw new Error(`path already exists: ${normalized}`);
      }

      if (!parents) {
        const parent = memoryDirname(normalized);
        if (!directories.has(parent)) throw new Error(`directory does not exist: ${parent}`);
        directories.add(normalized);
        touchedPaths.add(normalized);
        return;
      }

      const missing: string[] = [];
      let current = normalized;
      while (!directories.has(current)) {
        assertMemoryProjectPath(current, normalizedCwd, 'file.create_directory()');
        if (files.has(current)) throw new Error(`path is a file: ${current}`);
        missing.push(current);
        const parent = memoryDirname(current);
        if (parent === current) break;
        current = parent;
      }
      for (const directory of missing.reverse()) {
        directories.add(directory);
        touchedPaths.add(directory);
      }
    },
    listDirectory(filePath: string): readonly string[] {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      if (!directories.has(normalized)) {
        if (files.has(normalized)) throw new Error(`path is not a directory: ${normalized}`);
        throw new Error(`directory does not exist: ${normalized}`);
      }
      const names = new Set<string>();
      for (const directory of directories) {
        if (directory !== normalized && memoryDirname(directory) === normalized) {
          names.add(memoryBasename(directory));
        }
      }
      for (const file of files.keys()) {
        if (memoryDirname(file) === normalized) names.add(memoryBasename(file));
      }
      return [...names].sort((left, right) => left.localeCompare(right));
    },
    copy(sourcePath: string, destinationPath: string): void {
      const source = normalizeMemoryPath(sourcePath, normalizedCwd);
      const destination = normalizeMemoryPath(destinationPath, normalizedCwd);
      assertMemoryProjectPath(source, normalizedCwd, 'file.copy()');
      assertMemoryProjectPath(destination, normalizedCwd, 'file.copy()');
      assertMemoryMovableSource(source, normalizedCwd, 'file.copy()');
      assertMemoryDestinationAvailable(files, directories, destination);
      assertMemoryDestinationParent(directories, destination);

      const sourceFile = files.get(source);
      if (sourceFile) {
        files.set(destination, cloneMemoryFile(sourceFile));
        touchedPaths.add(destination);
        return;
      }
      if (!directories.has(source)) throw new Error(`path does not exist: ${source}`);
      if (destination.startsWith(`${source}/`)) {
        throw new Error('cannot copy a directory inside itself');
      }

      const prefix = `${source}/`;
      const copiedDirectories = [...directories]
        .filter((directory) => directory === source || directory.startsWith(prefix))
        .sort((left, right) => left.length - right.length);
      const copiedFiles = [...files.entries()].filter(([file]) => file.startsWith(prefix));
      for (const directory of copiedDirectories) {
        const target = `${destination}${directory.slice(source.length)}`;
        directories.add(target);
        touchedPaths.add(target);
      }
      for (const [file, value] of copiedFiles) {
        const target = `${destination}${file.slice(source.length)}`;
        files.set(target, cloneMemoryFile(value));
        touchedPaths.add(target);
      }
    },
    rename(sourcePath: string, destinationPath: string): void {
      const source = normalizeMemoryPath(sourcePath, normalizedCwd);
      const destination = normalizeMemoryPath(destinationPath, normalizedCwd);
      assertMemoryProjectPath(source, normalizedCwd, 'file.rename()');
      assertMemoryProjectPath(destination, normalizedCwd, 'file.rename()');
      assertMemoryMovableSource(source, normalizedCwd, 'file.rename()');
      assertMemoryDestinationAvailable(files, directories, destination);
      assertMemoryDestinationParent(directories, destination);

      const sourceFile = files.get(source);
      if (sourceFile) {
        files.delete(source);
        files.set(destination, sourceFile);
        touchedPaths.add(source);
        touchedPaths.add(destination);
        return;
      }
      if (!directories.has(source)) throw new Error(`path does not exist: ${source}`);
      if (destination.startsWith(`${source}/`)) {
        throw new Error('cannot move a directory inside itself');
      }

      const prefix = `${source}/`;
      const movedDirectories = [...directories]
        .filter((directory) => directory === source || directory.startsWith(prefix));
      const movedFiles = [...files.entries()].filter(([file]) => file.startsWith(prefix));
      for (const [file] of movedFiles) {
        files.delete(file);
        touchedPaths.add(file);
      }
      for (const directory of movedDirectories) {
        directories.delete(directory);
        touchedPaths.add(directory);
      }
      for (const directory of movedDirectories.sort((left, right) => left.length - right.length)) {
        const target = `${destination}${directory.slice(source.length)}`;
        directories.add(target);
        touchedPaths.add(target);
      }
      for (const [file, value] of movedFiles) {
        const target = `${destination}${file.slice(source.length)}`;
        files.set(target, value);
        touchedPaths.add(target);
      }
    },
    remove(filePath: string, recursive: boolean): void {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      assertMemoryProjectPath(normalized, normalizedCwd, 'file.remove()');
      assertMemoryMovableSource(normalized, normalizedCwd, 'file.remove()');
      if (files.delete(normalized)) {
        touchedPaths.add(normalized);
        return;
      }
      if (!directories.has(normalized)) throw new Error(`path does not exist: ${normalized}`);

      const prefix = `${normalized}/`;
      const childFiles = [...files.keys()].filter((file) => file.startsWith(prefix));
      const childDirectories = [...directories].filter((directory) => directory.startsWith(prefix));
      if (!recursive && (childFiles.length > 0 || childDirectories.length > 0)) {
        throw new Error(`directory is not empty: ${normalized}`);
      }
      for (const file of childFiles) {
        files.delete(file);
        touchedPaths.add(file);
      }
      for (const directory of childDirectories.sort((left, right) => right.length - left.length)) {
        directories.delete(directory);
        touchedPaths.add(directory);
      }
      directories.delete(normalized);
      touchedPaths.add(normalized);
    },
    readBytes(filePath: string): Uint8Array {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      const file = files.get(normalized);
      if (!file) throw new Error(`file does not exist: ${normalized}`);
      if (file.bytes) return new Uint8Array(file.bytes);
      return new TextEncoder().encode(file.content);
    },
    writeBytes(filePath: string, bytes: Uint8Array, resourceUri?: string): void {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      assertMemoryProjectPath(normalized, normalizedCwd, 'binary file write');
      const parent = memoryDirname(normalized);
      if (!directories.has(parent)) throw new Error(`directory does not exist: ${parent}`);
      if (directories.has(normalized)) throw new Error(`path is a directory: ${normalized}`);
      files.set(normalized, {
        content: '',
        bytes: new Uint8Array(bytes),
        resourceUri: resourceUri ?? null,
      });
      touchedPaths.add(normalized);
    },
    resourceUri(filePath: string): string | null {
      return files.get(normalizeMemoryPath(filePath, normalizedCwd))?.resourceUri ?? null;
    },
    snapshot(): Record<string, MemoryRuntimeFile> {
      const result: Record<string, MemoryRuntimeFile> = {};
      for (const directory of [...directories].sort()) {
        result[directory] = { kind: 'directory' };
      }
      for (const [filePath, file] of [...files.entries()].sort(([left], [right]) => left.localeCompare(right))) {
        result[filePath] = {
          kind: 'file',
          content: file.content,
          bytes: file.bytes ? new Uint8Array(file.bytes) : undefined,
          resourceUri: file.resourceUri ?? undefined,
        };
      }
      return result;
    },
    writtenFilesSnapshot(): Record<string, MemoryRuntimeFile> {
      const result: Record<string, MemoryRuntimeFile> = {};
      for (const filePath of [...touchedPaths].sort()) {
        const file = files.get(filePath);
        if (file) {
          result[filePath] = {
            kind: 'file',
            content: file.content,
            bytes: file.bytes ? new Uint8Array(file.bytes) : undefined,
            resourceUri: file.resourceUri ?? undefined,
          };
        } else if (directories.has(filePath)) {
          result[filePath] = { kind: 'directory' };
        } else {
          result[filePath] = { kind: 'deleted' };
        }
      }
      return result;
    },
  };
}

export function resolveRuntimePath(requestedPath: string, sourceFile: string): string {
  if (nodePath.isAbsolute(requestedPath)) return nodePath.normalize(requestedPath);
  const base = sourceFile.trim() === '' ? process.cwd() : nodePath.dirname(sourceFile);
  return nodePath.resolve(base, requestedPath);
}

export function createNodeRuntimeFileSystem(projectRoot?: string): RuntimeFileSystem {
  let mutationRoot = projectRoot ? nodePath.resolve(projectRoot) : null;
  const readPath = (filePath: string, operation: string): string => (
    assertNodeProjectPath(mutationRoot ?? process.cwd(), filePath, operation), filePath
  );
  const mutationPath = (filePath: string, operation: string): string => (
    assertNodeProjectPath(mutationRoot ?? process.cwd(), filePath, operation)
  );
  return {
    humanizePaths(text: string): string {
      const root = mutationRoot ?? process.cwd();
      return text.split(`${root}${nodePath.sep}`).join('').split(root).join('.');
    },
    resolvePath(requestedPath: string, sourceFile: string): string {
      if (!mutationRoot) {
        mutationRoot = sourceFile.trim() !== '' && nodePath.isAbsolute(sourceFile)
          ? nodePath.dirname(nodePath.normalize(sourceFile))
          : process.cwd();
      }
      return resolveRuntimePath(requestedPath, sourceFile);
    },
    // Песочница двусторонняя: страж стоит и на чтении, а не только на
    // изменяющих операциях — задачник обещает «наружу не выберешься»,
    // а до 2026-08-22 file.open("../x", "read") честно читал родителя
    // (находка методистов E12).
    exists(filePath: string): boolean {
      return nodeFs.existsSync(readPath(filePath, 'file access'));
    },
    isFile(filePath: string): boolean {
      return nodeFs.statSync(readPath(filePath, 'file access')).isFile();
    },
    isDirectory(filePath: string): boolean {
      return nodeFs.statSync(readPath(filePath, 'file access')).isDirectory();
    },
    readText(filePath: string): string {
      return nodeFs.readFileSync(readPath(filePath, 'file read'), 'utf8');
    },
    writeText(filePath: string, text: string): void {
      const target = mutationPath(filePath, 'file write');
      assertNodeWritableTarget(target);
      nodeFs.writeFileSync(target, text, 'utf8');
    },
    appendText(filePath: string, text: string): void {
      const target = mutationPath(filePath, 'file write');
      assertNodeWritableTarget(target);
      nodeFs.appendFileSync(target, text, 'utf8');
    },
    createDirectory(filePath: string, parents: boolean): void {
      const target = mutationPath(filePath, 'file.create_directory()');
      if (nodeFs.existsSync(target)) throw new Error(`path already exists: ${target}`);
      // предпроверки повторяют встроенную ФС веб-IDE — тексты канона едины,
      // сырые ENOENT/ENOTDIR из mkdirSync до учеников не доезжают
      if (!parents) {
        const parent = nodePath.dirname(target);
        if (!nodeFs.existsSync(parent) || !nodeFs.statSync(parent).isDirectory()) {
          throw new Error(`directory does not exist: ${parent}`);
        }
      } else {
        let current = target;
        while (!nodeFs.existsSync(current)) {
          const parent = nodePath.dirname(current);
          if (parent === current) break;
          current = parent;
        }
        if (nodeFs.existsSync(current) && !nodeFs.statSync(current).isDirectory()) {
          throw new Error(`path is a file: ${current}`);
        }
      }
      nodeFs.mkdirSync(target, { recursive: parents });
    },
    listDirectory(filePath: string): readonly string[] {
      readPath(filePath, 'file.list_directory()');
      if (!nodeFs.existsSync(filePath)) throw new Error(`directory does not exist: ${filePath}`);
      if (!nodeFs.statSync(filePath).isDirectory()) throw new Error(`path is not a directory: ${filePath}`);
      return nodeFs.readdirSync(filePath).sort((left: string, right: string) => left.localeCompare(right));
    },
    copy(sourcePath: string, destinationPath: string): void {
      const root = mutationRoot ?? process.cwd();
      const source = mutationPath(sourcePath, 'file.copy()');
      const destination = mutationPath(destinationPath, 'file.copy()');
      assertNodeMovableSource(root, source, 'file.copy()');
      assertNodeDestination(destination);
      assertNodeTreeHasNoSymlinks(source, 'file.copy()');
      if (nodeFs.statSync(source).isDirectory() && isNodePathWithin(source, destination)) {
        throw new Error('cannot copy a directory inside itself');
      }
      copyNodeEntry(source, destination);
    },
    rename(sourcePath: string, destinationPath: string): void {
      const root = mutationRoot ?? process.cwd();
      const source = mutationPath(sourcePath, 'file.rename()');
      const destination = mutationPath(destinationPath, 'file.rename()');
      assertNodeMovableSource(root, source, 'file.rename()');
      assertNodeDestination(destination);
      assertNodeTreeHasNoSymlinks(source, 'file.rename()');
      if (nodeFs.statSync(source).isDirectory() && isNodePathWithin(source, destination)) {
        throw new Error('cannot move a directory inside itself');
      }
      nodeFs.renameSync(source, destination);
    },
    remove(filePath: string, recursive: boolean): void {
      const root = mutationRoot ?? process.cwd();
      const target = mutationPath(filePath, 'file.remove()');
      assertNodeMovableSource(root, target, 'file.remove()');
      assertNodeTreeHasNoSymlinks(target, 'file.remove()');
      const stat = nodeFs.statSync(target);
      if (stat.isDirectory()) {
        if (recursive) {
          nodeFs.rmSync(target, { recursive: true, force: false });
        } else {
          // текст канона встроенной ФС вместо сырого ENOTEMPTY из rmdirSync
          if (nodeFs.readdirSync(target).length > 0) throw new Error(`directory is not empty: ${target}`);
          nodeFs.rmdirSync(target);
        }
      } else if (stat.isFile()) {
        nodeFs.unlinkSync(target);
      } else {
        throw new Error(`unsupported file-system object: ${target}`);
      }
    },
    readBytes(filePath: string): Uint8Array {
      return new Uint8Array(nodeFs.readFileSync(filePath));
    },
    writeBytes(filePath: string, bytes: Uint8Array): void {
      const target = mutationPath(filePath, 'binary file write');
      assertNodeWritableTarget(target);
      nodeFs.writeFileSync(target, bytes);
    },
    resourceUri(filePath: string): string {
      return filePath;
    },
  };
}

export function runtimeIsFile(
  fileSystem: RuntimeFileSystem,
  filePath: string,
  sourceFile: string,
  line: number,
  mode: 'reading' | 'writing' | 'appending',
  displayPath: string = filePath,
): boolean {
  try {
    return fileSystem.isFile(filePath);
  } catch (error) {
    throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${displayPath}' for ${mode}: ${errorMessage(error)}`);
  }
}

export function runtimeIsDirectory(
  fileSystem: RuntimeFileSystem,
  filePath: string,
  sourceFile: string,
  line: number,
  mode: 'reading' | 'writing' | 'appending',
  displayPath: string = filePath,
): boolean {
  try {
    return fileSystem.isDirectory(filePath);
  } catch (error) {
    throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${displayPath}' for ${mode}: ${errorMessage(error)}`);
  }
}

export function memoryBasename(filePath: string): string {
  const normalized = normalizeMemoryPath(filePath);
  if (normalized === '/') return '/';
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function assertNodeWritableTarget(target: string): void {
  const humanize = (raw: string): string => {
    const root = process.cwd();
    const relative = nodePath.relative(root, raw);
    return relative && !relative.startsWith('..') ? relative : raw;
  };
  const parent = nodePath.dirname(target);
  if (!nodeFs.existsSync(parent) || !nodeFs.statSync(parent).isDirectory()) {
    throw new Error(`directory does not exist: ${humanize(parent)}`);
  }
  if (nodeFs.existsSync(target) && nodeFs.statSync(target).isDirectory()) {
    throw new Error(`path is a directory: ${humanize(target)}`);
  }
}

function assertMemoryProjectPath(filePath: string, root: string, operation: string): void {
  if (filePath === root || filePath.startsWith(`${root}/`)) return;
  throw new Error(`path is outside the project: ${filePath}`);
}

function assertMemoryMovableSource(filePath: string, root: string, operation: string): void {
  if (filePath === root) throw new Error(`${operation} cannot modify the project root`);
}

function assertMemoryDestinationAvailable(
  files: ReadonlyMap<string, unknown>,
  directories: ReadonlySet<string>,
  destination: string,
): void {
  if (files.has(destination) || directories.has(destination)) {
    throw new Error(`destination already exists: ${destination}`);
  }
}

function assertMemoryDestinationParent(directories: ReadonlySet<string>, destination: string): void {
  const parent = memoryDirname(destination);
  if (!directories.has(parent)) throw new Error(`directory does not exist: ${parent}`);
}

function cloneMemoryFile(
  file: { content: string; bytes?: Uint8Array; resourceUri: string | null },
): { content: string; bytes?: Uint8Array; resourceUri: string | null } {
  return {
    content: file.content,
    bytes: file.bytes ? new Uint8Array(file.bytes) : undefined,
    resourceUri: file.resourceUri,
  };
}

function assertNodeProjectPath(root: string, filePath: string, operation: string): string {
  const candidate = nodePath.resolve(filePath);
  if (!isNodePathWithin(root, candidate)) {
    throw new Error(`path is outside the project: ${candidate}`);
  }

  let existing = candidate;
  while (!nodeFs.existsSync(existing)) {
    const parent = nodePath.dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  const realRoot = nodeFs.realpathSync(root);
  const realExisting = nodeFs.realpathSync(existing);
  if (!isNodePathWithin(realRoot, realExisting)) {
    throw new Error(`${operation} path escapes the project through a symbolic link: ${candidate}`);
  }
  return candidate;
}

function isNodePathWithin(root: string, candidate: string): boolean {
  const relative = nodePath.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !nodePath.isAbsolute(relative));
}

function assertNodeMovableSource(root: string, source: string, operation: string): void {
  if (source === root) throw new Error(`${operation} cannot modify the project root`);
  if (!nodeFs.existsSync(source)) throw new Error(`path does not exist: ${source}`);
}

function assertNodeDestination(destination: string): void {
  if (nodeFs.existsSync(destination)) throw new Error(`destination already exists: ${destination}`);
  const parent = nodePath.dirname(destination);
  if (!nodeFs.existsSync(parent)) throw new Error(`directory does not exist: ${parent}`);
  if (!nodeFs.statSync(parent).isDirectory()) throw new Error(`path is not a directory: ${parent}`);
}

function assertNodeTreeHasNoSymlinks(filePath: string, operation: string): void {
  const stat = nodeFs.lstatSync(filePath);
  if (stat.isSymbolicLink()) throw new Error(`${operation} does not support symbolic links: ${filePath}`);
  if (!stat.isDirectory()) return;
  for (const name of nodeFs.readdirSync(filePath)) {
    assertNodeTreeHasNoSymlinks(nodePath.join(filePath, name), operation);
  }
}

function copyNodeEntry(source: string, destination: string): void {
  const stat = nodeFs.lstatSync(source);
  if (stat.isDirectory()) {
    nodeFs.mkdirSync(destination);
    for (const name of nodeFs.readdirSync(source)) {
      copyNodeEntry(nodePath.join(source, name), nodePath.join(destination, name));
    }
    return;
  }
  if (stat.isFile()) {
    nodeFs.copyFileSync(source, destination);
    return;
  }
  throw new Error(`unsupported file-system object: ${source}`);
}

function addMemoryDirectory(directories: Set<string>, directory: string): void {
  const normalized = normalizeMemoryPath(directory);
  if (directories.has(normalized)) return;
  const parent = memoryDirname(normalized);
  if (parent !== normalized) addMemoryDirectory(directories, parent);
  directories.add(normalized);
}

export function runtimeStat(filePath: string, sourceFile: string, line: number, mode: 'reading' | 'writing'): any {
  try {
    return nodeFs.statSync(filePath);
  } catch (error) {
    throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${filePath}' for ${mode}: ${errorMessage(error)}`);
  }
}
