/**
 * Sesión con las dos cámaras a la vez.
 *
 * El componente `<Camera>` no sirve para esto: crea su sesión con
 * `enableMultiCamSupport: false` fijo y no hay prop que lo cambie, así que dos
 * `<Camera>` montados son dos sesiones peleándose por el hardware e iOS acaba
 * interrumpiendo una. La única puerta a `AVCaptureMultiCamSession` es la API
 * imperativa, y por eso aquí se monta la sesión a mano.
 *
 * El precio de salir de `<Camera>` es que hay que reponer lo que daba hecho: la
 * orientación de los ficheros y el espejo de la frontal. Van más abajo.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CommonResolutions,
  usePreviewOutput,
  useOrientation,
  useVideoOutput,
  VisionCamera,
  type CameraController,
  type CameraDevice,
  type CameraPreviewOutput,
  type Constraint,
  type CameraSession,
  type CameraVideoOutput,
} from 'react-native-vision-camera';

import type { LensChoice, StabilizationChoice } from './prompterSettings';

/**
 * Bits por segundo de cada una de las dos tomas.
 *
 * Va puesto a mano porque el montaje recomprime: lo que sale de la cámara se
 * vuelve a codificar al fundir las dos, y partir de un material flojo se nota
 * el doble. 16 Mb/s es holgado para 1080p y el iPhone escribe los dos a la vez
 * sin despeinarse.
 */
const DUAL_BIT_RATE = 16_000_000;

export type DualOutputs = {
  backPreview: CameraPreviewOutput;
  frontPreview: CameraPreviewOutput;
  backVideo: CameraVideoOutput;
  frontVideo: CameraVideoOutput;
};

export type DualCamera = {
  /** ¿Este iPhone puede con las dos cámaras a la vez? Hace falta A12 o mejor. */
  supported: boolean;
  /** La sesión está configurada y corriendo. */
  ready: boolean;
  /** Qué ha fallado, si ha fallado algo. */
  error: string | null;
  /**
   * ¿Se está estabilizando de verdad? Con las dos cámaras puede que no quepa
   * en el presupuesto de hardware y haya habido que abrir sin ella.
   */
  stabilized: boolean;
  /**
   * Un controlador por cámara, en el orden en que se configuraron.
   *
   * Es lo que sustituye a la prop `zoom` de `<Camera>`: sin componente no hay
   * quien ate el zoom a la sesión, así que se le pide al controlador a mano.
   */
  backController: CameraController | null;
  frontController: CameraController | null;
};

type Options = {
  enabled: boolean;
  mirrorFront: boolean;
  stabilization: StabilizationChoice;
  /** Las mismas lentes que con una sola cámara. */
  backLenses: LensChoice[];
  /**
   * Con una toma en marcha no se toca nada de la sesión: reconfigurarla la
   * cortaría por la mitad, igual que pasa con la cámara única.
   */
  isRecording: boolean;
};

/**
 * Las cuatro salidas de la sesión doble.
 *
 * Van aparte de la sesión porque quien graba las necesita antes de que exista
 * sesión ninguna, y si colgaran de ella tendríamos una pescadilla: la sesión se
 * congela mientras se graba, pero para saber si se graba hay que preguntarle a
 * quien graba, que a su vez necesita las salidas.
 */
export function useDualOutputs(): DualOutputs {
  const backPreview = usePreviewOutput();
  const frontPreview = usePreviewOutput();
  const backVideo = useVideoOutput({
    targetResolution: CommonResolutions.FHD_16_9,
    enableAudio: true,
    enablePersistentRecorder: true,
    targetBitRate: DUAL_BIT_RATE,
    fileType: 'mp4',
  });
  const frontVideo = useVideoOutput({
    // Sin audio: hay un solo micrófono y el montaje se queda con la pista de la
    // toma de fondo. Dos copias del mismo sonido solo darían eco.
    targetResolution: CommonResolutions.FHD_16_9,
    enableAudio: false,
    enablePersistentRecorder: true,
    targetBitRate: DUAL_BIT_RATE,
    fileType: 'mp4',
  });

  return useMemo(
    () => ({ backPreview, frontPreview, backVideo, frontVideo }),
    [backPreview, frontPreview, backVideo, frontVideo],
  );
}

