# Сторонние компоненты и их лицензии

Idyllium распространяется по лицензии [MIT](LICENSE). Ниже перечислены сторонние
ресурсы, поставляемые вместе с проектом, и условия их использования. Все они
разрешают свободное использование, в том числе в образовательных организациях
и коммерческих продуктах.

## Шрифты

Все шрифты распространяются по лицензии **SIL Open Font License 1.1** —
свободной лицензии, разработанной специально для шрифтов. Она разрешает
использование, изучение, модификацию и распространение (в том числе в составе
программных продуктов) при сохранении файла лицензии.

| Шрифт | Автор / правообладатель | Файл лицензии |
|---|---|---|
| Geologica | Monotype (The Geologica Project Authors) | [packages/docs/fonts/Geologica-OFL.txt](packages/docs/fonts/Geologica-OFL.txt) |
| Source Code Pro | Adobe (Reserved Font Name «Source») | [packages/docs/fonts/SourceCodePro-LICENSE.txt](packages/docs/fonts/SourceCodePro-LICENSE.txt), [COPYRIGHT](packages/docs/fonts/SourceCodePro-COPYRIGHT.txt) |
| Lobster | Impallari Type (The Lobster Project Authors) | [packages/docs/fonts/Lobster-OFL.txt](packages/docs/fonts/Lobster-OFL.txt) |
| Comfortaa (раздатка) | Johan Aakerlund (The Comfortaa Project Authors) | [packages/docs/handouts/Comfortaa-OFL.txt](packages/docs/handouts/Comfortaa-OFL.txt) |
| Lora (раздатка) | Cyreal (The Lora Project Authors) | [packages/docs/handouts/Lora-OFL.txt](packages/docs/handouts/Lora-OFL.txt) |
| Black Ops One (раздатка) | James Grieshaber (The Black Ops One Project Authors) | [packages/docs/handouts/BlackOpsOne-OFL.txt](packages/docs/handouts/BlackOpsOne-OFL.txt) |
| Lobster (раздатка) | Impallari Type (The Lobster Project Authors) | [packages/docs/handouts/Lobster-OFL.txt](packages/docs/handouts/Lobster-OFL.txt) |

Копии шрифтов и лицензий также лежат рядом со своими потребителями:
`packages/gui-renderer/fonts/` (Source Code Pro для превью GUI) и
`tests/fixtures/fonts/` (Lobster для тестов шрифтовых метрик).

## Значки

