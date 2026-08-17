import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedScrollHandler } from 'react-native-reanimated';

import { t } from '../lib/i18n';
import { readLinePaddings, type PrompterSettings } from '../lib/prompterSettings';
import type { ScriptScroll } from '../lib/useScriptScroll';

type Props = {
  settings: PrompterSettings;
  scroll: ScriptScroll;
  /** Alto de la banda en px, ya calculado desde `settings.panelHeight`. */
  height: number;
  /** Se llama la primera vez que alguien descubre el toque. */
  onTapDiscovered: () => void;
};

/**
 * La banda central con el guion.
 *
 * Va sobre un `ScrollView` de verdad, y no sobre un bloque con `transform`,
 * por una razón que costó ver: un `<Text>` metido en un hueco de alto fijo se
 * mide contra ese alto y **se corta**. Arrastrando aparecía siempre el mismo
 * trozo de guion y nunca el resto. Un `ScrollView` mide su contenido aparte del
 * hueco, así que el guion entero existe.
 *
 * De regalo, el arrastre pasa a ser el desplazamiento nativo: inercia, rebote y
 * cero peleas por el gesto. El avance automático se sigue empujando desde el
 * hilo de UI con `scrollTo`, así que no da tirones mientras se graba.
 */
export function Prompter({ settings, scroll, height, onTapDiscovered }: Props) {
  const { playing, travel, position, listRef, setViewportHeight, setContentHeight } = scroll;
  const padding = readLinePaddings(height, settings.readLine);

  // Mientras arrastras mandas tú; el resto del tiempo, si está en marcha, manda
  // el bucle de fotogramas. Los dos escriben la misma posición normalizada, así
  // que no se pisan.
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: () => {
      playing.value = false;
    },
    onScroll: (event) => {
      if (travel.value <= 0) return;
      const next = event.contentOffset.y / travel.value;
      position.value = next < 0 ? 0 : next > 1 ? 1 : next;
    },
  });

  // Un toque alterna el avance. `Tap` no reclama el gesto hasta que se confirma
  // que fue corto y sin movimiento, así que el desplazamiento nativo del
  // `ScrollView` sigue funcionando por debajo.
  const tap = Gesture.Tap().onEnd((_event, success) => {
    if (!success) return;
    // Al final del guion, un toque lo rebobina en vez de no hacer nada.
    if (position.value >= 1) position.value = 0;
    playing.value = !playing.value;
    // El gesto vive en el hilo de UI; guardar el ajuste es cosa de JS. Solo se
    // cruza una vez en la vida de la instalación.
    if (!settings.tapHintSeen) runOnJS(onTapDiscovered)();
  });

  const backgroundColor = `rgba(0, 0, 0, ${settings.opacity})`;

  return (
    <GestureDetector gesture={tap}>
      <View
        style={[styles.viewport, { height, backgroundColor }]}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}>
        <Animated.ScrollView
          ref={listRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          // El avance automático mueve el desplazamiento por su cuenta; el
          // frenado por inercia del sistema pelearía con él.
          decelerationRate="fast"
          onContentSizeChange={(_width, contentHeight) => setContentHeight(contentHeight)}
          contentContainerStyle={{
            paddingTop: padding.top,
            paddingBottom: padding.bottom,
          }}>
          <Text
            style={[
              styles.text,
              {
                fontSize: settings.fontSize,
                lineHeight: settings.fontSize * settings.lineHeight,
              },
            ]}>
            {settings.text}
          </Text>
        </Animated.ScrollView>

        {/* Marca de la línea de lectura: dónde apoyar la vista. */}
        <View pointerEvents="none" style={[styles.readLine, { top: padding.top }]} />

        {/* El toque para poner el guion en marcha no se ve por ninguna parte, y
            quien no lo descubre da por hecho que la app no lo hace. El aviso se
            va solo en cuanto se usa una vez. */}
        {settings.tapHintSeen ? null : (
          <View pointerEvents="none" style={styles.hint}>
            <Text style={styles.hintText}>{t('prompter.tapHint')}</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
  },
  text: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 18,
    // Contorno suave para que el texto se lea sobre cualquier fondo.
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  readLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
});
