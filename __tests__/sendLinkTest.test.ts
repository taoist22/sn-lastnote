import {DeviceEventEmitter, NativeModules} from 'react-native';
import {PluginCommAPI, PluginManager, PluginNoteAPI} from 'sn-plugin-lib';
import {buildTextLinkAt, linkLabel} from '../src/domain/linkPlacement';
import {absolutePath, runSendLinkTest} from '../src/services/sendLinkTest';
import {navigateToTarget} from '../src/services/fileNavigation';

jest.mock('sn-plugin-lib', () => ({
  PluginCommAPI: {getCurrentFilePath: jest.fn(), getCurrentPageNum: jest.fn(), getPageDisplaySize: jest.fn()},
  PluginFileAPI: {getPageSize: jest.fn()},
  PluginNoteAPI: {saveCurrentNote: jest.fn(), insertTextLink: jest.fn()},
  PluginManager: {showPluginView: jest.fn(), closePluginView: jest.fn()},
}));
jest.mock('../src/pluginPermissions', () => ({
  ensureFileReadPermission: jest.fn().mockResolvedValue(true),
  ensureFileWritePermission: jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/services/fileNavigation', () => ({navigateToTarget: jest.fn()}));

const ok = (result: unknown) => ({success: true, result});
const mock = (fn: unknown) => fn as jest.Mock;
const SOURCE = '/storage/emulated/0/Note/Work.note';
const BOARD = '/storage/emulated/0/Note/Projects/Board.note';
let location = {path: SOURCE, page: 19};
let log = '';
const module = {
  readPresets: jest.fn(),
  showLinkPopup: jest.fn(),
  hidePopup: jest.fn().mockResolvedValue(true),
  showTapLayer: jest.fn(),
  hideTapLayer: jest.fn().mockResolvedValue(true),
  appendTestLog: jest.fn(async (text: string) => {log += text; return true;}),
};
// Replies the way the device would: after the native call, on a later tick.
const reply = (name: string, data?: unknown) => async () => {setTimeout(() => DeviceEventEmitter.emit(name, data), 0); return true;};

beforeAll(() => {NativeModules.LastNote = module;});
beforeEach(() => {
  jest.clearAllMocks();
  log = '';
  location = {path: SOURCE, page: 19};
  mock(PluginCommAPI.getCurrentFilePath).mockImplementation(async () => ok(location.path));
  mock(PluginCommAPI.getCurrentPageNum).mockImplementation(async () => ok(location.page));
  mock(PluginCommAPI.getPageDisplaySize).mockResolvedValue(ok({width: 1404, height: 1872}));
  mock(PluginNoteAPI.saveCurrentNote).mockResolvedValue(ok(true));
  mock(PluginNoteAPI.insertTextLink).mockResolvedValue(ok(0));
  mock(navigateToTarget).mockImplementation(async (t: {path: string; page: number}) => {location = {path: t.path, page: t.page - 1};});
  module.readPresets.mockResolvedValue(JSON.stringify([
    {name: 'Board', path: BOARD, page: 1}, {name: 'Paper', path: '/storage/emulated/0/Document/a.pdf', page: 3},
  ]));
  module.showLinkPopup.mockImplementation(reply('onLinkDestination', {path: BOARD, page: 1}));
  module.showTapLayer.mockImplementation(reply('onLinkTap', {x: 400, y: 600, tool: 2}));
});

it('opens a bookmark in another notebook, places a link back at the tap, and returns', async () => {
  await runSendLinkTest();
  expect(module.showLinkPopup).toHaveBeenCalledWith([{name: 'Board', path: BOARD, page: 1, label: null}]);
  expect(PluginNoteAPI.insertTextLink).toHaveBeenCalledWith(expect.objectContaining({
    destPath: SOURCE, destPage: 19, fullText: 'Work · p.20', rect: expect.objectContaining({left: 400}),
  }));
  expect(mock(navigateToTarget).mock.calls).toEqual([[{path: BOARD, page: 1}], [{path: SOURCE, page: 20}]]);
  expect(location).toEqual({path: SOURCE, page: 19});
  expect(PluginManager.showPluginView).not.toHaveBeenCalled();
  expect(log).toContain('summary: Link test: link placed');
});

it('shows the plugin view once when the insert does not reply, and logs what happened', async () => {
  jest.useFakeTimers();
  let finish: (v: unknown) => void = () => {};
  mock(PluginNoteAPI.insertTextLink).mockReturnValue(new Promise(resolve => {finish = resolve;}));
  mock(PluginManager.showPluginView).mockImplementation(() => finish(ok(0)));
  const run = runSendLinkTest();
  await jest.advanceTimersByTimeAsync(20000);
  await run;
  jest.useRealTimers();
  expect(PluginManager.showPluginView).toHaveBeenCalledTimes(1);
  expect(PluginManager.closePluginView).toHaveBeenCalled();
  expect(log).toContain('NO REPLY');
  expect(log).toContain('insert replied after showPluginView');
});

it('returns without inserting when the tap is cancelled', async () => {
  module.showTapLayer.mockImplementation(reply('onLinkTapCancel'));
  await runSendLinkTest();
  expect(PluginNoteAPI.insertTextLink).not.toHaveBeenCalled();
  expect(location).toEqual({path: SOURCE, page: 19});
  expect(log).toContain('cancelled, nothing placed');
});

it('stops before leaving when the popup is closed or nothing is bookmarked', async () => {
  module.showLinkPopup.mockImplementation(reply('onLinkPopupClosed'));
  await runSendLinkTest();
  expect(navigateToTarget).not.toHaveBeenCalled();
  expect(log).toContain('no bookmark chosen');
  module.readPresets.mockResolvedValue(JSON.stringify([{name: 'Paper', path: '/storage/emulated/0/Document/a.pdf', page: 3}]));
  await runSendLinkTest();
  expect(log).toContain('bookmark a notebook page');
});

it('reports a bookmark that never opens and still tries to return', async () => {
  jest.useFakeTimers();
  mock(navigateToTarget).mockResolvedValue(undefined);
  const run = runSendLinkTest();
  await jest.advanceTimersByTimeAsync(20000);
  await run;
  jest.useRealTimers();
  expect(module.showTapLayer).not.toHaveBeenCalled();
  expect(log).toContain('did not arrive');
  expect(log).toContain('the bookmark did not open');
});

it('normalises paths and keeps tapped links on the page', () => {
  expect(absolutePath('Note/a.note')).toBe('/storage/emulated/0/Note/a.note');
  expect(absolutePath('storage/emulated/0/Note/a.note')).toBe('/storage/emulated/0/Note/a.note');
  const source = {path: SOURCE, pageIndex: 0};
  expect(linkLabel(source)).toBe('Work · p.1');
  const {rect} = buildTextLinkAt(source, 'A'.repeat(40), {width: 1404, height: 1872}, {x: 1404, y: 1872});
  expect(rect.right).toBeLessThanOrEqual(1404);
  expect(rect.bottom).toBeLessThanOrEqual(1872);
  expect(() => buildTextLinkAt(source, ' ', {width: 1404, height: 1872}, {x: 0, y: 0})).toThrow('label');
  expect(() => buildTextLinkAt(source, 'A', {width: 0, height: 0}, {x: 0, y: 0})).toThrow('page size');
});
