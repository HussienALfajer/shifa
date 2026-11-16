# dcmtk tools for the imaging spike (0.3-S4): dcmmkdir builds the with-dicomdir study's DICOMDIR;
# 0.3-S4b uses storescu to push studies into the edge Orthanc. Debian's dcmtk package.
FROM debian:trixie-20261104-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2
RUN apt-get update \
  && apt-get install -y --no-install-recommends dcmtk \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /data
