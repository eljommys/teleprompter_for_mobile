import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  CommonResolutions,
  NativePreviewView,
  useCameraDevice,
  useCameraDevices,
  useCameraPermission,
  useMicrophonePermission,
  useVideoOutput,
  VisionCamera,
  type CameraRef,
  type CameraSessionConfig,
  type TargetCameraPosition,
} from 'react-native-vision-camera';

import { ControlBar } from './components/ControlBar';
import { t } from './lib/i18n';
import { DebugPanel } from './components/DebugPanel';
import { PipPreview } from './components/PipPreview';
import { Prompter } from './components/Prompter';
import { SettingsSheet } from './components/SettingsSheet';
import { ZoomControls } from './components/ZoomControls';
import { canComposeVideo } from './modules/video-composer';
import { useDualCamera, useDualOutputs } from './lib/useDualCamera';
import { useDualRecorder } from './lib/useDualRecorder';
import { useRecorder } from './lib/useRecorder';
import { useScriptScroll } from './lib/useScriptScroll';
import { useSettings } from './lib/useSettings';
import { LENS_TYPES, STABILIZATION_MODES } from './lib/prompterSettings';
import { buildZoomScale, clampZoom, type ZoomScale } from './lib/zoom';

/**
 * Girar la cámara reconfigura la sesión entera. Encadenar giros rápidos es la
 * causa conocida de que una grabación en curso se venga abajo, así que entre
 * uno y otro tiene que pasar al menos esto.
 */
const FLIP_COOLDOWN = 600;

