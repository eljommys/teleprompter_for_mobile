import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  useVideoOutput,
  type CameraRef,
  type TargetCameraPosition,
} from 'react-native-vision-camera';

import { ControlBar } from './components/ControlBar';
import { t } from './lib/i18n';
import { DebugPanel } from './components/DebugPanel';
import { Prompter } from './components/Prompter';
import { SettingsSheet } from './components/SettingsSheet';
import { ZoomControls } from './components/ZoomControls';
import { useRecorder } from './lib/useRecorder';
import { useScriptScroll } from './lib/useScriptScroll';
import { useSettings } from './lib/useSettings';
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
  const { height: screenHeight } = useWindowDimensions();

  const camera = useRef<CameraRef>(null);
  const cameraPermission = useCameraPermission();
  const microphonePermission = useMicrophonePermission();

  const [facing, setFacing] = useState<TargetCameraPosition>('back');
  const [showSettings, setShowSettings] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [scale, setScale] = useState<ZoomScale | null>(null);

  const { settings, loaded, update } = useSettings();
  const scroll = useScriptScroll(settings.speed, settings.fontSize);

  // La trasera se pide con las tres lentes: es lo que da las paradas ópticas de
  // 0,5× / 1× / 3×. La frontal es una sola lente, sin filtro que valga.
  const backDevice = useCameraDevice('back', {
    physicalDevices: ['ultra-wide-angle', 'wide-angle', 'telephoto'],
  });
  const frontDevice = useCameraDevice('front');
  const device = facing === 'back' ? backDevice : frontDevice;

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
  const { isRecording, duration, isBusy, toggle } = useRecorder(videoOutput);

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
  // El guion no depende de la cámara. Si falta el permiso o no hay dispositivo,
  // el fondo se queda negro pero se sigue pudiendo leer y ensayar.
  const ready = loaded;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

        {device != null && cameraPermission.hasPermission ? (
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive
            outputs={[videoOutput]}
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
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              {cameraPermission.hasPermission ? t('camera.searching') : t('camera.noPermission')}
            </Text>
          </View>
        )}

        <View style={styles.band} pointerEvents="box-none">
          {ready ? <Prompter settings={settings} scroll={scroll} height={panelHeight} /> : null}
        </View>

        <View
          style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}
          pointerEvents="box-none">
          <ZoomControls
            scale={scale}
            zoom={zoom}
            zoomUi={zoomUi}
            onChangeZoom={setZoomUi}
            onSettle={rememberZoom}
          />
          <ControlBar
            isRecording={isRecording}
            isBusy={isBusy}
            duration={duration}
            onToggleRecord={toggle}
            onFlip={flip}
            canFlip={backDevice != null && frontDevice != null}
            onOpenSettings={() => setShowSettings(true)}
          />
        </View>

        {/* Esquina muerta, sin nada dibujado: un toque largo enseña los números
            crudos de la cámara. */}
        <Pressable
          style={[styles.debugCorner, { top: insets.top }]}
          onLongPress={() => setShowDebug((current) => !current)}
          delayLongPress={700}
        />
        {showDebug ? <DebugPanel device={device} scale={scale} scroll={scroll} /> : null}

        <SettingsSheet
          visible={showSettings}
          settings={settings}
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
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
});
