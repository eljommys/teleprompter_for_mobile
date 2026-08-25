import { useCallback, useEffect, useMemo } from 'react';
import type { ScrollView } from 'react-native';
import {
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type AnimatedRef,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { clamp, scrollRate } from './prompterSettings';

export type ScriptScroll = {
  /** Posición normalizada 0..1. Nunca en píxeles: ver nota abajo. */
  position: SharedValue<number>;
  /** Recorrido en px de esta pantalla. Derivado de los dos altos. */
  travel: DerivedValue<number>;
  /** ¿Está avanzando solo? */
  playing: SharedValue<boolean>;
  /**
   * ¿El dedo aterrizó sobre un guion que ya estaba avanzando?
   *
   * Lo escribe `onBeginDrag` y lo consume `toggle`. Ver el porqué allí.
   */
  touchStartedWhilePlaying: SharedValue<boolean>;
  /** Ref del `ScrollView` que se empuja desde el hilo de UI. */
  listRef: AnimatedRef<ScrollView>;
  /** Alto del hueco visible. */
  setViewportHeight: (height: number) => void;
  /** Alto total del contenido, rellenos incluidos. */
  setContentHeight: (height: number) => void;
  /** Los dos crudos, solo para el panel de depuración. */
  viewportHeight: SharedValue<number>;
  contentHeight: SharedValue<number>;
  /** Arrancar o parar el avance automático, desde JS. */
  toggle: () => void;
  /** Lo mismo, para llamar desde un gesto que ya corre en el hilo de UI. */
  toggleOnUI: () => void;
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
  const playing = useSharedValue(false);
  const touchStartedWhilePlaying = useSharedValue(false);
  const viewportHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);

  /**
   * El recorrido se deriva; no se calcula a mano al recibir cada medida.
   *
   * Antes era una función que los dos `onLayout` llamaban tras escribir su
   * valor, y se quedaba en cero: dependía de en qué orden llegaran las medidas y
   * de un guardado que se saltaba la asignación. Derivado no puede
   * desincronizarse — vale lo que valgan sus entradas, las escriba quien las
   * escriba y en el orden que sea.
   *
   * Va aquí arriba y no junto a los `set*` por una razón que no se ve: el bucle
   * de fotogramas es un worklet y captura su cierre al crearse, así que `travel`
   * tiene que existir antes.
   */
  const travel = useDerivedValue(() => Math.max(0, contentHeight.value - viewportHeight.value));

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

  const setViewportHeight = useCallback(
    (height: number) => {
      viewportHeight.value = height;
    },
    [viewportHeight],
  );

  const setContentHeight = useCallback(
    (height: number) => {
      contentHeight.value = height;
    },
    [contentHeight],
  );

  /**
   * El `ScrollView` conserva su desplazamiento en píxeles, pero cuando el
   * recorrido cambia —has tocado el cuerpo de letra o el alto del panel— esos
   * píxeles ya no apuntan al mismo sitio del guion. Se recoloca a partir de la
   * posición normalizada, que es la que sí significa lo mismo.
   */
  useAnimatedReaction(
    () => travel.value,
    (next, previous) => {
      if (next <= 0 || next === previous || previous == null) return;
      scrollTo(listRef, 0, position.value * next, false);
    },
  );

  /**
   * Arranca o para el avance. Es un worklet: lo llama el gesto del guion, que
   * ya corre en el hilo de UI.
   *
   * No basta con invertir `playing`. Al posar el dedo sobre un guion que está
   * avanzando, iOS abre un arrastre para frenar el desplazamiento aunque no
   * muevas el dedo, y ese arrastre ya ha puesto `playing` a `false` cuando
   * llega el toque. Invertir ahí lo volvería a arrancar: el guion no se
   * pararía nunca con un toque, solo arrastrando. Por eso se mira también si el
   * dedo aterrizó sobre un guion en marcha, y esa marca se consume aquí para
   * que un toque posterior sin arrastre no la herede.
   *
   * Y la cuenta se hace en el hilo de UI justamente porque es ahí donde
   * `onBeginDrag` escribe esas marcas: leerlas desde JS podía devolver las de
   * antes y concluir que el guion estaba parado cuando no lo estaba.
   */
  const toggleOnUI = useCallback(() => {
    'worklet';
    const wasPlaying = touchStartedWhilePlaying.value || playing.value;
    touchStartedWhilePlaying.value = false;
    // Al final del guion, un toque lo rebobina en vez de no hacer nada.
    if (position.value >= 1) position.value = 0;
    playing.value = !wasPlaying;
  }, [position, playing, touchStartedWhilePlaying]);

  const toggle = useCallback(() => {
    runOnUI(toggleOnUI)();
  }, [toggleOnUI]);

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
      touchStartedWhilePlaying,
      listRef,
      setViewportHeight,
      setContentHeight,
      viewportHeight,
      contentHeight,
      toggle,
      toggleOnUI,
      rewind,
    }),
    [
      position,
      travel,
      playing,
      touchStartedWhilePlaying,
      listRef,
      setViewportHeight,
      setContentHeight,
      viewportHeight,
      contentHeight,
      toggle,
      toggleOnUI,
      rewind,
    ],
  );
}
