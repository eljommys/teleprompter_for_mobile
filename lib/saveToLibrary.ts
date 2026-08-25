import * as MediaLibrary from 'expo-media-library';

/**
 * Guarda una toma en el Carrete.
 *
 * `MediaLibrary.createAssetAsync` sigue existiendo en los tipos de SDK 57, pero
 * es un resto obsoleto que lanza en cuanto se llama. Lo que guarda de verdad es
 * `Asset.create`.
 */
export async function saveToLibrary(filePath: string): Promise<void> {
  // `filePath` viene como ruta de sistema de ficheros, no como URL.
  const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
  await MediaLibrary.Asset.create(uri);
}
