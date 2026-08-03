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

## Музыка

| Файл | Произведение | Автор | Лицензия |
|---|---|---|---|
| `packages/docs/book-assets/theme.mp3` | «Mesmerizing Galaxy» (файл переименован, содержимое без изменений) | Kevin MacLeod ([incompetech.com](https://incompetech.com/music/royalty-free/music.html)) | [Creative Commons: By Attribution 4.0](http://creativecommons.org/licenses/by/4.0/) |
| `packages/docs/handouts/Mesmerizing Galaxy.mp3` | «Mesmerizing Galaxy» (копия для раздатки) | Kevin MacLeod ([incompetech.com](https://incompetech.com/music/royalty-free/music.html)) | [Creative Commons: By Attribution 4.0](http://creativecommons.org/licenses/by/4.0/) |
| `packages/docs/handouts/Surf Shimmy.mp3` | «Surf Shimmy» | Kevin MacLeod ([incompetech.com](https://incompetech.com/music/royalty-free/music.html)) | [Creative Commons: By Attribution 4.0](http://creativecommons.org/licenses/by/4.0/) |
| `packages/docs/handouts/Rising.mp3` | «Rising» | Kevin MacLeod ([incompetech.com](https://incompetech.com/music/royalty-free/music.html)) | [Creative Commons: By Attribution 4.0](http://creativecommons.org/licenses/by/4.0/) |

Обязательная атрибуция в формате автора:

> "Mesmerizing Galaxy" Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0 License
> http://creativecommons.org/licenses/by/4.0/

## Изображения и звуки учебника

Остальные ассеты учебника в `packages/docs/book-assets/` и тестовые фикстуры
(`player.png`, `cat.png`, `walk.gif`, `click.wav`,
`tests/fixtures/images/cat.png`) созданы для проекта Idyllium с использованием
генеративных инструментов и последующей ручной обработкой (GIMP, Kdenlive,
Audacity) и распространяются на условиях лицензии проекта (MIT).
Анимация `walk.gif` собрана из кадров программой, написанной на самом
Idyllium (`image.Animation.create_from_frames` + `export_to_file`).

## Прочее

Проект не бандлит сторонние JavaScript-библиотеки в рантайм языка; средства
разработки (TypeScript и др.) перечислены в `package.json` и не
распространяются с продуктом.
