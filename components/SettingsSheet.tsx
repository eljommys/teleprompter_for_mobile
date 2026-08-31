// Del submódulo y no del índice del paquete: importar `@expo/vector-icons` a
// secas mete en el bundle las nueve tipografías de iconos, y aquí se usa una.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
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
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDecimal, t } from '../lib/i18n';
import {
  LENS_TYPES,
  LIMITS,
  PIP_SHAPES,
  type LensChoice,
  type PrompterSettings,
  type StabilizationChoice,
} from '../lib/prompterSettings';

type Props = {
  visible: boolean;
  settings: PrompterSettings;
  /** Modos que admite la cámara activa; los demás ni se enseñan. */
  availableStabilization: readonly StabilizationChoice[];
  /** Lentes que este iPhone tiene detrás; con una sola, la fila no aparece. */
  availableLenses: readonly LensChoice[];
  /** ¿Admite este iPhone una sesión con las dos cámaras a la vez? */
  supportsDualCamera: boolean;
  /** La estabilización pedida no cupo con las dos cámaras y se abrió sin ella. */
  stabilizationDropped: boolean;
  update: (patch: Partial<PrompterSettings>) => void;
  onClose: () => void;
  onRewind: () => void;
};

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const ACCENT = '#ffd60a';
/** Opacidad de la hoja mientras se arrastra un slider. */
const PEEK_OPACITY = 0.1;

