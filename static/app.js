const files = document.querySelector('#files');
const drop = document.querySelector('#drop');
const queue = document.querySelector('#queue');
const form = document.querySelector('#workflow');
const start = document.querySelector('#start');
const download = document.querySelector('#download');
const progress = document.querySelector('#progress');
const bar = document.querySelector('#bar');
const status = document.querySelector('#status');
const error = document.querySelector('#error');
const formats = Array.from(document.querySelectorAll('[name="format"]'));
const recordings = [];
let running = false;
let lastDocument;

function clearResult() {
  lastDocument = undefined;
  progress.hidden = true;
  status.textContent = '';
  error.textContent = '';
}

function render() {
  files.disabled = running || recordings.length >= 30;
  start.disabled = running || recordings.length === 0;
  download.hidden = !lastDocument || running;
  formats.forEach(input => { input.disabled = running; });
  queue.replaceChildren();

  recordings.forEach((recording, index) => {
    const row = document.createElement('li');
    row.innerHTML = '<span class="number"></span><span class="file-info"><b></b><small></small></span><span class="controls"></span>';
    row.querySelector('.number').textContent = index + 1;
    row.querySelector('b').textContent = recording.file.name;
    row.querySelector('small').textContent = recording.state;

    const actions = [
      ['↑', 'Sposta su', index === 0, () => {
        [recordings[index - 1], recordings[index]] = [recordings[index], recordings[index - 1]];
      }],
      ['↓', 'Sposta giù', index === recordings.length - 1, () => {
        [recordings[index], recordings[index + 1]] = [recordings[index + 1], recordings[index]];
      }],
      ['×', 'Rimuovi', false, () => recordings.splice(index, 1)],
    ];
    for (const [icon, label, disabled, action] of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = icon;
      button.title = label;
      button.setAttribute('aria-label', label + ' ' + recording.file.name);
      button.disabled = running || disabled;
      button.onclick = () => {
        action();
        clearResult();
        render();
        const updated = Array.from(queue.children).find(item =>
          item.querySelector('b').textContent === recording.file.name);
        const target = updated || queue.children[Math.min(index, recordings.length - 1)];
        (target?.querySelector('button:not(:disabled)') || files).focus();
      };
      row.querySelector('.controls').append(button);
    }
    queue.append(row);
  });
}

function addFiles(selection) {
  if (running) return;
  const issues = [];
  let added = false;
  for (const file of selection) {
    if (recordings.length === 30) {
      issues.push('Puoi aggiungere al massimo 30 registrazioni.');
      break;
    }
    if (!/\.(mp3|wav|m4a|aac|ogg|opus|flac|webm|mp4)$/i.test(file.name)) {
      issues.push(file.name + ' · formato non supportato.');
    } else if (!file.size || file.size > 250 * 1024 * 1024) {
      issues.push(file.name + ' · il file deve contenere audio e pesare al massimo 250 MB.');
    } else {
      recordings.push({ file, state: 'In attesa' });
      added = true;
    }
  }
  if (added) clearResult();
  error.textContent = issues.join(' ');
  render();
}

files.addEventListener('change', () => {
  addFiles(files.files);
  files.value = '';
});
drop.addEventListener('dragover', event => {
  event.preventDefault();
  if (!files.disabled) drop.classList.add('dragging');
});
drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
drop.addEventListener('drop', event => {
  event.preventDefault();
  drop.classList.remove('dragging');
  addFiles(event.dataTransfer.files);
});
formats.forEach(input => input.addEventListener('change', () => {
  clearResult();
  render();
}));

async function post(url, options) {
  const response = await fetch(url, { method: 'POST', ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Richiesta non riuscita. Riprova.');
  }
  return response;
}

function saveDocument() {
  const url = URL.createObjectURL(lastDocument.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'trascrizione-lezioni.' + lastDocument.format;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

download.addEventListener('click', saveDocument);
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (running || !recordings.length) return;
  const format = new FormData(form).get('format');
  clearResult();
  running = true;
  progress.hidden = false;
  bar.max = recordings.length;
  bar.value = 0;
  let active;
  try {
    for (const [index, recording] of recordings.entries()) {
      if (!recording.text) {
        active = recording;
        recording.state = 'Trascrizione in corso';
        status.textContent = 'Elaborazione audio ' + (index + 1) + ' di ' + recordings.length + '. Al primo utilizzo Whisper scarica il modello.';
        render();
        const data = new FormData();
        data.append('file', recording.file);
        const response = await post('/api/transcribe', { body: data });
        ({ text: recording.text } = await response.json());
        recording.state = 'Trascritto';
        active = undefined;
      }
      bar.value = index + 1;
      render();
    }
    status.textContent = 'Preparazione del documento…';
    const response = await post('/api/export', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format,
        recordings: recordings.map(({ file, text }) => ({ name: file.name, text })),
      }),
    });
    lastDocument = { blob: await response.blob(), format };
    saveDocument();
    status.textContent = 'Documento pronto · ' + recordings.length + (recordings.length === 1 ? ' audio trascritto.' : ' audio trascritti.');
  } catch (failure) {
    if (active) active.state = 'Da riprovare';
    error.textContent = (active ? active.file.name + ' · ' : '') + failure.message;
    status.textContent = '';
  } finally {
    running = false;
    render();
  }
});
