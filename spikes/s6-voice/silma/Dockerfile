# SILMA TTS v1 for spike 0.3-S6 (OD-50): built and run only on the owner's machine, never in CI.
# Pins: Python base by digest; every Python package by version and hash (requirements.txt, made
# once by lock.sh); the weights by Hugging Face commit and the checkpoint by SHA-256 (fetch.py).
# Run bound to loopback only: docker run --rm -p 127.0.0.1:8088:8088 shifa-s6-silma
FROM python:3.12-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# Every dependency hash-checked: the build fails on any package not in the lock.
COPY requirements.txt /opt/silma/requirements.txt
RUN pip install --no-cache-dir --root-user-action=ignore --require-hashes \
  -r /opt/silma/requirements.txt

RUN useradd --create-home --uid 10001 silma && mkdir -p /opt/hf && chown silma:silma /opt/hf
USER silma
ENV HOME=/home/silma HF_HOME=/opt/hf PYTHONUNBUFFERED=1

# Weights at a pinned commit, checkpoint checked by SHA-256, then one warm-up synthesis so the
# vocoder, tashkeel and normaliser assets are in the image; the server then runs offline.
COPY --chown=silma:silma fetch.py server.py /opt/silma/
RUN python /opt/silma/fetch.py
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1

EXPOSE 8088
CMD ["python", "/opt/silma/server.py"]