/**
 * Elige qué par de cámaras usar de entre las que el iPhone admite juntas.
 *
 * No vale cualquier pareja: el sistema publica las combinaciones que su ancho de
 * banda aguanta, y hay que escoger dentro de esa lista en vez de pedir las
 * cámaras por separado. Entre ellas **sí hay cámaras virtuales** —la doble y la
 * triple—, que son las que traen las paradas ópticas de 0,5× y 3× y saltan solas
 * de una lente a otra. Se pasan enteras a `configure`, sin desarmarlas.
 *
 * Se puntúa igual que hace la propia librería con una sola cámara: suma por cada
 * lente pedida y resta por cada una de más, para que limitar las lentes valga
 * también aquí. Y el desempate es por **número de lentes**, que es donde estaba
 * el fallo: con las tres marcadas, todas las candidatas de una lente suelta
 * empataban a uno y salía la primera del montón —la gran angular—, así que el 1×
 * pasaba a ser un recorte digital suyo y se veía fatal.
 */
function pickPair(
  combinations: CameraDevice[][],
  backLenses: readonly string[],
): { back: CameraDevice; front: CameraDevice } | null {
  let best: { back: CameraDevice; front: CameraDevice; points: number; lenses: number } | null =
    null;

  for (const combination of combinations) {
    const back = combination.find((device) => device.position === 'back');
    const front = combination.find((device) => device.position === 'front');
    if (back == null || front == null) continue;

    const lenses = back.physicalDevices.length > 0 ? back.physicalDevices : [back];
    const points = lenses.reduce(
      (total, lens) => total + (backLenses.includes(lens.type) ? 1 : -1),
      0,
    );
    const better =
      best == null ||
      points > best.points ||
      (points === best.points && lenses.length > best.lenses);
    if (better) best = { back, front, points, lenses: lenses.length };
  }

  return best == null ? null : { back: best.back, front: best.front };
}

