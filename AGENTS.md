# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# VisionCamera v5 is NOT the VisionCamera you know

v5 is a full rewrite on top of Nitro Modules. The v3/v4 APIs you may remember
(`useCameraFormat`, `camera.current.startRecording(...)`, `video={true}`,
`photo={true}`) **do not exist**.

The shape now is: `useVideoOutput(...)` → `<Camera outputs={[videoOutput]}>` →
`await videoOutput.createRecorder({})` → `recorder.startRecording(onFinished, onError)`
→ `recorder.stopRecording()`. A `Recorder` records one file and is never reused.

Read the typings in `node_modules/react-native-vision-camera/lib/` before touching
anything camera-related. They are thorough and they are the ground truth —
`specs/outputs/CameraVideoOutput.nitro.d.ts`, `specs/inputs/CameraDevice.nitro.d.ts`
and `hooks/useCamera.d.ts` cover almost everything this app uses.

# Trampas ya pisadas en este proyecto

No las vuelvas a pisar. Todas typechequean sin rechistar y fallan en ejecución o
en la compilación nativa.

- **`MediaLibrary.createAssetAsync` lanza en SDK 57.** Existe en los tipos, pero
  es un resto obsoleto con un `throw` dentro. Lo que guarda de verdad es
  `MediaLibrary.Asset.create(uri)`. Lo mismo vale para `saveToLibraryAsync`,
  `getAlbumsAsync` y compañía: mira `build/legacyWarnings.d.ts` antes de usar
  cualquier función `*Async` de esa librería.
- **No escribas un `babel.config.js`.** SDK 57 no trae `babel-preset-expo` en la
  raíz —cuelga de `expo/node_modules`—, así que un `presets: ['babel-preset-expo']`
  a mano ni siquiera resuelve. Y no hace falta: el preset ya añade solo
  `react-native-worklets/plugin` cuando detecta el paquete instalado.
- **`UIViewControllerBasedStatusBarAppearance` tiene que ser `NO`.** Si lo pones
  a `true` en `app.json`, `expo-status-bar` revienta con una pantalla roja de
  `RCTStatusBarManager`. Lo más seguro es no tocar la clave.
- **`expo-modules-jsi@57.0.4` no compila con Xcode 26 / Swift 6.2.** Está
  parcheado en `patches/`; ver el README.
- **Pasar un `SharedValue` a `<Camera zoom={...}>` exige
  `react-native-vision-camera-worklets`.** Sin él, la app arranca y revienta con
  «Cannot use Frame Processors — `react-native-vision-camera-worklets` is not
  installed!». El mensaje engaña: aquí no hay ningún frame processor, pero el
  puente que ata un valor del hilo de UI al controlador nativo
  (`bindUIUpdatesToController`) vive en ese paquete. Va aparte de
  `react-native-vision-camera` y su versión tiene que coincidir exactamente.

# Comentarios y textos

El código y los comentarios van en español, igual que en `~/GitHub/teleprompter`.
Los comentarios explican **por qué**, no **qué**.
