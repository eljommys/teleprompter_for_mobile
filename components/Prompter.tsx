import { useCallback, useMemo, useRef } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

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
  const {
    playing,
    travel,
    position,
    listRef,
    setViewportHeight,
    setContentHeight,
    toggleOnUI,
    touchStartedWhilePlaying,
  } = scroll;
  const padding = readLinePaddings(height, settings.readLine);

  /**
   * Dónde estaba el guion al posar el dedo, y cuándo se alternó por última vez.
   *
   * Un toque se puede detectar por dos caminos —el gesto de abajo y el propio
   * arrastre del `ScrollView`— y según lo que haga iOS con el toque llega por
   * uno, por el otro o por los dos. Cubrirlos los dos es lo que hace que parar
   * el guion funcione siempre; la marca de tiempo es para que, cuando lleguen
   * los dos, cuente una sola vez.
   */
  const dragStartY = useSharedValue(0);
  const lastToggleAt = useSharedValue(0);

  const toggleOnce = useCallback(() => {
    'worklet';
    const now = Date.now();
    if (now - lastToggleAt.value < 300) return;
    lastToggleAt.value = now;
    toggleOnUI();
  }, [lastToggleAt, toggleOnUI]);

  // Mientras arrastras mandas tú; el resto del tiempo, si está en marcha, manda
  // el bucle de fotogramas. Los dos escriben la misma posición normalizada, así
  // que no se pisan.
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: (event) => {
      // Esto salta también al posar el dedo sin moverlo, porque iOS abre un
      // arrastre para frenar el desplazamiento. Se apunta que venía en marcha
      // para que un toque limpio pueda pausarlo en vez de reanudarlo.
      touchStartedWhilePlaying.value = playing.value;
      playing.value = false;
      dragStartY.value = event.contentOffset.y;
    },
    onScroll: (event) => {
      if (travel.value <= 0) return;
      const next = event.contentOffset.y / travel.value;
      position.value = next < 0 ? 0 : next > 1 ? 1 : next;
    },
    onEndDrag: (event) => {
      // Un «arrastre» que no ha movido el guion es en realidad un toque: iOS
      // abre el arrastre solo por posar el dedo sobre algo que se desplaza. Es
      // justo el caso en el que el toque no llega a ningún otro sitio, así que
      // sin esto el guion no se puede parar tocando.
      if (Math.abs(event.contentOffset.y - dragStartY.value) < 6) toggleOnce();
    },
  });

  /**
   * Un toque alterna el avance.
   *
   * Va con un gesto de gesture-handler y no con un `Pressable`, y eso no es
   * capricho: con el guion avanzando, posar el dedo dentro del `ScrollView`
   * hace que iOS se quede el toque para frenar el desplazamiento y cancele el
   * `Pressable` antes de que llegue a soltar su `onPress`. El primer toque
   * —con todo quieto— funcionaba y el segundo no, así que el guion arrancaba
   * pero no había manera de pararlo salvo arrastrando.
   *
   * El detector cuelga del contenedor, por fuera del `ScrollView`, así que el
   * toque se reconoce aparte del desplazamiento y no se lo puede comer nadie.
   * `Tap` no reclama el gesto hasta confirmar que fue corto y sin arrastre, de
   * modo que mover el guion con el dedo sigue funcionando igual.
   */
  const hintSeen = useRef(settings.tapHintSeen);
  hintSeen.current = settings.tapHintSeen;
  const discover = useCallback(() => {
    if (!hintSeen.current) onTapDiscovered();
  }, [onTapDiscovered]);

  // Memorizado por lo mismo que el recuadro: un gesto nuevo en cada repintado
  // reinstala el reconocedor, y grabando se repinta cuatro veces por segundo.
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(300)
        .maxDistance(12)
        .onEnd(() => {
          'worklet';
          toggleOnce();
          runOnJS(discover)();
        }),
    [toggleOnce, discover],
  );

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
          decelerationRate="fast">
          {/* Los rellenos van aquí y no en `contentContainerStyle` para que la
              suma siga siendo el alto de la banda, que es lo que mantiene la
              invariante del recorrido. */}
          {/* El alto del contenido se mide aquí y no con `onContentSizeChange`
              del `ScrollView`: ese evento no llegaba, el recorrido se quedaba en
              cero y con recorrido cero el bucle de avance se sale sin mover
              nada. Un `onLayout` sobre el propio contenido sí llega siempre. */}
          <View
            onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
            style={{ paddingTop: padding.top, paddingBottom: padding.bottom }}>
            {/* Estrechar el texto añade líneas y, con ellas, alto de contenido;
                eso ya lo recoge el `onLayout` de arriba y el recorrido se
                recalcula solo, así que no te saca de donde ibas. */}
            <Text
              style={[
                styles.text,
                {
                  fontSize: settings.fontSize,
                  lineHeight: settings.fontSize * settings.lineHeight,
                  width: `${settings.textWidth * 100}%`,
                },
              ]}>
              {settings.text}
            </Text>
          </View>
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
    alignSelf: 'center',
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
