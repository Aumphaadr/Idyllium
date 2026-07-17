import { AccessModifier } from './ast';
import { SourceRange } from './diagnostics';
import { FunctionSpec } from './stdlib/registry';
import { TypeRef } from './types';

export interface UserModuleFieldSpec {
  readonly name: string;
  readonly type: TypeRef;
  readonly owner: string;
  readonly access: AccessModifier;
  readonly range: SourceRange;
}

export interface UserModuleMethodSpec {
  readonly name: string;
  readonly spec: FunctionSpec;
  readonly owner: string;
  readonly access: AccessModifier;
  readonly isStatic: boolean;
  readonly range: SourceRange;
}

export interface UserModuleClassSpec {
  readonly name: string;
  readonly qualifiedName: string;
  readonly baseName: string | null;
  readonly fields: readonly UserModuleFieldSpec[];
  readonly methods: readonly UserModuleMethodSpec[];
  readonly constructorSpec: FunctionSpec | null;
  readonly constructorAccess: AccessModifier;
  readonly range: SourceRange;
}

export interface UserModuleConstantSpec {
  readonly name: string;
  readonly type: TypeRef;
  readonly range: SourceRange;
}

export interface UserModuleExports {
  readonly name: string;
  readonly file: string;
  readonly functions: ReadonlyMap<string, FunctionSpec>;
  readonly constants: ReadonlyMap<string, UserModuleConstantSpec>;
  readonly classes: ReadonlyMap<string, UserModuleClassSpec>;
}

export class UserModuleRegistry {
  private readonly modules = new Map<string, UserModuleExports>();

  register(module: UserModuleExports): void {
    this.modules.set(module.name, module);
  }

  hasModule(name: string): boolean {
    return this.modules.has(name);
  }

  getModule(name: string): UserModuleExports | undefined {
    return this.modules.get(name);
  }

  listModules(): UserModuleExports[] {
    return [...this.modules.values()];
  }
}

export function qualifiedUserClassName(moduleName: string, className: string): string {
  return `${moduleName}.${className}`;
}
