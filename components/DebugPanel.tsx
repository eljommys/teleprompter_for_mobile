import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { CameraDevice, CameraSessionConfig } from 'react-native-vision-camera';

import type { ScriptScroll } from '../lib/useScriptScroll';
import { toDisplay, type ZoomScale } from '../lib/zoom';

type Props = {
  device: CameraDevice | undefined;
  scale: ZoomScale | null;
  scroll: ScriptScroll;
  /** Lo que la sesión eligió tras negociar las restricciones. */
  sessionConfig: CameraSessionConfig | null;
};

/**
 * Números crudos de la cámara, para la primera prueba en el iPhone.
 *
 * Existe por una razón concreta: los tipos de VisionCamera no dejan claro si
 * `zoomLensSwitchFactors` y `device.minZoom` vienen en escala cruda o visible
 * (ver `lib/zoom.ts`). Con esto delante, comprobarlo lleva medio minuto.
 */
export function DebugPanel({ device, scale, scroll, sessionConfig }: Props) {
  // Los valores del guion viven en el hilo de UI. Cruzar a JS en cada fotograma
  // solo para pintar un número sería absurdo, así que se muestrean despacio y
  // solo mientras este panel está abierto.
  const [live, setLive] = useState({
    travel: 0,
    position: 0,
    playing: false,
    viewport: 0,
    content: 0,
  });
  useEffect(() => {
    const id = setInterval(() => {
      setLive({
        travel: scroll.travel.value,
        position: scroll.position.value,
        playing: scroll.playing.value,
        viewport: scroll.viewportHeight.value,
        content: scroll.contentHeight.value,
      });
    }, 400);
    return () => clearInterval(id);
  }, [scroll]);

  const lines: string[] = [];

  // El recorrido sale de restar estos dos. Si es cero, el bucle de avance no
  // mueve nada por muchas veces que toques el guion.
  lines.push(`hueco px        ${live.viewport.toFixed(1)}`);
  lines.push(`contenido px    ${live.content.toFixed(1)}`);
  lines.push(`recorrido px    ${live.travel.toFixed(1)}`);
  lines.push(`posición 0..1   ${live.position.toFixed(4)}`);
  lines.push(`avanzando       ${live.playing}`);
  lines.push('');

  if (device == null) {
    lines.push('sin dispositivo');
  } else {
    lines.push(`type            ${device.type}`);
    lines.push(`position        ${device.position}`);
    lines.push(`isVirtual       ${device.isVirtualDevice}`);
    lines.push(`physicalDevices ${device.physicalDevices.map((d) => d.type).join(', ') || '—'}`);
    lines.push(`device.minZoom  ${device.minZoom}`);
    lines.push(`device.maxZoom  ${device.maxZoom}`);
    lines.push(`switchFactors   [${device.zoomLensSwitchFactors.join(', ')}]`);
    lines.push(
      `estab. soportada ${(['standard', 'cinematic', 'cinematic-extended'] as const)
        .filter((mode) => device.supportsVideoStabilizationMode(mode))
        .join(', ') || '—'}`,
    );
  }

  // Lo pedido y lo concedido no tienen por qué coincidir: la sesión negocia el
  // modo con la resolución, los FPS y el resto de salidas. Si aquí sale otra
  // cosa de la que pusiste en los ajustes, es que la cámara no puede darla.
  lines.push(
    `estab. vídeo    ${sessionConfig?.selectedVideoStabilizationMode ?? '(sin sesión)'}`,
  );
  lines.push(
    `estab. previa   ${sessionConfig?.selectedPreviewStabilizationMode ?? '(sin sesión)'}`,
  );

  if (scale == null) {
    lines.push('escala          (aún sin controlador)');
  } else {
    lines.push(`ratio vis/crudo ${scale.ratio.toFixed(4)}`);
    lines.push(`minRaw / maxRaw ${scale.minRaw.toFixed(2)} / ${scale.maxRaw.toFixed(2)}`);
    lines.push(`paradas crudas  [${scale.stopsRaw.map((v) => v.toFixed(2)).join(', ')}]`);
    lines.push(
      `paradas visibles [${scale.stopsRaw.map((v) => toDisplay(v, scale).toFixed(2)).join(', ')}]`,
    );
  }

  return (
    <ScrollView style={styles.panel} contentContainerStyle={styles.content}>
      {lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 100,
    maxHeight: 260,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    borderRadius: 12,
  },
  content: {
    padding: 12,
  },
  line: {
    color: '#0f0',
    fontFamily: 'Menlo',
    fontSize: 11,
    lineHeight: 16,
  },
});
