const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', service: 'TripleChecker Proxy' }));

// Fetch any public URL
app.get('/fetch', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url= parameter' });
  try {
    const response = await axios.get(url, {
      timeout: 12000, maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      responseType: 'text',
    });
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: `Failed to fetch: ${err.message}` });
  }
});

// Check link status
app.get('/check-link', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url= parameter' });
  try {
    const response = await axios.head(url, {
      timeout: 8000, maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 TripleChecker/1.0' },
      validateStatus: () => true,
    });
    res.json({ url, status: response.status, ok: response.status < 400 });
  } catch (err) {
    res.json({ url, status: 0, ok: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════
// ARABIC CHECKING via Groq API (free, runs Llama3)
// Groq is free tier: 30 req/min, 6000 tokens/min
// Sign up at console.groq.com — takes 2 minutes
// ══════════════════════════════════════════════════════
app.post('/arabic-check', async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.json({ errors: [] });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    return res.status(503).json({ error: 'GROQ_API_KEY not set', errors: [] });
  }

  const prompt = `أنت محرر لغوي عربي خبير. مهمتك: فحص النص التالي وإيجاد الأخطاء الإملائية والنحوية فقط.

قواعد مهمة:
- أعد JSON فقط بدون أي نص إضافي
- لا تصحح الأسماء الأجنبية أو العلامات التجارية
- ركز على الأخطاء الواضحة فقط
- إذا لم توجد أخطاء أعد []

التنسيق المطلوب:
[{"type":"spelling","wrong":"الكلمة الخاطئة","fix":"الكلمة الصحيحة","context":"جملة قصيرة تحتوي الخطأ","message":"وصف قصير للخطأ"}]

النص للفحص:
${text.slice(0, 3000)}`;

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1000,
    }, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 25000,
    });

    const content = response.data.choices[0]?.message?.content || '[]';
    // Extract JSON array from response
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return res.json({ errors: [] });

    const errors = JSON.parse(match[0]);
    // Validate and clean
    const clean = errors
      .filter(e => e.wrong && e.fix && e.type && e.wrong.length > 1)
      .filter(e => /[\u0600-\u06FF]/.test(e.wrong)) // must contain Arabic
      .slice(0, 20);

    res.json({ errors: clean, model: 'llama3-8b-8192' });
  } catch (err) {
    console.error('Arabic check error:', err.message);
    res.status(500).json({ error: err.message, errors: [] });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`TripleChecker proxy running on port ${PORT}`));
