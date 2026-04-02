const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS' || req.method === 'GET') {
    return res.status(200).json({ status: 'ok' });
  }

  try {
    const body = req.body;
    const query = body?.query || '';
    const host = process.env.PINECONE_HOST.replace('https://', '');

    const payload = JSON.stringify({
      query: { inputs: { text: query }, top_k: 5 },
      fields: ['text', 'filename'],
    });

    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: host,
        path: '/records/namespaces/ask-mb/search',
        method: 'POST',
        headers: {
          'Api-Key': process.env.PINECONE_API_KEY,
          'Content-Type': 'application/json',
          'X-Pinecone-API-Version': '2025-04',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const r = https.request(options, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch(e) { reject(new Error('Parse error: ' + data)); }
        });
      });
      r.on('error', reject);
      r.write(payload);
      r.end();
    });

    return res.status(200).json(response);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
