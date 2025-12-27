const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const statusEl = document.getElementById('status');
const origImg = document.getElementById('origImg');
const resultImg = document.getElementById('resultImg');
const downloadLink = document.getElementById('downloadLink');

let selectedFile = null;
fileInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) {
    selectedFile = null;
    uploadBtn.disabled = true;
    origImg.src = '';
    return;
  }
  selectedFile = f;
  uploadBtn.disabled = false;
  origImg.src = URL.createObjectURL(f);
  resultImg.src = '';
  downloadLink.style.display = 'none';
  statusEl.textContent = 'File siap. Klik "Remove background".';
});

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  uploadBtn.disabled = true;
  statusEl.textContent = 'Mengunggah & memproses...';
  try {
    const fd = new FormData();
    fd.append('image', selectedFile, selectedFile.name);

    const resp = await fetch('/remove', {
      method: 'POST',
      body: fd
    });

    if (!resp.ok) {
      const json = await resp.json().catch(()=>null);
      const msg = json?.error || `Server responded ${resp.status}`;
      statusEl.textContent = 'Gagal: ' + msg;
      uploadBtn.disabled = false;
      return;
    }

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    resultImg.src = url;
    downloadLink.href = url;
    downloadLink.download = 'no-bg.png';
    downloadLink.textContent = 'Download PNG';
    downloadLink.style.display = 'inline-block';
    statusEl.textContent = 'Selesai — hasil siap diunduh.';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Kesalahan jaringan: ' + err.message;
  } finally {
    uploadBtn.disabled = false;
  }
});