export function useDualCamera(outputs: DualOutputs, options: Options): DualCamera {
  const supported = VisionCamera.supportsMultiCamSessions;
  const { backPreview, frontPreview, backVideo, frontVideo } = outputs;

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stabilized, setStabilized] = useState(true);
  const [controllers, setControllers] = useState<{
    back: CameraController | null;
    front: CameraController | null;
  }>({ back: null, front: null });

  // La sesión se congela mientras se graba: los ajustes que la reconfiguran se
  // quedan como estaban y entran en cuanto paras.
  const [applied, setApplied] = useState({
    mirrorFront: options.mirrorFront,
    stabilization: options.stabilization,
    lensKey: options.backLenses.join(','),
  });
  const lensKey = options.backLenses.join(',');
  useEffect(() => {
    if (options.isRecording) return;
    setApplied({
      mirrorFront: options.mirrorFront,
      stabilization: options.stabilization,
      lensKey,
    });
  }, [options.isRecording, options.mirrorFront, options.stabilization, lensKey]);

  // La app va bloqueada en vertical, así que la orientación de la interfaz es
  // la buena para el fichero. Esto lo hacía `<Camera>` por su cuenta.
  const orientation = useOrientation('interface');
  useEffect(() => {
    if (orientation == null) return;
    for (const output of [backPreview, frontPreview, backVideo, frontVideo]) {
      output.outputOrientation = orientation;
    }
  }, [orientation, backPreview, frontPreview, backVideo, frontVideo]);

  /**
   * Todo lo que toca la sesión se encola aquí.
   *
   * Una salida pertenece a una sola sesión, así que levantar la siguiente antes
   * de que la anterior haya soltado las suyas es un choque seguro. Encadenando,
   * cada arranque espera a que termine la parada de antes.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());
  const { mirrorFront, stabilization, lensKey: appliedLensKey } = applied;
  const enabled = options.enabled;

  /**
   * La sesión se crea una sola vez y se queda.
   *
   * Cambiar de lente o de estabilización **no** crea otra: una salida pertenece
   * a una sola sesión mientras esta exista, y pararla no la suelta. Al abrir una
   * segunda para el ajuste nuevo, las salidas seguían pilladas por la primera y
   * la configuración se caía —lo que se veía en pantalla era el aviso de que no
   * se pudieron abrir las dos cámaras—. Reconfigurar la misma sesión es
   * justamente para lo que está `configure`.
   */
  const [session, setSession] = useState<CameraSession | null>(null);

  useEffect(() => {
    if (!enabled || !supported) return;

    let cancelled = false;
    let created: CameraSession | null = null;

    queue.current = queue.current
      .then(async () => {
        if (cancelled) return;
        created = await VisionCamera.createCameraSession(true);
        if (cancelled) {
          await created.stop().catch(() => undefined);
          return;
        }
        setSession(created);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(String(reason));
      });

    return () => {
      cancelled = true;
      setSession(null);
      setReady(false);
      setControllers({ back: null, front: null });
      // `created` se lee al ejecutarse la cola, no ahora, así que también se
      // cierra la que se haya creado mientras esto iba a medias.
      queue.current = queue.current.then(async () => {
        await created?.stop().catch(() => undefined);
      });
    };
  }, [enabled, supported]);

  useEffect(() => {
    if (session == null) return;

    let cancelled = false;

    /** Configura la sesión que ya existe con unas restricciones dadas. */
    const attempt = async (constraints: Constraint[]) => {
      const deviceFactory = await VisionCamera.createDeviceFactory();
      if (cancelled) return;

      const pair = pickPair(
        deviceFactory.supportedMultiCamDeviceCombinations,
        appliedLensKey.split(','),
      );
      if (pair == null) throw new Error('multicam-no-pair');

      const [backCtl, frontCtl] = await session.configure([
        {
          input: pair.back,
          outputs: [
            { output: backPreview, mirrorMode: 'off' },
            { output: backVideo, mirrorMode: 'off' },
          ],
          constraints,
        },
        {
          input: pair.front,
          // El espejo va por output y no por sesión, que es justo lo que hacía
          // falta: la frontal se espeja y la trasera no, sin que una arrastre a
          // la otra.
          outputs: [
            { output: frontPreview, mirrorMode: mirrorFront ? 'auto' : 'off' },
            { output: frontVideo, mirrorMode: mirrorFront ? 'auto' : 'off' },
          ],
          constraints,
        },
      ]);
      if (cancelled) return;
      if (!session.isRunning) await session.start();
      if (cancelled) return;
      setControllers({ back: backCtl ?? null, front: frontCtl ?? null });
    };

    const apply = async () => {
      const wanted: Constraint[] =
        stabilization === 'off'
          ? []
          : [
              { videoStabilizationMode: stabilization },
              { previewStabilizationMode: stabilization },
            ];

      try {
        await attempt(wanted);
        if (!cancelled) setStabilized(wanted.length > 0);
      } catch (reason) {
        // Dos cámaras a la vez se reparten un presupuesto de hardware fijo, y
        // la estabilización se lo come: con ella puesta, la sesión doble ni
        // siquiera abre. Antes que quedarse sin modo doble, se abre sin
        // estabilizar y se avisa.
        if (wanted.length === 0 || cancelled) throw reason;
        await attempt([]);
        if (!cancelled) setStabilized(false);
      }
      if (cancelled) return;
      setReady(true);
      setError(null);
    };

    queue.current = queue.current.then(apply).catch((reason: unknown) => {
      if (!cancelled) {
        setReady(false);
        setError(String(reason));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    session,
    mirrorFront,
    stabilization,
    appliedLensKey,
    backPreview,
    frontPreview,
    backVideo,
    frontVideo,
  ]);

  return {
    supported,
    ready: ready && enabled,
    error,
    stabilized,
    backController: controllers.back,
    frontController: controllers.front,
  };
}
