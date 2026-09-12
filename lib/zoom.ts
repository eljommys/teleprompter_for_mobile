import type { CameraController, CameraDevice } from 'react-native-vision-camera';

import { formatDecimal } from './i18n';
import { lensesOf } from './lenses';
import type { LensChoice } from './prompterSettings';

/**
 * El zoom de VisionCamera tiene DOS escalas y no coinciden.
 *
 * - La escala **cruda** es la que acepta `<Camera zoom={...}>` y
 *   `controller.setZoom(...)`. Arranca en `controller.minZoom`.
 * - La escala **visible** es la que se le enseña al usuario («0,5×», «1×»), la
 *   misma que usa la cámara del sistema, donde el 1× es la lente principal.
 *
 * En un iPhone con gran angular, `controller.zoom` vale 1 mientras
 * `displayableZoomFactor` vale 0,5 — así lo documentan los tipos de
 * `CameraController.nitro.d.ts`. La proporción entre las dos es constante.
 */
export type ZoomScale = {
  /** visible = crudo × ratio. */
  ratio: number;
  minRaw: number;
  maxRaw: number;
  /** Paradas de lente, en escala CRUDA, ya acotadas al rango del dispositivo. */
  stops: ZoomStop[];
};

export type ZoomStop = {
  /** Zoom crudo al que salta esta parada. */
  raw: number;
  /** Con qué lente se graba aquí, o null si no se sabe. */
  lens: LensChoice | null;
};

/**
 * A qué factor **visible** corresponde el 1,0 crudo de cada lente suelta.
 *
 * En una cámara triple, `0,5×` para la gran angular, `1×` para la principal y
 * `5×` (o `3×`) para el teleobjetivo, según el modelo.
 */
export type LensReference = Partial<Record<LensChoice, number>>;

/**
 * Tope de zoom que se ofrece en la interfaz, en escala visible.
 *
 * `maxZoom` de un iPhone con teleobjetivo pasa de 100×, que es basura digital
 * irreconocible. Para hablar a cámara, con 10× sobra.
 */
const MAX_USABLE_DISPLAY = 10;

export function toDisplay(raw: number, scale: ZoomScale): number {
  'worklet';
  return raw * scale.ratio;
}

export function toRaw(display: number, scale: ZoomScale): number {
  'worklet';
  return display / scale.ratio;
}

/** Etiqueta corta para un botón de lente: 0,5× · 1× · 3×. */
export function formatZoom(display: number): string {
  const rounded = Math.round(display * 10) / 10;
  // El separador lo pone el idioma: la coma estaba puesta a mano y salía
  // también en inglés, donde toca punto.
  const text = Number.isInteger(rounded) ? String(rounded) : formatDecimal(rounded, 1);
  return `${text}×`;
}

/**
 * Qué lente está en juego a un zoom crudo dado.
 *
 * Los factores de conmutación van en escala cruda y en orden, y cada uno marca
 * el salto a la lente siguiente de `physicalDevices`. Con una cámara física la
 * lista tiene un solo elemento y siempre sale esa.
 */
function lensAt(raw: number, lenses: (LensChoice | null)[], factors: number[]): LensChoice | null {
  let index = 0;
  for (let i = 0; i < factors.length; i += 1) {
    if (raw >= factors[i]) index = i + 1;
  }
  return lenses[index] ?? null;
}

/**
 * Traduce el 1,0 crudo de cada lente al factor que enseña la cámara del sistema.
 *
 * Hace falta porque **una lente suelta no sabe cuánto abre**. Al limitar la
 * trasera a la gran angular, lo que se abre es la cámara física ultra gran
 * angular, y ahí `displayableZoomFactor` vale 1: iOS no tiene con qué
 * compararla, así que su 0,5× de siempre pasaría a leerse «1×».
 *
 * La comparación sale de la cámara virtual del propio iPhone, que sí publica a
 * qué zoom crudo salta de una lente a otra. Si la principal salta en el 2,0
 * crudo, es que la gran angular abre el doble, o sea 0,5×.
 */
export function buildLensReference(devices: readonly CameraDevice[]): LensReference {
  // La que más lentes junte: es la que mejor describe la óptica del aparato.
  let best: CameraDevice | null = null;
  for (const device of devices) {
    if (device.position !== 'back') continue;
    if (device.zoomLensSwitchFactors.length === 0) continue;
    if (best == null || device.physicalDevices.length > best.physicalDevices.length) best = device;
  }
  if (best == null) return {};

  const lenses = lensesOf(best);
  // El 1,0 crudo es la primera lente; a partir de ahí, cada salto.
  const rawPositions = [1, ...best.zoomLensSwitchFactors];
  // El 1× visible es, por definición, la principal.
  const wideIndex = lenses.indexOf('wide-angle');
  const wideRaw = wideIndex >= 0 ? rawPositions[wideIndex] : null;
  if (wideRaw == null || !(wideRaw > 0)) return {};

  const reference: LensReference = {};
  lenses.forEach((lens, index) => {
    const raw = rawPositions[index];
    if (lens == null || raw == null) return;
    reference[lens] = raw / wideRaw;
  });
  return reference;
}

