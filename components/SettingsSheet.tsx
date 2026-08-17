import Slider from '@react-native-community/slider';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { formatDecimal, t } from '../lib/i18n';
import { LIMITS, STABILIZATION_MODES, type PrompterSettings } from '../lib/prompterSettings';

type Props = {
  visible: boolean;
  settings: PrompterSettings;
  update: (patch: Partial<PrompterSettings>) => void;
  onClose: () => void;
  onRewind: () => void;
};

const ACCENT = '#ffd60a';

export function SettingsSheet({ visible, settings, update, onClose, onRewind }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('settings.title')}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.done}>{t('settings.done')}</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>{t('settings.section.script')}</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={settings.text}
            onChangeText={(text) => update({ text })}
            placeholder={t('settings.placeholder')}
            placeholderTextColor="#666"
            textAlignVertical="top"
          />

          <Pressable style={styles.secondaryButton} onPress={onRewind}>
            <Text style={styles.secondaryButtonText}>{t('settings.rewind')}</Text>
          </Pressable>

          <LabeledSlider
            label={t('settings.fontSize')}
            value={settings.fontSize}
            limits={LIMITS.fontSize}
            format={(value) => `${Math.round(value)} px`}
            onChange={(fontSize) => update({ fontSize })}
          />
          <LabeledSlider
            label={t('settings.speed')}
            value={settings.speed}
            limits={LIMITS.speed}
            format={(value) => String(Math.round(value))}
            onChange={(speed) => update({ speed })}
          />
          <LabeledSlider
            label={t('settings.lineHeight')}
            value={settings.lineHeight}
            limits={LIMITS.lineHeight}
            format={(value) => formatDecimal(value, 2)}
            onChange={(lineHeight) => update({ lineHeight })}
          />
          <LabeledSlider
            label={t('settings.panelHeight')}
            value={settings.panelHeight}
            limits={LIMITS.panelHeight}
            format={(value) => `${Math.round(value * 100)} %`}
            onChange={(panelHeight) => update({ panelHeight })}
          />
          <LabeledSlider
            label={t('settings.readLine')}
            hint={t('settings.readLineHint')}
            value={settings.readLine}
            limits={LIMITS.readLine}
            format={(value) => `${Math.round(value * 100)} %`}
            onChange={(readLine) => update({ readLine })}
          />
          <LabeledSlider
            label={t('settings.opacity')}
            value={settings.opacity}
            limits={LIMITS.opacity}
            format={(value) => `${Math.round(value * 100)} %`}
            onChange={(opacity) => update({ opacity })}
          />

          <Text style={styles.sectionLabel}>{t('settings.section.camera')}</Text>

          <View style={styles.sliderRow}>
            <Text style={styles.label}>{t('settings.stabilization')}</Text>
            <View style={styles.segmented}>
              {STABILIZATION_MODES.map((mode) => {
                const active = settings.stabilization === mode;
                return (
                  <Pressable
                    key={mode}
                    style={[styles.segment, active && styles.segmentActive]}
                    onPress={() => update({ stabilization: mode })}>
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {t(`settings.stabilization.${mode}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>{t('settings.stabilizationHint')}</Text>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.label}>{t('settings.mirror')}</Text>
              <Text style={styles.hint}>{t('settings.mirrorHint')}</Text>
            </View>
            <Switch
              value={settings.mirrorFront}
              onValueChange={(mirrorFront) => update({ mirrorFront })}
              trackColor={{ true: ACCENT, false: '#3a3a3c' }}
              thumbColor="#fff"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type SliderProps = {
  label: string;
  hint?: string;
  value: number;
  limits: { min: number; max: number; step: number };
  format: (value: number) => string;
  onChange: (value: number) => void;
};

function LabeledSlider({ label, hint, value, limits, format, onChange }: SliderProps) {
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{format(value)}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Slider
        minimumValue={limits.min}
        maximumValue={limits.max}
        step={limits.step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={ACCENT}
        maximumTrackTintColor="#3a3a3c"
        thumbTintColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2c2c2e',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  done: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 48,
    gap: 18,
  },
  sectionLabel: {
    color: '#8e8e93',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  textArea: {
    minHeight: 180,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#1c1c1e',
  },
  secondaryButtonText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },
  sliderRow: {
    gap: 2,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    color: '#fff',
    fontSize: 15,
  },
  value: {
    color: '#8e8e93',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 2,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    padding: 3,
    marginTop: 8,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: ACCENT,
  },
  segmentText: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#000',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  switchText: {
    flex: 1,
  },
});
