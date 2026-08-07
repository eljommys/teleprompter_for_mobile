/**
 * Ajustes del teleprompter y las cuentas del desplazamiento.
 *
 * Portado de `~/GitHub/teleprompter/lib/state.ts`, que es donde estas fórmulas
 * ya estaban afinadas. Se ha quitado todo lo que era de red (patches,
 * sanitización, docHeight compartido): aquí solo hay un aparato.
 */

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
   * Espejo en la cámara frontal. Con `<Camera>` el modo de espejo es de toda la
   * sesión, así que esto afecta a la vista previa y al fichero por igual —como
   * en la cámara del sistema—. El guion no se ve afectado: es un rótulo encima,
   * no parte de la imagen.
   */
  mirrorFront: boolean;
};

export const DEFAULT_SETTINGS: PrompterSettings = {
  text: [
    'Pega aquí tu guion desde los ajustes.',
    '',
    'Arrastra con el dedo para moverlo a mano.',
    'Toca una vez para que avance solo, y otra para pararlo.',
  ].join('\n'),
  fontSize: 30,
  speed: 30,
  lineHeight: 1.4,
  opacity: 0.45,
  panelHeight: 0.42,
  mirrorFront: true,
};

export const LIMITS = {
  fontSize: { min: 14, max: 64, step: 1 },
  speed: { min: 1, max: 100, step: 1 },
  lineHeight: { min: 1, max: 2.2, step: 0.05 },
  opacity: { min: 0, max: 0.9, step: 0.05 },
  panelHeight: { min: 0.2, max: 0.75, step: 0.01 },
} as const;

/**
 * El texto arranca al 40 % del alto de la banda —ahí está la línea de lectura—
 * y deja aire de sobra al final.
 *
 * Con estos rellenos el recorrido medido es exactamente la altura del texto:
 * (0,4·H + T + 0,6·H) − H = T, sea cual sea H. Por eso la posición significa lo
 * mismo con la banda alta que con la banda baja, y cambiar el alto del panel no
 * te mueve del sitio del guion en el que ibas.
 */
export const READ_LINE_FRACTION = 0.4;
export const TAIL_FRACTION = 0.6;

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
