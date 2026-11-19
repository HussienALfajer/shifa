// Small named-file storage for the probe. `FileStore` keeps everything in the app's documents
// directory, so the background message isolate and the UI isolate share one message log;
// `MemoryStore` is the same contract in memory for tests.
import 'dart:io';

abstract interface class ProbeStore {
  Future<String?> read(String name);
  Future<void> write(String name, String content);
  Future<void> append(String name, String line);

  /// Non-empty lines of [name], oldest first; empty when the file does not exist.
  Future<List<String>> lines(String name);
}

class MemoryStore implements ProbeStore {
  final Map<String, String> _files = {};

  @override
  Future<String?> read(String name) async => _files[name];

  @override
  Future<void> write(String name, String content) async =>
      _files[name] = content;

  @override
  Future<void> append(String name, String line) async =>
      _files[name] = '${_files[name] ?? ''}$line\n';

  @override
  Future<List<String>> lines(String name) async => _split(_files[name]);
}

class FileStore implements ProbeStore {
  new(this.dir);

  final Directory dir;

  File _file(String name) => File('${dir.path}${Platform.pathSeparator}$name');

  @override
  Future<String?> read(String name) async {
    final f = _file(name);
    return f.existsSync() ? await f.readAsString() : null;
  }

  @override
  Future<void> write(String name, String content) async {
    // Write then rename, so a reader in the other isolate never sees half a file.
    final tmp = _file('$name.tmp');
    await tmp.writeAsString(content, flush: true);
    await tmp.rename(_file(name).path);
  }

  @override
  Future<void> append(String name, String line) async {
    await _file(name)
        .writeAsString('$line\n', mode: FileMode.append, flush: true);
  }

  @override
  Future<List<String>> lines(String name) async => _split(await read(name));
}

List<String> _split(String? text) =>
    (text ?? '').split('\n').where((l) => l.trim().isNotEmpty).toList();
