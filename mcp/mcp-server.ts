import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://api.swapapi.dev/v1";

const server = new McpServer({
  name: "swapapi",
  version: "0.0.1",
});

server.registerTool(
  "swap_tokens",
  {
    description: "Get executable call data to swap tokens on EVM chains. Returns transaction data ready to submit on-chain.",
    inputSchema: {
      chainId: z.number().describe("Chain ID (e.g., 1 for Ethereum, 8453 for Base)"),
      tokenIn: z.string().describe("Input token address (0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE for native token)"),
      tokenOut: z.string().describe("Output token address"),
      amountIn: z.string().describe("Amount in smallest unit (wei for ETH, 6 decimals for USDC, etc.)"),
      sender: z.string().describe("Sender wallet address that will sign the transaction"),
      maxSlippage: z.number().min(0).max(1).optional().describe("Max slippage tolerance as decimal 0-1 (default 0.005 = 0.5%)"),
    },
  },
  async ({ chainId, tokenIn, tokenOut, amountIn, sender, maxSlippage }) => {
    const url = new URL(`${API_BASE}/swap/${chainId}`);
    url.searchParams.set("tokenIn", tokenIn);
    url.searchParams.set("tokenOut", tokenOut);
    url.searchParams.set("amount", amountIn);
    url.searchParams.set("sender", sender);
    if (maxSlippage !== undefined) {
      url.searchParams.set("maxSlippage", String(maxSlippage));
    }

    const res = await fetch(url.toString());
    const data = await res.json();

    if (!data.success || !data.data.tx) {
      throw new Error(data.error?.message || `Swap failed: ${data.data?.status}`);
    }

    const tx = data.data.tx;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            to: tx.to,
            data: tx.data,
            value: tx.value,
            gas: tx.gas,
            guaranteedOut: data.data.minAmountOut,
          }),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
