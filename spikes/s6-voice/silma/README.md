# SILMA TTS v1 container (spike 0.3-S6)

Self-hosted fallback candidate, built and run **only on the owner's machine** (OD-50); CI never builds it.

| Pin | Value |
|---|---|
| Base image | `python:3.12-slim-bookworm@sha256:935c3c5b…03df` |
| Package | `silma-tts==1.0.5` ([PyPI](https://pypi.org/project/silma-tts/1.0.5/)), wheel `sha256:8e771c6c…9a9f`; every dependency hashed in `requirements.txt` |
| Weights | [`silma-ai/silma-tts`](https://huggingface.co/silma-ai/silma-tts) at commit `226dd7a65cadf51f9a6dbe3953fc89003b3844d5`; `model.pt` `sha256:f43256d0…336c`, checked at build |
| Vocoder | [`charactr/vocos-mel-24khz`](https://huggingface.co/charactr/vocos-mel-24khz) at commit `0feb3fdd929bcd6649e0e7c5a688cf7dd012ef21`; `config.yaml` and `pytorch_model.bin` checked by SHA-256 (the config is executable: it names the classes Vocos builds) |
| Tashkeel model | CATT `eo_model_onnx.zip` (GitHub release `abjadai/catt` v2), `sha256:5343bfdf…ceac`, installed as root by `prefetch_root.py` |
| Voice | the package's bundled Arabic reference sample (`silma_tts/infer/ref_audio_samples/ar.ref.24k.wav`); no cloning |
| Licences | code MIT (`silma_tts-1.0.5.dist-info/licenses/LICENSE` in site-packages); weights Apache-2.0 (model card kept at `/opt/hf/licences/silma-tts-model-card.md`) |

## Steps (owner)
1. Once: `sh spikes/s6-voice/silma/lock.sh` writes `requirements.txt` with hashes (needs Docker). Commit it with the 0.3-S6b evidence.
2. Build: `docker build -t shifa-s6-silma spikes/s6-voice/silma` (downloads about 2.7 GB: weights, vocoder, tashkeel model; then one offline warm-up synthesis).
3. Run, loopback only: `docker run --rm -p 127.0.0.1:8088:8088 shifa-s6-silma` (add `--gpus all` to measure the GPU, criterion 10).
4. Check: `S6_SILMA=1 pnpm --filter @shifa-spike/s6-tts exec vitest run test/silma.test.ts`.
5. Generate: `pnpm --filter @shifa-spike/s6-tts generate --provider silma`.

## Notes
- The package keeps its defaults: its own text normaliser and automatic tashkeel (`force_tashkeel=True`). Undiacritised names therefore reach SILMA's model diacritised by SILMA; the report says so when comparing tashkeel (criterion 6).
- The server logs method, path and status only. The package itself prints the input text three times per request; the wrapper swallows its stdout and stderr during synthesis, so `docker logs` never shows the text.
- The server accepts only `application/json` with Host `127.0.0.1:8088` or `localhost:8088` (no cross-site `text/plain` posts, no DNS rebinding), at most 4,096 bytes and 500 characters, and drops a request after 10 s.
- `fetch.py` runs online and pins every download; `warmup.py` then runs with `HF_HUB_OFFLINE=1` and proves the image needs nothing more. The NeMo normaliser grammars are built locally during the warm-up.
- Known gap: `transformers-stream-generator` ships only as an sdist, so pip builds it with unhashed setuptools (backlog).