/**
 * Construye la escala de zoom a partir del dispositivo, del controlador ya
 * arrancado y de la referencia de lentes del aparato.
 *
 * `zoomLensSwitchFactors` se interpreta en escala **cruda**, no visible. Los
 * tipos de VisionCamera lo documentan con un ejemplo, `[1, 3]` para una triple
 * de 0,5×/1×/3×, que se lee como visible; en un iPhone de verdad no cuadra. Con
 * esa lectura, en una 0,5×/1×/5× el 1× desaparecía —salía 0,5×, 2× y 10×—,
 * porque los factores que da el sistema son los del `videoZoomFactor` de
 * AVFoundation: el 2,0 y el 10,0 crudos, no el 1× y el 5× visibles.
 */
export function buildZoomScale(
  device: CameraDevice,
  controller: CameraController,
  reference: LensReference = {},
): ZoomScale {
  const lenses = lensesOf(device);
  const factors = device.zoomLensSwitchFactors;

  /**
   * Cuánto vale un 1,0 crudo en factores visibles.
   *
   * Manda la referencia del aparato, que es estable y no depende de en qué
   * momento se pregunte. El controlador es el plan B: da lo mismo mientras la
   * cámara sea virtual, pero con una lente suelta miente por lo de arriba.
   */
  const base = lenses[0] == null ? null : reference[lenses[0]];
  const rawNow = controller.zoom;
  const displayNow = controller.displayableZoomFactor;
  const measured = rawNow > 0 && displayNow > 0 ? displayNow / rawNow : 1;
  const ratio = base != null && base > 0 ? base : measured;

  const minRaw = controller.minZoom;
  const maxRaw = Math.min(controller.maxZoom, MAX_USABLE_DISPLAY / ratio);

  // El mínimo siempre es una parada: es la lente más abierta que quede.
  const stops: ZoomStop[] = [{ raw: minRaw, lens: lensAt(minRaw, lenses, factors) }];
  for (const raw of factors) {
    // Los saltos por debajo del mínimo no existen: la sesión puede haber
    // recortado el rango y dejado fuera la lente más abierta.
    if (raw > minRaw && raw <= maxRaw) stops.push({ raw, lens: lensAt(raw, lenses, factors) });
  }
  // A propósito no se inventa ninguna parada más. Antes, con una sola lente
  // —la frontal, o la trasera limitada— se añadía un 2× digital para que la
  // fila no quedara con un solo botón; pero eso es un recorte, no una parada, y
  // ofrecerlo junto a las ópticas hacía pensar que había óptica donde no la
  // hay. El aumento digital sigue estando en el deslizador.
  stops.sort((a, b) => a.raw - b.raw);
  return { ratio, minRaw, maxRaw, stops };
}

export function clampZoom(raw: number, scale: ZoomScale): number {
  'worklet';
  return Math.min(scale.maxRaw, Math.max(scale.minRaw, raw));
}

/**
 * Posición del deslizador (0..1) para un zoom crudo, y su inversa.
 *
 * La conversión es logarítmica a propósito. En un iPhone con teleobjetivo el
 * rango crudo llega a 20×, así que un deslizador lineal gastaría el primer
 * dedo de recorrido en ir de 0,5× a 1×, y todo lo demás en aumentos digitales
 * que no vas a usar. En logarítmico, cada tramo de recorrido multiplica el
 * zoom por lo mismo, que es como se percibe.
 */
export function toSliderPosition(raw: number, scale: ZoomScale): number {
  const span = Math.log(scale.maxRaw / scale.minRaw);
  if (!Number.isFinite(span) || span <= 0) return 0;
  const position = Math.log(clampZoom(raw, scale) / scale.minRaw) / span;
  return Math.min(1, Math.max(0, position));
}

export function fromSliderPosition(position: number, scale: ZoomScale): number {
  const ratio = scale.maxRaw / scale.minRaw;
  if (!Number.isFinite(ratio) || ratio <= 0) return scale.minRaw;
  return clampZoom(scale.minRaw * Math.pow(ratio, Math.min(1, Math.max(0, position))), scale);
}
