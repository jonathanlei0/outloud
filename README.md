# OutLoud Chrome Extension

A Chrome extension that reads selected text aloud using the Web Speech API.

## Project Structure

This extension uses the "bundles-everywhere" layout with Vite:

```
outloud/
├── src/                     # Source TypeScript files
│   ├── background.ts        # Service worker (Manifest V3)
│   ├── content/
│   │   └── content.ts       # Content script injected into pages
│   └── popup/
│       ├── popup.html       # Popup interface
│       ├── popup.css        # Popup styles
│       └── popup.ts         # Popup functionality
├── public/                  # Static assets copied as-is
│   ├── manifest.json        # Extension manifest
│   └── icons/               # Extension icons (16, 32, 48, 128px)
├── dist/                    # Built output (Chrome loads this)
└── package.json             # Dependencies and build scripts
```

## Features

- 🔊 Read any selected text aloud
- ⚡ Keyboard shortcut: `Ctrl+Shift+S` (or `Cmd+Shift+S` on Mac)
- 🎛️ Adjustable speech settings (speed, pitch, volume)
- 🗣️ Multiple voice options
- 💾 Settings persistence

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the extension:
   ```bash
   npm run build
   ```

3. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

4. For development with auto-rebuild:
   ```bash
   npm run dev
   ```

## Usage

1. Select any text on a webpage
2. Either:
   - Click the extension icon and press "Speak Selected Text"
   - Use the keyboard shortcut `Ctrl+Shift+S` (or `Cmd+Shift+S`)
3. Adjust voice settings in the popup as needed
4. Use "Stop Speaking" to interrupt playback

## Technical Details

- **Manifest V3** service worker architecture
- **TypeScript** for type safety
- **Vite** for modern build tooling
- **Web Speech API** for text-to-speech
- **Chrome Storage API** for settings persistence

## Build Process

Vite transforms:
- `src/background.ts` → `dist/background.js`
- `src/content/content.ts` → `dist/content.js`
- `src/popup/popup.html` → `dist/popup.html` (with bundled CSS/JS)
- `public/*` → `dist/*` (copied as-is)

The `dist/` folder contains the final extension ready for Chrome.
