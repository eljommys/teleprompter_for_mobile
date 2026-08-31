/**
 * Una toma con las dos cámaras, que acaba en un solo vídeo.
 *
 * Las dos grabadoras escriben su propio fichero —VisionCamera no sabe fundir
 * nada— y el montaje se hace al final, en un pase de exportación. Por eso parar
 * no termina la faena: queda el rato de composición, y hay que enseñarlo.
 *
 * Durante la toma se puede girar de cámara y arrastrar el recuadro. Como el
 * montaje es posterior, esos cambios se van apuntando con su instante y el
 * vídeo los reproduce donde tocan.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { CameraVideoOutput, Recorder } from 'react-native-vision-camera';
import * as MediaLibrary from 'expo-media-library';

import { composePictureInPicture, deleteFile, type ComposeSegment } from '../modules/video-composer';
import { t } from './i18n';
import { saveToLibrary } from './saveToLibrary';

export type DualRecorderState = {
  isRecording: boolean;
  duration: number;
  isBusy: boolean;
  /** El montaje está en marcha; la toma ya ha parado. */
  isComposing: boolean;
  toggle: () => void;
  /**
   * Apunta dónde está el recuadro ahora mismo, mientras se arrastra.
   *
   * Lo llama el propio recuadro a intervalos. Fuera de una toma no hace nada.
   */
  trackMove: (position: { x: number; y: number }) => void;
};

export type DualShot = {
  /** ¿Llena el cuadro la trasera? */
  backIsBackground: boolean;
  /** Dónde está el recuadro, en fracciones de pantalla. */
  x: number;
  y: number;
  width: number;
  /** Su forma: proporción, redondeo y sombra. Va al montaje tal cual. */
  aspect: number;
  radius: number;
  shadow: number;
};

type Options = {
  /** Salida de vídeo de la trasera. Es la que lleva el audio. */
  back: CameraVideoOutput;
  /** Salida de vídeo de la frontal. */
  front: CameraVideoOutput;
  /** Cómo está el encuadre ahora mismo. Se consulta al vuelo. */
  shot: DualShot;
  /** Proporción de la pantalla, para traducir esas fracciones al lienzo. */
  screenAspect: number;
};

const TICK = 250;

type Take = { recorder: Recorder; file: Promise<string> };

/** Arranca una grabadora y devuelve la promesa del fichero que va a escribir. */
async function record(output: CameraVideoOutput): Promise<Take> {
  const recorder = await output.createRecorder({});
  let onDone: (filePath: string) => void = () => {};
  let onFail: (error: Error) => void = () => {};
  const file = new Promise<string>((resolve, reject) => {
    onDone = resolve;
    onFail = reject;
  });
  // El fallo se recoge desde ya, aunque a esta promesa no la espere nadie
  // todavía: sin un oyente enganchado, un error aquí sale por la puerta de
  // atrás como rechazo no capturado.
  file.catch(() => undefined);
  await recorder.startRecording(
    (filePath) => onDone(filePath),
    (error) => onFail(error),
  );
  return { recorder, file };
}

/** Suelta una grabadora que ya no va a servir para nada. */
async function discard(recorder: Recorder | undefined): Promise<void> {
  if (recorder == null) return;
  await recorder.cancelRecording().catch(() => undefined);
}

