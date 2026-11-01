import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type { Platform as ReaderPlatform } from '../core/tree';
import { a11yLens } from '../lens';

declare const __DEV__: boolean | undefined;

function useLens() {
  return useSyncExternalStore(a11yLens.subscribe, a11yLens.getState);
}

/**
 * Draws a numbered badge on every element in predicted screen-reader order, with warnings outlined
 * in red. Place it last inside your root view. Renders nothing outside `__DEV__`.
 */
export function A11yLensOverlay() {
  const { showOverlay, analysis } = useLens();
  if (!__DEV__ || !showOverlay || !analysis) return null;
  const flagged = new Set(analysis.warnings.map((w) => w.index));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {analysis.elements.map((el) =>
        el.frame ? (
          <View
            key={el.index}
            style={[
              styles.box,
              flagged.has(el.index) && styles.boxWarn,
              { left: el.frame.x, top: el.frame.y, width: el.frame.width, height: el.frame.height },
            ]}
          >
            <Text style={[styles.number, flagged.has(el.index) && styles.numberWarn]}>
              {el.index}
            </Text>
          </View>
        ) : null,
      )}
      {analysis.warnings
        .filter((w) => w.index === undefined && w.frame)
        .map((w, i) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: warnings have no id and never reorder within a scan
            key={`w${i}`}
            style={[
              styles.box,
              styles.boxWarn,
              { left: w.frame?.x, top: w.frame?.y, width: w.frame?.width, height: w.frame?.height },
            ]}
          />
        ))}
    </View>
  );
}

/** Panel content: overlay switch, reader choice, element list and warnings. Also the dev-dock tab. */
export function A11yLensPanel() {
  const {
    showOverlay,
    platform,
    analysis,
    scanning,
    canSuggest,
    suggesting,
    suggestions,
    suggestError,
  } = useLens();
  useEffect(() => {
    void a11yLens.scan();
  }, []);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Text>Show overlay</Text>
        <Switch value={showOverlay} onValueChange={a11yLens.showOverlay} />
      </View>
      <View style={styles.chips}>
        {(['ios', 'android'] as ReaderPlatform[]).map((p) => (
          <Pressable
            key={p}
            accessibilityRole="button"
            accessibilityState={{ selected: platform === p }}
            onPress={() => a11yLens.setPlatform(p)}
            style={[styles.chip, platform === p && styles.chipOn]}
          >
            <Text style={platform === p ? styles.chipTextOn : undefined}>
              {p === 'ios' ? 'VoiceOver' : 'TalkBack'}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => void a11yLens.scan()}
          style={styles.chip}
        >
          <Text>{scanning ? 'Scanning…' : 'Rescan'}</Text>
        </Pressable>
      </View>

      {analysis && analysis.warnings.length > 0 && (
        <>
          <Text style={styles.section}>Warnings ({analysis.warnings.length})</Text>
          {canSuggest && (
            <Pressable
              accessibilityRole="button"
              onPress={() => void a11yLens.suggest()}
              style={styles.chip}
            >
              <Text>{suggesting ? 'Asking your model…' : 'Suggest fixes (AI)'}</Text>
            </Pressable>
          )}
          {suggestError && <Text style={styles.warning}>Suggestions failed: {suggestError}</Text>}
          {suggestions?.map((fix, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: suggestions have no id and never reorder
            <Text key={`fix${i}`} style={styles.fix}>
              {fix.index !== undefined ? `#${fix.index} ` : ''}
              {fix.label ? `"${fix.label}": ` : ''}
              {fix.fix}
            </Text>
          ))}
          {analysis.warnings.map((w, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: warnings have no id and never reorder within a scan
            <Text key={i} style={styles.warning}>
              {w.index !== undefined ? `#${w.index} ` : ''}
              {w.message}
            </Text>
          ))}
        </>
      )}

      <Text style={styles.section}>Reading order</Text>
      {!analysis && <Text style={styles.muted}>Scanning…</Text>}
      {analysis?.elements.length === 0 && (
        <Text style={styles.muted}>
          Nothing found. The DevTools hook is missing (release build?) or the screen is empty.
        </Text>
      )}
      {analysis?.elements.map((el) => (
        <Text key={el.index} style={styles.element}>
          <Text style={styles.index}>{el.index}. </Text>
          {el.announcement || '(silent)'}
        </Text>
      ))}
      <Text style={styles.muted}>
        Order is predicted from the React tree; modals and screen geometry can change what readers
        do.
      </Text>
    </ScrollView>
  );
}

/**
 * Standalone use: overlay plus a small button that opens the panel. With dev-dock, render
 * `<A11yLensOverlay />` and pass `a11yLensTab` to the dock instead.
 */
export function A11yLens({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  if (!__DEV__ || !enabled) return null;
  return (
    <>
      <A11yLensOverlay />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open accessibility lens"
        onPress={() => setOpen(true)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>♿</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>A11y Lens</Text>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={12}>
              <Text style={styles.link}>Close</Text>
            </Pressable>
          </View>
          <A11yLensPanel />
        </SafeAreaView>
      </Modal>
    </>
  );
}

/** Tab for `@helder-studio/dev-dock`. */
export const a11yLensTab = {
  id: 'a11y-lens',
  title: 'A11y',
  status: () => {
    const { showOverlay, analysis } = a11yLens.getState();
    if (!showOverlay || !analysis) return null;
    return `${analysis.warnings.length} a11y warning${analysis.warnings.length === 1 ? '' : 's'}`;
  },
  subscribe: a11yLens.subscribe,
  render: () => <A11yLensPanel />,
};

// Default the wording to the platform the app runs on.
a11yLens.setPlatform(Platform.OS === 'android' ? 'android' : 'ios');

const styles = StyleSheet.create({
  box: { position: 'absolute', borderWidth: 1, borderColor: '#1a73e8', borderRadius: 2 },
  boxWarn: { borderColor: '#d93025', borderWidth: 2 },
  number: {
    position: 'absolute',
    top: -9,
    left: -9,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: '#1a73e8',
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  numberWarn: { backgroundColor: '#d93025' },
  button: {
    position: 'absolute',
    right: 12,
    top: 96,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  buttonText: { color: '#fff', fontSize: 20 },
  panel: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: { fontSize: 18, fontWeight: '600' },
  link: { color: '#1a73e8', fontWeight: '600' },
  content: { padding: 16, gap: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dadce0',
    minHeight: 40,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  chipTextOn: { color: '#fff' },
  section: { fontWeight: '600', marginTop: 16 },
  warning: { color: '#d93025' },
  fix: { color: '#137333' },
  element: { paddingVertical: 4 },
  index: { fontWeight: '700' },
  muted: { color: '#5f6368', fontSize: 12, marginTop: 8 },
});
