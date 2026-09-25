https://github.com/user-attachments/assets/e90a9384-5f76-4e33-bf4f-92c27a041cb7

# LastNote (v0.7.0)

LastNote is a native-backed plugin for Supernote devices. It adds a floating overlay toggle to your screen, allowing you to switch back and forth between two notes, multiple preset documents, or specific pages within the same note (e.g. Page 2 and Page 23) with 1 tap, even while working inside PDF or EPUB documents.

---

## New in v0.7.0: Send Link

Lasso a few words, tap the floating button with your finger, and pick a bookmarked
note page. That page opens, you tap where the link goes, and LastNote brings you
back. Your lassoed words (handwriting or typed text) become the link's label.
Without a lasso, the floating button toggles exactly as before.

See [Send Link](#send-link) below for setup.

## New in v0.6.5

Optional floating-button settings now remember its screen position and restore it
when LastNote loads. Restoration is tied to plugin loading, so there is a slight delay before the floating icon appears.

See [Floating Button Settings](#floating-button-settings) below for setup.

## Duplicate Bookmark Fix (v0.6.1)

Saving now rejects duplicate file/page destinations. Existing duplicate destinations
are shown once in the dashboard and floating menu, keeping the first bookmark.
The next successful bookmark save writes the deduplicated list to storage.

## Key Features

- **Send Link**: Lasso a few words, tap the floating button with your finger, and pick a bookmarked note page. That page opens, you tap where the link goes, and LastNote brings you back. The lassoed words become the link's label. See [Send Link](#send-link).
- **Bookmarks Dashboard**: Manage note pairs, multi-preset document targets, and same-note page bookmarks in a single unified dashboard.
- **Same-Note Page Switching & Bookmarks**: Set multiple page targets (e.g., Page 2 and Page 23) for the same notebook. Switch back and forth between pages in 1 tap without leaving your note.
- **Native Open & Page Jump APIs**: Uses Supernote's supported `openFile` and `jumpToPage` APIs on current firmware, with the prior native opener retained as a compatibility fallback.
- **Page Picker & Heading Search**: Expand Edit for a compact two-column editor. Save the optional name and page together with Save changes; Choose from headings reveals heading search. Navigate using the floating toggle menu.
- **Total Page Count Enforcement**: Auto-detects note length and displays `p.X / N` (e.g. `p.2 / 23`). Page controls enforce known note bounds. Page counts may be unavailable for other document formats.
- **Table of Contents (TOC) Heading Auto-Detection**: Automatically reads note headings and displays title badges (`🏷️ Diagrams`). Tap **Edit → Choose from headings → Import TOC headings** to import all titled pages into your bookmarks in 1 tap.
- **1-Tap Toggling**: Instantly jump between active notes, paired notes, or bookmarked pages.
- **Page Selection**: Enter a page number in Edit, or select Use last viewed page, then tap Save changes.
- **Breadcrumb Navigation Bar**: Interactive path trail (`Root > Note > ProjectA > Specs`) attached directly inside the FOLDERS card lets you jump directly back from deep subfolders in 1 tap.
- **SD Card & Full Storage Access**: Automatically detects mounted SD cards (`SD Card (...)`) and lists all top-level storage directories (`Notes`, `Documents`, `MyStyle`, `EXPORT`, `IMPORT`, etc.).
- **Native Quick-Jump Popup (3+ Targets)**: When 3 or more preset targets are active, single-tapping the floating icon opens an instant native E-Ink popup menu right next to the icon for 1-tap jumping.
- **8mm Line-Height Floating Overlay**: Dynamically calculated for screen DPI (Nomad A6X2 & Manta A5X2) to fit cleanly within standard 8mm ruled lines.
- **Favorite Files & Folders**: Star your most important notebooks, PDFs, and working directories for instant 1-tap access.
- **Automatic MyStyle Storage Backup**: Configuration automatically backs up to `/storage/emulated/0/MyStyle/LastNote/`, preserving all your favorites, presets, page-locks, and pairs across plugin uninstalls and updates.
- **Optimized E-Ink UI**: High-contrast typography, large black star indicators, and bold container cards designed specifically for Supernote greyscale screens.
- **Multi-Format Support**: Switches among `.note`, `.pdf`, `.epub`, `.cbz`, `.xps`, and `.fb2` files supported by Supernote's file API.

- **Bookmark Current Page**: Add the currently open file and page directly from the dashboard.
- **Editable Bookmarks**: Rename and reorder bookmarks under Edit. Compact name and page fields leave room for controls.
- **Scrollable Quick Menu**: Long lists scroll within the screen, with a Close action.
- **Reliable Pair Toggle**: Selects the other target using the current file/page without changing your saved order.

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
   - **From FOLDERS Section**: Browse internal storage directories or mounted **SD Cards** and tap any `.note`, `.pdf`, or `.epub` file. Choose **Add Note** or **Add Document** to add the file once. It appears in **Bookmarks** with its full filename and extension.

5. **Choose Bookmarked Pages**:
   - Tap **Edit** on a bookmark. Clear **Use last viewed page** to enter a fixed page, or select it to resume where you left off.
   - Enter a page number and tap **Save changes**. Known note bounds are enforced.
   - To add another bookmark in that file, expand **Add another page bookmark**, enter the desired page, and tap **Add page bookmark**. Existing file/page destinations cannot be duplicated.

6. **Save & Start Toggling**:
   - Tap **Save changes** for edits to a bookmark name or page. Adding, removing, and reordering bookmarks save immediately. Wait for **Saved**, then tap **Close**. If saving fails, tap the error to retry.

---

## How Toggling Works

- **Mode 1: Single Pair (2 Documents)**
  - Single-tapping the floating bubble with your finger **instantly toggles back and forth** between Document 1 and Document 2.
- **Mode 2: Multi-Preset List (3+ Documents)**
  - Single-tapping the floating bubble opens an **Instant Native E-Ink Popup Menu** right at the icon, listing all your preset documents with their locked page badges (e.g., `ProjectNotes (p.5)`). Tap any document in the popup to jump to it in **1 tap**.

With something lassoed in a note, a finger tap on the bubble sends a link instead of toggling. See [Send Link](#send-link).

---

## Send Link

Put a link to the page you're writing on onto a page in another note, without leaving your notes. The link's label is whatever you lassoed, and tapping the link brings you back to the page it came from.

### Before you start

1. **Show the floating button.** Tap the **LastNote** icon on the note toolbar.
2. **Bookmark the page you want to send links to.** Long-press the floating button with your finger to open the dashboard. Find the note under **FOLDERS**, tap it, and choose **Add Note**. It can be in any folder or on the SD card.
3. **Fix the page.** Tap **Edit** on the new bookmark, clear **Use last viewed page**, enter the page number, and tap **Save changes**.

   If you leave **Use last viewed page** on, Send Link opens whichever page of that note you last had open.

### Sending a link

1. **Write a short note, and lasso it.** A drawn checkbox works too.
2. **Tap the floating button with your finger.** LastNote reads your selection and shows your note bookmarks.
3. **Tap a bookmark with your finger.** That note opens at the bookmarked page, with a bar at the top: `Tap to place "your words" · Note.note`.
4. **Tap where the link should go,** with the pen or your finger.
5. LastNote places the link, saves the note, and **brings you back** to the page you were writing on.

To back out, tap **Close** in the bookmark list or **Cancel** in the bar, with your finger. Waiting 30 seconds without tapping also cancels. Either way nothing is placed, and you're returned to your page.

### The label

- **Typed text** in the lasso is used as it is.
- **Handwriting** is recognized and used as the label.
- **A drawn shape** stays as its symbol, so a square becomes a `□` checkbox link.
- **If nothing can be read,** the label is the page name, for example `Work · p.20`.

### The floating button responds to your finger only

The pen passes straight through the floating button, so you can write near it. Every action on it is a finger action:

| With your finger… | What happens |
|---|---|
| Tap, with something lassoed in a note | Send Link |
| Tap, with nothing lassoed | Switches notes, exactly as before |
| Long-press | Opens the dashboard |
| Drag | Moves the button |

### Good to know

- **Links can only be placed in notes.** PDFs and other documents don't appear in the Send Link list, because Supernote doesn't allow links to be added to them.
- **A link remembers a page number,** not the page itself. If you insert, delete or reorder pages before the source page, the link will point at the wrong page. The same is true of Supernote's own links.
- **To move a placed link,** lasso it and drag it, as with any link.
- **The log.** Each Send Link records its steps in `MyStyle/LastNote/send-link-log.txt`. If something goes wrong, include that file when you report it.

---

## Floating Button Settings

Long-press the floating button to open the dashboard, then find **Floating button**
below the Bookmarks section. Tap each option to enable it; settings save immediately.


- **Remember button position** saves the floating button's screen location across restarts.
- **Restore button when LastNote loads** shows the button when Supernote loads the plugin. After a reboot this may require opening a note or document first; it is not device-boot autostart.

To try it, enable both options, drag the button to your preferred location, and reboot. Open a note or document if the button has not yet appeared. The restored position is kept within the screen bounds.

Both options default to off. They are stored in LastNote's private settings, not the MyStyle backup; uninstalling may reset them. Turning position memory off clears the stored coordinates but leaves the current session's button in place. Turning restoration off does not hide the current button; the toolbar still controls its visibility.

## Backup & Automatic Data Recovery

Floating-button preferences and coordinates are private settings and are not included in this backup.

Your favorites, presets, pairs, and locked page numbers are automatically mirrored to:

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

## License

MIT. See [LICENSE](LICENSE).
