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
- `drawable.Line`
- `drawable.Sprite`
- `drawable.Text`

Fonts live in the shared `fonts` module. A `fonts.Font` can be assigned to both
GUI widgets and `drawable.Text`. Font resources are declared only through
`fonts.Font`.

Images live in the shared `image` module. Both `image.Static` and
`image.Animation` can be passed to `drawable.Sprite.set_image()`. The removed
`drawable.Texture` type must not be restored as a compatibility alias.

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

Frozen semantic decisions:

- `deltaTime` should be measured in seconds.
- Mouse coordinates should be relative to the Canvas.
- Missing image/font files should raise clear runtime errors.
- A completed `image.Static.load_from_file()` or
  `image.Animation.load_from_file()` call leaves the resource ready to draw;
  user code does not add sleeps to wait for browser decoding.

Shared GUI display:

- `gui.ImageBox` displays the same `image.Image` resources as Canvas sprites.
- `ImageBox.resize_mode` supports `fit`, `fill`, `stretch`, and `original`.
- `gui.Image` does not exist, including as a legacy alias.
