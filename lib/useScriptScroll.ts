import { useCallback, useEffect, useMemo } from 'react';
import type { ScrollView } from 'react-native';
import {
  scrollTo,
  useAnimatedRef,
  useFrameCallback,
  useSharedValue,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';

import { clamp, scrollRate } from './prompterSettings';

export type ScriptScroll = {
  /** Posición normalizada 0..1. Nunca en píxeles: ver nota abajo. */
  position: SharedValue<number>;
  /** Recorrido medido en px de esta pantalla. */
  travel: SharedValue<number>;
  /** ¿Está avanzando solo? */
  playing: SharedValue<boolean>;
  /** Ref del `ScrollView` que se empuja desde el hilo de UI. */
  listRef: AnimatedRef<ScrollView>;
  /** Alto del hueco visible, para calcular los rellenos 40/60. */
  setViewportHeight: (height: number) => void;
  /** Alto total del contenido, rellenos incluidos. */
  setContentHeight: (height: number) => void;
  /** Volver al principio del guion. */
  rewind: () => void;
};

/**
 * Mecánica de desplazamiento del guion.
 *
 * La posición se guarda SIEMPRE normalizada, nunca en píxeles. Así una posición
 * restaurada antes de haber medido no se pierde multiplicada por un recorrido
 * de cero, y cambiar el cuerpo de letra o el alto del panel no te mueve del
 * sitio del guion en el que ibas.
 *
 * El bucle vive en el hilo de UI (`useFrameCallback` + `scrollTo`, ambos
 * worklets). Es la diferencia con la versión web, que usaba
 * `requestAnimationFrame`: aquí, mientras se graba, el hilo de JS tiene trabajo
 * de sobra y el guion no puede permitirse tirones.
 */
export function useScriptScroll(speed: number, fontSize: number): ScriptScroll {
  const listRef = useAnimatedRef<ScrollView>();
  const position = useSharedValue(0);
  const travel = useSharedValue(0);
  const playing = useSharedValue(false);
  const viewportHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);

  // El bucle lee siempre el último valor de los ajustes sin reiniciarse cada
  // vez que se mueve un slider. Se copian en un efecto y no durante el render:
  // Reanimated avisa si escribes un shared value mientras se renderiza.
  const liveSpeed = useSharedValue(speed);
  const liveFontSize = useSharedValue(fontSize);
  useEffect(() => {
    liveSpeed.value = speed;
    liveFontSize.value = fontSize;
  }, [speed, fontSize, liveSpeed, liveFontSize]);

  useFrameCallback((frame) => {
    'worklet';
    if (!playing.value) return;
    // El primer fotograma no trae delta: no hay fotograma anterior con el que
    // comparar.
    const delta = frame.timeSincePreviousFrame;
    if (delta == null) return;
    // Un tope al delta evita que volver de segundo plano pegue un salto de
    // varios segundos de guion de golpe.
    const seconds = Math.min(delta / 1000, 0.1);
    const rate = scrollRate(liveSpeed.value, liveFontSize.value, travel.value);
    if (rate <= 0) return;
    const next = clamp(position.value + rate * seconds, 0, 1);
    position.value = next;
    scrollTo(listRef, 0, next * travel.value, false);
    // Al llegar al final se para solo, si no el botón se queda encendido para
    // siempre sin que se mueva nada.
    if (next >= 1) playing.value = false;
  }, true);

  const measure = useCallback(() => {
    const next = Math.max(0, contentHeight.value - viewportHeight.value);
    if (Math.abs(next - travel.value) < 1) return;
    travel.value = next;
    // El `ScrollView` conserva su desplazamiento en píxeles, pero el recorrido
    // acaba de cambiar —has tocado el cuerpo de letra o el alto del panel—, así
    // que esos píxeles ya no apuntan al mismo sitio del guion. Se recoloca a
    // partir de la posición normalizada, que es la que sí significa lo mismo.
    listRef.current?.scrollTo({ y: position.value * next, animated: false });
  }, [travel, contentHeight, viewportHeight, listRef, position]);

  const setViewportHeight = useCallback(
    (height: number) => {
      viewportHeight.value = height;
      measure();
    },
    [viewportHeight, measure],
  );

  const setContentHeight = useCallback(
    (height: number) => {
      contentHeight.value = height;
      measure();
    },
    [contentHeight, measure],
  );

  const rewind = useCallback(() => {
    position.value = 0;
    playing.value = false;
    listRef.current?.scrollTo({ y: 0, animated: false });
  }, [position, playing, listRef]);

  return useMemo(
    () => ({
      position,
      travel,
      playing,
      listRef,
      setViewportHeight,
      setContentHeight,
      rewind,
    }),
    [position, travel, playing, listRef, setViewportHeight, setContentHeight, rewind],
  );
}
