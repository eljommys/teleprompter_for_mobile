/**
 * El recuadro de la segunda cámara, que se arrastra por donde quieras.
 *
 * La posición se guarda en fracciones de pantalla y no en píxeles porque es la
 * misma cifra que necesita el montaje del vídeo: el fichero se compone después
 * con otra resolución que la pantalla, y una fracción vale igual en las dos.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { NativePreviewView, type CameraPreviewOutput } from 'react-native-vision-camera';

import { clamp } from '../lib/prompterSettings';

type Props = {
  previewOutput: CameraPreviewOutput;
  /** Lienzo sobre el que se mueve, en px. */
  canvas: { width: number; height: number };
  /** Esquina superior izquierda, en fracción del lienzo. */
  x: number;
  y: number;
  /** Ancho del recuadro, en fracción del ancho del lienzo. */
  width: number;
  /** Se llama al soltar, no en cada dedo movido. */
  onMoved: (position: { x: number; y: number }) => void;
};

/** Proporción del recuadro. Vertical, como graba la app. */
const ASPECT = 16 / 9;

export function PipPreview({ previewOutput, canvas, x, y, width, onMoved }: Props) {
  const boxWidth = canvas.width * width;
  const boxHeight = boxWidth * ASPECT;

  // El arrastre vive en el hilo de UI para que siga al dedo sin repintar; a
  // React solo se le cuenta dónde se ha quedado al soltar.
  const offsetX = useSharedValue(canvas.width * x);
  const offsetY = useSharedValue(canvas.height * y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const maxX = Math.max(0, canvas.width - boxWidth);
  const maxY = Math.max(0, canvas.height - boxHeight);

  /**
   * Los topes y el lienzo, en valores compartidos.
   *
   * Van así para que el gesto de abajo pueda memorizarse de una vez: si
   * dependiera de estos números se volvería a construir cada vez que cambien, y
   * un gesto nuevo es un reconocedor nuevo que cancela el arrastre en curso.
   */
  const limits = useSharedValue({ maxX, maxY, width: canvas.width, height: canvas.height });
  useEffect(() => {
    limits.value = { maxX, maxY, width: canvas.width, height: canvas.height };
  }, [limits, maxX, maxY, canvas.width, canvas.height]);

  // Mientras el dedo manda, nadie más toca la posición.
  const dragging = useSharedValue(false);

  // Envoltorio estable: `onMoved` llega como función nueva en cada repintado, y
  // si el gesto dependiera de ella volveríamos a lo mismo que se acaba de
  // arreglar.
  const latestOnMoved = useRef(onMoved);
  latestOnMoved.current = onMoved;
  const report = useCallback((position: { x: number; y: number }) => {
    latestOnMoved.current(position);
  }, []);

  // Los valores compartidos solo se estrenan con el primer valor, así que hay
  // que traerlos de vuelta cuando la posición cambia por fuera del arrastre:
  // al llegar los ajustes guardados, o al agrandar el recuadro, que reduce el
  // margen y podría dejarlo medio fuera de plano.
  useEffect(() => {
    if (dragging.value) return;
    offsetX.value = clamp(canvas.width * x, 0, maxX);
    offsetY.value = clamp(canvas.height * y, 0, maxY);
  }, [x, y, canvas.width, canvas.height, maxX, maxY, offsetX, offsetY, dragging]);

  /**
   * El gesto se construye una sola vez.
   *
   * Sin memorizar, cada repintado creaba uno nuevo, y grabando eso pasa cuatro
   * veces por segundo porque el cronómetro avanza. Cada gesto nuevo reinstala
   * el reconocedor y corta el arrastre a media pasada: el recuadro daba saltos
   * en vez de seguir al dedo. Todo lo que cambia se lee de valores compartidos,
   * así que la lista de dependencias puede quedarse quieta.
   */
  const drag = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          dragging.value = true;
          startX.value = offsetX.value;
          startY.value = offsetY.value;
        })
        .onUpdate((event) => {
          // Se frena en los bordes: un recuadro medio fuera de plano saldría
          // recortado en el fichero, donde ya no hay forma de recolocarlo.
          offsetX.value = clamp(startX.value + event.translationX, 0, limits.value.maxX);
          offsetY.value = clamp(startY.value + event.translationY, 0, limits.value.maxY);
        })
        .onFinalize(() => {
          dragging.value = false;
          const { width: canvasWidth, height: canvasHeight } = limits.value;
          runOnJS(report)({
            x: canvasWidth > 0 ? offsetX.value / canvasWidth : 0,
            y: canvasHeight > 0 ? offsetY.value / canvasHeight : 0,
          });
        }),
    [dragging, limits, offsetX, offsetY, startX, startY, report],
  );

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        style={[styles.box, { width: boxWidth, height: boxHeight }, boxStyle]}>
        <NativePreviewView
          previewOutput={previewOutput}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 14,
    // Las esquinas redondeadas son solo de la vista previa: el montaje se hace
    // con una exportación de AVFoundation, que compone rectángulos y no sabe
    // recortar cantos. En el fichero el recuadro sale recto.
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: '#000',
  },
});
