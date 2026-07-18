import {AppRegistry, Image, NativeModules, ToastAndroid} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {PluginManager, PluginCommAPI} from 'sn-plugin-lib';

const BUTTON_TYPE_TOOLBAR = 1;
const TOOLBAR_BUTTON_ID = 100;
const SHOW_TYPE_BACKGROUND = 0;

AppRegistry.registerComponent(appName, () => App);

PluginManager.init();

// Register the toolbar button as a background button
PluginManager.registerButton(BUTTON_TYPE_TOOLBAR, ['NOTE', 'DOC'], {
  id: TOOLBAR_BUTTON_ID,
  name: 'LastNote',
  icon: Image.resolveAssetSource(require('./assets/two-arrows.png')).uri,
  showType: SHOW_TYPE_BACKGROUND,
});

PluginManager.registerButtonListener({
  async onButtonPress(event) {
    if (!event || event.id !== TOOLBAR_BUTTON_ID) {
      return;
    }

    try {
      const currentRes = await PluginCommAPI.getCurrentFilePath();
      if (!currentRes || !currentRes.success || !currentRes.result) {
        ToastAndroid.show('Could not resolve current file path.', ToastAndroid.SHORT);
        return;
      }
      const currentPath = currentRes.result;

      const lastNoteModule = NativeModules.LastNote;
      if (!lastNoteModule) {
        ToastAndroid.show('LastNote native module is not registered.', ToastAndroid.LONG);
        return;
      }

      // Read previously saved note path
      const lastPath = await lastNoteModule.readLastPath();

      if (lastPath && lastPath !== currentPath) {
        // Save current note path to storage first
        await lastNoteModule.writeLastPath(currentPath);

        // Open the last note
        if (lastPath.toLowerCase().endsWith('.note')) {
          await lastNoteModule.openNote(lastPath);
        } else if (lastPath.toLowerCase().endsWith('.pdf') || lastPath.toLowerCase().endsWith('.epub')) {
          await lastNoteModule.openDocument(lastPath);
        } else {
          ToastAndroid.show('Unsupported file type: ' + lastPath, ToastAndroid.SHORT);
          return;
        }
        ToastAndroid.show('Switched note', ToastAndroid.SHORT);
      } else {
        // Save current note path to storage as initial target
        await lastNoteModule.writeLastPath(currentPath);
        ToastAndroid.show('Target saved. Open another note to switch.', ToastAndroid.LONG);
      }
    } catch (error) {
      ToastAndroid.show('LastNote toggle failed: ' + (error?.message ?? error), ToastAndroid.LONG);
    }
  },
});
