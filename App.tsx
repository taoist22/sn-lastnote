import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  FlatList,
  NativeModules,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {PluginCommAPI, PluginManager} from 'sn-plugin-lib';

// Root entries shown before the user drills into a folder
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
  const [items, setItems]             = useState<DirItem[]>(ROOTS);
  const [loading, setLoading]         = useState(false);
  const [currentPath, setCurrentPath] = useState('');  // note we're pairing WITH
  const [dirStack, setDirStack]       = useState<string[]>([]);  // breadcrumb stack

  // openCount increments each time the view becomes active; drives re-init
  const openCountRef = useRef(0);

  // Called on every mount — reset to root and reload current note path
  useEffect(() => {
    openCountRef.current += 1;
    setDirStack([]);
    setItems(ROOTS);
    PluginCommAPI.getCurrentFilePath().then(res => {
      setCurrentPath((res?.result as string) || '');
    }).catch(() => {});
  }, []); // runs once per mount; component remounts each time showPluginView is called

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
    if (dirStack.length === 0) {
      // Already at root
      return;
    }
    if (dirStack.length === 1) {
      // Back to root selector
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
    if (!item.path || item.path === currentPath) return;
    try {
      await NativeModules.LastNote.writePair(currentPath, item.path);
    } catch (e) {
      console.error('LastNote: writePair failed', e);
    }
    // Close immediately — no intermediate state, prevents stuck-screen on reopen
    PluginManager.closePluginView();
  }, [currentPath]);

  const handleCancel = useCallback(() => {
    PluginManager.closePluginView();
  }, []);

  const atRoot = dirStack.length === 0;
  const currentDirName = atRoot
    ? 'Choose Note or Document'
    : dirStack[dirStack.length - 1].split('/').pop() || '';
  const currentNoteName = currentPath.split('/').pop() || '—';

  const renderItem = ({item}: {item: DirItem}) => {
    const isCurrent = item.path === currentPath;
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
        style={[styles.item, isCurrent && styles.itemDimmed]}
        onPress={() => !isCurrent && handleSelectFile(item)}
        disabled={isCurrent}>
        <View style={styles.itemRow}>
          <Text style={styles.fileIcon}>{icon}</Text>
          <View style={styles.fileInfo}>
            <Text style={[styles.fileName, isCurrent && styles.dimText]}>
              {item.name}
            </Text>
            {isCurrent && (
              <Text style={styles.currentTag}>current note</Text>
            )}
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
          {!atRoot && (
            <TouchableOpacity style={styles.backBtn} onPress={goBack}>
              <Text style={styles.backText}>‹ Back</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {currentDirName}
          </Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          Pairing with: <Text style={styles.bold}>{currentNoteName}</Text>
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.body}>Loading…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.body}>No notes or folders here.</Text>
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
  root:       {flex: 1, backgroundColor: '#fff'},
  header:     {paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
               borderBottomWidth: 2, borderBottomColor: '#111'},
  headerRow:  {flexDirection: 'row', alignItems: 'center',
               justifyContent: 'space-between', marginBottom: 8},
  backBtn:    {paddingRight: 10},
  backText:   {fontSize: 18, color: '#333', fontWeight: '600'},
  title:      {flex: 1, fontSize: 20, fontWeight: '800', color: '#000',
               textAlign: 'center', marginHorizontal: 4},
  cancelBtn:  {paddingHorizontal: 10, paddingVertical: 5,
               borderWidth: 1, borderColor: '#666', borderRadius: 4},
  cancelText: {fontSize: 14, color: '#333'},
  subtitle:   {fontSize: 14, color: '#555'},
  bold:       {fontWeight: '700', color: '#000'},
  center:     {flex: 1, justifyContent: 'center', alignItems: 'center'},
  body:       {fontSize: 16, color: '#777'},
  sep:        {height: 1, backgroundColor: '#e8e8e8'},
  item:       {paddingVertical: 16, paddingHorizontal: 20, backgroundColor: '#fff'},
  itemDimmed: {backgroundColor: '#f5f5f5'},
  itemRow:    {flexDirection: 'row', alignItems: 'center'},
  folderIcon: {fontSize: 22, marginRight: 12},
  folderName: {flex: 1, fontSize: 18, fontWeight: '600', color: '#000'},
  chevron:    {fontSize: 22, color: '#aaa', fontWeight: '300'},
  fileIcon:   {fontSize: 22, marginRight: 12},
  fileInfo:   {flex: 1},
  fileName:   {fontSize: 17, fontWeight: '500', color: '#000'},
  dimText:    {color: '#bbb'},
  currentTag: {fontSize: 12, color: '#888', marginTop: 2},
});
