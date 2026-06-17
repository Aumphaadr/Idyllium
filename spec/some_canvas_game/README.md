# Canvas Game Draft

This folder is a hand-written draft specification for a child-friendly Canvas workflow.

The intended structure is:

- `main.idyl` creates `gui.Window`, creates `gui.Canvas`, and connects event callbacks.
- `my_cvs.idyl` owns scene state and game logic.
- `drawable` provides objects that can be passed to `canvas.draw(...)`.
- `colors.Color` is the shared color value type for GUI and Canvas.

Design decisions captured here:

- Callback function names use `snake_case`.
- Drawable text uses `.text`, not `.string`.
- Random values use the existing module style, for example `random.create_int(...)`.
- Resource loading failures such as missing textures or fonts should raise a clear runtime error.
