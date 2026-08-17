/**
 * Textos de la interfaz, en el idioma del dispositivo.
 *
 * Sin librería de i18n: dos diccionarios y un `t()`. El idioma se decide una
 * vez al arrancar —cambiarlo en Ajustes reinicia la app igualmente— y todo
 * lo que no sea español sale en inglés.
 */

import { getLocales } from 'expo-localization';

const es = {
  'settings.title': 'Guion y ajustes',
  'settings.done': 'Listo',
  'settings.section.script': 'Guion',
  'settings.placeholder': 'Pega aquí tu guion…',
  'settings.rewind': 'Volver al principio',
  'settings.fontSize': 'Tamaño de letra',
  'settings.speed': 'Velocidad',
  'settings.lineHeight': 'Interlineado',
  'settings.panelHeight': 'Alto del panel',
  'settings.panelTop': 'Posición en pantalla',
  'settings.panelTopHint':
    'Sube toda la caja del guion. Cuanto más arriba, más cerca del objetivo de la ' +
    'cámara frontal y más parece que miras a cámara.',
  'settings.panelTop.top': 'Arriba',
  'settings.panelTop.bottom': 'Abajo',
  'settings.readLine': 'Línea de lectura',
  'settings.readLineHint':
    'Dónde caes dentro de la caja, o sea cuánto texto ves por delante. No mueve la ' +
    'caja: para eso está la posición en pantalla.',
  'settings.opacity': 'Fondo del panel',
  'settings.section.camera': 'Cámara',
  'settings.stabilization': 'Estabilización',
  'settings.stabilization.off': 'Ninguna',
  'settings.stabilization.standard': 'Estándar',
  'settings.stabilization.cinematic': 'Cine',
  'settings.stabilization.cinematic-extended': 'Máxima',
  'settings.stabilizationHint':
    'Cuanto más estabiliza, más recorta el encuadre. Si estás grabando, el cambio ' +
    'entra al parar: cambiarla en caliente cortaría la toma.',
  'settings.mirror': 'Espejo en la cámara frontal',
  'settings.mirrorHint':
    'Cambia lo que ves y lo que se graba, a la vez. Apagado, un texto que salga en ' +
    'plano se lee del derecho. El guion es un rótulo encima, así que nunca se voltea.',
  'controls.settings': 'Ajustes del guion',
  'controls.record': 'Grabar',
  'controls.stop': 'Parar de grabar',
  'controls.flip': 'Cambiar de cámara',
  'prompter.tapHint': 'Toca el guion para que avance solo',
  'camera.searching': 'Buscando cámara…',
  'camera.noPermission': 'Falta permiso de cámara',
  'recorder.saveFailed': 'No se pudo guardar',
  'recorder.noPermissionTitle': 'Sin permiso',
  'recorder.noPermissionBody': 'Hace falta permiso para guardar en el Carrete.',
  'recorder.recordingError': 'Error grabando',
  'recorder.error': 'Error',
  'defaultScript': [
    'Pega aquí tu guion desde los ajustes.',
    '',
    'Arrastra con el dedo para moverlo a mano.',
    'Toca una vez para que avance solo, y otra para pararlo.',
  ].join('\n'),
} as const;

const en: Record<TextKey, string> = {
  'settings.title': 'Script & settings',
  'settings.done': 'Done',
  'settings.section.script': 'Script',
  'settings.placeholder': 'Paste your script here…',
  'settings.rewind': 'Back to the top',
  'settings.fontSize': 'Font size',
  'settings.speed': 'Speed',
  'settings.lineHeight': 'Line spacing',
  'settings.panelHeight': 'Panel height',
  'settings.panelTop': 'Position on screen',
  'settings.panelTopHint':
    'Moves the whole script box. The higher it is, the closer to the front camera ' +
    'lens, and the more it looks like you are talking to camera.',
  'settings.panelTop.top': 'Top',
  'settings.panelTop.bottom': 'Bottom',
  'settings.readLine': 'Reading line',
  'settings.readLineHint':
    'Where you sit inside the box — how much text you see ahead. It does not move ' +
    'the box: that is what position on screen is for.',
  'settings.opacity': 'Panel background',
  'settings.section.camera': 'Camera',
  'settings.stabilization': 'Stabilization',
  'settings.stabilization.off': 'None',
  'settings.stabilization.standard': 'Standard',
  'settings.stabilization.cinematic': 'Cinematic',
  'settings.stabilization.cinematic-extended': 'Maximum',
  'settings.stabilizationHint':
    'The more it stabilizes, the more it crops the frame. While recording, the change ' +
    'lands when you stop: switching mid-take would break the recording.',
  'settings.mirror': 'Mirror front camera',
  'settings.mirrorHint':
    'Flips what you see and what gets recorded, together. When off, any text in the ' +
    'shot reads the right way round. The script is an overlay, so it never flips.',
  'controls.settings': 'Script settings',
  'controls.record': 'Record',
  'controls.stop': 'Stop recording',
  'controls.flip': 'Switch camera',
  'prompter.tapHint': 'Tap the script to scroll it',
  'camera.searching': 'Looking for the camera…',
  'camera.noPermission': 'Camera permission needed',
  'recorder.saveFailed': 'Couldn’t save',
  'recorder.noPermissionTitle': 'No permission',
  'recorder.noPermissionBody': 'Permission is needed to save to your Photos.',
  'recorder.recordingError': 'Recording error',
  'recorder.error': 'Error',
  'defaultScript': [
    'Paste your script here from the settings.',
    '',
    'Drag with a finger to move it by hand.',
    'Tap once to let it scroll on its own, and again to stop it.',
  ].join('\n'),
};

export type TextKey = keyof typeof es;

const isSpanish = getLocales()[0]?.languageCode === 'es';
const texts: Record<TextKey, string> = isSpanish ? es : en;

export function t(key: TextKey): string {
  return texts[key];
}

/** Separador decimal del idioma en uso: coma en español, punto en inglés. */
export function formatDecimal(value: number, digits: number): string {
  const fixed = value.toFixed(digits);
  return isSpanish ? fixed.replace('.', ',') : fixed;
}
