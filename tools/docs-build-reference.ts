const fs: any = require('fs');
const path: any = require('path');

import {
  CallbackSpec,
  ConstantSpec,
  FunctionSpec,
  ModuleSpec,
  PropertySpec,
  StandardLibraryRegistry,
  TypeSpec,
  createDefaultStandardLibrary,
} from '../src/core/stdlib/registry';
import { typeToString } from '../src/core/types';

interface ReferenceContent {
  readonly overview: string;
  readonly language?: readonly ReferenceLanguagePage[];
  readonly modules: Readonly<Record<string, ReferenceModuleContent>>;
  readonly types: Readonly<Record<string, ReferenceTypeContent>>;
  readonly members: Readonly<Record<string, string>>;
}

interface ReferenceLanguagePage {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly sections: readonly ReferenceLanguageSection[];
}

interface ReferenceLanguageSection {
  readonly title: string;
  readonly description?: string;
  readonly code?: string;
  readonly language?: ReferenceCodeLanguage;
  readonly notes?: readonly string[];
}

type ReferenceCodeLanguage = 'idyllium' | 'json';

interface ReferenceExample {
  readonly title: string;
  readonly description?: string;
  readonly code: string;
  readonly language?: ReferenceCodeLanguage;
}

interface ReferenceModuleContent {
  readonly title?: string;
  readonly description?: string;
  readonly notes?: readonly string[];
  readonly example?: string;
  readonly fullExamples?: readonly ReferenceExample[];
}

interface ReferenceTypeContent {
  readonly description?: string;
  readonly notes?: readonly string[];
  readonly example?: string;
}

export function buildReferenceSite(outputRoot: string): void {
  const packageRoot = path.resolve(process.cwd(), 'packages', 'docs-reference');
  const contentPath = path.join(packageRoot, 'content.json');
  const content = JSON.parse(fs.readFileSync(contentPath, 'utf8')) as ReferenceContent;
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  const registry = createDefaultStandardLibrary();
  const moduleOrder = new Map(Object.keys(content.modules).map((name, index) => [name, index]));
  const modules = registry.listModuleSpecs()
    .map((module) => serializeModule(module, content, registry))
    .sort((left, right) => (
      (moduleOrder.get(left.name) ?? Number.MAX_SAFE_INTEGER)
      - (moduleOrder.get(right.name) ?? Number.MAX_SAFE_INTEGER)
      || left.name.localeCompare(right.name)
    ));
  const globals = registry.listGlobalFunctions().map((fn) => serializeFunction(fn, `global.${fn.name}`, content));

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const file of ['index.html', 'app.css', 'app.js']) {
    if (file === 'index.html') {
      // Значок версии в статичной оболочке: без штампа читатель без JS
      // видел бы заглушку шаблона вместо версии релиза.
      const shell = fs.readFileSync(path.join(packageRoot, file), 'utf8')
        .replace('<span class="version" id="version">v1.1.3</span>', `<span class="version" id="version">v${String(packageJson.version ?? '1.1.3')}</span>`);
      fs.writeFileSync(path.join(outputRoot, file), shell, 'utf8');
      continue;
    }
    fs.copyFileSync(path.join(packageRoot, file), path.join(outputRoot, file));
  }

  const api = {
    version: 1,
    languageVersion: String(packageJson.version ?? '1.1.3'),
    generatedAt: new Date().toISOString(),
    overview: content.overview,
    general: (content as any).general ?? [],
    language: content.language ?? [],
    globals,
    modules,
  };
  fs.writeFileSync(path.join(outputRoot, 'api.json'), `${JSON.stringify(api, null, 2)}\n`, 'utf8');

  const pages = bakeReferencePages(outputRoot, path.join(outputRoot, 'index.html'), api);
  console.log(`reference generated: ${modules.length} modules, ${globals.length} global functions, ${pages} clean URLs`);
}

/**
 * Печёт настоящую страницу на каждый маршрут справочника: /reference/gui,
 * /reference/gui/Window, /reference/language/keywords и т.д. Члены типов
 * (методы, свойства) отдельных страниц не получают — они живут во фрагменте
 * (#close), для которого решётка и придумана.
 */
