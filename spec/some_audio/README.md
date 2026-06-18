# Audio Library Concept Draft

Этот файл не является принятой спецификацией. Это черновик для будущего
обсуждения библиотеки звука в Idyllium.

## Базовая идея

```idyl
use audio;

main() {
    audio.Sound click;
    click.load_from_file("click.wav");
    click.volume = 0.8;
    click.play();
}
```

`audio.Sound` подходит для коротких звуков: клики, прыжки, удары, сбор предметов.

## Фоновая музыка

Пока не решено, нужен ли отдельный класс `audio.Music`, или достаточно одного
`audio.Sound` со свойством `loop`.

Вариант с отдельным классом:

```idyl
use audio;

main() {
    audio.Music music;
    music.load_from_file("theme.ogg");
    music.volume = 0.4;
    music.loop = true;
    music.play();
}
```

Вариант без отдельного класса:

```idyl
use audio;

main() {
    audio.Sound music;
    music.load_from_file("theme.ogg");
    music.volume = 0.4;
    music.loop = true;
    music.play();
}
```

## Возможные методы и свойства

```text
load_from_file(path)
play()
pause()
stop()

volume: float      // 0.0-1.0
loop: bool
is_playing: bool
```

## Вопросы

- Должен ли `play()` всегда запускать звук с начала?
- Нужен ли метод `play_once()` для коротких эффектов?
- Может ли один `audio.Sound` звучать несколько раз одновременно?
- Какие форматы считаем учебно-поддерживаемыми: `wav`, `mp3`, `ogg`?
- Как должна выглядеть ошибка, если файл звука отсутствует или не поддерживается?
- Как звук должен работать в Web IDE, VSIX GUI preview и будущей упаковке проекта?
