const https = require('https');

async function makePOST(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
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
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS' || req.method === 'GET') {
    return res.status(200).json({ status: 'ok' });
  }

  try {
    const { query, type } = req.body;

    if (type === 'claude') {
      const { question, context } = req.body;
      const response = await makePOST('api.anthropic.com', '/v1/messages',
        { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are Ask MB, a helpful internal AI assistant for Magical Beginnings, an early childhood education company. Answer the employee's question using ONLY the document excerpts provided. Be clear, helpful, and concise. If the answer is not in the excerpts, say so and suggest contacting HR or their manager.`,
          messages: [{ role: 'user', content: `Question: ${question}\n\nRelevant excerpts:\n\n${context}` }],
        }
      );
      return res.status(200).json(response);
    }

    const host = process.env.PINECONE_HOST.replace('https://', '');
    const response = await makePOST(
      host,
      '/records/namespaces/ask-mb/search',
      { 'Api-Key': process.env.PINECONE_API_KEY, 'X-Pinecone-API-Version': '2025-04' },
      { query: { inputs: { text: query }, top_k: 5 }, fields: ['text', 'filename'] }
    );
    return res.status(200).json(response);

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
