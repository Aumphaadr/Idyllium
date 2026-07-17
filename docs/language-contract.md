# Language Contract

The syntax contract is taken from the existing Idyllium lessons. The new core should preserve the visible language behavior unless a syntax or semantic change is explicitly discussed first.

Initial preserved rules:

- `main() { ... }` is the simple entry point.
- `use console;` imports the console module.
- Statements end with `;`.
- `console.write(...)` writes exactly the passed values and does not append a newline.
- `int`, `float`, `string`, `char`, and `bool` are the first primitive types.
- Assigning `float` to `int` is a compile-time error.
- Assigning `int` to `float` is allowed.
- The `/` operator always returns `float`.
- Integer division is spelled `div(a, b)`.
- Remainder is spelled `mod(a, b)`.
- Colors are represented by the `colors.Color` value type.
- `colors.RGB`, `colors.RGBA`, `colors.HEX`, and `colors.HSL` create `colors.Color` values.
- GUI and future Canvas APIs should prefer explicit color properties such as `text_color`, `background_color`, and `border_color` over ambiguous `color`.
- Color properties accept only `colors.Color`; a HEX string must be converted explicitly with `colors.HEX()`.
- Project modules may contain top-level state and `void function ...` callbacks.
- Canvas callback names should use `snake_case`, for example `on_key_pressed` and `on_update`.
- Missing GUI/Canvas resources such as textures or fonts should become clear runtime errors.
- `while`, `do-while`, and `for` loops use the syntax shown in the lessons.
- `break` and `continue` are valid only inside loops.
- Functions use `return` for produced values; `void` functions may use bare `return;`.
- Identifiers may use Cyrillic letters, as in the functions lesson examples.

The project should prefer obvious rules over historical surprises, especially when children are the audience.
