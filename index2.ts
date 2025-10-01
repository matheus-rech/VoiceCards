#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { initializeDatabase } from './database/client.js';
import { flashcardTools, handleToolCall } from './tools/flashcard-tools.js';

/**
 * Flashcard MCP Server
 * 
 * Voice-controlled spaced repetition learning system
 * Compatible with Anki decks, ElevenLabs, Alexa, Google Assistant, and more
 */

// Configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  process.exit(1);
}

// Initialize database connection
initializeDatabase(SUPABASE_URL, SUPABASE_KEY);

// Create MCP server
const server = new Server(
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

// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: flashcardTools,
  };
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  console.error(`[MCP] Tool called: ${name}`);
  console.error(`[MCP] Arguments:`, JSON.stringify(args, null, 2));
  
  try {
    const result = await handleToolCall(name, args);
    console.error(`[MCP] Tool ${name} completed successfully`);
    return result;
  } catch (error: any) {
    console.error(`[MCP] Tool ${name} failed:`, error.message);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: error.message,
          stack: error.stack
        })
      }],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  
  console.error('[MCP] Flashcard MCP Server starting...');
  console.error('[MCP] Connected to Supabase');
  console.error('[MCP] Ready to handle requests');
  
  await server.connect(transport);
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
