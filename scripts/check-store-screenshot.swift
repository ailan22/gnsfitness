import AppKit

// Check the content area, excluding the OS status and home indicators.
guard CommandLine.arguments.count == 2,
      let image = NSImage(contentsOfFile: CommandLine.arguments[1]),
      let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff) else { exit(2) }
var visibleSamples = 0
for y in stride(from: bitmap.pixelsHigh / 6, to: bitmap.pixelsHigh * 5 / 6, by: 12) {
    for x in stride(from: bitmap.pixelsWide / 10, to: bitmap.pixelsWide * 9 / 10, by: 12) {
        if let color = bitmap.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB),
           color.redComponent > 0.65 && color.greenComponent > 0.55 {
            visibleSamples += 1
        }
    }
}
if visibleSamples < 30 {
    fputs("Screenshot content is blank or still loading\n", stderr)
    exit(1)
}
