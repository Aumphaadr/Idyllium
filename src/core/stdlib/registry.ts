import { ANY_TYPE, BOOL, CHAR, COLOR, FLOAT, INT, QualifiedType, STRING, TypeRef, VOID, arrayType, qualified, typeToString } from '../types';

export interface ParameterSpec {
  readonly name: string;
  readonly type: TypeRef;
  readonly acceptedTypes?: readonly TypeRef[];
  readonly acceptedDescription?: string;
}

export interface FunctionSpec {
  readonly name: string;
  readonly parameters: readonly ParameterSpec[];
  readonly returnType: TypeRef;
  readonly minArguments?: number;
  readonly variadic?: boolean;
  readonly variadicTypes?: readonly TypeRef[];
  readonly documentation?: string;
  readonly runtimeName?: string;
}

export interface ConstantSpec {
  readonly name: string;
  readonly type: TypeRef;
  readonly documentation?: string;
}

export interface PropertySpec {
  readonly name: string;
  readonly type: TypeRef;
  readonly readonly?: boolean;
  readonly documentation?: string;
  readonly callbacks?: readonly CallbackSpec[];
}

export interface CallbackSpec {
  readonly parameters: readonly TypeRef[];
  readonly returnType: TypeRef;
}

export interface TypeSpec {
  readonly name: string;
  readonly baseType?: QualifiedType;
  readonly properties: ReadonlyMap<string, PropertySpec>;
  readonly methods: ReadonlyMap<string, FunctionSpec>;
}

export interface ModuleSpec {
  readonly name: string;
  readonly functions: ReadonlyMap<string, FunctionSpec>;
  readonly constants: ReadonlyMap<string, ConstantSpec>;
  readonly types: ReadonlyMap<string, TypeSpec>;
}

export interface CompletionItem {
  readonly name: string;
  readonly kind: 'module' | 'function' | 'constant' | 'type' | 'property' | 'method';
  readonly detail: string;
}

export class StandardLibraryRegistry {
  private readonly modules = new Map<string, ModuleSpec>();
  private readonly globals = new Map<string, FunctionSpec>();

  registerModule(module: ModuleSpec): void {
    this.modules.set(module.name, module);
  }

  registerGlobalFunction(spec: FunctionSpec): void {
    this.globals.set(spec.name, spec);
  }

  hasModule(name: string): boolean {
    return this.modules.has(name);
  }

  getModule(name: string): ModuleSpec | undefined {
    return this.modules.get(name);
  }

  getModuleFunction(moduleName: string, functionName: string): FunctionSpec | undefined {
    return this.modules.get(moduleName)?.functions.get(functionName);
  }

  hasQualifiedType(moduleName: string, typeName: string): boolean {
    return this.modules.get(moduleName)?.types.has(typeName) ?? false;
  }

  getQualifiedType(moduleName: string, typeName: string): TypeSpec | undefined {
    return this.modules.get(moduleName)?.types.get(typeName);
  }

  getTypeProperty(type: TypeRef, propertyName: string): PropertySpec | undefined {
    if (type.kind !== 'qualified') return undefined;
    return this.findTypeProperty(type, propertyName, new Set());
  }

  getTypeMethod(type: TypeRef, methodName: string): FunctionSpec | undefined {
    if (type.kind !== 'qualified') return undefined;
    return this.findTypeMethod(type, methodName, new Set());
  }

