export type PrimitiveTypeName = 'int' | 'float' | 'string' | 'char' | 'bool' | 'void';

export interface PrimitiveType {
  readonly kind: 'primitive';
  readonly name: PrimitiveTypeName;
}

export interface QualifiedType {
  readonly kind: 'qualified';
  readonly moduleName: string;
  readonly name: string;
}

export interface ClassType {
  readonly kind: 'class';
  readonly name: string;
}

export interface ArrayType {
  readonly kind: 'array';
  readonly elementType: TypeRef;
  readonly size: number | null;
  readonly dynamic: boolean;
}

export interface ErrorType {
  readonly kind: 'error';
}

export interface AnyType {
  readonly kind: 'any';
}

export interface NullType {
  readonly kind: 'null';
}

export interface RuntimeErrorValueType {
  readonly kind: 'runtime-error';
}

export interface FunctionType {
  readonly kind: 'function';
  readonly parameters: readonly TypeRef[];
  readonly returnType: TypeRef;
  readonly minArguments?: number;
}

export type TypeRef = PrimitiveType | QualifiedType | ClassType | ArrayType | FunctionType | AnyType | NullType | RuntimeErrorValueType | ErrorType;

export const INT: PrimitiveType = { kind: 'primitive', name: 'int' };
export const FLOAT: PrimitiveType = { kind: 'primitive', name: 'float' };
export const STRING: PrimitiveType = { kind: 'primitive', name: 'string' };
export const CHAR: PrimitiveType = { kind: 'primitive', name: 'char' };
export const BOOL: PrimitiveType = { kind: 'primitive', name: 'bool' };
export const VOID: PrimitiveType = { kind: 'primitive', name: 'void' };
export const ERROR_TYPE: ErrorType = { kind: 'error' };
export const ANY_TYPE: AnyType = { kind: 'any' };
export const NULL_TYPE: NullType = { kind: 'null' };
export const RUNTIME_ERROR_VALUE: RuntimeErrorValueType = { kind: 'runtime-error' };
export const COLOR: QualifiedType = { kind: 'qualified', moduleName: 'colors', name: 'Color' };

export const ANY_VALUE_TYPES: readonly TypeRef[] = [INT, FLOAT, STRING, CHAR, BOOL, COLOR];

export function primitive(name: PrimitiveTypeName): PrimitiveType {
  switch (name) {
    case 'int':
      return INT;
    case 'float':
      return FLOAT;
    case 'string':
      return STRING;
    case 'char':
      return CHAR;
    case 'bool':
      return BOOL;
    case 'void':
      return VOID;
  }
}

export function typeToString(type: TypeRef): string {
  if (type.kind === 'error') return '<error>';
  if (type.kind === 'any') return 'any';
  if (type.kind === 'null') return 'null';
  if (type.kind === 'runtime-error') return 'RuntimeError';
  if (type.kind === 'function') {
    return `function(${type.parameters.map(typeToString).join(', ')}): ${typeToString(type.returnType)}`;
  }
  if (type.kind === 'array') {
    if (type.dynamic) return `dyn_array<${typeToString(type.elementType)}>`;
    return `array<${typeToString(type.elementType)}, ${type.size ?? '?'}>`;
  }
  if (type.kind === 'class') return type.name;
  if (type.kind === 'qualified') return `${type.moduleName}.${type.name}`;
  return type.name;
}

export function sameType(left: TypeRef, right: TypeRef): boolean {
  if (left.kind === 'error' || right.kind === 'error') return true;
  if (left.kind === 'any' || right.kind === 'any') return true;
  if (left.kind !== right.kind) return false;
  if (left.kind === 'null' && right.kind === 'null') return true;
  if (left.kind === 'runtime-error' && right.kind === 'runtime-error') return true;
  if (left.kind === 'function' && right.kind === 'function') {
    if (left.parameters.length !== right.parameters.length) return false;
    return left.parameters.every((param, index) => sameType(param, right.parameters[index]))
      && sameType(left.returnType, right.returnType);
  }
  if (left.kind === 'qualified' && right.kind === 'qualified') {
    return left.moduleName === right.moduleName && left.name === right.name;
  }
  if (left.kind === 'class' && right.kind === 'class') {
    return left.name === right.name;
  }
  if (left.kind === 'array' && right.kind === 'array') {
    return left.dynamic === right.dynamic
      && left.size === right.size
      && sameType(left.elementType, right.elementType);
  }
  return left.kind === 'primitive' && right.kind === 'primitive' && left.name === right.name;
}

export function isNumeric(type: TypeRef): boolean {
  return isIntegerLike(type) || isFloatLike(type);
}

export function isIntegerLike(type: TypeRef): boolean {
  if (type.kind === 'primitive') return type.name === 'int';
  return type.kind === 'qualified'
    && type.moduleName === 'types'
    && ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64'].includes(type.name);
}

export function isFloatLike(type: TypeRef): boolean {
  if (type.kind === 'primitive') return type.name === 'float';
  return type.kind === 'qualified'
    && type.moduleName === 'types'
    && (type.name === 'float32' || type.name === 'float64');
}

export function isTypesNumeric(type: TypeRef): boolean {
  return type.kind === 'qualified'
    && type.moduleName === 'types'
    && ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64', 'float32', 'float64'].includes(type.name);
}

export function isAssignable(target: TypeRef, value: TypeRef): boolean {
  if (target.kind === 'error' || value.kind === 'error') return true;
  if (target.kind === 'any' || value.kind === 'any') return true;
  if (sameType(target, value)) return true;
  if (isIntegerLike(target)) return isIntegerLike(value);
  if (isFloatLike(target)) return isNumeric(value);
  if (target.kind === 'array' && value.kind === 'array') {
    const sizeMatches = target.dynamic || value.dynamic || target.size === value.size;
    return sizeMatches && isAssignable(target.elementType, value.elementType);
  }
  return false;
}

export function numericBinaryResult(operator: string, left: TypeRef, right: TypeRef): TypeRef {
  if (!isNumeric(left) || !isNumeric(right)) return ERROR_TYPE;
  if (operator === '/') return FLOAT;
  return isFloatLike(left) || isFloatLike(right) ? FLOAT : INT;
}

export function qualified(moduleName: string, name: string): QualifiedType {
  return { kind: 'qualified', moduleName, name };
}

export function classType(name: string): ClassType {
  return { kind: 'class', name };
}

export function arrayType(elementType: TypeRef, size: number | null, dynamic: boolean): ArrayType {
  return { kind: 'array', elementType, size, dynamic };
}

export function functionType(parameters: readonly TypeRef[], returnType: TypeRef, minArguments?: number): FunctionType {
  return { kind: 'function', parameters, returnType, minArguments };
}
