import { CompletionItem, StandardLibraryRegistry, createDefaultStandardLibrary } from '../core/stdlib/registry';

export interface CompletionRequest {
  readonly source: string;
  readonly offset: number;
}

export interface LanguageServiceOptions {
  readonly stdlib?: StandardLibraryRegistry;
}

export class IdylliumLanguageService {
  private readonly stdlib: StandardLibraryRegistry;

  constructor(options: LanguageServiceOptions = {}) {
    this.stdlib = options.stdlib ?? createDefaultStandardLibrary();
  }

  completions(request: CompletionRequest): CompletionItem[] {
    const prefix = request.source.slice(0, request.offset);
    const memberMatch = /([A-Za-z_][A-Za-z0-9_]*)\.\s*$/.exec(prefix);
    if (memberMatch) {
      return this.stdlib.listModuleMembers(memberMatch[1]);
    }

    if (/\buse\s+[A-Za-z_0-9]*$/.test(prefix)) {
      return this.stdlib.listModules();
    }

    return [
      ...this.stdlib.listModules(),
      { name: 'main', kind: 'function', detail: 'main()' },
      { name: 'int', kind: 'type', detail: 'type int' },
      { name: 'float', kind: 'type', detail: 'type float' },
      { name: 'string', kind: 'type', detail: 'type string' },
      { name: 'char', kind: 'type', detail: 'type char' },
      { name: 'bool', kind: 'type', detail: 'type bool' },
    ];
  }
}
