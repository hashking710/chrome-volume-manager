# Volume Manager

A lightweight Chrome extension for adjusting the volume of the current tab without changing your system volume.

This project is a modernized fork of [piousdeer/chrome-volume-manager](https://github.com/piousdeer/chrome-volume-manager).

## Features

- Set tab volume from 0% to 600%, with fine-grained slider control.
- Jump to common levels with one-click presets.
- Mute and restore the previous non-zero level.
- See the current level on the extension badge.
- Keep the tab's audio playing while its volume is adjusted.
- No analytics, tracking, or runtime network requests.

## Build and install

Requirements: Node.js 20.19 or newer and Chrome 116 or newer.

```sh
npm ci
npm run typecheck
npm run build
```

Open `chrome://extensions/`, enable **Developer mode**, choose **Load unpacked**, and select the generated `dist` folder.

## Using the extension

Open the extension popup on the tab you want to control. Adjust the slider, choose a preset, or mute the tab. Tab audio is captured only when a volume change is made; closing the tab releases the audio stream.

Chrome restricts capture on certain pages, including internal browser pages and some protected media. The popup reports an error when the current tab cannot be controlled.

## Development

- `npm run typecheck` checks TypeScript and Chrome extension API types.
- `npm run build` creates the loadable Manifest V3 extension in `dist`.
