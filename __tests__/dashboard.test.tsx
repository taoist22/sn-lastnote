import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {NativeModules, Text, TouchableOpacity} from 'react-native';
import App from '../App';

jest.mock('../src/pluginPermissions', () => ({
  ensureFileReadPermission: async () => true,
  ensureFileWritePermission: async () => true,
}));
jest.mock('../src/services/fileNavigation', () => ({
  navigateToTarget: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('sn-plugin-lib', () => ({
  PluginCommAPI: {
    getCurrentFilePath: async () => ({success: true, result: 'a.note'}),
    getCurrentPageNum: async () => ({success: true, result: 9}),
  },
  PluginFileAPI: {
    getNoteTotalPageNum: async () => ({success: true, result: 10}),
    getTitles: async () => ({success: true, result: []}),
  },
  PluginManager: {closePluginView: jest.fn()},
}));
let tree: renderer.ReactTestRenderer;
let presets: string;
let here: string;
const native = {
  listRootDirectories: async () => [],
  readHere: async () => here,
  readThere: async () => '',
  readFavorites: async () => '[]',
  readFavoriteFiles: async () => '[]',
  readRecentFolders: async () => '[]',
  readPresets: async () => presets,
  writePresets: jest.fn(async (s: string) => {
    presets = s;
  }),
  writePair: jest.fn(async (h: string) => {
    here = h;
  }),
  writeRecentFolders: async () => {},
};
async function mount() {
  await act(async () => {
    tree = renderer.create(<App />);
  });
}
async function press(label: string) {
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(b => b.findAllByType(Text).some(t => t.props.children === label));
  if (!button) {
    throw new Error(`Missing button: ${label}`);
  }
  await act(async () => {
    await button.props.onPress();
  });
}
beforeEach(() => {
  presets = JSON.stringify([{id: 'a', path: 'a.note', name: 'A', page: 10}]);
  here = 'a.note';
  NativeModules.LastNote = native;
  jest.clearAllMocks();
});
afterEach(async () => {
  await act(async () => {
    tree?.unmount();
  });
});
it('removes the last target and does not restore it on reopening', async () => {
  await mount();
  await press('Edit');
  await press('Remove');
  expect(presets).toBe('[]');
  expect(native.writePair).toHaveBeenLastCalledWith('', '');
  await act(async () => {
    tree.unmount();
  });
  await mount();
  expect(
    tree.root
      .findAllByType(Text)
      .some(
        t =>
          t.props.children === 'No target documents or bookmarks selected yet.',
      ),
  ).toBe(true);
});
it('disables adding beyond the final page', async () => {
  await mount();
  await press('Edit');
  await press('Add another page bookmark');
  const add = tree.root
    .findAllByType(TouchableOpacity)
    .find(b =>
      b.findAllByType(Text).some(t => t.props.children === 'Add page bookmark'),
    );
  expect(add?.props.disabled).toBe(true);
});
it('bookmarks the current page without shifting to the following page', async () => {
  presets = '[]';
  await mount();
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(b =>
      b
        .findAllByType(Text)
        .some(
          t =>
            Array.isArray(t.props.children) &&
            t.props.children[0] === '+ Bookmark current page (',
        ),
    );
  await act(async () => {
    await button!.props.onPress();
  });
  expect(JSON.parse(presets)[0].page).toBe(10);
});
it('keeps the old display and offers retry after a failed save', async () => {
  await mount();
  await press('Edit');
  native.writePresets.mockRejectedValueOnce(new Error('Disk full'));
  await press('Remove');
  expect(
    tree.root.findAllByType(Text).some(t => t.props.children === 'Save failed'),
  ).toBe(true);
  await press('Tap to retry');
  expect(presets).toBe('[]');
});

async function enter(field: string, value: string) {
  await act(async () => {
    tree.root
      .findAllByType(require('react-native').TextInput)
      .find(i => i.props.accessibilityLabel === field)!
      .props.onChangeText(value);
  });
}
it('saves the name and page together only after Save changes', async () => {
  await mount();
  await press('Edit');
  await enter('Bookmark name', 'Research');
  await enter('Page number', '4');
  expect(JSON.parse(presets)[0]).toMatchObject({page: 10});
  expect(native.writePresets).not.toHaveBeenCalled();
  await press('Save changes');
  expect(JSON.parse(presets)[0]).toMatchObject({page: 4, label: 'Research'});
  const checkbox = tree.root
    .findAllByType(TouchableOpacity)
    .find(b => b.props.accessibilityRole === 'checkbox')!;
  await act(async () => {
    checkbox.props.onPress();
  });
  expect(JSON.parse(presets)[0].page).toBe(4);
  await press('Save changes');
  expect(JSON.parse(presets)[0].page).toBe(0);
  await press('Add another page bookmark');
  await press('Add page bookmark');
  await press('Move down');
  expect(JSON.parse(presets)[1].label).toBe('Research');
  await press('Move up');
  expect(JSON.parse(presets)[0].label).toBe('Research');
});

it('does not duplicate an existing next page when + Page is pressed again', async () => {
  presets = JSON.stringify([{id: 'a', path: 'a.note', name: 'A', page: 5}]);
  await mount();
  await press('Edit');
  await press('Add another page bookmark');
  await press('Add page bookmark');
  await press('Add page bookmark');
  expect(JSON.parse(presets).map((t: {page: number}) => t.page)).toEqual([
    5, 6,
  ]);
});

it('prevents the original bookmark being edited onto the page added by + Page', async () => {
  presets = JSON.stringify([{id: 'a', path: 'a.note', name: 'A', page: 5}]);
  await mount();
  await press('Edit');
  await press('Add another page bookmark');
  await press('Add page bookmark');
  await enter('Page number', '6');
  await press('Save changes');
  expect(JSON.parse(presets).map((t: {page: number}) => t.page)).toEqual([
    5, 6,
  ]);
});

it('adds the page chosen in the bookmark editor, rather than always the next page', async () => {
  presets = JSON.stringify([
    {id: 'a', path: 'a.note', name: 'a.note', page: 2},
  ]);
  await mount();
  await press('Edit');
  await press('Add another page bookmark');
  const input = tree.root
    .findAllByType(require('react-native').TextInput)
    .find(i => i.props.accessibilityLabel === 'New bookmark page')!;
  await act(async () => {
    input.props.onChangeText('8');
  });
  await press('Add page bookmark');
  expect(JSON.parse(presets).map((t: {page: number}) => t.page)).toEqual([
    2, 8,
  ]);
  expect(
    tree.root.findAllByType(Text).some(t => t.props.children === 'Open'),
  ).toBe(false);
});
