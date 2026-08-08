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
  'settings.opacity': 'Fondo del panel',
  'settings.mirror': 'Espejo en la cámara frontal',
  'settings.mirrorHint':
    'Cambia lo que ves y lo que se graba, a la vez. Apagado, un texto que salga en ' +
    'plano se lee del derecho. El guion es un rótulo encima, así que nunca se voltea.',
  'controls.settings': 'Ajustes del guion',
  'controls.record': 'Grabar',
  'controls.stop': 'Parar de grabar',
  'controls.flip': 'Cambiar de cámara',
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
  'settings.opacity': 'Panel background',
  'settings.mirror': 'Mirror front camera',
  'settings.mirrorHint':
    'Flips what you see and what gets recorded, together. When off, any text in the ' +
    'shot reads the right way round. The script is an overlay, so it never flips.',
  'controls.settings': 'Script settings',
  'controls.record': 'Record',
  'controls.stop': 'Stop recording',
  'controls.flip': 'Switch camera',
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
