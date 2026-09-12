/**
 * Qué óptica tiene este iPhone y cuál abrir.
 *
 * Vive aparte de `zoom.ts` porque son dos preguntas distintas: aquí se decide
 * **con qué lente se graba**, y allí a qué números de la interfaz corresponde
 * lo que grabe.
 */

import type { CameraDevice } from 'react-native-vision-camera';

import { LENS_TYPES, type LensChoice } from './prompterSettings';

type Position = CameraDevice['position'];

/** El tipo de lente, si es una de las que ofrece la app. */
export function asLens(type: string | undefined): LensChoice | null {
  return LENS_TYPES.find((lens) => lens === type) ?? null;
}

/**
 * Las lentes de un dispositivo, de más abierta a más cerrada.
 *
 * Una cámara **física** trae `physicalDevices` vacío: ella misma es la lente.
 * Tratar esa lista vacía como «ninguna lente» es el origen de casi todos los
 * líos con este API.
 */
export function lensesOf(device: CameraDevice): (LensChoice | null)[] {
  if (device.physicalDevices.length === 0) return [asLens(device.type)];
  return device.physicalDevices.map((physical) => asLens(physical.type));
}

/**
 * Las lentes que este iPhone tiene de verdad en una posición.
 *
 * Se miran todas las cámaras que enumera el sistema, no la que esté abierta: la
 * abierta es justo la que acaba de recortar el filtro del usuario, así que
 * preguntarle a ella dejaría fuera las que ha desmarcado y ya no podría volver
 * a marcarlas.
 */
export function listLenses(
  devices: readonly CameraDevice[],
  position: Position,
): LensChoice[] {
  const present = new Set<LensChoice>();
  for (const device of devices) {
    if (device.position !== position) continue;
    for (const lens of lensesOf(device)) {
      if (lens != null) present.add(lens);
    }
  }
  return LENS_TYPES.filter((lens) => present.has(lens));
}

/**
 * Elige qué cámara abrir para las lentes que ha pedido el usuario.
 *
 * **No vale `useCameraDevice(position, { physicalDevices })`.** Su puntuación
 * recorre `physicalDevices` de cada candidata, y una cámara física trae esa
 * lista vacía: pidiendo solo la gran angular, la ultra gran angular suelta
 * puntúa cero igual que la principal suelta y que todas las demás, empatan y se
 * queda la primera que enumere el sistema. El resultado es que limitar a una
 * lente concreta abría casi siempre la principal, sin avisar.
 *
 * Aquí se puntúa igual —suma por lente pedida, resta por lente de más— pero
 * contando la propia cámara cuando es física, que es lo que arregla el empate.
 * El desempate va por número de lentes, como en la sesión doble: con las tres
 * marcadas, todas las candidatas de una lente empatarían a uno y saldría la
 * primera del montón en vez de la triple.
 */
export function pickDevice(
  devices: readonly CameraDevice[],
  position: Position,
  lenses: readonly LensChoice[],
): CameraDevice | undefined {
  let best: { device: CameraDevice; points: number; count: number } | undefined;

  for (const device of devices) {
    if (device.position !== position) continue;
    const own = lensesOf(device);
    const points = own.reduce(
      (total, lens) => total + (lens != null && lenses.includes(lens) ? 1 : -1),
      0,
    );
    const better =
      best == null || points > best.points || (points === best.points && own.length > best.count);
    if (better) best = { device, points, count: own.length };
  }

  return best?.device;
}
