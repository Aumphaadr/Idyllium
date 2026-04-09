export interface PrimRT {
    readonly tag: 'int' | 'float' | 'string' | 'char' | 'bool' | 'void';
}
export interface ArrayRT {
    readonly tag: 'array';
    readonly elementType: ResolvedType;
    readonly size: number;
}
export interface DynArrayRT {
    readonly tag: 'dyn_array';
    readonly elementType: ResolvedType;
}
export interface ClassRT {
    readonly tag: 'class';
    readonly name: string;
}
export interface QualifiedRT {
    readonly tag: 'qualified';
    readonly qualifier: string;
    readonly name: string;
}
export declare const FIXED_INT_TYPES: Set<string>;
export declare const FIXED_FLOAT_TYPES: Set<string>;
export declare function isFixedNumeric(t: ResolvedType): boolean;
export declare function isFixedInt(t: ResolvedType): boolean;
export declare function isFixedFloat(t: ResolvedType): boolean;
export interface FunctionRT {
    readonly tag: 'function';
    readonly paramTypes: FunctionParam[];
    readonly returnType: ResolvedType;
}
export interface FunctionParam {
    readonly name: string;
    readonly type: ResolvedType;
    readonly hasDefault: boolean;
}
export interface ErrorRT {
    readonly tag: 'error';
}
export type ResolvedType = PrimRT | ArrayRT | DynArrayRT | ClassRT | QualifiedRT | FunctionRT | ErrorRT;
export declare const INT_TYPE: PrimRT;
export declare const FLOAT_TYPE: PrimRT;
export declare const STRING_TYPE: PrimRT;
export declare const CHAR_TYPE: PrimRT;
export declare const BOOL_TYPE: PrimRT;
export declare const VOID_TYPE: PrimRT;
export declare const ERROR_TYPE: ErrorRT;
export declare function makeArrayType(elementType: ResolvedType, size: number): ArrayRT;
export declare function makeDynArrayType(elementType: ResolvedType): DynArrayRT;
export declare function makeClassType(name: string): ClassRT;
export declare function makeQualifiedType(qualifier: string, name: string): QualifiedRT;
export declare function makeFunctionType(paramTypes: FunctionParam[], returnType: ResolvedType): FunctionRT;
export declare function typeToString(t: ResolvedType): string;
export declare function typesEqual(a: ResolvedType, b: ResolvedType): boolean;
export declare function isAssignable(target: ResolvedType, source: ResolvedType): boolean;
export declare function isNumeric(t: ResolvedType): boolean;
export declare function isArrayLike(t: ResolvedType): boolean;
export declare function isDynArray(t: ResolvedType): boolean;
export declare function isError(t: ResolvedType): boolean;
export declare function isVoid(t: ResolvedType): boolean;
export declare function getElementType(t: ResolvedType): ResolvedType | null;
export declare function isNumericArray(t: ResolvedType): boolean;
export declare function arithmeticResultType(left: ResolvedType, right: ResolvedType, op: '+' | '-' | '*' | '/'): ResolvedType | null;
export declare function comparisonResultType(left: ResolvedType, right: ResolvedType, op: '==' | '!=' | '<' | '>' | '<=' | '>='): ResolvedType | null;
export declare function logicalResultType(left: ResolvedType, right: ResolvedType): ResolvedType | null;
export declare function defaultValueDescription(t: ResolvedType): string;
//# sourceMappingURL=resolved-types.d.ts.map