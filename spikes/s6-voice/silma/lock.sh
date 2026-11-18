#!/bin/sh
# Owner's machine, once before the first build: resolves requirements.in inside the pinned base
# image and writes requirements.txt with a hash for every package (pip-compile --generate-hashes).
# Then checks that the silma-tts wheel hash matches the one recorded in requirements.in.
set -eu
cd "$(dirname "$0")"
docker run --rm -v "$PWD:/w" -w /w \
  python:3.12-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df \
  sh -c 'pip install --root-user-action=ignore -q pip-tools==7.4.1 \
    && pip-compile --quiet --generate-hashes --allow-unsafe --strip-extras \
       -o requirements.txt requirements.in'
grep -q 'sha256:8e771c6c80bfa8d891d4f18bc1d6fd065c92def0763d526ad7d1f5f5e34d9a9f' requirements.txt
echo "requirements.txt locked"
