const fs: any = require('fs');
const path: any = require('path');

import {
  CallbackSpec,
  ConstantSpec,
  FunctionSpec,
  ModuleSpec,
  PropertySpec,
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
    .map((module) => serializeModule(module, content))
    .sort((left, right) => (
      (moduleOrder.get(left.name) ?? Number.MAX_SAFE_INTEGER)
      - (moduleOrder.get(right.name) ?? Number.MAX_SAFE_INTEGER)
      || left.name.localeCompare(right.name)
    ));
  const globals = registry.listGlobalFunctions().map((fn) => serializeFunction(fn, `global.${fn.name}`, content));

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const file of ['index.html', 'app.css', 'app.js']) {
    fs.copyFileSync(path.join(packageRoot, file), path.join(outputRoot, file));
  }

  const api = {
    version: 1,
    languageVersion: String(packageJson.version ?? '1.1.3'),
    generatedAt: new Date().toISOString(),
    overview: content.overview,
    language: content.language ?? [],
    globals,
    modules,
  };
  fs.writeFileSync(path.join(outputRoot, 'api.json'), `${JSON.stringify(api, null, 2)}\n`, 'utf8');
  console.log(`reference generated: ${modules.length} modules, ${globals.length} global functions`);
}

function serializeModule(module: ModuleSpec, content: ReferenceContent) {
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
      .map((type) => serializeType(module.name, type, content)),
  };
}

function serializeType(moduleName: string, type: TypeSpec, content: ReferenceContent) {
  const qualifiedName = `${moduleName}.${type.name}`;
  const typeContent = content.types[qualifiedName] ?? {};
  return {
    name: type.name,
    qualifiedName,
    baseType: type.baseType ? typeToString(type.baseType) : '',
    description: typeContent.description ?? '',
    notes: typeContent.notes ?? [],
    example: typeContent.example ?? '',
    properties: sortByName([...type.properties.values()])
      .map((property) => serializeProperty(qualifiedName, property, content)),
    methods: sortByName([...type.methods.values()])
      .map((method) => serializeFunction(method, `${qualifiedName}.${method.name}`, content)),
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
