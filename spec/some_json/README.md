# JSON library design draft

This folder is a syntax/design sketch, not executable lesson coverage yet.
The current compiler does not implement `use json;`.

## Current architecture constraints

- Standard library functions and methods are registered by name; there is no overload set.
- `[]` indexing currently belongs to arrays and strings only.
- Dynamic object fields such as `profile.name` cannot be typed by the current registry.
- Standard library types can have inheritance, but there is no safe downcast syntax from `json.Value` to `json.Object`.
- `ANY_TYPE` exists and is useful internally, but a child-facing JSON API should avoid returning `any` where a clear `json.Value` can be returned.
- Runtime objects can expose `to_string()`, and `console.write(value)` already uses it when present.

## Recommended MVP

Use one main type:

- `json.Value`

Use module functions:

- `json.parse(text): json.Value`
- `json.read_file(path): json.Value`
- `json.create_object(): json.Value`
- `json.create_array(): json.Value`
- `json.from_int(value): json.Value`
- `json.from_float(value): json.Value`
- `json.from_string(value): json.Value`
- `json.from_bool(value): json.Value`

Use module constants:

- `json.NULL: json.Value`

Use explicit methods on `json.Value`:

- type checks: `is_null`, `is_bool`, `is_number`, `is_int`, `is_float`, `is_string`, `is_array`, `is_object`;
- scalar readers: `as_bool`, `as_int`, `as_float`, `as_string`;
- object readers: `has_key`, `keys`, `get`, `get_bool`, `get_int`, `get_float`, `get_string`;
- array readers: `length`, `at`, `at_bool`, `at_int`, `at_float`, `at_string`;
- object writers: `set`, `set_null`, `set_bool`, `set_int`, `set_float`, `set_string`, `remove`;
- array writers: `add`, `add_null`, `add_bool`, `add_int`, `add_float`, `add_string`, `set_at`, `remove_at`, `clear`;
- serialization: `to_string`, `to_pretty_string`, `write_file`, `write_pretty_file`.

This is the most viable first implementation because it needs no parser changes and no downcast mechanism.

## Later ideas

- `json.Object` and `json.Array` can be added later for stronger autocomplete, but only after deciding how children should obtain those types safely.
- `value["key"]` and `value[0]` look nice, but require extending indexing semantics beyond arrays and strings.
- A future dictionary type may change the best JSON design.
