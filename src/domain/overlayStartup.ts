export interface OverlaySettings {
  rememberPosition: boolean;
  restoreOnLoad: boolean;
}

export async function restoreOverlay(module: {
  getOverlaySettings(): Promise<OverlaySettings>;
  isOverlayShowing(): Promise<boolean>;
  showOverlay(): Promise<unknown>;
}): Promise<boolean> {
  const settings = await module.getOverlaySettings();
  if (await module.isOverlayShowing()) return true;
  if (!settings.restoreOnLoad) return false;
  await module.showOverlay();
  return true;
}
