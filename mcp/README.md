# SwapAPI MCP Server

MCP (Model Context Protocol) server for SwapAPI. Enables AI agents to get executable token swap calldata for any EVM chain.

## Installation

```bash
npm install -g @swapapi/mcp
```

Or use directly with npx:

```bash
npx @swapapi/mcp
```

## Client Configuration

### Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "swapapi": {
      "command": "npx",
      "args": ["@swapapi/mcp"]
    }
  }
}
```

Or with a local install:

```json
{
  "mcpServers": {
    "swapapi": {
      "command": "npx",
      "args": ["tsx", "/path/to/swap-api/mcp/mcp-server.ts"]
    }
  }
}
```

### Cursor

Add to your Cursor settings (Settings → MCP):

```json
{
  "mcpServers": {
    "swapapi": {
      "command": "npx",
      "args": ["@swapapi/mcp"]
    }
  }
}
```

### Other Clients

Any MCP-compatible client can use the same configuration format. Check your client's documentation for where to add MCP server settings.

## Available Tools

### `swap_tokens`

Get executable transaction data to swap tokens on EVM chains.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chainId` | `number` | Yes | Chain ID (1=Ethereum, 8453=Base, 42161=Arbitrum, etc.) |
| `tokenIn` | `string` | Yes | Input token address. Use `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for native token (ETH, MATIC, etc.) |
| `tokenOut` | `string` | Yes | Output token address |
| `amountIn` | `string` | Yes | Amount in smallest unit (wei for 18-decimal tokens, micro-units for 6-decimal tokens) |
| `sender` | `string` | Yes | Wallet address that will sign and send the transaction |
| `maxSlippage` | `number` | No | Max slippage tolerance 0-1 (default: 0.005 = 0.5%) |

**Returns:**

```json
{
  "to": "0x...",           // Router contract address to call
  "data": "0x...",         // ABI-encoded swap calldata
  "value": "1000000000000000000",  // Native token value (if swapping from native)
  "gas": "150000",         // Estimated gas limit
  "guaranteedOut": "..."   // Minimum output amount after slippage
}
```

## Examples

### Swap 0.001 ETH to USDC on Base

```json
{
  "chainId": 8453,
  "tokenIn": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "tokenOut": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "amountIn": "1000000000000000",
  "sender": "0xYourAddress"
}
```

### Swap USDC to ETH on Arbitrum with 1% slippage

```json
{
  "chainId": 42161,
  "tokenIn": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "tokenOut": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "amountIn": "10000000",
  "sender": "0xYourAddress",
  "maxSlippage": 0.01
}
```

## Pre-flight Checklist

Before submitting any swap transaction:

1. **ERC-20 Approval**: If `tokenIn` is not native token, ensure sender has approved the router for at least `amountIn`
2. **Balance Check**: Verify sender has sufficient balance for `amountIn` (plus `value` if native token)
3. **Gas Estimation**: Call `eth_estimateGas` on the transaction and add 20% buffer
4. **Simulation**: Run `eth_call` to verify the transaction won't revert
5. **Timing**: Submit within 30 seconds of fetching the quote (calldata has expiry)

See the main [README.md](../README.md) for full API documentation.

## Development

```bash
cd mcp
npm install
npm start
```

### Testing

Run the test suite:

```bash
npm test
```

Or use the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector tsx mcp-server.ts
```

## License

MIT
