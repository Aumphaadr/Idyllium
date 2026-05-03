"use strict";
// src/compiler/resolved-types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_TYPE = exports.VOID_TYPE = exports.BOOL_TYPE = exports.CHAR_TYPE = exports.STRING_TYPE = exports.FLOAT_TYPE = exports.INT_TYPE = exports.FIXED_FLOAT_TYPES = exports.FIXED_INT_TYPES = void 0;
exports.isFixedNumeric = isFixedNumeric;
exports.isFixedInt = isFixedInt;
exports.isFixedFloat = isFixedFloat;
exports.makeArrayType = makeArrayType;
exports.makeDynArrayType = makeDynArrayType;
exports.makeClassType = makeClassType;
exports.makeQualifiedType = makeQualifiedType;
exports.makeFunctionType = makeFunctionType;
exports.typeToString = typeToString;
exports.typesEqual = typesEqual;
exports.isAssignable = isAssignable;
exports.isNumeric = isNumeric;
exports.isArrayLike = isArrayLike;
exports.isDynArray = isDynArray;
exports.isError = isError;
exports.isVoid = isVoid;
exports.getElementType = getElementType;
exports.isNumericArray = isNumericArray;
exports.arithmeticResultType = arithmeticResultType;
exports.comparisonResultType = comparisonResultType;
exports.logicalResultType = logicalResultType;
exports.defaultValueDescription = defaultValueDescription;
exports.FIXED_INT_TYPES = new Set([
    'int8', 'int16', 'int32', 'int64',
    'uint8', 'uint16', 'uint32', 'uint64',
]);
exports.FIXED_FLOAT_TYPES = new Set([
    'float32', 'float64',
]);
function isFixedNumeric(t) {
    if (t.tag !== 'qualified')
        return false;
    if (t.qualifier !== 'types')
        return false;
    return exports.FIXED_INT_TYPES.has(t.name) || exports.FIXED_FLOAT_TYPES.has(t.name);
}
function isFixedInt(t) {
    if (t.tag !== 'qualified')
        return false;
    if (t.qualifier !== 'types')
        return false;
    return exports.FIXED_INT_TYPES.has(t.name);
}
function isFixedFloat(t) {
    if (t.tag !== 'qualified')
        return false;
    if (t.qualifier !== 'types')
        return false;
    return exports.FIXED_FLOAT_TYPES.has(t.name);
}
exports.INT_TYPE = { tag: 'int' };
exports.FLOAT_TYPE = { tag: 'float' };
exports.STRING_TYPE = { tag: 'string' };
exports.CHAR_TYPE = { tag: 'char' };
exports.BOOL_TYPE = { tag: 'bool' };
exports.VOID_TYPE = { tag: 'void' };
exports.ERROR_TYPE = { tag: 'error' };
function makeArrayType(elementType, size) {
    return { tag: 'array', elementType, size };
}
function makeDynArrayType(elementType) {
    return { tag: 'dyn_array', elementType };
}
function makeClassType(name) {
    return { tag: 'class', name };
}
function makeQualifiedType(qualifier, name) {
    return { tag: 'qualified', qualifier, name };
}
function makeFunctionType(paramTypes, returnType) {
    return { tag: 'function', paramTypes, returnType };
}
function typeToString(t) {
    switch (t.tag) {
        case 'int': return 'int';
        case 'float': return 'float';
        case 'string': return 'string';
        case 'char': return 'char';
        case 'bool': return 'bool';
        case 'void': return 'void';
        case 'error': return '<error>';
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
function typesEqual(a, b) {
    if (a.tag !== b.tag)
        return false;
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
            const ba = b;
            return a.size === ba.size && typesEqual(a.elementType, ba.elementType);
        }
        case 'dyn_array': {
            const bd = b;
            return typesEqual(a.elementType, bd.elementType);
        }
        case 'class': {
            const bc = b;
            return a.name === bc.name;
        }
        case 'qualified': {
            const bq = b;
            return a.qualifier === bq.qualifier && a.name === bq.name;
        }
        case 'function': {
            const bf = b;
            if (a.paramTypes.length !== bf.paramTypes.length)
                return false;
            if (!typesEqual(a.returnType, bf.returnType))
                return false;
            return a.paramTypes.every((p, i) => typesEqual(p.type, bf.paramTypes[i].type));
        }
    }
}
function isAssignable(target, source) {
    if (target.tag === 'error' || source.tag === 'error')
        return true;
    if (typesEqual(target, source))
        return true;
    if (target.tag === 'float' && source.tag === 'int')
        return true;
    if (target.tag === 'array' && source.tag === 'dyn_array') {
        return isAssignable(target.elementType, source.elementType);
    }
    if (target.tag === 'dyn_array' && source.tag === 'array') {
        return isAssignable(target.elementType, source.elementType);
    }
    if (target.tag === 'dyn_array' && source.tag === 'dyn_array') {
        return isAssignable(target.elementType, source.elementType);
    }
    if (target.tag === 'array' && source.tag === 'array') {
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
    if (isFixedInt(target) && source.tag === 'int')
        return true;
    if (target.tag === 'int' && isFixedInt(source))
        return true;
    if (isFixedFloat(target) && (source.tag === 'float' || source.tag === 'int'))
        return true;
    if (target.tag === 'float' && isFixedFloat(source))
        return true;
    if (isFixedInt(target) && isFixedInt(source))
        return true;
    if (isFixedFloat(target) && isFixedFloat(source))
        return true;
    if (isFixedFloat(target) && isFixedInt(source))
        return true;
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
function isNumeric(t) {
    if (t.tag === 'int' || t.tag === 'float')
        return true;
    return isFixedNumeric(t);
}
function isArrayLike(t) {
    return t.tag === 'array' || t.tag === 'dyn_array';
}
function isDynArray(t) {
    return t.tag === 'dyn_array';
}
function isError(t) {
    return t.tag === 'error';
}
function isVoid(t) {
    return t.tag === 'void';
}
function getElementType(t) {
    if (t.tag === 'array')
        return t.elementType;
    if (t.tag === 'dyn_array')
        return t.elementType;
    return null;
}
function isNumericArray(t) {
    const el = getElementType(t);
    return el !== null && isNumeric(el);
}
function areElementTypesCompatible(a, b) {
    const elA = getElementType(a);
    const elB = getElementType(b);
    if (elA === null || elB === null)
        return false;
    return typesEqual(elA, elB) || isAssignable(elA, elB) || isAssignable(elB, elA);
}
function arithmeticResultType(left, right, op) {
    if (left.tag === 'error' || right.tag === 'error')
        return exports.ERROR_TYPE;
    if (op === '/') {
        if (isNumeric(left) && isNumeric(right))
            return exports.FLOAT_TYPE;
        return null;
    }
    if (op === '+') {
        if (left.tag === 'string' && right.tag === 'string')
            return exports.STRING_TYPE;
        if (left.tag === 'string' && right.tag === 'char')
            return exports.STRING_TYPE;
        if (left.tag === 'char' && right.tag === 'string')
            return exports.STRING_TYPE;
        if (left.tag === 'char' && right.tag === 'char')
            return exports.STRING_TYPE;
    }
    if ((left.tag === 'int' || left.tag === 'float') &&
        (right.tag === 'int' || right.tag === 'float')) {
        if (left.tag === 'int' && right.tag === 'int')
            return exports.INT_TYPE;
        return exports.FLOAT_TYPE;
    }
    if (isNumeric(left) && isNumeric(right)) {
        const leftIsFloat = left.tag === 'float' || isFixedFloat(left);
        const rightIsFloat = right.tag === 'float' || isFixedFloat(right);
        if (leftIsFloat || rightIsFloat) {
            return exports.FLOAT_TYPE;
        }
        return exports.INT_TYPE;
    }
    return null;
}
function comparisonResultType(left, right, op) {
    if (left.tag === 'error' || right.tag === 'error')
        return exports.BOOL_TYPE;
    if (isNumeric(left) && isNumeric(right))
        return exports.BOOL_TYPE;
    if (left.tag === 'string' && right.tag === 'string')
        return exports.BOOL_TYPE;
    if (left.tag === 'char' && right.tag === 'char')
        return exports.BOOL_TYPE;
    if (left.tag === 'bool' && right.tag === 'bool') {
        return exports.BOOL_TYPE;
    }
    // Array comparison: == and != only
    if ((op === '==' || op === '!=') && isArrayLike(left) && isArrayLike(right)) {
        if (areElementTypesCompatible(left, right)) {
            return exports.BOOL_TYPE;
        }
    }
    if (left.tag === 'class' && right.tag === 'class' && left.name === right.name) {
        if (op === '==' || op === '!=')
            return exports.BOOL_TYPE;
        return null;
    }
    return null;
}
function logicalResultType(left, right) {
    if (left.tag === 'error' || right.tag === 'error')
        return exports.BOOL_TYPE;
    if (left.tag === 'bool' && right.tag === 'bool')
        return exports.BOOL_TYPE;
    return null;
}
function defaultValueDescription(t) {
    switch (t.tag) {
        case 'int': return '0';
        case 'float': return '0.0';
        case 'bool': return 'false';
        case 'char': return "'\\0'";
        case 'string': return '""';
        case 'array': return `array of ${t.size} default values`;
        case 'dyn_array': return 'empty dynamic array';
        default: return 'undefined';
    }
}
//# sourceMappingURL=resolved-types.js.map