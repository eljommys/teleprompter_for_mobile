import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { CameraVideoOutput, Recorder } from 'react-native-vision-camera';

import { t } from './i18n';
import { saveToLibrary } from './saveToLibrary';

export type RecorderState = {
  isRecording: boolean;
  /** Segundos grabados de la toma en curso. */
  duration: number;
  /** Ni empezar ni parar dos veces mientras la anterior está en vuelo. */
  isBusy: boolean;
  toggle: () => void;
};

/** Cada cuánto se refresca el cronómetro. */
const TICK = 250;

/**
 * Ciclo de una toma: crear grabadora, grabar, parar y guardar en el Carrete.
 *
 * Un `Recorder` graba a un único fichero y no se reutiliza —lo dice su propia
 * documentación—, así que se crea uno nuevo en cada toma.
 */
export function useRecorder(videoOutput: CameraVideoOutput): RecorderState {
  const recorder = useRef<Recorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permission, requestPermission] = MediaLibrary.usePermissions({ writeOnly: true });

  // El cronómetro se lee de la grabadora, no de un reloj propio: es la única
  // cuenta que coincide con lo que acaba dentro del fichero.
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      setDuration(recorder.current?.recordedDuration ?? 0);
    }, TICK);
    return () => clearInterval(id);
  }, [isRecording]);

  const save = useCallback(async (filePath: string) => {
    try {
      await saveToLibrary(filePath);
    } catch (error) {
      Alert.alert(t('recorder.saveFailed'), String(error));
    }
  }, []);

  const start = useCallback(async () => {
    if (!permission?.granted) {
      const granted = await requestPermission();
      if (!granted.granted) {
        Alert.alert(t('recorder.noPermissionTitle'), t('recorder.noPermissionBody'));
        return;
      }
    }
    const instance = await videoOutput.createRecorder({});
    recorder.current = instance;
    await instance.startRecording(
      (filePath) => {
        recorder.current = null;
        setIsRecording(false);
        setDuration(0);
        void save(filePath);
      },
      (error) => {
        recorder.current = null;
        setIsRecording(false);
        setDuration(0);
        Alert.alert(t('recorder.recordingError'), error.message);
      },
    );
    setIsRecording(true);
  }, [permission, requestPermission, videoOutput, save]);

  const stop = useCallback(async () => {
    // El estado no se apaga aquí: se apaga en `onRecordingFinished`, cuando el
    // fichero está de verdad cerrado y listo para guardar.
    await recorder.current?.stopRecording();
  }, []);

  const toggle = useCallback(() => {
    if (isBusy) return;
    setIsBusy(true);
    const action = isRecording ? stop() : start();
    action
      .catch((error: unknown) => {
        setIsRecording(false);
        Alert.alert(t('recorder.error'), String(error));
      })
      .finally(() => setIsBusy(false));
  }, [isBusy, isRecording, start, stop]);

  return { isRecording, duration, isBusy, toggle };
}
