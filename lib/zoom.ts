import type { CameraController, CameraDevice } from 'react-native-vision-camera';

import { formatDecimal } from './i18n';

/**
 * El zoom de VisionCamera tiene DOS escalas y no coinciden.
 *
 * - La escala **cruda** es la que acepta `<Camera zoom={...}>` y
 *   `controller.setZoom(...)`. Arranca en `controller.minZoom`.
 * - La escala **visible** es la que se le enseña al usuario («0,5×», «1×»).
 *   La da `controller.displayableZoomFactor`.
 *
 * En un iPhone con gran angular, `controller.zoom` vale 1 mientras
 * `displayableZoomFactor` vale 0,5 — así lo documentan los tipos de
 * `CameraController.nitro.d.ts`. La proporción entre las dos es constante, así
 * que basta con leerla una vez cuando arranca la sesión.
 */
export type ZoomScale = {
  /** visible = crudo × ratio. */
  ratio: number;
  minRaw: number;
  maxRaw: number;
  /** Paradas de lente, en escala CRUDA, ya acotadas al rango del dispositivo. */
  stopsRaw: number[];
};

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
 * Construye la escala de zoom a partir del dispositivo y del controlador ya
 * arrancado.
 *
 * `zoomLensSwitchFactors` se interpreta en escala **visible**: los tipos lo
 * documentan como `[1, 3]` para una cámara triple de 0,5× / 1× / 3×, y un
 * factor de conmutación nunca puede coincidir con el mínimo del dispositivo
 * —ya estás ahí—, así que ese `1` solo tiene sentido como «1×» visible.
 *
 * Si en el iPhone real resultara ser al revés, es un cambio de una línea: quitar
 * el `toRaw(...)` de `stopsRaw`. El panel de depuración de la app imprime los
 * números crudos precisamente para poder comprobarlo en 30 segundos.
 */
export function buildZoomScale(device: CameraDevice, controller: CameraController): ZoomScale {
  const rawNow = controller.zoom;
  const displayNow = controller.displayableZoomFactor;
  const ratio = rawNow > 0 && displayNow > 0 ? displayNow / rawNow : 1;

  const minRaw = controller.minZoom;
  const maxRaw = Math.min(controller.maxZoom, MAX_USABLE_DISPLAY / ratio);

  const scale: ZoomScale = { ratio, minRaw, maxRaw, stopsRaw: [] };

  // El mínimo siempre es una parada: es el gran angular, o el 1× si no lo hay.
  const stops = [minRaw];
  for (const factor of device.zoomLensSwitchFactors) {
    const raw = toRaw(factor, scale);
    if (raw > minRaw && raw <= maxRaw) stops.push(raw);
  }
  // Sin lentes que conmutar (la frontal) al menos se ofrece un 2× digital.
  if (stops.length === 1) {
    const doubled = minRaw * 2;
    if (doubled <= maxRaw) stops.push(doubled);
  }

  scale.stopsRaw = stops.sort((a, b) => a - b);
  return scale;
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
