import 'dart:io';

import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';

class CameraService {
  CameraService({ImagePicker? picker}) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  Future<String?> tirarFoto({
    required String chamadoId,
    required String tipo,
  }) async {
    final photo = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 82,
      maxWidth: 1600,
    );

    if (photo == null) {
      return null;
    }

    final directory = await _photoDirectory(chamadoId);
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final sanitizedType = tipo.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
    final targetPath = path.join(directory.path, '$sanitizedType-$timestamp.jpg');

    await File(photo.path).copy(targetPath);
    return targetPath;
  }

  Future<void> apagarFotoLocal(String? photoPath) async {
    if (photoPath == null || photoPath.trim().isEmpty) {
      return;
    }

    final file = File(photoPath);
    if (await file.exists()) {
      await file.delete();
    }
  }

  Future<Directory> _photoDirectory(String chamadoId) async {
    final appDirectory = await getApplicationDocumentsDirectory();
    final sanitizedId = chamadoId.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
    final directory = Directory(
      path.join(appDirectory.path, 'pending_photos', sanitizedId),
    );

    if (!await directory.exists()) {
      await directory.create(recursive: true);
    }

    return directory;
  }
}
