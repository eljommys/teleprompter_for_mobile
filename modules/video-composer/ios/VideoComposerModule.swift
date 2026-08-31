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
  /** Proporción alto/ancho: 16/9 vertical, 1 cuadrado. */
  @Field var aspect: Double = 16.0 / 9.0
  /** Redondeo, en fracción del lado corto. Al 1, círculo o cápsula. */
  @Field var radius: Double = 0
  /** Sombra bajo el recuadro. */
  @Field var shadow: Double = 0
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

    // Una sola instrucción para toda la toma: el compositor calcula la
    // geometría de cada fotograma a partir de los tramos, en vez de repartirla
    // en capas y rampas. Es lo que permite redondear y sombrear el recuadro,
    // que el compositor de serie no sabe hacer.
    let instruction = PipInstruction(
      timeRange: range,
      backTrackID: backSlot.trackID,
      frontTrackID: frontSlot.trackID,
      backTransform: back.transform,
      frontTransform: front.transform,
      segments: options.segments,
      screenAspect: options.screenAspect)

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = canvas
    videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
    videoComposition.customVideoCompositorClass = PipCompositor.self
    videoComposition.instructions = [instruction]

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
