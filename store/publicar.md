# Publicar Prompter

Dos etapas: primero TestFlight, con lo que la app llega a gente de verdad en unas
horas; después la App Store pública, cuando quieras.

Todo lo que sigue asume la cuenta de desarrollador de pago que ya tienes
(equipo `25G3Q8388L`).

---

## Dónde estamos (8 ago 2026)

La primera etapa está hecha. La build **1.0.0 (5)**, perfil `production`, se
compiló y se subió a App Store Connect el 7 de agosto, y el registro de la app
existe con el ID `6799003999`. O sea: TestFlight ya funciona, solo hay que
repartir el enlace.

Para la App Store pública faltan las cinco cosas de la última sección de
`ficha-app-store.md`. Ninguna es código.

---

## Antes de la primera build

**1. Confirma el nombre del bundle.** `com.rackslabs.prompter` ya está registrado
en el portal de Apple, porque el certificado de desarrollo lo creó al compilar en
tu iPhone. No hace falta tocarlo.

**2. Todo tiene que estar en git.** EAS sube el proyecto a partir del archivo de
git, así que lo que no esté confirmado no viaja. Importa especialmente
`patches/`: sin ese parche, `expo-modules-jsi` no compila.

```bash
git add -A && git commit -m "Prompter listo para TestFlight"
```

**3. Cuenta de Expo.** Gratuita. `eas login` la pide, y si no tienes se crea en
el momento.

---

## TestFlight

```bash
npx eas-cli login
npx eas-cli build:configure          # enlaza el proyecto con tu cuenta
npx eas-cli build --platform ios --profile production
```

En la primera build te preguntará por las credenciales de distribución. Deja que
las gestione EAS: crea el certificado de distribución y el perfil por ti, y los
guarda para las siguientes.

Cuando termine (20-40 min con el plan gratuito, la cola incluida):

```bash
npx eas-cli submit --platform ios --latest
```

La primera vez te pedirá crear el registro de la app en App Store Connect: dile
que sí y usa el nombre y el SKU de `ficha-app-store.md`.

A partir de ahí, en App Store Connect → TestFlight:

- La build tarda entre 5 y 30 minutos en procesarse.
- **Pruebas internas**: hasta 100 personas de tu equipo, disponible al momento,
  sin revisión.
- **Pruebas externas**: hasta 10.000 personas con un enlace público. Pide una
  revisión de Apple, más laxa que la de la Store y normalmente de menos de 24 h.
  El enlace público es lo que quieres para que se la instale cualquiera.

Ojo con una cosa: **cada build de TestFlight caduca a los 90 días.** Si la app se
va a quedar ahí una temporada, hay que ir subiendo versiones.

### Para la revisión de TestFlight

Rellena «What to Test» y la información de contacto. Copia las notas para el
revisor de `ficha-app-store.md`: le ahorras el descubrir que hace falta un
dispositivo físico, que es el motivo más habitual de rechazo en apps de cámara.

---

## App Store pública

Sobre lo anterior, faltan tres cosas:

1. **Capturas** — ver `store/capturas.md`. Tienen que salir del iPhone.
2. **Las dos URLs, privacidad y soporte** — las páginas ya están escritas en
   `docs/`. Solo falta activar GitHub Pages una vez: `docs/LEEME.md`.
3. **La ficha** — nombre, subtítulo, descripción, palabras clave y las respuestas
   de App Privacy, todo en `ficha-app-store.md`.

Después, en App Store Connect, seleccionas la build de TestFlight que ya está
subida y le das a enviar a revisión. La revisión de la Store suele tardar entre
uno y tres días.

### Dos avisos sobre la revisión

**Directriz 2.1 — completeness.** Las apps de cámara se rechazan a menudo porque
el revisor prueba en simulador, no ve nada y lo da por roto. Las notas para el
revisor lo evitan.

**Directriz 4.2 — minimum functionality.** No es un riesgo real aquí: la app
resuelve un problema concreto y el cambio de cámara en caliente no lo hace la
cámara del sistema. Si aun así lo sacan, el argumento es ese.

---

## Versiones siguientes

`eas.json` lleva `appVersionSource: "remote"` y `autoIncrement: true` en el perfil
de producción, así que el número de build lo lleva EAS y no hay que tocarlo nunca
a mano.

Para una versión nueva de cara al usuario, sube `version` en `app.json`
(`1.0.0` → `1.1.0`) y vuelve a lanzar `build` y `submit`.

---

## Si algún día quieres Android

El código es el mismo, pero el motor de cámara no: en Android es CameraX en vez de
AVFoundation. Hay que volver a probar desde cero el cambio de cámara en caliente
(`enablePersistentRecorder` se apoya allí en `asPersistentRecording()`) y las
paradas de lente del zoom. Más la cuenta de Google Play, 25 $ una sola vez.
