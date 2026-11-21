import 'dart:io';

import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

/// Máximo de fotos por visita (regra da API).
const int maxVisitPhotos = 3;

/// Limite de tamanho por foto depois de comprimir (regra da API: 2 MB).
const int maxPhotoBytes = 2 * 1024 * 1024;

/// Escolhe, comprime e guarda a foto dentro do app. A cópia comprimida é a que sobe.
class PhotoService {
  static const Uuid _uuid = Uuid();

  /// Devolve o caminho da foto comprimida, ou `null` se o técnico cancelou.
  Future<String?> pickAndStore({
    ImageSource source = ImageSource.gallery,
  }) async {
    final XFile? picked = await ImagePicker().pickImage(source: source);
    if (picked == null) return null;

    final Directory docs = await getApplicationDocumentsDirectory();
    final Directory folder = Directory('${docs.path}/visit_photos');
    if (!await folder.exists()) await folder.create(recursive: true);

    final String target = '${folder.path}/${_uuid.v4()}.jpg';
    int quality = 75;
    XFile? out;
    // Reduz a qualidade até caber no limite da API.
    while (quality >= 40) {
      out = await FlutterImageCompress.compressAndGetFile(
        picked.path,
        target,
        minWidth: 1600,
        minHeight: 1600,
        quality: quality,
        format: CompressFormat.jpeg,
      );
      if (out == null) break;
      if (await File(out.path).length() <= maxPhotoBytes) break;
      quality -= 15;
    }
    if (out == null) return null;
    return out.path;
  }

  Future<void> deleteFile(String path) async {
    final File file = File(path);
    if (await file.exists()) await file.delete();
  }
}
