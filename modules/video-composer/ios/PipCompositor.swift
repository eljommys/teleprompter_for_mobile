import AVFoundation
import CoreImage

/**
 * Compositor propio para el recuadro de la segunda cámara.
 *
 * El compositor que trae AVFoundation solo sabe colocar rectángulos: mueve,
 * escala y recorta, y ahí se acaba. Para que el recuadro salga con las esquinas
 * redondeadas —o redondo del todo— y con su sombra **en el fichero guardado**, y
 * no solo en la vista previa, hay que pintar los fotogramas a mano. Eso es lo
 * que hace esto: recibe los dos vídeos, los compone con Core Image y devuelve el
 * resultado.
 *
 * De paso, aquí se interpola la geometría entre tramos, así que ya no hacen
 * falta rampas de transformación: cada fotograma se calcula para su instante.
 */
final class PipCompositor: NSObject, AVVideoCompositing {
  /// Core Image sobre Metal: en CPU esto no aguantaría 1080p.
  private let context: CIContext = {
    if let device = MTLCreateSystemDefaultDevice() {
      return CIContext(mtlDevice: device, options: [.cacheIntermediates: false])
    }
    return CIContext(options: [.cacheIntermediates: false])
  }()

  /// Las máscaras cuestan de generar, y entre fotograma y fotograma casi nunca
  /// cambian: solo dependen del tamaño y del redondeo, no de dónde esté.
  private var maskCache: [String: CIImage] = [:]
  private let queue = DispatchQueue(label: "com.rackslabs.prompter.pip-compositor")

  var sourcePixelBufferAttributes: [String: any Sendable]? = [
    kCVPixelBufferPixelFormatTypeKey as String: [kCVPixelFormatType_32BGRA]
  ]
  var requiredPixelBufferAttributesForRenderContext: [String: any Sendable] = [
    kCVPixelBufferPixelFormatTypeKey as String: [kCVPixelFormatType_32BGRA]
  ]

  func renderContextChanged(_ newRenderContext: AVVideoCompositionRenderContext) {}

  func startRequest(_ request: AVAsynchronousVideoCompositionRequest) {
    queue.async { [weak self] in
      guard let self else { return }
      autoreleasepool {
      guard
        let instruction = request.videoCompositionInstruction as? PipInstruction,
        let destination = request.renderContext.newPixelBuffer()
      else {
        request.finish(with: PipCompositorError.noFrame)
        return
      }

      let canvas = request.renderContext.size
      let time = CMTimeGetSeconds(request.compositionTime)
      let shot = instruction.shot(at: time)

      // Enderezadas primero: los fotogramas llegan crudos, tal y como los
      // guardó la cámara, y una toma vertical viene tumbada.
      let backImage = request.sourceFrame(byTrackID: instruction.backTrackID)
        .map { CIImage(cvPixelBuffer: $0).transformed(by: instruction.backTransform) }
      let frontImage = request.sourceFrame(byTrackID: instruction.frontTrackID)
        .map { CIImage(cvPixelBuffer: $0).transformed(by: instruction.frontTransform) }

      let background = shot.backIsBackground ? backImage : frontImage
      let overlay = shot.backIsBackground ? frontImage : backImage

      // Que falte un fotograma no puede tirar abajo el montaje entero: pasa en
      // los bordes, cuando una toma empieza o acaba un pelo antes que la otra.
      // Sin fondo no hay nada que pintar; sin recuadro, se sigue con el fondo a
      // secas, que es infinitamente mejor que quedarse sin vídeo.
      guard let background else {
        request.finish(with: PipCompositorError.noFrame)
        return
      }

      let frame = self.compose(
        background: background, overlay: overlay, shot: shot, canvas: canvas)
      self.context.render(frame, to: destination)
      request.finish(withComposedVideoFrame: destination)
      }
    }
  }

  func cancelAllPendingVideoCompositionRequests() {}

