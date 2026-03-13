# Swap API

**Executable token swap calldata in one GET request.** No API keys. No accounts. No SDK bloat.

```
https://api.swapapi.xyz
```

---

## Quick Start

Swap 1 ETH for USDC on Ethereum:

```bash
curl "https://api.swapapi.xyz/v1/swap/1?\
tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&\
tokenOut=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&\
amount=1000000000000000000&\
sender=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

That's it. The response contains everything you need to sign and broadcast.

---

## Example Response

```json
{
  "success": true,
  "data": {
    "status": "Successful",
    "tokenFrom": {
      "address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      "symbol": "ETH",
      "name": "Ether",
      "decimals": 18
    },
    "tokenTo": {
      "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6
    },
    "swapPrice": 2435.12,
    "priceImpact": 0.0003,
    "amountIn": "1000000000000000000",
    "expectedAmountOut": "2435120000",
    "minAmountOut": "2422947280",
    "tx": {
      "from": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "to": "0x011E52E4E40CF9498c79e329EBc29ed08c8B5abB",
      "data": "0x2646478b...",
      "value": "1000000000000000000",
      "gasPrice": 30000000000,
      "gas": "250000"
    }
  },
  "timestamp": "2026-03-12T00:00:00.000Z"
}
```

| Field | Description |
|-------|-------------|
| `success` | Boolean indicating request success |
| `data.status` | `"Successful"`, `"Partial"`, or `"NoRoute"` |
| `data.tokenFrom/tokenTo` | Token metadata (address, symbol, decimals) |
| `data.swapPrice` | Exchange rate |
| `data.priceImpact` | Slippage impact (0.001 = 0.1%) |
| `data.expectedAmountOut` | Estimated output in token's smallest unit |
| `data.minAmountOut` | Guaranteed minimum (respects your `maxSlippage`) |
| `data.tx` | Transaction object ready to sign and send |

---

## API Reference

**Endpoint:** `GET /v1/swap/{chainId}`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `chainId` | path | Chain ID (1=Ethereum, 8453=Base, 42161=Arbitrum, etc.) |
| `tokenIn` | query | Input token address. Use `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for native ETH |
| `tokenOut` | query | Output token address |
| `amount` | query | Input amount in smallest unit (e.g., wei for ETH) |
| `sender` | query | Your wallet address (used to build the tx) |
| `maxSlippage` | query | Optional. 0-1 (default: 0.005 = 0.5%) |

**Response codes:**
- `200` — Quote ready
- `400` — Invalid params or unsupported chain
- `429` — Rate limit exceeded (60/min per IP)
- `502` — Upstream service error

---

## More Curl Examples

### Base (ETH → USDC)

```bash
curl "https://api.swapapi.xyz/v1/swap/8453?\
tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&\
tokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&\
amount=500000000000000000&\
sender=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

### Arbitrum (USDC → ETH with 1% slippage)

```bash
curl "https://api.swapapi.xyz/v1/swap/42161?\
tokenIn=0xaf88d065e77c8cC2239327C5EDb3A432268e5831&\
tokenOut=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&\
amount=1000000000&\
sender=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&\
maxSlippage=0.01"
```

### Ethereum Mainnet (DAI → USDC)

```bash
curl "https://api.swapapi.xyz/v1/swap/1?\
tokenIn=0x6B175474E89094C44Da98b954EedeAC495271d0F&\
tokenOut=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&\
amount=1000000000000000000000&\
sender=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

### Polygon (MATIC → USDC)

```bash
curl "https://api.swapapi.xyz/v1/swap/137?\
tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&\
tokenOut=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174&\
amount=10000000000000000000&\
sender=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

---

## Executing Swaps

The API gives you an unsigned transaction. Sign it and broadcast:

### With Foundry `cast`

```bash
# 1. Set swap parameters
CHAIN_ID=8453
TOKEN_IN=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
TOKEN_OUT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
AMOUNT=1000000000000000000
SENDER=0x...        # Your address
PRIVATE_KEY=0x...   # Your private key
RPC_URL=https://mainnet.base.org

# 2. Get swap quote
RESPONSE=$(curl -s "https://api.swapapi.xyz/v1/swap/$CHAIN_ID?\
tokenIn=$TOKEN_IN&\
tokenOut=$TOKEN_OUT&\
amount=$AMOUNT&\
sender=$SENDER")

# 3. Parse the tx fields
TX_TO=$(echo "$RESPONSE" | jq -r '.data.tx.to')
TX_DATA=$(echo "$RESPONSE" | jq -r '.data.tx.data')
TX_VALUE=$(echo "$RESPONSE" | jq -r '.data.tx.value')
TX_GAS=$(echo "$RESPONSE" | jq -r '.data.tx.gas')

# 4. Sign and send
cast send \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  "$TX_TO" \
  --value "$TX_VALUE" \
  --gas-limit "$TX_GAS" \
  --data "$TX_DATA"
```

### With viem

```typescript
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const account = privateKeyToAccount('0x...')

const client = createWalletClient({
  account,
  chain: base,
  transport: http()
})

const response = await fetch(
  'https://api.swapapi.xyz/v1/swap/8453?' +
  'tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&' +
  'tokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&' +
  'amount=1000000000000000000&' +
  'sender=' + account.address
)

const { data } = await response.json()

const hash = await client.sendTransaction({
  to: data.tx.to,
  data: data.tx.data,
  value: BigInt(data.tx.value),
  gas: BigInt(data.tx.gas)
})

await client.waitForTransactionReceipt({ hash })
```

## OpenAPI Spec

See [openapi.json](./openapi.json) for the full OpenAPI specification.

---

## Limits

- **Rate limit:** 60 requests/minute per IP
- **No authentication required**
- **Free to use**

---

## License

MIT
