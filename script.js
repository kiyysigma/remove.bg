let model = null;
const statusEl = document.getElementById('status');
const fileInput = document.getElementById('fileInput');
const removeBtn = document.getElementById('removeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const origCanvas = document.getElementById('origCanvas');
const resultCanvas = document.getElementById('resultCanvas');
const thresholdRange = document.getElementById('threshold');
const thresholdVal = document.getElementById('thresholdVal');
const segmentType = document.getElementById('segmentType');

thresholdRange.addEventListener('input', () => {
  thresholdVal.textContent = parseFloat(thresholdRange.value).toFixed(2);
});

async function loadModel() {
  statusEl.textContent = 'Loading BodyPix model...';
  // Light-weight config for quicker load; change multiplier for quality
  model = await bodyPix.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 2
  });
  statusEl.textContent = 'Model loaded. Upload an image.';
}

function readImageToCanvas(file, canvas) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // set canvas size to image size (limit max dimension to avoid extreme sizes)
      const maxDim = 1200;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (Math.max(w, h) > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,w,h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve();
    };
    img.onerror = e => reject(e);
    img.src = URL.createObjectURL(file);
  });
}

fileInput.addEventListener('change', async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  statusEl.textContent = 'Loading image...';
  await readImageToCanvas(file, origCanvas);
  statusEl.textContent = 'Image ready. Click "Remove background".';
  removeBtn.disabled = false;
});

removeBtn.addEventListener('click', async () => {
  if (!model) {
    statusEl.textContent = 'Model not ready.';
    return;
  }
  statusEl.textContent = 'Running segmentation...';
  removeBtn.disabled = true;
  downloadBtn.disabled = true;

  const threshold = parseFloat(thresholdRange.value);
  const ctx = origCanvas.getContext('2d');
  const { width, height } = origCanvas;

  // get image data for output
  resultCanvas.width = width;
  resultCanvas.height = height;
  const rctx = resultCanvas.getContext('2d');
  rctx.clearRect(0,0,width,height);

  // pick segmentation function
  let segmentation = null;
  try {
    if (segmentType.value === 'person') {
      segmentation = await model.segmentPerson(origCanvas, {
        internalResolution: 'medium',
        segmentationThreshold: threshold
      });
    } else {
      segmentation = await model.segmentMultiPerson(origCanvas, {
        internalResolution: 'medium',
        segmentationThreshold: threshold
      });
      // convert multi-person to single mask (foreground if any person)
      const singleMask = new Uint8Array(segmentation.width * segmentation.height);
      for (let i = 0; i < segmentation.allPoses.length; i++) {
        const mask = segmentation.segmentationMap; // NOTE: bodyPix multi returns similar structure
        // If segmentation.segmentationMap already indicates persons, we use it directly
        // For some versions, segmentation is directly comparable to person; handle both.
      }
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Segmentation failed: ' + err.message;
    removeBtn.disabled = false;
    return;
  }

  // BodyPix may return different fields depending on function; use bodyPix.toMask helper
  // Create foreground mask where person(s) are true
  let mask;
  try {
    if (segmentType.value === 'person') {
      mask = bodyPix.toMask(segmentation);
    } else {
      // if segmentation already is array map:
      if (segmentation && segmentation.data) {
        mask = bodyPix.toMask(segmentation);
      } else {
        // Fallback: attempt to combine partSegmentation maps
        // For typical multi-person segmentation, call toMask also works
        mask = bodyPix.toMask(segmentation);
      }
    }
  } catch (err) {
    console.warn('toMask fallback', err);
    mask = bodyPix.toMask(segmentation);
  }

  // Draw original image to result canvas, then apply mask to set background transparent.
  rctx.drawImage(origCanvas, 0, 0, width, height);
  const imgData = rctx.getImageData(0,0,width,height);
  const data = imgData.data;
  const maskData = mask.data; // rgba mask (0 or 255)
  // mask.data is RGBA; we check alpha channel
  for (let i = 0, p = 0; i < data.length; i += 4, p += 4) {
    const alpha = maskData[p + 3]; // alpha 0 or 255
    if (alpha === 0) {
      // background -> make transparent
      data[i + 3] = 0;
    } else {
      // keep pixel (optional: enhance edges)
    }
  }
  rctx.putImageData(imgData, 0, 0);

  statusEl.textContent = 'Done. You can download the PNG.';
  downloadBtn.disabled = false;
  removeBtn.disabled = false;
});

downloadBtn.addEventListener('click', () => {
  const dataURL = resultCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = 'no-bg.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
});

// load model on start
loadModel().catch(err => {
  console.error(err);
  statusEl.textContent = 'Gagal memuat model: ' + err.message;
});
