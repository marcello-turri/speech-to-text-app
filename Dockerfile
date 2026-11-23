FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    WHISPER_MODEL=/opt/models/whisper-small \
    WHISPER_CPU_THREADS=2

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -c 'import os; from faster_whisper.utils import download_model; download_model("small", output_dir=os.environ["WHISPER_MODEL"])'

COPY --chown=10001:10001 app.py .
COPY --chown=10001:10001 static/ static/
USER 10001:10001
EXPOSE 8080
CMD ["sh", "-c", "exec hypercorn --bind 0.0.0.0:${PORT:-8080} app:app"]
