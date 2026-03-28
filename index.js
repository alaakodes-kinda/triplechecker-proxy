const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/', (req, res) => res.json({ status: 'ok' }));

app.get('/fetch', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url= parameter' });
  try {
    const response = await axios.get(url, {
      timeout: 12000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      responseType: 'text',
    });
    res.set('Content-Type', 'text/html');
    res.send(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/check-link', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url= parameter' });
  try {
    const response = await axios.head(url, {
      timeout: 8000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 TripleChecker/1.0' },
      validateStatus: () => true,
    });
    res.json({ url, status: response.status, ok: response.status < 400 });
  } catch (err) {
    res.json({ url, status: 0, ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
