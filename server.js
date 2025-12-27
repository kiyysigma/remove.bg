// Simple Express server that proxies an uploaded image to remove.bg using an API key
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const cors = require('cors');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.REMOVE_BG_API_KEY;

if (!API_KEY) {
  console.error('ERROR: REMOVE_BG_API_KEY is not set. Create a .env file or set the environment variable.');
  // process.exit(1); // Optional: don't exit to allow running without key if user only wants static files
}

app.use(cors());
app.use(express.static('public'));

// Endpoint: POST /remove
// Body: multipart/form-data with file field named 'image'
app.post('/remove', upload.single('image'), async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server not configured with REMOVE_BG_API_KEY' });
  if (!req.file) return res.status(400).json({ error: 'No image uploaded. Form field name must be "image".' });

  try {
    const form = new FormData();
    // append file buffer; remove.bg accepts image_file field
    form.append('image_file', req.file.buffer, {
      filename: req.file.originalname || 'upload.jpg',
      contentType: req.file.mimetype || 'image/jpeg'
    });
    // optional param: size=auto or other options
    form.append('size', 'auto');

    const headers = {
      ...form.getHeaders(),
      'X-Api-Key': API_KEY
    };

    const resp = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
      headers,
      responseType: 'arraybuffer', // get image bytes
      validateStatus: null
    });

    if (resp.status !== 200) {
      // forward error info
      let message = `remove.bg returned status ${resp.status}`;
      try {
        const txt = Buffer.from(resp.data).toString('utf8');
        message += `: ${txt}`;
      } catch (e) {}
      return res.status(502).json({ error: message });
    }

    // Return image bytes with correct content-type
    const contentType = resp.headers['content-type'] || 'image/png';
    res.set('Content-Type', contentType);
    res.send(Buffer.from(resp.data));
  } catch (err) {
    console.error('Proxy error:', err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'Error while contacting remove.bg API' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
