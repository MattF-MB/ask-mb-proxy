const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { query } = req.body;
    const host = process.env.PINECONE_HOST.replace('https://', '');
    
    const body = JSON.stringify({
      query: { inputs: { text: query }, top_k: 5 },
      fields: ['text', 'filename'],
    });

    const response = await new Promise((resolve, reject) => {
      const reqOptions = {
        hostname: host,
        path: '/records/namespaces/ask-mb/search',
        method: 'POST',
        headers: {
          'Api-Key': process.env.PINECONE_API_KEY,
          'Content-Type': 'application/json',
          'X-Pinecone-API-Version': '2025-04',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const request = https.request(reqOptions, (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => resolve(JSON.parse(data)));
      });
      request.on('error', reject);
      request.write(body);
      request.end();
    });

    return res.status(200).json(response);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
