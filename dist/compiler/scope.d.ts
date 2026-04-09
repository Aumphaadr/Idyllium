import { SourceLocation, TypeNode } from './ast';
import { ResolvedType, FunctionParam } from './resolved-types';
export type SymbolKind = 'variable' | 'parameter' | 'function' | 'class' | 'library';
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
export type ScopeKind = 'global' | 'function' | 'method' | 'constructor' | 'block' | 'loop' | 'class';
export declare class Scope {
    readonly scopeKind: ScopeKind;
    readonly parent: Scope | null;
    readonly returnType: ResolvedType | null;
    readonly className: string | null;
    private symbols;
    constructor(scopeKind: ScopeKind, parent: Scope | null, returnType?: ResolvedType | null, className?: string | null);
    declare(info: SymbolInfo): boolean;
    lookupLocal(name: string): SymbolInfo | null;
    lookup(name: string): SymbolInfo | null;
    isInsideLoop(): boolean;
    getReturnType(): ResolvedType | null;
    getClassName(): string | null;
    isInsideFunction(): boolean;
}
//# sourceMappingURL=scope.d.ts.map