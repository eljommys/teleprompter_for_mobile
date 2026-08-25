import { requireOptionalNativeModule } from 'expo-modules-core';

/** Un tramo de la toma, desde `start` hasta que empieza el siguiente. */
export type ComposeSegment = {
  /** Segundos desde que arrancó la grabación. El primero empieza en 0. */
  start: number;
  /** ¿Manda la trasera en este tramo? Si no, es la frontal la que llena. */
  backIsBackground: boolean;
  /** Esquina superior izquierda del recuadro, en fracción de pantalla (0..1). */
  x: number;
  y: number;
  /** Ancho del recuadro, en fracción del ancho de la pantalla. */
  width: number;
};

export type ComposeOptions = {
  /** Ruta de la toma de la cámara trasera. */
  back: string;
  /** Ruta de la toma de la frontal. */
  front: string;
  /** Tramos, en orden: recogen los giros y los arrastres de la toma. */
  segments: ComposeSegment[];
  /**
   * Proporción de la pantalla donde se colocó (ancho / alto).
   *
   * La vista previa va en `cover`, así que de la toma solo se ve la parte que
   * cabe en la pantalla. Con esta cifra el montaje traduce «donde lo dejé con
   * el dedo» a un sitio del lienzo de verdad.
   */
  screenAspect: number;
  /** Dónde escribir el montaje. */
  output: string;
};

type VideoComposerModule = {
  composePictureInPicture(options: ComposeOptions): Promise<string>;
  deleteFile(path: string): Promise<void>;
};

/**
 * Opcional a propósito.
 *
 * Esto es un módulo nativo, así que solo existe en binarios compilados después
 * de añadirlo. Pedirlo a secas reventaría al arrancar sobre una versión antigua
 * —antes incluso de la primera pantalla, y aunque no fueras a grabar con las
 * dos cámaras—, y una app que no abre es mucho peor que una función de menos.
 */
const native = requireOptionalNativeModule<VideoComposerModule>('VideoComposer');

/** ¿Trae este binario el montador? Si no, no se ofrece grabar a dos cámaras. */
export const canComposeVideo = native != null;

/**
 * Funde dos tomas en una sola con la segunda en un recuadro, y devuelve la ruta
 * del fichero montado.
 *
 * Tarda lo suyo —es un pase de exportación entero—, así que quien la llame
 * tiene que enseñar que está trabajando.
 */
export function composePictureInPicture(options: ComposeOptions): Promise<string> {
  if (native == null) throw new Error('VideoComposer no está en este binario');
  return native.composePictureInPicture(options);
}

/**
 * Borra un fichero suelto. No se queja si ya no está.
 *
 * Es limpieza de fondo: nadie espera a que termine y un fallo aquí no debería
 * estropearle la toma a nadie.
 */
export async function deleteFile(path: string): Promise<void> {
  if (native == null) return;
  await native.deleteFile(path).catch(() => undefined);
}
