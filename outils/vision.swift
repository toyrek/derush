// Dérush — analyse d'images avec Apple Vision (sur le Mac, sans rien télécharger).
// Usage : derush-vision cadrage <dossier d'images .jpg>
// Pour chaque image : visages, haut du corps et zones qui attirent l'œil (saillance).
// Coordonnées normalisées 0..1, origine en haut à gauche : [x, y, largeur, hauteur, confiance].
import Foundation
import Vision
import CoreGraphics
import ImageIO

func ecrireErreur(_ s: String) { FileHandle.standardError.write((s + "\n").data(using: .utf8)!) }

func boite(_ r: CGRect, _ confiance: Float) -> [Double] {
  let v = [Double(r.origin.x), Double(1 - r.origin.y - r.size.height), Double(r.size.width), Double(r.size.height), Double(confiance)]
  return v.map { ($0 * 10000).rounded() / 10000 }
}

let args = CommandLine.arguments
guard args.count >= 3, args[1] == "cadrage" else {
  ecrireErreur("usage : derush-vision cadrage <dossier d'images>")
  exit(2)
}
let dossier = URL(fileURLWithPath: args[2])
let fichiers = ((try? FileManager.default.contentsOfDirectory(at: dossier, includingPropertiesForKeys: nil)) ?? [])
  .filter { ["jpg", "jpeg", "png"].contains($0.pathExtension.lowercased()) }
  .sorted { $0.lastPathComponent < $1.lastPathComponent }

var images: [[String: Any]] = []
for (k, f) in fichiers.enumerated() {
  var e: [String: Any] = ["fichier": f.lastPathComponent]
  guard let source = CGImageSourceCreateWithURL(f as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    images.append(e)
    continue
  }
  let visages = VNDetectFaceRectanglesRequest()
  let corps = VNDetectHumanRectanglesRequest()
  corps.upperBodyOnly = true
  let saillance = VNGenerateAttentionBasedSaliencyImageRequest()
  let analyse = VNImageRequestHandler(cgImage: image, options: [:])
  do {
    try analyse.perform([visages, corps, saillance])
  } catch {
    ecrireErreur("\(f.lastPathComponent) : \(error.localizedDescription)")
  }
  e["visages"] = (visages.results ?? []).map { boite($0.boundingBox, $0.confidence) }
  e["corps"] = (corps.results ?? []).map { boite($0.boundingBox, $0.confidence) }
  e["saillance"] = (saillance.results?.first?.salientObjects ?? []).map { boite($0.boundingBox, $0.confidence) }
  images.append(e)
  if k % 25 == 0 { ecrireErreur("progress=\(k * 100 / max(1, fichiers.count))%") }
}
let donnees = try JSONSerialization.data(withJSONObject: ["images": images], options: [])
FileHandle.standardOutput.write(donnees)
