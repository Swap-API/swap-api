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

server.registerPrompt("swap-guide", {
  description:
    "Step-by-step guide for executing a token swap using SwapAPI, including approval checks, simulation, and gas estimation",
}, async () => ({
  messages: [
    {
      role: "user",
      content: {
        type: "text",
        text: `You are executing a token swap via SwapAPI. Follow this checklist in order:

1. **Fetch quote** — call the swap_tokens tool with chainId, tokenIn, tokenOut, amountIn, and sender
2. **Check status** — the response must indicate success; if no route is found, try a different pair or reduce amount
3. **Price impact** — reject if price impact is worse than -5%
4. **ERC-20 approval** — if tokenIn is NOT the native token (0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE):
   - Check allowance: tokenIn.allowance(sender, tx.to)
   - If insufficient, send approve(tx.to, amountIn) and wait for confirmation
   - USDT on Ethereum: approve to 0 first, then approve to amountIn
   - After approval confirms, re-fetch a fresh quote (calldata has a 30s deadline)
5. **Balance check** — native: balance >= tx.value; ERC-20: balanceOf(sender) >= amountIn
6. **Gas estimation** — eth_estimateGas must succeed; multiply by 1.2 for gasLimit
7. **Simulation** — eth_call must not revert
8. **Submit** — send the transaction within 30 seconds of fetching the quote

Native token address (ETH/MATIC/BNB/AVAX): 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE (always 18 decimals)`,
      },
    },
  ],
}));

server.registerResource(
  "supported-chains",
  "swapapi://supported-chains",
  {
    description: "List of all EVM chains supported by SwapAPI with chain IDs",
    mimeType: "application/json",
  },
  async () => {
    const chains = [
      { id: 1, name: "Ethereum" },
      { id: 10, name: "Optimism" },
      { id: 25, name: "Cronos" },
      { id: 56, name: "BNB Chain" },
      { id: 100, name: "Gnosis" },
      { id: 106, name: "Velas" },
      { id: 122, name: "Fuse" },
      { id: 128, name: "Huobi ECO" },
      { id: 130, name: "Engram Testnet" },
      { id: 137, name: "Polygon" },
      { id: 146, name: "Sonic" },
      { id: 169, name: "Manta Pacific" },
      { id: 250, name: "Fantom" },
      { id: 252, name: "Fraxtal" },
      { id: 288, name: "Boba" },
      { id: 324, name: "zkSync Era" },
      { id: 480, name: "World Chain" },
      { id: 1088, name: "Metis" },
      { id: 1101, name: "Polygon zkEVM" },
      { id: 1116, name: "Core DAO" },
      { id: 1135, name: "Lisk" },
      { id: 1284, name: "Moonbeam" },
      { id: 1285, name: "Moonriver" },
      { id: 1625, name: "Gravity" },
      { id: 2741, name: "Abstract" },
      { id: 5000, name: "Mantle" },
      { id: 7560, name: "Cyber" },
      { id: 8453, name: "Base" },
      { id: 34443, name: "Mode" },
      { id: 42161, name: "Arbitrum One" },
      { id: 42170, name: "Arbitrum Nova" },
      { id: 42220, name: "Celo" },
      { id: 43114, name: "Avalanche" },
      { id: 48900, name: "Zircuit" },
      { id: 53457, name: "DODOchain" },
      { id: 57073, name: "Ink" },
      { id: 59144, name: "Linea" },
      { id: 80084, name: "Berachain bArtio" },
      { id: 80094, name: "Berachain" },
      { id: 81457, name: "Blast" },
      { id: 98865, name: "Plume" },
      { id: 167000, name: "Taiko" },
      { id: 534352, name: "Scroll" },
      { id: 543210, name: "Zero" },
      { id: 7777777, name: "Zora" },
      { id: 666666666, name: "Degen" },
    ];
    return {
      contents: [
        {
          uri: "swapapi://supported-chains",
          mimeType: "application/json",
          text: JSON.stringify(chains, null, 2),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
