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
  type Constraint,
  type TargetCameraPosition,
} from 'react-native-vision-camera';

import { CameraBar } from './components/CameraBar';
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
import { useLastVideo } from './lib/useLastVideo';
import { useRecorder } from './lib/useRecorder';
import { useScriptScroll } from './lib/useScriptScroll';
import { useSettings } from './lib/useSettings';
import { listLenses, pickDevice } from './lib/lenses';
import { clamp, HIGH_FPS, pipAspect, STABILIZATION_MODES } from './lib/prompterSettings';
import { buildLensReference, buildZoomScale, clampZoom, type ZoomScale } from './lib/zoom';

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
  // El acceso directo a la galería. No pide nada al arrancar: si todavía no hay
  // permiso de lectura, el botón sale sin miniatura y lo pide al pulsarlo.
  const lastVideo = useLastVideo();

  /**
   * La grabadora persistente es la pieza que permite girar la cámara sin cortar
   * la toma: en iOS cambia a una tubería de `AVCaptureVideoDataOutput` +
   * `AVAssetWriter`, que sobrevive a que se reconfigure la entrada.
   */
  const videoOutput = useVideoOutput({
    targetResolution: CommonResolutions.FHD_16_9,
    enableAudio: true,
    enablePersistentRecorder: true,
    // `.mov` y sin tasa de bits puesta a mano: así la toma sale como la de la
    // cámara del sistema —mismo contenedor, mismo códec eficiente y la calidad
    // que el propio iPhone da por buena para ese formato—. Con `.mp4` y cifras
    // nuestras, el vídeo salía peor que el de la cámara de al lado sin motivo.
    fileType: 'mov',
  });
  const single = useRecorder(videoOutput, lastVideo.noteNewVideo);

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
      aspect: pipAspect(settings.pipShape),
      radius: settings.pipRadius,
      shadow: settings.pipShadow,
    },
    screenAspect: screenWidth / screenHeight,
    onSaved: lastVideo.noteNewVideo,
  });

  // Hacen falta las dos cosas: que el iPhone aguante dos cámaras y que este
  // binario traiga el montador nativo que las funde.
  const supportsDual = canComposeVideo && VisionCamera.supportsMultiCamSessions;
  // Lo que el usuario ha pedido, esté la sesión lista o no. Manda sobre el
  // `<Camera>` de una sola cámara para que nunca convivan las dos sesiones.
  const dualRequested = settings.dualCamera && supportsDual;

  /**
   * Las dos sesiones se turnan de verdad, no a la vez.
   *
   * La cámara única ya no se desmonta —eso mataba la app—, así que ahora hay dos
   * sesiones vivas y hay que asegurarse de que solo una tiene el hardware: si se
   * solapan, iOS interrumpe una y la imagen se queda congelada. La doble espera
   * a que la única avise de que ha parado, y la única espera a que la doble deje
   * de estar lista.
   */
  const [singleRunning, setSingleRunning] = useState(false);
  const dualEnabled = dualRequested && !singleRunning;

  const dual = useDualCamera(dualOutputs, {
    enabled: dualEnabled,
    mirrorFront: settings.mirrorFront,
    stabilization: settings.stabilization,
    backLenses: settings.backLenses,
    isRecording: dualRecorder.isRecording,
  });
  const dualMode = dualRequested && dual.ready;
  // La única no vuelve hasta que la doble suelta el hardware.
  const singleActive = !dualRequested && !dual.ready;

  const { isRecording, duration, isBusy, isProcessing, toggle } = dualRequested
    ? dualRecorder
    : single;

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

  const allDevices = useCameraDevices();
  /**
   * La trasera se elige a mano, no con el filtro de `useCameraDevice`.
   *
   * El filtro de la librería puntúa recorriendo `physicalDevices`, que en una
   * cámara física está vacío, así que todas las candidatas de una lente suelta
   * empatan a cero y se queda la primera que enumere el sistema. Pedir solo la
   * gran angular abría la principal. Ver `pickDevice`.
   */
  const backDevice = useMemo(
    () => pickDevice(allDevices, 'back', appliedLenses),
    [allDevices, appliedLenses],
  );
  const frontDevice = useCameraDevice('front');
  const device = facing === 'back' ? backDevice : frontDevice;

  /** Las lentes que este iPhone tiene de verdad detrás. */
  const availableLenses = useMemo(() => listLenses(allDevices, 'back'), [allDevices]);

  /**
   * A qué factor visible corresponde cada lente en este aparato: 0,5×, 1×, 5×.
   *
   * Se mide una vez sobre la cámara virtual del iPhone y sirve para todas, que
   * es lo que permite que una lente suelta siga enseñando su factor de verdad.
   */
  const lensReference = useMemo(() => buildLensReference(allDevices), [allDevices]);

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
   * Los 60 fps se congelan igual que la estabilización, y por lo mismo: son otra
   * restricción de la sesión, así que moverlos en caliente la reconfiguraría en
   * mitad de la toma.
   */
  const [appliedFps, setAppliedFps] = useState(settings.highFrameRate);
  useEffect(() => {
    if (isRecording) return;
    setAppliedFps(settings.highFrameRate);
  }, [isRecording, settings.highFrameRate]);

  /** ¿Da esta cámara 60 fps? Si no, el ajuste ni se ofrece. */
  const supportsHighFrameRate = useMemo(() => device?.supportsFPS(HIGH_FPS) ?? false, [device]);

  /**
   * Memorizado por valor: un array nuevo en cada render sería una sesión nueva
   * en cada render.
   *
   * Van las dos restricciones de estabilización, y no solo la de vídeo, porque
   * `videoStabilizationMode` solo toca el fichero grabado. Con ella sola el
   * ajuste parece no hacer nada: la vista previa se ve exactamente igual y solo
   * notarías la diferencia reproduciendo la toma después.
   *
   * Los fps van los primeros de la lista a propósito. La sesión negocia todo
   * junto y no siempre cabe todo: pidiendo antes los 60 fps, si hay que soltar
   * algo se suelta la estabilización, que es lo que se ha pedido —«60 fps
   * cuando se pueda»— y no al revés.
   */
  const constraints = useMemo(() => {
    const wanted: Constraint[] = [];
    // Pedirlos a una cámara que no los da no rompe nada —la negociación cae al
    // formato más cercano—, pero sí puede llevarse por delante lo que sí cabía.
    if (appliedFps && supportsHighFrameRate) wanted.push({ fps: HIGH_FPS });
    wanted.push({ videoStabilizationMode: appliedStabilization });
    wanted.push({ previewStabilizationMode: appliedStabilization });
    return wanted;
  }, [appliedFps, supportsHighFrameRate, appliedStabilization]);

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
    const next = buildZoomScale(device, controller, lensReference);
    setScale(next);
    const remembered = rememberedZoom.current[facing];
    const restored = clampZoom(remembered ?? next.minRaw, next);
    zoom.value = restored;
    setZoomUi(restored);
  }, [device, facing, zoom, lensReference]);

  /**
   * Reconstruye la escala de zoom cada vez que la sesión se reconfigura.
   *
   * Llamar a `syncZoomScale` desde `onConfigured` a secas no vale, aunque sea
   * lo que parece: VisionCamera avisa **antes** de publicar el controlador
   * nuevo, así que en ese instante `camera.current.controller` sigue siendo el
   * de la configuración anterior y la escala sale con sus números. Y no hay un
   * segundo aviso que lo enmiende, porque `onStarted` solo salta al arrancar la
   * sesión, no al reconfigurarla estando ya en marcha —que es lo que pasa al
   * tocar los fps, la estabilización o las lentes—.
   *
   * Contando las reconfiguraciones en estado, esto corre después del pintado,
   * que es cuando la referencia ya trae el controlador bueno. Por referencia y
   * no por dependencia para que solo lo dispare la reconfiguración: `facing`
   * cambia antes de que la sesión se entere, y ahí el controlador todavía es el
   * de la otra cámara.
   */
  const [configureCount, setConfigureCount] = useState(0);
  const syncZoomScaleRef = useRef(syncZoomScale);
  syncZoomScaleRef.current = syncZoomScale;
  useEffect(() => {
    if (configureCount === 0) return;
    syncZoomScaleRef.current();
  }, [configureCount]);

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
    const next = buildZoomScale(dualController.device, dualController, lensReference);
    setScale(next);
    const remembered = rememberedZoom.current[facing];
    const restored = clampZoom(remembered ?? next.minRaw, next);
    zoom.value = restored;
    setZoomUi(restored);
    void dualController.setZoom(restored);
  }, [dualController, facing, zoom, lensReference]);

  /**
   * Exposición y linterna.
   *
   * Las dos se pueden mover en mitad de una toma, y es a propósito: a
   * diferencia de la estabilización o las lentes, ninguna reconfigura la
   * sesión —van a la configuración del dispositivo, con su bloqueo y su
   * desbloqueo—, así que cambiarlas grabando no corta nada.
   *
   * La exposición se guarda con el resto de ajustes: si sueles grabar en el
   * mismo sitio, la corrección buena es la misma cada día y no hay por qué
   * volver a buscarla. La linterna no: encendida sola al abrir la app sería
   * una sorpresa desagradable, así que arranca siempre apagada.
   */
  const exposure = settings.exposure;
  const [torch, setTorch] = useState(false);

  // La cámara que llena el cuadro ahora mismo. Con las dos abiertas no es la de
  // `useCameraDevice`, sino la que devolvió `configure`.
  const activeDevice = dualMode ? (dualController?.device ?? null) : (device ?? null);

  const exposureRange = useMemo(() => {
    if (activeDevice == null || !activeDevice.supportsExposureBias) return null;
    return { min: activeDevice.minExposureBias, max: activeDevice.maxExposureBias };
  }, [activeDevice]);

  /**
   * Cada cámara tiene su rango, así que al girar hay que recortar lo que
   * llevabas puesto: pedir una compensación fuera de rango lanza.
   *
   * Sin rango no se toca nada. Al arrancar todavía no hay cámara, y poner un
   * cero ahí borraría de disco la exposición que el usuario dejó puesta. Y se
   * escribe solo cuando de verdad sobra, para no guardar en cada repintado.
   */
  useEffect(() => {
    if (exposureRange == null) return;
    const clamped = clamp(exposure, exposureRange.min, exposureRange.max);
    if (clamped !== exposure) update({ exposure: clamped });
  }, [exposure, exposureRange, update]);

  /**
   * El flash es de la cámara trasera; la frontal no tiene ninguno.
   *
   * Con las dos abiertas la trasera está siempre encendida, así que la linterna
   * sirve mires a donde mires: alumbra lo que ella ve, esté llenando el cuadro
   * o metida en el recuadro.
   */
  const torchController = dualMode ? dual.backController : null;
  const hasTorch = (dualMode ? torchController?.device : device)?.hasTorch ?? false;
  useEffect(() => {
    if (!hasTorch) setTorch(false);
  }, [hasTorch]);

  // Con una sola cámara de esto se encargan las props de `<Camera>`; con dos no
  // hay componente al que atarlas y hay que empujarlas al controlador a mano.
  useEffect(() => {
    if (dualController == null || exposureRange == null) return;
    void dualController.setExposureBias(exposure).catch(() => undefined);
  }, [dualController, exposure, exposureRange]);

  useEffect(() => {
    if (torchController == null || !hasTorch) return;
    void torchController.setTorchMode(torch ? 'on' : 'off').catch(() => undefined);
  }, [torchController, hasTorch, torch]);

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
            isActive={singleActive}
            outputs={[videoOutput]}
            constraints={constraints}
            zoom={zoom}
            // `undefined` y no 0 cuando no toca: si la cámara no admite
            // compensación, pedirle cualquier valor —aunque sea el neutro—
            // lanza; y con el modo doble encendido el rango que hay medido es
            // el de la otra sesión, que no tiene por qué valer para esta.
            exposure={dualRequested || exposureRange == null ? undefined : exposure}
            // Apagada mientras manda el modo doble: esta sesión está parada y
            // la linterna la lleva el controlador de la trasera.
            torchMode={!dualRequested && torch && hasTorch ? 'on' : 'off'}
            // 'auto' espeja solo las cámaras frontales, que es lo que hace la
            // cámara del sistema. 'off' no espeja nada.
            mirrorMode={settings.mirrorFront ? 'auto' : 'off'}
            // La app está bloqueada en vertical, así que la orientación de la
            // interfaz es la orientación correcta para el fichero.
            orientationSource="interface"
            resizeMode="cover"
            onStarted={() => {
              setSingleRunning(true);
              syncZoomScale();
            }}
            onStopped={() => setSingleRunning(false)}
            onConfigured={() => setConfigureCount((count) => count + 1)}
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
          {ready && settings.prompterEnabled ? (
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
            radius={settings.pipRadius}
            aspect={pipAspect(settings.pipShape)}
            shadow={settings.pipShadow}
            onMoved={({ x, y }) => update({ pipX: x, pipY: y })}
            // Mientras se arrastra, la grabación apunta el recorrido; a los
            // ajustes solo va la posición final, que es la que hay que guardar.
            onMoving={dualRecorder.trackMove}
          />
        ) : null}

        <View
          style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}
          onLayout={(event) => setControlsHeight(event.nativeEvent.layout.height)}
          pointerEvents="box-none">
          <CameraBar
            lastVideoUri={lastVideo.uri}
            onOpenGallery={lastVideo.open}
            exposureRange={exposureRange}
            exposure={exposure}
            onChangeExposure={(next) => update({ exposure: next })}
            hasTorch={hasTorch}
            torch={torch}
            onToggleTorch={() => setTorch((current) => !current)}
          />
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

        {/* Entre parar y ver el vídeo en el Carrete pasa un rato: con las dos
            cámaras porque hay que fundirlas, que es una exportación entera, y
            con una sola porque cerrar el fichero y copiarlo a la fototeca
            tampoco es gratis. Sin avisar, ese rato parece una toma perdida.

            A pantalla completa y capturando los toques: mientras tanto no hay
            nada que tocar, y antes —con un aviso pequeño arriba— se colaba el
            impulso de darle otra vez al botón. */}
        {isProcessing ? (
          <View style={styles.saving}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.savingTitle}>{t('recorder.savingTitle')}</Text>
            <Text style={styles.savingBody}>
              {dualRequested ? t('recorder.savingBody') : t('recorder.savingBodyOne')}
            </Text>
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
          supportsHighFrameRate={supportsHighFrameRate}
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
  saving: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 48,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  savingTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  savingBody: {
    color: '#8e8e93',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
