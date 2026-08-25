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
  'settings.textWidth': 'Ancho del texto',
  'settings.textWidth.narrow': 'Estrecho',
  'settings.textWidth.full': 'Completo',
  'settings.range.min': 'Mínimo',
  'settings.range.max': 'Máximo',
  'settings.opacity.transparent': 'Transparente',
  'settings.opacity.opaque': 'Opaco',
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
  'settings.dual': 'Grabar con las dos cámaras',
  'settings.dualHint':
    'Una llena el cuadro y la otra va en un recuadro que puedes arrastrar donde ' +
    'quieras. Al parar, las dos tomas se funden en un solo vídeo.',
  'settings.dualUnsupported': 'Este iPhone no puede con las dos cámaras a la vez.',
  'settings.stabilizationDropped':
    'Con las dos cámaras no ha cabido: se está grabando sin estabilizar. Las dos ' +
    'a la vez se reparten un presupuesto de hardware y la estabilización no entra.',
  'settings.pipWidth': 'Tamaño del recuadro',
  'settings.pipWidth.small': 'Pequeño',
  'settings.pipWidth.big': 'Grande',
  'recorder.composing': 'Montando el vídeo…',
  'settings.lenses': 'Lentes de la cámara trasera',
  'settings.lensesHint':
    'Con cuáles quieres encuadrar. Quitar lentes también quita sus paradas de zoom, ' +
    'y con una sola la cámara arranca antes y no salta sola al hacer zoom.',
  'settings.lens.ultra-wide-angle': 'Gran angular',
  'settings.lens.wide-angle': 'Principal',
  'settings.lens.telephoto': 'Teleobjetivo',
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
  'camera.dualFailed': 'No se han podido abrir las dos cámaras a la vez',
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
  'settings.textWidth': 'Text width',
  'settings.textWidth.narrow': 'Narrow',
  'settings.textWidth.full': 'Full width',
  'settings.range.min': 'Minimum',
  'settings.range.max': 'Maximum',
  'settings.opacity.transparent': 'Transparent',
  'settings.opacity.opaque': 'Opaque',
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
  'settings.dual': 'Record with both cameras',
  'settings.dualHint':
    'One fills the frame and the other sits in a box you can drag anywhere. ' +
    'When you stop, both takes are merged into a single video.',
  'settings.dualUnsupported': 'This iPhone cannot run both cameras at once.',
  'settings.stabilizationDropped':
    'It did not fit with both cameras, so it is recording unstabilized. Running two ' +
    'at once shares a hardware budget, and stabilization does not fit in it.',
  'settings.pipWidth': 'Box size',
  'settings.pipWidth.small': 'Small',
  'settings.pipWidth.big': 'Large',
  'recorder.composing': 'Merging the video…',
  'settings.lenses': 'Back camera lenses',
  'settings.lensesHint':
    'Which ones you want to frame with. Dropping a lens also drops its zoom stop, ' +
    'and with a single one the camera starts up faster and never switches on its own.',
  'settings.lens.ultra-wide-angle': 'Ultra wide',
  'settings.lens.wide-angle': 'Main',
  'settings.lens.telephoto': 'Telephoto',
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
  'camera.dualFailed': 'Could not open both cameras at once',
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
