import {
  ensureFileReadPermission,
  ensurePluginPermission,
  FILE_READ_PERMISSION,
} from '../src/pluginPermissions';
import {PluginManager} from 'sn-plugin-lib';

jest.mock('sn-plugin-lib', () => ({
  PluginManager: {
    hasPermission: jest.fn(),
    requestPermission: jest.fn(),
  },
}));

const manager = PluginManager as jest.Mocked<typeof PluginManager>;

describe('plugin permissions', () => {
  beforeEach(() => {
    manager.hasPermission.mockReset();
    manager.requestPermission.mockReset();
  });

  it('does not prompt when access is already granted', async () => {
    manager.hasPermission.mockResolvedValue(1);
    await expect(ensureFileReadPermission()).resolves.toBe(true);
    expect(manager.requestPermission).not.toHaveBeenCalled();
  });

  it('requests missing access', async () => {
    manager.hasPermission.mockResolvedValue(0);
    manager.requestPermission.mockResolvedValue(1);
    await expect(ensureFileReadPermission()).resolves.toBe(true);
    expect(manager.requestPermission).toHaveBeenCalledWith(
      FILE_READ_PERMISSION,
      expect.stringContaining('LastNote'),
    );
  });

  it('coalesces simultaneous permission requests', async () => {
    let resolveRequest: (value: number) => void = () => undefined;
    manager.hasPermission.mockResolvedValue(0);
    manager.requestPermission.mockReturnValue(
      new Promise<number>(resolve => {
        resolveRequest = resolve;
      }),
    );

    const first = ensurePluginPermission(FILE_READ_PERMISSION, 'first');
    const second = ensurePluginPermission(FILE_READ_PERMISSION, 'second');
    await Promise.resolve();
    resolveRequest(1);

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(manager.requestPermission).toHaveBeenCalledTimes(1);
  });
});
