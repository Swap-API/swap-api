#!/usr/bin/env tsx
// Test script for MCP server - sends JSON-RPC messages via stdin

import { spawn, ChildProcess } from 'child_process';

interface JsonRpcMessage {
  jsonrpc: string;
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

const server: ChildProcess = spawn('npx', ['tsx', 'mcp-server.ts'], {
  cwd: '/Users/slickback/Desktop/misc/swap-api/swap-api/mcp',
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer: string = '';

server.stdout?.on('data', (data: Buffer) => {
  buffer += data.toString();
  
  // Parse JSON-RPC messages (newline delimited)
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const msg: JsonRpcMessage = JSON.parse(line);
        console.log('📨 Response:', JSON.stringify(msg, null, 2));
      } catch {
        console.log('📄 Raw:', line);
      }
    }
  }
});

server.stderr?.on('data', (data: Buffer) => {
  console.log('⚠️  stderr:', data.toString());
});

function send(msg: JsonRpcMessage): void {
  const line = JSON.stringify(msg);
  console.log('📤 Sending:', line);
  server.stdin?.write(line + '\n');
}

// Wait for server to start
setTimeout((): void => {
  // 1. Initialize
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0" }
    }
  });

  // 2. List tools
  setTimeout((): void => {
    send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    });
  }, 100);

  // 3. Test swap_tokens
  setTimeout((): void => {
    send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "swap_tokens",
        arguments: {
          chainId: 8453,
          tokenIn: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          tokenOut: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          amountIn: "1000000000000000",
          sender: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        }
      }
    });
  }, 200);

  // 4. Exit
  setTimeout((): void => {
    server.kill();
    console.log('\n✅ Test complete');
  }, 5000);
}, 100);
