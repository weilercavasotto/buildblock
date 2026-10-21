# Packaging as a desktop app

The game is a static site, so it can be wrapped as a native app with [Pake](https://github.com/tw93/Pake) (a CLI on top of Tauri: the system webview, about 6 MB, no Electron).

```bash
npm run package:mac   # builds dist/ and writes release/BlockLab.dmg
```

- **Needs Rust** (`rustc` / `cargo`, from <https://rustup.rs>) and the Xcode command line tools on the PATH; the first run downloads `pake-cli` and compiles Tauri (a few minutes).
- It packages the **local build** (`dist/index.html`, `--use-local-file`, `--wasm` for Rapier), so the app works **offline**. `vite.config.ts` sets `base: './'` so the build can be loaded from a folder.
- The icon is `packaging/icon.png` (1024 px, rendered from `public/favicon.svg`); the app id is `com.weilercavasotto.blocklab`; the app version is the `package.json` one. `release/` is git-ignored.
- The app is **not notarized** (ad-hoc signed): the first time, open it with right click → Open. Notarizing needs an Apple developer account.
- Saves live in the app's own `localStorage` (the webview's), **separate from the browser**: games saved in the browser do not appear in the app, and there is no export / import yet (see the roadmap).
- For Windows / Linux run Pake on that system (`--targets` selects the format); it is not cross-compiled.

## Development app (follows the code)

```bash
npm run package:mac:dev   # writes release/"BlockLab Dev.dmg"
```

It wraps `http://localhost:5173` instead of a build, so the native window shows whatever `npm run dev` serves, with hot reload: **start `npm run dev` first** (it shows nothing while the server is down). It has its own name and id (`com.weilercavasotto.blocklab.dev`), so it lives beside the distributable app, with its own saves. Install it once; it needs rebuilding only if the port or the icon changes.
