# Colors

`colors` is the shared color module for GUI and future Canvas APIs.

The main type is:

```cpp
colors.Color
```

Color values can be created in several ways:

```cpp
use colors;

main() {
    colors.Color a = colors.RGB(34, 145, 188);
    colors.Color b = colors.RGBA(34, 145, 188, 0.5);
    colors.Color c = colors.HEX("#2291bc");
    colors.Color d = colors.HSL(197, 69, 44);
}
```

The intended GUI naming style is explicit:

```cpp
button.text_color = colors.WHITE;
button.background_color = colors.RGB(27, 31, 44);
button.border_color = colors.RGB(54, 62, 88);
```

The old `widget.color = "#FF0000";` style should be treated as a legacy shortcut, not as the primary teaching style.
