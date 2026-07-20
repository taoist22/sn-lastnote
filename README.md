# LastNote

LastNote is a native-backed background plugin for Supernote devices. It allows you to toggle back and forth between two notes with  **two tap** directly from your note toolbar.

---

## Features

- **1-Tap Toggling**: Instantly jump between your active note and a referenced note or document.
- **Silent Background Execution**: Runs entirely in the background (`showType: 0`), meaning no UI overlays, panels, or slow closing transitions.
- **Multi-Format Support**: Switches seamlessly between `.note` notebooks, PDF documents, and EPUB files.

---

## Installation

1. Download the latest `LastNote.snplg` package from the [Releases](https://github.com/taoist22/sn-lastnote/releases) page.
2. Connect your Supernote to your computer via USB (or use the Partner App/Cloud).
3. Copy `LastNote.snplg` into the `MyStyle/` folder on your Supernote device's storage.
4. On your device, go to **Settings** → **Apps** → **Plugins** → **Add Plugin** and select `LastNote`.

---

## Usage Instructions

### First-Time Setup
1. Open **Note A** (your first note).
2. Tap the **LastNote icon** (two arrows) on the toolbar to register Note A as the toggle target.
3. Manually open **Note B** (your second note or document) via the Recents list, Files menu, or Sidebar.

### Ongoing Toggling
- While in **Note B**, tap the **LastNote icon** to switch instantly back to **Note A** (Note B is automatically saved as the next target).
- While in **Note A**, tap the **LastNote icon** to switch instantly back to **Note B**.

You can repeat this back and forth indefinitely. Each switch takes a single tap on the toolbar.

---

## Icon Attribution

The plugin icon is:
<a href="https://www.flaticon.com/free-icons/transfer" title="transfer icons">Transfer icons created by Ayub Irawan - Flaticon</a>

---

## Development

### Environment Setup
React Native is locked to `0.79.2` because it must match the Supernote `PluginHost` runtime. Building the plugin requires Java JDK 21 and the Android SDK (Platform 35).

### Standard Workflow
Run these standard checks during development:
```bash
npm install
npm run typecheck
npm run lint
npm run test:coverage
```

### Build & Package
To bundle the React Native JS code, compile the native Java modules (`app.npk`), and build the final `.snplg` package:
```bash
./buildPlugin.sh
```

The build script automatically applies a local Metro watchers patch to prevent `EMFILE: too many open files, watch` failures on one-shot bundle builds.

### Package Validation
After every build, run validation to verify native packages are correct:
```bash
npm run validate:package -- --native
```
This ensures the `app.npk` is successfully included in the final package.
