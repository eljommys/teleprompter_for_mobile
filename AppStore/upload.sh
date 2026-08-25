#!/bin/bash
# Archiva, exporta y sube la compilación a App Store Connect.
#
# El registro de la app ya tiene que existir en App Store Connect: la API de
# Apple no sabe crearlo, así que ese primer paso es manual y se hace una vez.
#
# Uso:
#   ASC_KEY_ID=<key-id> ASC_ISSUER_ID=<issuer-uuid> ./AppStore/upload.sh [--validate-only]
#
# Los dos salen de App Store Connect › Usuarios y acceso › Integraciones ›
# Claves: el identificador es la fila, y el del emisor está encima de la tabla y
# tiene pinta de 69a6de70-…. La clave .p8 se espera donde la buscan las
# herramientas de Apple, en ~/.appstoreconnect/private_keys/AuthKey_<key-id>.p8.
# Si la tuya vive en otro sitio, apunta ASC_KEY_FILE a ella y este script instala
# una copia ahí.
#
# A diferencia del de app_limiter, aquí se archiva el **workspace** que genera
# CocoaPods y no un .xcodeproj suelto: es un proyecto de Expo, y el esquema vive
# en el workspace junto con los pods.

set -euo pipefail

# La clave y el emisor son tuyos: se pasan por entorno para no dejarlos en el repo.
KEY_ID="${ASC_KEY_ID:?falta ASC_KEY_ID, el identificador de tu clave de App Store Connect}"
KEY_DIR="$HOME/.appstoreconnect/private_keys"
INSTALLED_KEY="$KEY_DIR/AuthKey_${KEY_ID}.p8"
KEY_FILE="${ASC_KEY_FILE:-$INSTALLED_KEY}"
SCHEME="Prompter"
WORKSPACE="ios/Prompter.xcworkspace"
ARCHIVE="build/Prompter.xcarchive"
EXPORT_DIR="build/export"
TEAM_ID="25G3Q8388L"

cd "$(dirname "$0")/.."

if [[ -z "${ASC_ISSUER_ID:-}" ]]; then
    echo "error: define antes ASC_ISSUER_ID. Está en App Store Connect ›" >&2
    echo "       Usuarios y acceso › Integraciones › Claves, encima de la tabla." >&2
    exit 1
fi

if [[ ! -f "$KEY_FILE" ]]; then
    echo "error: no está la clave de la API en $KEY_FILE" >&2
    echo "       Déjala ahí como AuthKey_${KEY_ID}.p8, o apunta ASC_KEY_FILE a" >&2
    echo "       donde la tengas." >&2
    exit 1
fi

# altool y Xcode buscan las claves por nombre en unos pocos directorios, no en
# rutas cualesquiera, así que una clave guardada en otro sitio se instala en el
# canónico.
mkdir -p "$KEY_DIR"
if [[ "$KEY_FILE" != "$INSTALLED_KEY" ]]; then
    cp -n "$KEY_FILE" "$INSTALLED_KEY"
fi
# Es una clave privada: que no la lea el resto de la máquina.
chmod 600 "$INSTALLED_KEY"

if [[ ! -d "$WORKSPACE" ]]; then
    echo "error: no está $WORKSPACE. Genera el proyecto nativo antes:" >&2
    echo "       npx expo prebuild --platform ios && (cd ios && pod install)" >&2
    exit 1
fi

# Con esto, xcodebuild puede crear el certificado y el perfil de distribución
# por su cuenta usando la misma clave de la API, sin depender de que la cuenta
# esté añadida en Xcode.
AUTH=(
    -allowProvisioningUpdates
    -authenticationKeyPath "$INSTALLED_KEY"
    -authenticationKeyID "$KEY_ID"
    -authenticationKeyIssuerID "$ASC_ISSUER_ID"
)

echo "==> Archivando"
rm -rf "$ARCHIVE"
xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE" \
    "${AUTH[@]}" \
    archive

echo "==> Exportando para App Store"
rm -rf "$EXPORT_DIR"
cat > /tmp/asc_export_options.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>teamID</key>
	<string>${TEAM_ID}</string>
	<key>uploadSymbols</key>
	<true/>
</dict>
</plist>
PLIST

xcodebuild -exportArchive \
    -archivePath "$ARCHIVE" \
    -exportPath "$EXPORT_DIR" \
    -exportOptionsPlist /tmp/asc_export_options.plist \
    "${AUTH[@]}"

# El .ipa toma el nombre del producto, que no tiene por qué ser el del esquema.
IPA="$(find "$EXPORT_DIR" -maxdepth 1 -name '*.ipa' | head -1)"
if [[ -z "$IPA" ]]; then
    echo "error: la exportación no dejó ningún .ipa en $EXPORT_DIR" >&2
    exit 1
fi
echo "==> Exportado $IPA"

echo "==> Validando"
xcrun altool --validate-app \
    --type ios \
    --file "$IPA" \
    --apiKey "$KEY_ID" \
    --apiIssuer "$ASC_ISSUER_ID"

if [[ "${1:-}" == "--validate-only" ]]; then
    echo "==> Validación correcta. Paro antes de subir, como se ha pedido."
    exit 0
fi

echo "==> Subiendo a App Store Connect"
xcrun altool --upload-app \
    --type ios \
    --file "$IPA" \
    --apiKey "$KEY_ID" \
    --apiIssuer "$ASC_ISSUER_ID"

echo "==> Listo. La compilación tarda de 10 a 30 minutos en terminar de"
echo "    procesarse antes de poder adjuntarla a una versión o mandarla a"
echo "    TestFlight."
