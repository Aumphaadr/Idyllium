import { IDYLLIUM_VERSION, compileIdyllium, runIdyllium, IdylliumLanguageService, IdylliumProject, compileProject, createRuntime, createMemoryRuntimeFileSystem, createMemoryNetworkService, createMemoryChannelBus, createNodeImageService, createDefaultStandardLibrary, formatIdyllium, runIdylliumInBrowser, IDYLLIUM_SEMANTIC_TOKEN_TYPES, IDYLLIUM_SEMANTIC_TOKEN_MODIFIERS, parseIdylliumStyle } from '../src';
import { scaleRaster } from '../src/runtime/image-service';

const fs: any = require('fs');
const os: any = require('os');
const path: any = require('path');
const BufferRef: any = require('buffer').Buffer;

let passed = 0;
let failed = 0;
const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({ name, fn });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertCompiles(source: string): void {
  const result = compileIdyllium(source);
  assert(result.success, `expected compilation success, got:\n${result.diagnosticsText}`);
}

function assertFails(source: string, expected: string): void {
  const result = compileIdyllium(source);
  assert(!result.success, 'expected compilation failure');
  assert(
    result.diagnosticsText.toLowerCase().includes(expected.toLowerCase()),
    `expected diagnostic containing "${expected}", got:\n${result.diagnosticsText}`,
  );
}

async function assertRuntimeFails(source: string, expected: string): Promise<void> {
  const result = await runIdyllium(source, {}, { file: 'main.idyl' });
  assert(!result.success, 'expected runtime failure');
  assert(result.runtimeError !== null, 'expected runtime error text');
  assert(
    result.runtimeError.includes(expected),
    `expected runtime error containing "${expected}", got:\n${result.runtimeError}`,
  );
}

function explicitProperties(properties: Readonly<Record<string, unknown>>): string[] {
  return Array.isArray(properties.__explicit_properties) ? properties.__explicit_properties as string[] : [];
}

async function runWithInspectableRuntime(source: string, compileOptions: Parameters<typeof compileIdyllium>[1] = {}) {
  const compilation = compileIdyllium(source, compileOptions);
  assert(compilation.success, compilation.diagnosticsText);
  assert(compilation.jsCode !== null, 'expected generated JavaScript');

  const runtime = createRuntime();
  const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
  const factory = new AsyncFunction(compilation.jsCode);
  const program = await factory();
  await program(runtime);
  return { runtime, compilation };
}

async function runWithMemoryFiles(source: string, files: Record<string, string>) {
  const compilation = compileIdyllium(source, { file: '/workspace/main.idyl' });
  assert(compilation.success, compilation.diagnosticsText);
  assert(compilation.jsCode !== null, 'expected generated JavaScript');

  const runtime = createRuntime({
    fileSystem: createMemoryRuntimeFileSystem(files),
  });
  const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
  const factory = new AsyncFunction(compilation.jsCode);
  const program = await factory();
  await program(runtime);
  return { runtime, compilation };
}

function tinyWavBinary(): string {
  const bytes = BufferRef.alloc(44);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(36, 4);
  bytes.write('WAVE', 8, 'ascii');
  bytes.write('fmt ', 12, 'ascii');
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(8000, 28);
  bytes.writeUInt16LE(1, 32);
  bytes.writeUInt16LE(8, 34);
  bytes.write('data', 36, 'ascii');
  bytes.writeUInt32LE(0, 40);
  return bytes.toString('binary');
}

function tinyMp3Bytes(frameCount = 10): Uint8Array {
  const frameLength = Math.floor(144 * 128000 / 44100);
  const bytes = new Uint8Array(frameLength * frameCount);
  for (let frame = 0; frame < frameCount; frame++) {
    const offset = frame * frameLength;
    bytes[offset] = 0xff;
    bytes[offset + 1] = 0xfb;
    bytes[offset + 2] = 0x90;
    bytes[offset + 3] = 0x00;
  }
  return bytes;
}

function tinyTtfHeader(): Uint8Array {
  return new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
}

async function runTests(): Promise<void> {
  for (const item of tests) {
    try {
      await item.fn();
      passed++;
      console.log(`ok - ${item.name}`);
    } catch (error: unknown) {
      failed++;
      console.log(`not ok - ${item.name}`);
      console.log(error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`\npassed: ${passed}`);
  console.log(`failed: ${failed}`);
  if (failed > 0) {
    throw new Error(`${failed} smoke tests failed`);
  }
}

export {
  BufferRef,
  IDYLLIUM_SEMANTIC_TOKEN_MODIFIERS,
  IDYLLIUM_SEMANTIC_TOKEN_TYPES,
  IDYLLIUM_VERSION,
  IdylliumLanguageService,
  IdylliumProject,
  assert,
  assertCompiles,
  assertFails,
  assertRuntimeFails,
  compileIdyllium,
  compileProject,
  createDefaultStandardLibrary,
  createMemoryChannelBus,
  createMemoryNetworkService,
  createMemoryRuntimeFileSystem,
  createNodeImageService,
  createRuntime,
  explicitProperties,
  formatIdyllium,
  fs,
  os,
  parseIdylliumStyle,
  path,
  runIdyllium,
  runIdylliumInBrowser,
  runTests,
  runWithInspectableRuntime,
  runWithMemoryFiles,
  scaleRaster,
  test,
  tinyMp3Bytes,
  tinyTtfHeader,
  tinyWavBinary,
};
