# Nota

Carica le registrazioni di una lezione, riordinale e scarica un documento PDF o Word con la trascrizione completa in italiano.

## Avvio

Serve Python 3.10–3.12. Dalla cartella del progetto:

```sh
python -m venv .venv
```

Attiva l'ambiente con `source .venv/bin/activate` su macOS/Linux oppure `.venv\Scripts\Activate.ps1` in PowerShell. Poi esegui:

```sh
python -m pip install -r requirements.txt
python -m uvicorn app:app
```

Apri <http://127.0.0.1:8000>. Il primo audio avvia il download dei pesi di Whisper da Hugging Face e richiede Internet. Le trascrizioni avvengono sulla CPU del computer con faster-whisper, senza chiavi API o servizi a pagamento. Audio e trascrizioni non vengono salvati dall'app. Tieni aperta la scheda durante il lavoro.

Il modello predefinito è `small` (multilingue, quantizzato a 8 bit). Imposta la variabile d'ambiente `WHISPER_MODEL` a `medium` per provare un modello più grande, con maggiore uso di memoria e tempi di calcolo più lunghi.

Sono supportati fino a 30 file, ciascuno fino a 250 MB, in MP3, WAV, M4A, AAC, OGG, OPUS, FLAC, WebM e MP4.

## Cloud Run

Il container include Whisper `small` e lo esegue in INT8 su CPU. Il download
del modello avviene durante la build. Il deploy usa Milano (`europe-west8`) per
impostazione predefinita, 2 vCPU, 4 GiB, fatturazione a richiesta e zero istanze
minime. Il servizio accetta una trascrizione alla volta e può scalare fino a
un'istanza. HTTP/2 end-to-end consente il caricamento dei file fino a 250 MB senza
un bucket per le registrazioni. Gli audio non vengono conservati tra richieste.

Da Cloud Shell o da un terminale con Google Cloud CLI autenticata, usa un
progetto con fatturazione attiva e permessi di deploy da sorgente. Alla prima
esecuzione, Google Cloud può chiedere di abilitare Cloud Run, Cloud Build e
Artifact Registry e di creare il repository per le immagini.

```sh
./deploy-cloud-run.sh PROJECT_ID
gcloud run services proxy nota --project=PROJECT_ID --region=europe-west8 --port=8080
```

Apri <http://127.0.0.1:8080> dal computer che esegue il proxy, oppure usa
**Anteprima web** sulla porta 8080 in Cloud Shell. Il servizio è privato e il
proxy usa l'account Google Cloud attivo, che deve avere il permesso di invocarlo.
Il timeout è di 60 minuti per richiesta. Se una singola registrazione richiede
più tempo, suddividila e carica le parti nell'ordine desiderato.

Cloud Run fattura il tempo di elaborazione. Anche le build e le immagini
conservate in Artifact Registry possono generare costi.
