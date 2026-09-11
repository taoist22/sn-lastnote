import React, {useState} from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import type {TargetItem} from '../domain/targets';

export function TargetEditor({
  target,
  total,
  titles,
  onSave,
  onMove,
  onAdd,
  onImport,
  onRemove,
  first,
  last,
}: {
  target: TargetItem;
  total?: number;
  titles: {[page: number]: string};
  onSave: (page: number, label: string) => void;
  onMove: (delta: number) => void;
  onAdd: (page: number) => void;
  onImport: () => void;
  onRemove: () => void;
  first: boolean;
  last: boolean;
}) {
  const [page, setPage] = useState(String(target.page || 1));
  const [label, setLabel] = useState(target.label || '');
  const [search, setSearch] = useState('');
  const [lastViewed, setLastViewed] = useState(target.page === 0);
  const [adding, setAdding] = useState(false);
  const [showHeadings, setShowHeadings] = useState(false);
  const [newPage, setNewPage] = useState(
    String(
      Math.min(total || Number.MAX_SAFE_INTEGER, Math.max(1, target.page + 1)),
    ),
  );
  const button = (
    text: string,
    action: () => void,
    disabled = false,
    inline = false,
  ) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      style={[
        styles.button,
        inline && styles.inlineButton,
        disabled && styles.disabled,
      ]}
      onPress={action}>
      <Text style={styles.text}>{text}</Text>
    </TouchableOpacity>
  );
  return (
    <View>
      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={styles.heading}>This bookmark</Text>
          <Text style={styles.text}>Name (optional)</Text>
          <TextInput
            accessibilityLabel="Bookmark name"
            style={[styles.input, styles.nameInput]}
            value={label}
            onChangeText={setLabel}
            placeholder={target.name}
          />
          <View style={[styles.row, styles.pageRow]}>
            <Text style={styles.text}>Page{total ? ` (1–${total})` : ''}</Text>
            <TextInput
              accessibilityLabel="Page number"
              style={[
                styles.input,
                styles.pageInput,
                lastViewed && styles.disabled,
              ]}
              editable={!lastViewed}
              keyboardType="number-pad"
              value={page}
              onChangeText={setPage}
            />
          </View>
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityLabel="Use last viewed page"
            accessibilityState={{checked: lastViewed}}
            style={styles.button}
            onPress={() => setLastViewed(!lastViewed)}>
            <Text style={styles.text}>
              {lastViewed ? '☑' : '☐'} Use last viewed page
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.column}>
          <Text style={styles.heading}>Actions</Text>
          {button(
            'Save changes',
            () => onSave(lastViewed ? 0 : Number(page), label.trim()),
            !lastViewed &&
              (!/^\d+$/.test(page) ||
                Number(page) < 1 ||
                (!!total && Number(page) > total)),
          )}
          {button('Remove', onRemove)}
          <View style={styles.row}>
            {button('Move up', () => onMove(-1), first)}
            {button('Move down', () => onMove(1), last)}
          </View>
        </View>
      </View>
      {Object.keys(titles).length > 0 &&
        button(showHeadings ? 'Hide headings' : 'Choose from headings', () =>
          setShowHeadings(!showHeadings),
        )}
      {showHeadings && Object.keys(titles).length > 0 && (
        <View>
          <TextInput
            accessibilityLabel="Search headings"
            style={styles.input}
            placeholder="Search headings"
            value={search}
            onChangeText={setSearch}
          />
          <ScrollView style={styles.headings} nestedScrollEnabled>
            {Object.entries(titles)
              .filter(([, title]) =>
                title.toLowerCase().includes(search.toLowerCase()),
              )
              .map(([p, title]) => (
                <View key={p}>
                  {button(`p.${p} · ${title}`, () => {
                    setPage(p);
                    setLastViewed(false);
                    setShowHeadings(false);
                  })}
                </View>
              ))}
          </ScrollView>
          {button('Import TOC headings', onImport)}
        </View>
      )}
      {button(
        adding ? 'Cancel adding bookmark' : 'Add another page bookmark',
        () => setAdding(!adding),
      )}
      {adding && (
        <View style={[styles.row, styles.pageRow]}>
          <Text style={styles.text}>Page</Text>
          <TextInput
            accessibilityLabel="New bookmark page"
            style={[styles.input, styles.pageInput]}
            keyboardType="number-pad"
            value={newPage}
            onChangeText={setNewPage}
          />
          {button(
            'Add page bookmark',
            () => onAdd(Number(newPage)),
            !/^\d+$/.test(newPage) ||
              Number(newPage) < 1 ||
              (!!total && Number(newPage) > total) ||
              Number(newPage) === target.page,
            true,
          )}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  columns: {flexDirection: 'row', gap: 14, marginTop: 12},
  column: {flex: 1, minWidth: 0},
  heading: {fontSize: 15, color: '#000', fontWeight: '700', marginBottom: 8},
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginVertical: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#000',
    height: 32,
    paddingVertical: 2,
    paddingHorizontal: 8,
    includeFontPadding: false,
    textAlignVertical: 'center',
    color: '#000',
    backgroundColor: '#fff',
    fontSize: 15,
  },
  nameInput: {width: 200, maxWidth: '100%'},
  pageRow: {columnGap: 12, rowGap: 8},
  pageInput: {width: 44, paddingHorizontal: 3, textAlign: 'center'},
  inlineButton: {
    alignSelf: 'center',
    height: 32,
    paddingVertical: 0,
    marginVertical: 0,
    marginRight: 0,
    justifyContent: 'center',
  },
  button: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#000',
    marginVertical: 3,
    marginRight: 6,
    backgroundColor: '#fff',
  },
  text: {fontSize: 15, color: '#000'},
  disabled: {opacity: 0.4},
  headings: {maxHeight: 220},
});
