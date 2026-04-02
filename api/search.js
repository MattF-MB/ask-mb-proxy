export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { query } = req.body;

  const response = await fetch(
    `${process.env.PINECONE_HOST}/records/namespaces/ask-mb/search`,
    {
      method: 'POST',
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY,
        'Content-Type': 'application/json',
        'X-Pinecone-API-Version': '2025-04',
      },
      body: JSON.stringify({
        query: { inputs: { text: query }, top_k: 5 },
        fields: ['text', 'filename'],
      }),
    }
  );

  const data = await response.json();
  return res.status(200).json(data);
}
