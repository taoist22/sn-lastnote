import {DeviceEventEmitter, NativeModules} from 'react-native';
import {PluginCommAPI, PluginNoteAPI} from 'sn-plugin-lib';
import {buildTextLinkAt, linkLabel} from '../src/domain/linkPlacement';
import {absolutePath, lassoIsActive, runSendLink} from '../src/services/sendLink';
import {navigateToTarget} from '../src/services/fileNavigation';

jest.mock('sn-plugin-lib', () => ({
  PluginCommAPI: {getCurrentFilePath: jest.fn(), getCurrentPageNum: jest.fn(), getPageDisplaySize: jest.fn(), getLassoRect: jest.fn(), setLassoBoxState: jest.fn()},
  PluginFileAPI: {getPageSize: jest.fn()},
  PluginNoteAPI: {saveCurrentNote: jest.fn(), insertTextLink: jest.fn()},
  PluginManager: {},
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
const never = () => new Promise(() => {});
const module = {
  getNativeBuild: jest.fn().mockResolvedValue(2),
  // Stands in for the native timer, shortened: polls take 2 ms and timeouts
  // 40 ms, so a simulated device reply always beats a timeout it should beat.
  delay: jest.fn((ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms >= 1000 ? 40 : 2))),
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
  mock(PluginCommAPI.getLassoRect).mockResolvedValue(ok({left: 10, top: 10, right: 200, bottom: 80}));
  mock(PluginCommAPI.setLassoBoxState).mockResolvedValue(ok(true));
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
  await runSendLink();
  expect(PluginCommAPI.setLassoBoxState).toHaveBeenCalledWith(2);
  expect(module.showLinkPopup).toHaveBeenCalledWith([{name: 'Board', path: BOARD, page: 1, label: null}]);
  expect(module.showTapLayer).toHaveBeenCalledWith(expect.stringContaining('Board.note'), 30000);
  expect(PluginNoteAPI.insertTextLink).toHaveBeenCalledWith(expect.objectContaining({
    destPath: SOURCE, destPage: 19, fullText: 'Work · p.20', rect: expect.objectContaining({left: 400}),
  }));
  expect(mock(navigateToTarget).mock.calls).toEqual([[{path: BOARD, page: 1}], [{path: SOURCE, page: 20}]]);
  expect(location).toEqual({path: SOURCE, page: 19});
  expect(log).toContain('native build 2');
  expect(log).toContain('summary: Link placed');
});

it('waits with the native timer, never a JS timer, after leaving the note', async () => {
  let calls = 0;
  mock(PluginCommAPI.getCurrentPageNum).mockImplementation(async () => ok(++calls < 4 ? 19 : location.page));
  await runSendLink();
  expect(module.delay).toHaveBeenCalledWith(250);
  expect(log).toContain('arrived');
  expect(log).toContain('summary: Link placed');
});

it('reports an insert that never replies without saving, then returns', async () => {
  mock(PluginNoteAPI.insertTextLink).mockReturnValue(never());
  await runSendLink();
  expect(log).toContain('NO REPLY');
  expect(log).toContain('the link could not be placed');
  expect(PluginNoteAPI.saveCurrentNote).toHaveBeenCalledTimes(1);
  expect(location).toEqual({path: SOURCE, page: 19});
});

it('returns without inserting when the tap is cancelled or times out', async () => {
  module.showTapLayer.mockImplementation(reply('onLinkTapCancel', {reason: 'timeout'}));
  await runSendLink();
  expect(PluginNoteAPI.insertTextLink).not.toHaveBeenCalled();
  expect(location).toEqual({path: SOURCE, page: 19});
  expect(log).toContain('"reason":"timeout"');
  expect(log).toContain('cancelled, nothing placed');
});

it('stops before leaving when the popup is closed or nothing is bookmarked', async () => {
  module.showLinkPopup.mockImplementation(reply('onLinkPopupClosed'));
  await runSendLink();
  expect(navigateToTarget).not.toHaveBeenCalled();
  expect(log).toContain('no bookmark chosen');
  module.readPresets.mockResolvedValue(JSON.stringify([{name: 'Paper', path: '/storage/emulated/0/Document/a.pdf', page: 3}]));
  await runSendLink();
  expect(log).toContain('bookmark a notebook page');
});

it('reports a bookmark that never opens and does not show the tap layer', async () => {
  mock(navigateToTarget).mockResolvedValue(undefined);
  await runSendLink();
  expect(module.showTapLayer).not.toHaveBeenCalled();
  expect(log).toContain('did not arrive');
  expect(log).toContain('the bookmark did not open');
});

it('refuses to insert if a different note is open at the tap', async () => {
  module.showTapLayer.mockImplementation(async () => {location = {path: SOURCE, page: 3}; return reply('onLinkTap', {x: 1, y: 1})();});
  await runSendLink();
  expect(PluginNoteAPI.insertTextLink).not.toHaveBeenCalled();
  expect(log).toContain('the page changed');
});

it('treats a tap as Send Link only with a real lasso in a notebook', async () => {
  expect(await lassoIsActive()).toBe(true);
  mock(PluginCommAPI.getLassoRect).mockResolvedValue({success: false});
  expect(await lassoIsActive()).toBe(false);
  mock(PluginCommAPI.getLassoRect).mockResolvedValue(ok({left: 5, top: 5, right: 5, bottom: 5}));
  expect(await lassoIsActive()).toBe(false);
  mock(PluginCommAPI.getLassoRect).mockReturnValue(never());
  expect(await lassoIsActive()).toBe(false);
  mock(PluginCommAPI.getLassoRect).mockRejectedValue(new Error('no lasso'));
  expect(await lassoIsActive()).toBe(false);
  location = {path: '/storage/emulated/0/Document/a.pdf', page: 0};
  mock(PluginCommAPI.getLassoRect).mockResolvedValue(ok({left: 10, top: 10, right: 200, bottom: 80}));
  expect(await lassoIsActive()).toBe(false);
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
