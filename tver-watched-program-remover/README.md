# TVer Watched Program Remover

Hide watched episodes on TVer's My Page favorites (`https://tver.jp/mypage/fav`).

This repository contains:
- A Chrome extension (Manifest V3)
- A Tampermonkey userscript
- Shared logic used by both implementations

## Files

- `watched-core.js`: Shared DOM query and watched-item visibility logic
- `main.js`: Chrome content script entry point
- `background.js`: Chrome action toggle and state persistence
- `manifest.json`: Chrome extension manifest
- `userscript.meta.js`: Tampermonkey metadata header
- `userscript.entry.js`: Tampermonkey runtime entry point
- `tver-watched-program-remover.user.js`: Generated userscript bundle
- `Makefile`: Build commands for userscript and release zip

## Chrome Extension

Load unpacked in Chrome:
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select this project directory

## Tampermonkey

Build the userscript:

```sh
make userscript
```

Then import `tver-watched-program-remover.user.js` into Tampermonkey.

## Build Release Zip (Chrome Web Store)

```sh
make dist
```

This generates:
- `dist/tver-watched-program-remover-v<version>.zip`

Only extension-required files are included in the zip.

## Clean Build Artifacts

```sh
make clean
```

## Versioning

Keep Chrome and userscript versions aligned:
- `manifest.json` -> `version`
- `userscript.meta.js` -> `@version`

Regenerate userscript after metadata changes:

```sh
make userscript
```
