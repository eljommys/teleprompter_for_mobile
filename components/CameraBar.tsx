// Del submódulo y no del índice del paquete, por lo mismo que en la hoja de
// ajustes: importar `@expo/vector-icons` a secas mete nueve tipografías.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDecimal, t } from '../lib/i18n';

export type ExposureRange = { min: number; max: number };

type Props = {
  /** `ph://…` del último vídeo del Carrete, o null si no hay miniatura. */
  lastVideoUri: string | null;
  onOpenGallery: () => void;
  /** Rango de compensación de la cámara activa, o null si no la admite. */
  exposureRange: ExposureRange | null;
  exposure: number;
  onChangeExposure: (value: number) => void;
  /** La cámara que está en juego tiene flash. La frontal nunca lo tiene. */
  hasTorch: boolean;
  torch: boolean;
  onToggleTorch: () => void;
};

const ACCENT = '#ffd60a';

/**
 * Paso del deslizador de exposición, en EV.
 *
 * Un décimo de paso es más fino de lo que distingue el ojo, pero el rango de un
 * iPhone va de −8 a +8 y con pasos gruesos el recorrido se queda en cuatro
 * posiciones. Lo que se enseña sí va redondeado a un decimal.
 */
const EXPOSURE_STEP = 0.1;

/** «+0,5 EV», «−1,2 EV», «0 EV». El signo se pone a mano: `toFixed` no lo pinta. */
function formatExposure(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return '0 EV';
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${formatDecimal(Math.abs(rounded), 1)} EV`;
}

/**
 * La fila de encima del zoom: galería a la izquierda, luz y exposición a la
 * derecha.
 *
 * El acceso a la galería va aquí y no en la barra de abajo a propósito: abajo
 * está el botón de grabar, y un botón que se lleva fuera de la app no debe
 * quedar al lado del que empieza una toma.
 *
 * El deslizador de exposición se despliega y se recoge en vez de estar siempre
 * puesto: ya hay un deslizador fijo —el del zoom— y dos seguidos comen pantalla
 * justo donde va el guion.
 */
export function CameraBar({
  lastVideoUri,
  onOpenGallery,
  exposureRange,
  exposure,
  onChangeExposure,
  hasTorch,
  torch,
  onToggleTorch,
}: Props) {
  const [open, setOpen] = useState(false);
  // La miniatura la pinta el cargador de imágenes de `expo-media-library` a
  // partir de la URI `ph://`. Si por lo que sea no la da, el botón se queda con
  // su icono en vez de con un hueco negro: sigue llevando a Fotos igual.
  const [thumbFailed, setThumbFailed] = useState(false);
  useEffect(() => setThumbFailed(false), [lastVideoUri]);
  // Sin rango no hay nada que mover: esta cámara no admite compensación.
  const canExpose = exposureRange != null;
  // Fuera de cero se enseña la cifra en el propio botón, plegado o no: una
  // exposición corrida que no se ve por ninguna parte arruina la toma siguiente.
  const shifted = Math.round(exposure * 10) !== 0;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {canExpose && open ? (
        <View style={styles.exposureRow}>
          <Text style={styles.exposureValue}>{formatExposure(exposure)}</Text>
          <Slider
            style={styles.slider}
            minimumValue={exposureRange.min}
            maximumValue={exposureRange.max}
            step={EXPOSURE_STEP}
            value={exposure}
            onValueChange={onChangeExposure}
            minimumTrackTintColor={ACCENT}
            maximumTrackTintColor="rgba(255, 255, 255, 0.35)"
            thumbTintColor="#fff"
          />
          {/* Volver a cero a mano: con el deslizador es casi imposible clavar
              el 0, y una toma con la exposición corrida sin querer no se
              arregla después. */}
          <Pressable
            style={styles.reset}
            hitSlop={8}
            onPress={() => onChangeExposure(0)}
            accessibilityLabel={t('controls.exposureReset')}>
            <MaterialCommunityIcons name="restore" size={16} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.row} pointerEvents="box-none">
        <Pressable
          style={styles.gallery}
          onPress={onOpenGallery}
          accessibilityLabel={t('controls.gallery')}>
          {lastVideoUri == null || thumbFailed ? (
            <MaterialCommunityIcons name="image-multiple-outline" size={20} color="#fff" />
          ) : (
            <Image
              source={{ uri: lastVideoUri }}
              style={styles.thumb}
              onError={() => setThumbFailed(true)}
            />
          )}
        </Pressable>

        <View style={styles.right}>
          {canExpose ? (
            <Pressable
              style={[styles.round, (open || shifted) && styles.roundActive, shifted && styles.wide]}
              onPress={() => setOpen((current) => !current)}
              accessibilityLabel={t('controls.exposure')}>
              {shifted ? (
                <Text style={styles.badge}>{formatExposure(exposure)}</Text>
              ) : (
                <MaterialCommunityIcons
                  name="brightness-6"
                  size={19}
                  color={open ? '#000' : '#fff'}
                />
              )}
            </Pressable>
          ) : null}

          {hasTorch ? (
            <Pressable
              style={[styles.round, torch && styles.roundActive]}
              onPress={onToggleTorch}
              accessibilityLabel={t('controls.torch')}>
              <MaterialCommunityIcons
                name={torch ? 'flashlight' : 'flashlight-off'}
                size={19}
                color={torch ? '#000' : '#fff'}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gallery: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  round: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  roundActive: {
    backgroundColor: ACCENT,
  },
  wide: {
    paddingHorizontal: 12,
  },
  badge: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  exposureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
    height: 32,
  },
  exposureValue: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 54,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  reset: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
});
