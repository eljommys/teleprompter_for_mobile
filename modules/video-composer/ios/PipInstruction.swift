import AVFoundation

/** El encuadre en un instante concreto, ya interpolado. */
struct PipShot {
  let backIsBackground: Bool
  let x: Double
  let y: Double
  let width: Double
  let aspect: Double
  let radius: Double
  let shadow: Double
  let screenAspect: Double
}

/**
 * Lo que el compositor necesita saber para pintar cualquier fotograma.
 *
 * Lleva los tramos enteros en vez de una geometría fija porque durante la toma
 * se gira de cámara y se arrastra el recuadro, y cada fotograma cae en un punto
 * distinto de ese recorrido.
 */
// `@unchecked` porque el protocolo pide Sendable y `[NSValue]?` no lo es: todo
// lo de dentro se fija en el init y no se vuelve a tocar, así que compartirlo
// entre hilos es seguro aunque el compilador no pueda demostrarlo.
final class PipInstruction: NSObject, AVVideoCompositionInstructionProtocol, @unchecked Sendable {
  let timeRange: CMTimeRange
  let enablePostProcessing = false
  /// El encuadre cambia dentro del propio tramo, así que hay que interpolar.
  let containsTweening = true
  let requiredSourceTrackIDs: [NSValue]?
  let passthroughTrackID: CMPersistentTrackID = kCMPersistentTrackID_Invalid

  let backTrackID: CMPersistentTrackID
  let frontTrackID: CMPersistentTrackID
  /**
   * Cómo enderezar cada toma.
   *
   * Al compositor le llegan los fotogramas **crudos**, tumbados y sin la
   * rotación aplicada: eso lo hacía antes la capa de AVFoundation por nosotros.
   * Sin esto, el vídeo saldría girado noventa grados.
   */
  let backTransform: CGAffineTransform
  let frontTransform: CGAffineTransform
  private let segments: [ComposeSegment]
  private let screenAspect: Double

  init(
    timeRange: CMTimeRange,
    backTrackID: CMPersistentTrackID,
    frontTrackID: CMPersistentTrackID,
    backTransform: CGAffineTransform,
    frontTransform: CGAffineTransform,
    segments: [ComposeSegment],
    screenAspect: Double
  ) {
    self.timeRange = timeRange
    self.backTrackID = backTrackID
    self.frontTrackID = frontTrackID
    self.backTransform = backTransform
    self.frontTransform = frontTransform
    self.segments = segments
    self.screenAspect = screenAspect
    self.requiredSourceTrackIDs = [
      NSNumber(value: backTrackID), NSNumber(value: frontTrackID),
    ]
    super.init()
  }

  /**
   * El encuadre en un segundo dado.
   *
   * Entre dos tramos del mismo lado se interpola, que es lo que convierte los
   * puntos sueltos que apunta el arrastre en un movimiento continuo. Si el tramo
   * siguiente cambia de cámara no se interpola nada: ahí el corte es seco.
   */
  func shot(at seconds: Double) -> PipShot {
    guard let first = segments.first else {
      return PipShot(
        backIsBackground: true, x: 0, y: 0, width: 0.3, aspect: 16.0 / 9.0, radius: 0,
        shadow: 0, screenAspect: screenAspect)
    }

    var current = first
    var next: ComposeSegment?
    for (index, segment) in segments.enumerated() {
      if segment.start <= seconds {
        current = segment
        next = index + 1 < segments.count ? segments[index + 1] : nil
      } else {
        break
      }
    }

    guard
      let following = next,
      following.backIsBackground == current.backIsBackground,
      following.start > current.start
    else {
      return make(current)
    }

    let progress = min(1, max(0, (seconds - current.start) / (following.start - current.start)))
    return PipShot(
      backIsBackground: current.backIsBackground,
      x: mix(current.x, following.x, progress),
      y: mix(current.y, following.y, progress),
      width: mix(current.width, following.width, progress),
      aspect: mix(current.aspect, following.aspect, progress),
      radius: mix(current.radius, following.radius, progress),
      shadow: mix(current.shadow, following.shadow, progress),
      screenAspect: screenAspect)
  }

  private func make(_ segment: ComposeSegment) -> PipShot {
    PipShot(
      backIsBackground: segment.backIsBackground,
      x: segment.x,
      y: segment.y,
      width: segment.width,
      aspect: segment.aspect,
      radius: segment.radius,
      shadow: segment.shadow,
      screenAspect: screenAspect)
  }

  private func mix(_ from: Double, _ to: Double, _ progress: Double) -> Double {
    from + (to - from) * progress
  }
}
