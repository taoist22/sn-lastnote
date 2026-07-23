# LastNote

LastNote is a native-backed plugin for Supernote devices. It adds a floating overlay toggle to your screen, allowing you to switch back and forth between two notes (or documents) with **1 tap**, even while working inside PDF or EPUB documents.

---

## Features

- **1-Tap Toggling**: Instantly jump between your active note and a paired note or document.
- **Floating Overlay Icon**: Placed on screen for effortless single-tap return without digging into sub-menus on PDF/EPUB documents.
- **Visual Folder Navigator**: Easily choose your target note or document by navigating through your device's `Notes` and `Documents` directory hierarchy.
- **Clean State Management**: Turns off instantly when disabled in Supernote settings or toggled via the toolbar button.
- **Multi-Format Support**: Switches seamlessly between `.note` notebooks, PDF documents, and EPUB files.

---

## Installation

1. Download the latest `LastNote.snplg` package from the [Releases](https://github.com/taoist22/sn-lastnote/releases) page.
2. Connect your Supernote to your computer via USB (or use the Partner App/Cloud).
3. Copy `LastNote.snplg` into the `MyStyle/` folder on your Supernote device's storage.
4. On your device, go to **Settings** → **Apps** → **Plugins** → **Add Plugin** and select `LastNote`.

---

## Usage Instructions

### 1. Activating / Deactivating the Floating Icon
- **Turn On**: Tap the **LastNote icon** on your note/document toolbar. The floating toggle icon will appear on screen.
- **Turn Off**: Tap the **LastNote icon** on your toolbar again while active to dismiss the floating icon.
- **Disable Plugin**: Disabling or uninstalling the plugin in Supernote Settings removes the floating icon from your screen immediately.

---

### 2. Positioning the Floating Icon
- **Drag & Move**: Touch and drag the floating icon to place it anywhere on your screen. It will retain its position during navigation.
- **Pen Input Pass-through**: EMR stylus inputs on the floating icon pass cleanly through to your note canvas so you can draw/write near or over it without accidental triggers.

---

### 3. Pairing Notes & Documents
1. Open the first note or document on your Supernote.
2. Ensure the floating toggle icon is visible on screen (activate via toolbar if needed).
3. **Long-press** the floating icon (for ~0.6 seconds). A folder browser will appear showing your `Notes` and `Documents` folders.
4. Navigate to and tap the second note or document you wish to pair with.
5. The view closes automatically and your note pairing is saved!

---

### 4. Toggling Back & Forth
- **Single-tap** the floating icon anytime to switch back and forth between your paired notes/documents.
- Works in `.note` files, `.pdf` files, and `.epub` documents.

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

### Package Validation
After every build, run validation to verify native packages are correct:
```bash
npm run validate:package -- --native
```
This ensures `app.npk` is successfully included in the final package.
