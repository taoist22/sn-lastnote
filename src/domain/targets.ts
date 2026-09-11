import type {NavigationTarget} from './navigation';

export interface TargetItem extends NavigationTarget {
  id?: string;
  name: string;
  page: number;
  label?: string;
}

/** Keep the first bookmark for each exact file/page destination. */
export function uniqueTargets(targets: TargetItem[]): TargetItem[] {
  const seen = new Set<string>();
  return targets.filter(target => {
    const key = JSON.stringify([target.path, target.page]);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function readTargets(
  raw: string | null,
  here?: string,
  there?: string,
): TargetItem[] {
  if (raw != null) {
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.some(
        t =>
          !t ||
          typeof t.path !== 'string' ||
          !t.path ||
          !Number.isInteger(t.page) ||
          t.page < 0,
      )
    ) {
      throw new Error('Saved targets are invalid.');
    }
    return uniqueTargets(
      parsed.map((t: TargetItem, i: number) => ({
        ...t,
        name: t.name || t.path.split('/').pop() || 'Note',
        id: t.id || `${t.path}:${t.page}:${i}`,
      })),
    );
  }
  return Array.from(new Set([here, there].filter((p): p is string => !!p))).map(
    (path, i) => ({
      id: `${path}:0:${i}`,
      name: path.split('/').pop() || 'Note',
      path,
      page: 0,
    }),
  );
}

export function clampPage(page: number, total?: number): number {
  const upper = total && total > 0 ? total : Number.MAX_SAFE_INTEGER;
  return Math.max(1, Math.min(upper, Math.floor(Number(page) || 1)));
}

export function currentUiPage(response: unknown): number | undefined {
  const res = response as {success?: boolean; result?: number} | null;
  return res?.success && Number.isInteger(res.result) && Number(res.result) >= 0
    ? Number(res.result) + 1
    : undefined;
}

export function chooseToggleTarget(
  targets: TargetItem[],
  path: string | null,
  page?: number,
  last?: NavigationTarget,
): TargetItem | undefined {
  if (targets.length < 2) {
    return targets[0];
  }
  const matching = targets
    .map((t, i) => ({t, i}))
    .filter(({t}) => t.path === path);
  let index = matching.find(({t}) => t.page === page || t.page === 0)?.i;
  if (index == null && matching.length === 1) {
    index = matching[0].i;
  }
  if (index == null && last) {
    index = targets.findIndex(
      t => t.path === last.path && t.page === last.page,
    );
  }
  return targets[
    index != null && index >= 0 ? (index + 1) % targets.length : 0
  ];
}
