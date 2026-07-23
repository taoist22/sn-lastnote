import {AppRegistry, DeviceEventEmitter, Image, NativeModules} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {PluginManager, PluginCommAPI} from 'sn-plugin-lib';

const BUTTON_TYPE_TOOLBAR  = 1;
const BUTTON_TOGGLE_ID     = 100;
const SHOW_TYPE_BACKGROUND = 0;

AppRegistry.registerComponent(appName, () => App);
PluginManager.init();

const lastNoteModule = NativeModules.LastNote;

// JS-side overlay state — tracks whether icon is currently on screen
let overlayActive = false;

// On load: sync JS state with native (handles JS reload while overlay was showing)
if (lastNoteModule) {
  lastNoteModule.isOverlayShowing()
    .then((showing: boolean) => {
      if (showing) {
        // Ghost overlay exists — destroy it; user must re-activate via toolbar
        lastNoteModule.hideOverlay().catch(() => {});
      }
      overlayActive = false;
    })
    .catch(() => { overlayActive = false; });
}

// ─── Toggle logic ────────────────────────────────────────────────────────────
async function performToggle() {
  if (!lastNoteModule) return;
  try {
    const there = await lastNoteModule.readThere();
    if (!there) {
      // No pair set yet — nothing to toggle
      console.log('LastNote: no pair set. Long-press the icon to choose a note.');
      return;
    }
    const here = await lastNoteModule.readHere();
    // Swap pair in storage BEFORE navigating — next tap is always correct
    await lastNoteModule.writePair(there, here || '');
    const dest = there.toLowerCase();
    if (dest.endsWith('.note')) {
      await lastNoteModule.openNote(there);
    } else if (dest.endsWith('.pdf') || dest.endsWith('.epub')) {
      await lastNoteModule.openDocument(there);
    } else {
      console.warn('LastNote: unsupported file type: ' + there);
    }
  } catch (err) {
    console.error('LastNote performToggle failed:', err);
  }
}

// ─── Module-scope event listeners (survive plugin view closing) ───────────────

// Floating single tap → toggle notes
DeviceEventEmitter.addListener('onFloatingToggleTap', () => {
  performToggle();
});

// Floating long-press → open note picker (App.tsx)
DeviceEventEmitter.addListener('onFloatingLongPress', () => {
  console.log('LastNote: long-press → opening note picker');
  try {
    PluginManager.showPluginView();
  } catch (e) {
    console.error('LastNote: showPluginView failed', e);
  }
});

// ─── Toolbar button ──────────────────────────────────────────────────────────
PluginManager.registerButton(BUTTON_TYPE_TOOLBAR, ['NOTE', 'DOC'], {
  id: BUTTON_TOGGLE_ID,
  name: 'LastNote',
  icon: Image.resolveAssetSource(require('./assets/two-arrows.png')).uri,
  showType: SHOW_TYPE_BACKGROUND,
});

PluginManager.registerButtonListener({
  async onButtonPress(event) {
    if (!event || event.id !== BUTTON_TOGGLE_ID) return;
    if (!lastNoteModule) return;

    if (overlayActive) {
      // Icon is showing → toolbar tap turns plugin off
      await lastNoteModule.hideOverlay().catch(() => {});
      overlayActive = false;
    } else {
      // Icon is not showing → toolbar tap turns plugin on
      await lastNoteModule.showOverlay().catch(e =>
        console.error('LastNote: showOverlay failed', e)
      );
      overlayActive = true;
    }
  },
});