  /** Pinta un fotograma: el fondo, la sombra y el recuadro recortado encima. */
  private func compose(background: CIImage, overlay: CIImage?, shot: PipShot, canvas: CGSize)
    -> CIImage
  {
    let canvasRect = CGRect(origin: .zero, size: canvas)
    let filled = cover(background, in: canvasRect)
    guard let overlay else { return filled.cropped(to: canvasRect) }

    // Coordenadas de pantalla a coordenadas de lienzo: la vista previa va en
    // `cover`, así que de la toma solo se ve la franja central que cabe en la
    // pantalla, y las fracciones no valen tal cual.
    let visible = visibleFraction(canvas: canvas, screenAspect: shot.screenAspect)
    let width = shot.width * visible.width
    let boxWidth = canvas.width * width
    let boxHeight = boxWidth * shot.aspect
    let x = (1 - visible.width) / 2 + shot.x * visible.width
    let y = (1 - visible.height) / 2 + shot.y * visible.height

    // Se encaja dentro del lienzo: al agrandar el recuadro puede que la posición
    // guardada ya no quepa.
    let left = min(max(0, canvas.width * x), max(0, canvas.width - boxWidth))
    // Core Image cuenta la altura desde abajo y la app desde arriba.
    let topDown = min(max(0, canvas.height * y), max(0, canvas.height - boxHeight))
    let bottom = canvas.height - topDown - boxHeight
    let box = CGRect(x: left, y: bottom, width: boxWidth, height: boxHeight)

    let corner = (min(box.width, box.height) / 2) * shot.radius
    let mask = roundedMask(size: box.size, corner: corner)

    var result = filled

    // La sombra: la misma silueta del recuadro, negra y desenfocada, debajo.
    if shot.shadow > 0.01 {
      let blur = 18 * shot.shadow
      let drop = 8 * shot.shadow
      let boxBounds = CGRect(origin: .zero, size: box.size)
      let shadow = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: shot.shadow))
        .cropped(to: boxBounds)
        .applyingFilter("CIBlendWithAlphaMask", parameters: [
          kCIInputMaskImageKey: mask,
          kCIInputBackgroundImageKey: CIImage(color: .clear).cropped(to: boxBounds),
        ])
        .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: blur])
        .transformed(by: CGAffineTransform(translationX: box.minX, y: box.minY - drop))
      result = shadow.composited(over: result)
    }

    let framed = cover(overlay, in: CGRect(origin: .zero, size: box.size))
      .applyingFilter("CIBlendWithAlphaMask", parameters: [
        kCIInputMaskImageKey: mask,
        kCIInputBackgroundImageKey: CIImage(color: .clear)
          .cropped(to: CGRect(origin: .zero, size: box.size)),
      ])
      .transformed(by: CGAffineTransform(translationX: box.minX, y: box.minY))

    return framed.composited(over: result).cropped(to: canvasRect)
  }

  /** Agranda la imagen hasta llenar el hueco y recorta lo que sobra, centrado. */
  private func cover(_ image: CIImage, in rect: CGRect) -> CIImage {
    let source = image.extent
    guard source.width > 0, source.height > 0 else { return image }
    let scale = max(rect.width / source.width, rect.height / source.height)
    let scaled = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    let dx = rect.minX + (rect.width - scaled.extent.width) / 2 - scaled.extent.minX
    let dy = rect.minY + (rect.height - scaled.extent.height) / 2 - scaled.extent.minY
    return scaled
      .transformed(by: CGAffineTransform(translationX: dx, y: dy))
      .cropped(to: rect)
  }

  /**
   * Silueta del recuadro: blanco donde se ve la imagen y transparente fuera.
   *
   * Se dibuja con Core Graphics y no con un filtro porque el generador de
   * rectángulos redondeados de Core Image es de iOS 17 y aquí se despliega desde
   * la 16.4.
   */
  private func roundedMask(size: CGSize, corner: CGFloat) -> CIImage {
    let key = "\(Int(size.width))x\(Int(size.height))@\(Int(corner))"
    if let cached = maskCache[key] { return cached }

    let width = max(1, Int(size.width.rounded()))
    let height = max(1, Int(size.height.rounded()))
    let bounds = CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height))
    let limit = min(corner, min(bounds.width, bounds.height) / 2)

    guard
      let space = CGColorSpace(name: CGColorSpace.sRGB),
      let ctx = CGContext(
        data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
        space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else { return CIImage(color: .white).cropped(to: bounds) }

    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.addPath(CGPath(roundedRect: bounds, cornerWidth: limit, cornerHeight: limit, transform: nil))
    ctx.fillPath()

    guard let cgImage = ctx.makeImage() else {
      return CIImage(color: .white).cropped(to: bounds)
    }
    let mask = CIImage(cgImage: cgImage)
    // Un puñado de tamaños distintos como mucho; si se dispara, se vacía.
    if maskCache.count > 24 { maskCache.removeAll() }
    maskCache[key] = mask
    return mask
  }

  private func visibleFraction(canvas: CGSize, screenAspect: Double) -> (
    width: Double, height: Double
  ) {
    guard screenAspect > 0, canvas.height > 0 else { return (1, 1) }
    let canvasAspect = canvas.width / canvas.height
    return (
      width: min(1, screenAspect / canvasAspect),
      height: min(1, canvasAspect / screenAspect)
    )
  }
}

enum PipCompositorError: Error {
  case noFrame
}
