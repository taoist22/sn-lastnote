import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {NativeModules, TouchableOpacity} from 'react-native';
import {OverlaySettingsPanel} from '../src/components/OverlaySettingsPanel';

it('saves options independently and retains the old setting when persistence fails', async () => {
  const save = jest.fn().mockResolvedValue(true);
  NativeModules.LastNote = {
    getOverlaySettings: async () => ({
      rememberPosition: false,
      restoreOnLoad: false,
    }),
    setOverlaySettings: save,
  };
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<OverlaySettingsPanel />);
  });
  const options = () =>
    tree.root
      .findAllByType(TouchableOpacity)
      .filter(b => b.props.accessibilityRole === 'checkbox');
  await act(async () => {
    await options()[0].props.onPress();
  });
  expect(save).toHaveBeenLastCalledWith(true, false);
  expect(options()[0].props.accessibilityState.checked).toBe(true);
  save.mockRejectedValueOnce(new Error('Disk error'));
  await act(async () => {
    await options()[1].props.onPress();
  });
  expect(options()[1].props.accessibilityState.checked).toBe(false);
  await act(async () => {
    await options()[1].props.onPress();
  });
  expect(save).toHaveBeenLastCalledWith(true, true);
  expect(options()[1].props.accessibilityState.checked).toBe(true);
  await act(async () => {
    tree.unmount();
  });
});
