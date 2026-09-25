import {DeviceEventEmitter, NativeModules, ToastAndroid} from 'react-native';
import {PluginCommAPI, PluginFileAPI, PluginManager, PluginNoteAPI} from 'sn-plugin-lib';
import {buildTextLinkAt, linkLabel, LinkSource, PageSize} from '../domain/linkPlacement';
import {readTargets, TargetItem} from '../domain/targets';
import {ensureFileReadPermission, ensureFileWritePermission} from '../pluginPermissions';
import {navigateToTarget} from './fileNavigation';

// TEST BUILD ONLY. Answers one question on device: can LastNote open a
// bookmarked page (in this notebook or another), take a tap through a native
// overlay window, insert a link there with no plugin view showing, and return?
// Every step is written to MyStyle/LastNote/send-link-test-log.txt.

type Response<T> = {success?: boolean; result?: T; error?: {message?: string}};
type Event = {name: string; data: any};

const POPUP_WAIT_MS = 60000;
const TAP_WAIT_MS = 30000;
const ARRIVE_WAIT_MS = 8000;
const INSERT_WAIT_MS = 8000;
const POLL_MS = 250;

let running = false;

export function absolutePath(path: string): string {
  const clean = path.trim().replace(/^file:\/\//, '').replace(/\/+/g, '/');
  if (clean.startsWith('/storage/')) {return clean;}
  if (clean.startsWith('storage/')) {return '/' + clean;}
  return '/storage/emulated/0/' + clean.replace(/^\//, '');
}

function value<T>(response: unknown): T | undefined {
  const res = response as Response<T> | null;
  return res?.success ? res.result : undefined;
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Listen before triggering, so a fast reply is never missed.
export function nextEvent(names: string[], ms: number): Promise<Event | null> {
  return new Promise(resolve => {
    let finished = false;
    const subs = names.map(name => DeviceEventEmitter.addListener(name, data => done({name, data})));
    const timer = setTimeout(() => done(null), ms);
    function done(result: Event | null) {
      if (finished) {return;}
      finished = true;
      clearTimeout(timer);
      subs.forEach(sub => sub.remove());
      resolve(result);
    }
  });
}

function settleWithin<T>(promise: Promise<T>, ms: number): Promise<{done: true; value: T} | {done: false}> {
  return Promise.race([
    promise.then(result => ({done: true as const, value: result})),
    wait(ms).then(() => ({done: false as const})),
  ]);
}

async function whereAmI(): Promise<LinkSource | null> {
  const path = value<string>(await PluginCommAPI.getCurrentFilePath().catch(() => null));
  const page = value<number>(await PluginCommAPI.getCurrentPageNum().catch(() => null));
  return path && Number.isInteger(page) ? {path: absolutePath(path), pageIndex: Number(page)} : null;
}

async function arrive(path: string, pageIndex: number | null, log: (line: string) => void): Promise<boolean> {
  for (let waited = 0; waited <= ARRIVE_WAIT_MS; waited += POLL_MS) {
    const here = await whereAmI();
    if (here && here.path === path && (pageIndex === null || here.pageIndex === pageIndex)) {
      log(`arrived ${here.path} p.${here.pageIndex + 1}`);
      return true;
    }
    await wait(POLL_MS);
  }
  log(`did not arrive at ${path}${pageIndex === null ? '' : ` p.${pageIndex + 1}`} within ${ARRIVE_WAIT_MS}ms; now ${JSON.stringify(await whereAmI())}`);
  return false;
}

export async function runSendLinkTest(): Promise<void> {
  const module = NativeModules.LastNote;
  if (!module || running) {return;}
  running = true;
  const started = Date.now();
  const lines: string[] = [];
  const log = (line: string) => {lines.push(`${String(Date.now() - started).padStart(6)}ms  ${line}`);};
  let summary = 'Link test stopped';
  let source: LinkSource | null = null;
  try {
    log(`--- Send Link test ${new Date().toISOString()}`);
    if (!(await ensureFileReadPermission()) || !(await ensureFileWritePermission())) {
      summary = 'Link test: file access was not allowed';
      log(summary);
      return;
    }
    source = await whereAmI();
    log(`source ${JSON.stringify(source)}`);
    if (!source || !/\.note$/i.test(source.path)) {summary = 'Link test: open a notebook first'; log(summary); return;}

    const raw = await module.readPresets();
    const targets: TargetItem[] = readTargets(raw).filter(t => /\.note$/i.test(t.path));
    log(`notebook bookmarks: ${targets.length}`);
    if (!targets.length) {summary = 'Link test: bookmark a notebook page in LastNote first'; log(summary); return;}

    const picked = nextEvent(['onLinkDestination', 'onLinkPopupClosed'], POPUP_WAIT_MS);
    await module.showLinkPopup(targets.map(t => ({name: t.name, path: t.path, page: t.page, label: t.label ?? null})));
    const choice = await picked;
    if (!choice || choice.name !== 'onLinkDestination') {
      await module.hidePopup().catch(() => {});
      summary = 'Link test: no bookmark chosen';
      log(`popup ended: ${choice ? choice.name : 'timeout'}`);
      return;
    }
    const dest = {path: absolutePath(String(choice.data.path)), page: Number(choice.data.page)};
    const sameNotebook = dest.path === source.path;
    log(`chose ${JSON.stringify(dest)} sameNotebook=${sameNotebook}`);
    if (sameNotebook && dest.page - 1 === source.pageIndex) {summary = 'Link test: that bookmark is this page'; log(summary); return;}

    log(`save before leaving: ${JSON.stringify(await PluginNoteAPI.saveCurrentNote().catch(e => String(e)))}`);
    await navigateToTarget({path: dest.path, page: dest.page});
    log('navigateToTarget resolved');
    if (!(await arrive(dest.path, dest.page > 0 ? dest.page - 1 : null, log))) {summary = 'Link test: the bookmark did not open'; return;}

    const tapped = nextEvent(['onLinkTap', 'onLinkTapCancel'], TAP_WAIT_MS);
    await module.showTapLayer(`Tap where the link goes · ${dest.path.split('/').pop()}`);
    log('tap layer shown');
    const tap = await tapped;
    await module.hideTapLayer().catch(() => {});
    if (!tap || tap.name !== 'onLinkTap') {
      summary = 'Link test: cancelled, nothing placed';
      log(`tap ended: ${tap ? 'cancel' : 'timeout'}`);
    } else {
      log(`tap ${JSON.stringify(tap.data)} (tool 1=finger 2=pen 4=eraser)`);
      const here = await whereAmI();
      log(`page at tap ${JSON.stringify(here)}`);
      let size = value<PageSize>(await PluginCommAPI.getPageDisplaySize().catch(() => null));
      if (!size && here) {size = value<PageSize>(await PluginFileAPI.getPageSize(here.path, here.pageIndex).catch(() => null));}
      log(`page size ${JSON.stringify(size)}`);
      const link = buildTextLinkAt(source, linkLabel(source), size || {width: 0, height: 0}, {x: tap.data.x, y: tap.data.y});
      log(`insertTextLink ${JSON.stringify(link.rect)} -> ${link.destPath} p.${link.destPage + 1}`);
      const insert = PluginNoteAPI.insertTextLink(link);
      let outcome = await settleWithin(insert, INSERT_WAIT_MS);
      if (outcome.done) {
        log(`insert replied ${JSON.stringify(outcome.value)}`);
      } else {
        // The one thing this build is for: does an insert with no plugin view
        // wait for one? Show the view once and see whether it completes.
        log(`insert: NO REPLY within ${INSERT_WAIT_MS}ms, showing plugin view`);
        try {PluginManager.showPluginView();} catch (e) {log(`showPluginView threw ${String(e)}`);}
        outcome = await settleWithin(insert, INSERT_WAIT_MS);
        log(outcome.done ? `insert replied after showPluginView ${JSON.stringify(outcome.value)}` : 'insert still no reply after showPluginView');
        try {PluginManager.closePluginView();} catch (e) {log(`closePluginView threw ${String(e)}`);}
      }
      const inserted = outcome.done ? value<number>(outcome.value) : undefined;
      log(`save after insert: ${JSON.stringify(await settleWithin(PluginNoteAPI.saveCurrentNote(), INSERT_WAIT_MS).catch(e => String(e)))}`);
      summary = inserted !== undefined && inserted >= 0 ? 'Link test: link placed' : `Link test: insert failed (${outcome.done ? JSON.stringify(outcome.value) : 'no reply'})`;
    }
  } catch (error) {
    summary = `Link test error: ${error instanceof Error ? error.message : String(error)}`;
    log(summary);
  } finally {
    try {
      if (source) {
        const back = await whereAmI();
        if (!back || back.path !== source.path || back.pageIndex !== source.pageIndex) {
          await navigateToTarget({path: source.path, page: source.pageIndex + 1});
          log('return navigateToTarget resolved');
          if (!(await arrive(source.path, source.pageIndex, log))) {summary += ' · could not return';}
        }
      }
    } catch (error) {
      log(`return failed: ${String(error)}`);
      summary += ' · could not return';
    }
    log(`summary: ${summary}`);
    await module.appendTestLog(lines.join('\n') + '\n\n').catch(() => {});
    try {ToastAndroid.show(summary, ToastAndroid.LONG);} catch {}
    running = false;
  }
}
