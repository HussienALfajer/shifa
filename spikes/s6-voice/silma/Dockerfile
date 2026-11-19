# SILMA TTS v1 for spike 0.3-S6 (OD-50): built and run only on the owner's machine, never in CI.
# Pins: Python base by digest; every Python package by version and hash (requirements.txt, made
# once by lock.sh); the CATT tashkeel model by SHA-256 (prefetch_root.py); the SILMA weights and
# the Vocos vocoder by Hugging Face commit and SHA-256 (fetch.py). The warm-up runs offline.
# Run bound to loopback only: docker run --rm -p 127.0.0.1:8088:8088 shifa-s6-silma
FROM python:3.12-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# Every dependency hash-checked: the build fails on any package not in the lock. The BuildKit
# cache mount keeps pip's downloads between build attempts (not in the image), so on a link that
# drops large downloads a rebuild reuses every wheel that already arrived intact; a cut download
# fails its hash and is fetched again.
COPY requirements.txt /opt/silma/requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
  pip install --root-user-action=ignore --require-hashes --timeout 120 --retries 20 \
  -r /opt/silma/requirements.txt

# As root, so site-packages stays root-owned: the tashkeel model the package would otherwise
# download unhashed at start.
COPY prefetch_root.py /opt/silma/
RUN python /opt/silma/prefetch_root.py

RUN useradd --create-home --uid 10001 silma && mkdir -p /opt/hf && chown silma:silma /opt/hf
USER silma
ENV HOME=/home/silma HF_HOME=/opt/hf PYTHONUNBUFFERED=1

COPY --chown=root:root fetch.py server.py warmup.py /opt/silma/
RUN python /opt/silma/fetch.py
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
RUN python /opt/silma/warmup.py

EXPOSE 8088
CMD ["python", "/opt/silma/server.py"]
