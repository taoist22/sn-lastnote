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
  const [items, setItems]                 = useState<DirItem[]>(ROOTS);
  const [loading, setLoading]             = useState(false);
  const [dirStack, setDirStack]           = useState<string[]>([]);
  const [noteA, setNoteA]                 = useState<string | null>(null);
  const [noteB, setNoteB]                 = useState<string | null>(null);
  const [activeTab, setActiveTab]         = useState<'A' | 'B'>('B');
  const [favorites, setFavorites]         = useState<string[]>([]);
  const [recentFolders, setRecentFolders] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setDirStack([]);
    setItems(ROOTS);
    try {
      const [hereVal, thereVal, favRaw, recRaw] = await Promise.all([
        NativeModules.LastNote.readHere(),
        NativeModules.LastNote.readThere(),
        NativeModules.LastNote.readFavorites(),
        NativeModules.LastNote.readRecentFolders(),
      ]);
      setNoteA(hereVal || null);
      setNoteB(thereVal || null);
      setActiveTab(hereVal ? 'B' : 'A');

      const favs: string[] = favRaw ? JSON.parse(favRaw) : [];
      const recs: string[] = recRaw ? JSON.parse(recRaw) : [];
      setFavorites(favs);
      setRecentFolders(recs);
    } catch (e) {
      setActiveTab('A');
    }
  }, []);

  useEffect(() => {
    loadData();
    const sub = DeviceEventEmitter.addListener('onFloatingLongPress', () => {
      loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  const toggleFavorite = useCallback(
    async (folderPath: string) => {
      const updated = favorites.includes(folderPath)
        ? favorites.filter(p => p !== folderPath)
        : [...favorites, folderPath];
      setFavorites(updated);
      try {
        await NativeModules.LastNote.writeFavorites(JSON.stringify(updated));
      } catch (e) {
        console.error('LastNote: writeFavorites failed', e);
      }
    },
    [favorites],
  );

  const addRecentFolder = useCallback(
    async (folderPath: string) => {
      const filtered = recentFolders.filter(p => p !== folderPath);
      const updated = [folderPath, ...filtered].slice(0, 5);
      setRecentFolders(updated);
      try {
        await NativeModules.LastNote.writeRecentFolders(JSON.stringify(updated));
      } catch (e) {
        console.error('LastNote: writeRecentFolders failed', e);
      }
    },
    [recentFolders],
  );

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

  const handleSelectFile = useCallback(
    async (item: DirItem) => {
      const parentDir = item.path.substring(0, item.path.lastIndexOf('/'));
      if (parentDir) {
        addRecentFolder(parentDir);
      }

      if (activeTab === 'A') {
        const newA = item.path;
        setNoteA(newA);
        if (!noteB) {
          setActiveTab('B');
          setDirStack([]);
          setItems(ROOTS);
        } else {
          if (newA === noteB) return;
          try {
            await NativeModules.LastNote.writePair(newA, noteB);
          } catch (e) {
            console.error('LastNote: writePair failed', e);
          }
          PluginManager.closePluginView();
        }
      } else {
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
    },
    [activeTab, noteA, noteB, addRecentFolder],
  );

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
      const isFav = favorites.includes(item.path);
      return (
        <View style={styles.item}>
          <TouchableOpacity style={styles.itemRowLeft} onPress={() => navigateTo(item.path)}>
            <Text style={styles.folderIcon}>📁</Text>
            <View style={styles.fileInfo}>
              <Text style={styles.folderName}>{item.name}</Text>
              <Text style={styles.pathSubtext}>
                {item.path.replace('/storage/emulated/0/', '')}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.itemRowRight}>
            <TouchableOpacity
              style={styles.starBtn}
              onPress={() => toggleFavorite(item.path)}>
              <Text style={styles.starIcon}>{isFav ? '★' : '☆'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chevronTouch} onPress={() => navigateTo(item.path)}>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const ext = item.name.toLowerCase();
    const icon = ext.endsWith('.note') ? '📓' : '📄';
    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.itemDimmed]}
        onPress={() => !isSelected && handleSelectFile(item)}
        disabled={isSelected}>
        <View style={styles.itemRowLeft}>
          <Text style={styles.fileIcon}>{icon}</Text>
          <View style={styles.fileInfo}>
            <Text style={[styles.fileName, isSelected && styles.dimText]}>
              {item.name}
            </Text>
            {isNoteA && <Text style={styles.tagText}>NOTE A</Text>}
            {isNoteB && <Text style={styles.tagText}>NOTE B</Text>}
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
            <View style={{width: 60}} />
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

      {/* Main Content */}
      {loading ? (
        <View style={styles.center}>
          <Text style={styles.body}>Loading…</Text>
        </View>
      ) : atRoot ? (
        <FlatList
          data={[1]} // single wrapper for root sections
          keyExtractor={() => 'root'}
          renderItem={() => (
            <View style={styles.rootContainer}>
              {/* Favorites Section */}
              {favorites.length > 0 && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionBanner}>
                    <Text style={styles.sectionBannerText}>★ FAVORITE FOLDERS</Text>
                  </View>
                  {favorites.map(favPath => {
                    const folderName = favPath.split('/').pop() || favPath;
                    return (
                      <View key={favPath} style={styles.item}>
                        <TouchableOpacity
                          style={styles.itemRowLeft}
                          onPress={() => navigateTo(favPath)}>
                          <Text style={styles.folderIcon}>📁</Text>
                          <View style={styles.fileInfo}>
                            <Text style={styles.folderName}>{folderName}</Text>
                            <Text style={styles.pathSubtext}>
                              {favPath.replace('/storage/emulated/0/', '')}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.starBtn}
                          onPress={() => toggleFavorite(favPath)}>
                          <Text style={styles.starIcon}>★</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Recents Section */}
              {recentFolders.length > 0 && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionBanner}>
                    <Text style={styles.sectionBannerText}>🕒 RECENT FOLDERS</Text>
                  </View>
                  {recentFolders.map(recPath => {
                    const folderName = recPath.split('/').pop() || recPath;
                    const isFav = favorites.includes(recPath);
                    return (
                      <View key={recPath} style={styles.item}>
                        <TouchableOpacity
                          style={styles.itemRowLeft}
                          onPress={() => navigateTo(recPath)}>
                          <Text style={styles.folderIcon}>📁</Text>
                          <View style={styles.fileInfo}>
                            <Text style={styles.folderName}>{folderName}</Text>
                            <Text style={styles.pathSubtext}>
                              {recPath.replace('/storage/emulated/0/', '')}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.starBtn}
                          onPress={() => toggleFavorite(recPath)}>
                          <Text style={styles.starIcon}>{isFav ? '★' : '☆'}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* All Directories Section */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionBanner}>
                  <Text style={styles.sectionBannerText}>📁 ALL DIRECTORIES</Text>
                </View>
                {ROOTS.map(rootItem => (
                  <TouchableOpacity
                    key={rootItem.path}
                    style={styles.item}
                    onPress={() => navigateTo(rootItem.path)}>
                    <View style={styles.itemRowLeft}>
                      <Text style={styles.folderIcon}>📁</Text>
                      <Text style={styles.folderName}>{rootItem.name}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        />
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
  root:              {flex: 1, backgroundColor: '#ffffff'},
  header:            {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
                      borderBottomWidth: 3, borderBottomColor: '#000000', backgroundColor: '#ffffff'},
  headerRow:         {flexDirection: 'row', alignItems: 'center',
                      justifyContent: 'space-between', marginBottom: 14},
  backBtn:           {paddingRight: 10, paddingVertical: 4},
  backText:          {fontSize: 20, color: '#000000', fontWeight: '800'},
  title:             {flex: 1, fontSize: 22, fontWeight: '900', color: '#000000', textAlign: 'center'},
  cancelBtn:         {paddingHorizontal: 14, paddingVertical: 6, borderWidth: 2, borderColor: '#000000', borderRadius: 6, backgroundColor: '#ffffff'},
  cancelText:        {fontSize: 15, color: '#000000', fontWeight: '800'},

  tabContainer:      {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8},
  tabBox:            {flex: 1, borderWidth: 2, borderColor: '#888888', borderRadius: 8, padding: 10, backgroundColor: '#f4f4f4'},
  activeTabBox:      {borderColor: '#000000', borderWidth: 2.5, backgroundColor: '#e2e8f0'},
  tabLabel:          {fontSize: 13, fontWeight: '900', color: '#000000', marginBottom: 4, letterSpacing: 0.5},
  tabVal:            {fontSize: 16, fontWeight: '700', color: '#000000'},
  swapIcon:          {fontSize: 24, marginHorizontal: 10, color: '#000000', fontWeight: '900'},

  hint:              {fontSize: 14, color: '#222222', textAlign: 'center', marginTop: 4, fontWeight: '600'},
  rootContainer:     {paddingBottom: 24},

  sectionCard:       {marginTop: 14, marginHorizontal: 12, borderWidth: 2, borderColor: '#000000', borderRadius: 8, backgroundColor: '#ffffff', overflow: 'hidden'},
  sectionBanner:     {backgroundColor: '#d8d8d8', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: '#000000'},
  sectionBannerText: {fontSize: 16, fontWeight: '900', color: '#000000', letterSpacing: 0.5},

  center:            {flex: 1, justifyContent: 'center', alignItems: 'center'},
  body:              {fontSize: 18, color: '#444444', fontWeight: '600'},
  sep:               {height: 1.5, backgroundColor: '#cccccc'},

  item:              {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingVertical: 16, paddingHorizontal: 16, backgroundColor: '#ffffff'},
  itemDimmed:        {backgroundColor: '#eaeaea'},
  itemRowLeft:       {flexDirection: 'row', alignItems: 'center', flex: 1},
  itemRowRight:      {flexDirection: 'row', alignItems: 'center'},
  folderIcon:        {fontSize: 26, marginRight: 14},
  folderName:        {fontSize: 21, fontWeight: '700', color: '#000000'},
  pathSubtext:       {fontSize: 14, color: '#444444', marginTop: 3, fontWeight: '500'},
  starBtn:           {paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: '#000000', borderRadius: 6, backgroundColor: '#f4f4f4'},
  starIcon:          {fontSize: 28, color: '#000000', fontWeight: '900'},
  chevronTouch:      {paddingLeft: 14, paddingVertical: 6},
  chevron:           {fontSize: 26, color: '#000000', fontWeight: '800'},
  fileIcon:          {fontSize: 26, marginRight: 14},
  fileInfo:          {flex: 1},
  fileName:          {fontSize: 21, fontWeight: '700', color: '#000000'},
  dimText:           {color: '#888888'},
  tagText:           {fontSize: 13, color: '#000000', fontWeight: '900', marginTop: 4, letterSpacing: 0.5},
});