function Studio() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  const camera = useRef<CameraRef>(null);
  const cameraPermission = useCameraPermission();
  const microphonePermission = useMicrophonePermission();

  const [facing, setFacing] = useState<TargetCameraPosition>('back');
  const [showSettings, setShowSettings] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [scale, setScale] = useState<ZoomScale | null>(null);

  const { settings, loaded, update } = useSettings();
  const scroll = useScriptScroll(settings.speed, settings.fontSize);

  /**
   * La grabadora persistente es la pieza que permite girar la cámara sin cortar
   * la toma: en iOS cambia a una tubería de `AVCaptureVideoDataOutput` +
   * `AVAssetWriter`, que sobrevive a que se reconfigure la entrada.
   */
  const videoOutput = useVideoOutput({
    targetResolution: CommonResolutions.FHD_16_9,
    enableAudio: true,
    enablePersistentRecorder: true,
    fileType: 'mp4',
  });
  const single = useRecorder(videoOutput);

  /**
   * Las dos cámaras a la vez. La sesión solo se levanta con el modo encendido:
   * no puede haber dos sesiones vivas, así que esta y el `<Camera>` de abajo se
   * turnan.
   *
   * Las salidas van antes que la sesión porque quien graba las necesita para
   * poder decir si hay una toma en marcha, y la sesión necesita saberlo para no
   * reconfigurarse en mitad. Si colgaran de la sesión, no habría por dónde
   * empezar.
   */
  const dualOutputs = useDualOutputs();
  // Las salidas van fijas —la trasera siempre a la de atrás, que es la que
  // lleva el audio— y quien manda en el cuadro se decide en el montaje. Así
  // girar en mitad de una toma no toca las grabadoras: solo apunta el cambio.
  const dualRecorder = useDualRecorder({
    back: dualOutputs.backVideo,
    front: dualOutputs.frontVideo,
    shot: {
      backIsBackground: facing === 'back',
      x: settings.pipX,
      y: settings.pipY,
      width: settings.pipWidth,
    },
    screenAspect: screenWidth / screenHeight,
  });

  // Hacen falta las dos cosas: que el iPhone aguante dos cámaras y que este
  // binario traiga el montador nativo que las funde.
  const supportsDual = canComposeVideo && VisionCamera.supportsMultiCamSessions;
  // Lo que el usuario ha pedido, esté la sesión lista o no. Manda sobre el
  // `<Camera>` de una sola cámara para que nunca convivan las dos sesiones.
  const dualRequested = settings.dualCamera && supportsDual;

  const dual = useDualCamera(dualOutputs, {
    enabled: dualRequested,
    mirrorFront: settings.mirrorFront,
    stabilization: settings.stabilization,
    backLenses: settings.backLenses,
    isRecording: dualRecorder.isRecording,
  });
  const dualMode = dualRequested && dual.ready;

  const { isRecording, duration, isBusy, toggle } = dualRequested ? dualRecorder : single;
  const isComposing = dualRecorder.isComposing;

  /**
   * Las lentes de la trasera las elige el usuario; por defecto van las tres, que
   * es lo que da las paradas ópticas de 0,5× / 1× / 3×. La frontal es una sola
   * lente, sin filtro que valga.
   *
   * El filtro puntúa: suma por cada lente pedida y resta por cada una de más,
   * así que pedir solo la principal se lleva la cámara de una lente en vez de la
   * triple. O sea que sí limita de verdad, aunque su nombre diga «filtro».
   *
   * Se congelan mientras se graba, por lo mismo que la estabilización: cambiar
   * de lente cambia de dispositivo, y eso reconfigura la sesión en mitad de la
   * toma. El cambio entra en cuanto paras.
   */
  const [appliedLenses, setAppliedLenses] = useState(settings.backLenses);
  useEffect(() => {
    if (isRecording) return;
    setAppliedLenses(settings.backLenses);
  }, [isRecording, settings.backLenses]);
  const backLensFilter = useMemo(() => ({ physicalDevices: appliedLenses }), [appliedLenses]);
  const backDevice = useCameraDevice('back', backLensFilter);
  const frontDevice = useCameraDevice('front');
  const device = facing === 'back' ? backDevice : frontDevice;

  /**
   * Las lentes que este iPhone tiene de verdad detrás.
   *
   * Se sacan de todas las cámaras traseras que enumera el sistema, no del
   * dispositivo activo: el activo es justo el que acaba de recortar el filtro,
   * así que preguntarle a él por las lentes disponibles dejaría fuera las que el
   * usuario ha desmarcado y ya no podría volver a marcarlas.
   */
  const allDevices = useCameraDevices();
  const availableLenses = useMemo(() => {
    const present = new Set<string>();
    for (const candidate of allDevices) {
      if (candidate.position !== 'back') continue;
      if (candidate.physicalDevices.length === 0) present.add(candidate.type);
      for (const physical of candidate.physicalDevices) present.add(physical.type);
    }
    return LENS_TYPES.filter((lens) => present.has(lens));
  }, [allDevices]);

  /**
   * La estabilización se congela mientras se graba.
   *
   * Cambiar una restricción reconfigura la sesión de cámara, y reconfigurar en
   * mitad de una toma es exactamente lo que la parte —es el mismo motivo por el
   * que girar de cámara necesita la grabadora persistente—. Mover el ajuste
   * durante una grabación no hace nada; entra en cuanto paras.
   */
  const [appliedStabilization, setAppliedStabilization] = useState(settings.stabilization);
  useEffect(() => {
    if (isRecording) return;
    setAppliedStabilization(settings.stabilization);
  }, [isRecording, settings.stabilization]);

  /**
   * Memorizado por valor: un array nuevo en cada render sería una sesión nueva
   * en cada render.
   *
   * Van las dos restricciones, y no solo la de vídeo, porque
   * `videoStabilizationMode` solo toca el fichero grabado. Con ella sola el
   * ajuste parece no hacer nada: la vista previa se ve exactamente igual y solo
   * notarías la diferencia reproduciendo la toma después.
   */
  const constraints = useMemo(
    () => [
      { videoStabilizationMode: appliedStabilization },
      { previewStabilizationMode: appliedStabilization },
    ],
    [appliedStabilization],
  );

  /**
   * Los modos que este iPhone admite de verdad.
   *
   * Si se ofrece uno que la cámara no soporta, la negociación de restricciones
   * cae a otro sin decir nada y el resultado es un ajuste que aparenta estar
   * puesto sin estarlo.
   */
  const availableStabilization = useMemo(
    () =>
      STABILIZATION_MODES.filter(
        (mode) => mode === 'off' || (device?.supportsVideoStabilizationMode(mode) ?? false),
      ),
    [device],
  );

  // Lo que la sesión ha elegido de verdad tras negociar. Solo para el panel de
  // depuración: es la única forma de comprobar que el ajuste llega a la cámara.
  const [sessionConfig, setSessionConfig] = useState<CameraSessionConfig | null>(null);

  // Un único zoom vivo (el que consume la cámara) más la memoria de cada
  // cámara, para que volver de la frontal te devuelva el encuadre de antes.
  //
  // `zoomUi` es el mismo número en estado de React: el deslizador y los botones
  // de lente necesitan saber dónde ponerse, y un `SharedValue` no provoca
  // repintados. El valor compartido sigue siendo el que manda sobre la cámara.
  const zoom = useSharedValue(1);
  const [zoomUi, setZoomUi] = useState(1);
  const rememberedZoom = useRef<Partial<Record<TargetCameraPosition, number>>>({});
  const lastFlip = useRef(0);

  useEffect(() => {
    if (!cameraPermission.hasPermission && cameraPermission.canRequestPermission) {
      void cameraPermission.requestPermission();
    }
  }, [cameraPermission]);

  useEffect(() => {
    if (!microphonePermission.hasPermission && microphonePermission.canRequestPermission) {
      void microphonePermission.requestPermission();
    }
  }, [microphonePermission]);

  /**
   * Se llama al arrancar la sesión y cada vez que se reconfigura, o sea también
   * al girar la cámara. Es el único momento en el que existe un controlador del
   * que sacar el rango de zoom real de esta cámara.
   */
  const syncZoomScale = useCallback(() => {
    const controller = camera.current?.controller;
    if (device == null || controller == null) return;
    const next = buildZoomScale(device, controller);
    setScale(next);
    const remembered = rememberedZoom.current[facing];
    const restored = clampZoom(remembered ?? next.minRaw, next);
    zoom.value = restored;
    setZoomUi(restored);
  }, [device, facing, zoom]);

  /**
   * El controlador de la cámara que llena el cuadro, con las dos abiertas.
   *
   * Sin `<Camera>` no hay prop `zoom` que atar a la sesión, así que el zoom se
   * le pide a mano al controlador que devolvió `configure`. Al girar cambia el
   * controlador, y con él el rango: cada cámara tiene el suyo.
   */
  const dualController = dualMode
    ? facing === 'back'
      ? dual.backController
      : dual.frontController
    : null;

  useEffect(() => {
    if (dualController == null) return;
    const next = buildZoomScale(dualController.device, dualController);
    setScale(next);
    const remembered = rememberedZoom.current[facing];
    const restored = clampZoom(remembered ?? next.minRaw, next);
    zoom.value = restored;
    setZoomUi(restored);
    void dualController.setZoom(restored);
  }, [dualController, facing, zoom]);

  /**
   * Lleva el zoom a la cámara.
   *
   * Con una sola cámara lo hace `<Camera zoom={...}>` por su cuenta desde el
   * hilo de UI; con dos hay que empujarlo aquí, que es lo que iguala el
   * comportamiento de los dos modos.
   */
  const applyZoom = useCallback(
    (raw: number) => {
      setZoomUi(raw);
      if (dualController != null) void dualController.setZoom(raw);
    },
    [dualController],
  );

  /**
   * Apunta el zoom en el que te has quedado con esta cámara.
   *
   * Se llama al soltar el pellizco y al pulsar una lente, no en cada fotograma:
   * el zoom vive en el hilo de UI y cruzar a JS sesenta veces por segundo para
   * apuntar un número no compensa. Con esto, `syncZoomScale` puede reconstruir
   * la escala cuantas veces haga falta sin devolverte al gran angular.
   */
  const rememberZoom = useCallback(
    (value: number) => {
      rememberedZoom.current[facing] = value;
    },
    [facing],
  );

  const flip = useCallback(() => {
    const now = Date.now();
    if (now - lastFlip.current < FLIP_COOLDOWN) return;
    lastFlip.current = now;
    rememberedZoom.current[facing] = zoom.value;
    setScale(null);
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }, [facing, zoom]);

  const panelHeight = Math.round(screenHeight * settings.panelHeight);

  /**
   * Dónde se coloca la banda del guion.
   *
   * El recorrido llega hasta el borde de arriba del todo, por debajo de la hora
   * y de la isla dinámica. Es a propósito y no un descuido del área segura: en
   * un teleprompter, lo que se persigue es leer lo más cerca posible del
   * objetivo de la cámara frontal, y esos milímetros son justo la diferencia
   * entre parecer que miras a cámara y parecer que lees. Por abajo sí se
   * respeta el bloque de controles —medido, no estimado—, que ahí no hay nada
   * que ganar y sí un botón de grabar que no se puede tapar.
   */
  const [controlsHeight, setControlsHeight] = useState(0);
  const bandTop = Math.max(0, screenHeight - controlsHeight - panelHeight) * settings.panelTop;
  // El guion no depende de la cámara. Si falta el permiso o no hay dispositivo,
  // el fondo se queda negro pero se sigue pudiendo leer y ensayar.
  const ready = loaded;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

        {/* La cámara única no se desmonta al pasar al modo doble: solo se
            apaga con `isActive` y se esconde.

            Desmontarla es lo que mataba la app. Al quitarla, `<Camera>` suelta
            su sesión con un `stop()` y un `configure([])` que nadie espera; si
            el recolector de Hermes llega a esa sesión antes de que termine de
            desconectar sus salidas, AVFoundation aborta el proceso desde el
            `dealloc`. Reventaba sin tocar nada porque lo dispara el recolector,
            no el usuario. Apagada y montada, la sesión sigue viva y con sus
            salidas en orden. */}
        {device != null && cameraPermission.hasPermission ? (
          <Camera
            ref={camera}
            style={[StyleSheet.absoluteFill, dualRequested ? styles.hidden : null]}
            device={device}
            isActive={!dualRequested}
            outputs={[videoOutput]}
            constraints={constraints}
            zoom={zoom}
            // 'auto' espeja solo las cámaras frontales, que es lo que hace la
            // cámara del sistema. 'off' no espeja nada.
            mirrorMode={settings.mirrorFront ? 'auto' : 'off'}
            // La app está bloqueada en vertical, así que la orientación de la
            // interfaz es la orientación correcta para el fichero.
            orientationSource="interface"
            resizeMode="cover"
            onStarted={syncZoomScale}
            onConfigured={syncZoomScale}
            onSessionConfigSelected={setSessionConfig}
          />
        ) : null}

        {dualRequested ? (
          dualMode ? (
            // La de fondo llena el cuadro. El recuadro con la otra no va aquí:
            // se pinta más abajo, por encima del guion.
            <NativePreviewView
              previewOutput={facing === 'back' ? dualOutputs.backPreview : dualOutputs.frontPreview}
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            // Si ha fallado hay que decirlo: si no, el interruptor se queda
            // encendido sin enseñar nada y parece que el modo no hace nada.
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>
                {dual.error == null ? t('camera.searching') : t('camera.dualFailed')}
              </Text>
              {/* El motivo de verdad, en pequeño: el mensaje de arriba vale
                  para cualquier fallo y disfrazaba causas muy distintas. */}
              {dual.error == null ? null : (
                <Text style={styles.placeholderDetail}>{dual.error}</Text>
              )}
            </View>
          )
        ) : device == null || !cameraPermission.hasPermission ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              {cameraPermission.hasPermission ? t('camera.searching') : t('camera.noPermission')}
            </Text>
          </View>
        ) : null}

        <View style={[styles.band, { top: bandTop }]} pointerEvents="box-none">
          {ready ? (
            <Prompter
              settings={settings}
              scroll={scroll}
              height={panelHeight}
              onTapDiscovered={() => update({ tapHintSeen: true })}
            />
          ) : null}
        </View>

        {/* Después del guion a propósito: por encima, para que se pueda coger
            siempre. Debajo, si lo soltabas sobre la banda del guion te quedabas
            sin poder volver a moverlo, porque los toques se los quedaba el
            guion. Va antes de los controles de abajo, que sí deben taparlo:
            entre mover el recuadro y llegar al botón de grabar, manda el botón. */}
        {dualMode ? (
          <PipPreview
            previewOutput={facing === 'back' ? dualOutputs.frontPreview : dualOutputs.backPreview}
            canvas={{ width: screenWidth, height: screenHeight }}
            x={settings.pipX}
            y={settings.pipY}
            width={settings.pipWidth}
            onMoved={({ x, y }) => update({ pipX: x, pipY: y })}
          />
        ) : null}

        <View
          style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}
          onLayout={(event) => setControlsHeight(event.nativeEvent.layout.height)}
          pointerEvents="box-none">
          <ZoomControls
            scale={scale}
            zoom={zoom}
            zoomUi={zoomUi}
            onChangeZoom={applyZoom}
            onSettle={rememberZoom}
          />
          <ControlBar
            isRecording={isRecording}
            isBusy={isBusy}
            duration={duration}
            onToggleRecord={toggle}
            onFlip={flip}
            // Con las dos cámaras se puede girar también grabando, que es de lo
            // que va el modo: las dos están ya en el fichero y el cambio solo
            // decide quién llena el cuadro a partir de ese segundo.
            canFlip={dualMode || (backDevice != null && frontDevice != null)}
            onOpenSettings={() => setShowSettings(true)}
          />
        </View>

        {/* Fundir las dos tomas es una exportación entera y tarda lo suyo. Sin
            avisar, el rato entre parar y ver el vídeo en el Carrete parece que
            la grabación se ha perdido. */}
        {isComposing ? (
          <View pointerEvents="none" style={[styles.composing, { top: insets.top + 12 }]}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.composingText}>{t('recorder.composing')}</Text>
          </View>
        ) : null}

        {/* Esquina muerta, sin nada dibujado: un toque largo enseña los números
            crudos de la cámara. */}
        <Pressable
          style={[styles.debugCorner, { top: insets.top }]}
          onLongPress={() => setShowDebug((current) => !current)}
          delayLongPress={700}
        />
        {showDebug ? (
          <DebugPanel device={device} scale={scale} scroll={scroll} sessionConfig={sessionConfig} />
        ) : null}

        <SettingsSheet
          visible={showSettings}
          settings={settings}
          availableStabilization={availableStabilization}
          availableLenses={availableLenses}
          supportsDualCamera={supportsDual}
          stabilizationDropped={dualMode && !dual.stabilized}
          update={update}
          onClose={() => setShowSettings(false)}
          onRewind={scroll.rewind}
        />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <Studio />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#8e8e93',
    fontSize: 15,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 14,
  },
  debugCorner: {
    position: 'absolute',
    left: 0,
    width: 56,
    height: 56,
  },
  hidden: {
    // Apagada pero montada: se esconde sin quitarla del árbol, que es justo lo
    // que no se puede hacer.
    opacity: 0,
  },
  placeholderDetail: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 8,
    paddingHorizontal: 32,
    textAlign: 'center',
  },
  composing: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  composingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
