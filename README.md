# LastNote

1-Tap toggle back to your last viewed note.

## Standard Workflow

Use the same checks for every new Supernote plugin:

```bash
npm install
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run validate:package
```

React Native is locked to `0.79.2` because it must match the Supernote PluginHost runtime.

`npm run build` and `./buildPlugin.sh` automatically apply the local Metro watcher patch used in this workspace to avoid recurring `EMFILE: too many open files, watch` failures during one-shot bundle builds.

## Structure

```text
src/
  app/        app composition and high-level wiring
  screens/    visible plugin screens
  domain/     plugin-specific business logic
  services/   integrations and side-effect wrappers
  supernote/  Supernote API adapters
  storage/    persistence adapters
  utils/      small pure helpers
```

Tiny plugins do not need to fill every folder. Prefer the smallest structure that keeps UI, logic, and device integration easy to find.

## Package Validation

After every build, run:

```bash
npm run validate:package
```

For native-backed plugins, use:

```bash
npm run validate:package -- --native
```

This catches the known failure mode where a `.snplg` is produced but the native package is missing.

## Usage Instructions

This plugin runs in the background of the Supernote toolbar. Once installed, it allows you to toggle back and forth between two notes (or documents) with exactly **one tap**.

### First-Time Setup
1. Open **Note A** (your first note).
2. Tap the **LastNote** icon (two arrows) on the toolbar. A Toast notification will appear confirming that Note A has been saved as the toggle target.
3. Manually open **Note B** (your second note) via the Recents list, Files menu, or Sidebar.

### Ongoing Toggling
- While in **Note B**, tap the **LastNote** icon to switch instantly back to **Note A** (Note B is automatically saved as the next target).
- While in **Note A**, tap the **LastNote** icon to switch instantly back to **Note B**.

---

## Icon Attribution

The plugin icon is:
<a href="https://www.flaticon.com/free-icons/transfer" title="transfer icons">Transfer icons created by Ayub Irawan - Flaticon</a>

