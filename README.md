

https://github.com/user-attachments/assets/e90a9384-5f76-4e33-bf4f-92c27a041cb7

# LastNote

LastNote is a native-backed plugin for Supernote devices. It adds a floating overlay toggle to your screen, allowing you to switch back and forth between two notes (or documents) with **1 tap**, even while working inside PDF or EPUB documents.

---

## Features

- **1-Tap Toggling**: Instantly jump between your active note and a paired note or document.
- **Floating Overlay Icon**: Placed on screen for effortless single-tap return without digging into sub-menus on PDF/EPUB documents.
- **Pair Configuration UI**: Tabbed selector lets you easily replace Note A or Note B individually with 1 tap.
- **Visual Folder Navigator**: Choose target notes or documents by navigating through your device's `Notes` and `Documents` directory hierarchy.
- **Clean State Management**: Turns off instantly when toggled via the toolbar button.
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

---

### 2. Positioning the Floating Icon
- **Drag & Move**: Touch and drag the floating icon using your **finger** to place it anywhere on your screen (pen input is ignored for moving/tapping the icon). It will retain its position during navigation.

---

### 3. Pairing Notes & Documents
1. **Long-press** the floating icon with your finger (for ~0.6 seconds). The **Pair Configuration** screen opens.
2. At the top of the screen, you will see your current pair: `[ NOTE A: ... ]` and `[ NOTE B: ... ]`.
3. **To update Note B (default)**: Simply navigate the folder browser below and tap any file. It updates Note B, saves the pair, and closes automatically (**1 tap**).
4. **To update Note A**: Tap the `[ NOTE A ]` tab at the top first, then navigate and tap any file below to update Note A.

---

### 4. Toggling Back & Forth
- **Single-tap** the floating icon with your finger anytime to switch back and forth between your paired Note A and Note B.
- Works across `.note` files, `.pdf` files, and `.epub` documents.

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
