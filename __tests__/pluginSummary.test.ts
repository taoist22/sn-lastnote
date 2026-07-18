import {getPluginSummary} from '../src/domain/pluginSummary';

describe('getPluginSummary', () => {
  it('returns the plugin description', () => {
    expect(getPluginSummary()).toBe('1-Tap toggle back to your last viewed note.');
  });
});
