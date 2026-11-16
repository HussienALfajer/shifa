# PDF tools for the spike's checks, built by Testcontainers from this file (base pinned by digest):
# - poppler-utils (pdffonts, pdfinfo, pdftoppm): fonts, page sizes, page rasters; version as
#   shipped by trixie, recorded in the report;
# - PDFium (pypdfium2, pinned by hash): text extraction. PDFium is the engine of Chrome's and
#   Android's PDF viewers; pdftotext splits Arabic words and adds bidi controls. pypdfium2 5.0.0
#   (PDFium 143): 5.15.2 (PDFium 159) reverses some Arabic words in extraction (report §3).
FROM debian:trixie-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/pdfium \
  && echo "pypdfium2==5.0.0 --hash=sha256:4445d83ae3c6688667feba568b7b390b948c4a06ab94e576ad3b029b5567b44c" > /tmp/req.txt \
  && /opt/pdfium/bin/pip install --no-cache-dir --no-deps --only-binary :all: --require-hashes -r /tmp/req.txt \
  && rm /tmp/req.txt
# pdfium-text FILE [FIRST LAST]: UTF-8 text of the pages, pages separated by form feeds.
RUN printf '%s\n' \
  "import sys, pypdfium2 as p" \
  "d = p.PdfDocument(sys.argv[1])" \
  "a, b = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1, len(d))" \
  "sys.stdout.write(chr(12).join(d[i - 1].get_textpage().get_text_range() for i in range(a, b + 1)))" \
  > /usr/local/bin/pdfium-text.py
CMD ["sleep", "infinity"]
