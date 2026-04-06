// src/compiler/resolved-types.ts

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

export const FIXED_INT_TYPES = new Set([
    'int8', 'int16', 'int32', 'int64',
    'uint8', 'uint16', 'uint32', 'uint64',
]);

export const FIXED_FLOAT_TYPES = new Set([
    'float32', 'float64',
]);

export function isFixedNumeric(t: ResolvedType): boolean {
    if (t.tag !== 'qualified') return false;
    if (t.qualifier !== 'types') return false;
    return FIXED_INT_TYPES.has(t.name) || FIXED_FLOAT_TYPES.has(t.name);
}

export function isFixedInt(t: ResolvedType): boolean {
    if (t.tag !== 'qualified') return false;
    if (t.qualifier !== 'types') return false;
    return FIXED_INT_TYPES.has(t.name);
}

export function isFixedFloat(t: ResolvedType): boolean {
    if (t.tag !== 'qualified') return false;
    if (t.qualifier !== 'types') return false;
    return FIXED_FLOAT_TYPES.has(t.name);
}

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

export type ResolvedType =
    | PrimRT
    | ArrayRT
    | DynArrayRT
    | ClassRT
    | QualifiedRT
    | FunctionRT
    | ErrorRT;

export const INT_TYPE:    PrimRT  = { tag: 'int'    };
export const FLOAT_TYPE:  PrimRT  = { tag: 'float'  };
export const STRING_TYPE: PrimRT  = { tag: 'string' };
export const CHAR_TYPE:   PrimRT  = { tag: 'char'   };
export const BOOL_TYPE:   PrimRT  = { tag: 'bool'   };
export const VOID_TYPE:   PrimRT  = { tag: 'void'   };
export const ERROR_TYPE:  ErrorRT = { tag: 'error'  };

export function makeArrayType(elementType: ResolvedType, size: number): ArrayRT {
    return { tag: 'array', elementType, size };
}

export function makeDynArrayType(elementType: ResolvedType): DynArrayRT {
    return { tag: 'dyn_array', elementType };
}

export function makeClassType(name: string): ClassRT {
    return { tag: 'class', name };
}

export function makeQualifiedType(qualifier: string, name: string): QualifiedRT {
    return { tag: 'qualified', qualifier, name };
}

export function makeFunctionType(
    paramTypes: FunctionParam[],
    returnType: ResolvedType,
): FunctionRT {
    return { tag: 'function', paramTypes, returnType };
}

export function typeToString(t: ResolvedType): string {
    switch (t.tag) {
        case 'int':       return 'int';
        case 'float':     return 'float';
        case 'string':    return 'string';
        case 'char':      return 'char';
        case 'bool':      return 'bool';
        case 'void':      return 'void';
        case 'error':     return '<error>';
        case 'array':
            return `array<${typeToString(t.elementType)}, ${t.size}>`;
        case 'dyn_array':
            return `dyn_array<${typeToString(t.elementType)}>`;
        case 'class':
            return t.name;
        case 'qualified':
            return `${t.qualifier}.${t.name}`;
        case 'function': {
            const params = t.paramTypes.map(p => typeToString(p.type)).join(', ');
            return `function(${params}) -> ${typeToString(t.returnType)}`;
        }
    }
}

export function typesEqual(a: ResolvedType, b: ResolvedType): boolean {
    if (a.tag !== b.tag) return false;

    switch (a.tag) {
        case 'int':
        case 'float':
        case 'string':
        case 'char':
        case 'bool':
        case 'void':
        case 'error':
            return true;

        case 'array': {
            const ba = b as ArrayRT;
            return a.size === ba.size && typesEqual(a.elementType, ba.elementType);
        }

        case 'dyn_array': {
            const bd = b as DynArrayRT;
            return typesEqual(a.elementType, bd.elementType);
        }

        case 'class': {
            const bc = b as ClassRT;
            return a.name === bc.name;
        }

        case 'qualified': {
            const bq = b as QualifiedRT;
            return a.qualifier === bq.qualifier && a.name === bq.name;
        }

        case 'function': {
            const bf = b as FunctionRT;
            if (a.paramTypes.length !== bf.paramTypes.length) return false;
            if (!typesEqual(a.returnType, bf.returnType)) return false;
            return a.paramTypes.every((p, i) => typesEqual(p.type, bf.paramTypes[i].type));
        }
    }
}

