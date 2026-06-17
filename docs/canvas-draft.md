# Canvas Draft

Canvas is intended to live inside `gui` as a normal widget:

```cpp
use gui;

main() {
    gui.Window win;
    gui.Canvas canvas;

    win.add_child(canvas);
    win.show();
}
```

Scene objects live in a separate `drawable` module:

```cpp
use drawable;
use colors;

drawable.Rectangle rect;
rect.fill_color = colors.RGB(34, 145, 188);
```

The first draft object set is:

- `drawable.Rectangle`
- `drawable.Circle`
- `drawable.Sprite`
- `drawable.Texture`
- `drawable.Font`
- `drawable.Text`

The first draft event set is:

- `gui.KeyboardEvent`
- `gui.MouseEvent`
- `gui.MouseScrollEvent`

Callbacks are assigned to Canvas properties:

```cpp
canvas.on_init = my_scene.init_scene;
canvas.on_key_pressed = my_scene.on_key_pressed;
canvas.on_key_released = my_scene.on_key_released;
canvas.on_mouse_pressed = my_scene.on_mouse_pressed;
canvas.on_mouse_released = my_scene.on_mouse_released;
canvas.on_mouse_move = my_scene.on_mouse_move;
canvas.on_mouse_scroll = my_scene.on_mouse_scroll;
canvas.on_update = my_scene.on_update;
```

Open semantic decisions:

- `deltaTime` should be measured in seconds.
- Mouse coordinates should be relative to the Canvas.
- Missing texture/font files should raise clear runtime errors.

Future GUI topic:

- Add a `gui.Image` widget for showing pictures in widget layouts. Before implementation, decide how the widget should handle image/widget size mismatch: stretch, contain, cover, crop, align, or another explicit mode.
