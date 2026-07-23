import React, {useCallback, useEffect, useState} from 'react';
import {
  DeviceEventEmitter,
  FlatList,
  NativeModules,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';

const ROOTS = [
  {name: 'Notes', path: '/storage/emulated/0/Note', isDir: true},
  {name: 'Documents', path: '/storage/emulated/0/Document', isDir: true},
];

interface DirItem {
  name: string;
  path: string;
  isDir: boolean;
}

export default function App(): React.JSX.Element {
  const [items, setItems]         = useState<DirItem[]>(ROOTS);
  const [loading, setLoading]     = useState(false);
  const [dirStack, setDirStack]   = useState<string[]>([]);
  const [noteA, setNoteA]         = useState<string | null>(null);
  const [noteB, setNoteB]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('B');

  const loadCurrentPair = useCallback(async () => {
    setDirStack([]);
    setItems(ROOTS);
    try {
      const [hereVal, thereVal] = await Promise.all([
        NativeModules.LastNote.readHere(),
        NativeModules.LastNote.readThere(),
      ]);
      setNoteA(hereVal || null);
      setNoteB(thereVal || null);
      // If Note A isn't set yet, target A first; otherwise default to targeting B
      setActiveTab(hereVal ? 'B' : 'A');
    } catch (e) {
      setActiveTab('A');
    }
  }, []);

  useEffect(() => {
    loadCurrentPair();
    const sub = DeviceEventEmitter.addListener('onFloatingLongPress', () => {
      loadCurrentPair();
    });
    return () => {
      sub.remove();
    };
  }, [loadCurrentPair]);

  const navigateTo = useCallback(async (dirPath: string) => {
    setLoading(true);
    try {
      const result: DirItem[] = await NativeModules.LastNote.listDirectory(dirPath);
      setDirStack(prev => [...prev, dirPath]);
      setItems(result);
    } catch (e) {
      console.error('LastNote: listDirectory failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const goBack = useCallback(async () => {
    if (dirStack.length === 0) return;
    if (dirStack.length === 1) {
      setDirStack([]);
      setItems(ROOTS);
      return;
    }
    const newStack = dirStack.slice(0, -1);
    const parentPath = newStack[newStack.length - 1];
    setLoading(true);
    try {
      const result: DirItem[] = await NativeModules.LastNote.listDirectory(parentPath);
      setDirStack(newStack);
      setItems(result);
    } catch (e) {
      console.error('LastNote: listDirectory failed', e);
    } finally {
      setLoading(false);
    }
  }, [dirStack]);

  const handleSelectFile = useCallback(async (item: DirItem) => {
    if (activeTab === 'A') {
      const newA = item.path;
      setNoteA(newA);
      if (!noteB) {
        // If Note B isn't set yet, automatically switch active tab to B
        setActiveTab('B');
        setDirStack([]);
        setItems(ROOTS);
      } else {
        // Note B is already set -> save new pair and close
        if (newA === noteB) return;
        try {
          await NativeModules.LastNote.writePair(newA, noteB);
        } catch (e) {
          console.error('LastNote: writePair failed', e);
        }
        PluginManager.closePluginView();
      }
    } else {
      // activeTab === 'B'
      const newB = item.path;
      const targetA = noteA || item.path;
      if (targetA === newB && noteA) return;
      try {
        await NativeModules.LastNote.writePair(targetA, newB);
      } catch (e) {
        console.error('LastNote: writePair failed', e);
      }
      PluginManager.closePluginView();
    }
  }, [activeTab, noteA, noteB]);

  const handleCancel = useCallback(() => {
    PluginManager.closePluginView();
  }, []);

  const atRoot = dirStack.length === 0;
  const noteAName = noteA ? noteA.split('/').pop() : 'Select Note A';
  const noteBName = noteB ? noteB.split('/').pop() : 'Select Note B';

  const renderItem = ({item}: {item: DirItem}) => {
    const isNoteA = item.path === noteA;
    const isNoteB = item.path === noteB;
    const isSelected = activeTab === 'A' ? isNoteA : isNoteB;

    if (item.isDir) {
      return (
        <TouchableOpacity style={styles.item} onPress={() => navigateTo(item.path)}>
          <View style={styles.itemRow}>
            <Text style={styles.folderIcon}>📁</Text>
            <Text style={styles.folderName}>{item.name}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </TouchableOpacity>
      );
    }
    const ext = item.name.toLowerCase();
    const icon = ext.endsWith('.note') ? '📓' : '📄';
    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.itemDimmed]}
        onPress={() => !isSelected && handleSelectFile(item)}
        disabled={isSelected}>
        <View style={styles.itemRow}>
          <Text style={styles.fileIcon}>{icon}</Text>
          <View style={styles.fileInfo}>
            <Text style={[styles.fileName, isSelected && styles.dimText]}>
              {item.name}
            </Text>
            {isNoteA && <Text style={styles.tagText}>Note A</Text>}
            {isNoteB && <Text style={styles.tagText}>Note B</Text>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {!atRoot ? (
            <TouchableOpacity style={styles.backBtn} onPress={goBack}>
              <Text style={styles.backText}>‹ Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{width: 50}} />
          )}
          <Text style={styles.title} numberOfLines={1}>
            Pair Configuration
          </Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Note A / Note B Selector Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBox, activeTab === 'A' && styles.activeTabBox]}
            onPress={() => setActiveTab('A')}>
            <Text style={styles.tabLabel}>NOTE A</Text>
            <Text style={styles.tabVal} numberOfLines={1}>
              {noteAName}
            </Text>
          </TouchableOpacity>

          <Text style={styles.swapIcon}>⇄</Text>

          <TouchableOpacity
            style={[styles.tabBox, activeTab === 'B' && styles.activeTabBox]}
            onPress={() => setActiveTab('B')}>
            <Text style={styles.tabLabel}>NOTE B</Text>
            <Text style={styles.tabVal} numberOfLines={1}>
              {noteBName}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          {activeTab === 'A'
            ? 'Tap a file below to replace Note A'
            : 'Tap a file below to replace Note B'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.body}>Loading…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.body}>No files or folders found.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.path}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        {flex: 1, backgroundColor: '#fff'},
  header:      {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
                borderBottomWidth: 2, borderBottomColor: '#111'},
  headerRow:   {flexDirection: 'row', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 12},
  backBtn:     {paddingRight: 10},
  backText:    {fontSize: 18, color: '#333', fontWeight: '600'},
  title:       {flex: 1, fontSize: 20, fontWeight: '800', color: '#000', textAlign: 'center'},
  cancelBtn:   {paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#666', borderRadius: 4},
  cancelText:  {fontSize: 14, color: '#333'},

  tabContainer:{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8},
  tabBox:      {flex: 1, borderWidth: 1.5, borderColor: '#ccc', borderRadius: 6, padding: 8, backgroundColor: '#f9f9f9'},
  activeTabBox:{borderColor: '#000', backgroundColor: '#eef3ff'},
  tabLabel:    {fontSize: 11, fontWeight: '800', color: '#555', marginBottom: 2},
  tabVal:      {fontSize: 14, fontWeight: '600', color: '#000'},
  swapIcon:    {fontSize: 20, marginHorizontal: 8, color: '#444'},

  hint:        {fontSize: 13, color: '#666', textAlign: 'center', marginTop: 4},
  center:      {flex: 1, justifyContent: 'center', alignItems: 'center'},
  body:        {fontSize: 16, color: '#777'},
  sep:         {height: 1, backgroundColor: '#e8e8e8'},
  item:        {paddingVertical: 16, paddingHorizontal: 20, backgroundColor: '#fff'},
  itemDimmed:  {backgroundColor: '#f5f5f5'},
  itemRow:     {flexDirection: 'row', alignItems: 'center'},
  folderIcon:  {fontSize: 22, marginRight: 12},
  folderName:  {flex: 1, fontSize: 18, fontWeight: '600', color: '#000'},
  chevron:     {fontSize: 22, color: '#aaa', fontWeight: '300'},
  fileIcon:    {fontSize: 22, marginRight: 12},
  fileInfo:    {flex: 1},
  fileName:    {fontSize: 17, fontWeight: '500', color: '#000'},
  dimText:     {color: '#bbb'},
  tagText:     {fontSize: 12, color: '#0066cc', fontWeight: '700', marginTop: 2},
});
