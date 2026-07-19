import { compileIdyllium, IdylliumProject, runIdyllium, runIdylliumInBrowser } from '../src';

const fs: any = require('fs');
const path: any = require('path');

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const geometry = await runIdyllium(`
    use console;
    use drawable;

    bool function objects_touch(drawable.Drawable first, drawable.Drawable second) {
        return first.collides_with(second);
    }

    main() {
        drawable.Rectangle r1;
        r1.x = 300;
        r1.y = 200;
        r1.width = 100;
        r1.height = 50;
        console.writeln(r1.contains(370, 220));
        r1.rotate(90);
        console.writeln(r1.contains(370, 220));
        console.writeln(r1.origin_x, " ", r1.origin_y, " ", r1.rotation);

        drawable.Rectangle r2;
        r2.x = 300;
        r2.y = 200;
        r2.width = 100;
        r2.height = 50;
        r2.set_origin(50, 25);
        console.writeln(r2.contains(330, 200));
        r2.rotate(90);
        console.writeln(r2.contains(330, 200));

        drawable.Circle first;
        first.radius = 30;
        first.set_origin(30, 30);
        first.x = 100;
        first.y = 100;

        drawable.Circle second;
        second.radius = 20;
        second.set_origin(20, 20);
        second.x = 150;
        second.y = 100;
        console.writeln(objects_touch(first, second));

        drawable.Line line;
        line.x1 = 20;
        line.y1 = 30;
        line.x2 = 120;
        line.y2 = 30;
        line.thickness = 10;
        console.writeln(line.contains(70, 35));
        console.writeln(line.contains(70, 36));
    }
  `, {}, { file: 'main.idyl' });

  assert(geometry.success, geometry.runtimeError ?? geometry.compilation.diagnosticsText);
  assert(
    geometry.output === 'true\nfalse\n0 0 90\ntrue\nfalse\ntrue\ntrue\nfalse\n',
    `unexpected drawable geometry output: ${JSON.stringify(geometry.output)}`,
  );

  const fractionalCoordinates = await runIdyllium(`
    use console;
    use drawable;
    use math;

    main() {
        float angle = math.to_radians(45);

        drawable.Circle point;
        point.radius = 4;
        point.set_origin(4, 4);
        point.x = 100 + 50 * math.cos(angle);
        point.y = 100 + 50 * math.sin(angle);

        drawable.Rectangle box;
        box.x = 10.25;
        box.y = 20.5;

        drawable.Line line;
        line.x1 = 0.25;
        line.y1 = 0.5;
        line.x2 = 1.75;
        line.y2 = 2.25;

        drawable.Sprite sprite;
        sprite.x = 30.125;
        sprite.y = 40.875;

        drawable.Text label;
        label.x = 50.5;
        label.y = 60.25;

        console.writeln(point.x > 135.3 and point.x < 135.4);
        console.writeln(point.y > 135.3 and point.y < 135.4);
        console.writeln(box.x + line.x1 + sprite.x + label.x == 91.125);
    }
  `, {}, { file: 'main.idyl' });
  assert(
    fractionalCoordinates.success,
    fractionalCoordinates.runtimeError ?? fractionalCoordinates.compilation.diagnosticsText,
  );
  assert(
    fractionalCoordinates.output === 'true\ntrue\ntrue\n',
    `unexpected fractional coordinate output: ${JSON.stringify(fractionalCoordinates.output)}`,
  );

  const readonlyOrigin = compileIdyllium(`
    use drawable;
    main() {
        drawable.Rectangle box;
        box.origin_x = 20;
    }
  `, { file: 'main.idyl' });
  assert(!readonlyOrigin.success, 'origin_x assignment should fail');
  assert(
    readonlyOrigin.diagnosticsText.includes("property 'origin_x' is read-only"),
    `unexpected origin diagnostic: ${readonlyOrigin.diagnosticsText}`,
  );

  const sprite = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': `
        use console;
        use drawable;
        use image;

        main() {
            image.Static cat;
            cat.load_from_file("cat.png");

            drawable.Sprite picture;
            picture.set_image(cat);
            picture.x = 100;
            picture.y = 100;
            picture.set_origin(cat.width / 2, cat.height / 2);
            picture.set_scale(-1, 1);
            picture.rotate(15);

            console.writeln(picture.contains(100, 100));
        }
      `,
      '/workspace/cat.png': {
        content: '',
        bytes: new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'my_images/cat.png'))),
      },
    },
  });
  assert(sprite.success, sprite.runtimeError ?? sprite.compilation.diagnosticsText);
  assert(sprite.output === 'true\n', `unexpected Sprite geometry output: ${JSON.stringify(sprite.output)}`);

  const text = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': `
        use console;
        use drawable;
        use fonts;

        main() {
            fonts.Font lobster;
            lobster.load_from_file("Lobster-Regular.ttf");

            drawable.Text title;
            title.font = lobster;
            title.text = "Hello";
            title.font_size = 40;
            title.x = 100;
            title.y = 100;

            console.writeln(title.get_width() > 80.8 and title.get_width() < 81);
            console.writeln(title.get_height() == 40);

            drawable.Rectangle marker;
            marker.x = 170;
            marker.y = 120;
            marker.width = 20;
            marker.height = 20;

            console.writeln(title.contains(180.8, 139.9));
            console.writeln(title.contains(181, 120));
            console.writeln(title.collides_with(marker));

            title.rotate(90);
            console.writeln(title.collides_with(marker));
            console.writeln(title.contains(80, 140));
        }
      `,
      '/workspace/Lobster-Regular.ttf': {
        content: '',
        bytes: new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'spec/some_fonts/Lobster-Regular.ttf'))),
      },
    },
  });
  assert(text.success, text.runtimeError ?? text.compilation.diagnosticsText);
  assert(
    text.output === 'true\ntrue\ntrue\nfalse\ntrue\nfalse\ntrue\n',
    `unexpected Text geometry output: ${JSON.stringify(text.output)}`,
  );

  const textWithoutFont = await runIdyllium(`
    use console;
    use drawable;
    main() {
        drawable.Text title;
        title.text = "Hello";
        title.font_size = 20;
        console.writeln(title.contains(59.9, 19.9));
        console.writeln(title.contains(60.1, 10));
    }
  `, {}, { file: 'main.idyl' });
  assert(
    textWithoutFont.success,
    textWithoutFont.runtimeError ?? textWithoutFont.compilation.diagnosticsText,
  );
  assert(
    textWithoutFont.output === 'true\nfalse\n',
    `unexpected default Text geometry output: ${JSON.stringify(textWithoutFont.output)}`,
  );

  const manualRoot = path.join(process.cwd(), 'spec/some_origins/manual_tests');
  const manualExamples = fs.readdirSync(manualRoot)
    .filter((name: string) => name.endsWith('.idyl'))
    .sort();
  for (const name of manualExamples) {
    const file = path.join(manualRoot, name);
    const compilation = compileIdyllium(fs.readFileSync(file, 'utf8'), { file });
    assert(compilation.success, `expected ${name} to compile, got:\n${compilation.diagnosticsText}`);
  }
  assert(manualExamples.length === 8, `expected eight manual examples, got ${manualExamples.length}`);

  const completionSource = 'use drawable;\nmain() {\n  drawable.Rectangle box;\n  box.';
  const project = new IdylliumProject({
    entryFile: '/workspace/main.idyl',
    files: { '/workspace/main.idyl': completionSource },
  });
  const completions = project.completions({ file: '/workspace/main.idyl', offset: completionSource.length });
  for (const expected of ['origin_x', 'set_origin', 'rotate', 'contains', 'collides_with']) {
    assert(completions.some((item) => item.name === expected), `expected Rectangle.${expected} completion`);
  }

  const textCompletionSource = 'use drawable;\nmain() {\n  drawable.Text label;\n  label.';
  const textProject = new IdylliumProject({
    entryFile: '/workspace/main.idyl',
    files: { '/workspace/main.idyl': textCompletionSource },
  });
  const textCompletions = textProject.completions({
    file: '/workspace/main.idyl',
    offset: textCompletionSource.length,
  });
  for (const expected of ['get_width', 'get_height']) {
    assert(textCompletions.some((item) => item.name === expected), `expected Text.${expected} completion`);
  }

  console.log('drawable origin draft: runtime API, Sprite/Text geometry and 8 manual examples pass');
}

void main();