export function SettingsSheet({
  visible,
  settings,
  availableStabilization,
  availableLenses,
  supportsDualCamera,
  stabilizationDropped,
  update,
  onClose,
  onRewind,
}: Props) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);

  // Mientras se arrastra un slider la hoja casi desaparece: un ajuste del guion
  // solo se juzga viéndolo sobre la cámara, y con el panel delante no se ve.
  // Vive en un shared value porque atenuar no debe repintar el árbol: si el
  // `Slider` nativo se re-renderiza con el dedo encima, el pulgar da tirones.
  const sheetOpacity = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: sheetOpacity.value }));

  const beginPeek = useCallback(() => {
    sheetOpacity.value = withTiming(PEEK_OPACITY, { duration: 150 });
  }, [sheetOpacity]);
  const endPeek = useCallback(() => {
    sheetOpacity.value = withTiming(1, { duration: 220 });
  }, [sheetOpacity]);

  // Red de seguridad: si el panel se cierra en mitad de un arrastre, el gesto
  // no llega a terminar y la hoja volvería a abrirse translúcida.
  useEffect(() => {
    if (visible) sheetOpacity.value = 1;
  }, [visible, sheetOpacity]);

  return (
    // Transparente y con hoja propia, no `pageSheet`: el modal de sistema
    // encoge, baja y oscurece lo que hay detrás, así que atenuarlo enseñaría
    // una vista previa deformada en vez de la toma de verdad.
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, fadeStyle]}>
        {/* Tocar fuera cierra, que es lo que hacía el gesto del `pageSheet`. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <KeyboardAvoidingView behavior="padding" style={styles.avoider} pointerEvents="box-none">
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
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
              <SectionLabel icon="script-text-outline" label={t('settings.section.script')} />

              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <View style={styles.labelGroup}>
                    <MaterialCommunityIcons name="text-box-outline" size={17} color="#8e8e93" />
                    <Text style={styles.label}>{t('settings.prompterEnabled')}</Text>
                  </View>
                  <Text style={styles.hint}>{t('settings.prompterEnabledHint')}</Text>
                </View>
                <Switch
                  value={settings.prompterEnabled}
                  onValueChange={(prompterEnabled) => update({ prompterEnabled })}
                  trackColor={{ true: ACCENT, false: '#3a3a3c' }}
                  thumbColor="#fff"
                />
              </View>

              {/* Con el guion apagado no se esconden los ajustes por capricho:
                  siguen guardados y vuelven tal cual al encenderlo. Lo que se
                  quita es el sitio que ocupaban, que no sirve de nada si no hay
                  guion en pantalla. */}
              {settings.prompterEnabled ? (
                <>
                  {/* Un recuadro que se pulsa para editar, no un campo abierto.
                      Abierto ocupaba media hoja y, al arrastrar para bajar por
                      los ajustes, el dedo caía dentro y saltaba el teclado. */}
                  <Pressable style={styles.scriptPreview} onPress={() => setEditing(true)}>
                    <Text style={styles.scriptText} numberOfLines={3}>
                      {settings.text.trim().length > 0
                        ? settings.text
                        : t('settings.emptyScript')}
                    </Text>
                    <View style={styles.scriptEdit}>
                      <MaterialCommunityIcons name="pencil" size={14} color={ACCENT} />
                      <Text style={styles.scriptEditText}>{t('settings.editScript')}</Text>
                    </View>
                  </Pressable>

                  <Pressable style={styles.secondaryButton} onPress={onRewind}>
                    <MaterialCommunityIcons name="skip-backward" size={15} color={ACCENT} />
                    <Text style={styles.secondaryButtonText}>{t('settings.rewind')}</Text>
                  </Pressable>

              <LabeledSlider
                icon="format-size"
                label={t('settings.fontSize')}
                value={settings.fontSize}
                limits={LIMITS.fontSize}
                format={(value) => `${Math.round(value)} px`}
                onChange={(fontSize) => update({ fontSize })}
                onSlidingStart={beginPeek}
                onSlidingComplete={endPeek}
              />
              <LabeledSlider
                icon="speedometer"
                label={t('settings.speed')}
                value={settings.speed}
                limits={LIMITS.speed}
                format={(value) => String(Math.round(value))}
                onChange={(speed) => update({ speed })}
                onSlidingStart={beginPeek}
                onSlidingComplete={endPeek}
              />
              <LabeledSlider
                icon="format-line-spacing"
                label={t('settings.lineHeight')}
                value={settings.lineHeight}
                limits={LIMITS.lineHeight}
                format={(value) => formatDecimal(value, 2)}
                onChange={(lineHeight) => update({ lineHeight })}
                onSlidingStart={beginPeek}
                onSlidingComplete={endPeek}
              />
              <LabeledSlider
                icon="arrow-expand-vertical"
                label={t('settings.panelHeight')}
                value={settings.panelHeight}
                limits={LIMITS.panelHeight}
                format={percent}
                minLabel={t('settings.range.min')}
                maxLabel={t('settings.range.max')}
                onChange={(panelHeight) => update({ panelHeight })}
                onSlidingStart={beginPeek}
                onSlidingComplete={endPeek}
              />
              <LabeledSlider
                icon="arrow-expand-horizontal"
                label={t('settings.textWidth')}
                value={settings.textWidth}
                limits={LIMITS.textWidth}
                format={percent}
                minLabel={t('settings.textWidth.narrow')}
                maxLabel={t('settings.textWidth.full')}
                onChange={(textWidth) => update({ textWidth })}
                onSlidingStart={beginPeek}
                onSlidingComplete={endPeek}
              />
              <LabeledSlider
                icon="arrow-up-down"
                label={t('settings.panelTop')}
                hint={t('settings.panelTopHint')}
                value={settings.panelTop}
                limits={LIMITS.panelTop}
                inverted
                format={heightFromBottom}
                minLabel={t('settings.panelTop.bottom')}
                maxLabel={t('settings.panelTop.top')}
                onChange={(panelTop) => update({ panelTop })}
                onSlidingStart={beginPeek}
                onSlidingComplete={endPeek}
              />
              <LabeledSlider
                icon="format-align-middle"
                label={t('settings.readLine')}
                hint={t('settings.readLineHint')}
                value={settings.readLine}
                limits={LIMITS.readLine}
                inverted
                format={heightFromBottom}
                minLabel={t('settings.panelTop.bottom')}
                maxLabel={t('settings.panelTop.top')}
                onChange={(readLine) => update({ readLine })}
                onSlidingStart={beginPeek}
                onSlidingComplete={endPeek}
              />
              <LabeledSlider
                icon="opacity"
                label={t('settings.opacity')}
                value={settings.opacity}
                limits={LIMITS.opacity}
                format={percent}
                minLabel={t('settings.opacity.transparent')}
                maxLabel={t('settings.opacity.opaque')}
                onChange={(opacity) => update({ opacity })}
                onSlidingStart={beginPeek}
                onSlidingComplete={endPeek}
              />

                </>
              ) : null}

              <SectionLabel icon="camera-outline" label={t('settings.section.camera')} />

              <View style={styles.sliderRow}>
                <View style={styles.labelGroup}>
                  <MaterialCommunityIcons name="video-stabilization" size={17} color="#8e8e93" />
                  <Text style={styles.label}>{t('settings.stabilization')}</Text>
                </View>
                <View style={styles.segmented}>
                  {availableStabilization.map((mode) => {
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
                {stabilizationDropped ? (
                  <Text style={[styles.hint, styles.warning]}>
                    {t('settings.stabilizationDropped')}
                  </Text>
                ) : null}
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <View style={styles.labelGroup}>
                    <MaterialCommunityIcons
                      name="picture-in-picture-bottom-right"
                      size={17}
                      color="#8e8e93"
                    />
                    <Text style={styles.label}>{t('settings.dual')}</Text>
                  </View>
                  <Text style={styles.hint}>
                    {supportsDualCamera ? t('settings.dualHint') : t('settings.dualUnsupported')}
                  </Text>
                </View>
                <Switch
                  value={settings.dualCamera && supportsDualCamera}
                  onValueChange={(dualCamera) => update({ dualCamera })}
                  disabled={!supportsDualCamera}
                  trackColor={{ true: ACCENT, false: '#3a3a3c' }}
                  thumbColor="#fff"
                />
              </View>

              {settings.dualCamera && supportsDualCamera ? (
                <LabeledSlider
                  icon="resize"
                  label={t('settings.pipWidth')}
                  value={settings.pipWidth}
                  limits={LIMITS.pipWidth}
                  format={percent}
                  minLabel={t('settings.pipWidth.small')}
                  maxLabel={t('settings.pipWidth.big')}
                  onChange={(pipWidth) => update({ pipWidth })}
                  onSlidingStart={beginPeek}
                  onSlidingComplete={endPeek}
                />
              ) : null}

              {settings.dualCamera && supportsDualCamera ? (
                <>
                  <View style={styles.sliderRow}>
                    <View style={styles.labelGroup}>
                      <MaterialCommunityIcons name="crop-square" size={17} color="#8e8e93" />
                      <Text style={styles.label}>{t('settings.pipShape')}</Text>
                    </View>
                    <View style={styles.segmented}>
                      {PIP_SHAPES.map((shape) => {
                        const active = settings.pipShape === shape;
                        return (
                          <Pressable
                            key={shape}
                            style={[styles.segment, active && styles.segmentActive]}
                            onPress={() => update({ pipShape: shape })}>
                            <Text
                              style={[styles.segmentText, active && styles.segmentTextActive]}
                              numberOfLines={1}>
                              {t(`settings.pipShape.${shape}`)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={styles.hint}>{t('settings.pipShapeHint')}</Text>
                  </View>

                  <LabeledSlider
                    icon="rounded-corner"
                    label={t('settings.pipRadius')}
                    value={settings.pipRadius}
                    limits={LIMITS.pipRadius}
                    format={percent}
                    minLabel={t('settings.pipRadius.square')}
                    maxLabel={t('settings.pipRadius.round')}
                    onChange={(pipRadius) => update({ pipRadius })}
                    onSlidingStart={beginPeek}
                    onSlidingComplete={endPeek}
                  />

                  <LabeledSlider
                    icon="box-shadow"
                    label={t('settings.pipShadow')}
                    value={settings.pipShadow}
                    limits={LIMITS.pipShadow}
                    format={percent}
                    minLabel={t('settings.pipShadow.none')}
                    maxLabel={t('settings.pipShadow.strong')}
                    onChange={(pipShadow) => update({ pipShadow })}
                    onSlidingStart={beginPeek}
                    onSlidingComplete={endPeek}
                  />
                </>
              ) : null}

              {availableLenses.length > 1 ? (
                <View style={styles.sliderRow}>
                  <View style={styles.labelGroup}>
                    <MaterialCommunityIcons name="camera-iris" size={17} color="#8e8e93" />
                    <Text style={styles.label}>{t('settings.lenses')}</Text>
                  </View>
                  <View style={styles.segmented}>
                    {availableLenses.map((lens) => {
                      const active = settings.backLenses.includes(lens);
                      // Quedarse sin ninguna dejaría a la cámara sin óptica con
                      // la que encuadrar, así que la última marcada no se suelta.
                      const isLast = active && settings.backLenses.length === 1;
                      return (
                        <Pressable
                          key={lens}
                          style={[styles.segment, active && styles.segmentActive]}
                          onPress={() =>
                            update({
                              backLenses: active
                                ? settings.backLenses.filter((current) => current !== lens)
                                : // Se reordenan según `LENS_TYPES` para que lo
                                  // guardado no dependa del orden de los toques.
                                  LENS_TYPES.filter(
                                    (current) =>
                                      current === lens || settings.backLenses.includes(current),
                                  ),
                            })
                          }
                          disabled={isLast}>
                          <Text
                            style={[styles.segmentText, active && styles.segmentTextActive]}
                            numberOfLines={1}>
                            {t(`settings.lens.${lens}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.hint}>{t('settings.lensesHint')}</Text>
                </View>
              ) : null}

              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <View style={styles.labelGroup}>
                    <MaterialCommunityIcons name="flip-horizontal" size={17} color="#8e8e93" />
                    <Text style={styles.label}>{t('settings.mirror')}</Text>
                  </View>
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
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Editar el guion ocurre aquí y no en la hoja: así el campo tiene toda la
          pantalla, que es lo que pide escribir, y en los ajustes no estorba. */}
      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView behavior="padding" style={styles.editor}>
          <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
            <Text style={styles.title}>{t('settings.editScript')}</Text>
            <Pressable onPress={() => setEditing(false)} hitSlop={10}>
              <Text style={styles.done}>{t('settings.editScriptDone')}</Text>
            </Pressable>
          </View>
          <TextInput
            style={[styles.editorInput, { marginBottom: insets.bottom }]}
            multiline
            autoFocus
            value={settings.text}
            onChangeText={(text) => update({ text })}
            placeholder={t('settings.placeholder')}
            placeholderTextColor="#666"
            textAlignVertical="top"
          />
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}

const percent = (value: number) => `${Math.round(value * 100)} %`;

/**
 * Los dos ajustes de posición se guardan contando desde arriba, pero el slider
 * los enseña al revés (ver `inverted`), así que el número tiene que contar
 * desde abajo para crecer hacia la derecha como el pulgar.
 */
const heightFromBottom = (value: number) => `${Math.round((1 - value) * 100)} %`;

/**
 * Refleja un valor dentro de su rango, **reencajado en la rejilla del paso**.
 *
 * El reencaje es lo que evita el temblor del pulgar: sin él, invertir dos veces
 * un decimal deja ruido en el último bit, React ve un `value` distinto al que
 * el slider acaba de emitir y le re-fija la posición en plena arrastrada.
 */
function mirrorValue(value: number, limits: { min: number; max: number; step: number }): number {
  const raw = limits.min + limits.max - value;
  const snapped = limits.min + Math.round((raw - limits.min) / limits.step) * limits.step;
  return Math.min(limits.max, Math.max(limits.min, snapped));
}

function SectionLabel({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.sectionRow}>
      <MaterialCommunityIcons name={icon} size={13} color="#8e8e93" />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

type SliderProps = {
  label: string;
  icon: IconName;
  hint?: string;
  /** Valor tal y como se guarda, sin invertir. */
  value: number;
  limits: { min: number; max: number; step: number };
  /** Formatea el valor guardado cuando no toca etiqueta de extremo. */
  format: (value: number) => string;
  /** Qué se lee en el extremo izquierdo del recorrido, en vez del número. */
  minLabel?: string;
  /** Ídem en el extremo derecho. */
  maxLabel?: string;
  /**
   * El slider va al revés que el valor guardado. Es solo de cara afuera: lo que
   * se guarda no cambia de significado, así que no hay nada que migrar.
   */
  inverted?: boolean;
  onChange: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: () => void;
};

function LabeledSlider({
  label,
  icon,
  hint,
  value,
  limits,
  format,
  minLabel,
  maxLabel,
  inverted,
  onChange,
  onSlidingStart,
  onSlidingComplete,
}: SliderProps) {
  const display = inverted ? mirrorValue(value, limits) : value;
  // Un porcentaje suelto no dice nada («40 % de qué, y hacia dónde»). En los
  // topes se cambia por la palabra que explica adónde has llegado.
  const fraction = (display - limits.min) / (limits.max - limits.min);
  const valueText =
    minLabel !== undefined && fraction <= 0.02
      ? minLabel
      : maxLabel !== undefined && fraction >= 0.98
        ? maxLabel
        : format(value);

  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <View style={styles.labelGroup}>
          <MaterialCommunityIcons name={icon} size={17} color="#8e8e93" />
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.value}>{valueText}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Slider
        minimumValue={limits.min}
        maximumValue={limits.max}
        step={limits.step}
        value={display}
        onValueChange={(next) => onChange(inverted ? mirrorValue(next, limits) : next)}
        onSlidingStart={onSlidingStart}
        onSlidingComplete={onSlidingComplete}
        minimumTrackTintColor={ACCENT}
        maximumTrackTintColor="#3a3a3c"
        thumbTintColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  avoider: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    // En fracción del hueco libre: con el teclado abierto el hueco se encoge y
    // la hoja se recoloca sola por encima de él.
    height: '88%',
    backgroundColor: '#111',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    color: '#8e8e93',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  scriptPreview: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  scriptText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
  },
  scriptEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scriptEditText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },
  editor: {
    flex: 1,
    backgroundColor: '#111',
  },
  editorInput: {
    flex: 1,
    padding: 20,
    color: '#fff',
    fontSize: 16,
    lineHeight: 23,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
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
    alignItems: 'center',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  warning: {
    color: '#ffd60a',
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
