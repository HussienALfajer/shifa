#!/bin/sh
# Owner's machine, once before the first build: resolves requirements.in inside the pinned base
# image and writes requirements.txt with a hash for every package (pip-compile --generate-hashes).
# Then checks that the silma-tts wheel hash matches the one recorded in requirements.in.
set -eu
cd "$(dirname "$0")"
# Git Bash on Windows rewrites /w into W:/ and needs a Windows path for the mount; elsewhere
# `pwd -W` does not exist and the plain path is used.
HOST_DIR="$(pwd -W 2>/dev/null || pwd)"
# A named volume keeps pip's download cache between attempts: on a slow or flaky link a retry
# reuses every wheel that already arrived intact (pip checks each against the index's hash).
MSYS_NO_PATHCONV=1 docker run --rm -v "$HOST_DIR:/w" -w /w -v shifa-s6-pip-cache:/root/.cache/pip \
  python:3.12-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df \
  sh -c 'pip install --root-user-action=ignore -q pip-tools==7.4.1 \
    && pip-compile --quiet --generate-hashes --allow-unsafe --strip-extras \
       -o requirements.txt requirements.in'
grep -q 'sha256:8e771c6c80bfa8d891d4f18bc1d6fd065c92def0763d526ad7d1f5f5e34d9a9f' requirements.txt
# Packages come from PyPI only: no other index, no local or URL source.
# Comment lines are skipped: pip-compile's header repeats its own options (`--index-url=None`).
if grep -v '^[[:space:]]*#' requirements.txt |
  grep -Eq -- '--(extra-)?index-url|--find-links|-f |file:|git\+|https?://'; then
  echo "requirements.txt names a source other than PyPI" >&2
  exit 1
fi
echo "requirements.txt locked"