  listTypeMembers(type: TypeRef): CompletionItem[] {
    if (type.kind !== 'qualified') return [];
    const members = new Map<string, CompletionItem>();
    this.collectTypeMembers(type, members, new Set());
    return [...members.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  typeExtends(child: TypeRef, parent: TypeRef): boolean {
    if (child.kind !== 'qualified' || parent.kind !== 'qualified') return false;
    return this.qualifiedTypeExtends(child, parent, new Set());
  }

  getGlobalFunction(name: string): FunctionSpec | undefined {
    return this.globals.get(name);
  }

  listModules(): CompletionItem[] {
    return [...this.modules.values()].map((module) => ({
      name: module.name,
      kind: 'module',
      detail: `module ${module.name}`,
    }));
  }

  listModuleMembers(moduleName: string): CompletionItem[] {
    const module = this.modules.get(moduleName);
    if (!module) return [];

    const functions = [...module.functions.values()].map((fn) => ({
      name: fn.name,
      kind: 'function' as const,
      detail: signatureDetail(fn),
    }));
    const constants = [...module.constants.values()].map((constant) => ({
      name: constant.name,
      kind: 'constant' as const,
      detail: `${constant.name}: ${typeToString(constant.type)}`,
    }));
    const types = [...module.types.values()].map((typeSpec) => ({
      name: typeSpec.name,
      kind: 'type' as const,
      detail: `type ${moduleName}.${typeSpec.name}`,
    }));

    return [...types, ...constants, ...functions].sort((left, right) => left.name.localeCompare(right.name));
  }

  private findTypeProperty(type: QualifiedType, propertyName: string, seen: Set<string>): PropertySpec | undefined {
    const typeSpec = this.getQualifiedType(type.moduleName, type.name);
    if (!typeSpec) return undefined;
    const own = typeSpec.properties.get(propertyName);
    if (own) return own;
    if (!typeSpec.baseType) return undefined;

    const key = qualifiedTypeKey(typeSpec.baseType);
    if (seen.has(key)) return undefined;
    seen.add(key);
    return this.findTypeProperty(typeSpec.baseType, propertyName, seen);
  }

  private findTypeMethod(type: QualifiedType, methodName: string, seen: Set<string>): FunctionSpec | undefined {
    const typeSpec = this.getQualifiedType(type.moduleName, type.name);
    if (!typeSpec) return undefined;
    const own = typeSpec.methods.get(methodName);
    if (own) return own;
    if (!typeSpec.baseType) return undefined;

    const key = qualifiedTypeKey(typeSpec.baseType);
    if (seen.has(key)) return undefined;
    seen.add(key);
    return this.findTypeMethod(typeSpec.baseType, methodName, seen);
  }

  private qualifiedTypeExtends(child: QualifiedType, parent: QualifiedType, seen: Set<string>): boolean {
    const typeSpec = this.getQualifiedType(child.moduleName, child.name);
    if (!typeSpec?.baseType) return false;
    const base = typeSpec.baseType;
    if (base.moduleName === parent.moduleName && base.name === parent.name) return true;

    const key = qualifiedTypeKey(base);
    if (seen.has(key)) return false;
    seen.add(key);
    return this.qualifiedTypeExtends(base, parent, seen);
  }

  private collectTypeMembers(type: QualifiedType, members: Map<string, CompletionItem>, seen: Set<string>): void {
    const key = qualifiedTypeKey(type);
    if (seen.has(key)) return;
    seen.add(key);

    const typeSpec = this.getQualifiedType(type.moduleName, type.name);
    if (!typeSpec) return;

    if (typeSpec.baseType) {
      this.collectTypeMembers(typeSpec.baseType, members, seen);
    }

    for (const property of typeSpec.properties.values()) {
      members.set(property.name, {
        name: property.name,
        kind: 'property',
        detail: `${property.name}: ${typeToString(property.type)}`,
      });
    }

    for (const method of typeSpec.methods.values()) {
      members.set(method.name, {
        name: method.name,
        kind: 'method',
        detail: signatureDetail(method),
      });
    }
  }
}

export function createDefaultStandardLibrary(): StandardLibraryRegistry {
  const registry = new StandardLibraryRegistry();
  const guiWidget = qualified('gui', 'Widget');
  const guiCanvas = qualified('gui', 'Canvas');
  const guiLabel = qualified('gui', 'Label');
  const guiButton = qualified('gui', 'Button');
  const guiFrame = qualified('gui', 'Frame');
  const guiLineEdit = qualified('gui', 'LineEdit');
  const guiTextEdit = qualified('gui', 'TextEdit');
  const guiProgressBar = qualified('gui', 'ProgressBar');
  const guiSpinBox = qualified('gui', 'SpinBox');
  const guiFloatSpinBox = qualified('gui', 'FloatSpinBox');
  const guiSlider = qualified('gui', 'Slider');
  const guiCheckBox = qualified('gui', 'CheckBox');
  const guiRadioButton = qualified('gui', 'RadioButton');
  const guiComboBox = qualified('gui', 'ComboBox');
  const guiModal = qualified('gui', 'Modal');
  const guiTimer = qualified('gui', 'Timer');
  const guiKeyboardEvent = qualified('gui', 'KeyboardEvent');
  const guiMouseEvent = qualified('gui', 'MouseEvent');
  const guiMouseScrollEvent = qualified('gui', 'MouseScrollEvent');
  const guiChildParameter: ParameterSpec = {
    name: 'child',
    type: guiWidget,
    acceptedTypes: [guiWidget],
    acceptedDescription: 'gui widget',
  };
  const drawableMoveMethod = functionSpec('move', [
    { name: 'dx', type: FLOAT },
    { name: 'dy', type: FLOAT },
  ], VOID);

  const positioned = [
    propertySpec('x', INT),
    propertySpec('y', INT),
    propertySpec('width', INT),
    propertySpec('height', INT),
  ];
  const visible = [
    propertySpec('visible', BOOL),
  ];
  const changeable = [
    propertySpec('on_change', ANY_TYPE),
  ];
  const inheritableColorRoles = [
    propertySpec('text_color', COLOR),
    propertySpec('background_color', COLOR),
  ];
  const colorRoles = [
    ...inheritableColorRoles,
    propertySpec('border_color', COLOR),
  ];
  const buttonClickable = [
    callbackPropertySpec('on_click', [
      callbackSpec([]),
      callbackSpec([guiButton]),
    ]),
  ];
  const drawableDrawable = qualified('drawable', 'Drawable');
  const timeStamp = qualified('time', 'stamp');
  const fileIStream = qualified('file', 'istream');
  const fileOStream = qualified('file', 'ostream');
  const jsonValue = qualified('json', 'Value');
  const jsonObject = qualified('json', 'Object');
  const jsonArray = qualified('json', 'Array');
  const audioMusic = qualified('audio', 'Music');

  registry.registerModule(moduleSpec('console', [
    functionSpec('write', [], VOID, {
      variadic: true,
      variadicTypes: [ANY_TYPE],
      documentation: 'Writes values exactly as passed, without automatic spaces or line breaks.',
    }),
    functionSpec('writeln', [], VOID, {
      variadic: true,
      variadicTypes: [ANY_TYPE],
      documentation: 'Writes values and then writes a line break.',
    }),
    functionSpec('clear', [], VOID, {
      documentation: 'Clears the console output.',
    }),
    functionSpec('get_int', [], INT),
    functionSpec('get_float', [], FLOAT),
    functionSpec('get_string', [], STRING),
    functionSpec('set_precision', [{ name: 'digits', type: INT }], VOID),
  ]));

  registry.registerModule(moduleSpec('math', [
    functionSpec('abs', [{ name: 'value', type: FLOAT }], FLOAT),
    functionSpec('sqrt', [{ name: 'value', type: FLOAT }], FLOAT),
    functionSpec('round', [{ name: 'value', type: FLOAT }], INT),
    functionSpec('floor', [{ name: 'value', type: FLOAT }], INT),
    functionSpec('ceil', [{ name: 'value', type: FLOAT }], INT),
    functionSpec('pow', [{ name: 'value', type: FLOAT }, { name: 'power', type: FLOAT }], FLOAT),
    functionSpec('clamp', [
      { name: 'min', type: FLOAT },
      { name: 'value', type: FLOAT },
      { name: 'max', type: FLOAT },
    ], FLOAT),
    functionSpec('sin', [{ name: 'radians', type: FLOAT }], FLOAT),
    functionSpec('cos', [{ name: 'radians', type: FLOAT }], FLOAT),
    functionSpec('tan', [{ name: 'radians', type: FLOAT }], FLOAT),
    functionSpec('asin', [{ name: 'value', type: FLOAT }], FLOAT),
    functionSpec('acos', [{ name: 'value', type: FLOAT }], FLOAT),
    functionSpec('log', [{ name: 'value', type: FLOAT }], FLOAT),
    functionSpec('log10', [{ name: 'value', type: FLOAT }], FLOAT),
    functionSpec('to_radians', [{ name: 'degrees', type: FLOAT }], FLOAT),
    functionSpec('to_degrees', [{ name: 'radians', type: FLOAT }], FLOAT),
  ], [
    { name: 'pi', type: FLOAT, documentation: 'Pi constant.' },
    { name: 'e', type: FLOAT, documentation: 'Euler number.' },
  ]));

  registry.registerModule(moduleSpec('random', [
    functionSpec('create_int', [{ name: 'min', type: INT }, { name: 'max', type: INT }], INT),
    functionSpec('create_float', [{ name: 'min', type: FLOAT }, { name: 'max', type: FLOAT }], FLOAT),
    functionSpec('set_seed', [{ name: 'seed', type: INT }], VOID),
  ]));

  registry.registerModule(moduleSpec('time', [
    functionSpec('sleep', [{ name: 'seconds', type: FLOAT }], VOID),
    functionSpec('now', [], timeStamp),
    functionSpec('from_unix', [{ name: 'seconds', type: INT }], timeStamp),
  ], [], [
    typeSpec('stamp', [], [
      functionSpec('year', [], INT),
      functionSpec('month', [], INT),
      functionSpec('day', [], INT),
      functionSpec('hour', [], INT),
      functionSpec('minute', [], INT),
      functionSpec('second', [], INT),
      functionSpec('week_day', [], INT),
      functionSpec('unix', [], INT),
      functionSpec('to_string', [], STRING),
    ]),
  ]));

  registry.registerModule(moduleSpec('file', [
    functionSpec('exists', [{ name: 'path', type: STRING }], BOOL),
    functionSpec('open', [
      { name: 'path', type: STRING },
      { name: 'mode', type: STRING },
    ], ANY_TYPE),
  ], [], [
    typeSpec('istream', [], [
      functionSpec('read_line', [], STRING),
      functionSpec('read_all', [], STRING),
      functionSpec('has_next_line', [], BOOL),
      functionSpec('close', [], VOID),
    ]),
    typeSpec('ostream', [], [
      functionSpec('write_line', [], VOID, {
        variadic: true,
        variadicTypes: [ANY_TYPE],
      }),
      functionSpec('close', [], VOID),
    ]),
  ]));

  registry.registerModule(moduleSpec('encoding', [
    functionSpec('list_encodings', [], arrayType(STRING, null, true)),
    functionSpec('char_to_int', [
      { name: 'character', type: CHAR },
      { name: 'encoding', type: STRING },
    ], INT),
    functionSpec('int_to_char', [
      { name: 'code', type: INT },
      { name: 'encoding', type: STRING },
    ], CHAR),
    functionSpec('encode', [
      { name: 'text', type: STRING },
      { name: 'encoding', type: STRING },
    ], arrayType(INT, null, true)),
    functionSpec('decode', [
      { name: 'codes', type: arrayType(INT, null, true) },
      { name: 'encoding', type: STRING },
    ], STRING),
  ]));

  registry.registerModule(moduleSpec('json', [
    functionSpec('is_valid', [{ name: 'text', type: STRING }], BOOL),
    functionSpec('parse', [{ name: 'text', type: STRING }], jsonValue),
    functionSpec('Value', [{ name: 'value', type: ANY_TYPE }], jsonValue, {
      minArguments: 0,
      documentation: 'Creates a JSON value. Without arguments creates JSON null.',
    }),
  ], [
    { name: 'NULL', type: jsonValue },
  ], [
    typeSpec('Value', [], [
      functionSpec('is_null', [], BOOL),
      functionSpec('is_string', [], BOOL),
      functionSpec('is_int', [], BOOL),
      functionSpec('is_float', [], BOOL),
      functionSpec('is_bool', [], BOOL),
      functionSpec('is_object', [], BOOL),
      functionSpec('is_array', [], BOOL),
      functionSpec('to_string', [], STRING),
      functionSpec('to_int', [], INT),
      functionSpec('to_float', [], FLOAT),
      functionSpec('to_bool', [], BOOL),
      functionSpec('to_object', [], jsonObject),
      functionSpec('to_array', [], jsonArray),
      functionSpec('set_null', [], VOID),
      functionSpec('set_string', [{ name: 'value', type: STRING }], VOID),
      functionSpec('set_int', [{ name: 'value', type: INT }], VOID),
      functionSpec('set_float', [{ name: 'value', type: FLOAT }], VOID),
      functionSpec('set_bool', [{ name: 'value', type: BOOL }], VOID),
      functionSpec('set_object', [{ name: 'value', type: jsonObject }], VOID),
      functionSpec('set_array', [{ name: 'value', type: jsonArray }], VOID),
      functionSpec('to_json', [], STRING),
      functionSpec('to_pretty_json', [{ name: 'indent', type: INT }], STRING, {
        minArguments: 0,
      }),
    ]),
    typeSpec('Object', [], [
      functionSpec('length', [], INT),
      functionSpec('has', [{ name: 'key', type: STRING }], BOOL),
      functionSpec('get', [{ name: 'key', type: STRING }], jsonValue),
      functionSpec('add', [{ name: 'key', type: STRING }, { name: 'value', type: jsonValue }], VOID),
      functionSpec('set', [{ name: 'key', type: STRING }, { name: 'value', type: jsonValue }], VOID),
      functionSpec('remove', [{ name: 'key', type: STRING }], VOID),
      functionSpec('keys', [], arrayType(STRING, null, true)),
    ], jsonValue),
    typeSpec('Array', [], [
      functionSpec('length', [], INT),
      functionSpec('at', [{ name: 'index', type: INT }], jsonValue),
      functionSpec('set', [{ name: 'index', type: INT }, { name: 'value', type: jsonValue }], VOID),
      functionSpec('add', [{ name: 'value', type: jsonValue }], VOID),
      functionSpec('insert', [{ name: 'index', type: INT }, { name: 'value', type: jsonValue }], VOID),
      functionSpec('pop', [], jsonValue),
      functionSpec('remove', [{ name: 'index', type: INT }], VOID),
      functionSpec('clear', [], VOID),
    ], jsonValue),
  ]));

  registry.registerModule(moduleSpec('audio', [], [], [
    typeSpec('Sound', [
      propertySpec('src', STRING, true),
      propertySpec('duration', FLOAT, true),
      propertySpec('volume', FLOAT),
      propertySpec('is_playing', BOOL, true),
    ], [
      functionSpec('load_from_file', [{ name: 'path', type: STRING }], VOID, {
        documentation: 'Loads an audio file or raises a clear runtime error if loading fails.',
      }),
      functionSpec('play', [], VOID),
      functionSpec('pause', [], VOID),
      functionSpec('resume', [], VOID),
      functionSpec('stop', [], VOID),
    ]),
    typeSpec('Music', [
      propertySpec('src', STRING, true),
      propertySpec('duration', FLOAT, true),
      propertySpec('position', FLOAT),
      propertySpec('volume', FLOAT),
      propertySpec('loop', BOOL),
      propertySpec('is_playing', BOOL, true),
      callbackPropertySpec('on_finished', [
        callbackSpec([]),
        callbackSpec([audioMusic]),
      ]),
    ], [
      functionSpec('load_from_file', [{ name: 'path', type: STRING }], VOID, {
        documentation: 'Loads an audio file or raises a clear runtime error if loading fails.',
      }),
      functionSpec('play', [], VOID),
      functionSpec('pause', [], VOID),
      functionSpec('resume', [], VOID),
      functionSpec('stop', [], VOID),
    ]),
  ]));

  const drawableTexture = qualified('drawable', 'Texture');
  const drawableFont = qualified('drawable', 'Font');

  registry.registerModule(moduleSpec('gui', [], [], [
    typeSpec('Window', [
      ...positioned,
      ...inheritableColorRoles,
      propertySpec('title', STRING),
    ], [
      functionSpec('add_child', [guiChildParameter], VOID),
      functionSpec('show', [], VOID),
    ]),
    typeSpec('Widget', [
      ...positioned,
      ...visible,
      ...inheritableColorRoles,
    ]),
    typeSpec('Canvas', [
      ...positioned,
      ...visible,
      propertySpec('framerate_limit', INT),
      callbackPropertySpec('on_init', [callbackSpec([guiCanvas])]),
      callbackPropertySpec('on_key_pressed', [callbackSpec([guiCanvas, guiKeyboardEvent])]),
      callbackPropertySpec('on_key_released', [callbackSpec([guiCanvas, guiKeyboardEvent])]),
      callbackPropertySpec('on_mouse_pressed', [callbackSpec([guiCanvas, guiMouseEvent])]),
      callbackPropertySpec('on_mouse_released', [callbackSpec([guiCanvas, guiMouseEvent])]),
      callbackPropertySpec('on_mouse_move', [callbackSpec([guiCanvas, guiMouseEvent])]),
      callbackPropertySpec('on_mouse_scroll', [callbackSpec([guiCanvas, guiMouseScrollEvent])]),
      callbackPropertySpec('on_update', [callbackSpec([guiCanvas, FLOAT])]),
    ], [
      functionSpec('clear', [], VOID),
      functionSpec('fill', [{ name: 'color', type: COLOR }], VOID),
      functionSpec('draw', [{
        name: 'object',
        type: drawableDrawable,
        acceptedTypes: [drawableDrawable],
        acceptedDescription: 'drawable object',
      }], VOID),
    ], guiWidget),
    typeSpec('Label', [
      ...positioned,
      ...visible,
      ...colorRoles,
      callbackPropertySpec('on_click', [
        callbackSpec([]),
        callbackSpec([guiLabel]),
      ]),
      propertySpec('text', STRING),
      propertySpec('font_size', INT),
      propertySpec('color', STRING, false, 'Legacy text color shortcut. Prefer text_color with colors.Color.'),
    ], [], guiWidget),
    typeSpec('Button', [
      ...positioned,
      ...visible,
      ...colorRoles,
      ...buttonClickable,
      propertySpec('text', STRING),
    ], [], guiWidget),
    typeSpec('Frame', [
      ...positioned,
      ...visible,
      propertySpec('background_color', COLOR),
      propertySpec('border_color', COLOR),
      propertySpec('border_width', INT),
      propertySpec('title', STRING),
    ], [
      functionSpec('add_child', [guiChildParameter], VOID),
    ], guiWidget),
    typeSpec('Image', [
      ...positioned,
      ...visible,
      propertySpec('resize_mode', STRING),
    ], [
      functionSpec('load_from_file', [{ name: 'path', type: STRING }], VOID, {
        documentation: 'Loads an image file into the widget or raises a clear runtime error if loading fails.',
      }),
    ], guiWidget),
    typeSpec('LineEdit', [
      ...positioned,
      ...visible,
      ...changeable,
      ...colorRoles,
      propertySpec('text', STRING),
      propertySpec('placeholder', STRING),
      propertySpec('font_size', INT),
      propertySpec('echo_mode', STRING),
    ], [], guiWidget),
    typeSpec('TextEdit', [
      ...positioned,
      ...visible,
      ...colorRoles,
      propertySpec('text', STRING),
      propertySpec('placeholder', STRING),
    ], [], guiWidget),
    typeSpec('ProgressBar', [
      ...positioned,
      ...visible,
      propertySpec('value', INT),
      propertySpec('min', INT),
      propertySpec('max', INT),
      propertySpec('text_color', COLOR),
      propertySpec('background_color', COLOR),
      propertySpec('foreground_color', COLOR),
      propertySpec('fill_color', COLOR),
      propertySpec('border_color', COLOR),
    ], [], guiWidget),
    typeSpec('SpinBox', [
      ...positioned,
      ...visible,
      ...changeable,
      propertySpec('value', INT),
      propertySpec('min', INT),
      propertySpec('max', INT),
      propertySpec('step', INT),
    ], [], guiWidget),
    typeSpec('FloatSpinBox', [
      ...positioned,
      ...visible,
      ...changeable,
      propertySpec('value', FLOAT),
      propertySpec('min', FLOAT),
      propertySpec('max', FLOAT),
      propertySpec('step', FLOAT),
    ], [], guiWidget),
    typeSpec('Slider', [
      ...positioned,
      ...visible,
      ...changeable,
      propertySpec('value', INT),
      propertySpec('min', INT),
      propertySpec('max', INT),
      propertySpec('step', INT),
    ], [], guiWidget),
    typeSpec('CheckBox', [
      ...positioned,
      ...visible,
      ...changeable,
      propertySpec('text', STRING),
      propertySpec('is_checked', BOOL),
    ], [], guiWidget),
    typeSpec('RadioButton', [
      ...positioned,
      ...visible,
      ...changeable,
      propertySpec('text', STRING),
      propertySpec('is_selected', BOOL),
      propertySpec('group', STRING),
    ], [], guiWidget),
    typeSpec('ComboBox', [
      ...positioned,
      ...visible,
      ...changeable,
      propertySpec('selected_index', INT),
      propertySpec('selected_text', STRING),
    ], [
      functionSpec('add_item', [{ name: 'text', type: STRING }], VOID),
      functionSpec('clear_items', [], VOID),
    ], guiWidget),
    typeSpec('Modal', [
      propertySpec('title', STRING),
      propertySpec('message', STRING),
      propertySpec('confirm_text', STRING),
      propertySpec('cancel_text', STRING),
      callbackPropertySpec('on_confirm', [
        callbackSpec([]),
        callbackSpec([guiModal]),
      ]),
      callbackPropertySpec('on_cancel', [
        callbackSpec([]),
        callbackSpec([guiModal]),
      ]),
    ], [
      functionSpec('show_alert', [], VOID),
      functionSpec('show_confirm', [], VOID),
      functionSpec('show_input', [], VOID),
      functionSpec('get_input_value', [], STRING),
    ]),
    typeSpec('Timer', [
      propertySpec('interval', INT),
      callbackPropertySpec('on_tick', [
        callbackSpec([]),
        callbackSpec([guiTimer]),
      ]),
    ], [
      functionSpec('start', [], VOID),
      functionSpec('stop', [], VOID),
    ]),
    typeSpec('KeyboardEvent', [
      propertySpec('key', STRING, true),
    ]),
    typeSpec('MouseEvent', [
      propertySpec('x', INT, true),
      propertySpec('y', INT, true),
      propertySpec('mouse_button', STRING, true),
    ]),
    typeSpec('MouseScrollEvent', [
      propertySpec('x', INT, true),
      propertySpec('y', INT, true),
      propertySpec('delta', INT, true),
    ]),
  ]));

  registry.registerModule(moduleSpec('drawable', [], [], [
    typeSpec('Drawable'),
    typeSpec('Rectangle', [
      propertySpec('x', INT),
      propertySpec('y', INT),
      propertySpec('width', INT),
      propertySpec('height', INT),
      propertySpec('rotation', FLOAT),
      propertySpec('fill_color', COLOR),
      propertySpec('border_width', INT),
      propertySpec('border_color', COLOR),
    ], [
      drawableMoveMethod,
      functionSpec('rotate', [{ name: 'angle', type: FLOAT }], VOID),
    ], drawableDrawable),
    typeSpec('Circle', [
      propertySpec('x', INT),
      propertySpec('y', INT),
      propertySpec('radius', INT),
      propertySpec('rotation', FLOAT),
      propertySpec('fill_color', COLOR),
      propertySpec('border_width', INT),
      propertySpec('border_color', COLOR),
    ], [
      drawableMoveMethod,
      functionSpec('rotate', [{ name: 'angle', type: FLOAT }], VOID),
    ], drawableDrawable),
    typeSpec('Line', [
      propertySpec('x1', INT),
      propertySpec('y1', INT),
      propertySpec('x2', INT),
      propertySpec('y2', INT),
      propertySpec('color', COLOR),
      propertySpec('thickness', INT),
    ], [
      drawableMoveMethod,
    ], drawableDrawable),
    typeSpec('Sprite', [
      propertySpec('texture', drawableTexture),
      propertySpec('x', INT),
      propertySpec('y', INT),
    ], [
      functionSpec('set_scale', [{ name: 'x', type: FLOAT }, { name: 'y', type: FLOAT }], VOID),
      drawableMoveMethod,
    ], drawableDrawable),
    typeSpec('Texture', [], [
      functionSpec('load_from_file', [{ name: 'path', type: STRING }], VOID, {
        documentation: 'Loads an image file or raises a clear runtime error if loading fails.',
      }),
    ]),
    typeSpec('Font', [], [
      functionSpec('load_from_file', [{ name: 'path', type: STRING }], VOID, {
        documentation: 'Loads a font file or raises a clear runtime error if loading fails.',
      }),
    ]),
    typeSpec('Text', [
      propertySpec('font', drawableFont),
      propertySpec('text', STRING),
      propertySpec('x', INT),
      propertySpec('y', INT),
      propertySpec('font_size', INT),
      propertySpec('text_color', COLOR),
    ], [
      drawableMoveMethod,
    ], drawableDrawable),
  ]));

  registry.registerModule(moduleSpec('colors', [
    functionSpec('RGB', [
      { name: 'red', type: INT },
      { name: 'green', type: INT },
      { name: 'blue', type: INT },
    ], COLOR, {
      documentation: 'Creates an opaque color from red, green, and blue channels in the 0..255 range.',
    }),
    functionSpec('RGBA', [
      { name: 'red', type: INT },
      { name: 'green', type: INT },
      { name: 'blue', type: INT },
      { name: 'alpha', type: FLOAT },
    ], COLOR, {
      documentation: 'Creates a color from red, green, blue, and alpha channels. Alpha is in the 0.0..1.0 range.',
    }),
    functionSpec('HEX', [
      { name: 'value', type: STRING },
    ], COLOR, {
      documentation: 'Creates a color from a CSS-style #RRGGBB or #RRGGBBAA string.',
    }),
    functionSpec('HSL', [
      { name: 'hue', type: INT },
      { name: 'saturation', type: INT },
      { name: 'lightness', type: INT },
    ], COLOR, {
      documentation: 'Creates a color from hue, saturation, and lightness. Saturation and lightness are percentages.',
    }),
  ], [
    { name: 'BLACK', type: COLOR },
    { name: 'WHITE', type: COLOR },
    { name: 'RED', type: COLOR },
    { name: 'GREEN', type: COLOR },
    { name: 'BLUE', type: COLOR },
    { name: 'TRANSPARENT', type: COLOR },
  ], [typeSpec('Color')]));

  const typesNumericMethods = [
    functionSpec('to_bin', [], STRING),
    functionSpec('to_hex', [], STRING),
  ];
  registry.registerModule(moduleSpec('types', [
    functionSpec('from_bin', [
      { name: 'bits', type: STRING },
      { name: 'type_name', type: STRING },
    ], ANY_TYPE),
    functionSpec('from_hex', [
      { name: 'hex', type: STRING },
      { name: 'type_name', type: STRING },
    ], ANY_TYPE),
  ], [], [
    typeSpec('int8', [], typesNumericMethods),
    typeSpec('uint8', [], typesNumericMethods),
    typeSpec('int16', [], typesNumericMethods),
    typeSpec('uint16', [], typesNumericMethods),
    typeSpec('int32', [], typesNumericMethods),
    typeSpec('uint32', [], typesNumericMethods),
    typeSpec('float32', [], typesNumericMethods),
    typeSpec('float64', [], typesNumericMethods),
  ]));

  registry.registerGlobalFunction(functionSpec('div', [
    { name: 'left', type: INT },
    { name: 'right', type: INT },
  ], INT));
  registry.registerGlobalFunction(functionSpec('mod', [
    { name: 'left', type: INT },
    { name: 'right', type: INT },
  ], INT));
  registry.registerGlobalFunction(functionSpec('to_int', [
    {
      name: 'value',
      type: ANY_TYPE,
      acceptedTypes: [STRING, FLOAT, INT],
      acceptedDescription: 'string or numeric value',
    },
  ], INT));
  registry.registerGlobalFunction(functionSpec('to_float', [
    {
      name: 'value',
      type: ANY_TYPE,
      acceptedTypes: [STRING, FLOAT, INT],
      acceptedDescription: 'string or numeric value',
    },
  ], FLOAT));
  registry.registerGlobalFunction(functionSpec('to_string', [
    { name: 'value', type: ANY_TYPE },
  ], STRING));

  return registry;
}

function moduleSpec(
  name: string,
  functions: readonly FunctionSpec[],
  constants: readonly ConstantSpec[] = [],
  types: readonly TypeSpec[] = [],
): ModuleSpec {
  return {
    name,
    functions: new Map(functions.map((fn) => [fn.name, fn])),
    constants: new Map(constants.map((constant) => [constant.name, constant])),
    types: new Map(types.map((type) => [type.name, type])),
  };
}

function functionSpec(
  name: string,
  parameters: readonly ParameterSpec[],
  returnType: TypeRef,
  extras: Omit<FunctionSpec, 'name' | 'parameters' | 'returnType'> = {},
): FunctionSpec {
  return {
    name,
    parameters,
    returnType,
    ...extras,
  };
}

function signatureDetail(fn: FunctionSpec): string {
  const minArguments = fn.minArguments ?? fn.parameters.length;
  const params = fn.parameters.map((param, index) => {
    const text = `${param.name}: ${typeName(param.type)}`;
    return index >= minArguments ? `[${text}]` : text;
  });
  const suffix = fn.variadic ? (params.length > 0 ? ', ...values' : '...values') : '';
  return `${fn.name}(${params.join(', ')}${suffix}): ${typeName(fn.returnType)}`;
}

function typeName(type: TypeRef): string {
  return typeToString(type);
}

function propertySpec(
  name: string,
  type: TypeRef,
  readonly = false,
  documentation?: string,
  callbacks?: readonly CallbackSpec[],
): PropertySpec {
  return { name, type, readonly, documentation, callbacks };
}

function callbackPropertySpec(
  name: string,
  callbacks: readonly CallbackSpec[],
  documentation?: string,
): PropertySpec {
  return propertySpec(name, ANY_TYPE, false, documentation, callbacks);
}

function callbackSpec(parameters: readonly TypeRef[], returnType: TypeRef = VOID): CallbackSpec {
  return { parameters, returnType };
}

function typeSpec(
  name: string,
  properties: readonly PropertySpec[] = [],
  methods: readonly FunctionSpec[] = [],
  baseType?: QualifiedType,
): TypeSpec {
  return {
    name,
    baseType,
    properties: new Map(properties.map((property) => [property.name, property])),
    methods: new Map(methods.map((method) => [method.name, method])),
  };
}

function qualifiedTypeKey(type: QualifiedType): string {
  return `${type.moduleName}.${type.name}`;
}
