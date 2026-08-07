# Capturas para la App Store

**TestFlight no las necesita.** Esto solo hace falta cuando pases a la Store
pública, así que no te bloquea la primera subida.

## Por qué tienen que salir de tu iPhone

El simulador de iOS no tiene cámara. Las capturas que se saquen ahí salen con el
fondo en negro, y la app se vende justamente por lo que se ve detrás del guion.
Las tres capturas del guion en `ficha-app-store.md` tienen que venir del teléfono.

## Cómo sacarlas

En el iPhone, con la app abierta: **botón lateral + subir volumen** a la vez.

1. **Grabando con el guion en pantalla.** Pon un guion de verdad, ponte en un
   sitio con luz, empieza a grabar y captura con el cronómetro corriendo. Que se
   vea el punto rojo.
2. **Los controles de zoom.** Con la cámara trasera, para que salgan las tres
   lentes. Pulsa el 5× antes de capturar, así se ve cuál está activa.
3. **La hoja de ajustes.** Con un guion pegado de verdad, no el texto de ejemplo.

Pásalas al Mac por AirDrop y déjalas en `store/capturas/`.

## Tamaños

Tu iPhone 15 Pro Max captura a **1290 × 2796**, que es el juego de 6,7 pulgadas.

App Store Connect te dirá exactamente qué ranuras son obligatorias en el momento
de subir —Apple las ha ido cambiando—. Si te pide el juego de **6,9 pulgadas**
(1320 × 2868), no hay que rehacer nada: se reescalan, y Apple las acepta siempre
que las dimensiones coincidan exactamente. El comando:

```bash
python3 - <<'PY'
from PIL import Image
from pathlib import Path

destino = Path("store/capturas/6.9")
destino.mkdir(parents=True, exist_ok=True)

for origen in sorted(Path("store/capturas").glob("*.png")):
    Image.open(origen).convert("RGB").resize((1320, 2868), Image.LANCZOS).save(
        destino / origen.name, "PNG"
    )
    print("→", destino / origen.name)
PY
```

## Sobre los rótulos

Los rótulos que propone `ficha-app-store.md` («El guion, encima de la cámara») son
opcionales: puedes subir las capturas limpias. Si los quieres, el patrón que mejor
funciona es una banda de color arriba con el texto grande y la captura debajo, sin
marco de teléfono — Apple ya presenta las imágenes dentro de un iPhone.

## El vídeo de previsualización

Es opcional, pero para esta app en concreto vale más que las tres capturas juntas:
el cambio de cámara sin cortar es difícil de contar y trivial de enseñar. Grábalo
con la propia app, 15-30 segundos, girando de cámara dos veces. Apple lo quiere en
la misma resolución que las capturas.
