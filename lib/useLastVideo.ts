/**
 * El último vídeo del Carrete, para el acceso directo a la galería.
 *
 * La miniatura no se genera aquí: `expo-media-library` registra un cargador de
 * imágenes para las URIs `ph://`, así que un `<Image source={{ uri }}>` con el
 * identificador del asset ya le pide a Fotos el fotograma de portada. Por eso
 * basta con averiguar **cuál** es el último vídeo, y no hay que abrir ficheros
 * ni exportar nada.
 */

import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

export type LastVideo = {
  /** `ph://…` del último vídeo del Carrete. Null si no hay, o si no hay permiso. */
  uri: string | null;
  /** Abre Fotos. Pide el permiso de lectura la primera vez, si hace falta. */
  open: () => void;
  /**
   * Acaba de entrar una toma nueva en el Carrete.
   *
   * Pide el permiso de lectura si todavía no lo hay y vuelve a mirar cuál es el
   * último vídeo. Guardar una toma es el momento natural para pedirlo: acabas
   * de meter algo en la fototeca y lo que sigue es enseñártelo. Al arrancar la
   * app sería una petición a bocajarro, y solo con el botón de la galería la
   * miniatura no aparecía nunca hasta que lo tocabas.
   */
  noteNewVideo: () => void;
};

/**
 * Abrir Fotos por el vídeo concreto no es API pública.
 *
 * `photos-navigation://` es el esquema que responde de verdad —`photos://` no
 * abre nada—, y admite un `revealassetuuid` para señalar un asset dentro de un
 * álbum del sistema. No está documentado, así que puede limitarse a abrir
 * Recientes; por eso detrás va el esquema de toda la vida, que solo abre la app
 * pero nunca falla.
 */
const PHOTOS_FALLBACK = 'photos-redirect://';

function revealUrl(uri: string): string {
  // El identificador de la fototeca es «UUID/L0/001»; a Fotos hay que darle
  // solo el UUID de delante.
  const uuid = uri.replace(/^ph:\/\//, '').split('/')[0];
  return `photos-navigation://album?name=recents&revealassetuuid=${uuid}`;
}

export function useLastVideo(): LastVideo {
  // Sin `writeOnly`: guardar una toma no deja leer la fototeca, y la miniatura
  // es lectura. El gancho solo consulta el estado; pedirlo es cosa de `open`.
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [uri, setUri] = useState<string | null>(null);
  const granted = permission?.granted ?? false;

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!granted) {
      setUri(null);
      return;
    }
    try {
      // `exeForMetadata` y no `exe`: de un `Asset` sacar la URI abre el fichero
      // de vídeo —y con uno en iCloud se lo baja—, y aquí solo hace falta su
      // identificador.
      const [newest] = await new MediaLibrary.Query()
        .eq(MediaLibrary.AssetField.MEDIA_TYPE, MediaLibrary.MediaType.VIDEO)
        .orderBy({ key: MediaLibrary.AssetField.CREATION_TIME, ascending: false })
        .limit(1)
        .exeForMetadata();
      if (alive.current) setUri(newest?.id ?? null);
    } catch {
      // Sin miniatura el botón sigue abriendo Fotos, que es lo que importa.
      if (alive.current) setUri(null);
    }
  }, [granted]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // La fototeca avisa de sus propios cambios, así que la miniatura se pone al
  // día sola al guardar una toma —y también si grabas algo con otra app.
  useEffect(() => {
    if (!granted) return;
    const subscription = MediaLibrary.addListener(() => {
      void refresh();
    });
    return () => subscription.remove();
  }, [granted, refresh]);

  // El aviso de arriba no llega con la app dormida, y de Fotos se vuelve
  // justamente después de haber borrado o grabado algo.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  /**
   * Se asegura de que hay permiso de lectura, pidiéndolo si aún se puede.
   *
   * Nunca al arrancar la app: grabar y guardar solo necesitan el de escritura,
   * que es mucho menos intrusivo. Este se pide en los dos momentos en los que
   * de verdad hace falta, y los dos los provoca el usuario: guardar una toma y
   * tocar la miniatura.
   */
  const ensureAccess = useCallback(async () => {
    if (granted || permission?.canAskAgain === false) return;
    await requestPermission().catch(() => undefined);
  }, [granted, permission, requestPermission]);

  const noteNewVideo = useCallback(() => {
    void (async () => {
      await ensureAccess();
      // Sin esperar al aviso de la fototeca: llega, pero el vídeo recién
      // guardado es justo el que quieres ver ya.
      await refresh();
    })();
  }, [ensureAccess, refresh]);

  const open = useCallback(() => {
    void (async () => {
      await ensureAccess();
      const candidates = uri == null ? [PHOTOS_FALLBACK] : [revealUrl(uri), PHOTOS_FALLBACK];
      for (const url of candidates) {
        try {
          await Linking.openURL(url);
          return;
        } catch {
          // Ese esquema no lo coge nadie: se prueba el siguiente.
        }
      }
    })();
  }, [ensureAccess, uri]);

  return { uri, open, noteNewVideo };
}
