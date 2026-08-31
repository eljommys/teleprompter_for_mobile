import AVFoundation
import ExpoModulesCore

/**
 * Funde dos tomas en un solo fichero: una de fondo y otra en un recuadro.
 *
 * VisionCamera sabe grabar de dos cámaras a la vez, pero entrega dos ficheros
 * sueltos; juntarlos no lo hace nadie por nosotros. Aquí se hace en un pase de
 * exportación, después de parar, y no fotograma a fotograma durante la toma:
 * componer en caliente exige Metal y sostener el ritmo de la cámara, y si se
 * atraganta se pierde la grabación entera en vez de solo el montaje.
 *
 * El montaje va por tramos porque durante la toma se puede cambiar de cámara y
 * mover el recuadro, y el vídeo tiene que enseñar esos cambios en el momento en
 * que se hicieron. Cada tramo trae quién manda y dónde está el recuadro.
 */
public class VideoComposerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VideoComposer")

    AsyncFunction("composePictureInPicture") { (options: ComposeOptions) async throws -> String in
      return try await Composer.compose(options)
    }

    // El montaje ya se ha copiado al Carrete cuando se llama a esto: lo que
    // queda en disco son tres vídeos de 1080p por toma que no vuelve a mirar
    // nadie. No falla si el fichero ya no está.
    AsyncFunction("deleteFile") { (path: String) in
      try? FileManager.default.removeItem(at: Composer.fileURL(path))
    }

  }
}

/** Un tramo de la toma, desde `start` hasta que empieza el siguiente. */
struct ComposeSegment: Record {
  /** Segundos desde que arrancó la grabación. */
  @Field var start: Double = 0
  /** ¿Manda la trasera en este tramo? Si no, es la frontal la que llena. */
  @Field var backIsBackground: Bool = true
  /** Esquina superior izquierda del recuadro, en fracción de pantalla. */
  @Field var x: Double = 0
  @Field var y: Double = 0
  /** Ancho del recuadro, en fracción del ancho de la pantalla. */
  @Field var width: Double = 0.3
}

struct ComposeOptions: Record {
  /** Ruta de la toma de la cámara trasera. */
  @Field var back: String = ""
  /** Ruta de la toma de la frontal. */
  @Field var front: String = ""
  /** Tramos, en orden. El primero tiene que empezar en 0. */
  @Field var segments: [ComposeSegment] = []
  /**
   * Proporción de la pantalla donde se colocó el recuadro (ancho / alto).
   *
   * Hace falta porque la vista previa va en `cover`: la pantalla del iPhone es
   * más estirada que el 9:16 que se graba, así que recorta el cuadro por los
   * lados y lo que se ve no es todo lo que se guarda. Sin esta cifra, colocar
   * el recuadro «a ojo» lo dejaría corrido y más grande en el fichero.
   */
  @Field var screenAspect: Double = 0
  /** Dónde escribir el resultado. */
  @Field var output: String = ""
}

private enum ComposerError: Error, LocalizedError {
  case missingVideoTrack(String)
  case cannotCreateTrack
  case noSegments
  case exportFailed(String)
  case noExportSession

  var errorDescription: String? {
    switch self {
    case .missingVideoTrack(let path): return "La toma no tiene pista de vídeo: \(path)"
    case .cannotCreateTrack: return "No se pudo crear la pista de la composición"
    case .noSegments: return "El montaje necesita al menos un tramo"
    case .exportFailed(let reason): return "No se pudo exportar el montaje: \(reason)"
    case .noExportSession: return "No se pudo crear la sesión de exportación"
    }
  }
}

/**
 * Proporción de las tomas de la app: vertical 9:16, la de grabar con una cámara.
 *
 * El montaje se ciñe a ella aunque los ficheros vengan con otra. Con las dos
 * cámaras el sistema puede negociar un formato más cuadrado —sensor completo—, y
 * sin esto el vídeo doble salía con una forma distinta a todo lo demás.
 */
private let SHOT_ASPECT: Double = 9.0 / 16.0

/** Redondea a par: los codificadores de vídeo no admiten lados impares. */
private func even(_ size: CGSize) -> CGSize {
  CGSize(
    width: (size.width / 2).rounded() * 2,
    height: (size.height / 2).rounded() * 2)
}

/** Una pista ya colocada en la composición, con lo que hace falta para pintarla. */
private struct Layer {
  let track: AVMutableCompositionTrack
  let transform: CGAffineTransform
  let size: CGSize
}

