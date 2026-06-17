# Frozen Lesson Spec

This directory is generated from the original Idyllium lessons:

```text
/home/nathaniel/IdylliumProjects/Idyllium/docs/lessons
```

It contains 352 code examples extracted from `<idyl-code-block>` elements.

The extractor uses the same visible-code normalization as the old docs web component:

```text
IdylCodeBlock visible code: raw.replace(/^\n/, '').replace(/\n\s*$/, '') with LF line endings
```

Do not manually edit generated examples that are listed in `manifest.json`.
Update the source lessons or rerun:

```text
npm run spec:extract
```

Manual draft lessons may live next to the generated tree only when they have a local
README and an explicit test. They are not part of the frozen legacy manifest until
they are promoted into the real documentation source.

`expectations.json` is a human-authored overlay for executable lesson checks.
It separates compile-time teaching errors, runtime teaching errors, valid examples,
and docs-only fragments that still need normalization into full programs.
