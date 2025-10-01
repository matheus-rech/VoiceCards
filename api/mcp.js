// Vercel serverless function wrapper for MCP server
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebSocketServerTransport } from '@modelcontextprotocol/sdk/server/websocket.js';
import { initializeDatabase } from '../dist/client.js';
import { flashcardTools, handleToolCall } from '../dist/flashcard-tools.js';

let server;

function initServer() {
  if (server) return server;

  // Initialize database
  initializeDatabase(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // Create MCP server
  server = new Server(
    {
      name: 'flashcard-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register handlers
  server.setRequestHandler('tools/list', async () => ({
    tools: flashcardTools,
  }));

  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    return await handleToolCall(name, args);
  });

  return server;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      name: 'flashcard-mcp-server',
      version: '1.0.0',
      status: 'ready'
    });
  }

  if (req.method === 'POST') {
    try {
      const server = initServer();
      const { method, params } = req.body;

      // Route to appropriate handler
      let result;
      if (method === 'tools/list') {
        result = await server._handlers.get('tools/list')();
      } else if (method === 'tools/call') {
        result = await server._handlers.get('tools/call')({ params });
      } else {
        return res.status(400).json({ error: 'Unknown method' });
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('MCP Error:', error);
      return res.status(500).json({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}