export function isAssignable(target: ResolvedType, source: ResolvedType): boolean {
    if (target.tag === 'error' || source.tag === 'error') return true;

    if (typesEqual(target, source)) return true;

    if (target.tag === 'float' && source.tag === 'int') return true;

    if (target.tag === 'array' && source.tag === 'dyn_array') {
        return isAssignable(target.elementType, source.elementType);
    }
    if (target.tag === 'dyn_array' && source.tag === 'array') {
        return isAssignable(target.elementType, source.elementType);
    }

    if (target.tag === 'qualified' && source.tag === 'qualified') {
        if (target.qualifier === 'file' && source.qualifier === 'file') {
            if (source.name === 'stream') {
                return target.name === 'istream' || target.name === 'ostream' || target.name === 'stream';
            }
            if (target.name === 'stream') {
                return source.name === 'istream' || source.name === 'ostream' || source.name === 'stream';
            }
        }
        
        if (target.qualifier === 'gui' && source.qualifier === 'gui') {
            if (target.name === 'Widget') {
                return true;
            }
        }
    }

    if (isFixedInt(target) && source.tag === 'int') return true;
    if (target.tag === 'int' && isFixedInt(source)) return true;
    
    if (isFixedFloat(target) && (source.tag === 'float' || source.tag === 'int')) return true;
    if (target.tag === 'float' && isFixedFloat(source)) return true;

    if (isFixedInt(target) && isFixedInt(source)) return true;
    if (isFixedFloat(target) && isFixedFloat(source)) return true;
    if (isFixedFloat(target) && isFixedInt(source)) return true;

    if (target.tag === 'function' && source.tag === 'function') {
        if (!isAssignable(target.returnType, source.returnType) && 
            !isVoid(target.returnType) && !isVoid(source.returnType)) {
            return false;
        }
        
        if (target.paramTypes.length === 0) {
            return true;
        }
        
        if (target.paramTypes.length !== source.paramTypes.length) {
            return false;
        }
        
        for (let i = 0; i < target.paramTypes.length; i++) {
            if (!isAssignable(source.paramTypes[i].type, target.paramTypes[i].type)) {
                return false;
            }
        }
        
        return true;
    }

    return false;
}

export function isNumeric(t: ResolvedType): boolean {
    if (t.tag === 'int' || t.tag === 'float') return true;
    return isFixedNumeric(t);
}

export function isArrayLike(t: ResolvedType): boolean {
    return t.tag === 'array' || t.tag === 'dyn_array';
}

export function isDynArray(t: ResolvedType): boolean {
    return t.tag === 'dyn_array';
}

export function isError(t: ResolvedType): boolean {
    return t.tag === 'error';
}

export function isVoid(t: ResolvedType): boolean {
    return t.tag === 'void';
}

export function getElementType(t: ResolvedType): ResolvedType | null {
    if (t.tag === 'array') return t.elementType;
    if (t.tag === 'dyn_array') return t.elementType;
    return null;
}

export function isNumericArray(t: ResolvedType): boolean {
    const el = getElementType(t);
    return el !== null && isNumeric(el);
}

export function arithmeticResultType(
    left: ResolvedType,
    right: ResolvedType,
    op: '+' | '-' | '*' | '/',
): ResolvedType | null {
    if (left.tag === 'error' || right.tag === 'error') return ERROR_TYPE;

    if (op === '/') {
        if (isNumeric(left) && isNumeric(right)) return FLOAT_TYPE;
        return null;
    }

    if (op === '+') {
        if (left.tag === 'string' && right.tag === 'string') return STRING_TYPE;
        if (left.tag === 'string' && right.tag === 'char') return STRING_TYPE;
        if (left.tag === 'char' && right.tag === 'string') return STRING_TYPE;
        if (left.tag === 'char' && right.tag === 'char') return STRING_TYPE;
    }

    if ((left.tag === 'int' || left.tag === 'float') && 
        (right.tag === 'int' || right.tag === 'float')) {
        if (left.tag === 'int' && right.tag === 'int') return INT_TYPE;
        return FLOAT_TYPE;
    }

    if (isNumeric(left) && isNumeric(right)) {
        const leftIsFloat = left.tag === 'float' || isFixedFloat(left);
        const rightIsFloat = right.tag === 'float' || isFixedFloat(right);
        
        if (leftIsFloat || rightIsFloat) {
            return FLOAT_TYPE;
        }
        return INT_TYPE;
    }

    return null;
}

export function comparisonResultType(
    left: ResolvedType,
    right: ResolvedType,
    op: '==' | '!=' | '<' | '>' | '<=' | '>=',
): ResolvedType | null {
    if (left.tag === 'error' || right.tag === 'error') return BOOL_TYPE;
    
    if (isNumeric(left) && isNumeric(right)) return BOOL_TYPE;
    
    if (left.tag === 'string' && right.tag === 'string') return BOOL_TYPE;
    if (left.tag === 'char' && right.tag === 'char') return BOOL_TYPE;
    if (left.tag === 'bool' && right.tag === 'bool') {
        return BOOL_TYPE;
    }

    if (left.tag === 'class' && right.tag === 'class' && left.name === right.name) {
        if (op === '==' || op === '!=') return BOOL_TYPE;
        return null;
    }

    return null;
}

export function logicalResultType(
    left: ResolvedType,
    right: ResolvedType,
): ResolvedType | null {
    if (left.tag === 'error' || right.tag === 'error') return BOOL_TYPE;
    if (left.tag === 'bool' && right.tag === 'bool') return BOOL_TYPE;
    return null;
}

export function defaultValueDescription(t: ResolvedType): string {
    switch (t.tag) {
        case 'int':       return '0';
        case 'float':     return '0.0';
        case 'bool':      return 'false';
        case 'char':      return "'\\0'";
        case 'string':    return '""';
        case 'array':     return `array of ${t.size} default values`;
        case 'dyn_array': return 'empty dynamic array';
        default:          return 'undefined';
    }
}