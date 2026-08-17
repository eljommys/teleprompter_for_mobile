/**
 * Ajustes del teleprompter y las cuentas del desplazamiento.
 *
 * Portado de `~/GitHub/teleprompter/lib/state.ts`, que es donde estas fórmulas
 * ya estaban afinadas. Se ha quitado todo lo que era de red (patches,
 * sanitización, docHeight compartido): aquí solo hay un aparato.
 */

import type { TargetStabilizationMode } from 'react-native-vision-camera';

import { t } from './i18n';

export type PrompterSettings = {
  /** Guion completo. */
  text: string;
  /** Tamaño de fuente en px. */
  fontSize: number;
  /** Velocidad 1-100 (se mapea a px/s más abajo). */
  speed: number;
  /** Interlineado (multiplicador). */
  lineHeight: number;
  /** Opacidad del fondo de la banda, 0 = transparente. */
  opacity: number;
  /** Alto de la banda del guion, en fracción del alto de la pantalla. */
  panelHeight: number;
  /**
   * Dónde se coloca la banda entera en la pantalla: 0 la pega arriba del todo,
   * 1 la baja hasta los controles. Es lo que de verdad te acerca al objetivo de
   * la cámara frontal, porque mueve la caja, no lo que hay dentro.
   */
  panelTop: number;
  /**
   * Dónde cae la línea de lectura dentro de la banda, en fracción de su alto.
   * Regula cuánto texto ves por delante de lo que estás leyendo; no mueve la
   * banda —para eso está `panelTop`—, porque el texto y la línea se desplazan
   * juntos y la frase que lees se queda donde estaba.
   */
  readLine: number;
  /**
   * Espejo en la cámara frontal. Con `<Camera>` el modo de espejo es de toda la
   * sesión, así que esto afecta a la vista previa y al fichero por igual —como
   * en la cámara del sistema—. El guion no se ve afectado: es un rótulo encima,
   * no parte de la imagen.
   */
  mirrorFront: boolean;
  /** Estabilización de vídeo. Ver `STABILIZATION_MODES`. */
  stabilization: StabilizationChoice;
  /** ¿Ya sabe el usuario que un toque en el guion lo pone en marcha? */
  tapHintSeen: boolean;
};

/**
 * Los modos que se ofrecen, de menos a más.
 *
 * `TargetStabilizationMode` trae alguno más —`preview-optimized` y
 * `low-latency`, que optimizan la vista previa y la latencia en vez de el
 * fichero— y no pintan nada en una app en la que lo que importa es la toma
 * grabada. `cinematic-extended-enhanced` se queda fuera por lo caro que sale
 * en recorte de encuadre.
 */
export const STABILIZATION_MODES = [
  'off',
  'standard',
  'cinematic',
  'cinematic-extended',
] as const satisfies readonly TargetStabilizationMode[];

/** Uno de los modos que ofrece la app, que no son todos los de VisionCamera. */
export type StabilizationChoice = (typeof STABILIZATION_MODES)[number];

export const DEFAULT_SETTINGS: PrompterSettings = {
  text: t('defaultScript'),
  fontSize: 30,
  speed: 30,
  lineHeight: 1.4,
  opacity: 0.45,
  panelHeight: 0.42,
  panelTop: 0.5,
  readLine: 0.4,
  mirrorFront: true,
  // Sin `constraints` la sesión no pedía estabilización ninguna, y se notaba.
  // 'standard' es la que Apple describe como la buena para vídeo grabado.
  stabilization: 'standard',
  tapHintSeen: false,
};

export const LIMITS = {
  fontSize: { min: 14, max: 64, step: 1 },
  speed: { min: 1, max: 100, step: 1 },
  lineHeight: { min: 1, max: 2.2, step: 0.05 },
  opacity: { min: 0, max: 0.9, step: 0.05 },
  panelHeight: { min: 0.2, max: 0.75, step: 0.01 },
  panelTop: { min: 0, max: 1, step: 0.01 },
  // El tope de arriba no es 0: con la línea pegada al borde no queda sitio
  // para leer la frase siguiente, que es justo para lo que sirve un
  // teleprompter. El de abajo deja el texto por encima de la mitad.
  readLine: { min: 0.1, max: 0.6, step: 0.01 },
} as const;

/**
 * Rellenos de la banda para que la línea de lectura caiga donde dice
 * `readLine`.
 *
 * La invariante que hay que respetar es que los dos rellenos sumen el alto de
 * la banda: así el recorrido medido es exactamente la altura del texto,
 * (r·H + T + (1−r)·H) − H = T, sea cual sea H y sea cual sea r. Por eso mover
 * la línea de lectura —igual que cambiar el alto del panel o el cuerpo de
 * letra— no te saca del sitio del guion en el que ibas.
 */
export function readLinePaddings(height: number, readLine: number) {
  return { top: height * readLine, bottom: height * (1 - readLine) };
}

/**
 * px/s de desplazamiento para una velocidad y un tamaño de fuente dados.
 *
 * Marcada como worklet porque `scrollRate` la llama desde el bucle de
 * fotogramas, que corre en el hilo de UI.
 */
export function speedToPixelsPerSecond(speed: number, fontSize: number): number {
  'worklet';
  // Escalado con el tamaño de fuente: la velocidad percibida (líneas/segundo)
  // se mantiene constante al cambiar el cuerpo de letra.
  return (speed / 100) * fontSize * 4;
}

/**
 * Velocidad en fracción de guion por segundo (0..1/s). Es 0 mientras no se haya
 * medido el recorrido, porque hasta entonces no se sabe cuánto ocupa el guion.
 */
export function scrollRate(speed: number, fontSize: number, travel: number): number {
  'worklet';
  if (travel <= 0) return 0;
  const rate = speedToPixelsPerSecond(speed, fontSize) / travel;
  return Number.isFinite(rate) ? rate : 0;
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}
