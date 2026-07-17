# Развёртывание IdylliumNext

Эта памятка разделяет три разных результата публикации:

1. исходный код в GitHub-репозитории;
2. статический сайт GitHub Pages в папке `docs/`;
3. устанавливаемый VSIX как artifact GitHub Release.

## Адреса сайта

Один статический сайт содержит три равноправные части:

- `/` - Web IDE;
- `/book/` - детский учебник;
- `/reference/` - сухая документация;
- `/ide/` - совместимое перенаправление со старого адреса IDE на `/`.

Ссылки относительные, поэтому сайт работает и на отдельном домене, и как
GitHub Pages project site:

```text
https://aumphaadr.github.io/Idyllium/
```

## Что обязательно хранить в репозитории

### Ядро и инструменты

- `src/` - компилятор, runtime, CLI, browser API и language service;
- `tests/` - автоматические проверки;
- `tools/` - сборщики сайта, Web IDE, документации и VSIX;
- `spec/lessons/` - frozen lesson spec и ожидания ошибок;
- `spec/some_*/` - принятые draft-спеки, ручные проверки и используемые
  учебные ассеты;
- `package.json` и `package-lock.json` - зависимости и команды сборки;
- `tsconfig.json`;
- `README.md`, `BACKLOG.md`, `deploy.md`, `LICENSE`.

### Исходники интерфейсов

- `packages/web-ide/` - Web IDE;
- `packages/gui-renderer/` - общий GUI/Canvas renderer;
- `packages/vscode-idyllium/` - исходники расширения VS Code, кроме
  сгенерированных каталогов и VSIX;
- `packages/docs-book/` - SPA-оболочка учебника;
- `packages/docs-reference/` - SPA-оболочка справочника и
  `content.json` с ручными описаниями API;
- `packages/docs/` - локальная мигрированная база старого учебника.

`packages/docs/` особенно важна: обычная сборка больше не зависит от старого
репозитория `/home/nathaniel/IdylliumProjects/Idyllium`. После чистого клона
команда `npm run docs:site` берёт базовые уроки именно отсюда.

### Ручной контент и учебные ассеты

- `docs/manual-content/` - новые уроки, замены и дополнения старых уроков;
- `docs/ai/` - AI-friendly справочник по Idyllium;
- постоянные архитектурные документы внутри `docs/`;
- `my_images/cat.png`;
- `spec/some_images/walk.gif`;
- `spec/some_audio/click.wav`;
- `spec/some_audio/theme.mp3`.

Последние четыре файла копируются в учебник во время сборки. Остальные
draft-ассеты из `spec/some_*` тоже следует сохранять, если они используются
ручными примерами или обсуждаемой спецификацией.

## Что коммитить для GitHub Pages

GitHub Pages не запускает компилятор и не собирает TypeScript. При выбранном
источнике `main` / `/docs` в репозитории должна находиться уже собранная папка
`docs/`.

Перед коммитом выполнить:

```bash
npm ci
npm test
npm run docs:site
```

После сборки обязательно коммитятся как исходные изменения, так и обновлённый
статический сайт:

```text
docs/index.html             Web IDE
docs/app.js                 логика Web IDE
docs/assets/                browser runtime, WASM и ассеты
docs/monaco/                локальная Monaco Editor
docs/vendor/                локальные browser-зависимости
docs/gui-renderer/          GUI/Canvas preview
docs/fonts/                 шрифты сайта
docs/book/                  собранный учебник
docs/reference/             собранный справочник
docs/ide/index.html         старое перенаправление
docs/404.html               fallback для GitHub Pages
```

В папке `docs/` одновременно живут исходники и результат сборки. Команда
`npm run docs:site` очищает только управляемые пути сайта и сохраняет
`docs/manual-content/`, `docs/ai/`, `docs/migration/` и постоянные Markdown-
документы.

Ручные изменения в `docs/index.html`, `docs/app.js`, `docs/book/`,
`docs/reference/`, `docs/assets/` и других сгенерированных путях пропадут при
следующей сборке. Исправлять нужно соответствующий источник в `packages/`,
`src/`, `tools/` или `docs/manual-content/`.

## Настройка GitHub Pages

В настройках репозитория:

```text
Settings -> Pages -> Deploy from a branch
Branch: main
Folder: /docs
```

После публикации проверить:

- `/`;
- `/book/`;
- `/reference/`;
- `/ide/`;
- запуск консольного приложения;
- создание GUI Preview;
- загрузку картинок, шрифтов, аудио и SQLite WASM без обращения к CDN.

## Публикация VSIX

Перед релизом выполнить:

```bash
npm run package:vscode
```

Команда сначала собирает ядро, копирует runtime и зависимости внутрь
расширения, затем создаёт файл вида:

```text
packages/vscode-idyllium/idyllium-vsc-1.1.0.vsix
```

VSIX не нужно коммитить в Git. Его следует прикрепить к соответствующему
GitHub Release:

```text
https://github.com/Aumphaadr/Idyllium/releases
```

Исходники расширения коммитятся, а следующие результаты сборки не коммитятся:

```text
packages/vscode-idyllium/server/
packages/vscode-idyllium/gui-renderer/
packages/vscode-idyllium/*.vsix
```

Канонический renderer находится в `packages/gui-renderer/`; копия внутри
VSIX-папки каждый раз создаётся заново.

## Что не класть в репозиторий

- `node_modules/` - восстанавливается через `npm ci`;
- `dist/` - промежуточная TypeScript/Web-сборка;
- сгенерированные `packages/vscode-idyllium/server/` и
  `packages/vscode-idyllium/gui-renderer/`;
- файлы `packages/vscode-idyllium/*.vsix`;
- старые VSIX, ZIP и другие release-artifacts;
- логи, временные скриншоты и результаты ручных замеров;
- `.DS_Store`, настройки редакторов и другие файлы ОС;
- `.agents/`, `.codex/` и локальные настройки AI-инструментов;
- пользовательские проекты вне репозитория, например
  `/home/nathaniel/IdylliumProjects/user_examples`;
- старый репозиторий Idyllium: он больше не нужен обычной сборке;
- временные БД, картинки и аудиофайлы, не являющиеся fixture, учебным ассетом
  или частью draft-спеки.

Не следует добавлять глобальное правило `*.db`, `*.png`, `*.wav` или `*.mp3`:
часть бинарных файлов является осознанными тестовыми fixture и нужна проекту.

## Проверка из чистого клона

Минимальная последовательность:

```bash
npm ci
npm test
npm run docs:site
npm run package:vscode
npm run docs:serve
```

`docs:serve` печатает адрес для текущего компьютера и адреса локальной сети.
Простой запуск `docs/index.html` двойным кликом не является корректной
проверкой: сайт использует `fetch()`, Monaco, WASM и browser workers.

## Что не надо запускать перед каждым деплоем

- `npm run docs:migrate` повторно импортирует старую документацию и нужен
  только для осознанной новой миграции;
- `npm run spec:extract` перегенерирует frozen lesson spec и не должен
  запускаться как обычная часть публикации;
- `npm run docs:inventory` нужен для аудита базовых уроков, а не для сборки
  сайта.

Обычный деплой сайта ограничивается `npm test` и `npm run docs:site`.
