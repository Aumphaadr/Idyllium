(() => {
  const KEYWORDS = new Set([
    'use', 'if', 'else', 'while', 'do', 'for', 'break', 'continue', 'return', 'const',
    'try', 'catch', 'function', 'class', 'extends', 'this', 'constructor',
    'destructor', 'public', 'private', 'static', 'parent', 'and', 'or', 'xor',
    'not', 'true', 'false', 'null',
  ]);

  const TYPES = new Set([
    'int', 'float', 'string', 'char', 'bool', 'void', 'array', 'dyn_array', 'set',
  ]);

  const QUALIFIED_TYPES = new Set([
    'Animation', 'Array', 'Color', 'Database', 'Drawable', 'Font', 'Image', 'Music', 'Object', 'Result',
    'Sound', 'Statement', 'Static', 'Value',
    'Circle', 'Line', 'Rectangle', 'Sprite', 'Text',
    'istream', 'ostream', 'stream', 'stamp',
    'Window', 'Widget', 'Button', 'Label', 'SpinBox', 'FloatSpinBox',
    'LineEdit', 'CheckBox', 'ProgressBar', 'TextEdit', 'ComboBox', 'Slider',
    'Frame', 'Timer', 'Modal', 'RadioButton', 'ImageBox', 'Canvas',
    'KeyboardEvent', 'MouseEvent', 'MouseScrollEvent',
    'int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'float32', 'float64',
  ]);

  const state = {
    api: null,
    modules: new Map(),
    languagePages: new Map(),
    searchEntries: [],
    query: '',
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    els.body = document.body;
    els.nav = document.getElementById('reference-nav');
    els.search = document.getElementById('reference-search');
    els.view = document.getElementById('reference-view');
    els.main = document.getElementById('reference-main');
    els.themeToggle = document.getElementById('theme-toggle');
    els.menuToggle = document.getElementById('menu-toggle');
    els.version = document.getElementById('version');

    applySavedTheme();
    bindShellEvents();

    try {
      state.api = await fetchJson('api.json');
      state.modules = new Map(state.api.modules.map((module) => [module.name, module]));
      state.languagePages = new Map(state.api.language.map((page) => [page.id, page]));
      state.searchEntries = buildSearchEntries(state.api);
      els.version.textContent = `v${state.api.languageVersion}`;
      renderNavigation();
      renderRoute();
    } catch (error) {
      renderFatalError(error);
    }

    window.addEventListener('hashchange', renderRoute);
  }

  function bindShellEvents() {
    els.themeToggle.addEventListener('click', () => {
      const next = document.body.classList.contains('light-theme') ? 'dark' : 'light';
      localStorage.setItem('idyllium-docs-theme', next);
      applyTheme(next);
    });

    els.menuToggle.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    els.search.addEventListener('input', () => {
      state.query = els.search.value.trim().toLocaleLowerCase('ru');
      renderNavigation();
    });

    els.nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) document.body.classList.remove('sidebar-open');
    });

    document.addEventListener('click', (event) => {
      const copyButton = event.target.closest('[data-copy]');
      if (copyButton) {
        void copyText(copyButton, copyButton.dataset.copy || '');
        return;
      }

      if (
        document.body.classList.contains('sidebar-open')
        && !event.target.closest('#reference-sidebar')
        && !event.target.closest('#menu-toggle')
      ) {
        document.body.classList.remove('sidebar-open');
      }
    });
  }

  function applySavedTheme() {
    applyTheme(localStorage.getItem('idyllium-docs-theme') === 'light' ? 'light' : 'dark');
  }

  function applyTheme(theme) {
    const light = theme === 'light';
    document.body.classList.toggle('light-theme', light);
    els.themeToggle.textContent = light ? 'Тёмная тема' : 'Светлая тема';
  }

  function renderNavigation() {
    if (!state.api) return;
    const route = routeParts();

    if (state.query) {
      const matches = state.searchEntries
        .filter((entry) => entry.searchText.includes(state.query))
        .slice(0, 80);
      els.nav.innerHTML = matches.length === 0
        ? '<div class="search-empty">Ничего не найдено</div>'
        : `<div class="nav-heading">Результаты</div>${matches.map((entry) => `
            <a class="nav-link" href="${entry.href}">
              <span class="nav-symbol-kind">${escapeHtml(entry.kind)}</span>
              <span class="nav-symbol-name">${escapeHtml(entry.label)}</span>
            </a>
          `).join('')}`;
      return;
    }

    const moduleLinks = state.api.modules.map((module) => {
      const moduleActive = route[0] === module.name;
      const types = module.types.map((type) => {
        const active = moduleActive && route[1] === type.name;
        return `<a class="nav-link nav-type ${active ? 'active' : ''}" href="#/${encodePart(module.name)}/${encodePart(type.name)}">${escapeHtml(type.name)}</a>`;
      }).join('');
      return `
        <a class="nav-link nav-module ${moduleActive && route.length === 1 ? 'active' : ''}" href="#/${encodePart(module.name)}">
          <span>${escapeHtml(module.name)}</span>
        </a>
        ${types}
      `;
    }).join('');

    els.nav.innerHTML = `
      <div class="nav-heading">Общее</div>
      <a class="nav-link ${route.length === 0 ? 'active' : ''}" href="#/">Обзор</a>
      <a class="nav-link ${route[0] === 'globals' ? 'active' : ''}" href="#/globals">Встроенные функции</a>
      <div class="nav-heading">Язык</div>
      ${state.api.language.map((page) => `
        <a class="nav-link nav-language ${route[0] === 'language' && route[1] === page.id ? 'active' : ''}" href="#/language/${encodePart(page.id)}">${escapeHtml(page.title)}</a>
      `).join('')}
      <div class="nav-heading">Библиотеки</div>
      ${moduleLinks}
    `;
  }

  function renderRoute() {
    if (!state.api) return;
    const parts = routeParts();
    let title = 'Документация';

    if (parts.length === 0) {
      renderOverview();
    } else if (parts[0] === 'language') {
      const page = state.languagePages.get(parts[1]);
      if (page) {
        renderLanguagePage(page);
        title = page.title;
      } else {
        renderNotFound(parts.join('.'));
      }
    } else if (parts[0] === 'globals') {
      renderGlobals(parts[1]);
      title = 'Встроенные функции';
    } else {
      const module = state.modules.get(parts[0]);
      if (!module) {
        renderNotFound(parts.join('.'));
      } else {
        const type = module.types.find((item) => item.name === parts[1]);
        if (type) {
          renderType(module, type, parts[2]);
          title = type.qualifiedName;
        } else {
          renderModule(module, parts[1]);
          title = module.name;
        }
      }
    }

    document.title = `${title} - Idyllium`;
    renderNavigation();
    els.main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
    revealRequestedMember(parts);
  }

  function renderOverview() {
    const api = state.api;
    const programPage = state.languagePages.get('program');
    const firstProgram = programPage?.sections.find((section) => section.code);
    const typeCount = api.modules.reduce((sum, module) => sum + module.types.length, 0);
    const memberCount = api.modules.reduce((sum, module) => (
      sum
      + module.functions.length
      + module.constants.length
      + module.types.reduce((typeSum, type) => typeSum + type.properties.length + type.methods.length, 0)
    ), api.globals.length);

    els.view.innerHTML = `
      <div class="breadcrumbs"><span>Idyllium</span><span>/</span><span>Документация</span></div>
      <header class="api-header">
        <div class="api-header-row">
          <h1>Документация Idyllium</h1>
          <span class="kind-badge module">API v${escapeHtml(api.languageVersion)}</span>
        </div>
        <p class="api-description">${escapeHtml(api.overview)}</p>
      </header>

      <section class="api-section">
        <h2>Структура файла Idyllium</h2>
        <p class="api-section-intro">Минимальная программа подключает нужную библиотеку и начинает выполнение с <code>main()</code>.</p>
        ${firstProgram?.code ? codeSample(firstProgram.code, firstProgram.language) : ''}
        <p class="section-link"><a href="#/language/program">Подробнее о структуре программы</a></p>
      </section>

      <section class="api-section">
        <h2>Основы языка</h2>
        <div class="language-list">
          ${api.language.map((page) => `
            <a class="language-row" href="#/language/${encodePart(page.id)}">
              <strong>${escapeHtml(page.title)}</strong>
              <span>${escapeHtml(page.description)}</span>
            </a>
          `).join('')}
        </div>
      </section>

      <section class="api-section">
        <h2>Состав справочника</h2>
        <div class="summary-list">
          ${summaryItem(api.modules.length, 'библиотек')}
          ${summaryItem(typeCount, 'библиотечных типов')}
          ${summaryItem(memberCount, 'функций и членов')}
        </div>
      </section>

      <section class="api-section">
        <h2>Библиотеки</h2>
        <div class="module-list">
          ${api.modules.map((module) => `
            <a class="module-row" href="#/${encodePart(module.name)}">
              <code>use ${escapeHtml(module.name)};</code>
              <span><strong>${escapeHtml(module.title)}</strong><br>${escapeHtml(module.description)}</span>
            </a>
          `).join('')}
        </div>
      </section>

      <section class="api-section">
        <h2>Как пользоваться</h2>
        <p class="api-section-intro">
          Ищите библиотеку, тип, функцию, свойство или метод через поле слева.
          Для последовательного изучения языка используйте Учебник.
        </p>
      </section>
    `;
  }

  function renderLanguagePage(page) {
    els.view.innerHTML = `
      ${breadcrumbs([{ label: 'Документация', href: '#/' }, { label: 'Язык' }, { label: page.title }])}
      <header class="api-header">
        <div class="api-header-row">
          <h1>${escapeHtml(page.title)}</h1>
          <span class="kind-badge">язык</span>
        </div>
        <p class="api-description">${escapeHtml(page.description)}</p>
      </header>
      ${page.sections.map((section) => `
        <section class="api-section">
          <h2>${escapeHtml(section.title)}</h2>
          ${section.description ? `<p class="api-section-intro">${escapeHtml(section.description)}</p>` : ''}
          ${section.notes?.length ? `<ul class="notes-list">${section.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : ''}
          ${section.code ? codeSample(section.code, section.language) : ''}
        </section>
      `).join('')}
    `;
  }

  function renderGlobals(requestedMember) {
    const globals = state.api.globals;
    els.view.innerHTML = `
      ${breadcrumbs([{ label: 'Документация', href: '#/' }, { label: 'Встроенные функции' }])}
      <header class="api-header">
        <div class="api-header-row">
          <h1>Встроенные функции</h1>
          <span class="kind-badge">язык</span>
        </div>
        <p class="api-description">Эти функции доступны без директивы <code>use</code>.</p>
      </header>
      <section class="api-section">
        <h2>Функции</h2>
        <div class="member-list">
          ${globals.map((fn) => renderCallable(fn, 'function', '', requestedMember)).join('')}
        </div>
      </section>
    `;
  }

  function renderModule(module, requestedMember) {
    els.view.innerHTML = `
      ${breadcrumbs([{ label: 'Документация', href: '#/' }, { label: module.name }])}
      <header class="api-header">
        <div class="api-header-row">
          <h1 class="api-qualified-name">${escapeHtml(module.name)}</h1>
          <span class="kind-badge module">библиотека</span>
        </div>
        <p class="api-description">${escapeHtml(module.description)}</p>
      </header>

      <section class="api-section">
        <h2>Подключение</h2>
        ${codeSample(`use ${module.name};`)}
      </section>

      ${renderNotes(module.notes)}
      ${renderExample(module.example)}
      ${renderFullExamples(module.fullExamples)}

      <section class="api-section">
        <h2>Состав библиотеки</h2>
        <div class="summary-list">
          ${summaryItem(module.types.length, 'типов')}
          ${summaryItem(module.functions.length, 'функций')}
          ${summaryItem(module.constants.length, 'констант')}
        </div>
      </section>

      ${renderModuleTypes(module)}
      ${renderModuleFunctions(module, requestedMember)}
      ${renderConstants(module, requestedMember)}
    `;
  }

  function renderModuleTypes(module) {
    if (module.types.length === 0) return '';
    return `
      <section class="api-section">
        <h2>Типы</h2>
        <div class="type-list">
          ${module.types.map((type) => `
            <a class="type-row" href="#/${encodePart(module.name)}/${encodePart(type.name)}">
              <code>${escapeHtml(type.qualifiedName)}</code>
              <span>${escapeHtml(type.description || 'Библиотечный тип Idyllium.')}</span>
            </a>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderModuleFunctions(module, requestedMember) {
    if (module.functions.length === 0) return '';
    return `
      <section class="api-section">
        <h2>Функции</h2>
        <div class="member-list">
          ${module.functions.map((fn) => renderCallable(fn, 'function', module.name, requestedMember)).join('')}
        </div>
      </section>
    `;
  }

  function renderConstants(module, requestedMember) {
    if (module.constants.length === 0) return '';
    return `
      <section class="api-section">
        <h2>Константы</h2>
        <div class="member-list">
          ${module.constants.map((constant) => renderConstant(constant, requestedMember)).join('')}
        </div>
      </section>
    `;
  }

  function renderType(module, type, requestedMember) {
    const properties = collectProperties(type);
    const methods = collectMethods(type);
    const baseLink = type.baseType
      ? `<p class="extends-line">Наследует: <a href="#/${typeRoute(type.baseType)}">${escapeHtml(type.baseType)}</a></p>`
      : '';

    els.view.innerHTML = `
      ${breadcrumbs([
        { label: 'Документация', href: '#/' },
        { label: module.name, href: `#/${encodePart(module.name)}` },
        { label: type.name },
      ])}
      <header class="api-header">
        <div class="api-header-row">
          <h1 class="api-qualified-name">${escapeHtml(type.qualifiedName)}</h1>
          <span class="kind-badge type">тип</span>
        </div>
        <p class="api-description">${escapeHtml(type.description || 'Библиотечный тип Idyllium.')}</p>
        ${baseLink}
      </header>

      <section class="api-section">
        <h2>Объявление</h2>
        ${codeSample(`${type.qualifiedName} value;`)}
      </section>

      ${renderNotes(type.notes)}
      ${renderExample(type.example)}

      <section class="api-section">
        <h2>Состав типа</h2>
        <div class="summary-list">
          ${summaryItem(properties.length, 'свойств')}
          ${summaryItem(methods.length, 'методов')}
          ${summaryItem(inheritedCount(properties) + inheritedCount(methods), 'унаследовано')}
        </div>
      </section>

      ${renderProperties(type, properties, requestedMember)}
      ${renderMethods(type, methods, requestedMember)}
    `;
  }

  function renderProperties(type, properties, requestedMember) {
    if (properties.length === 0) return '';
    return `
      <section class="api-section">
        <h2>Свойства</h2>
        <div class="member-list">
          ${properties.map((entry) => renderProperty(type, entry, requestedMember)).join('')}
        </div>
      </section>
    `;
  }

  function renderMethods(type, methods, requestedMember) {
    if (methods.length === 0) return '';
    return `
      <section class="api-section">
        <h2>Методы</h2>
        <div class="member-list">
          ${methods.map((entry) => renderCallable(
            entry.member,
            'method',
            entry.owner,
            requestedMember,
            entry.owner !== type.qualifiedName,
          )).join('')}
        </div>
      </section>
    `;
  }

  function renderProperty(type, entry, requestedMember) {
    const property = entry.member;
    const inherited = entry.owner !== type.qualifiedName;
    const highlight = requestedMember === property.name ? ' member-highlight' : '';
    const callbacks = property.callbacks.length === 0 ? '' : `
      <ul class="callback-list">
        ${property.callbacks.map((callback) => `<li><code>${escapeHtml(callback)}</code></li>`).join('')}
      </ul>
    `;
    return `
      <article class="member-row property${highlight}" id="${memberId('property', property.name)}">
        <div class="member-head">
          <code class="member-signature">${escapeHtml(`${property.name}: ${property.type}`)}</code>
          ${property.readonly ? '<span class="readonly-badge">только чтение</span>' : ''}
          ${inherited ? ownerBadge(entry.owner) : ''}
        </div>
        ${property.documentation ? `<p class="member-description">${escapeHtml(property.documentation)}</p>` : ''}
        ${callbacks}
      </article>
    `;
  }

  function renderCallable(callable, kind, owner, requestedMember, inherited = false) {
    const highlight = requestedMember === callable.name ? ' member-highlight' : '';
    const accepted = callable.parameters
      .filter((parameter) => parameter.acceptedDescription || parameter.acceptedTypes.length > 0)
      .map((parameter) => {
        const acceptedTypes = parameter.acceptedDescription || parameter.acceptedTypes.join(', ');
        return `${parameter.name}: ${acceptedTypes}`;
      });
    const meta = accepted.length > 0
      ? `<p class="member-meta">Допустимые значения типов: ${escapeHtml(accepted.join('; '))}</p>`
      : '';

    return `
      <article class="member-row ${kind}${highlight}" id="${memberId(kind, callable.name)}">
        <div class="member-head">
          <code class="member-signature">${escapeHtml(callable.signature)}</code>
          ${inherited ? ownerBadge(owner) : ''}
        </div>
        ${callable.documentation ? `<p class="member-description">${escapeHtml(callable.documentation)}</p>` : ''}
        ${meta}
      </article>
    `;
  }

  function renderConstant(constant, requestedMember) {
    const highlight = requestedMember === constant.name ? ' member-highlight' : '';
    return `
      <article class="member-row constant${highlight}" id="${memberId('constant', constant.name)}">
        <div class="member-head">
          <code class="member-signature">${escapeHtml(`${constant.name}: ${constant.type}`)}</code>
        </div>
        ${constant.documentation ? `<p class="member-description">${escapeHtml(constant.documentation)}</p>` : ''}
      </article>
    `;
  }

  function renderNotes(notes) {
    if (!notes || notes.length === 0) return '';
    return `
      <section class="api-section">
        <h2>Правила</h2>
        <ul class="notes-list">
          ${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
        </ul>
      </section>
    `;
  }

  function renderExample(example) {
    if (!example) return '';
    return `
      <section class="api-section">
        <h2>Пример</h2>
        ${codeSample(example)}
      </section>
    `;
  }

  function renderFullExamples(examples) {
    if (!examples || examples.length === 0) return '';
    const onlyJson = examples.every((example) => example.language === 'json');
    return `
      <section class="api-section">
        <h2>${onlyJson ? 'Примеры данных' : 'Полные примеры'}</h2>
        <p class="api-section-intro">${onlyJson
          ? 'Эти фрагменты показывают структуру готовых JSON-данных.'
          : 'Эти примеры можно сохранить как самостоятельный <code>.idyl</code>-файл и запустить целиком.'}</p>
        <div class="full-example-list">
          ${examples.map((example) => `
            <article class="full-example">
              <h3>${escapeHtml(example.title)}</h3>
              ${example.description ? `<p>${escapeHtml(example.description)}</p>` : ''}
              ${codeSample(example.code, example.language)}
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function codeSample(source, language = 'idyllium') {
    const languageId = language === 'json' ? 'json' : 'idyllium';
    const highlighted = languageId === 'json' ? highlightJson(source) : highlightIdyllium(source);
    const languageLabel = languageId === 'json'
      ? '<span class="code-language">JSON</span>'
      : '';
    return `<pre class="code-sample ${languageId}-code-sample">${languageLabel}<button class="copy-button" type="button" data-copy="${escapeAttribute(source)}">Копировать</button><code class="${languageId}-code">${highlighted}</code></pre>`;
  }

  function highlightIdyllium(source) {
    return tokenize(source).map((token) => {
      const value = escapeHtml(token.text);
      return token.category === 'plain' ? value : `<span class="hl-${token.category}">${value}</span>`;
    }).join('');
  }

  function highlightJson(source) {
    const tokens = [];
    let position = 0;

    function push(text, category = 'plain') {
      tokens.push({ text, category });
    }

    function nextNonWhitespace(start) {
      let index = start;
      while (index < source.length && isWhitespace(source[index])) index++;
      return source[index] ?? '';
    }

    while (position < source.length) {
      const char = source[position];

      if (isWhitespace(char)) {
        const start = position;
        while (position < source.length && isWhitespace(source[position])) position++;
        push(source.slice(start, position));
        continue;
      }

      if (char === '/' && source[position + 1] === '/') {
        const start = position;
        while (position < source.length && source[position] !== '\n') position++;
        push(source.slice(start, position), 'comment');
        continue;
      }

      if (char === '/' && source[position + 1] === '*') {
        const start = position;
        position += 2;
        while (position < source.length && !(source[position] === '*' && source[position + 1] === '/')) position++;
        if (position < source.length) position += 2;
        push(source.slice(start, position), 'comment');
        continue;
      }

      if (char === '"') {
        const start = position++;
        while (position < source.length) {
          if (source[position] === '\\' && position + 1 < source.length) {
            position += 2;
            continue;
          }
          if (source[position] === '"') {
            position++;
            break;
          }
          position++;
        }
        push(source.slice(start, position), nextNonWhitespace(position) === ':' ? 'jsonKey' : 'string');
        continue;
      }

      const number = source.slice(position).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (number) {
        push(number[0], 'number');
        position += number[0].length;
        continue;
      }

      const literal = source.slice(position).match(/^(?:true|false|null)\b/);
      if (literal) {
        push(literal[0], 'keyword');
        position += literal[0].length;
        continue;
      }

      if ('{}[],:'.includes(char)) {
        push(char, 'brackets');
        position++;
        continue;
      }

      push(char);
      position++;
    }

    return tokens.map((token) => {
      const value = escapeHtml(token.text);
      return token.category === 'plain' ? value : `<span class="hl-${token.category}">${value}</span>`;
    }).join('');
  }

  function tokenize(source) {
    const tokens = [];
    const userClasses = extractClassNames(source);
    const importedModules = extractImportedModules(source);
    let position = 0;

    function nextNonWhitespace(start) {
      let index = start;
      while (index < source.length && isWhitespace(source[index])) index++;
      return source[index] ?? '';
    }

    function lastSignificantToken() {
      for (let index = tokens.length - 1; index >= 0; index--) {
        if (tokens[index].category !== 'plain') return tokens[index];
      }
      return null;
    }

    function tokenBeforeDot() {
      let dotFound = false;
      for (let index = tokens.length - 1; index >= 0; index--) {
        if (tokens[index].category === 'plain') continue;
        if (tokens[index].text === '.') {
          dotFound = true;
          continue;
        }
        if (dotFound) return tokens[index];
      }
      return null;
    }

    while (position < source.length) {
      const char = source[position];

      if (isWhitespace(char)) {
        let value = '';
        while (position < source.length && isWhitespace(source[position])) value += source[position++];
        tokens.push({ text: value, category: 'plain' });
        continue;
      }

      if (char === '/' && source[position + 1] === '/') {
        let value = '';
        while (position < source.length && source[position] !== '\n') value += source[position++];
        tokens.push({ text: value, category: 'comment' });
        continue;
      }

      if (char === '/' && source[position + 1] === '*') {
        let value = '/*';
        position += 2;
        while (position < source.length) {
          if (source[position] === '*' && source[position + 1] === '/') {
            value += '*/';
            position += 2;
            break;
          }
          value += source[position++];
        }
        tokens.push({ text: value, category: 'comment' });
        continue;
      }

      if (char === '"' || char === "'") {
        const quote = char;
        let value = quote;
        position++;
        while (position < source.length && source[position] !== quote) {
          if (source[position] === '\\' && position + 1 < source.length) {
            value += source[position] + source[position + 1];
            position += 2;
          } else if (source[position] === '\n') {
            break;
          } else {
            value += source[position++];
          }
        }
        if (source[position] === quote) value += source[position++];
        tokens.push({ text: value, category: 'string' });
        continue;
      }

      if (isDigit(char)) {
        let value = '';
        while (position < source.length && (isDigit(source[position]) || source[position] === '.')) value += source[position++];
        tokens.push({ text: value, category: 'number' });
        continue;
      }

      if (isIdentStart(char)) {
        let value = '';
        while (position < source.length && isIdentPart(source[position])) value += source[position++];

        let category = 'object';
        const previous = lastSignificantToken();
        const afterDot = previous !== null && previous.text === '.';
        const next = nextNonWhitespace(position);

        if (afterDot) {
          const owner = tokenBeforeDot();
          const afterImportedModule = owner !== null && importedModules.has(owner.text);
          const isQualifiedTypePosition = /^\s+[a-zA-Z_][a-zA-Z0-9_]*\s*(?:[=;,)\[]|$)/
            .test(source.slice(position));
          if (QUALIFIED_TYPES.has(value) || isQualifiedTypePosition) category = 'className';
          else if (afterImportedModule && isPascalCase(value)) category = 'className';
          else if (next === '(') category = 'function';
        } else if (TYPES.has(value)) {
          category = 'typeName';
        } else if (KEYWORDS.has(value)) {
          category = 'keyword';
        } else if (userClasses.has(value) || isPascalCase(value)) {
          category = 'className';
        } else if (next === '(') {
          category = 'function';
        }

        tokens.push({ text: value, category });
        continue;
      }

      const pair = source.substring(position, position + 2);
      if (['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%='].includes(pair)) {
        tokens.push({ text: pair, category: 'brackets' });
        position += 2;
        continue;
      }

      if ('+-*/%<>=!{}[]();,.:~'.includes(char)) {
        tokens.push({ text: char, category: 'brackets' });
        position++;
        continue;
      }

      tokens.push({ text: char, category: 'plain' });
      position++;
    }

    return tokens;
  }

  function isDigit(char) {
    return char >= '0' && char <= '9';
  }

  function isIdentStart(char) {
    return /^[a-zA-Z_\u00C0-\u024F\u0400-\u04FF]$/u.test(char);
  }

  function isIdentPart(char) {
    return /^[a-zA-Z0-9_\u00C0-\u024F\u0400-\u04FF]$/u.test(char);
  }

  function isWhitespace(char) {
    return char === ' ' || char === '\t' || char === '\r' || char === '\n';
  }

  function isPascalCase(value) {
    return value.length > 0 && value[0] >= 'A' && value[0] <= 'Z';
  }

  function extractClassNames(source) {
    const result = new Set();
    const pattern = /\bclass\s+([A-Z][a-zA-Z0-9_]*)/gu;
    let match;
    while ((match = pattern.exec(source)) !== null) result.add(match[1]);
    return result;
  }

  function extractImportedModules(source) {
    const result = new Set();
    const pattern = /\buse\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/gu;
    let match;
    while ((match = pattern.exec(source)) !== null) result.add(match[1]);
    return result;
  }

  function summaryItem(value, label) {
    return `<div class="summary-item"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`;
  }

  function breadcrumbs(items) {
    return `<div class="breadcrumbs">${items.map((item, index) => {
      const separator = index === 0 ? '' : '<span>/</span>';
      const content = item.href
        ? `<a href="${item.href}">${escapeHtml(item.label)}</a>`
        : `<span>${escapeHtml(item.label)}</span>`;
      return separator + content;
    }).join('')}</div>`;
  }

  function ownerBadge(owner) {
    return `<span class="owner-badge">из ${escapeHtml(owner)}</span>`;
  }

  function collectProperties(type) {
    return collectMembers(type, 'properties');
  }

  function collectMethods(type) {
    return collectMembers(type, 'methods');
  }

  function collectMembers(type, key) {
    const chain = [];
    let current = type;
    const seen = new Set();
    while (current && !seen.has(current.qualifiedName)) {
      seen.add(current.qualifiedName);
      chain.unshift(current);
      current = current.baseType ? findType(current.baseType) : null;
    }

    const members = new Map();
    for (const owner of chain) {
      for (const member of owner[key]) {
        members.set(member.name, { owner: owner.qualifiedName, member });
      }
    }
    return [...members.values()].sort((left, right) => left.member.name.localeCompare(right.member.name));
  }

  function inheritedCount(entries) {
    return entries.filter((entry) => {
      const current = routeParts();
      return entry.owner !== `${current[0]}.${current[1]}`;
    }).length;
  }

  function findType(qualifiedName) {
    const split = qualifiedName.indexOf('.');
    if (split < 1) return null;
    const module = state.modules.get(qualifiedName.slice(0, split));
    return module?.types.find((type) => type.name === qualifiedName.slice(split + 1)) || null;
  }

  function typeRoute(qualifiedName) {
    const split = qualifiedName.indexOf('.');
    if (split < 1) return encodePart(qualifiedName);
    return `${encodePart(qualifiedName.slice(0, split))}/${encodePart(qualifiedName.slice(split + 1))}`;
  }

  function buildSearchEntries(api) {
    const entries = [
      {
        kind: 'язык',
        label: 'Встроенные функции',
        href: '#/globals',
        searchText: 'встроенные функции globals',
      },
    ];

    for (const page of api.language) {
      entries.push(searchEntry(
        'язык',
        page.title,
        `#/language/${encodePart(page.id)}`,
        `${page.description} ${page.sections.map((section) => section.title).join(' ')}`,
      ));
    }

    for (const global of api.globals) {
      entries.push(searchEntry('функция', global.name, `#/globals/${encodePart(global.name)}`, `global ${global.signature}`));
    }

    for (const module of api.modules) {
      entries.push(searchEntry('библиотека', module.name, `#/${encodePart(module.name)}`, `${module.title} ${module.description}`));
      for (const fn of module.functions) {
        entries.push(searchEntry('функция', `${module.name}.${fn.name}`, `#/${encodePart(module.name)}/${encodePart(fn.name)}`, fn.signature));
      }
      for (const constant of module.constants) {
        entries.push(searchEntry('константа', `${module.name}.${constant.name}`, `#/${encodePart(module.name)}/${encodePart(constant.name)}`, constant.type));
      }
      for (const type of module.types) {
        const typeHref = `#/${encodePart(module.name)}/${encodePart(type.name)}`;
        entries.push(searchEntry('тип', type.qualifiedName, typeHref, type.description));
        for (const property of type.properties) {
          entries.push(searchEntry('свойство', `${type.qualifiedName}.${property.name}`, `${typeHref}/${encodePart(property.name)}`, property.documentation));
        }
        for (const method of type.methods) {
          entries.push(searchEntry('метод', `${type.qualifiedName}.${method.name}`, `${typeHref}/${encodePart(method.name)}`, method.signature));
        }
      }
    }
    return entries;
  }

  function searchEntry(kind, label, href, extra = '') {
    return {
      kind,
      label,
      href,
      searchText: `${kind} ${label} ${extra || ''}`.toLocaleLowerCase('ru'),
    };
  }

  function revealRequestedMember(parts) {
    requestAnimationFrame(() => {
      const target = document.querySelector('.member-highlight');
      if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  function renderNotFound(name) {
    els.view.innerHTML = `
      <div class="error-state">
        <h1>Символ не найден</h1>
        <p>В текущем API нет элемента <code>${escapeHtml(name)}</code>.</p>
      </div>
    `;
  }

  function renderFatalError(error) {
    console.error(error);
    els.view.innerHTML = `
      <div class="error-state">
        <h1>Документация не загрузилась</h1>
        <p>${escapeHtml(String(error?.message || error))}</p>
      </div>
    `;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`cannot load ${url}: HTTP ${response.status}`);
    return response.json();
  }

  async function copyText(button, text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const input = document.createElement('textarea');
      input.value = text;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    const oldText = button.textContent;
    button.textContent = 'Скопировано';
    button.classList.add('copied');
    setTimeout(() => {
      button.textContent = oldText;
      button.classList.remove('copied');
    }, 1000);
  }

  function routeParts() {
    const raw = decodeURIComponent(location.hash.replace(/^#\/?/u, ''));
    return raw.split('/').filter(Boolean);
  }

  function memberId(kind, name) {
    return `${kind}-${String(name).replace(/[^a-zA-Z0-9_-]/gu, '-')}`;
  }

  function encodePart(value) {
    return encodeURIComponent(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
  }
})();
