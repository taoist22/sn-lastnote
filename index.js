import {
  AppRegistry,
  DeviceEventEmitter,
  Image,
  NativeModules,
  Alert,
} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {PluginManager, PluginCommAPI} from 'sn-plugin-lib';
import {navigateToTarget} from './src/services/fileNavigation';

import {
  readTargets,
  chooseToggleTarget,
  currentUiPage,
} from './src/domain/targets';
import {extractCurrentPath} from './src/domain/navigation';

let toggling = false;
let lastTarget;

const BUTTON_TYPE_TOOLBAR = 1;
const BUTTON_TOGGLE_ID = 100;
const SHOW_TYPE_BACKGROUND = 0;

AppRegistry.registerComponent(appName, () => App);
PluginManager.init();

const lastNoteModule = NativeModules.LastNote;

// JS-side overlay state — tracks whether icon is currently on screen
let overlayActive = false;

// On load: sync JS state with native
if (lastNoteModule) {
  lastNoteModule
    .isOverlayShowing()
    .then((showing: boolean) => {
      if (showing) {
        lastNoteModule.hideOverlay().catch(() => {});
      }
      overlayActive = false;
    })
    .catch(() => {
      overlayActive = false;
    });
}

// ─── Toggle logic ────────────────────────────────────────────────────────────
async function performToggle() {
  if (!lastNoteModule || toggling) {
    return;
  }
  toggling = true;
  try {
    const raw = await lastNoteModule.readPresets();
    const targets = readTargets(
      raw,
      raw == null ? await lastNoteModule.readHere() : undefined,
      raw == null ? await lastNoteModule.readThere() : undefined,
    );
    if (targets.length >= 3) {
      await lastNoteModule.showPresetPopup(targets);
      return;
    }
    if (!targets.length) {
      PluginManager.showPluginView();
      return;
    }
    const [path, page] = await Promise.all([
      PluginCommAPI.getCurrentFilePath().catch(() => null),
      PluginCommAPI.getCurrentPageNum().catch(() => null),
    ]);
    const target = chooseToggleTarget(
      targets,
      extractCurrentPath(path),
      currentUiPage(page),
      lastTarget,
    );
    await navigateToTarget(target);
    lastTarget = target;
  } catch (err) {
    Alert.alert('Could not open target', String(err?.message || err), [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Retry', onPress: performToggle},
    ]);
  } finally {
    toggling = false;
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
    Alert.alert('Could not open target', String(err?.message || err), [
      {text: 'Cancel'},
      {
        text: 'Retry',
        onPress: () =>
          navigateToTarget(target).catch(e =>
            Alert.alert('Could not open target', String(e)),
          ),
      },
    ]),
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
    if (!event || event.id !== BUTTON_TOGGLE_ID) {
      return;
    }
    if (!lastNoteModule) {
      return;
    }

    if (overlayActive) {
      await lastNoteModule.hideOverlay().catch(() => {});
      overlayActive = false;
    } else {
      try {
        await lastNoteModule.showOverlay();
        overlayActive = true;
      } catch (e) {
        overlayActive = false;
        Alert.alert('Could not show LastNote', String(e));
      }
    }
  },
});
