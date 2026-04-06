// src/compiler/scope.ts

import { SourceLocation, TypeNode } from './ast';
import { ResolvedType, FunctionParam } from './resolved-types';

export type SymbolKind =
    | 'variable'
    | 'parameter'
    | 'function'
    | 'class'
    | 'library';

export interface SymbolInfo {
    readonly name: string;
    readonly type: ResolvedType;
    readonly kind: SymbolKind;
    readonly loc: SourceLocation;
}

export type AccessModifier = 'public' | 'private';

export interface FieldInfo {
    readonly name: string;
    readonly type: ResolvedType;
    readonly access: AccessModifier;
}

export interface MethodInfo {
    readonly name: string;
    readonly returnTypeNode: TypeNode;
    readonly params: {
        name: string;
        typeNode: TypeNode;
        hasDefault: boolean;
    }[];
    readonly access: AccessModifier;
}

export interface ConstructorInfo {
    readonly params: FunctionParam[];
    readonly access: AccessModifier;
}

export interface ClassInfo {
    readonly name: string;
    readonly parentName: string | null;
    readonly parentModule: string | null;
    readonly fields: Map<string, FieldInfo>;
    readonly methods: Map<string, MethodInfo>;
    readonly constructors: ConstructorInfo[];
    readonly hasDestructor: boolean;
    readonly loc: SourceLocation;
}

export type ScopeKind =
    | 'global'
    | 'function'
    | 'method'
    | 'constructor'
    | 'block'
    | 'loop'
    | 'class';

export class Scope {

    readonly scopeKind: ScopeKind;
    readonly parent: Scope | null;

    readonly returnType: ResolvedType | null;

    readonly className: string | null;

    private symbols: Map<string, SymbolInfo> = new Map();

    constructor(
        scopeKind: ScopeKind,
        parent: Scope | null,
        returnType: ResolvedType | null = null,
        className: string | null = null,
    ) {
        this.scopeKind = scopeKind;
        this.parent = parent;
        this.returnType = returnType;
        this.className = className;
    }

    declare(info: SymbolInfo): boolean {
        if (this.symbols.has(info.name)) {
            return false;
        }
        this.symbols.set(info.name, info);
        return true;
    }

    lookupLocal(name: string): SymbolInfo | null {
        return this.symbols.get(name) ?? null;
    }

    lookup(name: string): SymbolInfo | null {
        const local = this.symbols.get(name);
        if (local !== undefined) return local;
        if (this.parent !== null) return this.parent.lookup(name);
        return null;
    }

    isInsideLoop(): boolean {
        if (this.scopeKind === 'loop') return true;
        if (this.parent !== null) return this.parent.isInsideLoop();
        return false;
    }

    getReturnType(): ResolvedType | null {
        if (this.returnType !== null) return this.returnType;
        if (this.parent !== null) return this.parent.getReturnType();
        return null;
    }

    getClassName(): string | null {
        if (this.className !== null) return this.className;
        if (this.parent !== null) return this.parent.getClassName();
        return null;
    }

    isInsideFunction(): boolean {
        if (this.scopeKind === 'function' ||
            this.scopeKind === 'method' ||
            this.scopeKind === 'constructor') return true;
        if (this.parent !== null) return this.parent.isInsideFunction();
        return false;
    }
}