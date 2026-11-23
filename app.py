import logging
import os
from functools import cache
from io import BytesIO
from pathlib import Path
from threading import Lock
from typing import Annotated, Literal
from xml.sax.saxutils import escape

from docx import Document
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate

STATIC = Path(__file__).resolve().parent / "static"
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".flac", ".webm", ".mp4"}
MAX_AUDIO_BYTES = 250 * 1024 * 1024
MAX_FILES = 30
model_lock = Lock()
app = FastAPI(docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC), name="static")


class Recording(BaseModel):
    name: str = Field(min_length=1, max_length=512)
    text: str = Field(min_length=1, max_length=1_000_000)


class ExportRequest(BaseModel):
    format: Literal["pdf", "docx"]
    recordings: Annotated[list[Recording], Field(min_length=1, max_length=MAX_FILES)]


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@cache
def get_model():
    from faster_whisper import WhisperModel

    return WhisperModel(
        os.getenv("WHISPER_MODEL", "small"),
        device="cpu",
        compute_type="int8",
        cpu_threads=int(os.getenv("WHISPER_CPU_THREADS", "0")),
    )


def transcribe_audio(audio):
    with model_lock:
        segments, _ = get_model().transcribe(audio, language="it", task="transcribe", vad_filter=True)
        chunks = []
        for segment in segments:
            phrase = segment.text.strip()
            if phrase:
                chunks.append(phrase)
        return "\n".join(chunks)


@app.post("/api/transcribe")
def transcribe(file: UploadFile):
    if Path(file.filename or "").suffix.lower() not in AUDIO_EXTENSIONS:
        raise HTTPException(415, "Formato audio non supportato.")
    if not file.size:
        raise HTTPException(422, "Il file audio è vuoto.")
    if file.size > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Il file supera il limite di 250 MB.")
    try:
        text = transcribe_audio(file.file)
    except Exception as exc:
        logging.exception("Errore durante la trascrizione")
        raise HTTPException(422, "Trascrizione non riuscita. Verifica il file audio e riprova.") from exc
    if not text:
        raise HTTPException(422, "Non è stato rilevato parlato in questo audio.")
    return {"text": text}


@app.post("/api/export")
def export(request: ExportRequest):
    output = BytesIO()
    title = "Trascrizione delle lezioni"

    if request.format == "docx":
        document = Document()
        document.add_heading(title, 0)
        for number, recording in enumerate(request.recordings, 1):
            document.add_heading(f"{number}. {recording.name}", level=1)
            for line in recording.text.splitlines():
                document.add_paragraph(line)
        document.save(output)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    else:
        styles = getSampleStyleSheet()
        sections = [Paragraph(title, styles["Title"])]
        for number, recording in enumerate(request.recordings, 1):
            sections.append(Paragraph(escape(f"{number}. {recording.name}"), styles["Heading2"]))
            for line in recording.text.splitlines():
                sections.append(Paragraph(escape(line), styles["BodyText"]))
        SimpleDocTemplate(output, title=title, pagesize=A4).build(sections)
        media_type = "application/pdf"

    return Response(output.getvalue(), media_type=media_type, headers={
        "Content-Disposition": f'attachment; filename="trascrizione-lezioni.{request.format}"',
        "Cache-Control": "no-store",
    })
