import {AppRegistry, DeviceEventEmitter, Image, NativeModules} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {PluginManager} from 'sn-plugin-lib';
import {navigateToTarget} from './src/services/fileNavigation';

const BUTTON_TYPE_TOOLBAR  = 1;
const BUTTON_TOGGLE_ID     = 100;
const SHOW_TYPE_BACKGROUND = 0;

AppRegistry.registerComponent(appName, () => App);
PluginManager.init();

const lastNoteModule = NativeModules.LastNote;

// JS-side overlay state — tracks whether icon is currently on screen
let overlayActive = false;

// On load: sync JS state with native
if (lastNoteModule) {
  lastNoteModule.isOverlayShowing()
    .then((showing: boolean) => {
      if (showing) {
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
    const presetsRaw = await lastNoteModule.readPresets().catch(() => null);
    const presets = presetsRaw ? JSON.parse(presetsRaw) : [];

    if (Array.isArray(presets) && presets.length >= 3) {
      // 3+ targets -> show native popup window directly attached to floating bubble
      await lastNoteModule.showPresetPopup(presets);
      return;
    }

    if (Array.isArray(presets) && presets.length === 2) {
      // 2 targets -> 1-tap direct toggle between target 0 & target 1
      const [t0, t1] = presets;
      // Swap in presets storage
      await lastNoteModule.writePresets(JSON.stringify([t1, t0]));
      await lastNoteModule.writePair(t1.path, t0.path);
      await navigateToTarget(t1);
      return;
    }

    // Fallback: 1-pair mode
    const there = await lastNoteModule.readThere();
    if (!there) return;
    const here = await lastNoteModule.readHere();

    await lastNoteModule.writePair(there, here || '');
    await navigateToTarget({path: there, page: 0});
  } catch (err) {
    console.error('LastNote performToggle failed:', err);
  }
}

// ─── Module-scope event listeners ────────────────────────────────────────────

DeviceEventEmitter.addListener('onFloatingToggleTap', () => {
  performToggle();
});

DeviceEventEmitter.addListener('onFloatingLongPress', () => {
  try {
    if (lastNoteModule) {
      lastNoteModule.hidePopup().catch(() => {});
    }
    PluginManager.showPluginView();
  } catch (e) {
    console.error('LastNote: showPluginView failed', e);
  }
});

DeviceEventEmitter.addListener('onPresetSelected', target => {
  navigateToTarget(target).catch(err =>
    console.error('LastNote preset navigation failed:', err)
  );
});

// Remove native overlay windows when the plugin is unmounted or destroyed.
// Closing only the dashboard emits an earlier lifecycle state and deliberately
// leaves the user-enabled floating toggle in place.
PluginManager.registerPluginLifeListener({
  onMsg(message) {
    const state = typeof message === 'number' ? message : message?.state;
    if (state === 4 || state === 5) {
      lastNoteModule?.hideOverlay().catch(() => {});
      overlayActive = false;
    }
  },
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
      await lastNoteModule.hideOverlay().catch(() => {});
      overlayActive = false;
    } else {
      await lastNoteModule.showOverlay().catch(e =>
        console.error('LastNote: showOverlay failed', e)
      );
      overlayActive = true;
    }
  },
});
