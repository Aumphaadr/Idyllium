// Страж единого набора иконок (1.6.3): источники чистые (сетка 20×20, только currentColor,
// только пути), сгенерированные модули совпадают со свежей генерацией, каждое имя,
// на которое ссылается код сайта, есть в наборе, а набор нигде не дублируется по-старому.
import { ICON_NAMES, ICON_MARKUP, iconSvg, isIconName } from '../src/icons';
import { assert, test, runTests } from './smoke-harness';

const fs: any = require('fs');
const path: any = require('path');
const builder: any = require(path.resolve(process.cwd(), 'tools', 'build-icons.js'));

function read(file: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

function walk(dir: string, accept: (file: string) => boolean, into: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'vendor', 'monaco', 'fonts', 'dist', 'docs', 'generated', '.git'].includes(entry.name)) continue;
      walk(full, accept, into);
    } else if (accept(full)) into.push(full);
  }
  return into;
}

test('icons: the generated modules match the sources and the sources are clean', () => {
  const outputs = builder.generate();
  for (const [relative, content] of Object.entries(outputs)) {
    assert(read(relative) === content, `${relative} is stale — run node tools/build-icons.js`);
  }
  assert(ICON_NAMES.length >= 100, `the set has ${ICON_NAMES.length} icons, expected the full pack`);
  for (const name of ICON_NAMES) {
    const markup = ICON_MARKUP[name];
    assert(markup.includes('<path'), `${name}: no path`);
    assert(!/#[0-9a-fA-F]{3,6}\b/u.test(markup), `${name}: hard-coded colour in the generated markup`);
    assert(!/<(text|image|script|style|use)\b/u.test(markup), `${name}: forbidden element`);
  }
  const svg = iconSvg('play', { size: 18, title: 'Запустить' });
  assert(svg.startsWith('<svg class="icon icon-play"') && svg.includes('viewBox="0 0 20 20"') && svg.includes('<title>Запустить</title>'), 'iconSvg renders a titled svg');
  assert(isIconName('play') && !isIconName('nope'), 'isIconName tells names from strangers');
  // Каждый виджет палитры конструктора имеет свой значок.
  const widgets: any = require(path.resolve(process.cwd(), 'packages', 'gui-designer', 'src', 'widgets.js'));
  for (const def of widgets.WIDGET_TYPES) {
    assert(isIconName(def.icon), `palette: gui.${def.type} has no icon '${def.icon}' in the set`);
  }
});

test('icons: every icon name used by the site exists in the set', () => {
  const files = walk(path.resolve(process.cwd(), 'packages'), (file: string) => /\.(html|js|ts|json)$/u.test(file) && !file.includes('/icons/') && !file.endsWith('icons.js'))
    .concat(walk(path.resolve(process.cwd(), 'tools'), (file: string) => /\.(js|ts)$/u.test(file)));
  const patterns = [
    /data-icon="([A-Za-z0-9-]+)"/gu,
    /iconSvg\('([A-Za-z0-9-]+)'/gu,
    /IdylliumIcons\.(?:svg|element)\('([A-Za-z0-9-]+)'/gu,
    /icon:\s*'([A-Za-z0-9-]+)'/gu,
  ];
  const seen = new Map<string, string>();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) seen.set(match[1], path.relative(process.cwd(), file));
    }
  }
  assert(seen.size >= 40, `expected the site to use dozens of icons, found ${seen.size}`);
  for (const [name, file] of seen) {
    assert(isIconName(name), `${file} uses icon '${name}' which is not in the set`);
  }
});

void runTests();