Значки сайта, Web IDE, Конструктора GUI и виджета `gui.Icon` взяты из набора
[Klaarheid Icons](https://aumphaadr.github.io/Klaarheid-Icons/)
([репозиторий](https://github.com/Aumphaadr/Klaarheid-Icons)), который разработан автором Idyllium
и опубликован под лицензией **MIT-0**. Лицензия разрешает любое использование без условий и без
упоминания автора. В Idyllium входят 236 значков набора в варианте «контур заливкой»; они лежат
в `packages/icons/svg/`.

Сноска: рисунки 52 из этих значков совпадают с иконками набора [Lucide](https://lucide.dev) —
в основном это простые знаки (плюс, шевроны, стрелки, лупа), но есть и рисунки (папка, часы,
спасательный круг). На них действует и лицензия Lucide — ISC (части из Feather — MIT), её текст
ниже. Полный список совпадений набора — в его
[THIRD-PARTY-NOTICES.md](https://github.com/Aumphaadr/Klaarheid-Icons/blob/main/THIRD-PARTY-NOTICES.md);
значки Idyllium из этого списка:
`archive`, `arrow-down-to-line`, `arrow-left-right`, `arrow-up-down`, `ban`, `check`, `chevron-down`,
`chevron-left`, `chevron-right`, `chevron-up`, `circle-alert`, `circle-check`, `circle-info`,
`circle-minus`, `circle-plus`, `circle-question`, `circle-x`, `clipboard`, `clock`, `crosshair`,
`download`, `expand`, `eye`, `file`, `file-code`, `file-plus`, `file-x`, `folder`, `folder-down`,
`folder-plus`, `input`, `life-buoy`, `minus`, `monitor`, `move`, `music`, `panel-left`,
`panel-right`, `plus`, `redo`, `repeat`, `scan`, `search`, `share`, `sun`, `target`, `turtle`,
`undo`, `upload`, `x`, `zoom-in`, `zoom-out`.

```text
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The MIT License (MIT) (for portions derived from Feather)

Copyright (c) 2013-2023 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Кроме того, 16 значков совпадают с иконками набора [Tabler Icons](https://tabler.io/icons) (8 из них
совпадают и с Lucide); это тоже в основном простые знаки (плюс, шевроны, крестик), но есть и рисунки
(сердце, магнит). На них действует и лицензия Tabler Icons — MIT, её текст ниже:
`chevron-down`, `chevron-left`, `chevron-right`, `chevron-up`, `database`, `heart`, `magnet`, `menu`,
`minus`, `plus`, `stop`, `sun`, `textarea`, `toggle-off`, `toggle-on`, `x`.

```text
MIT License

Copyright (c) 2020-2025 Paweł Kuna

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Музыка

| Файл | Произведение | Автор | Лицензия |
|---|---|---|---|
| `packages/docs/book-assets/theme.mp3` | «Mesmerizing Galaxy» (файл переименован, содержимое без изменений) | Kevin MacLeod ([incompetech.com](https://incompetech.com/music/royalty-free/music.html)) | [Creative Commons: By Attribution 4.0](http://creativecommons.org/licenses/by/4.0/) |
| `packages/docs/handouts/Mesmerizing Galaxy.mp3` | «Mesmerizing Galaxy» (копия для раздатки) | Kevin MacLeod ([incompetech.com](https://incompetech.com/music/royalty-free/music.html)) | [Creative Commons: By Attribution 4.0](http://creativecommons.org/licenses/by/4.0/) |
| `packages/docs/handouts/Surf Shimmy.mp3` | «Surf Shimmy» | Kevin MacLeod ([incompetech.com](https://incompetech.com/music/royalty-free/music.html)) | [Creative Commons: By Attribution 4.0](http://creativecommons.org/licenses/by/4.0/) |
| `packages/docs/handouts/Rising.mp3` | «Rising» | Kevin MacLeod ([incompetech.com](https://incompetech.com/music/royalty-free/music.html)) | [Creative Commons: By Attribution 4.0](http://creativecommons.org/licenses/by/4.0/) |

Обязательная атрибуция в формате автора — по каждому произведению:

> "Mesmerizing Galaxy" Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0 License
> http://creativecommons.org/licenses/by/4.0/

> "Surf Shimmy" Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0 License
> http://creativecommons.org/licenses/by/4.0/

> "Rising" Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0 License
> http://creativecommons.org/licenses/by/4.0/

Та же атрибуция лежит рядом с треками в раздатке (`packages/docs/handouts/KevinMacLeod-CC-BY.txt`)
и открывается по ссылке «лицензия» у каждого из них на странице `/handouts/` — там, где файлы
скачивают ученики.

## Изображения и звуки учебника

Остальные ассеты учебника в `packages/docs/book-assets/` и тестовые фикстуры
(`player.png`, `cat.png`, `walk.gif`, `click.wav`,
`tests/fixtures/images/cat.png`) созданы для проекта Idyllium с использованием
генеративных инструментов и последующей ручной обработкой (GIMP, Kdenlive,
Audacity) и распространяются на условиях лицензии проекта (MIT).
Анимация `walk.gif` собрана из кадров программой, написанной на самом
Idyllium (`image.Animation.create_from_frames` + `export_to_file`).

## QR-коды: библиотека `qr` и «Поделиться»

Обе библиотеки входят в ядро языка (библиотека `qr`, с 1.6.2) и отдельными файлами лежат
в `vendor/` Web IDE для диалога «Поделиться» (грузятся только по требованию):

| Библиотека | Автор | Лицензия |
|---|---|---|
| qrcode-generator 2.0.4 — сборка QR-кода | Kazuhiko Arase | MIT (текст — в шапке `vendor/qrcode.js`) |
| jsQR 1.4.0 — чтение QR-кода с картинки | Cosmo Wolfe | Apache-2.0 (копия — `vendor/jsQR-LICENSE.txt`) |

«QR Code» — зарегистрированный товарный знак DENSO WAVE INCORPORATED.

## Прочее

Вместе с продуктом (ядро языка, Web IDE, сайт) распространяются свободные JavaScript-библиотеки
из раздела `dependencies` файла `package.json`; все лицензии разрешают использование в
образовательных и коммерческих продуктах:

| Библиотека | Зачем | Лицензия |
|---|---|---|
| Monaco Editor | редактор кода Web IDE и юнитов | MIT |
| sql.js | библиотека `sqlite` | MIT |
| fontkit | метрики шрифтов | MIT |
| pako | сжатие (ZIP, PNG, «проект в ссылке») | MIT и Zlib |
| upng-js, jpeg-js, gifenc, gifuct-js, webp-wasm | чтение и запись картинок библиотекой `image` | MIT; jpeg-js — BSD-3-Clause |
| Papa Parse | просмотр CSV в Web IDE | MIT |
| marked, DOMPurify | просмотр Markdown в Web IDE | MIT; DOMPurify — MPL-2.0 или Apache-2.0 |
| qrcode-generator, jsQR | см. раздел про QR-коды выше | MIT; jsQR — Apache-2.0 |

Средства разработки (TypeScript, esbuild и др.) перечислены в `devDependencies` и с продуктом
не распространяются.
