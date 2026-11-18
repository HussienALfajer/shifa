"""Build step, as root: install the CATT tashkeel ONNX model that silma-tts loads at start
(force_tashkeel=True) into the root-owned site-packages, checked by SHA-256. Without this the
package downloads the zip itself at run time, unhashed, into site-packages (security review)."""

import hashlib
import io
import sys
import urllib.request
import zipfile
from importlib.resources import files
from pathlib import Path

URL = "https://github.com/abjadai/catt/releases/download/v2/eo_model_onnx.zip"
# GitHub's recorded asset digest for eo_model_onnx.zip (release v2), checked 2026-11-18.
SHA256 = "5343bfdfda70c981b587811b79348b8dde91f65c0a551ca98f232ea5cb62ceac"


def main() -> None:
    with urllib.request.urlopen(URL, timeout=600) as res:  # noqa: S310 - fixed https URL
        data = res.read()
    got = hashlib.sha256(data).hexdigest()
    if got != SHA256:
        sys.exit(f"eo_model_onnx.zip SHA-256 mismatch: {got}")
    target = Path(str(files("catt_tashkeel"))) / "onnx_models" / "eo_model"
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for wanted in ("encoder.onnx", "decoder.onnx"):
            names = [n for n in zf.namelist() if n.rsplit("/", 1)[-1] == wanted]
            if len(names) != 1:
                sys.exit(f"{wanted} not found exactly once in the zip")
            (target / wanted).write_bytes(zf.read(names[0]))
    print(f"CATT eo_model installed in {target}")


if __name__ == "__main__":
    main()
