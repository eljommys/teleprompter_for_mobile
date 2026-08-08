import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../lib/i18n';

type Props = {
  isRecording: boolean;
  isBusy: boolean;
  duration: number;
  onToggleRecord: () => void;
  onFlip: () => void;
  canFlip: boolean;
  onOpenSettings: () => void;
};

function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Barra inferior: ajustes a la izquierda, grabar en el centro, girar a la derecha. */
export function ControlBar({
  isRecording,
  isBusy,
  duration,
  onToggleRecord,
  onFlip,
  canFlip,
  onOpenSettings,
}: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        <Pressable
          style={styles.round}
          onPress={onOpenSettings}
          accessibilityLabel={t('controls.settings')}>
          <Text style={styles.glyph}>≡</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        {isRecording ? <Text style={styles.timer}>{formatDuration(duration)}</Text> : null}
        <Pressable
          onPress={onToggleRecord}
          disabled={isBusy}
          style={[styles.shutter, isBusy && styles.dimmed]}
          accessibilityLabel={isRecording ? t('controls.stop') : t('controls.record')}>
          <View style={isRecording ? styles.shutterStop : styles.shutterIdle} />
        </Pressable>
      </View>

      <View style={styles.side}>
        <Pressable
          style={[styles.round, !canFlip && styles.dimmed]}
          onPress={onFlip}
          disabled={!canFlip}
          accessibilityLabel={t('controls.flip')}>
          <Text style={styles.glyph}>⟳</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  side: {
    width: 72,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  timer: {
    color: '#fff',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterIdle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ff3b30',
  },
  shutterStop: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#ff3b30',
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 26,
  },
  dimmed: {
    opacity: 0.4,
  },
});
