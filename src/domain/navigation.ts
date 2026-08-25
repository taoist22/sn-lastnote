export interface NavigationTarget {
  path: string;
  page?: number;
}

export interface NavigationDependencies {
  getCurrentFilePath: () => Promise<unknown>;
  jumpToPage: (page: number) => Promise<unknown>;
  openFile: (path: string, page: number) => Promise<unknown>;
  openNativeFallback: (target: NavigationTarget) => Promise<void>;
}

type ApiResult<T> = {
  success?: boolean;
  result?: T;
};

export function uiPageToApiPage(page?: number): number {
  return Number.isInteger(page) && Number(page) > 0 ? Number(page) - 1 : -1;
}

export function extractCurrentPath(response: unknown): string | null {
  const path = (response as ApiResult<string> | null | undefined)?.result;
  return typeof path === 'string' && path.length > 0 ? path : null;
}

function apiSucceeded(response: unknown): boolean {
  const result = response as ApiResult<boolean> | null | undefined;
  return result?.success === true && result.result === true;
}

export async function navigateToTargetWith(
  target: NavigationTarget,
  dependencies: NavigationDependencies,
): Promise<void> {
  if (!target.path) throw new Error('Target file path is empty.');

  const apiPage = uiPageToApiPage(target.page);
  try {
    const currentPath = extractCurrentPath(
      await dependencies.getCurrentFilePath(),
    );

    if (currentPath === target.path) {
      if (apiPage < 0) return;
      if (apiSucceeded(await dependencies.jumpToPage(apiPage))) return;
    } else if (
      apiSucceeded(await dependencies.openFile(target.path, apiPage))
    ) {
      return;
    }
  } catch (error) {
    console.warn('LastNote official navigation failed; using native fallback.', error);
  }

  await dependencies.openNativeFallback(target);
}
