import {restoreOverlay} from '../src/domain/overlayStartup';
function native(restoreOnLoad = false, showing = false) {
  return {
    getOverlaySettings: jest
      .fn()
      .mockResolvedValue({rememberPosition: false, restoreOnLoad}),
    isOverlayShowing: jest.fn().mockResolvedValue(showing),
    showOverlay: jest.fn().mockResolvedValue(true),
  };
}
it('does not show the button unless restoration is enabled', async () => {
  const module = native();
  expect(await restoreOverlay(module)).toBe(false);
  expect(module.showOverlay).not.toHaveBeenCalled();
});
it('restores the button on plugin load when enabled', async () => {
  const module = native(true);
  expect(await restoreOverlay(module)).toBe(true);
  expect(module.showOverlay).toHaveBeenCalledTimes(1);
});
it('keeps an existing button without recreating it', async () => {
  const module = native(true, true);
  expect(await restoreOverlay(module)).toBe(true);
  expect(module.showOverlay).not.toHaveBeenCalled();
});
it('does not claim the button is showing if native restoration fails', async () => {
  const module = native(true);
  module.showOverlay.mockRejectedValue(new Error('Overlay unavailable'));
  await expect(restoreOverlay(module)).rejects.toThrow('Overlay unavailable');
});
