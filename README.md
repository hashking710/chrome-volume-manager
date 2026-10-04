# Volume Manager

A small Chrome extension for setting the volume of the current tab independently of system volume.

This project is a modernized fork of [piousdeer/chrome-volume-manager](https://github.com/piousdeer/chrome-volume-manager).

## What it does

- Adjust tab volume from 0% to 600%.
- Use presets for common levels, or mute and restore the previous level.
- Show the current level on the extension badge.
- Keep audio playing through the tab while its volume is adjusted.
- Make no network requests and collect no analytics.

## Install from a release

1. Download `Volume-Manager-2.0.1.zip` from the [latest release](https://github.com/hashking710/chrome-volume-manager/releases).
2. Extract the ZIP to a folder.
3. Open `chrome://extensions/` and turn on **Developer mode**.
4. Select **Load unpacked** and choose the extracted folder.

Chrome does not allow extensions to control audio on some pages, including Chrome's internal pages and certain protected media. The popup reports an error if the current tab cannot be captured.

## Build from source

Requirements: Node.js 20.19 or newer and Chrome 116 or newer.

```sh
npm ci
npm test
npm run typecheck
npm run build
```

To load the local build, select the generated `dist` folder in `chrome://extensions/`.

## Development

- `npm test` runs focused tests for mute/restore state and rapid volume updates.
- `npm run typecheck` checks TypeScript against the Chrome extension API types.
- `npm run build` generates the loadable Manifest V3 extension in `dist`.

Tab audio is captured only after a volume change. Closing the tab releases its audio stream. The extension requests `activeTab` for user-invoked tab access, `tabCapture` to process tab audio, and `offscreen` to run the Web Audio processing outside the service worker.

## Release checklist

1. Update the version in `package.json` and `static/manifest.json` to the same value, then refresh `package-lock.json` with `npm install --package-lock-only`.
2. Run `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, and `npm audit`.
3. Commit and push the release changes.
4. Create a matching `v<version>` Git tag and GitHub release.
5. Attach a ZIP of the contents of `dist` as `Volume-Manager-<version>.zip`.
