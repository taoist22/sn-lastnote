import {PluginCommAPI, PluginFileAPI, PluginNoteAPI} from 'sn-plugin-lib';
import {readLassoLabel, tidyLabel} from '../src/services/lassoLabel';

jest.mock('sn-plugin-lib', () => ({
  PluginCommAPI: {getCurrentPageNum: jest.fn(), getLassoRect: jest.fn(), getLassoElements: jest.fn(), clearElementCache: jest.fn(),
    getPageDisplaySize: jest.fn(), getCurrentFilePath: jest.fn(), cancelRecognize: jest.fn(), recognizeElements: jest.fn(), setLassoBoxState: jest.fn()},
  PluginFileAPI: {getPageSize: jest.fn()},
  PluginNoteAPI: {getLassoText: jest.fn()},
}));

const ok = (result: unknown) => ({success: true, result});
const mock = (fn: unknown) => fn as jest.Mock;
// Stands in for the native delay: long waits are timeouts, so they lose to replies.
const wait = jest.fn((ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms >= 1000 ? 40 : 2)));
const log = jest.fn();
const contours = (points: {x: number; y: number}[]) => ({size: async () => 1, getRange: async () => [points]});
const stroke = (x: number, page = 3) => ({type: 0, pageNum: page, recycle: jest.fn(), contoursSrc: contours([{x, y: 100}, {x: x + 50, y: 150}])});

beforeEach(() => {
  jest.clearAllMocks();
  mock(PluginNoteAPI.getLassoText).mockResolvedValue(ok([]));
  mock(PluginCommAPI.getCurrentPageNum).mockResolvedValue(ok(3));
  mock(PluginCommAPI.getLassoRect).mockResolvedValue(ok({left: 90, top: 90, right: 400, bottom: 200}));
  mock(PluginCommAPI.getPageDisplaySize).mockResolvedValue(ok({width: 1404, height: 1872}));
  mock(PluginCommAPI.cancelRecognize).mockResolvedValue(ok(true));
  mock(PluginCommAPI.recognizeElements).mockResolvedValue(ok('  call\nthe plumber '));
  mock(PluginCommAPI.setLassoBoxState).mockResolvedValue(ok(true));
});

it('prefers typed text in the selection and clears the lasso', async () => {
  mock(PluginNoteAPI.getLassoText).mockResolvedValue(ok([{textContentFull: 'Buy'}, {textContentFull: ' milk '}]));
  expect(await readLassoLabel(wait, log)).toEqual({text: 'Buy milk', via: 'typed'});
  expect(PluginCommAPI.recognizeElements).not.toHaveBeenCalled();
  expect(PluginCommAPI.setLassoBoxState).toHaveBeenCalledWith(2);
});

it('recognizes only strokes inside the lasso on this page, after resetting and settling the recognizer', async () => {
  const inside = stroke(100);
  const elements = [inside, stroke(900), stroke(100, 4), {type: 500, pageNum: 3, recycle: jest.fn()}];
  mock(PluginCommAPI.getLassoElements).mockResolvedValue(ok(elements));
  expect(await readLassoLabel(wait, log)).toEqual({text: 'call the plumber', via: 'handwriting'});
  expect(PluginCommAPI.recognizeElements).toHaveBeenCalledWith([inside], {width: 1404, height: 1872});
  expect(wait).toHaveBeenCalledWith(400);
  expect(mock(PluginCommAPI.cancelRecognize).mock.invocationCallOrder[0]).toBeLessThan(mock(PluginCommAPI.recognizeElements).mock.invocationCallOrder[0]);
  for (const element of elements) {expect(element.recycle).toHaveBeenCalled();}
});

it('keeps a drawn shape as its recognised symbol', async () => {
  mock(PluginCommAPI.getLassoElements).mockResolvedValue(ok([stroke(100)]));
  mock(PluginCommAPI.recognizeElements).mockResolvedValue(ok('□'));
  expect(await readLassoLabel(wait, log)).toEqual({text: '□', via: 'handwriting'});
});

it('falls back to nothing when unreadable, and uses the stored page size on old firmware', async () => {
  mock(PluginNoteAPI.getLassoText).mockRejectedValue(new Error('none'));
  mock(PluginCommAPI.getLassoElements).mockResolvedValue(ok([{type: 0, pageNum: 3, contoursSrc: null}]));
  expect(await readLassoLabel(wait, log)).toEqual({text: '', via: 'none'});
  mock(PluginCommAPI.getLassoElements).mockResolvedValue(ok([stroke(100)]));
  mock(PluginCommAPI.getPageDisplaySize).mockRejectedValue(new Error('old firmware'));
  mock(PluginCommAPI.getCurrentFilePath).mockResolvedValue(ok('/Note/A.note'));
  mock(PluginFileAPI.getPageSize).mockResolvedValue(ok({width: 1920, height: 2560}));
  mock(PluginCommAPI.cancelRecognize).mockRejectedValue(new Error('idle'));
  expect((await readLassoLabel(wait, log)).text).toBe('call the plumber');
  expect(PluginCommAPI.recognizeElements).toHaveBeenLastCalledWith(expect.anything(), {width: 1920, height: 2560});
});

it('never throws: failures and silent calls become no label, and the lasso is still cleared', async () => {
  mock(PluginCommAPI.getLassoElements).mockResolvedValue(ok([stroke(100)]));
  mock(PluginCommAPI.recognizeElements).mockResolvedValue({success: false, error: {message: 'Recognition failed'}});
  expect(await readLassoLabel(wait, log)).toEqual({text: '', via: 'none'});
  expect(log).toHaveBeenCalledWith(expect.stringContaining('Recognition failed'));
  mock(PluginCommAPI.getLassoElements).mockReturnValue(new Promise(() => {}));
  mock(PluginCommAPI.setLassoBoxState).mockRejectedValue(new Error('busy'));
  expect(await readLassoLabel(wait, log)).toEqual({text: '', via: 'none'});
  expect(log).toHaveBeenCalledWith(expect.stringContaining('getLassoElements did not reply'));
  expect(log).toHaveBeenCalledWith(expect.stringContaining('clearing lasso'));
  expect(tidyLabel('x'.repeat(100))).toHaveLength(80);
});
