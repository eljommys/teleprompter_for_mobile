# Ficha de App Store · Prompter

Todo lo que App Store Connect pide para publicar, formulario a formulario y en el
orden en que te lo va a pedir. Los textos están listos para copiar y pegar; el
límite de caracteres de Apple va anotado y todos caben.

Los campos marcados **[bloquea]** impiden enviar a revisión mientras estén vacíos.

---

## 1 · App Information

Barra lateral → *General* → *App Information*. Es lo que no cambia entre
versiones.

| Campo                        | Valor                                       |
| ---------------------------- | ------------------------------------------- |
| Name (30)                    | `Teleprompter y Cámara` — 21                |
| Subtitle (30)                | `Sin cuota ni marca de agua` — 26           |
| Bundle ID                    | `com.rackslabs.prompter`                    |
| ID de App Store              | `6799003999`                                |
| SKU                          | `PROMPTER-IOS-001`                          |
| Primary Language             | Español (España)                            |
| App Store Localizations      | English (U.S.) — ver `ficha-app-store-en.md`|
| Primary Category             | Fotografía y vídeo                          |
| Secondary Category           | Productividad                               |
| Content Rights               | No contiene contenido de terceros           |
| License Agreement            | La estándar de Apple (no toques nada)       |

**Ojo con el Name.** Al crear el registro, `eas submit` lo rellena solo con lo
que encuentra en el proyecto, así que ahora mismo lo más probable es que ponga
`Prompter` o directamente `teleprompter_for_mobile`. Se cambia aquí, y **solo se
puede cambiar mientras la app no esté publicada** — después hace falta enviar una
versión nueva. Cámbialo antes que nada.

El nombre de la tienda no tiene por qué coincidir con el de la pantalla de
inicio, y conviene que no coincida: bajo el icono caben unos doce caracteres
antes de que iOS recorte, así que ahí se queda **Prompter** (el campo `name` de
`app.json`). En la tienda manda la búsqueda, y `Teleprompter y Cámara` son las
dos palabras por las que te van a buscar.

### Clasificación por edades

*Age Rating* → *Edit*. Es un cuestionario largo con una sola respuesta útil:
**ninguna categoría aplica**. Violencia, contenido sexual, lenguaje, sustancias,
juego, simulaciones de apuestas, sustos: todo a *None* / *No*.

Las tres que la gente falla:

- **User-generated content** → **No**. El usuario escribe su guion, sí, pero no
  se comparte con nadie ni sale del teléfono. No es contenido generado en el
  sentido de Apple, que se refiere a contenido publicado y visible para otros.
- **Unrestricted web access** → **No**. La app no lleva navegador ni carga URLs.
- **Age Assurance / controles de edad** → nada.

Resultado: **4+**.

---

## 2 · Pricing and Availability

| Campo             | Valor                                     |
| ----------------- | ----------------------------------------- |
| Price             | Gratis (Free)                             |
| Availability      | Todos los territorios                     |
| Pre-Order         | No                                        |
| Distribución      | App Store pública                         |

Sin compras dentro de la app y sin suscripción, así que no hay que rellenar nada
más ni te pedirán los datos fiscales de la sección de pagos.

---

## 3 · App Privacy **[bloquea]**

Barra lateral → *App Privacy*.

**«¿Recopilas datos de esta app?» → No.**

Se puede sostener sin letra pequeña: la app no hace ninguna petición de red, no
lleva SDK de analítica ni de publicidad y no envía informes de fallos. Los vídeos
van a la fototeca del propio usuario, y eso no cuenta como recopilación porque el
dato nunca sale del dispositivo ni te llega a ti.

Con esa respuesta la ficha muestra **«No se recopilan datos»**, que es la
etiqueta más limpia que da Apple y un argumento de venta en sí misma.

**Privacy Policy URL [bloquea]** — aquí mismo. Obligatoria aunque no recojas
nada:

```
https://eljommys.github.io/teleprompter_for_mobile/privacidad.html
```

La sirve GitHub Pages desde `docs/` del propio repositorio. Ver `docs/LEEME.md`.

---

## 4 · Información de la versión 1.0

Barra lateral → *iOS App* → *1.0 Prepare for Submission*. Esto sí cambia en cada
versión.

### Texto promocional (170)

> Cambia entre la cámara frontal y la trasera sin cortar la grabación. Un solo
> vídeo, sin saltos. Y el guion delante todo el rato, a la velocidad que tú
> marques.

Este campo se puede cambiar sin pasar por revisión. Guárdatelo para novedades.

