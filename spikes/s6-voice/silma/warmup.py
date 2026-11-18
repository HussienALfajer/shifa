"""Build step (offline, HF_HUB_OFFLINE=1): one synthesis, so every remaining asset the package
needs at start is proven to be in the image, and the pinned refs did not move."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fetch import PINS  # noqa: E402
from server import Synthesizer  # noqa: E402

wav = Synthesizer().synthesize("الرقم واحد")
if len(wav) < 1000:
    sys.exit("warm-up produced no audio")
hub = os.path.join(os.environ["HF_HOME"], "hub")
for repo, commit, _ in PINS:
    ref = os.path.join(hub, "models--" + repo.replace("/", "--"), "refs", "main")
    with open(ref, encoding="ascii") as f:
        if f.read().strip() != commit:
            sys.exit(f"{repo} moved past its pin during warm-up")
print("SILMA warm-up ok (offline)")
