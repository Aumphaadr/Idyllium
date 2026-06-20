const fs: any = require('fs');
const path: any = require('path');
const vm: any = require('vm');

let passed = 0;
let failed = 0;
const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({ name, fn });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertNumberEquals(actual: number, expected: number, message: string): void {
  assert(Object.is(actual, expected), `${message}: expected ${expected}, got ${actual}`);
}

class FakeAudio {
  static instances: FakeAudio[] = [];

  readonly listeners = new Map<string, Array<() => void>>();
  readonly constructorSrc: string;
  src = '';
  volume = 1;
  loop = false;
  preload = '';
  currentTime = 0;
  readyState = 1;
  playCount = 0;
  pauseCount = 0;

  constructor(src = '') {
    this.constructorSrc = src;
    this.src = src;
    FakeAudio.instances.push(this);
  }

  load(): void {
    // The renderer only needs this method to exist.
  }

  play(): Promise<void> {
    this.playCount++;
    return Promise.resolve();
  }

  pause(): void {
    this.pauseCount++;
  }

  addEventListener(name: string, listener: () => void): void {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  dispatch(name: string): void {
    for (const listener of this.listeners.get(name) ?? []) listener();
  }
}

function createFakeElement(tagName: string): any {
  const element: any = {
    tagName,
    children: [],
    className: '',
    dataset: {},
    hidden: false,
    style: {},
    tabIndex: 0,
    textContent: '',
    append(...items: unknown[]) {
      element.children.push(...items);
    },
    appendChild(child: unknown) {
      element.children.push(child);
      return child;
    },
    addEventListener() {
      // Events are not needed for these renderer audio tests.
    },
    removeEventListener() {
      // Events are not needed for these renderer audio tests.
    },
    replaceChildren(...items: unknown[]) {
      element.children = [...items];
    },
    setAttribute(name: string, value: string) {
      element[name] = value;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 100, height: 100 };
    },
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
  };
  return element;
}

function createRendererHarness() {
  FakeAudio.instances = [];
  const windowListeners = new Map<string, Array<(event: any) => void>>();
  const documentListeners = new Map<string, Array<(event: any) => void>>();
  const elements = new Map<string, any>([
    ['stage', createFakeElement('div')],
    ['summary', createFakeElement('div')],
  ]);
  const postedMessages: unknown[] = [];

  const windowObject: any = {
    IdylliumGuiInitialState: { audio: [], windows: [], canvases: [], modals: [] },
    IdylliumGuiHost: {
      postMessage(message: unknown) {
        postedMessages.push(message);
      },
    },
    addEventListener(name: string, listener: (event: any) => void) {
      const listeners = windowListeners.get(name) ?? [];
      listeners.push(listener);
      windowListeners.set(name, listeners);
    },
  };

  const documentObject: any = {
    body: createFakeElement('body'),
    createElement: createFakeElement,
    addEventListener(name: string, listener: (event: any) => void) {
      const listeners = documentListeners.get(name) ?? [];
      listeners.push(listener);
      documentListeners.set(name, listeners);
    },
    getElementById(id: string) {
      return elements.get(id) ?? null;
    },
  };

  const context = {
    Audio: FakeAudio,
    document: documentObject,
    window: windowObject,
  };

  const rendererPath = path.resolve(process.cwd(), 'packages/gui-renderer/renderer.js');
  vm.runInNewContext(fs.readFileSync(rendererPath, 'utf8'), context, { filename: rendererPath });

  const sendSnapshot = (snapshot: unknown) => {
    for (const listener of windowListeners.get('message') ?? []) {
      listener({ data: { type: 'snapshot', ...(snapshot as object) } });
    }
  };

  return { postedMessages, sendSnapshot };
}

test('gui renderer applies music volume and replays commands on a new preview generation', () => {
  const harness = createRendererHarness();

  harness.sendSnapshot({
    generation: 1,
    audio: [{
      id: 1,
      type: 'audio.Music',
      properties: {
        webview_uri: 'intro.wav',
        volume: 0.1,
        loop: false,
        position: 0,
      },
      commands: [{ id: 1, action: 'play' }],
    }],
    windows: [],
    canvases: [],
    modals: [],
  });

  assert(FakeAudio.instances.length === 1, `expected one music element, got ${FakeAudio.instances.length}`);
  assert(FakeAudio.instances[0].src === 'intro.wav', `unexpected music src: ${FakeAudio.instances[0].src}`);
  assertNumberEquals(FakeAudio.instances[0].volume, 0.1, 'music volume');
  assertNumberEquals(FakeAudio.instances[0].playCount, 1, 'first play command count');

  FakeAudio.instances[0].volume = 1;
  FakeAudio.instances[0].dispatch('loadedmetadata');
  assertNumberEquals(FakeAudio.instances[0].volume, 0.1, 'music volume after loadedmetadata');

  FakeAudio.instances[0].volume = 1;
  FakeAudio.instances[0].dispatch('playing');
  assertNumberEquals(FakeAudio.instances[0].volume, 0.1, 'music volume after playing');

  harness.sendSnapshot({
    generation: 1,
    audio: [{
      id: 1,
      type: 'audio.Music',
      properties: {
        webview_uri: 'intro.wav',
        volume: 0.35,
        loop: false,
        position: 0,
      },
      commands: [{ id: 1, action: 'play' }],
    }],
    windows: [],
    canvases: [],
    modals: [],
  });

  assert(FakeAudio.instances.length === 1, 'same generation should keep the existing music element');
  assertNumberEquals(FakeAudio.instances[0].volume, 0.35, 'live volume update');
  assertNumberEquals(FakeAudio.instances[0].playCount, 1, 'same generation play command count');

  harness.sendSnapshot({
    generation: 2,
    audio: [{
      id: 1,
      type: 'audio.Music',
      properties: {
        webview_uri: 'intro.wav',
        volume: 0.8,
        loop: false,
        position: 0,
      },
      commands: [{ id: 1, action: 'play' }],
    }],
    windows: [],
    canvases: [],
    modals: [],
  });

  assertNumberEquals(FakeAudio.instances.length, 2, 'music element count after new generation');
  assert(FakeAudio.instances[0].pauseCount > 0, 'old generation music element should be paused');
  assertNumberEquals(FakeAudio.instances[1].volume, 0.8, 'new generation music volume');
  assertNumberEquals(FakeAudio.instances[1].playCount, 1, 'new generation play command count');
});

test('gui renderer sends music finished event to the host', () => {
  const harness = createRendererHarness();

  harness.sendSnapshot({
    generation: 1,
    audio: [{
      id: 7,
      type: 'audio.Music',
      properties: {
        webview_uri: 'intro.wav',
        volume: 1,
        loop: false,
        position: 0,
      },
      commands: [{ id: 1, action: 'play' }],
    }],
    windows: [],
    canvases: [],
    modals: [],
  });

  FakeAudio.instances[0].dispatch('ended');
  assert(
    JSON.stringify(harness.postedMessages).includes('"eventName":"finished"'),
    `expected finished event, got ${JSON.stringify(harness.postedMessages)}`,
  );
});

async function main(): Promise<void> {
  for (const item of tests) {
    try {
      await item.fn();
      passed++;
      console.log(`ok - ${item.name}`);
    } catch (error) {
      failed++;
      console.error(`not ok - ${item.name}`);
      console.error(error instanceof Error ? error.stack || error.message : String(error));
    }
  }
  console.log(`\npassed: ${passed}`);
  console.log(`failed: ${failed}`);
  if (failed > 0) {
    throw new Error(`${failed} gui renderer tests failed`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
