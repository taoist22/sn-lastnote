import React, {useCallback, useEffect, useState, useRef} from 'react';
import {
  Alert,
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
import {PluginCommAPI, PluginFileAPI, PluginManager} from 'sn-plugin-lib';
import {buildPageList, buildUiTitleMap} from './src/domain/pageMetadata';
import {
  ensureFileReadPermission,
  ensureFileWritePermission,
} from './src/pluginPermissions';

import {
  readTargets,
  uniqueTargets,
  clampPage,
  currentUiPage,
  type TargetItem,
} from './src/domain/targets';
import {TargetEditor} from './src/components/TargetEditor';

interface DirItem {
  name: string;
  path: string;
  isDir: boolean;
  isSdCard?: boolean;
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
  const [rootItems, setRootItems] = useState<DirItem[]>(DEFAULT_ROOTS);
  const [items, setItems] = useState<DirItem[]>(DEFAULT_ROOTS);
  const [loading, setLoading] = useState(false);
  const [dirStack, setDirStack] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favFiles, setFavFiles] = useState<string[]>([]);
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number | undefined>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState('Saved');
  const saving = useRef(false);
  const retrySave = useRef<(() => void) | null>(null);

  // Active Target List & Metadata Maps
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [totalPageMap, setTotalPageMap] = useState<{[path: string]: number}>(
    {},
  );
  const [titleMap, setTitleMap] = useState<{
    [path: string]: {[page: number]: string};
  }>({});

  const fetchNoteMetadata = useCallback(async (filePath: string) => {
    if (!filePath || !filePath.toLowerCase().endsWith('.note')) {
      return;
    }
    try {
      const totalRes = await PluginFileAPI.getNoteTotalPageNum(filePath).catch(
        () => null,
      );
      if (
        totalRes &&
        (totalRes as any).success &&
        typeof (totalRes as any).result === 'number'
      ) {
        const total = (totalRes as any).result;
        setTotalPageMap(prev => ({...prev, [filePath]: total}));
        if (total > 0) {
          const titlesRes = await PluginFileAPI.getTitles(
            filePath,
            buildPageList(total),
          ).catch(() => null);
          const nativeTitles = titlesRes?.result;
          if (titlesRes?.success && Array.isArray(nativeTitles)) {
            setTitleMap(prev => ({
              ...prev,
              [filePath]: buildUiTitleMap(nativeTitles, total),
            }));
          }
        }
      }
    } catch (e) {
      console.error('LastNote: fetchNoteMetadata failed', e);
    }
  }, []);

  const saveTargets = useCallback(async (updated: TargetItem[]) => {
    if (saving.current) {
      return;
    }
    if (uniqueTargets(updated).length !== updated.length) {
      Alert.alert(
        'Already bookmarked',
        'This note and page already have a bookmark. Choose a different page.',
      );
      return;
    }
    saving.current = true;
    setSaveStatus('Saving…');
    const normalized = updated.map((t, idx) => ({
      ...t,
      id: t.id || `${t.path}:${t.page}:${idx}`,
    }));
    try {
      if (!(await ensureFileWritePermission())) {
        throw new Error('File access was not allowed.');
      }
      await NativeModules.LastNote.writePresets(JSON.stringify(normalized));
      await NativeModules.LastNote.writePair(
        normalized[0]?.path || '',
        normalized[1]?.path || '',
      );
      setTargets(normalized);
      setSaveStatus('Saved');
      setAccessError(null);
      retrySave.current = null;
    } catch (e) {
      setSaveStatus('Save failed');
      setAccessError(`Could not save targets: ${String(e)}`);
      retrySave.current = () => {
        saveTargets(normalized);
      };
    } finally {
      saving.current = false;
    }
  }, []);

  const loadData = useCallback(async () => {
    setDirStack([]);
    setLoading(true);
    try {
      if (!(await ensureFileReadPermission())) {
        setAccessError(
          'File access was not allowed. Grant file access to browse LastNote targets and restore backups.',
        );
        return;
      }
      setAccessError(null);
      const [
        rItems,
        hereVal,
        thereVal,
        favRaw,
        favFilesRaw,
        recRaw,
        currRes,
        presetsRaw,
      ] = await Promise.all([
        NativeModules.LastNote.listRootDirectories().catch(() => []),
        NativeModules.LastNote.readHere(),
        NativeModules.LastNote.readThere(),
        NativeModules.LastNote.readFavorites(),
        NativeModules.LastNote.readFavoriteFiles(),
        NativeModules.LastNote.readRecentFolders().catch(() => null),
        PluginCommAPI.getCurrentFilePath().catch(() => null),
        NativeModules.LastNote.readPresets().catch(() => null),
      ]);

      const validRoots: DirItem[] =
        Array.isArray(rItems) && rItems.length > 0 ? rItems : DEFAULT_ROOTS;
      setRootItems(validRoots);
      setItems(validRoots);

      setFavorites(favRaw ? JSON.parse(favRaw) : []);
      setFavFiles(favFilesRaw ? JSON.parse(favFilesRaw) : []);
      setRecentFolders(recRaw ? JSON.parse(recRaw) : []);

      const cPath = (currRes as any)?.result as string;
      const validCurr =
        cPath && /\.(note|pdf|epub|cbz|xps|fb2)$/i.test(cPath) ? cPath : null;
      setCurrentFile(validCurr);
      setCurrentPage(
        currentUiPage(
          await PluginCommAPI.getCurrentPageNum().catch(() => null),
        ),
      );

      const loadedPresets = readTargets(presetsRaw, hereVal, thereVal);
      setTargets(loadedPresets);

      // Fetch metadata (total pages and TOC titles) for loaded notes
      const uniqueNotePaths = Array.from(
        new Set(
          loadedPresets
            .map(t => t.path)
            .filter(p => p.toLowerCase().endsWith('.note')),
        ),
      );
      uniqueNotePaths.forEach(p => fetchNoteMetadata(p));
    } catch (e) {
      setAccessError(`Could not load LastNote: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [fetchNoteMetadata]);

  useEffect(() => {
    loadData();
    const sub = DeviceEventEmitter.addListener('onFloatingLongPress', () => {
      loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  const toggleFavoriteFolder = useCallback(
    async (folderPath: string) => {
      if (!(await ensureFileWritePermission())) {
        setAccessError(
          'File access was not allowed. Grant file access to save favorites.',
        );
        return;
      }
      setAccessError(null);
      const updated = favorites.includes(folderPath)
        ? favorites.filter(p => p !== folderPath)
        : [...favorites, folderPath];
      try {
        await NativeModules.LastNote.writeFavorites(JSON.stringify(updated));
        setFavorites(updated);
      } catch (e) {
        Alert.alert('Could not save favorite', String(e), [
          {text: 'Cancel'},
          {
            text: 'Retry',
            onPress: () => {
              toggleFavoriteFolder(folderPath);
            },
          },
        ]);
      }
    },
    [favorites],
  );

  const toggleFavoriteFile = useCallback(
    async (filePath: string) => {
      if (!(await ensureFileWritePermission())) {
        setAccessError(
          'File access was not allowed. Grant file access to save favorites.',
        );
        return;
      }
      setAccessError(null);
      const updated = favFiles.includes(filePath)
        ? favFiles.filter(p => p !== filePath)
        : [...favFiles, filePath];
      try {
        await NativeModules.LastNote.writeFavoriteFiles(
          JSON.stringify(updated),
        );
        setFavFiles(updated);
      } catch (e) {
        Alert.alert('Could not save favorite', String(e), [
          {text: 'Cancel'},
          {
            text: 'Retry',
            onPress: () => {
              toggleFavoriteFile(filePath);
            },
          },
        ]);
      }
    },
    [favFiles],
  );

  const addRecentFolder = useCallback(
    async (folderPath: string) => {
      if (!(await ensureFileWritePermission())) {
        return;
      }
      const filtered = recentFolders.filter(p => p !== folderPath);
      const updated = [folderPath, ...filtered].slice(0, 5);
      setRecentFolders(updated);
      try {
        await NativeModules.LastNote.writeRecentFolders(
          JSON.stringify(updated),
        );
      } catch (e) {
        console.error('LastNote: writeRecentFolders failed', e);
      }
    },
    [recentFolders],
  );

  const navigateTo = useCallback(async (dirPath: string) => {
    setLoading(true);
    try {
      if (!(await ensureFileReadPermission())) {
        setAccessError(
          'File access was not allowed. Grant file access to browse LastNote folders.',
        );
        return;
      }
      setAccessError(null);
      const result: DirItem[] = await NativeModules.LastNote.listDirectory(
        dirPath,
      );
      setDirStack(buildBreadcrumbStack(dirPath));
      setItems(result);
    } catch (e) {
      Alert.alert('Could not open folder', String(e), [
        {text: 'Cancel'},
        {
          text: 'Retry',
          onPress: () => {
            navigateTo(dirPath);
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const jumpToBreadcrumb = useCallback(
    async (targetIndex: number) => {
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
        if (!(await ensureFileReadPermission())) {
          setAccessError(
            'File access was not allowed. Grant file access to browse LastNote folders.',
          );
          return;
        }
        setAccessError(null);
        const result: DirItem[] = await NativeModules.LastNote.listDirectory(
          targetPath,
        );
        setDirStack(newStack);
        setItems(result);
      } catch (e) {
        Alert.alert('Could not open folder', String(e), [
          {text: 'Cancel'},
          {
            text: 'Retry',
            onPress: () => {
              jumpToBreadcrumb(targetIndex);
            },
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [dirStack, rootItems],
  );

  const goBack = useCallback(async () => {
    if (dirStack.length === 0) {
      return;
    }
    jumpToBreadcrumb(dirStack.length - 2);
  }, [dirStack, jumpToBreadcrumb]);

  const handleAddOrSelectTarget = useCallback(
    async (filePath: string, initialPage?: number) => {
      const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
      if (parentDir) {
        addRecentFolder(parentDir);
      }
      const fName = filePath.split('/').pop() || 'Note';
      const existing = targets.filter(t => t.path === filePath);
      let pageToSet = initialPage ?? 1;
      if (existing.length > 0 && initialPage == null) {
        setExpanded(existing[0].id || null);
        return;
      }

      pageToSet = clampPage(pageToSet, totalPageMap[filePath]);
      if (targets.some(t => t.path === filePath && t.page === pageToSet)) {
        setAccessError(
          'That page is already bookmarked. Choose another page in Edit.',
        );
        return;
      }
      const newTarget: TargetItem = {
        id: `${filePath}:${pageToSet}:${Date.now()}:${Math.random()
          .toString(36)
          .substring(2, 6)}`,
        name: fName,
        path: filePath,
        page: pageToSet,
      };
      const updated = [...targets, newTarget];
      await saveTargets(updated);
      fetchNoteMetadata(filePath);
    },
    [targets, addRecentFolder, saveTargets, totalPageMap, fetchNoteMetadata],
  );

  const handleRemoveTarget = useCallback(
    async (targetId: string) => {
      const updated = targets.filter(
        (t, idx) => (t.id || `${t.path}:${t.page || 0}:${idx}`) !== targetId,
      );
      await saveTargets(updated);
    },
    [targets, saveTargets],
  );

  const handleImportToc = useCallback(
    async (filePath: string) => {
      const tMap = titleMap[filePath];
      if (!tMap) {
        return;
      }
      const pagesWithTitles = Object.keys(tMap)
        .map(Number)
        .sort((a, b) => a - b);
      if (pagesWithTitles.length === 0) {
        return;
      }

      const fName = filePath.split('/').pop() || 'Note';
      const existingPages = new Set(
        targets.filter(t => t.path === filePath).map(t => t.page),
      );

      const toAdd: TargetItem[] = [];
      pagesWithTitles.forEach(pNum => {
        if (!existingPages.has(pNum)) {
          toAdd.push({
            id: `${filePath}:${pNum}:${Date.now()}:${Math.random()
              .toString(36)
              .substring(2, 6)}`,
            name: fName,
            path: filePath,
            page: pNum,
            label: tMap[pNum],
          });
        }
      });

      if (toAdd.length > 0) {
        await saveTargets([...targets, ...toAdd]);
      }
    },
    [targets, titleMap, saveTargets],
  );

  const handleDone = useCallback(() => {
    if (saving.current) {
      return;
    }
    PluginManager.closePluginView();
  }, []);

  const atRoot = dirStack.length === 0;

  const renderItem = ({item}: {item: DirItem}) => {
    if (item.isDir) {
      const isFav = favorites.includes(item.path);
      const isSd = item.isSdCard;
      return (
        <View key={item.path} style={styles.item}>
          <TouchableOpacity
            style={styles.itemRowLeft}
            onPress={() => navigateTo(item.path)}>
            <Text style={styles.folderIcon}>{isSd ? 'SD' : '▸'}</Text>
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
            <TouchableOpacity
              style={styles.chevronTouch}
              onPress={() => navigateTo(item.path)}>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const ext = item.name.toLowerCase();
    const isFavFile = favFiles.includes(item.path);
    const targetMatches = targets.filter(t => t.path === item.path);
    const targetCount = targetMatches.length;

    return (
      <View
        key={item.path}
        style={[styles.item, targetCount > 0 && styles.itemDimmed]}>
        <TouchableOpacity
          style={styles.itemRowLeft}
          disabled={targetCount > 0}
          onPress={() => handleAddOrSelectTarget(item.path)}>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName}>{item.name}</Text>
            {targetCount > 0 && (
              <Text style={styles.tagText}>
                ✓ {targetCount}{' '}
                {targetCount === 1 ? 'PAGE BOOKMARK' : 'PAGE BOOKMARKS'}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.itemRowRight}>
          <TouchableOpacity
            style={styles.presetAddBtn}
            disabled={targetCount > 0}
            onPress={() => handleAddOrSelectTarget(item.path)}>
            <Text style={styles.presetAddText}>
              {targetCount > 0
                ? 'Added'
                : ext.endsWith('.note')
                ? 'Add Note'
                : 'Add Document'}
            </Text>
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
          ) : null}

          <Text style={styles.title} numberOfLines={1}>
            LastNote
          </Text>

          <TouchableOpacity
            style={styles.saveDoneBtn}
            disabled={saveStatus === 'Saving…'}
            onPress={handleDone}>
            <Text style={styles.saveDoneText}>Close</Text>
          </TouchableOpacity>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.pathSubtext}>
          {saveStatus}
        </Text>
      </View>

      {accessError && (
        <TouchableOpacity
          style={styles.accessError}
          onPress={() =>
            retrySave.current ? retrySave.current() : loadData()
          }>
          <Text style={styles.accessErrorText}>{accessError}</Text>
          <Text style={styles.accessRetryText}>Tap to retry</Text>
        </TouchableOpacity>
      )}

      {/* Main Scroll Content */}
      <FlatList
        data={[1]}
        keyExtractor={() => 'dashboard'}
        renderItem={() => (
          <View
            style={styles.rootContainer}
            pointerEvents={
              saveStatus === 'Saving…' || loading ? 'none' : 'auto'
            }>
            {/* ⚡ ACTIVE TARGETS & BOOKMARKS DASHBOARD CARD */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionBanner}>
                <Text style={styles.sectionBannerText}>
                  BOOKMARKS ({targets.length}{' '}
                  {targets.length === 1 ? 'Bookmark' : 'Bookmarks'})
                </Text>
              </View>

              {currentFile && currentPage != null && (
                <TouchableOpacity
                  style={styles.presetAddBtn}
                  onPress={() =>
                    handleAddOrSelectTarget(currentFile, currentPage)
                  }>
                  <Text style={styles.presetAddText}>
                    + Bookmark current page ({currentPage})
                  </Text>
                </TouchableOpacity>
              )}
              {targets.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    No target documents or bookmarks selected yet.
                  </Text>
                  <Text style={styles.emptySubtext}>
                    Tap any supported note or document below to add it.
                  </Text>
                </View>
              ) : (
                targets.map((t, idx) => {
                  const targetId = t.id || `${t.path}:${t.page || 0}:${idx}`;
                  const totalPages = totalPageMap[t.path] || 0;
                  const pageTitleMap = titleMap[t.path] || {};
                  const activeTitle = pageTitleMap[t.page];

                  return (
                    <View key={targetId} style={styles.targetRowContainer}>
                      <View style={styles.targetRowMain}>
                        <Text style={styles.targetNum}>{idx + 1}.</Text>
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName}>
                            {t.name}{' '}
                            {t.page > 0
                              ? `(p.${t.page}${
                                  totalPages > 0 ? ` / ${totalPages}` : ''
                                })`
                              : ' · Last viewed page'}
                          </Text>
                          {t.label && (
                            <Text style={styles.titleBadgeText}>{t.label}</Text>
                          )}
                          {activeTitle && (
                            <Text style={styles.titleBadgeText}>
                              {activeTitle}
                            </Text>
                          )}
                          <Text style={styles.pathSubtext}>
                            {t.path.replace('/storage/emulated/0/', '')}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.presetAddBtn}
                          onPress={() =>
                            setExpanded(expanded === targetId ? null : targetId)
                          }>
                          <Text style={styles.presetAddText}>
                            {expanded === targetId ? 'Hide' : 'Edit'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {expanded === targetId && (
                        <TargetEditor
                          key={`${targetId}:${t.page}:${t.label || ''}`}
                          target={t}
                          total={totalPages}
                          titles={pageTitleMap}
                          first={idx === 0}
                          last={idx === targets.length - 1}
                          onSave={(page, label) =>
                            saveTargets(
                              targets.map(item =>
                                item.id === targetId
                                  ? {
                                      ...item,
                                      label,
                                      page:
                                        page === 0
                                          ? 0
                                          : clampPage(
                                              page,
                                              totalPageMap[item.path],
                                            ),
                                    }
                                  : item,
                              ),
                            )
                          }
                          onMove={delta => {
                            const updated = [...targets];
                            [updated[idx], updated[idx + delta]] = [
                              updated[idx + delta],
                              updated[idx],
                            ];
                            saveTargets(updated);
                          }}
                          onAdd={page => handleAddOrSelectTarget(t.path, page)}
                          onImport={() => handleImportToc(t.path)}
                          onRemove={() => handleRemoveTarget(targetId)}
                        />
                      )}
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
                  const isTarget = targets.some(t => t.path === fPath);
                  return (
                    <View
                      key={fPath}
                      style={[styles.item, isTarget && styles.itemDimmed]}>
                      <TouchableOpacity
                        style={styles.itemRowLeft}
                        onPress={() =>
                          !isTarget && handleAddOrSelectTarget(fPath)
                        }
                        disabled={isTarget}>
                        <View style={styles.fileInfo}>
                          <Text
                            style={[
                              styles.fileName,
                              isTarget && styles.dimText,
                            ]}>
                            {fName}
                          </Text>
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
                  <Text style={styles.sectionBannerText}>
                    ★ FAVORITE FOLDERS
                  </Text>
                </View>
                {favorites.map(favPath => {
                  const folderName = favPath.split('/').pop() || favPath;
                  return (
                    <View key={favPath} style={styles.item}>
                      <TouchableOpacity
                        style={styles.itemRowLeft}
                        onPress={() => navigateTo(favPath)}>
                        <Text style={styles.folderIcon}>▸</Text>
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
                  <Text style={styles.sectionBannerText}>RECENT FOLDERS</Text>
                </View>
                {recentFolders.map(recPath => {
                  const folderName = recPath.split('/').pop() || recPath;
                  const isFav = favorites.includes(recPath);
                  return (
                    <View key={recPath} style={styles.item}>
                      <TouchableOpacity
                        style={styles.itemRowLeft}
                        onPress={() => navigateTo(recPath)}>
                        <Text style={styles.folderIcon}>▸</Text>
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
                  <TouchableOpacity
                    style={styles.crumbBtn}
                    onPress={() => jumpToBreadcrumb(-1)}>
                    <Text style={styles.crumbText}>Root</Text>
                  </TouchableOpacity>
                  {dirStack.map((p, idx) => {
                    const segName = p.split('/').pop() || p;
                    const isLast = idx === dirStack.length - 1;
                    return (
                      <View key={p} style={styles.crumbItem}>
                        <Text style={styles.crumbSep}>›</Text>
                        <TouchableOpacity
                          style={[
                            styles.crumbBtn,
                            isLast && styles.crumbBtnActive,
                          ]}
                          onPress={() => jumpToBreadcrumb(idx)}>
                          <Text
                            style={[
                              styles.crumbText,
                              isLast && styles.crumbTextActive,
                            ]}>
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
  root: {flex: 1, backgroundColor: '#ffffff'},
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 3,
    borderBottomColor: '#000000',
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {paddingRight: 10, paddingVertical: 4},
  backText: {fontSize: 20, color: '#000000', fontWeight: '800'},
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#666666',
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  cancelText: {fontSize: 14, color: '#444444', fontWeight: '700'},
  saveDoneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 6,
    backgroundColor: '#000000',
  },
  saveDoneText: {fontSize: 15, color: '#ffffff', fontWeight: '900'},
  accessError: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#eeeeee',
  },
  accessErrorText: {fontSize: 15, color: '#000000', fontWeight: '800'},
  accessRetryText: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '700',
    marginTop: 4,
  },

  breadcrumbCardBar: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1.5,
    borderBottomColor: '#cccccc',
  },
  breadcrumbBar: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1.5,
    borderTopColor: '#dddddd',
  },
  crumbItem: {flexDirection: 'row', alignItems: 'center'},
  crumbBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  crumbBtnActive: {backgroundColor: '#000000'},
  crumbText: {fontSize: 14, fontWeight: '800', color: '#000000'},
  crumbTextActive: {color: '#ffffff'},
  crumbSep: {
    fontSize: 16,
    fontWeight: '900',
    marginHorizontal: 4,
    color: '#666666',
  },

  rootContainer: {paddingBottom: 32},

  sectionCard: {
    marginTop: 14,
    marginHorizontal: 12,
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  sectionBanner: {
    backgroundColor: '#d8d8d8',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  sectionBannerText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },

  emptyCard: {padding: 16, alignItems: 'center'},
  emptyText: {fontSize: 16, fontWeight: '700', color: '#444444'},
  emptySubtext: {fontSize: 13, color: '#666666', marginTop: 4},

  targetRowContainer: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: '#cccccc',
    backgroundColor: '#f8f9fa',
  },
  targetRowMain: {flexDirection: 'row', alignItems: 'center'},
  targetNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
    marginRight: 8,
  },

  targetControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingLeft: 34,
  },

  lockPillBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    backgroundColor: '#ffffff',
    marginRight: 10,
  },
  lockPillActive: {backgroundColor: '#000000'},
  lockPillText: {fontSize: 13, fontWeight: '800', color: '#000000'},
  lockPillTextActive: {color: '#ffffff'},

  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  stepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#e2e8f0',
  },
  stepBtnText: {fontSize: 16, fontWeight: '900', color: '#000000'},
  stepValText: {
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },

  pdfNoticeBox: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#888888',
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  pdfNoticeText: {fontSize: 13, fontWeight: '700', color: '#333333'},

  addBookmarkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    backgroundColor: '#ffffff',
    marginLeft: 10,
  },
  addBookmarkText: {fontSize: 13, fontWeight: '800', color: '#000000'},

  importTocBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    marginLeft: 10,
  },
  importTocText: {fontSize: 13, fontWeight: '800', color: '#000000'},

  titleBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    marginTop: 2,
  },

  pageStripContainer: {marginTop: 10, paddingLeft: 34},
  pagePill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: '#666666',
    borderRadius: 6,
    backgroundColor: '#ffffff',
    marginRight: 6,
  },
  pagePillSelected: {borderColor: '#000000', backgroundColor: '#000000'},
  pagePillWithTitle: {borderColor: '#000000', backgroundColor: '#e2e8f0'},
  pagePillText: {fontSize: 13, fontWeight: '800', color: '#000000'},
  pagePillTextSelected: {color: '#ffffff'},

  removeBtn: {padding: 6},
  removeText: {fontSize: 18},

  center: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {fontSize: 18, color: '#444444', fontWeight: '600'},

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  itemDimmed: {backgroundColor: '#f0f0f0'},
  itemRowLeft: {flexDirection: 'row', alignItems: 'center', flex: 1},
  itemRowRight: {flexDirection: 'row', alignItems: 'center'},
  folderIcon: {fontSize: 26, marginRight: 14},
  folderName: {fontSize: 21, fontWeight: '700', color: '#000000'},
  pathSubtext: {
    fontSize: 14,
    color: '#444444',
    marginTop: 3,
    fontWeight: '500',
  },
  starBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    backgroundColor: '#f4f4f4',
    marginLeft: 8,
  },
  starIcon: {fontSize: 24, color: '#000000', fontWeight: '900'},
  presetAddBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  presetAddText: {fontSize: 13, fontWeight: '800', color: '#000000'},
  chevronTouch: {paddingLeft: 14, paddingVertical: 6},
  chevron: {fontSize: 26, color: '#000000', fontWeight: '800'},
  fileIcon: {fontSize: 26, marginRight: 14},
  fileInfo: {flex: 1},
  fileName: {fontSize: 20, fontWeight: '700', color: '#000000'},
  dimText: {color: '#888888'},
  tagText: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
