import {PluginCommAPI, PluginFileAPI, PluginNoteAPI} from 'sn-plugin-lib';
import type {PageSize} from '../domain/linkPlacement';

// Reads the lassoed note as a link label. Ported from sn-linker, which follows
// sn-keyword's on-device recipe: typed text boxes first, otherwise handwriting
// recognition on the strokes inside the lasso. Waits are passed in because
// LastNote runs without a visible view, where JS timers do not fire.

type Rect = {left: number; top: number; right: number; bottom: number};
type Response<T> = {success?: boolean; result?: T; error?: {message?: string}};
type Wait = (ms: number) => Promise<void>;
export type LabelResult = {text: string; via: 'typed' | 'handwriting' | 'none'};

const CALL_WAIT_MS = 8000;
const OCR_WAIT_MS = 15000;
// The recognizer keeps strokes from earlier runs until cancelRecognize, and
// recognizing straight after the cancel fails. 300 ms was clean on device.
const RECOGNIZER_SETTLE_MS = 400;
const RECT_MARGIN = 8;
const MAX_LABEL = 80;

export function tidyLabel(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
}

function value<T>(response: unknown, what: string): T {
  const res = response as Response<T> | null;
  if (!res?.success || res.result === undefined || res.result === null) {throw new Error(res?.error?.message || `Could not read ${what}.`);}
  return res.result;
}

async function within<T>(call: Promise<T>, ms: number, what: string, wait: Wait): Promise<T> {
  const outcome = await Promise.race([
    call.then(result => ({done: true as const, result})),
    wait(ms).then(() => ({done: false as const})),
  ]);
  if (!outcome.done) {throw new Error(`${what} did not reply within ${ms}ms`);}
  return outcome.result;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.left <= b.right + RECT_MARGIN && a.right >= b.left - RECT_MARGIN &&
    a.top <= b.bottom + RECT_MARGIN && a.bottom >= b.top - RECT_MARGIN;
}

// Stroke points live in a different space from the lasso rect; the contour
// outline is what lines up with it.
async function contourRect(element: any): Promise<Rect | null> {
  const contours = element.contoursSrc;
  if (!contours?.size || !contours?.getRange) {return null;}
  const count = await contours.size();
  if (!count) {return null;}
  const points = ((await contours.getRange(0, count)) as {x: number; y: number}[][]).flat().filter(Boolean);
  if (!points.length) {return null;}
  return points.reduce((box, p) => ({left: Math.min(box.left, p.x), top: Math.min(box.top, p.y), right: Math.max(box.right, p.x), bottom: Math.max(box.bottom, p.y)}),
    {left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity});
}

async function typedText(wait: Wait, log: (line: string) => void): Promise<string> {
  try {
    const boxes = value<{textContentFull?: string}[]>(await within(PluginNoteAPI.getLassoText(), CALL_WAIT_MS, 'getLassoText', wait), 'typed text');
    return tidyLabel(boxes.map(box => box.textContentFull || '').join(' '));
  } catch (error) {
    log(`typed text: ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}

async function handwriting(wait: Wait, log: (line: string) => void): Promise<string> {
  const page = value<number>(await within(PluginCommAPI.getCurrentPageNum(), CALL_WAIT_MS, 'getCurrentPageNum', wait), 'the page');
  const lasso = value<Rect>(await within(PluginCommAPI.getLassoRect(), CALL_WAIT_MS, 'getLassoRect', wait), 'the lasso');
  PluginCommAPI.clearElementCache();
  const elements = value<any[]>(await within(PluginCommAPI.getLassoElements(), CALL_WAIT_MS, 'getLassoElements', wait), 'the lasso');
  try {
    const strokes: any[] = [];
    for (const element of elements) {
      if (element.type !== 0 || element.pageNum !== page) {continue;}
      const box = await contourRect(element).catch(() => null);
      if (box && overlaps(box, lasso)) {strokes.push(element);}
    }
    log(`lasso elements ${elements.length}, strokes to read ${strokes.length}`);
    if (!strokes.length) {return '';}
    let size: PageSize;
    try {size = value<PageSize>(await PluginCommAPI.getPageDisplaySize(), 'the page size');}
    catch {
      const path = value<string>(await PluginCommAPI.getCurrentFilePath(), 'the notebook');
      size = value<PageSize>(await PluginFileAPI.getPageSize(path, page), 'the page size');
    }
    try {await within(PluginCommAPI.cancelRecognize(), CALL_WAIT_MS, 'cancelRecognize', wait);} catch {}
    await wait(RECOGNIZER_SETTLE_MS);
    return tidyLabel(value<string>(await within(PluginCommAPI.recognizeElements(strokes, size), OCR_WAIT_MS, 'recognizeElements', wait), 'the handwriting'));
  } finally {
    for (const element of elements) {try {await element.recycle?.();} catch {}}
    PluginCommAPI.clearElementCache();
  }
}

// Never throws: an unreadable selection just means the caller uses the page
// name. The lasso box is cleared either way so it is not left over the page.
export async function readLassoLabel(wait: Wait, log: (line: string) => void): Promise<LabelResult> {
  try {
    const typed = await typedText(wait, log);
    if (typed) {return {text: typed, via: 'typed'};}
    const written = await handwriting(wait, log);
    return written ? {text: written, via: 'handwriting'} : {text: '', via: 'none'};
  } catch (error) {
    log(`handwriting: ${error instanceof Error ? error.message : String(error)}`);
    return {text: '', via: 'none'};
  } finally {
    try {await within(PluginCommAPI.setLassoBoxState(2), CALL_WAIT_MS, 'setLassoBoxState', wait);}
    catch (error) {log(`clearing lasso: ${String(error)}`);}
  }
}