### Descripción (4000) **[bloquea]**

> Graba a cámara leyendo tu guion, sin montar nada después.
>
> Prompter pone el teleprompter encima de la cámara de tu iPhone. Pegas el texto,
> le das a grabar y lees. Sin trípode con cristal, sin un iPad de segundo
> aparato, sin Wi-Fi de por medio.
>
> CAMBIA DE CÁMARA SIN CORTAR LA TOMA
> Empieza con la trasera, pásate a la frontal a mitad de frase y vuelve. La
> grabación no se parte: sale un único vídeo con el audio continuo de principio a
> fin. Se acabó grabar dos veces y pegarlo después.
>
> EL GUION A TU RITMO
> Arrástralo con el dedo para colocarlo donde quieras. Tócalo una vez y avanza
> solo; tócalo otra y para. La velocidad, el tamaño de letra y el interlineado se
> ajustan mientras grabas, y una línea marca por dónde vas leyendo.
>
> ZOOM DE VERDAD
> En la cámara trasera, los botones saltan entre las lentes reales de tu iPhone
> —gran angular, principal, teleobjetivo—, no es un recorte digital. Un
> deslizador te lleva a cualquier punto intermedio. En la frontal, aumento
> digital con el mismo control.
>
> VERTICAL, LISTO PARA PUBLICAR
> Graba en 9:16 a 1080p. Al parar, la toma va directa a tu Carrete y la editas
> donde ya editas.
>
> TUYO Y DE NADIE MÁS
> Sin cuenta, sin suscripción, sin anuncios y sin marca de agua. Prompter no se
> conecta a internet: funciona igual en modo avión. Tu guion y tus vídeos no
> salen del teléfono.
>
> Hecho para quien graba a cámara a menudo: vídeos para redes, formación,
> presentaciones, mensajes de venta.

Dos cosas sobre el formato. La App Store solo enseña **las tres primeras líneas**
antes del «más», así que el gancho está arriba del todo y a propósito. Y los
títulos van en mayúsculas porque la descripción **no admite negrita ni Markdown**:
los asteriscos saldrían tal cual.

### Palabras clave (100, separadas por comas y sin espacios) **[bloquea]**

```
guion,grabar,video,reels,shorts,tiktok,youtube,creador,texto,apuntador,vertical,prompter,discurso
```

97 caracteres. **No aparecen «teleprompter» ni «cámara» a propósito**: ya están en
el nombre, Apple indexa desde ahí, y repetirlas aquí sería tirar 20 caracteres.
Lo mismo con «cuota», «marca» y «agua», que van en el subtítulo. Los espacios
después de la coma también cuentan, por eso no los hay.

Un riesgo asumido: `tiktok` y `youtube` son marcas registradas y Apple rechaza
metadatos por eso de vez en cuando. Es el rechazo más barato que hay —solo
metadatos, no hace falta binario nuevo— pero te cuesta un par de días. Si te lo
sacan, quítalas y reenvía; el hueco lo llenan bien `redes` y `presentación`.
La lista inglesa no las lleva, y ahí el motivo es otro: no ibas a rankear.

### URLs

| Campo          | Valor                                                     |
| -------------- | --------------------------------------------------------- |
| Support URL    | `https://eljommys.github.io/teleprompter_for_mobile/`      |
| Marketing URL  | Opcional, puedes dejarlo vacío                             |

La de soporte tiene que responder cuando el revisor la abra: un enlace roto es
motivo de rechazo por la directriz 1.5. La página está en `docs/index.html` y
lleva contacto, requisitos y las preguntas frecuentes.

### Copyright

```
2026 Racks Labs
```

Año y titular, sin el símbolo © (lo pone Apple). Si facturas a tu nombre y no con
marca, pon tu nombre legal.

### Otros campos de la versión

| Campo                        | Valor                                          |
| ---------------------------- | ---------------------------------------------- |
| Version                      | `1.0`                                          |
| Build **[bloquea]**          | La 1.0.0 (5), ya subida y procesada             |
| Routing App Coverage File    | Vacío (no es una app de mapas)                 |
| Sign-In Required             | **No** — no hay cuenta                          |
| Advertising Identifier (IDFA)| **No** — no se usa                              |
| Content Rights               | No contiene contenido de terceros              |

### Opciones de publicación

**Manually release this version.** Con lanzamiento automático la app sale sola en
cuanto la aprueban, que suele ser de madrugada y sin avisar. Manual te deja
elegir el día y tener la web y las redes listas.

