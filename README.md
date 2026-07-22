# LastNote

LastNote is a native-backed background plugin for Supernote devices. It allows you to toggle back and forth between two notes (or documents) with **exactly 1 tap** directly from your note toolbar.

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

### Part 1: Pairing Your First Two Notes (Note A & Note B)

#### Step 1: Initialize Note A
1. Open **Note A**.
2. Tap the **LastNote icon** (two arrows) on the toolbar. *(The plugin saves Note A as your starting point).*

#### Step 2: Connect Note B
1. Manually open **Note B** (using your swipe-down Recents list, Files menu, or Sidebar).
2. Tap the **LastNote icon** on the toolbar. *(The plugin saves Note B as the return target and immediately jumps you back to Note A).*

#### Step 3: Toggle Back & Forth
- You are in **Note A**: Tap **LastNote** → Instantly opens **Note B**.
- You are in **Note B**: Tap **LastNote** → Instantly opens **Note A**.

---

### Part 2: Switching to a NEW Pair of Notes (Note C & Note D)

When you finish working with Note A & Note B and want to switch to a **new pair of notes** (Note C & Note D):

#### Step 1: Open Note C
- Manually open **Note C** (via Recents, Files, or Sidebar).

#### Step 2: Register Note C as the New Target
- Tap the **LastNote icon** once. *(The plugin jumps back to your old note once—and registers **Note C** as your new starting target).*

#### Step 3: Open Note D & Lock in the New Pair
- Manually open **Note D** (via Recents, Files, or Sidebar).
- Tap the **LastNote icon** once. *(The plugin sees Note C in memory, saves Note D as the return target, and jumps you back to **Note C**).*

#### Step 4: Toggle Your New Pair
- You are in **Note C**: Tap **LastNote** → Instantly opens **Note D**.
- You are in **Note D**: Tap **LastNote** → Instantly opens **Note C**.

Your old pairing is automatically overwritten, and your new pair (**Note C & Note D**) is now active!

---

### Part 3: Working with Documents (PDF / EPUB)

Supernote's native Note Editor (`.note`) displays the **LastNote** icon directly on the main toolbar. Supernote's Document Reader (`.pdf` / `.epub`) organizes plugin icons inside its overflow menu:

When in a PDF or EPUB document:
1. Tap the **Three Dots (...)** on the top menu bar.
2. Select **Plugins**.
3. Tap **LastNote** to execute the switch.

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
