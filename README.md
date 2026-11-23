# Quaderno

Carica le registrazioni di una lezione, riordinale e scarica un documento PDF o Word con la trascrizione completa in italiano.

## Avvio

Serve Python 3.10–3.12. Dalla cartella del progetto:

```sh
python -m venv .venv
```

Attiva l'ambiente con `source .venv/bin/activate` su macOS/Linux oppure ` .venv\Scripts\Activate.ps1` in PowerShell. Poi esegui:

```sh
python -m pip install -r requirements.txt
python -m uvicorn app:app
```

Apri <http://127.0.0.1:8000>. Il primo audio avvia il download dei pesi di Whisper da Hugging Face e richiede Internet. Le trascrizioni avvengono sulla CPU del computer con faster-whisper, senza chiavi API o servizi a pagamento. Audio e trascrizioni non vengono salvati dall'app. Tieni aperta la scheda durante il lavoro.

Il modello predefinito è `small` (multilingue, quantizzato a 8 bit). Imposta la variabile d'ambiente `WHISPER_MODEL` a `medium` per provare un modello più grande, con maggiore uso di memoria e tempi di calcolo più lunghi.

Sono supportati fino a 30 file, ciascuno fino a 250 MB, in MP3, WAV, M4A, AAC, OGG, OPUS, FLAC, WebM e MP4.
