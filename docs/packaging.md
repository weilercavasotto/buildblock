# Packaging as a desktop app

The game is a static site, so it can be wrapped as a native app with [Pake](https://github.com/tw93/Pake) (a CLI on top of Tauri: the system webview, about 6 MB, no Electron).

```bash
npm run package:mac   # builds dist/ and writes release/BuildBlock.dmg
```

- **Needs Rust** (`rustc` / `cargo`, from <https://rustup.rs>) and the Xcode command line tools on the PATH; the first run downloads `pake-cli` and compiles Tauri (a few minutes).
- It packages the **local build** (`dist/index.html`, `--use-local-file`, `--wasm` for Rapier), so the app works **offline**. `vite.config.ts` sets `base: './'` so the build can be loaded from a folder.
- The icon is `packaging/icon.png` (1024 px, rendered from `public/favicon.svg`); the app id is `com.weilercavasotto.buildblock` (it was `com.weilercavasotto.blocklab` when the project was called BlockLab: an app built with the new id is a different app to macOS, with its own saved data); the app version is the `package.json` one. `release/` is git-ignored.
- The app is **not notarized** (ad-hoc signed): the first time, open it with right click → Open. Notarizing needs an Apple developer account.
- Saves live in the app's own `localStorage` (the webview's), **separate from the browser**: games saved in the browser do not appear in the app, and there is no export / import yet (see the roadmap).
- For Windows / Linux run Pake on that system (`--targets` selects the format); it is not cross-compiled.

## Development app (follows the code)

```bash
npm run package:mac:dev   # writes release/"BuildBlock Dev.dmg"
```

It wraps `http://localhost:5173` instead of a build, so the native window shows whatever `npm run dev` serves, with hot reload: **start `npm run dev` first** (it shows nothing while the server is down). It has its own name and id (`com.weilercavasotto.buildblock.dev`), so it lives beside the distributable app, with its own saves. Install it once; it needs rebuilding only if the port or the icon changes.

## HTML build (zip for a static host)

```bash
npm run package:html   # builds dist/ and writes release/BuildBlock-<version>-html.zip
```

`packaging/package-html.mjs` zips the contents of `dist/` (plus a `README.txt`) with the system `zip`, so `index.html` is at the root of the archive: unzip it on any static host (or serve it locally, e.g. `python3 -m http.server`). It must be served over HTTP: opened from disk (`file://`) browsers block the ES module script. Saves live in that site's own `localStorage`. The zip sits next to the installers in `release/` (git-ignored).

## Cover image

`packaging/cover.png` (630 x 500) is the cover image: the stacked logo centred on the menu's dark panel colour (`COLORS.surface.panel`). Its source is `packaging/cover.html` (colour copied by hand); `npm run cover:sync` renders it again with headless Google Chrome, so rerun it when the logo or the colours change.

## itch.io page

`packaging/itch-description.html` is the description of the game for its itch.io page (the editor accepts HTML): paste it in the description field. Update it when a feature, control or the Discord link changes. The HTML build zip (`npm run package:html`) is what is uploaded there, with "This file will be played in the browser" ticked; the cover image is `packaging/cover.png`.
