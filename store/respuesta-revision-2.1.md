# Respuesta a la directriz 2.1 · Information Needed

Apple no ha rechazado la app: ha pedido información. **No hace falta subir un
binario nuevo, ni cambiar nada del código.** Se contesta en Resolution Center y
se responde a los siete puntos.

Es la carta estándar que Apple manda a casi toda primera subida desde 2025. La
respuesta va en inglés porque el equipo de revisión trabaja en inglés, aunque el
idioma principal de la ficha sea el español.

Dos cosas que hacer, en este orden:

1. Grabar el vídeo de pantalla — es lo único que no puedo hacer yo, hace falta un
   iPhone físico. Guion de rodaje al final de este documento.
2. Pegar el texto de abajo en Resolution Center, con el vídeo adjunto. Y pegarlo
   también en *App Review Information → Notes*, que es lo que Apple pide
   expresamente para las siguientes subidas.

---

## Texto para pegar

Cabe en el campo *Notes*, que admite 4.000 caracteres: son 3.925.
Sirve igual para la respuesta de Resolution Center.

> 1. SCREEN RECORDING
> Attached, captured on a physical iPhone. It starts at the Home Screen, launches the app, and shows the camera and microphone permission prompts, pasting a script, recording, the script auto-scrolling, switching cameras mid-recording, the zoom controls, stopping, the "Add to Photos" prompt, and the resulting single continuous video in Photos.
> There is no registration, login, account deletion, paid content, purchase, subscription or shared user-generated content, so no such flow exists.
>
> 2. DEVICES AND OS TESTED
> iPhone 15 Pro Max - iOS 26.0.
> A physical device is required: the app uses the camera and microphone, and neither exists in the iOS Simulator, where the preview is black. That is expected, not a bug.
>
> 3. PURPOSE AND TARGET AUDIENCE
> Prompter is a teleprompter that sits on top of the iPhone camera, so one person alone can read a script while recording themselves.
> Problem solved: recording yourself talking to camera normally needs a second device propped next to the phone, or a beam-splitter rig; both make you look away from the lens. Prompter puts the script over the live preview on the recording phone.
> Beyond the built-in Camera app: the recording survives switching between rear and front camera. Start on the rear, switch to the front mid-sentence, switch back, and the result is one continuous video file with uninterrupted audio. The system Camera app ends the take instead.
> Audience: creators, trainers, and anyone who records presentations or sales messages to camera.
>
> 4. SETUP AND ACCESS
> No credentials, demo account or sample files are needed; there is no account system and the app works offline.
> 1) Launch and allow Camera and Microphone access.
> 2) The preview fills the screen, with a script band across the middle, prefilled with a short placeholder script.
> 3) The menu button (bottom left) opens settings: paste any text; adjust size, speed, line spacing, panel height and opacity.
> 4) The red button (bottom center) starts recording; a timer appears.
> 5) Tap the band and the script scrolls on its own; tap again to stop. It can also be dragged.
> 6) MAIN FEATURE: tap the flip button (bottom right) two or three times while recording. The recording is not interrupted and the timer keeps running.
> 7) On the rear camera the zoom buttons switch between the physical lenses; the slider moves between them. Pinching outside the band also zooms.
> 8) The red button stops it. Allow "Add to Photos", and the take is saved to Photos as one continuous video.
> Long-pressing the top-left corner opens a debug overlay of raw camera values.
>
> 5. EXTERNAL SERVICES
> None. The app has no backend and makes no network requests of any kind; it behaves identically in airplane mode. It contains no analytics, advertising, crash reporting, authentication, payment or AI service, no data provider, no cloud storage.
> Everything runs on-device on Apple frameworks: AVFoundation for capture and recording, Photos to save the finished video to the user's own library. The open-source libraries it is built with (React Native, VisionCamera) are compiled in and run locally; they are not services and contact no server.
> Script text and settings are stored in local app storage on the device only.
>
> 6. REGIONAL DIFFERENCES
> None. Same features and content in every region, with no geographic restrictions or region-gated functionality.
> The only regional variation is the interface language, which follows the device setting: Spanish on Spanish devices, English everywhere else, covering the interface and the system permission prompts. It is purely a translation; no feature differs.
>
> 7. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
> Not applicable. The app is not in a regulated industry and includes no protected third-party material. All content is created by the user: their own script text and their own recordings. Nothing is supplied by us or any third party, and nothing is shared with other users.

---

## Guion de rodaje del vídeo

Lo único que tienes que hacer con las manos. Apple exige **dispositivo físico** y
**el sistema operativo más reciente**, y que empiece con el lanzamiento de la app.

**Antes de grabar: borra la app del iPhone y reinstálala desde TestFlight.** Si no,
los diálogos de permisos no vuelven a salir, y Apple los pide explícitamente
—«any prompts requesting access to sensitive data or device capabilities»—. Es el
error que obliga a repetir el vídeo.

Graba con la grabación de pantalla del Centro de Control, **sin activar el
micrófono del grabador**: la app ya usa el micrófono y no merece la pena arriesgar
un conflicto de sesión de audio por una narración que nadie te pide.

Orden de las tomas, entre 90 segundos y 3 minutos:

1. La pantalla de inicio, y tocas el icono. Tiene que verse el lanzamiento.
2. Sale el permiso de **cámara** → Permitir. Sale el de **micrófono** → Permitir.
3. Se ve la cámara a pantalla completa con la banda del guion.
4. Botón de menú abajo a la izquierda: pegas un guion de verdad, tocas el tamaño
   de letra y la velocidad para que se vea que son ajustables, y cierras.
5. Botón rojo. Arranca el cronómetro.
6. Tocas la banda: el guion avanza solo. Lo arrastras con el dedo un momento.
7. **Lo importante.** Botón de girar, abajo a la derecha, dos o tres veces.
   Detente un segundo en cada giro para que se vea que **el cronómetro no se
   reinicia**. Es la prueba de que la grabación no se corta, y es lo que el
   revisor tiene que ver sin lugar a dudas.
8. Los botones de lente: 0,5× / 1× / 5×, y el deslizador.
9. Botón rojo otra vez. Sale el permiso de **Añadir a Fotos** → Permitir.
10. Sales a la app Fotos, abres el vídeo recién guardado y reproduces unos
    segundos **que incluyan el cambio de cámara**, para que se vea que es un solo
    archivo y que el audio no se corta.

El paso 10 es el que cierra la revisión: enseña el resultado, no solo la promesa.

### Cómo entregarlo

Resolution Center admite adjuntos, así que lo primero es adjuntarlo ahí. Si pesa
demasiado, baja la duración antes que la calidad —un vídeo borroso no demuestra
nada— y como último recurso súbelo a `docs/` y manda la URL de GitHub Pages.

---

## Lo que este rechazo no es

No te han tocado el binario, ni las capturas, ni los textos. La lista de «How to
Prevent Common Issues» del final de la carta es plantilla: va en todas, y
menciona suscripciones y credenciales de acceso que esta app no tiene.

De esa lista solo hay un punto que merece una mirada, y es el 5.1.1 sobre las
cadenas de permisos. Las tuyas están correctas y localizadas en los dos idiomas,
pero son escuetas. Si en algún momento subes una versión nueva por otro motivo,
merece la pena alargarlas con un ejemplo de uso, que es lo que pide la directriz.
Por sí solo no justifica una build.
