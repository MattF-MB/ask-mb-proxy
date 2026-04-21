export const config = { runtime: 'edge' };

const TOOLS = [{
  name: "search_documents",
  description: "Search Magical Beginnings company documents including policies, handbooks, and procedures.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The question or topic to search for" }
    },
    required: ["query"]
  }
}];

async function searchPinecone(query) {
  // Embed the query
  const embedRes = await fetch("https://api.pinecone.io/embed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": process.env.PINECONE_API_KEY
    },
    body: JSON.stringify({
      model: "multilingual-e5-large",
      inputs: [{ text: query }]
    })
  });
  const embedData = await embedRes.json();
  const vector = embedData.data[0].values;

  // Query Pinecone
  const searchRes = await fetch(`${process.env.PINECONE_HOST}/records/namespaces/ns1/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": process.env.PINECONE_API_KEY
    },
    body: JSON.stringify({ vector, topK: 5, includeFields: ["text", "source"] })
  });
  const searchData = await searchRes.json();
  return searchData.result?.hits || [];
}

async function askClaude(query, chunks) {
  const context = chunks.map(h => h.fields?.text || "").join("\n\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: "You are Ask MB, the internal assistant for Magical Beginnings. Answer questions using only the provided company documents. Be concise and helpful.",
      messages: [{ role: "user", content: `Context:\n${context}\n\nQuestion: ${query}` }]
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || "No answer found.";
}

export default async function handler(req) {
  if (req.method === "GET") {
    // SSE handshake
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          `event: endpoint\ndata: ${new URL(req.url).origin}/api/mcp\n\n`
        ));
      }
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const { method, params, id } = body;

    let result;

    if (method === "initialize") {
      result = {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "ask-mb", version: "1.0.0" }
      };
    } else if (method === "tools/list") {
      result = { tools: TOOLS };
    } else if (method === "tools/call" && params?.name === "search_documents") {
      const query = params.arguments?.query;
      const chunks = await searchPinecone(query);
      const answer = await askClaude(query, chunks);
      result = {
        content: [{ type: "text", text: answer }]
      };
    } else {
      result = {};
    }

    return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  return new Response("Method not allowed", { status: 405 });
}
