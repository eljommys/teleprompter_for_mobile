# Ficha de App Store · Prompter

Todo listo para copiar y pegar en App Store Connect. Los límites de caracteres de
Apple van anotados junto a cada campo, y todos los textos caben.

---

## Identidad

| Campo                | Valor                                                    |
| -------------------- | -------------------------------------------------------- |
| Nombre (30)          | `Teleprompter y Cámara` — 21                              |
| Subtítulo (30)       | `Sin cuota ni marca de agua` — 26                         |
| Bundle ID            | `com.rackslabs.prompter`                                  |
| ID de App Store      | `6799003999`                                              |
| SKU                  | `PROMPTER-IOS-001`                                        |
| Idioma principal     | Español (España)                                          |
| Categoría principal  | Fotografía y vídeo                                        |
| Categoría secundaria | Productividad                                             |
| Precio               | Gratis                                                    |
| Clasificación        | 4+                                                        |

El nombre se cambia en App Store Connect → App Information → Name, y es editable
mientras la app no esté publicada.

En la pantalla de inicio del iPhone la app se sigue llamando **Prompter** (el
campo `name` de `app.json`). No tiene por qué coincidir con el de la tienda, y de
hecho conviene que no: bajo el icono solo caben unos doce caracteres antes de que
iOS lo recorte.

---

## Texto promocional (170)

> Cambia entre la cámara frontal y la trasera sin cortar la grabación. Un solo
> vídeo, sin saltos. Y el guion delante todo el rato, a la velocidad que tú
> marques.

Este campo se puede cambiar sin pasar por revisión. Úsalo para novedades.

---

## Descripción (4000)

> Graba a cámara leyendo tu guion, sin montar nada.
>
> Prompter pone el teleprompter encima de la cámara de tu iPhone. Pegas el texto,
> le das a grabar y lees. Sin trípode con cristal, sin un iPad de segundo
> aparato, sin Wi-Fi de por medio.
>
> **Cambia de cámara sin cortar la toma**
> Empieza con la trasera, pásate a la frontal a mitad de frase y vuelve. La
> grabación no se parte: sale un único vídeo con el audio continuo de principio a
> fin. Se acabó grabar dos veces y pegarlo después.
>
> **El guion a tu ritmo**
> Arrástralo con el dedo para colocarlo donde quieras. Tócalo una vez y avanza
> solo; tócalo otra y para. La velocidad, el tamaño de letra y el interlineado se
> ajustan mientras grabas, y una línea marca por dónde vas leyendo.
>
> **Zoom de verdad**
> En la cámara trasera, los botones saltan entre las lentes reales de tu iPhone
> —gran angular, principal, teleobjetivo—, no es un recorte digital. Un
> deslizador te lleva a cualquier punto intermedio. En la frontal, aumento
> digital con el mismo control.
>
> **Vertical, listo para publicar**
> Graba en 9:16 a 1080p. Al parar, la toma va directa a tu Carrete y la editas
> donde ya editas.
>
> **Tuyo y de nadie más**
> Sin cuenta, sin suscripción, sin anuncios y sin marca de agua. Prompter no se
> conecta a internet: funciona igual en modo avión. Tu guion y tus vídeos no
> salen del teléfono.
>
> Hecho para quien graba a cámara a menudo: vídeos para redes, formación,
> presentaciones, mensajes de venta.

---

## Palabras clave (100, separadas por comas y sin espacios)

```
guion,grabar,video,reels,shorts,tiktok,youtube,creador,texto,apuntador,vertical,prompter,discurso
```

97 caracteres. **No aparecen «teleprompter» ni «cámara» a propósito**: ya están en
el nombre, Apple los indexa desde ahí, y repetirlos aquí sería tirar 20
caracteres. Lo mismo con «cuota», «marca» y «agua», que van en el subtítulo.

---

## URLs

| Campo             | Valor                                                    |
| ----------------- | -------------------------------------------------------- |
| URL de soporte    | _(pendiente — ver nota abajo)_                            |
| URL de privacidad | _(pendiente — ver nota abajo)_                            |
| URL de marketing  | Opcional, se puede dejar vacío                            |

Las dos primeras son **obligatorias** y tienen que responder en el momento de la
revisión. `store/privacidad.html` está listo para subir tal cual a tu dominio;
por ejemplo `https://rackslabs.com/prompter/privacidad`. La de soporte puede ser
una página simple con el correo de contacto, o incluso el repositorio si lo haces
público.

---

## Privacidad (App Privacy)

En App Store Connect → App Privacy, responde:

**«¿Recopilas datos de esta app?» → No.**

Es la respuesta correcta y se puede sostener: la app no hace ninguna petición de
red, no incorpora SDK de analítica ni de publicidad y no envía informes de
fallos. Los vídeos se guardan en la fototeca del propio usuario, y eso no cuenta
como recopilación porque el dato nunca sale del dispositivo ni llega a ti.

Con esa respuesta, la ficha muestra «No se recopilan datos», que es la etiqueta
más limpia que da Apple.

---

## Notas para el revisor

> La app no necesita cuenta ni datos de acceso.
>
> Para probarla hace falta un dispositivo físico: usa la cámara y el micrófono,
> y el simulador no tiene ninguna de las dos cosas.
>
> Cómo probar la función principal:
> 1. Abrir la app y aceptar los permisos de cámara, micrófono y añadir a Fotos.
> 2. Pulsar el botón rojo para empezar a grabar.
> 3. Pulsar el botón de girar (abajo a la derecha) dos o tres veces durante la
>    grabación. La grabación no se interrumpe.
> 4. Pulsar de nuevo el botón rojo. El vídeo aparece en el Carrete como un único
>    archivo continuo.
>
> El texto del guion se edita con el botón de menú (abajo a la izquierda).

---

## Capturas

Apple pide, como mínimo, el juego de **6,9 pulgadas** (1290 × 2796 o 1320 × 2868).
Con ese juego cubre el resto de tamaños de iPhone.

Guion sugerido, tres capturas y una opcional:

1. **Grabando con el guion en pantalla** — es la app entera en una imagen.
   Rótulo: «El guion, encima de la cámara».
2. **Los controles de zoom con las lentes** — enseña el 0,5× / 1× / 5×.
   Rótulo: «Cambia de lente sin parar de grabar».
3. **La hoja de ajustes con un guion pegado** — enseña que es configurable.
   Rótulo: «Tu texto, tu tamaño, tu velocidad».
4. _(opcional)_ **Un vídeo de previsualización de la App Store** de 15-30 s
   grabado con la propia app girando de cámara. Es lo que mejor vende esta
   función, porque contarla cuesta más que verla.

Ver `store/capturas.md` para cómo sacarlas.
