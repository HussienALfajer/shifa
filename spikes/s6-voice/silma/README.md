# SILMA TTS v1 container (spike 0.3-S6)

Self-hosted fallback candidate, built and run **only on the owner's machine** (OD-50); CI never builds it.

| Pin | Value |
|---|---|
| Base image | `python:3.12-slim-bookworm@sha256:935c3c5b…03df` |
| Package | `silma-tts==1.0.5` ([PyPI](https://pypi.org/project/silma-tts/1.0.5/)), wheel `sha256:8e771c6c…9a9f`; every dependency hashed in `requirements.txt` |
| Weights | [`silma-ai/silma-tts`](https://huggingface.co/silma-ai/silma-tts) at commit `226dd7a65cadf51f9a6dbe3953fc89003b3844d5`; `model.pt` `sha256:f43256d0…336c`, checked at build |
| Voice | the package's bundled Arabic reference sample (`silma_tts/infer/ref_audio_samples/ar.ref.24k.wav`); no cloning |
| Licences | code MIT (`silma_tts-1.0.5.dist-info/licenses/LICENSE` in site-packages); weights Apache-2.0 (model card kept at `/opt/hf/licences/silma-tts-model-card.md`) |

## Steps (owner)
1. Once: `sh spikes/s6-voice/silma/lock.sh` writes `requirements.txt` with hashes (needs Docker). Commit it with the 0.3-S6b evidence.
2. Build: `docker build -t shifa-s6-silma spikes/s6-voice/silma` (downloads about 2.6 GB of weights and runs one warm-up synthesis).
3. Run, loopback only: `docker run --rm -p 127.0.0.1:8088:8088 shifa-s6-silma` (add `--gpus all` to measure the GPU, criterion 10).
4. Check: `S6_SILMA=1 pnpm --filter @shifa-spike/s6-tts exec vitest run test/silma.test.ts`.
5. Generate: `pnpm --filter @shifa-spike/s6-tts generate --provider silma`.

## Notes
- The package keeps its defaults: its own text normaliser and automatic tashkeel (`force_tashkeel=True`). Undiacritised names therefore reach SILMA's model diacritised by SILMA; the report says so when comparing tashkeel (criterion 6).
- The server logs method, path and status only, never the text.
- The vocoder, tashkeel and normaliser assets are cached at build by the warm-up (not hash-pinned); the server then runs with `HF_HUB_OFFLINE=1`, so nothing changes after the build.
