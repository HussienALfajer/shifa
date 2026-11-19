"""Build step (online, as user silma): fetch SILMA TTS v1 weights and the Vocos vocoder at pinned
commits, check every file by SHA-256, point each repository's "main" ref at its pin (the package
loads both at "main"), and keep the weights' model card as the licence record. The warm-up runs
in a separate step with HF_HUB_OFFLINE=1 (warmup.py), so nothing is ever resolved from the Hub."""

import hashlib
import os
import sys
import time

from huggingface_hub import hf_hub_download

# (repo, commit, {file: sha256 or None for a non-weight file kept only for the record})
PINS = [
    (
        "silma-ai/silma-tts",
        # lastModified 2026-08-23, checked 2026-11-18
        "226dd7a65cadf51f9a6dbe3953fc89003b3844d5",
        {
            "model.pt": "f43256d0b78b8803c638aed0875da5a4b372b4a784690a0156e5baff14f7336c",
            "vocab.txt": None,
            "README.md": None,
        },
    ),
    (
        "charactr/vocos-mel-24khz",
        # lastModified 2023-10-17, checked 2026-11-18; config.yaml names only vocos.* classes
        "0feb3fdd929bcd6649e0e7c5a688cf7dd012ef21",
        {
            "config.yaml": "da9033922f969a47f0c160010226919e59f27761fd5066f3828d46de6650b0fc",
            "pytorch_model.bin": "97ec976ad1fd67a33ab2682d29c0ac7df85234fae875aefcc5fb215681a91b2a",
        },
    ),
]
REVISION = PINS[0][1]
MODEL_SHA256 = PINS[0][2]["model.pt"]


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(repo: str, name: str, commit: str, attempts: int = 10) -> str:
    """hf_hub_download resumes a cut download from its .incomplete file; retry on a dropped link."""
    for attempt in range(1, attempts + 1):
        try:
            return hf_hub_download(repo, name, revision=commit)
        except Exception as error:  # noqa: BLE001 - network errors come in many types
            if attempt == attempts:
                raise
            print(f"{repo}/{name}: attempt {attempt} failed ({type(error).__name__}); retrying")
            time.sleep(min(60, 5 * attempt))
    raise AssertionError("unreachable")


def main() -> None:
    hub = os.path.join(os.environ["HF_HOME"], "hub")
    for repo, commit, pinned in PINS:
        for name, expected in pinned.items():
            path = download(repo, name, commit)
            if expected is not None and sha256(path) != expected:
                sys.exit(f"{repo}/{name}: SHA-256 mismatch")
            if repo == "silma-ai/silma-tts" and name == "README.md":
                os.makedirs("/opt/hf/licences", exist_ok=True)
                with open(path, encoding="utf-8") as src, open(
                    "/opt/hf/licences/silma-tts-model-card.md", "w", encoding="utf-8"
                ) as dst:
                    dst.write(src.read())
        refs = os.path.join(hub, "models--" + repo.replace("/", "--"), "refs")
        os.makedirs(refs, exist_ok=True)
        with open(os.path.join(refs, "main"), "w", encoding="ascii") as f:
            f.write(commit)
        print(f"pinned {repo}@{commit}")


if __name__ == "__main__":
    main()
