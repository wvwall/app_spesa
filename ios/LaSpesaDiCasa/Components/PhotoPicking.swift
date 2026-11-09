import PhotosUI
import SwiftUI
import UIKit

/// Resizes to max 1280px on the long edge and encodes as JPEG 0.82 (same as the PWA's canvas).
enum PhotoResize {
    static func jpeg(from image: UIImage, maxEdge: CGFloat = 1280, quality: CGFloat = 0.82) -> Data? {
        let scale = min(1, maxEdge / max(image.size.width, image.size.height))
        let size = CGSize(width: max(1, (image.size.width * scale).rounded()), height: max(1, (image.size.height * scale).rounded()))
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        return resized.jpegData(compressionQuality: quality)
    }
}

/// Camera capture via UIImagePickerController (PhotosPicker covers the library).
struct CameraPicker: UIViewControllerRepresentable {
    var onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage { parent.onImage(image) }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}

/// "Foto" control: a menu offering the camera (when available) and the photo library.
struct PhotoButton: View {
    @Environment(\.palette) private var palette
    @Binding var foto: Data?
    @Binding var errore: String?
    @State private var libraryItem: PhotosPickerItem?
    @State private var showLibrary = false
    @State private var showCamera = false

    var body: some View {
        Menu {
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button { showCamera = true } label: { Label("Scatta una foto", systemImage: "camera") }
            }
            Button { showLibrary = true } label: { Label("Scegli dalla libreria", systemImage: "photo.on.rectangle") }
        } label: {
            HStack(spacing: 6) {
                if let foto, let ui = UIImage(data: foto) {
                    Image(uiImage: ui).resizable().scaledToFill().frame(width: 32, height: 32)
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                } else {
                    Image(systemName: "photo.badge.plus").font(.system(size: 17))
                }
                Text(foto == nil ? "Foto" : "Cambia").font(AppFont.text(14))
            }
            .foregroundStyle(palette.biro)
            .frame(minHeight: 44)
        }
        .photosPicker(isPresented: $showLibrary, selection: $libraryItem, matching: .images)
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in set(image) }.ignoresSafeArea()
        }
        .onChange(of: libraryItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                    set(image)
                } else {
                    errore = "Non riesco a caricare questa foto."
                }
                libraryItem = nil
            }
        }
    }

    private func set(_ image: UIImage) {
        if let data = PhotoResize.jpeg(from: image) {
            foto = data
            errore = nil
        } else {
            errore = "Non riesco a caricare questa foto."
        }
    }
}
