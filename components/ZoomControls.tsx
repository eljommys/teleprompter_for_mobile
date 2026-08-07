import Slider from '@react-native-community/slider';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { clampZoom, formatZoom, fromSliderPosition, toDisplay, toSliderPosition, type ZoomScale } from '../lib/zoom';

type Props = {
  scale: ZoomScale | null;
  /** Zoom vivo que consume la cámara, en escala cruda. */
  zoom: SharedValue<number>;
  /** Misma cifra, en estado de React, para que el slider sepa dónde ponerse. */
  zoomUi: number;
  onChangeZoom: (raw: number) => void;
  /** Al soltar: apunta el zoom para recuperarlo al volver a esta cámara. */
  onSettle: (raw: number) => void;
};

const ACCENT = '#ffd60a';

/**
 * Zoom: botones de lente y un deslizador.
 *
 * Los botones salen del propio dispositivo (`zoomLensSwitchFactors`), así que
 * en la trasera de un iPhone con teleobjetivo aparecen tres y saltan de lente
 * física de verdad. En la frontal no hay lentes que conmutar y todo el recorrido
 * es aumento digital.
 */
export function ZoomControls({ scale, zoom, zoomUi, onChangeZoom, onSettle }: Props) {
  if (scale == null) return null;

  const apply = (raw: number) => {
    const target = clampZoom(raw, scale);
    // El valor compartido primero: es el que ve la cámara, y va por el hilo de
    // UI sin esperar a que React vuelva a pintar.
    zoom.value = target;
    onChangeZoom(target);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.stops}>
        {scale.stopsRaw.map((raw) => {
          const active = Math.abs(zoomUi - raw) < raw * 0.02;
          return (
            <Pressable
              key={raw}
              hitSlop={6}
              onPress={() => {
                apply(raw);
                onSettle(clampZoom(raw, scale));
              }}
              style={[styles.stop, active && styles.stopActive]}>
              <Text style={[styles.stopLabel, active && styles.stopLabelActive]}>
                {formatZoom(toDisplay(raw, scale))}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sliderRow}>
        <Text style={styles.edge}>{formatZoom(toDisplay(scale.minRaw, scale))}</Text>
        <Slider
          style={styles.slider}
          // El deslizador va de 0 a 1 y la conversión es logarítmica: en escala
          // cruda, el primer tercio del recorrido se comería casi todo el rango
          // útil y el resto sería basura digital.
          minimumValue={0}
          maximumValue={1}
          value={toSliderPosition(zoomUi, scale)}
          onValueChange={(position) => apply(fromSliderPosition(position, scale))}
          onSlidingComplete={(position) =>
            onSettle(clampZoom(fromSliderPosition(position, scale), scale))
          }
          minimumTrackTintColor={ACCENT}
          maximumTrackTintColor="rgba(255, 255, 255, 0.35)"
          thumbTintColor="#fff"
        />
        <Text style={styles.edge}>{formatZoom(toDisplay(scale.maxRaw, scale))}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
    paddingHorizontal: 20,
  },
  stops: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stop: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  stopActive: {
    backgroundColor: ACCENT,
  },
  stopLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  stopLabelActive: {
    color: '#000',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
    height: 36,
  },
  edge: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
