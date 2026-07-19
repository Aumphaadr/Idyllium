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
  duration = 0;
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

class FakeImage {
  static instances: FakeImage[] = [];

  readonly listeners = new Map<string, Array<() => void>>();
  src = '';
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;

  constructor() {
    FakeImage.instances.push(this);
  }

  addEventListener(name: string, listener: () => void): void {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  finish(width: number, height: number): void {
    this.complete = true;
    this.naturalWidth = width;
    this.naturalHeight = height;
    for (const listener of this.listeners.get('load') ?? []) listener();
  }
}

function createFakeCanvasContext(): any {
  return {
    arcCalls: [] as number[][],
    drawImageCalls: 0,
    drawImageArguments: [] as unknown[][],
    fillRectCalls: [] as number[][],
    fillTextCalls: 0,
    fillTextArguments: [] as unknown[][],
    font: '',
    fontKerning: 'auto',
    rotateCalls: [] as number[],
    scaleCalls: [] as number[][],
    translateCalls: [] as number[][],
    beginPath() {},
    arc(...args: number[]) { this.arcCalls.push(args); },
    clearRect() {},
    drawImage(...args: unknown[]) {
      this.drawImageCalls++;
      this.drawImageArguments.push(args);
    },
    fill() {},
    fillRect(...args: number[]) { this.fillRectCalls.push(args); },
    fillText(...args: unknown[]) {
      this.fillTextCalls++;
      this.fillTextArguments.push(args);
    },
    lineTo() {},
    moveTo() {},
    restore() {},
    rotate(angle: number) { this.rotateCalls.push(angle); },
    save() {},
    scale(x: number, y: number) { this.scaleCalls.push([x, y]); },
    stroke() {},
    strokeRect() {},
    translate(x: number, y: number) { this.translateCalls.push([x, y]); },
  };
}

function createFakeElement(tagName: string): any {
  const listeners = new Map<string, Array<(event: any) => void>>();
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
    addEventListener(name: string, listener: (event: any) => void) {
      const entries = listeners.get(name) ?? [];
      entries.push(listener);
      listeners.set(name, entries);
    },
    removeEventListener(name: string, listener: (event: any) => void) {
      listeners.set(name, (listeners.get(name) ?? []).filter((entry) => entry !== listener));
    },
    dispatch(name: string, event: any = {}) {
      for (const listener of listeners.get(name) ?? []) listener(event);
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
  FakeImage.instances = [];
  const windowListeners = new Map<string, Array<(event: any) => void>>();
  const documentListeners = new Map<string, Array<(event: any) => void>>();
  const elements = new Map<string, any>([
    ['stage', createFakeElement('div')],
    ['summary', createFakeElement('div')],
  ]);
  const postedMessages: unknown[] = [];
  const canvasContexts: any[] = [];

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
    createElement(tagName: string) {
      const element = createFakeElement(tagName);
      if (tagName === 'canvas') {
        const context = createFakeCanvasContext();
        canvasContexts.push(context);
        element.getContext = () => context;
      }
      return element;
    },
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
    Image: FakeImage,
    document: documentObject,
    requestAnimationFrame(callback: () => void) {
      callback();
      return 1;
    },
    window: windowObject,
  };

  const rendererPath = path.resolve(process.cwd(), 'packages/gui-renderer/renderer.js');
  vm.runInNewContext(fs.readFileSync(rendererPath, 'utf8'), context, { filename: rendererPath });

  const sendSnapshot = (snapshot: unknown) => {
    for (const listener of windowListeners.get('message') ?? []) {
      listener({ data: { type: 'snapshot', ...(snapshot as object) } });
    }
  };

  return { canvasContexts, postedMessages, sendSnapshot, stage: elements.get('stage') };
}

function findElement(root: any, predicate: (element: any) => boolean): any | null {
  if (predicate(root)) return root;
  for (const child of root?.children ?? []) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

test('gui renderer announces that it is ready for snapshots', () => {
  const harness = createRendererHarness();
  assert(
    harness.postedMessages.some((message: any) => message?.type === 'rendererReady'),
    'expected rendererReady host message',
  );
});

test('gui renderer close button asks the host to close the application', () => {
  const harness = createRendererHarness();
  harness.sendSnapshot({
    generation: 1,
    audio: [],
    windows: [{
      id: 1,
      type: 'gui.Window',
      properties: { width: 320, height: 180, title: 'Close me' },
      children: [],
    }],
    canvases: [],
    modals: [],
  });

  const close = findElement(harness.stage, (element) => element.className === 'window-close-button');
  assert(close !== null, 'expected Window close button');
  close.dispatch('click', { stopPropagation() {} });
  assert(
    harness.postedMessages.some((message: any) => message?.type === 'closeApp'),
    `expected closeApp host message, got ${JSON.stringify(harness.postedMessages)}`,
  );
});

test('gui renderer changes SpinBox with the mouse wheel', () => {
  const harness = createRendererHarness();
  harness.sendSnapshot({
    generation: 1,
    audio: [],
    windows: [{
      id: 1,
      type: 'gui.Window',
      properties: { width: 320, height: 180, title: 'SpinBox' },
      children: [{
        id: 2,
        type: 'gui.SpinBox',
        properties: {
          x: 10,
          y: 20,
          width: 120,
          height: 32,
          visible: true,
          min: 0,
          max: 20,
          step: 2,
          value: 6,
        },
        children: [],
      }],
    }],
    canvases: [],
    modals: [],
  });

  const spinBox = findElement(harness.stage, (element) => element.tagName === 'input' && element.type === 'number');
  assert(spinBox !== null, 'expected SpinBox input');
  let prevented = false;
  spinBox.dispatch('wheel', {
    deltaY: -100,
    preventDefault() { prevented = true; },
  });

  assert(spinBox.value === '8', `expected SpinBox value 8, got ${spinBox.value}`);
  assert(prevented, 'SpinBox wheel event must prevent page scrolling');
  assert(
    harness.postedMessages.some((message: any) => (
      message?.type === 'guiEvent'
      && message.objectId === 2
      && message.eventName === 'change'
      && message.payload?.value === 8
    )),
    `expected SpinBox change event, got ${JSON.stringify(harness.postedMessages)}`,
  );
});

test('gui renderer updates timer labels without replacing controls', () => {
  const harness = createRendererHarness();
  const snapshot = (text: string) => ({
    generation: 1,
    audio: [],
    windows: [{
      id: 1,
      type: 'gui.Window',
      properties: { width: 320, height: 180, title: 'Timer' },
      children: [{
        id: 2,
        type: 'gui.Label',
        properties: { x: 10, y: 20, width: 120, height: 32, visible: true, text },
        children: [],
      }, {
        id: 3,
        type: 'gui.Button',
        properties: { x: 10, y: 70, width: 120, height: 32, visible: true, text: 'Stop' },
        children: [],
      }],
    }],
    canvases: [],
    modals: [],
  });

  harness.sendSnapshot(snapshot('0'));
  const originalButton = findElement(harness.stage, (element) => element.dataset?.widgetId === '3');
  assert(originalButton !== null, 'expected Timer stop button');

  harness.sendSnapshot(snapshot('1'));
  const updatedButton = findElement(harness.stage, (element) => element.dataset?.widgetId === '3');
  const updatedLabel = findElement(harness.stage, (element) => element.dataset?.widgetId === '2');
  assert(updatedButton === originalButton, 'timer tick must preserve the existing Button DOM node');
  assert(updatedLabel?.textContent === '1', `expected updated Label text, got ${updatedLabel?.textContent}`);

  updatedButton.dispatch('click');
  assert(
    harness.postedMessages.some((message: any) => (
      message?.type === 'guiEvent' && message.objectId === 3 && message.eventName === 'click'
    )),
    `expected first Button click to reach the host, got ${JSON.stringify(harness.postedMessages)}`,
  );
});

test('gui renderer displays nested image resources in ImageBox', () => {
  const harness = createRendererHarness();

  harness.sendSnapshot({
    generation: 1,
    audio: [],
    windows: [{
      id: 1,
      type: 'gui.Window',
      properties: { width: 320, height: 220, title: 'Picture' },
      children: [{
        id: 2,
        type: 'gui.ImageBox',
        properties: {
          x: 10,
          y: 20,
          width: 160,
          height: 120,
          visible: true,
          resize_mode: 'fill',
          image: {
            id: 3,
            type: 'image.Static',
            properties: {
              is_loaded: true,
              src: 'cat.png',
              webview_uri: 'webview-cat.png',
            },
          },
        },
        children: [],
      }],
    }],
    canvases: [],
    modals: [],
  });

  const image = findElement(harness.stage, (element) => element.tagName === 'img');
  assert(image !== null, 'expected ImageBox to create an img element');
  assert(image.src === 'webview-cat.png', `unexpected ImageBox src: ${image.src}`);
  assert(image.style.objectFit === 'cover', `unexpected ImageBox object-fit: ${image.style.objectFit}`);
});

test('gui renderer inherits a loaded font from Window to child widgets', () => {
  const harness = createRendererHarness();

  harness.sendSnapshot({
    generation: 1,
    audio: [],
    windows: [{
      id: 1,
      type: 'gui.Window',
      properties: {
        width: 320,
        height: 180,
        title: 'Fonts',
        font_size: 18,
        __explicit_properties: ['font', 'font_size'],
        font: {
          type: 'fonts.Font',
          properties: {
            is_loaded: true,
            format: 'ttf',
            webview_uri: 'webview-lobster.ttf',
          },
        },
      },
      children: [{
        id: 2,
        type: 'gui.Label',
        properties: {
          x: 10,
          y: 20,
          width: 220,
          height: 32,
          visible: true,
          font_size: 13,
          text: 'Inherited font',
        },
        children: [],
      }, {
        id: 3,
        type: 'gui.Button',
        properties: {
          x: 10,
          y: 70,
          width: 220,
          height: 40,
          visible: true,
          font_size: 26,
          text: 'Explicit size',
          __explicit_properties: ['font_size'],
        },
        children: [],
      }, {
        id: 4,
        type: 'gui.LineEdit',
        properties: {
          x: 10,
          y: 125,
          width: 220,
          height: 36,
          visible: true,
          font_size: 13,
          text: 'Inherited input size',
          placeholder: '',
          echo_mode: 'normal',
        },
        children: [],
      }],
    }],
    canvases: [],
    modals: [],
  });

  const windowElement = findElement(harness.stage, (element) => element.tagName === 'section');
  const label = findElement(harness.stage, (element) => element.dataset.widgetId === '2');
  const button = findElement(harness.stage, (element) => element.dataset.widgetId === '3');
  const lineEdit = findElement(harness.stage, (element) => element.dataset.widgetId === '4');
  assert(windowElement?.style.fontFamily === 'IdylliumFont1, sans-serif', `unexpected Window font: ${windowElement?.style.fontFamily}`);
  assert(windowElement?.style.fontSize === '18px', `unexpected Window font size: ${windowElement?.style.fontSize}`);
  assert(label?.style.fontFamily === 'IdylliumFont1, sans-serif', `unexpected inherited Label font: ${label?.style.fontFamily}`);
  assert(label?.style.fontSize === '18px', `unexpected inherited Label font size: ${label?.style.fontSize}`);
  assert(button?.style.fontFamily === 'IdylliumFont1, sans-serif', `unexpected inherited Button font: ${button?.style.fontFamily}`);
  assert(button?.style.fontSize === '26px', `unexpected explicit Button font size: ${button?.style.fontSize}`);
  assert(lineEdit?.style.fontFamily === 'IdylliumFont1, sans-serif', `unexpected inherited LineEdit font: ${lineEdit?.style.fontFamily}`);
  assert(lineEdit?.style.fontSize === '18px', `unexpected inherited LineEdit font size: ${lineEdit?.style.fontSize}`);
});

test('gui renderer uses fonts.Font for drawable.Text on Canvas', () => {
  const harness = createRendererHarness();

  harness.sendSnapshot({
    generation: 1,
    audio: [],
    windows: [],
    canvases: [{
      id: 5,
      properties: { width: 300, height: 180 },
      commands: [{
        kind: 'draw',
        object: {
          type: 'drawable.Text',
          properties: {
            x: 20,
            y: 30,
            text: 'Canvas font',
            font_size: 24,
            text_color: '#ffffff',
            font: {
              type: 'fonts.Font',
              properties: {
                is_loaded: true,
                format: 'ttf',
                webview_uri: 'webview-canvas-font.ttf',
              },
            },
          },
        },
      }],
    }],
    modals: [],
  });

  assertNumberEquals(harness.canvasContexts.length, 1, 'Canvas render count');
  assert(harness.canvasContexts[0].font === '24px IdylliumFont1, sans-serif', `unexpected Canvas font: ${harness.canvasContexts[0].font}`);
  assert(harness.canvasContexts[0].fontKerning === 'none', `unexpected Canvas kerning: ${harness.canvasContexts[0].fontKerning}`);
  assertNumberEquals(harness.canvasContexts[0].fillTextCalls, 1, 'Canvas text draw count');
});

test('gui renderer uses the bundled font for drawable.Text by default', () => {
  const harness = createRendererHarness();

  harness.sendSnapshot({
    generation: 1,
    audio: [],
    windows: [],
    canvases: [{
      id: 5,
      properties: { width: 300, height: 180 },
      commands: [{
        kind: 'draw',
        object: {
          type: 'drawable.Text',
          properties: {
            x: 20,
            y: 30,
            text: 'Default Canvas font',
            font_size: 20,
            text_color: '#ffffff',
            font: {
              type: 'fonts.Font',
              properties: {
                is_loaded: true,
                is_builtin: true,
                format: 'woff2',
              },
            },
          },
        },
      }],
    }],
    modals: [],
  });

  assertNumberEquals(harness.canvasContexts.length, 1, 'default Canvas font render count');
  assert(
    harness.canvasContexts[0].font === '20px IdylliumCanvasDefault, sans-serif',
    `unexpected default Canvas font: ${harness.canvasContexts[0].font}`,
  );
  assert(harness.canvasContexts[0].fontKerning === 'none', 'default Canvas font should disable kerning');
});

test('gui renderer applies drawable origin and clockwise rotation', () => {
  const harness = createRendererHarness();

  harness.sendSnapshot({
    generation: 1,
    audio: [],
    windows: [],
    canvases: [{
      id: 5,
      properties: { width: 640, height: 360 },
      commands: [{
        kind: 'draw',
        object: {
          type: 'drawable.Rectangle',
          properties: {
            x: 300, y: 200, width: 100, height: 50,
            origin_x: 50, origin_y: 25, rotation: 90,
            fill_color: '#ff0000', border_width: 0,
          },
        },
      }, {
        kind: 'draw',
        object: {
          type: 'drawable.Circle',
          properties: {
            x: 500, y: 200, radius: 30,
            origin_x: 30, origin_y: 30, rotation: 45,
            fill_color: '#00ff00', border_width: 0,
          },
        },
      }, {
        kind: 'draw',
        object: {
          type: 'drawable.Circle',
          properties: {
            x: 40, y: 50, radius: 12,
            origin_x: 0, origin_y: 0, rotation: 0,
            fill_color: '#ffcc00', border_width: 0,
          },
        },
      }, {
        kind: 'draw',
        object: {
          type: 'drawable.Text',
          properties: {
            x: 80, y: 60, origin_x: 10, origin_y: 5, rotation: 30,
            text: 'Hello', font_size: 16, text_color: '#ffffff',
          },
        },
      }, {
        kind: 'draw',
        object: {
          type: 'drawable.Line',
          properties: {
            x1: 10, y1: 20, x2: 90, y2: 20, thickness: 8, color: '#ffffff',
          },
        },
      }],
    }],
    modals: [],
  });

  const context = harness.canvasContexts[0];
  assert(
    JSON.stringify(context.translateCalls) === JSON.stringify([[300, 200], [500, 200], [40, 50], [80, 60]]),
    `unexpected drawable translations: ${JSON.stringify(context.translateCalls)}`,
  );
  assert(Math.abs(context.rotateCalls[0] - Math.PI / 2) < 1e-12, `unexpected rectangle rotation: ${context.rotateCalls[0]}`);
  assert(
    context.fillRectCalls.some((args: number[]) => JSON.stringify(args) === JSON.stringify([-50, -25, 100, 50])),
    `expected origin-relative Rectangle bounds, got ${JSON.stringify(context.fillRectCalls)}`,
  );
  assert(
    context.arcCalls.some((args: number[]) => args[0] === 0 && args[1] === 0 && args[2] === 30),
    `expected center-origin Circle arc, got ${JSON.stringify(context.arcCalls)}`,
  );
  assert(
    context.arcCalls.some((args: number[]) => args[0] === 12 && args[1] === 12 && args[2] === 12),
    `expected default-origin Circle bounds, got ${JSON.stringify(context.arcCalls)}`,
  );
  assert(
    context.fillTextArguments.some((args: unknown[]) => args[0] === 'Hello' && args[1] === -10 && args[2] === -5),
    `expected origin-relative Text position, got ${JSON.stringify(context.fillTextArguments)}`,
  );
  assert(context.lineCap === 'round', `expected round Line caps, got ${String(context.lineCap)}`);
});

test('gui renderer redraws a static Canvas sprite after its image loads', () => {
  const harness = createRendererHarness();

  harness.sendSnapshot({
    generation: 1,
    audio: [],
    windows: [],
    canvases: [{
      id: 5,
      properties: { width: 300, height: 180 },
      commands: [{
        kind: 'draw',
        object: {
          id: 6,
          type: 'drawable.Sprite',
          properties: {
            x: 20,
            y: 30,
            origin_x: 10,
            origin_y: 5,
            rotation: 90,
            scale_x: -1,
            scale_y: 2,
            image: {
              id: 7,
              type: 'image.Static',
              properties: {
                is_loaded: true,
                src: 'player.png',
                webview_uri: 'webview-player.png',
              },
            },
          },
        },
      }],
    }],
    modals: [],
  });

  assert(FakeImage.instances.length === 1, `expected one cached image, got ${FakeImage.instances.length}`);
  assertNumberEquals(harness.canvasContexts.length, 1, 'initial Canvas render count');
  assert(harness.canvasContexts[0].drawImageCalls === 0, 'image must not be drawn before it is loaded');

  FakeImage.instances[0].finish(112, 100);

  assertNumberEquals(harness.canvasContexts.length, 2, 'Canvas render count after image load');
  const context = harness.canvasContexts[1];
  assert(context.drawImageCalls === 1, 'expected loaded sprite to be drawn after refresh');
  assert(JSON.stringify(context.translateCalls) === JSON.stringify([[20, 30]]), `unexpected Sprite translation: ${JSON.stringify(context.translateCalls)}`);
  assert(Math.abs(context.rotateCalls[0] - Math.PI / 2) < 1e-12, `unexpected Sprite rotation: ${context.rotateCalls[0]}`);
  assert(JSON.stringify(context.scaleCalls) === JSON.stringify([[-1, 2]]), `unexpected Sprite scale: ${JSON.stringify(context.scaleCalls)}`);
  assert(
    context.drawImageArguments[0][1] === -10
      && context.drawImageArguments[0][2] === -5
      && context.drawImageArguments[0][3] === 112
      && context.drawImageArguments[0][4] === 100,
    `unexpected Sprite drawImage arguments: ${JSON.stringify(context.drawImageArguments)}`,
  );
});

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

test('gui renderer retries a pending music seek after metadata loads', () => {
  const harness = createRendererHarness();

  harness.sendSnapshot({
    generation: 1,
    audio: [{
      id: 9,
      type: 'audio.Music',
      properties: {
        webview_uri: 'theme.mp3',
        volume: 0.25,
        loop: false,
        position: 0,
      },
      commands: [],
    }],
    windows: [],
    canvases: [],
    modals: [],
  });

  const music = FakeAudio.instances[0];
  music.readyState = 0;
  harness.sendSnapshot({
    generation: 1,
    audio: [{
      id: 9,
      type: 'audio.Music',
      properties: {
        webview_uri: 'theme.mp3',
        volume: 0.25,
        loop: false,
        position: 12.5,
      },
      commands: [{ id: 1, action: 'play' }],
    }],
    windows: [],
    canvases: [],
    modals: [],
  });
  assertNumberEquals(music.currentTime, 0, 'position before metadata');

  music.readyState = 1;
  music.duration = 30;
  music.dispatch('loadedmetadata');
  assertNumberEquals(music.currentTime, 12.5, 'position after metadata');
  assertNumberEquals(music.playCount, 1, 'play command count');
  assert(
    harness.postedMessages.some((message: any) => (
      message?.type === 'guiEvent'
      && message.objectId === 9
      && message.eventName === 'metadata'
      && message.payload?.duration === 30
    )),
    `expected metadata event, got ${JSON.stringify(harness.postedMessages)}`,
  );

  music.currentTime = 20;
  harness.sendSnapshot({
    generation: 1,
    audio: [{
      id: 9,
      type: 'audio.Music',
      properties: {
        webview_uri: 'theme.mp3',
        volume: 0.25,
        loop: false,
        position: 12.5,
      },
      commands: [{ id: 1, action: 'play' }, { id: 2, action: 'seek' }],
    }],
    windows: [],
    canvases: [],
    modals: [],
  });
  assertNumberEquals(music.currentTime, 12.5, 'repeated seek position');
  assertNumberEquals(music.playCount, 1, 'seek must not start another playback');
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