function bakeReferencePages(
  outputRoot: string,
  shellPath: string,
  api: {
    readonly general: readonly { readonly id: string; readonly title: string; readonly description: string }[];
    readonly language: readonly { readonly id: string; readonly title: string; readonly description: string }[];
    readonly modules: readonly {
      readonly name: string;
      readonly title: string;
      readonly description: string;
      readonly types: readonly { readonly name: string; readonly qualifiedName: string; readonly description: string }[];
    }[];
  },
): number {
  const shell = fs.readFileSync(shellPath, 'utf8');
  const routes: Array<{ readonly parts: readonly string[]; readonly title: string; readonly description: string }> = [
    { parts: ['globals'], title: 'Встроенные функции', description: 'Глобальные функции Idyllium: преобразования типов и работа с массивами.' },
  ];
  for (const page of api.general) routes.push({ parts: ['general', page.id], title: page.title, description: page.description });
  for (const page of api.language) routes.push({ parts: ['language', page.id], title: page.title, description: page.description });
  for (const module of api.modules) {
    routes.push({ parts: [module.name], title: `Библиотека ${module.name}`, description: module.description });
    for (const type of module.types) {
      routes.push({ parts: [module.name, type.name], title: type.qualifiedName, description: type.description });
    }
  }

  let written = 0;
  const writePage = (parts: readonly string[], depth: number, title: string, description: string) => {
    const base = depth > 0 ? '../'.repeat(depth) : './';
    const meta = description ? `\n  <meta name="description" content="${escapeAttribute(description)}">` : '';
    if (!shell.includes('<base href="./">')) {
      throw new Error('reference shell must carry <base href="./"> — baked pages retarget it');
    }
    const page = shell
      .replace('<base href="./">', `<base href="${base}">`)
      .replace(/<title>[^<]*<\/title>/u, `<title>${escapeAttribute(title)} — Документация Idyllium</title>${meta}`);
    const outputPath = path.join(outputRoot, ...parts);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, page, 'utf8');
    written++;
  };

  for (const route of routes) {
    const dir = route.parts.slice(0, -1);
    const leaf = route.parts[route.parts.length - 1];
    writePage([...dir, `${leaf}.html`], dir.length, route.title, route.description);
  }

  // У модуля с типами рядом лежит одноимённый каталог (gui.html и gui/…).
  // Какое из правил GitHub Pages победит для «/reference/gui» — файл или
  // редирект в каталог — не документировано, поэтому страница модуля печётся
  // и вторым экземпляром как gui/index.html: оба исхода ведут к ней.
  for (const module of api.modules) {
    if (module.types.length === 0) continue;
    writePage([module.name, 'index.html'], 1, `Библиотека ${module.name}`, module.description);
  }

  return written;
}

