# docs/ · el sitio público de Prompter

Esta carpeta es lo que GitHub Pages publica. Existe por una razón concreta: App
Store Connect exige una **URL de privacidad** y una **URL de soporte**, las dos
tienen que responder cuando el revisor las abra, y un enlace roto es rechazo por
la directriz 1.5.

| Fichero          | URL pública                                                        | Campo de App Store Connect |
| ---------------- | ------------------------------------------------------------------ | -------------------------- |
| `index.html`     | `https://eljommys.github.io/teleprompter_for_mobile/`                | Support URL                |
| `privacidad.html`| `https://eljommys.github.io/teleprompter_for_mobile/privacidad.html` | Privacy Policy URL         |

La política vive aquí y no en `store/` a propósito: `store/` es documentación
para ti, y esto lo lee un desconocido. Tenerla en dos sitios acabaría con dos
versiones distintas de lo que la app promete sobre datos personales, que es
justo el documento que no puede llevar dos versiones.

## Activar Pages (una sola vez)

```bash
gh api -X POST repos/eljommys/teleprompter_for_mobile/pages \
  -f "source[branch]=main" -f "source[path]=/docs"
```

El primer despliegue tarda un par de minutos. Se comprueba con:

```bash
curl -sI https://eljommys.github.io/teleprompter_for_mobile/privacidad.html | head -1
```

Un `HTTP/2 200` y listo. Mientras salga `404`, aún está desplegando.

## Lo que puede tumbarte la ficha

**El repositorio tiene que seguir siendo público.** GitHub Pages en repos
privados necesita una cuenta de pago. Si algún día lo cierras, estas dos URLs
mueren y con ellas la ficha de la App Store.

**Las páginas están solo en español.** Si añades la localización inglesa
(`store/ficha-app-store-en.md`), la URL de privacidad también es localizable y
haría falta traducirlas.

## Cambios

Se publica solo con cada `push` a `main`. Si tocas la política, actualiza a mano
la fecha de «Última actualización» de `privacidad.html`: es la única parte que no
se entera sola.
