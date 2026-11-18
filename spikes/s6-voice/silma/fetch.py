"""Build step: fetch SILMA TTS v1 weights at a pinned commit, check the checkpoint's SHA-256,
keep the weights' licence text, and run one warm-up synthesis (spike 0.3-S6, OD-50)."""

import hashlib
import os
import sys

from huggingface_hub import hf_hub_download

REPO = "silma-ai/silma-tts"
# Hugging Face commit of silma-ai/silma-tts (lastModified 2026-08-23), checked 2026-11-18.
REVISION = "226dd7a65cadf51f9a6dbe3953fc89003b3844d5"
MODEL_SHA256 = "f43256d0b78b8803c638aed0875da5a4b372b4a784690a0156e5baff14f7336c"


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    model = hf_hub_download(REPO, "model.pt", revision=REVISION)
    hf_hub_download(REPO, "vocab.txt", revision=REVISION)
    card = hf_hub_download(REPO, "README.md", revision=REVISION)
    got = sha256(model)
    if got != MODEL_SHA256:
        sys.exit(f"model.pt SHA-256 mismatch: {got}")

    # The package loads hf://silma-ai/silma-tts/<file> at the "main" ref: point it at the pin.
    refs = os.path.join(os.environ["HF_HOME"], "hub", "models--silma-ai--silma-tts", "refs")
    os.makedirs(refs, exist_ok=True)
    with open(os.path.join(refs, "main"), "w", encoding="ascii") as f:
        f.write(REVISION)
    os.makedirs("/opt/hf/licences", exist_ok=True)
    with open(card, encoding="utf-8") as src, open(
        "/opt/hf/licences/silma-tts-model-card.md", "w", encoding="utf-8"
    ) as dst:
        dst.write(src.read())

    # Warm-up: caches the vocoder, tashkeel and normaliser assets inside the image.
    sys.path.insert(0, os.path.dirname(__file__))
    from server import Synthesizer  # noqa: E402

    wav = Synthesizer().synthesize("الرقم واحد")
    if len(wav) < 1000:
        sys.exit("warm-up produced no audio")

    with open(os.path.join(refs, "main"), encoding="ascii") as f:
        if f.read().strip() != REVISION:
            sys.exit("the weights moved past the pinned commit during warm-up")
    print(f"SILMA ready: {REPO}@{REVISION}, model.pt {MODEL_SHA256}")


if __name__ == "__main__":
    main()