function escapeAttribute(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeModule(module: ModuleSpec, content: ReferenceContent, registry: StandardLibraryRegistry) {
  const moduleContent = content.modules[module.name] ?? {};
  return {
    name: module.name,
    title: moduleContent.title ?? module.name,
    description: moduleContent.description ?? `Стандартная библиотека ${module.name}.`,
    notes: moduleContent.notes ?? [],
    example: moduleContent.example ?? '',
    fullExamples: moduleContent.fullExamples ?? [],
    functions: sortByName([...module.functions.values()])
      .map((fn) => serializeFunction(fn, `${module.name}.${fn.name}`, content)),
    constants: sortByName([...module.constants.values()])
      .map((constant) => serializeConstant(module.name, constant, content)),
    types: sortByName([...module.types.values()])
      .map((type) => serializeType(module.name, type, content, registry)),
  };
}

function serializeType(moduleName: string, type: TypeSpec, content: ReferenceContent, registry: StandardLibraryRegistry) {
  const qualifiedName = `${moduleName}.${type.name}`;
  const typeContent = content.types[qualifiedName] ?? {};

  // Наследование выражается машинно: члены базовых типов сплющиваются в
  // каждый тип с пометками inherited/inheritedFrom, чтобы потребителям
  // api.json не приходилось резолвить цепочку baseType самостоятельно.
  const ownProperties = sortByName([...type.properties.values()])
    .map((property) => serializeProperty(qualifiedName, property, content));
  const ownMethods = sortByName([...type.methods.values()])
    .map((method) => serializeFunction(method, `${qualifiedName}.${method.name}`, content));
  const seenProperties = new Set(type.properties.keys());
  const seenMethods = new Set(type.methods.keys());
  const inheritedProperties: Array<Record<string, unknown>> = [];
  const inheritedMethods: Array<Record<string, unknown>> = [];

  let base = type.baseType;
  const visited = new Set<string>();
  while (base) {
    const baseQualified = `${base.moduleName}.${base.name}`;
    if (visited.has(baseQualified)) break;
    visited.add(baseQualified);
    const baseSpec = registry.getQualifiedType(base.moduleName, base.name);
    if (!baseSpec) break;
    for (const property of sortByName([...baseSpec.properties.values()])) {
      if (seenProperties.has(property.name)) continue;
      seenProperties.add(property.name);
      inheritedProperties.push({
        ...serializeProperty(baseQualified, property, content),
        inherited: true,
        inheritedFrom: baseQualified,
      });
    }
    for (const method of sortByName([...baseSpec.methods.values()])) {
      if (seenMethods.has(method.name)) continue;
      seenMethods.add(method.name);
      inheritedMethods.push({
        ...serializeFunction(method, `${baseQualified}.${method.name}`, content),
        inherited: true,
        inheritedFrom: baseQualified,
      });
    }
    base = baseSpec.baseType;
  }

  return {
    name: type.name,
    qualifiedName,
    baseType: type.baseType ? typeToString(type.baseType) : '',
    description: typeContent.description ?? '',
    notes: typeContent.notes ?? [],
    example: typeContent.example ?? '',
    properties: [...ownProperties, ...inheritedProperties],
    methods: [...ownMethods, ...inheritedMethods],
  };
}

function serializeProperty(owner: string, property: PropertySpec, content: ReferenceContent) {
  return {
    name: property.name,
    type: typeToString(property.type),
    readonly: property.readonly === true,
    documentation: content.members[`${owner}.${property.name}`] ?? property.documentation ?? '',
    callbacks: (property.callbacks ?? []).map(callbackSignature),
  };
}

function serializeFunction(fn: FunctionSpec, contentKey: string, content: ReferenceContent) {
  const minArguments = fn.minArguments ?? fn.parameters.length;
  const parameters = fn.parameters.map((parameter, index) => ({
    name: parameter.name,
    type: typeToString(parameter.type),
    optional: index >= minArguments,
    defaultValue: parameter.defaultValue ?? '',
    acceptedTypes: (parameter.acceptedTypes ?? []).map(typeToString),
    acceptedDescription: localizeAcceptedDescription(parameter.acceptedDescription),
  }));
  const signatureParameters = parameters.map((parameter) => {
    const base = `${parameter.name}: ${parameter.type}`;
    if (parameter.defaultValue) return `${base} = ${parameter.defaultValue}`;
    return parameter.optional ? `[${base}]` : base;
  });
  if (fn.variadic) {
    const variadicType = fn.variadicTypes?.length
      ? fn.variadicTypes.map(typeToString).join(' | ')
      : 'any';
    signatureParameters.push(`...values: ${variadicType}`);
  }

  return {
    name: fn.name,
    signature: `${fn.name}(${signatureParameters.join(', ')}): ${typeToString(fn.returnType)}`,
    returnType: typeToString(fn.returnType),
    parameters,
    variadic: fn.variadic === true,
    documentation: content.members[contentKey] ?? fn.documentation ?? '',
  };
}

function serializeConstant(moduleName: string, constant: ConstantSpec, content: ReferenceContent) {
  return {
    name: constant.name,
    type: typeToString(constant.type),
    documentation: content.members[`${moduleName}.${constant.name}`] ?? constant.documentation ?? '',
  };
}

function callbackSignature(callback: CallbackSpec): string {
  return `function(${callback.parameters.map(typeToString).join(', ')}): ${typeToString(callback.returnType)}`;
}

function localizeAcceptedDescription(description: string | undefined): string {
  if (!description) return '';
  const translations: Readonly<Record<string, string>> = {
    'gui widget': 'виджет gui',
    'drawable object': 'drawable-объект',
    'string or numeric value': 'строка или числовое значение',
  };
  return translations[description] ?? description;
}

function sortByName<T extends { readonly name: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.name.localeCompare(right.name));
}