El *phased release* de siete días es para actualizaciones. En un 1.0 da igual.

---

## 5 · App Review Information **[bloquea]**

Al final de la misma pantalla.

| Campo               | Valor                    |
| ------------------- | ------------------------ |
| First / Last Name   | Tu nombre                |
| Phone Number        | Tu móvil con +34         |
| Email               | `jaime@rackslabs.com`    |
| Sign-in required    | No                       |
| Attachment          | Ninguno                  |

### Notes

> La app no necesita cuenta ni datos de acceso.
>
> Para probarla hace falta un dispositivo físico: usa la cámara y el micrófono, y
> el simulador no tiene ninguna de las dos cosas.
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

Esas notas son lo que evita el rechazo más habitual en apps de cámara: el
revisor abre el simulador, ve negro y lo da por roto (directriz 2.1).

---

## 6 · Cumplimiento de exportación

Ya está resuelto en el binario: `app.json` lleva
`ITSAppUsesNonExemptEncryption: false` en el `infoPlist`, así que App Store
Connect no vuelve a preguntar en cada subida. Es cierto además: la app no cifra
nada porque no manda nada a ninguna parte.

---

## 7 · Capturas **[bloquea]**

Apple pide como mínimo el juego de **6,9 pulgadas** (1290 × 2796 o 1320 × 2868),
y con ese cubre el resto de tamaños de iPhone. Mínimo una, hasta diez.

Guion sugerido, tres y una opcional:

1. **Grabando con el guion en pantalla** — es la app entera en una imagen.
   Rótulo: «El guion, encima de la cámara».
2. **Los controles de zoom con las lentes** — enseña el 0,5× / 1× / 5×.
   Rótulo: «Cambia de lente sin parar de grabar».
3. **La hoja de ajustes con un guion pegado** — enseña que es configurable.
   Rótulo: «Tu texto, tu tamaño, tu velocidad».
4. _(opcional)_ **Vídeo de previsualización** de 15-30 s grabado con la propia
   app, girando de cámara dos veces. Para esta app vale más que las tres
   capturas juntas: el cambio de cámara sin cortar cuesta más de contar que de
   enseñar.

Cómo sacarlas, en `store/capturas.md`. Tienen que salir del iPhone: en el
simulador no hay cámara y saldrían con el fondo negro, que es justo lo que se
vende.

---

## 8 · TestFlight

Pestaña *TestFlight*. La build ya está arriba; esto es para abrir las pruebas
externas.

**Beta App Description**

> Teleprompter y cámara en la misma pantalla del iPhone. Pega tu guion, dale a
> grabar y lee. Puedes girar entre la cámara frontal y la trasera sin que se
> corte la grabación.

**Feedback Email**: `jaime@rackslabs.com`

**What to Test**

> Céntrate en el cambio de cámara en caliente: empieza a grabar, pulsa el botón
> de girar varias veces y comprueba que el vídeo del Carrete sale de una pieza y
> con el audio continuo.
>
> Lo otro que interesa es el zoom en la cámara trasera: los botones de lente
> tienen que saltar a las lentes reales de tu modelo de iPhone. Si notas que el
> 1× o el 5× no cuadran con la cámara del sistema, dilo con el modelo exacto.
>
> Y la lectura: velocidad, tamaño de letra e interlineado, a ver si el rango que
> hay se te queda corto por algún lado.

Para el grupo externo (hasta 10.000 personas, enlace público) hace falta una
revisión de Apple, más laxa que la de la Store y normalmente de menos de 24 h.
Copia ahí también las notas del revisor de la sección 5, por el mismo motivo.

Cada build de TestFlight **caduca a los 90 días**.

---

## Lo que falta para poder enviar

Cinco cosas, y solo dos dependen de escribir algo:

1. **Support URL** — hecha, solo falta activar GitHub Pages (`docs/LEEME.md`).
2. **Privacy Policy URL** — la misma activación, misma carpeta.
3. **Capturas** — del iPhone, no del simulador.
4. **El Name en App Store Connect** — casi seguro está con el autogenerado.
5. **El icono** — decidir cuál y regenerar los tamaños.

Todo lo demás de este documento es copiar y pegar.

La ficha en inglés (`ficha-app-store-en.md`) no bloquea nada: se puede añadir
antes de enviar o en cualquier versión posterior. Pero si la vas a poner, ponla
**antes** de publicar, porque trae con ella una decisión que después cuesta mucho
más deshacer: cuál de los dos idiomas es el principal.