export function useDualRecorder({ back, front, shot, screenAspect }: Options): DualRecorderState {
  const takes = useRef<Take[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permission, requestPermission] = MediaLibrary.usePermissions({ writeOnly: true });

  // Por referencia y no por valor capturado: lo que valga el encuadre en cada
  // momento se consulta desde dentro de la toma, que arrancó hace rato.
  const latestShot = useRef(shot);
  latestShot.current = shot;

  /**
   * Los tramos de la toma en curso.
   *
   * Se apunta uno cada vez que cambia el encuadre, con el segundo en el que
   * pasó. Sin esto el montaje solo podría enseñar una foto fija del final, y
   * girar de cámara a mitad no se vería.
   */
  const segments = useRef<ComposeSegment[]>([]);
  const startedAt = useRef(0);
  // El estado no vale aquí: `trackMove` lo llama el gesto, que captura la
  // versión del render en que se creó.
  const recording = useRef(false);

  // Si el componente se va con el montaje a medias, no hay a quién avisar.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Lo que manda es la cuenta de la grabadora de fondo, que es la que acaba
  // marcando la duración del montaje.
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      setDuration(takes.current[0]?.recorder.recordedDuration ?? 0);
    }, TICK);
    return () => clearInterval(id);
  }, [isRecording]);

  /**
   * Apunta el encuadre de ahora como tramo nuevo.
   *
   * Si no ha cambiado nada respecto al último no se apunta: arrastrar el
   * recuadro dispara esto en cada suelta y no hace falta llenar la lista de
   * tramos idénticos.
   */
  const remember = useCallback((shotNow: DualShot) => {
    const last = segments.current[segments.current.length - 1];
    if (
      last != null &&
      last.backIsBackground === shotNow.backIsBackground &&
      last.x === shotNow.x &&
      last.y === shotNow.y &&
      last.width === shotNow.width &&
      last.aspect === shotNow.aspect &&
      last.radius === shotNow.radius &&
      last.shadow === shotNow.shadow
    ) {
      return;
    }
    segments.current.push({
      start: Math.max(0, (Date.now() - startedAt.current) / 1000),
      ...shotNow,
    });
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    remember(latestShot.current);
  }, [
    isRecording,
    remember,
    shot.backIsBackground,
    shot.x,
    shot.y,
    shot.width,
    shot.aspect,
    shot.radius,
    shot.shadow,
  ]);

  /**
   * El recorrido del recuadro mientras el dedo lo mueve.
   *
   * Cada punto es un tramo más, y el montaje interpola de uno al siguiente. Sin
   * esto solo quedarían el principio y el final del arrastre, y en el vídeo el
   * recuadro aparecería de golpe en su destino.
   */
  const trackMove = useCallback(
    (position: { x: number; y: number }) => {
      if (!recording.current) return;
      remember({ ...latestShot.current, x: position.x, y: position.y });
    },
    [remember],
  );

  const start = useCallback(async () => {
    if (!permission?.granted) {
      const granted = await requestPermission();
      if (!granted.granted) {
        Alert.alert(t('recorder.noPermissionTitle'), t('recorder.noPermissionBody'));
        return;
      }
    }

    const backTake = await record(back);
    let frontTake: Take;
    try {
      frontTake = await record(front);
    } catch (error) {
      // Si la segunda no arranca, la primera ya está grabando y se quedaría
      // suelta, escribiendo un fichero que nadie va a recoger.
      await discard(backTake.recorder);
      throw error;
    }
    takes.current = [backTake, frontTake];
    startedAt.current = Date.now();
    segments.current = [{ start: 0, ...latestShot.current }];
    recording.current = true;
    setIsRecording(true);

    // No se espera aquí: esto se resuelve cuando el usuario pare, muchos
    // segundos después. Lo que sí se hace es dejar enganchado el montaje.
    //
    // `allSettled` y no `all`: con `all`, la que sobrevive a un fallo de su
    // pareja se queda grabando para siempre, y su salida ya no admite otra
    // grabadora, así que el modo doble se queda muerto hasta reiniciar la app.
    void Promise.allSettled([backTake.file, frontTake.file])
      .then(async ([backResult, frontResult]) => {
        takes.current = [];
        recording.current = false;
        if (alive.current) {
          setIsRecording(false);
          setDuration(0);
        }

        if (backResult.status !== 'fulfilled' || frontResult.status !== 'fulfilled') {
          const failure =
            backResult.status === 'rejected'
              ? backResult.reason
              : (frontResult as PromiseRejectedResult).reason;
          // La que sí terminó deja un fichero suelto que nadie va a montar.
          if (backResult.status === 'fulfilled') void deleteFile(backResult.value);
          if (frontResult.status === 'fulfilled') void deleteFile(frontResult.value);
          throw failure;
        }

        const backPath = backResult.value;
        const frontPath = frontResult.value;
        const output = backPath.replace(/\.mp4$/i, '') + '-dual.mp4';
        const composed = await composePictureInPicture({
          back: backPath,
          front: frontPath,
          segments: segments.current,
          screenAspect,
          output,
        });
        await saveToLibrary(composed);
        // El Carrete ya tiene su copia: lo que queda en disco son tres vídeos
        // de 1080p por toma que no vuelve a abrir nadie.
        for (const path of [backPath, frontPath, composed]) void deleteFile(path);
      })
      .catch((reason: unknown) => {
        if (!alive.current) return;
        setIsRecording(false);
        setDuration(0);
        Alert.alert(t('recorder.recordingError'), String(reason));
      })
      .finally(() => {
        takes.current = [];
        segments.current = [];
        if (alive.current) {
          setIsComposing(false);
          setIsBusy(false);
        }
      });
  }, [permission, requestPermission, back, front, screenAspect]);

  const stop = useCallback(async () => {
    // El aviso se enciende aquí y no al empezar el montaje: cerrar dos ficheros
    // de 1080p ya tarda lo suyo —más aún con estabilización—, y sin nada en
    // pantalla ese rato parece que el botón no ha hecho caso.
    if (alive.current) setIsComposing(true);
    // El botón se queda ocupado hasta que los ficheros estén cerrados y montados
    // —lo suelta el `finally` de arriba—. Si se soltara al parar, un segundo
    // toque llamaría a `stopRecording` sobre una grabadora ya parada, que lanza,
    // y el siguiente arrancaría encima de las que aún están cerrando.
    await Promise.all(
      takes.current.map((take) => take.recorder.stopRecording().catch(() => undefined)),
    );
  }, []);

  const toggle = useCallback(() => {
    if (isBusy || isComposing) return;
    setIsBusy(true);
    if (isRecording) {
      stop()
        .catch((error: unknown) => {
          setIsBusy(false);
          Alert.alert(t('recorder.error'), String(error));
        })
        // A propósito sin `finally`: mientras se cierran y se montan los
        // ficheros el botón sigue ocupado.
        .then(() => undefined);
      return;
    }
    start()
      .catch((error: unknown) => {
        setIsRecording(false);
        setIsBusy(false);
        Alert.alert(t('recorder.error'), String(error));
      })
      .then(() => {
        // Grabando ya se puede volver a pulsar: lo siguiente es parar.
        if (alive.current) setIsBusy(false);
      });
  }, [isBusy, isComposing, isRecording, start, stop]);

  return { isRecording, duration, isBusy, isComposing, toggle, trackMove };
}
