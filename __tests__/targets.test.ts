import {
  chooseToggleTarget,
  clampPage,
  currentUiPage,
  readTargets,
} from '../src/domain/targets';

const a = {path: 'a.note', name: 'A', page: 0};
const b = {path: 'b.note', name: 'B', page: 0};

describe('saved targets and toggle selection', () => {
  it('keeps an explicitly empty list empty despite stale legacy files', () => {
    expect(readTargets('[]', a.path, b.path)).toEqual([]);
  });
  it('migrates only missing presets and preserves last-viewed behavior', () => {
    expect(readTargets(null, a.path, a.path)).toEqual([
      expect.objectContaining({path: a.path, page: 0}),
    ]);
    expect(() => readTargets('{}', a.path)).toThrow();
    expect(() => readTargets('[{"path":"a","page":-1}]')).toThrow();
  });
  it('chooses the other note regardless of saved order', () => {
    expect(chooseToggleTarget([a, b], b.path, 8)).toEqual(a);
    expect(chooseToggleTarget([a, b], a.path, 8)).toEqual(b);
    expect(chooseToggleTarget([a, b], 'c.note')).toEqual(a);
  });
  it('switches same-note bookmarks using the current page', () => {
    const pages = [
      {...a, page: 2},
      {...a, page: 23},
    ];
    expect(chooseToggleTarget(pages, a.path, 23)).toEqual(pages[0]);
    expect(chooseToggleTarget(pages, a.path, 2)).toEqual(pages[1]);
    expect(chooseToggleTarget(pages, a.path, undefined, pages[0])).toEqual(
      pages[1],
    );
    expect(chooseToggleTarget([a], b.path)).toEqual(a);
    expect(chooseToggleTarget([], a.path)).toBeUndefined();
  });
  it('converts current pages and rejects failed results', () => {
    expect(currentUiPage({success: true, result: 0})).toBe(1);
    expect(currentUiPage({success: false, result: 2})).toBeUndefined();
    expect(currentUiPage(null)).toBeUndefined();
  });
  it('bounds pages without an artificial 999-page limit', () => {
    expect(clampPage(11, 10)).toBe(10);
    expect(clampPage(-1, 10)).toBe(1);
    expect(clampPage(1200)).toBe(1200);
  });
});

it('removes duplicate destinations loaded for the dashboard and floating menu', () => {
  const targets = readTargets(
    JSON.stringify([
      {...a, id: 'first', page: 6},
      {...a, id: 'duplicate', page: 6},
      {...a, id: 'other-page', page: 7},
      {...b, page: 6},
      {...a, page: 0},
    ]),
  );
  expect(targets).toHaveLength(4);
  expect(targets[0].id).toBe('first');
});
