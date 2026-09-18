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

/** Словарь map<K, V>: ключ — тип с полным точным встроенным равенством
 *  (int, string, char, bool), значение — любой тип. Значение-коллекция,
 *  как массивы: копия при присваивании и передаче. */
export interface MapType {
  readonly kind: 'map';
  readonly keyType: TypeRef;
  readonly valueType: TypeRef;
}

/** Множество set<T>: элементы — те же типы, что ключи словаря. */
export interface SetType {
  readonly kind: 'set';
  readonly elementType: TypeRef;
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

export type TypeRef = PrimitiveType | QualifiedType | ClassType | ArrayType | MapType | SetType | FunctionType | AnyType | NullType | RuntimeErrorValueType | ErrorType;

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
/** Комплексное число — верхняя ступень числовой лестницы int → float → math.Complex. */
export const MATH_COMPLEX: QualifiedType = { kind: 'qualified', moduleName: 'math', name: 'Complex' };

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
  if (type.kind === 'map') return `map<${typeToString(type.keyType)}, ${typeToString(type.valueType)}>`;
  if (type.kind === 'set') return `set<${typeToString(type.elementType)}>`;
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
  if (left.kind === 'map' && right.kind === 'map') {
    return sameType(left.keyType, right.keyType) && sameType(left.valueType, right.valueType);
  }
  if (left.kind === 'set' && right.kind === 'set') {
    return sameType(left.elementType, right.elementType);
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
  // Вложение ℝ ⊂ ℂ: вещественное число — это комплексное с нулевой мнимой частью,
  // так же как целое — частный случай дробного. Обратного хода нет.
  if (isComplex(target)) return isNumeric(value);
  if (target.kind === 'array' && value.kind === 'array') {
    const sizeMatches = target.dynamic || value.dynamic || target.size === value.size;
    return sizeMatches && isAssignable(target.elementType, value.elementType);
  }
  if (target.kind === 'map' && value.kind === 'map') {
    return sameType(target.keyType, value.keyType) && isAssignable(target.valueType, value.valueType);
  }
  if (target.kind === 'set' && value.kind === 'set') {
    return sameType(target.elementType, value.elementType);
  }
  // Пустые `{}` типизируются как map<any, any> и подходят и множеству.
  if (target.kind === 'set' && isEmptyBracesType(value)) return true;
  return false;
}

export function isEmptyBracesType(type: TypeRef): boolean {
  return type.kind === 'map' && type.keyType.kind === 'any' && type.valueType.kind === 'any';
}

/** math.Complex — НЕ isNumeric: там, где ждут float (math.sqrt, индексы, сравнения порядка), ему не место. */
export function isComplex(type: TypeRef): boolean {
  return type.kind === 'qualified' && type.moduleName === 'math' && type.name === 'Complex';
}

export function numericBinaryResult(operator: string, left: TypeRef, right: TypeRef): TypeRef {
  // Комплексный операнд поднимает до себя числового соседа: 2 * z, z + 1, z / w.
  if ((isComplex(left) || isComplex(right)) && ['+', '-', '*', '/'].includes(operator)) {
    const bothFit = (isComplex(left) || isNumeric(left)) && (isComplex(right) || isNumeric(right));
    return bothFit ? MATH_COMPLEX : ERROR_TYPE;
  }
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

export function mapType(keyType: TypeRef, valueType: TypeRef): MapType {
  return { kind: 'map', keyType, valueType };
}

export function setType(elementType: TypeRef): SetType {
  return { kind: 'set', elementType };
}

export const MAP_KEY_TYPE_NAMES: readonly PrimitiveTypeName[] = ['int', 'string', 'char', 'bool'];

/** Ключом словаря может быть тип, чьё равенство полное, точное и встроенное:
 *  float исключён навсегда (сам язык предупреждает о `float ==`), объекты
 *  классов — пока нет хеш-контракта, библиотечные значения и коллекции — нет. */
export function isMapKeyType(type: TypeRef): boolean {
  if (type.kind === 'error' || type.kind === 'any') return true;
  return type.kind === 'primitive' && MAP_KEY_TYPE_NAMES.includes(type.name);
}

export function functionType(parameters: readonly TypeRef[], returnType: TypeRef, minArguments?: number): FunctionType {
  return { kind: 'function', parameters, returnType, minArguments };
}
