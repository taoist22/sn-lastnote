import React, {useCallback, useEffect, useState} from 'react';
import {
  DeviceEventEmitter,
  FlatList,
  NativeModules,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {PluginCommAPI, PluginManager} from 'sn-plugin-lib';

interface DirItem {
  name: string;
  path: string;
  isDir: boolean;
  isSdCard?: boolean;
}

export interface TargetItem {
  name: string;
  path: string;
  page: number; // 0 = last page viewed, >0 = locked page
}

const DEFAULT_ROOTS: DirItem[] = [
  {name: 'Note', path: '/storage/emulated/0/Note', isDir: true},
  {name: 'Document', path: '/storage/emulated/0/Document', isDir: true},
  {name: 'MyStyle', path: '/storage/emulated/0/MyStyle', isDir: true},
  {name: 'EXPORT', path: '/storage/emulated/0/EXPORT', isDir: true},
  {name: 'IMPORT', path: '/storage/emulated/0/IMPORT', isDir: true},
];

function buildBreadcrumbStack(dirPath: string): string[] {
  const prefix = '/storage/emulated/0';
  if (!dirPath.startsWith(prefix)) {
    return [dirPath];
  }
  const rel = dirPath.substring(prefix.length);
  const parts = rel.split('/').filter(Boolean);
  const stack: string[] = [];
  let curr = prefix;
  for (const part of parts) {
    curr += '/' + part;
    stack.push(curr);
  }
  return stack;
}

export default function App(): React.JSX.Element {
  const [rootItems, setRootItems]           = useState<DirItem[]>(DEFAULT_ROOTS);
  const [items, setItems]                 = useState<DirItem[]>(DEFAULT_ROOTS);
  const [loading, setLoading]             = useState(false);
  const [dirStack, setDirStack]           = useState<string[]>([]);
  const [favorites, setFavorites]         = useState<string[]>([]);
  const [favFiles, setFavFiles]           = useState<string[]>([]);
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const [currentFile, setCurrentFile]     = useState<string | null>(null);

  // Active Target List
  const [targets, setTargets]             = useState<TargetItem[]>([]);

  const saveTargets = useCallback(async (updated: TargetItem[]) => {
    setTargets(updated);
    try {
      await NativeModules.LastNote.writePresets(JSON.stringify(updated));
      if (updated.length >= 2) {
        await NativeModules.LastNote.writePair(updated[0].path, updated[1].path);
      } else if (updated.length === 1) {
        await NativeModules.LastNote.writePair(updated[0].path, '');
      }
    } catch (e) {
      console.error('LastNote: saveTargets failed', e);
    }
  }, []);

  const loadData = useCallback(async () => {
    setDirStack([]);
    setLoading(true);
    try {
      const [rItems, hereVal, thereVal, favRaw, favFilesRaw, recRaw, currRes, presetsRaw] =
        await Promise.all([
          NativeModules.LastNote.listRootDirectories().catch(() => []),
          NativeModules.LastNote.readHere(),
          NativeModules.LastNote.readThere(),
          NativeModules.LastNote.readFavorites(),
          NativeModules.LastNote.readFavoriteFiles(),
          NativeModules.LastNote.readRecentFolders().catch(() => null),
          PluginCommAPI.getCurrentFilePath().catch(() => null),
          NativeModules.LastNote.readPresets().catch(() => null),
        ]);

      const validRoots: DirItem[] = Array.isArray(rItems) && rItems.length > 0 ? rItems : DEFAULT_ROOTS;
      setRootItems(validRoots);
      setItems(validRoots);

      setFavorites(favRaw ? JSON.parse(favRaw) : []);
      setFavFiles(favFilesRaw ? JSON.parse(favFilesRaw) : []);
      setRecentFolders(recRaw ? JSON.parse(recRaw) : []);

      const cPath = currRes?.result as string;
      const validCurr = cPath && (cPath.endsWith('.note') || cPath.endsWith('.pdf') || cPath.endsWith('.epub')) ? cPath : null;
      setCurrentFile(validCurr);

      let loadedPresets: TargetItem[] = presetsRaw ? JSON.parse(presetsRaw) : [];
      if (!Array.isArray(loadedPresets) || loadedPresets.length === 0) {
        loadedPresets = [];
        if (hereVal) {
          loadedPresets.push({name: hereVal.split('/').pop() || 'Note A', path: hereVal, page: 0});
        }
        if (thereVal && thereVal !== hereVal) {
          loadedPresets.push({name: thereVal.split('/').pop() || 'Note B', path: thereVal, page: 0});
        }
      }
      setTargets(loadedPresets);
    } catch (e) {
      console.error('LastNote: loadData failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const sub = DeviceEventEmitter.addListener('onFloatingLongPress', () => {
      loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  const toggleFavoriteFolder = useCallback(
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

  const toggleFavoriteFile = useCallback(
    async (filePath: string) => {
      const updated = favFiles.includes(filePath)
        ? favFiles.filter(p => p !== filePath)
        : [...favFiles, filePath];
      setFavFiles(updated);
      try {
        await NativeModules.LastNote.writeFavoriteFiles(JSON.stringify(updated));
      } catch (e) {
        console.error('LastNote: writeFavoriteFiles failed', e);
      }
    },
    [favFiles],
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
      setDirStack(buildBreadcrumbStack(dirPath));
      setItems(result);
    } catch (e) {
      console.error('LastNote: listDirectory failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const jumpToBreadcrumb = useCallback(async (targetIndex: number) => {
    if (targetIndex < 0) {
      // Jump to Root
      setDirStack([]);
      setItems(rootItems);
      return;
    }
    const newStack = dirStack.slice(0, targetIndex + 1);
    const targetPath = newStack[newStack.length - 1];
    setLoading(true);
    try {
      const result: DirItem[] = await NativeModules.LastNote.listDirectory(targetPath);
      setDirStack(newStack);
      setItems(result);
    } catch (e) {
      console.error('LastNote: jumpToBreadcrumb failed', e);
    } finally {
      setLoading(false);
    }
  }, [dirStack, rootItems]);

  const goBack = useCallback(async () => {
    if (dirStack.length === 0) return;
    jumpToBreadcrumb(dirStack.length - 2);
  }, [dirStack, jumpToBreadcrumb]);

  const handleAddOrSelectTarget = useCallback(
    async (filePath: string) => {
      const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
      if (parentDir) {
        addRecentFolder(parentDir);
      }
      const fName = filePath.split('/').pop() || 'Note';
      const existsIndex = targets.findIndex(t => t.path === filePath);
      if (existsIndex >= 0) return;

      const updated = [...targets, {name: fName, path: filePath, page: 0}];
      await saveTargets(updated);
    },
    [targets, addRecentFolder, saveTargets],
  );

  const handleRemoveTarget = useCallback(
    async (filePath: string) => {
      const updated = targets.filter(t => t.path !== filePath);
      await saveTargets(updated);
    },
    [targets, saveTargets],
  );

  const handleTogglePageLock = useCallback(
    async (filePath: string) => {
      const updated = targets.map(t => {
        if (t.path === filePath) {
          const newPage = t.page > 0 ? 0 : 1;
          return {...t, page: newPage};
        }
        return t;
      });
      await saveTargets(updated);
    },
    [targets, saveTargets],
  );

  const handleStepPage = useCallback(
    async (filePath: string, delta: number) => {
      const updated = targets.map(t => {
        if (t.path === filePath) {
          const curr = Math.max(1, Number(t.page) || 1);
          const next = Math.max(1, curr + delta);
          return {...t, page: next};
        }
        return t;
      });
      await saveTargets(updated);
    },
    [targets, saveTargets],
  );

  const handleDone = useCallback(() => {
    PluginManager.closePluginView();
  }, []);

  const atRoot = dirStack.length === 0;

  const renderItem = ({item}: {item: DirItem}) => {
    if (item.isDir) {
      const isFav = favorites.includes(item.path);
      const isSd = item.isSdCard;
      return (
        <View style={styles.item}>
          <TouchableOpacity style={styles.itemRowLeft} onPress={() => navigateTo(item.path)}>
            <Text style={styles.folderIcon}>{isSd ? '💳' : '📁'}</Text>
            <View style={styles.fileInfo}>
              <Text style={styles.folderName}>{item.name}</Text>
              <Text style={styles.pathSubtext}>
                {item.path.replace('/storage/emulated/0/', '')}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.itemRowRight}>
            {!isSd && (
              <TouchableOpacity
                style={styles.starBtn}
                onPress={() => toggleFavoriteFolder(item.path)}>
                <Text style={styles.starIcon}>{isFav ? '★' : '☆'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.chevronTouch} onPress={() => navigateTo(item.path)}>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const ext = item.name.toLowerCase();
    const icon = ext.endsWith('.note') ? '📓' : '📄';
    const isFavFile = favFiles.includes(item.path);
    const isTarget = targets.some(t => t.path === item.path);

    return (
      <View style={[styles.item, isTarget && styles.itemDimmed]}>
        <TouchableOpacity
          style={styles.itemRowLeft}
          onPress={() => !isTarget && handleAddOrSelectTarget(item.path)}
          disabled={isTarget}>
          <Text style={styles.fileIcon}>{icon}</Text>
          <View style={styles.fileInfo}>
            <Text style={[styles.fileName, isTarget && styles.dimText]}>
              {item.name}
            </Text>
            {isTarget && <Text style={styles.tagText}>✓ ACTIVE TARGET</Text>}
          </View>
        </TouchableOpacity>

        <View style={styles.itemRowRight}>
          <TouchableOpacity
            style={styles.presetAddBtn}
            onPress={() => isTarget ? handleRemoveTarget(item.path) : handleAddOrSelectTarget(item.path)}>
            <Text style={styles.presetAddText}>{isTarget ? '✓ Added' : '+ Add Target'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.starBtn}
            onPress={() => toggleFavoriteFile(item.path)}>
            <Text style={styles.starIcon}>{isFavFile ? '★' : '☆'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {dirStack.length > 0 ? (
            <TouchableOpacity style={styles.backBtn} onPress={goBack}>
              <Text style={styles.backText}>‹ Back</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleDone}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.title} numberOfLines={1}>
            Pair & Presets Dashboard
          </Text>

          <TouchableOpacity style={styles.saveDoneBtn} onPress={handleDone}>
            <Text style={styles.saveDoneText}>✓ Done</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scroll Content */}
      <FlatList
        data={[1]}
        keyExtractor={() => 'dashboard'}
        renderItem={() => (
          <View style={styles.rootContainer}>
            {/* ⚡ ACTIVE TARGETS DASHBOARD CARD */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionBanner}>
                <Text style={styles.sectionBannerText}>
                  ⚡ ACTIVE TARGETS ({targets.length} {targets.length === 1 ? 'Target' : targets.length === 2 ? 'Document Pair' : 'Preset Documents'})
                </Text>
              </View>

              {targets.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No target documents selected yet.</Text>
                  <Text style={styles.emptySubtext}>Tap any note or PDF in the browser below to add it!</Text>
                </View>
              ) : (
                targets.map((t, idx) => {
                  const isLocked = t.page > 0;

                  return (
                    <View key={t.path} style={styles.targetRowContainer}>
                      <View style={styles.targetRowMain}>
                        <Text style={styles.targetNum}>{idx + 1}.</Text>
                        <Text style={styles.fileIcon}>{t.path.endsWith('.note') ? '📓' : '📄'}</Text>
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName}>{t.name}</Text>
                          <Text style={styles.pathSubtext}>{t.path.replace('/storage/emulated/0/', '')}</Text>
                        </View>

                        <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveTarget(t.path)}>
                          <Text style={styles.removeText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>

                      {/* COMPLETE TARGET ROW DESIGN: Stepper + Lock Mode */}
                      <View style={styles.targetControlsRow}>
                        {/* Lock Mode Toggle */}
                        <TouchableOpacity
                          style={[styles.lockPillBtn, isLocked && styles.lockPillActive]}
                          onPress={() => handleTogglePageLock(t.path)}>
                          <Text style={[styles.lockPillText, isLocked && styles.lockPillTextActive]}>
                            {isLocked ? '🔒 Locked' : '🔓 Last Page'}
                          </Text>
                        </TouchableOpacity>

                        {/* Page Stepper ‹ -5 -1 p.X +1 +5 › */}
                        {isLocked && (
                          <View style={styles.stepperBox}>
                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() => handleStepPage(t.path, -5)}>
                              <Text style={styles.stepBtnText}>-5</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() => handleStepPage(t.path, -1)}>
                              <Text style={styles.stepBtnText}>‹</Text>
                            </TouchableOpacity>

                            <Text style={styles.stepValText}>p.{Number(t.page) || 1}</Text>

                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() => handleStepPage(t.path, 1)}>
                              <Text style={styles.stepBtnText}>›</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() => handleStepPage(t.path, 5)}>
                              <Text style={styles.stepBtnText}>+5</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Favorite Files Section */}
            {atRoot && favFiles.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionBanner}>
                  <Text style={styles.sectionBannerText}>★ FAVORITE FILES</Text>
                </View>
                {favFiles.map(fPath => {
                  const fName = fPath.split('/').pop() || fPath;
                  const isNote = fPath.endsWith('.note');
                  const icon = isNote ? '📓' : '📄';
                  const isTarget = targets.some(t => t.path === fPath);
                  return (
                    <View key={fPath} style={[styles.item, isTarget && styles.itemDimmed]}>
                      <TouchableOpacity
                        style={styles.itemRowLeft}
                        onPress={() => !isTarget && handleAddOrSelectTarget(fPath)}
                        disabled={isTarget}>
                        <Text style={styles.fileIcon}>{icon}</Text>
                        <View style={styles.fileInfo}>
                          <Text style={[styles.fileName, isTarget && styles.dimText]}>{fName}</Text>
                          <Text style={styles.pathSubtext}>
                            {fPath.replace('/storage/emulated/0/', '')}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.starBtn}
                        onPress={() => toggleFavoriteFile(fPath)}>
                        <Text style={styles.starIcon}>★</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Favorite Folders Section */}
            {atRoot && favorites.length > 0 && (
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
                        onPress={() => toggleFavoriteFolder(favPath)}>
                        <Text style={styles.starIcon}>★</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Recents Section */}
            {atRoot && recentFolders.length > 0 && (
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
                        onPress={() => toggleFavoriteFolder(recPath)}>
                        <Text style={styles.starIcon}>{isFav ? '★' : '☆'}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Directory Browser Section (FOLDERS) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionBanner}>
                <Text style={styles.sectionBannerText}>FOLDERS</Text>
              </View>

              {/* 🍞 BREADCRUMB NAVIGATION TRAIL (ALWAYS VISIBLE) */}
              <View style={styles.breadcrumbCardBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity style={styles.crumbBtn} onPress={() => jumpToBreadcrumb(-1)}>
                    <Text style={styles.crumbText}>🏠 Root</Text>
                  </TouchableOpacity>
                  {dirStack.map((p, idx) => {
                    const segName = p.split('/').pop() || p;
                    const isLast = idx === dirStack.length - 1;
                    return (
                      <View key={p} style={styles.crumbItem}>
                        <Text style={styles.crumbSep}>›</Text>
                        <TouchableOpacity
                          style={[styles.crumbBtn, isLast && styles.crumbBtnActive]}
                          onPress={() => jumpToBreadcrumb(idx)}>
                          <Text style={[styles.crumbText, isLast && styles.crumbTextActive]}>
                            {segName}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
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
                items.map(item => renderItem({item}))
              )}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:              {flex: 1, backgroundColor: '#ffffff'},
  header:            {paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
                      borderBottomWidth: 3, borderBottomColor: '#000000', backgroundColor: '#ffffff'},
  headerRow:         {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  backBtn:           {paddingRight: 10, paddingVertical: 4},
  backText:          {fontSize: 20, color: '#000000', fontWeight: '800'},
  title:             {flex: 1, fontSize: 20, fontWeight: '900', color: '#000000', textAlign: 'center'},
  cancelBtn:         {paddingHorizontal: 12, paddingVertical: 6, borderWidth: 2, borderColor: '#666666', borderRadius: 6, backgroundColor: '#ffffff'},
  cancelText:        {fontSize: 14, color: '#444444', fontWeight: '700'},
  saveDoneBtn:       {paddingHorizontal: 14, paddingVertical: 6, borderWidth: 2, borderColor: '#000000', borderRadius: 6, backgroundColor: '#000000'},
  saveDoneText:      {fontSize: 15, color: '#ffffff', fontWeight: '900'},

  breadcrumbCardBar: {paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f0f0f0', borderBottomWidth: 1.5, borderBottomColor: '#cccccc'},
  breadcrumbBar:     {flexDirection: 'row', marginTop: 10, paddingTop: 6, borderTopWidth: 1.5, borderTopColor: '#dddddd'},
  crumbItem:         {flexDirection: 'row', alignItems: 'center'},
  crumbBtn:          {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: '#f0f0f0'},
  crumbBtnActive:    {backgroundColor: '#000000'},
  crumbText:         {fontSize: 14, fontWeight: '800', color: '#000000'},
  crumbTextActive:   {color: '#ffffff'},
  crumbSep:          {fontSize: 16, fontWeight: '900', marginHorizontal: 4, color: '#666666'},

  rootContainer:     {paddingBottom: 32},

  sectionCard:       {marginTop: 14, marginHorizontal: 12, borderWidth: 2, borderColor: '#000000', borderRadius: 8, backgroundColor: '#ffffff', overflow: 'hidden'},
  sectionBanner:     {backgroundColor: '#d8d8d8', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: '#000000'},
  sectionBannerText: {fontSize: 16, fontWeight: '900', color: '#000000', letterSpacing: 0.5},

  emptyCard:         {padding: 16, alignItems: 'center'},
  emptyText:         {fontSize: 16, fontWeight: '700', color: '#444444'},
  emptySubtext:      {fontSize: 13, color: '#666666', marginTop: 4},

  targetRowContainer:{paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1.5, borderBottomColor: '#cccccc', backgroundColor: '#f8f9fa'},
  targetRowMain:     {flexDirection: 'row', alignItems: 'center'},
  targetNum:         {fontSize: 18, fontWeight: '900', color: '#000000', marginRight: 8},

  targetControlsRow: {flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingLeft: 34},

  lockPillBtn:       {paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1.5, borderColor: '#000000', borderRadius: 6, backgroundColor: '#ffffff', marginRight: 10},
  lockPillActive:    {backgroundColor: '#000000'},
  lockPillText:      {fontSize: 13, fontWeight: '800', color: '#000000'},
  lockPillTextActive:{color: '#ffffff'},

  stepperBox:        {flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#000000', borderRadius: 6, backgroundColor: '#ffffff', overflow: 'hidden'},
  stepBtn:           {paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#e2e8f0'},
  stepBtnText:       {fontSize: 16, fontWeight: '900', color: '#000000'},
  stepValText:       {paddingHorizontal: 10, fontSize: 14, fontWeight: '900', color: '#000000'},

  pdfNoticeBox:      {paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: '#888888', borderRadius: 4, backgroundColor: '#f0f0f0'},
  pdfNoticeText:     {fontSize: 13, fontWeight: '700', color: '#333333'},

  removeBtn:         {padding: 6},
  removeText:        {fontSize: 18},

  center:            {flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center'},
  body:              {fontSize: 18, color: '#444444', fontWeight: '600'},

  item:              {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#eeeeee'},
  itemDimmed:        {backgroundColor: '#f0f0f0'},
  itemRowLeft:       {flexDirection: 'row', alignItems: 'center', flex: 1},
  itemRowRight:      {flexDirection: 'row', alignItems: 'center'},
  folderIcon:        {fontSize: 26, marginRight: 14},
  folderName:        {fontSize: 21, fontWeight: '700', color: '#000000'},
  pathSubtext:       {fontSize: 14, color: '#444444', marginTop: 3, fontWeight: '500'},
  starBtn:           {paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: '#000000', borderRadius: 6, backgroundColor: '#f4f4f4', marginLeft: 8},
  starIcon:          {fontSize: 24, color: '#000000', fontWeight: '900'},
  presetAddBtn:      {paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5, borderColor: '#000000', borderRadius: 6, backgroundColor: '#ffffff'},
  presetAddText:     {fontSize: 13, fontWeight: '800', color: '#000000'},
  chevronTouch:      {paddingLeft: 14, paddingVertical: 6},
  chevron:           {fontSize: 26, color: '#000000', fontWeight: '800'},
  fileIcon:          {fontSize: 26, marginRight: 14},
  fileInfo:          {flex: 1},
  fileName:          {fontSize: 20, fontWeight: '700', color: '#000000'},
  dimText:           {color: '#888888'},
  tagText:           {fontSize: 12, color: '#000000', fontWeight: '900', marginTop: 4, letterSpacing: 0.5},
});
