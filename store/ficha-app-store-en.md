# App Store listing · English (U.S.)

La localización inglesa de la ficha. El documento en español,
`ficha-app-store.md`, sigue siendo el que manda: aquí solo está lo que cambia al
traducir, más las tres decisiones que la traducción obliga a tomar.

Se añade en App Store Connect → *General* → *App Information* → *App Store
Localizations* → **English (U.S.)**. Solo se puede tocar mientras la app está en
estado editable, nunca durante una revisión.

---

## Lo que hay que rellenar y lo que no

Al añadir un idioma, **las capturas y el resto de propiedades se heredan del
idioma principal; la descripción y las palabras clave, no.** Es literal de Apple:

> «When you add a language to your app, screenshots and the properties for the
> new language default to those of the primary language, except for the
> description and keywords.»

Traducido a trabajo real: **no hay que volver a sacar capturas.** Se heredan las
del español y se pueden dejar así. Los rótulos de esas capturas son opcionales
—si las subes limpias, no hay nada que traducir— y esa es una razón más para
subirlas sin rótulo.

Lo que sí hay que escribir aquí: nombre, subtítulo, texto promocional,
descripción y palabras clave. Y decidir qué haces con la URL de privacidad, que
también es localizable.

---

## Identity

| Field        | Value                              |
| ------------ | ---------------------------------- |
| Name (30)    | `Teleprompter & Camera` — 21       |
| Subtitle (30)| `No subscription, no watermark` — 29|

`Teleprompter & Camera` calca la lógica del nombre español: la palabra por la que
te buscan va delante y Apple la indexa desde ahí. El subtítulo va justo de
tamaño, 29 de 30, así que si lo tocas cuenta los caracteres antes.

---

## Promotional Text (170)

> Switch between the front and rear camera without cutting the recording. One
> video, no jumps. And your script in front of you the whole time, at the speed
> you set.

162 caracteres. Se puede cambiar sin pasar por revisión, igual que el español.

---

## Description (4000)

> Record yourself reading your script. Nothing to edit afterwards.
>
> Prompter puts the teleprompter on top of your iPhone's camera. Paste your text,
> hit record, and read. No glass rig, no second iPad, no Wi-Fi in the middle.
>
> SWITCH CAMERAS WITHOUT CUTTING
> Start on the rear camera, jump to the front mid-sentence, and go back. The take
> doesn't break: you get one continuous video with unbroken audio from start to
> finish. No more recording it twice and stitching it together later.
>
> THE SCRIPT AT YOUR PACE
> Drag it with your finger to put it wherever you want. Tap once and it scrolls
> on its own; tap again and it stops. Speed, text size and line spacing all
> adjust while you record, and a line marks where you are.
>
> REAL ZOOM
> On the rear camera, the buttons jump between your iPhone's actual lenses —
> ultra wide, main, telephoto — not a digital crop. A slider takes you anywhere
> in between. On the front camera, digital zoom with the same control.
>
> VERTICAL, READY TO POST
> Records 9:16 at 1080p. When you stop, the take goes straight to your Camera
> Roll and you edit it where you already edit.
>
> YOURS AND NOBODY ELSE'S
> No account, no subscription, no ads, no watermark. Prompter never connects to
> the internet: it works exactly the same in airplane mode. Your script and your
> videos never leave your phone.
>
> Built for people who talk to camera often: social video, training,
> presentations, sales messages.

Mismas dos reglas que en español. Las tres primeras líneas son lo único que se ve
antes del «more», por eso el gancho está arriba. Y los titulares van en
mayúsculas porque el campo no admite Markdown.

No es una traducción literal: «sin montar nada» sería *without editing anything*,
que en inglés suena a que la app edita. `Nothing to edit afterwards` dice lo
mismo y se entiende a la primera.

---

## Keywords (100, comma-separated, no spaces)

```
script,autocue,cue,speech,recorder,vlog,reels,shorts,creator,presentation,vertical,selfie,prompt
```

96 caracteres. Como en español, **no se repiten las palabras del nombre ni del
subtítulo** —`teleprompter`, `camera`, `subscription`, `watermark`—: Apple ya
indexa desde ahí y repetirlas serían 40 caracteres tirados.

Dos elecciones propias del inglés. `autocue` es como se llama esto en el Reino
Unido y en buena parte de la Commonwealth, y en Estados Unidos no lo busca nadie:
entra porque la ficha de English (U.S.) es la que ven todos los países
angloparlantes que no tengan la suya. Y `cue` suelto pesca *cue cards* y *cue
sheet*, que es como lo buscan los presentadores.

### Sobre `tiktok` y `youtube`

La lista española los lleva; esta no. Son marcas registradas, y Apple rechaza
metadatos por eso de vez en cuando. Es un rechazo barato —solo metadatos, no hace
falta subir un binario nuevo— pero te cuesta un par de días de revisión. En
inglés la competencia por esos términos es brutal y no ibas a rankear de todas
formas, así que el hueco rinde más con `vlog` y `creator`. Si la revisión
española pasa sin problema, puedes añadirlos aquí después.

---

## URLs

| Field             | Value                                      |
| ----------------- | ------------------------------------------ |
| Support URL       | La misma que en español                    |
| Marketing URL     | Opcional                                   |
| Privacy Policy URL| **Decide** — ver abajo                     |

La URL de privacidad es localizable y ahora mismo `store/privacidad.html` solo
existe en español. Tienes dos salidas: apuntar la ficha inglesa a la misma página
española, que es legal y está feo, o traducir el HTML y apuntar a
`/prompter/privacy`. Como el documento entero se resume en «esta app no recopila
nada», traducirlo es media hora.

---

## App Review Information

No se traduce: es interna, la lee el revisor de Apple y no aparece en la tienda.
Las notas de la sección 5 de `ficha-app-store.md` valen tal cual — de hecho, si
las escribes en inglés le ahorras trabajo al revisor, que rara vez habla español.

---

## Dos decisiones que esto deja sobre la mesa

### 1 · Qué ven los países que no son ni España ni angloparlantes

Con el español como idioma principal, alguien en Alemania, Brasil o Japón ve la
ficha **en español**, no en inglés: cuando no hay localización que encaje, Apple
cae al idioma principal, no al inglés.

Si el objetivo son España y Latinoamérica, esto está bien como está. Si el
objetivo es el mundo, lo correcto es al revés: **English (U.S.) como idioma
principal y el español como localización**. Se puede cambiar mientras la app esté
en estado editable, y es más fácil hacerlo ahora, antes de publicar, que después
—cambiar el idioma principal de una app viva da errores de «missing screenshots»
que traen de cabeza a mucha gente en los foros de Apple.

### 2 · La app sigue estando solo en español

Y esto es lo que de verdad importa. Un usuario inglés que se instale la app desde
esta ficha se encuentra la interfaz en español y, peor, **los diálogos de permiso
del sistema en español**: «Para grabarte mientras lees el guion.» Es el momento
más frágil de la app y lo va a leer sin entenderlo.

La buena noticia es que es poco trabajo. Lo que ve el usuario son unas veinticinco
cadenas —los títulos y etiquetas de `SettingsSheet`, las etiquetas de
accesibilidad de `ControlBar`, cuatro `Alert` de `useRecorder`, dos avisos de
`App.tsx` y el guion de ejemplo de `prompterSettings`— más las tres descripciones
de permisos del `infoPlist` de `app.json`. Todo lo demás en español son
comentarios del código, que no se traducen ni deben traducirse.

Publicar la ficha inglesa sin traducir la app se puede hacer, y no es motivo de
rechazo. Pero es la vía rápida a las reseñas de una estrella.
