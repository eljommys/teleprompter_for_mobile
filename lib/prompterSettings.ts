/**
 * Ajustes del teleprompter y las cuentas del desplazamiento.
 *
 * Portado de `~/GitHub/teleprompter/lib/state.ts`, que es donde estas fórmulas
 * ya estaban afinadas. Se ha quitado todo lo que era de red (patches,
 * sanitización, docHeight compartido): aquí solo hay un aparato.
 */

import type { PhysicalDeviceType, TargetStabilizationMode } from 'react-native-vision-camera';

import { t } from './i18n';

export type PrompterSettings = {
  /**
   * ¿Se enseña la banda del guion?
   *
   * Apagarla deja la app como una cámara a secas, que es lo que quieres cuando
   * grabas un plano de recurso y el guion solo estorba.
   */
  prompterEnabled: boolean;
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
   * Ancho del texto dentro de la banda, en fracción del ancho de esta. Una
   * columna estrecha se lee de un vistazo, sin barrer con los ojos de lado a
   * lado, que es lo que delata que estás leyendo.
   */
  textWidth: number;
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
  /**
   * Grabar con las dos cámaras a la vez: una llena el cuadro y la otra va en un
   * recuadro encima. Pide un iPhone que admita sesiones multicámara.
   */
  dualCamera: boolean;
  /** Esquina superior izquierda del recuadro, en fracción de la pantalla. */
  pipX: number;
  pipY: number;
  /** Ancho del recuadro, en fracción del ancho de la pantalla. */
  pipWidth: number;
  /**
   * Redondeo de las esquinas del recuadro, en fracción de su lado corto.
   * Al 100% y con el recuadro cuadrado sale un círculo.
   */
  pipRadius: number;
  /** Forma del recuadro. Ver `PIP_SHAPES`. */
  pipShape: PipShape;
  /** Sombra bajo el recuadro, 0 = ninguna. */
  pipShadow: number;
  /**
   * Lentes que se le piden a la cámara trasera, con una cámara y con las dos.
   * Menos lentes es una cámara que arranca antes y que no salta sola de una a
   * otra al hacer zoom; el precio es quedarte sin esas paradas ópticas. Ver
   * `LENS_TYPES`.
   */
  backLenses: LensChoice[];
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

/**
 * Las lentes que se pueden elegir, de más abierta a más cerrada.
 *
 * `PhysicalDeviceType` trae además las de profundidad —LiDAR, TrueDepth— y las
 * de continuidad, que no son lentes entre las que encuadrar: no pintan nada en
 * una lista donde eliges con qué óptica grabas.
 */
export const LENS_TYPES = [
  'ultra-wide-angle',
  'wide-angle',
  'telephoto',
] as const satisfies readonly PhysicalDeviceType[];

/** Una de las lentes que ofrece la app. */
export type LensChoice = (typeof LENS_TYPES)[number];

/**
 * Formas del recuadro de la segunda cámara.
 *
 * `portrait` es la de la app, 9:16, y encaja con lo que graba. `square` recorta
 * a 1:1, que con el redondeo al máximo da un círculo.
 */
export const PIP_SHAPES = ['portrait', 'square'] as const;
export type PipShape = (typeof PIP_SHAPES)[number];

/** Proporción alto/ancho del recuadro para cada forma. */
export function pipAspect(shape: PipShape): number {
  return shape === 'square' ? 1 : 16 / 9;
}

export const DEFAULT_SETTINGS: PrompterSettings = {
  prompterEnabled: true,
  text: t('defaultScript'),
  fontSize: 30,
  speed: 30,
  lineHeight: 1.4,
  opacity: 0.45,
  panelHeight: 0.42,
  textWidth: 1,
  panelTop: 0.5,
  readLine: 0.4,
  mirrorFront: true,
  // Sin `constraints` la sesión no pedía estabilización ninguna, y se notaba.
  // 'standard' es la que Apple describe como la buena para vídeo grabado.
  stabilization: 'standard',
  dualCamera: false,
  // Arriba a la derecha: es donde menos tapa el guion, que va centrado.
  pipX: 0.64,
  pipY: 0.08,
  pipWidth: 0.3,
  pipRadius: 0.08,
  pipShape: 'portrait',
  pipShadow: 0.35,
  // Las tres: es lo que da las paradas ópticas de 0,5× / 1× / 3×.
  backLenses: [...LENS_TYPES],
  tapHintSeen: false,
};

export const LIMITS = {
  fontSize: { min: 14, max: 64, step: 1 },
  speed: { min: 1, max: 100, step: 1 },
  lineHeight: { min: 1, max: 2.2, step: 0.05 },
  opacity: { min: 0, max: 0.9, step: 0.05 },
  panelHeight: { min: 0.2, max: 0.75, step: 0.01 },
  // Por debajo de la mitad el guion se convierte en una columna de palabras
  // sueltas y cada línea dura un suspiro.
  textWidth: { min: 0.5, max: 1, step: 0.01 },
  // Más pequeño que un quinto de pantalla no se distingue quién sale; más
  // grande que la mitad deja de ser un recuadro y tapa la toma principal.
  pipWidth: { min: 0.2, max: 0.5, step: 0.01 },
  // Al máximo, el redondeo vale medio lado corto: las esquinas se tocan y el
  // recuadro queda en círculo —si es cuadrado— o en cápsula.
  pipRadius: { min: 0, max: 1, step: 0.01 },
  pipShadow: { min: 0, max: 1, step: 0.05 },
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
