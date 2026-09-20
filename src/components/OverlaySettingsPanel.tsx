import React, {useEffect, useRef, useState} from 'react';
import {
  NativeModules,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {OverlaySettings} from '../domain/overlayStartup';

export function OverlaySettingsPanel() {
  const [settings, setSettings] = useState<OverlaySettings | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const load = async () => {
    try {
      setSettings(await NativeModules.LastNote.getOverlaySettings());
      setError('');
    } catch {
      setError('Could not load floating button settings. Tap to retry.');
    }
  };
  useEffect(() => {
    load();
  }, []);
  const change = async (key: keyof OverlaySettings) => {
    if (!settings || saving.current) return;
    saving.current = true;
    setBusy(true);
    const updated = {...settings, [key]: !settings[key]};
    try {
      await NativeModules.LastNote.setOverlaySettings(
        updated.rememberPosition,
        updated.restoreOnLoad,
      );
      setSettings(updated);
      setError('');
    } catch {
      setError('Could not save. Tap the option again to retry.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Floating button</Text>
      {settings && (
        <>
          {(['rememberPosition', 'restoreOnLoad'] as const).map(key => (
            <TouchableOpacity
              key={key}
              accessibilityRole="checkbox"
              accessibilityState={{checked: settings[key], disabled: busy}}
              disabled={busy}
              onPress={() => change(key)}
              style={styles.option}>
              <Text style={styles.text}>
                {settings[key] ? '☑' : '☐'}{' '}
                {key === 'rememberPosition'
                  ? 'Remember button position'
                  : 'Restore button when LastNote loads'}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.help}>
            Restoring after a reboot may require opening a note or document
            first. This does not start LastNote at device boot.
          </Text>
        </>
      )}
      {!!error && (
        <TouchableOpacity onPress={settings ? undefined : load}>
          <Text style={styles.text}>{error}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {margin: 12, padding: 12, borderWidth: 1, borderColor: '#000'},
  title: {fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 6},
  option: {alignSelf: 'flex-start', paddingVertical: 8},
  text: {fontSize: 15, color: '#000'},
  help: {fontSize: 13, color: '#333', marginTop: 4},
});
