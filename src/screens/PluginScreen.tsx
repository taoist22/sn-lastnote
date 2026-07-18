import React from 'react';
import {SafeAreaView, StyleSheet, Text, View} from 'react-native';
import {getPluginSummary} from '../domain/pluginSummary';

export function PluginScreen(): React.JSX.Element {
  const summary = getPluginSummary();

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.panel}>
        <Text style={styles.title}>LastNote</Text>
        <Text style={styles.body}>{summary}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8f8f2',
    padding: 16,
  },
  panel: {
    borderColor: '#202020',
    borderRadius: 6,
    borderWidth: 1,
    padding: 16,
  },
  title: {
    color: '#202020',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    color: '#202020',
    fontSize: 16,
    lineHeight: 22,
  },
});
