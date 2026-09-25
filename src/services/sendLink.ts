import {DeviceEventEmitter, NativeModules, ToastAndroid} from 'react-native';
import {PluginCommAPI, PluginFileAPI, PluginNoteAPI} from 'sn-plugin-lib';
import {buildTextLinkAt, linkLabel, LinkSource, PageSize} from '../domain/linkPlacement';
import {readTargets, TargetItem} from '../domain/targets';
import {ensureFileReadPermission, ensureFileWritePermission} from '../pluginPermissions';
import {navigateToTarget} from './fileNavigation';

// Send Link: lasso a note, tap the floating button, pick a bookmarked notebook
// page. That page opens, the user taps where the link goes, the link is placed
// and LastNote returns to the source page. Every run appends its steps to
// MyStyle/LastNote/send-link-log.txt.
//
// JS timers stop once another note opens (confirmed on device: a 250 ms poll
// took 77 s), so every wait here is the native module's delay().

type Response<T> = {success?: boolean; result?: T; error?: {message?: string}};
type Event = {name: string; data: any};

const POPUP_WAIT_MS = 60000;
const TAP_WAIT_MS = 30000;
const ARRIVE_WAIT_MS = 8000;
const CALL_WAIT_MS = 8000;
const LASSO_CHECK_MS = 1500;
const POLL_MS = 250;

let running = false;

function native() {return NativeModules.LastNote;}
const wait = (ms: number): Promise<void> => native().delay(ms);

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

// Listen before triggering, so a fast reply is never missed.
export function nextEvent(names: string[], ms: number): Promise<Event | null> {
  return new Promise(resolve => {
    let finished = false;
    const subs = names.map(name => DeviceEventEmitter.addListener(name, data => done({name, data})));
    wait(ms).then(() => done(null), () => done(null));
    function done(result: Event | null) {
      if (finished) {return;}
      finished = true;
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

// A tap on the floating button means Send Link only while something is
// lassoed in a notebook; otherwise it keeps its usual toggle.
export async function lassoIsActive(): Promise<boolean> {
  try {
    const here = await whereAmI();
    if (!here || !/\.note$/i.test(here.path)) {return false;}
    const rect = await settleWithin(PluginCommAPI.getLassoRect(), LASSO_CHECK_MS);
    const box = rect.done ? value<{left: number; top: number; right: number; bottom: number}>(rect.value) : undefined;
    return !!box && box.right > box.left && box.bottom > box.top;
  } catch {
    return false;
  }
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

export async function runSendLink(): Promise<void> {
  const module = native();
  if (!module || running) {return;}
  running = true;
  const started = Date.now();
  const lines: string[] = [];
  const log = (line: string) => {lines.push(`${String(Date.now() - started).padStart(6)}ms  ${line}`);};
  let summary = 'Send Link stopped';
  let source: LinkSource | null = null;
  try {
    log(`--- Send Link ${new Date().toISOString()} native build ${await module.getNativeBuild().catch(() => '?')}`);
    if (!(await ensureFileReadPermission()) || !(await ensureFileWritePermission())) {
      summary = 'Send Link: file access was not allowed';
      log(summary);
      return;
    }
    source = await whereAmI();
    log(`source ${JSON.stringify(source)}`);
    if (!source || !/\.note$/i.test(source.path)) {summary = 'Send Link: open a notebook first'; log(summary); return;}

    const targets: TargetItem[] = readTargets(await module.readPresets()).filter(t => /\.note$/i.test(t.path));
    log(`notebook bookmarks: ${targets.length}`);
    if (!targets.length) {summary = 'Send Link: bookmark a notebook page in LastNote first'; log(summary); return;}

    // Clear the selection so it is not left hanging over the source page.
    const cleared = await settleWithin(PluginCommAPI.setLassoBoxState(2), CALL_WAIT_MS);
    log(`lasso cleared: ${JSON.stringify(cleared)}`);

    const picked = nextEvent(['onLinkDestination', 'onLinkPopupClosed'], POPUP_WAIT_MS);
    await module.showLinkPopup(targets.map(t => ({name: t.name, path: t.path, page: t.page, label: t.label ?? null})));
    const choice = await picked;
    if (!choice || choice.name !== 'onLinkDestination') {
      await module.hidePopup().catch(() => {});
      summary = 'Send Link: no bookmark chosen';
      log(`popup ended: ${choice ? choice.name : 'timeout'}`);
      return;
    }
    const dest = {path: absolutePath(String(choice.data.path)), page: Number(choice.data.page)};
    log(`chose ${JSON.stringify(dest)} sameNotebook=${dest.path === source.path}`);
    if (dest.path === source.path && dest.page - 1 === source.pageIndex) {summary = 'Send Link: that bookmark is this page'; log(summary); return;}

    log(`save before leaving: ${JSON.stringify(await settleWithin(PluginNoteAPI.saveCurrentNote(), CALL_WAIT_MS))}`);
    await navigateToTarget({path: dest.path, page: dest.page});
    log('navigateToTarget resolved');
    if (!(await arrive(dest.path, dest.page > 0 ? dest.page - 1 : null, log))) {summary = 'Send Link: the bookmark did not open'; return;}

    const tapped = nextEvent(['onLinkTap', 'onLinkTapCancel'], TAP_WAIT_MS + 5000);
    await module.showTapLayer(`Tap where the link goes · ${dest.path.split('/').pop()}`, TAP_WAIT_MS);
    log('tap layer shown');
    const tap = await tapped;
    await module.hideTapLayer().catch(() => {});
    if (!tap || tap.name !== 'onLinkTap') {
      summary = 'Send Link: cancelled, nothing placed';
      log(`tap ended: ${tap ? JSON.stringify(tap.data) : 'no event'}`);
      return;
    }
    log(`tap ${JSON.stringify(tap.data)} (tool 1=finger 2=pen)`);
    const here = await whereAmI();
    log(`page at tap ${JSON.stringify(here)}`);
    if (!here || here.path !== dest.path) {summary = 'Send Link: the page changed, nothing placed'; log(summary); return;}
    let size = value<PageSize>(await PluginCommAPI.getPageDisplaySize().catch(() => null));
    if (!size) {size = value<PageSize>(await PluginFileAPI.getPageSize(here.path, here.pageIndex).catch(() => null));}
    log(`page size ${JSON.stringify(size)}`);
    const link = buildTextLinkAt(source, linkLabel(source), size || {width: 0, height: 0}, {x: tap.data.x, y: tap.data.y});
    log(`insertTextLink ${JSON.stringify(link.rect)} -> ${link.destPath} p.${link.destPage + 1}`);
    const outcome = await settleWithin(PluginNoteAPI.insertTextLink(link), CALL_WAIT_MS);
    log(outcome.done ? `insert replied ${JSON.stringify(outcome.value)}` : `insert: NO REPLY within ${CALL_WAIT_MS}ms`);
    const inserted = outcome.done ? value<number>(outcome.value) : undefined;
    if (inserted === undefined || inserted < 0) {
      summary = inserted === -2 ? 'Send Link: that notebook needs a format upgrade' : 'Send Link: the link could not be placed';
      return;
    }
    const saved = await settleWithin(PluginNoteAPI.saveCurrentNote(), CALL_WAIT_MS);
    log(`save after insert: ${JSON.stringify(saved)}`);
    // Insertion already happened; a save failure must not invite a duplicate.
    summary = saved.done && value<boolean>(saved.value) === true
      ? 'Link placed' : 'Link placed, but saving was not confirmed. Check that page before sending again.';
  } catch (error) {
    summary = `Send Link error: ${error instanceof Error ? error.message : String(error)}`;
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
