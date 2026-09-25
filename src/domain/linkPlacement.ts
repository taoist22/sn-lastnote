// Ported from sn-linker, where it was confirmed on device: the tap marks the
// link's left edge and vertical centre.
export type PageSize = {width: number; height: number};
export type TapPoint = {x: number; y: number};
export type LinkSource = {path: string; pageIndex: number};

export function linkLabel(source: LinkSource): string {
  const name = (source.path.split('/').pop() || 'Note').replace(/\.note$/i, '');
  return `${name} · p.${source.pageIndex + 1}`;
}

export function buildTextLinkAt(source: LinkSource, label: string, size: PageSize, point: TapPoint) {
  const text = label.trim();
  if (!text) {throw new Error('Enter a label for the link.');}
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width < 300 || size.height < 300) {
    throw new Error('Could not determine the page size.');
  }
  const scale = Math.min(size.width, size.height) / 1404;
  const margin = Math.round(100 * scale);
  const fontSize = Math.max(16, Math.round(30 * scale));
  const height = Math.round(70 * scale);
  const width = Math.min(size.width - margin * 2, Math.max(300 * scale, text.length * fontSize * 0.65 + 70 * scale));
  const left = Math.max(0, Math.min(point.x, size.width - width));
  const top = Math.max(0, Math.min(point.y - height / 2, size.height - height));
  return {
    category: 0, linkType: 0, destPath: source.path, destPage: source.pageIndex, style: 0,
    rect: {left: Math.round(left), top: Math.round(top), right: Math.round(left + width), bottom: Math.round(top + height)},
    fontSize, fullText: text, showText: text, isItalic: 0,
  };
}