private enum Composer {
  static func compose(_ options: ComposeOptions) async throws -> String {
    guard let first = options.segments.first else { throw ComposerError.noSegments }

    let backAsset = AVURLAsset(url: fileURL(options.back))
    let frontAsset = AVURLAsset(url: fileURL(options.front))

    guard let backTrack = try await backAsset.loadTracks(withMediaType: .video).first
    else { throw ComposerError.missingVideoTrack(options.back) }
    guard let frontTrack = try await frontAsset.loadTracks(withMediaType: .video).first
    else { throw ComposerError.missingVideoTrack(options.front) }

    // Las dos grabadoras arrancan una detrás de otra, nunca a la vez, así que
    // una toma siempre acaba siendo algo más larga. Se corta por la más corta:
    // dejar correr la otra a solas terminaría con el recuadro congelado o en
    // negro durante ese rabito.
    let backDuration = try await backAsset.load(.duration)
    let frontDuration = try await frontAsset.load(.duration)
    let duration = min(backDuration, frontDuration)
    let range = CMTimeRange(start: .zero, duration: duration)

    let composition = AVMutableComposition()
    guard
      let backSlot = composition.addMutableTrack(
        withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
      let frontSlot = composition.addMutableTrack(
        withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
    else { throw ComposerError.cannotCreateTrack }

    try backSlot.insertTimeRange(range, of: backTrack, at: .zero)
    try frontSlot.insertTimeRange(range, of: frontTrack, at: .zero)

    // El sonido sale siempre de la toma de la trasera, sea quien sea el que
    // llene el cuadro: el micrófono es uno solo, y es la única de las dos que
    // se graba con audio.
    if let audioTrack = try await backAsset.loadTracks(withMediaType: .audio).first,
      let audioSlot = composition.addMutableTrack(
        withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
    {
      try audioSlot.insertTimeRange(range, of: audioTrack, at: .zero)
    }

    let backOriented = try await orient(track: backTrack)
    let frontOriented = try await orient(track: frontTrack)
    let back = Layer(track: backSlot, transform: backOriented.transform, size: backOriented.size)
    let front = Layer(
      track: frontSlot, transform: frontOriented.transform, size: frontOriented.size)

    /**
     * El lienzo va siempre en 9:16, la misma forma que sale grabando con una
     * sola cámara.
     *
     * No se hereda la del fichero porque en multicámara el sistema puede
     * negociar un formato de sensor completo, más cuadrado, y entonces el
     * montaje salía con otra proporción que el resto de tomas de la app. Se
     * conserva el alto entero —que es donde está la resolución— y se recorta
     * por los lados, así que no se reescala nada de más.
     *
     * Lo fija el primer tramo y no cambia aunque después se gire: un vídeo no
     * puede cambiar de tamaño a media reproducción.
     */
    let source = first.backIsBackground ? back.size : front.size
    let canvas = even(CGSize(width: source.height * SHOT_ASPECT, height: source.height))
    let visible = visibleFraction(canvas: canvas, screenAspect: options.screenAspect)

    var instructions: [AVMutableVideoCompositionInstruction] = []
    for (index, segment) in options.segments.enumerated() {
      let start = CMTime(seconds: max(0, segment.start), preferredTimescale: 600)
      let end =
        index + 1 < options.segments.count
        ? CMTime(seconds: max(0, options.segments[index + 1].start), preferredTimescale: 600)
        : duration
      // Un tramo que empieza después de que acabe la toma —girar justo al
      // parar— no pinta nada y solo daría un rango inválido.
      guard start < duration, end > start else { continue }

      let background = segment.backIsBackground ? back : front
      let overlay = segment.backIsBackground ? front : back

      let backgroundInstruction = AVMutableVideoCompositionLayerInstruction(
        assetTrack: background.track)
      backgroundInstruction.setTransform(fill(background, canvas: canvas), at: .zero)

      let placed = box(overlay, canvas: canvas, segment: segment, visible: visible)
      let overlayInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: overlay.track)

      // Si el tramo siguiente es el mismo encuadre moviéndose —no un cambio de
      // cámara—, se interpola de aquí a allí en vez de dar el salto. Es lo que
      // convierte los puntos que apunta el arrastre en un movimiento continuo:
      // el recuadro acompaña al dedo en el vídeo igual que lo hizo en pantalla.
      let following = index + 1 < options.segments.count ? options.segments[index + 1] : nil
      let ramp = following.flatMap { next -> ComposeSegment? in
        next.backIsBackground == segment.backIsBackground ? next : nil
      }

      if let ramp {
        let target = box(overlay, canvas: canvas, segment: ramp, visible: visible)
        let span = CMTimeRange(start: start, end: min(end, duration))
        overlayInstruction.setTransformRamp(
          fromStart: placed.transform, toEnd: target.transform, timeRange: span)
        // El recorte viaja con la transformación: si se quedara fijo, el hueco
        // no acompañaría a la imagen y el recuadro iría dejando recortes por el
        // camino.
        overlayInstruction.setCropRectangleRamp(
          fromStartCropRectangle: placed.crop, toEndCropRectangle: target.crop, timeRange: span)
      } else {
        overlayInstruction.setTransform(placed.transform, at: .zero)
        // Sin recorte, la toma del recuadro se saldría de su hueco y taparía el
        // fondo alrededor: se agranda hasta llenarlo —como la vista previa, que
        // va en `cover`— y lo que sobra hay que quitarlo.
        overlayInstruction.setCropRectangle(placed.crop, at: .zero)
      }

      let instruction = AVMutableVideoCompositionInstruction()
      instruction.timeRange = CMTimeRange(start: start, end: min(end, duration))
      // El primero de la lista es el que queda delante, así que el recuadro va
      // antes que el fondo aunque se dibuje encima.
      instruction.layerInstructions = [overlayInstruction, backgroundInstruction]
      instructions.append(instruction)
    }

    if instructions.isEmpty { throw ComposerError.noSegments }

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = canvas
    videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
    videoComposition.instructions = instructions

    let outputURL = fileURL(options.output)
    try? FileManager.default.removeItem(at: outputURL)

    // Fundir las dos tomas obliga a recodificar, así que aquí se pierde calidad
    // sí o sí; lo que se puede es perder la menos posible. HEVC saca más de
    // cada bit que H.264, y si este iPhone no lo trajera se cae al de siempre.
    let preferred = AVAssetExportPresetHEVCHighestQuality
    let presetName =
      AVAssetExportSession.allExportPresets().contains(preferred)
      ? preferred : AVAssetExportPresetHighestQuality

    guard let export = AVAssetExportSession(asset: composition, presetName: presetName)
    else { throw ComposerError.noExportSession }
    export.outputURL = outputURL
    export.outputFileType = .mp4
    export.videoComposition = videoComposition

    // `export(to:as:)` es de iOS 18 y aquí se despliega desde la 16.4, así que
    // va la forma de siempre envuelta a mano.
    await withCheckedContinuation { continuation in
      export.exportAsynchronously { continuation.resume() }
    }

    switch export.status {
    case .completed:
      return outputURL.path
    case .cancelled:
      throw ComposerError.exportFailed("cancelada")
    default:
      throw ComposerError.exportFailed(export.error?.localizedDescription ?? "desconocido")
    }
  }

  /** La toma que llena el cuadro, estirada si hiciera falta para cubrirlo. */
  private static func fill(_ layer: Layer, canvas: CGSize) -> CGAffineTransform {
    guard layer.size.width > 0, layer.size.height > 0 else { return layer.transform }
    let scale = max(canvas.width / layer.size.width, canvas.height / layer.size.height)
    // Centrada: si sobra por algún lado, que sobre por igual a los dos.
    let dx = (canvas.width - layer.size.width * scale) / 2
    let dy = (canvas.height - layer.size.height * scale) / 2
    return
      layer.transform
      .concatenating(CGAffineTransform(scaleX: scale, y: scale))
      .concatenating(CGAffineTransform(translationX: dx, y: dy))
  }

  /**
   * La toma del recuadro, a su tamaño y en su sitio.
   *
   * Devuelve además el rectángulo al que hay que recortarla. El recuadro tiene
   * la forma de la app (9:16) pase lo que pase, así que la toma se agranda hasta
   * llenarlo y se corta lo que sobresale: es lo mismo que hace la vista previa
   * con `cover`, y lo que evita que el recuadro salga con una forma en pantalla
   * y otra en el fichero.
   */
  private static func box(
    _ layer: Layer, canvas: CGSize, segment: ComposeSegment,
    visible: (width: Double, height: Double)
  ) -> (transform: CGAffineTransform, crop: CGRect) {
    // De coordenadas de pantalla a coordenadas de lienzo. La vista previa va en
    // `cover`, o sea que de la toma solo se ve la parte central que cabe en la
    // pantalla; el resto está grabándose fuera de plano. Se traduce la fracción
    // vista a la fracción real y así el recuadro cae en el fichero justo donde
    // se dejó con el dedo.
    let width = segment.width * visible.width
    let x = (1 - visible.width) / 2 + segment.x * visible.width
    let y = (1 - visible.height) / 2 + segment.y * visible.height

    // El hueco tiene la forma de la app, no la del sensor.
    let size = CGSize(width: canvas.width * width, height: canvas.width * width / SHOT_ASPECT)

    // Se vuelve a encajar dentro del lienzo aunque venga de fuera bien puesto:
    // la posición se guardó con un recuadro de otro tamaño, y basta con
    // agrandarlo después para que lo que cabía deje de caber. En pantalla el
    // arrastre ya lo frena, pero aquí es donde se decide lo que queda grabado.
    let position = CGPoint(
      x: min(max(0, canvas.width * x), max(0, canvas.width - size.width)),
      y: min(max(0, canvas.height * y), max(0, canvas.height - size.height)))

    guard layer.size.width > 0, layer.size.height > 0 else {
      return (layer.transform, CGRect(origin: position, size: size))
    }

    // Se agranda hasta llenar el hueco por los dos lados y lo que sobra se
    // reparte a partes iguales, que es lo que hace `cover`.
    let scale = max(size.width / layer.size.width, size.height / layer.size.height)
    let dx = position.x + (size.width - layer.size.width * scale) / 2
    let dy = position.y + (size.height - layer.size.height * scale) / 2

    let transform =
      layer.transform
      .concatenating(CGAffineTransform(scaleX: scale, y: scale))
      .concatenating(CGAffineTransform(translationX: dx, y: dy))

    // El recorte se mide sobre el fotograma de origen, no sobre el lienzo, así
    // que el hueco se lleva hacia atrás deshaciendo la transformación. Como
    // aquí solo hay giros de noventa grados, escalas y traslaciones, un
    // rectángulo sigue siendo un rectángulo y la cuenta es exacta.
    let crop = CGRect(origin: position, size: size).applying(transform.inverted())

    return (transform, crop)
  }

  /**
   * Qué parte del lienzo se ve en la pantalla, en fracciones de 0 a 1.
   *
   * Con `cover` la toma se agranda hasta cubrir la pantalla y sobra por un
   * lado: en un iPhone, que es más estirado que el 9:16 grabado, sobra por los
   * lados y solo se ve el 82% del ancho. Sin proporción de pantalla que valga
   * —o si coincide con la del vídeo— se ve entero y esto devuelve 1 y 1.
   */
  private static func visibleFraction(canvas: CGSize, screenAspect: Double) -> (
    width: Double, height: Double
  ) {
    guard screenAspect > 0, canvas.height > 0 else { return (1, 1) }
    let canvasAspect = canvas.width / canvas.height
    return (
      width: min(1, screenAspect / canvasAspect),
      height: min(1, canvasAspect / screenAspect)
    )
  }

  /**
   * Deja la pista derecha y dice cuánto ocupa ya girada.
   *
   * Una toma en vertical se guarda con los píxeles tumbados y una rotación
   * aparte, así que su `naturalSize` miente: sin esto, el recuadro saldría
   * girado noventa grados y el lienzo con la forma cambiada. La traslación
   * extra recoloca el resultado en el origen, porque al girar sobre el (0,0)
   * la imagen se va a coordenadas negativas y se quedaría fuera de plano.
   */
  private static func orient(track: AVAssetTrack) async throws -> (
    transform: CGAffineTransform, size: CGSize
  ) {
    let naturalSize = try await track.load(.naturalSize)
    let preferred = try await track.load(.preferredTransform)
    let bounds = CGRect(origin: .zero, size: naturalSize).applying(preferred)
    let transform = preferred.concatenating(
      CGAffineTransform(translationX: -bounds.minX, y: -bounds.minY))
    return (transform, CGSize(width: abs(bounds.width), height: abs(bounds.height)))
  }

  static func fileURL(_ path: String) -> URL {
    if path.hasPrefix("file://") { return URL(string: path) ?? URL(fileURLWithPath: path) }
    return URL(fileURLWithPath: path)
  }
}
