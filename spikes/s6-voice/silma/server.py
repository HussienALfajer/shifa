"""A small HTTP wrapper around SILMA TTS v1 (spike 0.3-S6): POST /synthesize {"text": "..."}
(Content-Type application/json) returns audio/wav (16-bit PCM). GET /health answers "ok".
Default reference voice only: the Arabic sample shipped inside the silma-tts package, never a
recording of a real person we chose (no cloning). Bound to 127.0.0.1 by
`docker run -p 127.0.0.1:8088:8088`. Logs method, path and status only: the package prints the
input text, so its output is swallowed during synthesis."""

import contextlib
import io
import json
import os
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from importlib.resources import files

MAX_BODY = 4096
MAX_TEXT = 500
ALLOWED_HOSTS = {"127.0.0.1:8088", "localhost:8088"}
# Transcript of the package's bundled reference sample (from the official model card).
REF_TEXT = (
    "ويدقق النظر في القرآن الكريم وسائر الكتب السماوية ويتبع مسالك الرسل العظام عليهم الصلاة والسلام."
)


class Synthesizer:
    def __init__(self) -> None:
        from silma_tts.api import SilmaTTS

        # Package defaults: its text normaliser and automatic tashkeel stay on.
        self.tts = SilmaTTS()
        self.ref = str(files("silma_tts").joinpath("infer/ref_audio_samples/ar.ref.24k.wav"))

    def synthesize(self, text: str) -> bytes:
        import soundfile as sf

        sink = io.StringIO()
        with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(
            sink
        ), contextlib.redirect_stderr(sink):
            wav, sr, _ = self.tts.infer(
                ref_file=self.ref,
                ref_text=REF_TEXT,
                gen_text=text,
                file_wave=os.path.join(tmp, "out.wav"),
                seed=0,
                speed=1,
            )
        out = io.BytesIO()
        sf.write(out, wav, sr, format="WAV", subtype="PCM_16")
        return out.getvalue()


SYNTH: "Synthesizer | None" = None


def parse_text(handler: BaseHTTPRequestHandler) -> "str | None":
    """The request text, or None for anything but a small JSON body from a loopback page."""
    try:
        if handler.headers.get("Host") not in ALLOWED_HOSTS:
            return None
        if (handler.headers.get("Content-Type") or "").split(";")[0].strip() != "application/json":
            return None
        length = int(handler.headers.get("Content-Length") or "0")
        if not 0 < length <= MAX_BODY:
            return None
        text = json.loads(handler.rfile.read(length))["text"]
        return text if isinstance(text, str) and 0 < len(text) <= MAX_TEXT else None
    except Exception:  # noqa: BLE001 - any malformed request is a 400
        return None


class Handler(BaseHTTPRequestHandler):
    # A slow or short body cannot hold the single-threaded server.
    timeout = 10

    def _send(self, status: int, body: bytes, mime: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._send(200, b"ok", "text/plain")
        else:
            self._send(404, b"", "text/plain")

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/synthesize":
            self._send(404, b"", "text/plain")
            return
        text = parse_text(self)
        if text is None:
            self._send(400, b"", "text/plain")
            return
        try:
            assert SYNTH is not None
            self._send(200, SYNTH.synthesize(text), "audio/wav")
        except Exception:  # noqa: BLE001 - no stack trace or input in the response
            self._send(500, b"", "text/plain")

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        # Status and timing only; never the text.
        print(f"{self.command} {self.path} {args[1] if len(args) > 1 else ''}", flush=True)


if __name__ == "__main__":
    SYNTH = Synthesizer()
    # 0.0.0.0 inside the container only; the host publishes it on 127.0.0.1.
    HTTPServer(("0.0.0.0", 8088), Handler).serve_forever()
