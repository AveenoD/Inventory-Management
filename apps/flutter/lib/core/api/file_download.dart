import 'dart:io';

import 'package:path_provider/path_provider.dart';

Future<String> saveBytesToTempFile(List<int> bytes, String filename) async {
  final dir = await getTemporaryDirectory();
  final safeName = filename.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
  final file = File('${dir.path}/$safeName');
  await file.writeAsBytes(bytes, flush: true);
  return file.path;
}
