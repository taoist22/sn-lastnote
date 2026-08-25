https://github.com/user-attachments/assets/e90a9384-5f76-4e33-bf4f-92c27a041cb7

# LastNote (v0.5.1)

LastNote is a native-backed plugin for Supernote devices. It adds a floating overlay toggle to your screen, allowing you to switch back and forth between two notes, multiple preset documents, or specific pages within the same note (e.g. Page 2 and Page 23) with 1 tap, even while working inside PDF or EPUB documents.

---

## Key Features

- **Pair, Presets & Page Bookmarks Dashboard**: Manage note pairs, multi-preset document targets, and same-note page bookmarks in a single unified dashboard.
- **Same-Note Page Switching & Bookmarks**: Set multiple page targets (e.g., Page 2 and Page 23) for the same notebook. Switch back and forth between pages in 1 tap without leaving your note.
- **Native Open & Page Jump APIs**: Uses Supernote's supported `openFile` and `jumpToPage` APIs on current firmware, with the prior native opener retained as a compatibility fallback.
- **Horizontal Scrollable Page Strip**: Browse and jump to any page (`[p.1]`, `[p.2: Intro]`, `[p.15: Diagrams]`) with a horizontal touch strip attached under each note target.
- **Total Page Count Enforcement**: Auto-detects note length and displays `p.X / N` (e.g. `p.2 / 23`). Page steppers and selectors strictly enforce valid page bounds.
- **Table of Contents (TOC) Heading Auto-Detection**: Automatically reads note headings and displays title badges (`🏷️ Diagrams`). Tap **`+ TOC Headings`** to import all titled pages into your bookmarks in 1 tap.
- **1-Tap Toggling**: Instantly jump between active notes, paired notes, or bookmarked pages.
- **Page Locking Stepper (`-5` `<` `p.X` `>` `+5`)**: Lock any document to a specific page number. Use `-5`/`+5` or `<`/`>` steppers to set any page number in seconds.
- **Breadcrumb Navigation Bar**: Interactive path trail (`Root > Note > ProjectA > Specs`) attached directly inside the FOLDERS card lets you jump directly back from deep subfolders in 1 tap.
- **SD Card & Full Storage Access**: Automatically detects mounted SD cards (`SD Card (...)`) and lists all top-level storage directories (`Notes`, `Documents`, `MyStyle`, `EXPORT`, `IMPORT`, etc.).
- **Native Quick-Jump Popup (3+ Targets)**: When 3 or more preset targets are active, single-tapping the floating icon opens an instant native E-Ink popup menu right next to the icon for 1-tap jumping.
- **8mm Line-Height Floating Overlay**: Dynamically calculated for screen DPI (Nomad A6X2 & Manta A5X2) to fit cleanly within standard 8mm ruled lines.
- **Favorite Files & Folders**: Star your most important notebooks, PDFs, and working directories for instant 1-tap access.
- **Automatic MyStyle Storage Backup**: Configuration automatically backs up to `/storage/emulated/0/MyStyle/LastNote/`, preserving all your favorites, presets, page-locks, and pairs across plugin uninstalls and updates.
- **Optimized E-Ink UI**: High-contrast typography, large black star indicators, and bold container cards designed specifically for Supernote greyscale screens.
- **Multi-Format Support**: Switches among `.note`, `.pdf`, `.epub`, `.cbz`, `.xps`, and `.fb2` files supported by Supernote's file API.

---

## Installation & First-Time Setup

### 1. Installation
1. Download `LastNote.snplg` from the Releases page.
2. Connect your Supernote to your computer via USB (or use the Partner App/Cloud).
3. Copy `LastNote.snplg` into the `MyStyle/` folder on your Supernote device's storage.
4. On your device, go to **Settings** -> **Apps** -> **Plugins** -> **Add Plugin** and select `LastNote`.
5. When LastNote first browses or saves targets, allow the requested file access. Read access is used to browse and open files; write access is used only for LastNote settings and its `MyStyle/LastNote` backup.

---

### 2. First-Time Setup Guide
Once installed, setting up your first pair takes just a few seconds:

1. **Activate the Toolbar Button**:
   - Open any note or document on your Supernote.
   - Tap the **LastNote icon** on your note/document toolbar. The floating toggle icon will appear on screen.

2. **Position the Floating Overlay**:
   - Touch and drag the floating circle with your **finger** to place it anywhere on screen (e.g. parked on an empty margin or aligned between two 8mm ruled lines).

3. **Open the Pair & Presets Dashboard**:
   - **Long-press** the floating icon with your finger (for ~0.6 seconds). The **Pair & Presets Dashboard** window will open.

4. **Select Your Target Documents & SD Cards**:
   - **From Favorites or Recents**: Star your favorite folders/files or pick from recently opened directories.
   - **From FOLDERS Section**: Browse internal storage directories or mounted **SD Cards** and tap any `.note`, `.pdf`, or `.epub` file. It will be added to your **Active Targets** list.

5. **Set Page Locking (Optional)**:
   - Next to each active target document, tap **`[ Last Page ]`** to toggle it to **`[ Locked ]`**.
   - Use the **`-5`**, **`<`**, **`>`**, **`+5`** stepper buttons to adjust the target page number (e.g. Page 5 or Page 15).

6. **Save & Start Toggling**:
   - Tap **`Done`** (in black at top right) to save your configuration.

---

## How Toggling Works

- **Mode 1: Single Pair (2 Documents)**
  - Single-tapping the floating bubble with your finger **instantly toggles back and forth** between Document 1 and Document 2.
- **Mode 2: Multi-Preset List (3+ Documents)**
  - Single-tapping the floating bubble opens an **Instant Native E-Ink Popup Menu** right at the icon, listing all your preset documents with their locked page badges (e.g., `ProjectNotes (p.5)`). Tap any document in the popup to jump to it in **1 tap**.

---

## Backup & Automatic Data Recovery

All your settings (favorites, presets, pairs, and locked page numbers) are automatically mirrored to:

`/storage/emulated/0/MyStyle/LastNote/`

- **Uninstalling/Updating Plugins**: If you remove the plugin or update to a new `.snplg` version, `LastNote` automatically reads from `MyStyle/LastNote/` on startup and **restores all your favorites and targets automatically**.

---

## Icon Attribution

The plugin icon is:
<a href="https://www.flaticon.com/free-icons/transfer" title="transfer icons">Transfer icons created by Ayub Irawan - Flaticon</a>

---

## Development

### Environment Setup
React Native is locked to `0.79.2` because it must match the Supernote `PluginHost` runtime. Building the plugin requires Java JDK 21 and the Android SDK (Platform 35).

LastNote targets use one-based page numbers in the UI and stored settings. The official Supernote `openFile` and `jumpToPage` APIs use zero-based page indices, so navigation converts at the API boundary. Native TOC title results are also converted from zero-based pages before display.

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
