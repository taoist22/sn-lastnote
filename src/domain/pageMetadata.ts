export interface NativeTitle {
  page?: number;
  title?: string;
  name?: string;
  fullText?: string;
}

export function buildPageList(totalPages: number): number[] {
  const safeTotal = Number.isFinite(totalPages)
    ? Math.max(0, Math.floor(totalPages))
    : 0;
  return Array.from({length: safeTotal}, (_, index) => index);
}

export function buildUiTitleMap(
  titles: NativeTitle[],
  totalPages: number,
): {[page: number]: string} {
  const result: {[page: number]: string} = {};
  for (const item of titles) {
    if (!item || !Number.isInteger(item.page)) continue;
    const nativePage = item.page as number;
    if (nativePage < 0 || nativePage >= totalPages) continue;
    const text = item.title || item.name || item.fullText || '';
    if (text.trim()) result[nativePage + 1] = text.trim();
  }
  return result;
}
