/**
 * El recuadro de la segunda cámara, que se arrastra por donde quieras.
 *
 * La posición se guarda en fracciones de pantalla y no en píxeles porque es la
 * misma cifra que necesita el montaje del vídeo: el fichero se compone después
 * con otra resolución que la pantalla, y una fracción vale igual en las dos.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
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
  /** Redondeo, en fracción del lado corto: al 100% sale círculo o cápsula. */
  radius: number;
  /** Proporción alto/ancho del recuadro. */
  aspect: number;
  /** Sombra, 0 = ninguna. */
  shadow: number;
  /** Se llama al soltar: es lo que se guarda en los ajustes. */
  onMoved: (position: { x: number; y: number }) => void;
  /**
   * Se llama mientras arrastras, a intervalos.
   *
   * Sirve para que la grabación apunte el recorrido: sin esto el vídeo solo
   * conocería el punto de partida y el de llegada, y el recuadro daría un salto
   * en vez de acompañar al dedo.
   */
  onMoving?: (position: { x: number; y: number }) => void;
};

/** Cada cuánto se apunta la posición mientras se arrastra, en ms. */
const TRACK_EVERY = 100;

export function PipPreview({
  previewOutput,
  canvas,
  x,
  y,
  width,
  radius,
  aspect,
  shadow,
  onMoved,
  onMoving,
}: Props) {
  const boxWidth = canvas.width * width;
  const boxHeight = boxWidth * aspect;
  // El redondeo va en fracción del lado corto, así que el tope real es su mitad:
  // ahí las esquinas se tocan y el recuadro queda redondo del todo.
  const boxRadius = (Math.min(boxWidth, boxHeight) / 2) * radius;

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

  const latestOnMoving = useRef(onMoving);
  latestOnMoving.current = onMoving;
  const track = useCallback((position: { x: number; y: number }) => {
    latestOnMoving.current?.(position);
  }, []);
  const lastTrackAt = useSharedValue(0);

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

          // Se va apuntando el recorrido, no solo el destino. A diez veces por
          // segundo basta: el montaje interpola entre punto y punto, así que en
          // el vídeo el recuadro acompaña al dedo en vez de dar un salto.
          const now = Date.now();
          if (now - lastTrackAt.value < TRACK_EVERY) return;
          lastTrackAt.value = now;
          const { width: canvasWidth, height: canvasHeight } = limits.value;
          runOnJS(track)({
            x: canvasWidth > 0 ? offsetX.value / canvasWidth : 0,
            y: canvasHeight > 0 ? offsetY.value / canvasHeight : 0,
          });
        })
        .onFinalize(() => {
          dragging.value = false;
          const { width: canvasWidth, height: canvasHeight } = limits.value;
          runOnJS(report)({
            x: canvasWidth > 0 ? offsetX.value / canvasWidth : 0,
            y: canvasHeight > 0 ? offsetY.value / canvasHeight : 0,
          });
        }),
    [dragging, limits, offsetX, offsetY, startX, startY, report, track, lastTrackAt],
  );

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        style={[
          styles.box,
          {
            width: boxWidth,
            height: boxHeight,
            borderRadius: boxRadius,
            // La sombra no puede ir en la misma vista que recorta: `overflow`
            // se la come. Por eso va aquí y la imagen se recorta dentro.
            shadowOpacity: shadow,
            shadowRadius: 18 * shadow,
            shadowOffset: { width: 0, height: 8 * shadow },
          },
          boxStyle,
        ]}>
        <View style={[styles.clip, { borderRadius: boxRadius }]}>
          <NativePreviewView
            previewOutput={previewOutput}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    top: 0,
    left: 0,
    shadowColor: '#000',
  },
  /** Recorta la imagen a la forma del recuadro. Va aparte de la sombra. */
  clip: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: '#000',
  },
});
