import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { DEFAULT_SETTINGS, type PrompterSettings } from './prompterSettings';

const KEY = 'prompter.settings.v1';
/** Escribir en disco en cada pulsación de tecla no aporta nada. */
const SAVE_DELAY = 400;

export type UseSettings = {
  settings: PrompterSettings;
  /** ¿Ya se ha leído el disco? Hasta entonces no se pinta el guion. */
  loaded: boolean;
  update: (patch: Partial<PrompterSettings>) => void;
};

/**
 * Ajustes del teleprompter, con lectura al arrancar y guardado diferido.
 *
 * Los valores se mezclan sobre los de fábrica en vez de sustituirlos, para que
 * añadir un ajuste nuevo no rompa la lectura de un guardado antiguo.
 */
export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<PrompterSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (cancelled || raw == null) return;
        const stored = JSON.parse(raw) as Partial<PrompterSettings>;
        setSettings((current) => ({ ...current, ...stored }));
      })
      .catch(() => {
        // Un guardado corrupto no debe impedir abrir la app: se sigue con los
        // valores de fábrica y el primer cambio lo sobrescribe.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Lo último escrito, aunque el guardado diferido aún no haya saltado. */
  const pending = useRef<PrompterSettings | null>(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const next = pending.current;
    if (next == null) return;
    pending.current = null;
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const update = useCallback(
    (patch: Partial<PrompterSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        pending.current = next;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, SAVE_DELAY);
        return next;
      });
    },
    [flush],
  );

  // Una app de móvil casi nunca se desmonta: se manda a segundo plano. Si no se
  // vuelca aquí, el último cambio antes de salir se pierde.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flush();
    });
    return () => {
      subscription.remove();
      flush();
    };
  }, [flush]);

  return { settings, loaded, update };
}
