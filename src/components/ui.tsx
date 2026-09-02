import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mono, usePalette } from '@/lib/theme';

/**
 * The elements core-web's globals.css defines, as components.
 *
 * One for one with the stylesheet's classes — card, chip, banner, kv, lede,
 * muted — so a screen here and the page it mirrors have the same parts in the
 * same order, and a change to one has an obvious counterpart in the other.
 */

export function Screen({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function H1({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <Text style={[styles.h1, { color: palette.ink }]}>{children}</Text>;
}

export function H2({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <Text style={[styles.h2, { color: palette.ink }]}>{children}</Text>;
}

export function P({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <Text style={[styles.p, { color: palette.inkSoft }]}>{children}</Text>;
}

export function Lede({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <Text style={[styles.lede, { color: palette.inkSoft }]}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <Text style={[styles.muted, { color: palette.inkFaint }]}>{children}</Text>;
}

/** Inline <code>. Nested inside a Text parent so it flows with the sentence. */
export function Code({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <Text style={[styles.code, { color: palette.ink }]}>{children}</Text>;
}

export function Pre({ children }: { children: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.pre, { backgroundColor: palette.surface, borderColor: palette.rule }]}>
      <Text style={[styles.code, { color: palette.ink }]}>{children}</Text>
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.rule }]}>
      {children}
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function Banner({ tone, children }: { tone: 'dev' | 'live'; children: ReactNode }) {
  const palette = usePalette();
  const colour = tone === 'live' ? palette.ok : palette.warn;
  const background = tone === 'live' ? palette.okBg : palette.warnBg;
  return (
    <View style={[styles.banner, { backgroundColor: background, borderColor: colour }]}>
      <Text style={[styles.bannerText, { color: colour }]}>{children}</Text>
    </View>
  );
}

/**
 * granted / denied is the whole point of the leads screen, so the states are
 * explicit rather than a boolean prop with a default.
 */
export function Chip({ label, state }: { label: string; state: 'granted' | 'denied' | 'neutral' }) {
  const palette = usePalette();
  const tone =
    state === 'granted'
      ? { backgroundColor: palette.okBg, borderColor: palette.ok, color: palette.ok }
      : state === 'denied'
        ? { backgroundColor: palette.denyBg, borderColor: palette.deny, color: palette.deny }
        : { backgroundColor: palette.bg, borderColor: palette.rule, color: palette.inkSoft };
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor },
      ]}
    >
      <Text style={[styles.chipText, { color: tone.color }]}>{label}</Text>
    </View>
  );
}

/** core-web's dl.kv. A two-column grid there; stacked rows at phone width. */
export function KeyValue({ items }: { items: { key: string; value: string }[] }) {
  const palette = usePalette();
  return (
    <View>
      {items.map((item) => (
        <View key={item.key} style={styles.kvRow}>
          <Text style={[styles.kvKey, { color: palette.inkFaint }]}>{item.key}</Text>
          <Text style={[styles.kvValue, { color: palette.ink }]} selectable>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const palette = usePalette();
  const secondary = variant === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? 'transparent' : palette.accent,
          borderColor: palette.accent,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonText, { color: secondary ? palette.accent : '#fff' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 24, paddingBottom: 64 },
  h1: { fontSize: 28, fontWeight: '600', letterSpacing: -0.5, marginBottom: 6 },
  h2: { fontSize: 17, fontWeight: '600', marginTop: 28, marginBottom: 10 },
  p: { fontSize: 15, lineHeight: 24, marginBottom: 14 },
  lede: { fontSize: 16, lineHeight: 26, marginBottom: 24 },
  muted: { fontSize: 13, lineHeight: 20, marginBottom: 8 },
  code: { fontFamily: mono, fontSize: 13 },
  pre: { borderWidth: 1, borderRadius: 6, padding: 12, marginBottom: 14 },
  card: { borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  banner: { borderWidth: 1, borderRadius: 6, padding: 14, marginBottom: 24 },
  bannerText: { fontSize: 14, lineHeight: 21 },
  chip: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontFamily: mono, fontSize: 12 },
  kvRow: { marginBottom: 10 },
  kvKey: { fontSize: 12, marginBottom: 2 },
  kvValue: { fontFamily: mono, fontSize: 13 },
  button: { borderWidth: 1, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 16 },
  buttonText: { fontSize: 15, fontWeight: '500' },
});
