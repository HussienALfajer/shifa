# The Linux the shifa_ui CI goldens are drawn on (slice 0.4-08): Ubuntu 24.04 like the CI runner,
# from the Playwright image the web screenshots already pin by digest, plus the two tools the
# Flutter SDK needs to unpack itself. The SDK is not in the image: scripts/goldens.mjs installs
# the version of .fvmrc into a volume and checks its SHA-256 first.
FROM mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579
RUN apt-get update \
  && apt-get install -y --no-install-recommends xz-utils unzip \
  && rm -rf /var/lib/apt/lists/*
