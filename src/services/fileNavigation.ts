import {NativeModules} from 'react-native';
import {PluginCommAPI, PluginFileAPI} from 'sn-plugin-lib';
import {
  navigateToTargetWith,
  type NavigationTarget,
} from '../domain/navigation';
import {ensureFileReadPermission} from '../pluginPermissions';

async function openWithNativeFallback(target: NavigationTarget): Promise<void> {
  const module = NativeModules.LastNote;
  if (!module) throw new Error('LastNote native module is unavailable.');

  const page = Number(target.page) > 0 ? Number(target.page) : 0;
  const lower = target.path.toLowerCase();
  if (lower.endsWith('.note')) {
    await module.openNoteWithPage(target.path, page);
    return;
  }
  if (lower.endsWith('.pdf') || lower.endsWith('.epub')) {
    await module.openDocumentWithPage(target.path, page);
    return;
  }
  throw new Error(`Could not open unsupported file: ${target.path}`);
}

export async function navigateToTarget(target: NavigationTarget): Promise<void> {
  if (!(await ensureFileReadPermission())) {
    throw new Error('File access was not allowed.');
  }
  return navigateToTargetWith(target, {
    getCurrentFilePath: () => PluginCommAPI.getCurrentFilePath(),
    jumpToPage: page => PluginCommAPI.jumpToPage(page),
    openFile: (path, page) => PluginFileAPI.openFile(path, page),
    openNativeFallback: openWithNativeFallback,
  });
}
