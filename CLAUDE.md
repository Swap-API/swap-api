# SwapAPI

Returns ready-to-sign token swap calldata via a single GET request. No auth, no SDK, no accounts. Built for agents.

## Endpoint

```
GET {base}/v1/swap/{chainId}?tokenIn={address}&tokenOut={address}&amount={wei}&sender={address}&maxSlippage={0-1}
```

**Base URLs**
- Primary: `https://api.swapapi.dev`
- Fallback: `https://api-production-b91c.up.railway.app`

`maxSlippage` is optional (default `0.005` = 0.5%). All other params are required.

## Native Token Address

`0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` — always 18 decimals. Use for ETH, MATIC, BNB, AVAX, or any native gas token on any chain.

## Quick Example

```bash
# Swap 1 ETH → USDC on Base (chain 8453)
curl "https://api.swapapi.dev/v1/swap/8453?tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&tokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=1000000000000000000&sender=0xYourAddress"
```

See [`llms.txt`](llms.txt) for all 46 chain IDs and token addresses.

---

## Response

All responses return HTTP 200 with `{ success, data, timestamp }`. Check `data.status`:
- `"Successful"` — full fill, `tx` is ready to execute
- `"Partial"` — partial fill; `amountIn`, `expectedAmountOut`, and `tx.value` reflect the partial amount (not your requested amount)
- `"NoRoute"` — no path found; `tx` is absent; try a different pair

The tx object:
```json
{
  "from": "0x...sender",
  "to":   "0x...router",
  "data": "0x...calldata",   // opaque — do not decode or modify
  "value": "1000000000000000000",
  "gasPrice": 112737152
}
```

Human-readable output amount: `BigInt(expectedAmountOut) / 10n ** BigInt(tokenTo.decimals)`

---

## ERC-20 Approval

If `tokenIn` is not the native token (`0xEeee...`), the sender must approve the router before the swap can execute.

**Steps:**
1. Read current allowance: `tokenIn.allowance(sender, tx.to)`
2. If allowance < amountIn, send an approval tx:
   - USDT on Ethereum: call `approve(tx.to, 0)` first, wait for confirmation, then `approve(tx.to, amountIn)`
   - All other tokens: call `approve(tx.to, amountIn)` (or `type(uint256).max` for unlimited)
3. Wait for the approval tx to be confirmed
4. **Re-fetch a fresh quote** — do not reuse the pre-approval quote; calldata encodes a 30s deadline

**Cast example:**
```bash
cast send $TOKEN_ADDRESS \
  "approve(address,uint256)" $ROUTER $AMOUNT \
  --rpc-url $RPC --private-key $PK
```

**viem example:**
```ts
await walletClient.writeContract({
  address: tokenIn,
  abi: erc20Abi,
  functionName: 'approve',
  args: [tx.to, amountIn],
})
// wait for receipt, then re-fetch quote
```

---

## Gas Estimation

The tx object never includes `gasLimit`. You must estimate it:

```bash
cast estimate --rpc-url $RPC --from $SENDER --value $VALUE $TX_TO $TX_DATA
```

Add 20% buffer: `gasLimit = estimatedGas * 1.2`

If estimation fails, the swap would revert on-chain — do not submit.

---

## Simulation (eth_call)

Before submitting, simulate with `eth_call`. Free, catches reverts before spending gas.

```bash
cast call --rpc-url $RPC --from $SENDER --value $VALUE $TX_TO $TX_DATA
```

**viem:**
```ts
await publicClient.call({
  account: sender,
  to: tx.to as `0x${string}`,
  data: tx.data as `0x${string}`,
  value: BigInt(tx.value),
})
// throws if revert
```

Common revert causes: missing approval, insufficient balance, expired deadline (quote > 30s old).

---

## Pre-flight Checklist

Run these in order before submitting any swap:

1. Fetch quote — `GET /v1/swap/{chainId}?...`
2. Check `data.status` — must be `"Successful"` or `"Partial"`
3. Check `priceImpact` — reject if `< -0.05` (worse than -5%)
4. ERC-20 approval — if `tokenIn !== 0xEeee...`: check `allowance(sender, tx.to)`; approve if needed; wait for confirmation; re-fetch quote
5. Check balance — native: `balance >= tx.value`; ERC-20: `balanceOf(sender) >= amountIn`
6. `eth_estimateGas` — must succeed; multiply by 1.2 for `gasLimit`
7. `eth_call` — must not revert
8. Submit within 30 seconds of fetching the quote

---

## Tests

Use these to validate a swap integration. Each covers a distinct scenario.

### Test 1: Native → ERC-20 (happy path)

```bash
# 0.001 ETH → USDC on Base
curl "https://api.swapapi.dev/v1/swap/8453?tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&tokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=1000000000000000&sender=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

Expect: `success: true`, `data.status: "Successful"`, `data.tx.value: "1000000000000000"`, `data.tx.data` starts with `0x`

### Test 2: ERC-20 → Native (approval required)

```bash
# 10 USDC → ETH on Arbitrum
curl "https://api.swapapi.dev/v1/swap/42161?tokenIn=0xaf88d065e77c8cC2239327C5EDb3A432268e5831&tokenOut=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&amount=10000000&sender=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

Expect: `success: true`, `data.tx.value: "0"` (ERC-20 input means no ETH sent), `data.tx.to` is the router address to approve

### Test 3: ERC-20 → ERC-20 (stablecoin swap)

```bash
# 100 USDC → DAI on Ethereum
curl "https://api.swapapi.dev/v1/swap/1?tokenIn=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&tokenOut=0x6B175474E89094C44Da98b954EedeAC495271d0F&amount=100000000&sender=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

Expect: `success: true`, `data.tx.value: "0"`, `priceImpact` near 0 (liquid pair), `expectedAmountOut` ≈ `100000000000000000000` (100 DAI)

### Test 4: Custom slippage

```bash
# 1 ETH → USDC on Polygon with 1% slippage
curl "https://api.swapapi.dev/v1/swap/137?tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&tokenOut=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359&amount=1000000000000000000&sender=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&maxSlippage=0.01"
```

Expect: `minAmountOut` ≈ `expectedAmountOut * 0.99`

### Test 5: Invalid params → 400

```bash
# Missing sender param
curl "https://api.swapapi.dev/v1/swap/1?tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&tokenOut=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&amount=1000000000000000000"
```

Expect: `success: false`, `error.code: "INVALID_PARAMS"`, HTTP 400

### Test 6: Unsupported chain → 400

```bash
curl "https://api.swapapi.dev/v1/swap/99999?tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&tokenOut=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&amount=1000000000000000000&sender=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

Expect: `success: false`, `error.code: "UNSUPPORTED_CHAIN"`, HTTP 400

### Test 7: Health check

```bash
curl "https://api.swapapi.dev/health"
```

Expect: `{ "success": true, "data": { "status": "ok" } }`

### Test 8: Simulate + estimate gas + submit (viem)

```ts
const quote = await fetch(`https://api.swapapi.dev/v1/swap/8453?...`).then(r => r.json())
const { tx } = quote.data

// Simulate — throws if the swap would revert
await publicClient.call({
  account: sender,
  to: tx.to as `0x${string}`,
  data: tx.data as `0x${string}`,
  value: BigInt(tx.value),
})

// Estimate gas with 20% buffer
const gas = await publicClient.estimateGas({
  account: sender,
  to: tx.to as `0x${string}`,
  data: tx.data as `0x${string}`,
  value: BigInt(tx.value),
})

// Submit
const hash = await walletClient.sendTransaction({
  to: tx.to as `0x${string}`,
  data: tx.data as `0x${string}`,
  value: BigInt(tx.value),
  gas: (gas * 120n) / 100n,
})
```

### Test 9: Approval flow (ERC-20 input)

```ts
// 1. Fetch quote to get router address
const quote = await fetch(`https://api.swapapi.dev/v1/swap/42161?tokenIn=0xaf88...&...`).then(r => r.json())
const router = quote.data.tx.to

// 2. Check current allowance
const allowance = await publicClient.readContract({
  address: tokenIn,
  abi: erc20Abi,
  functionName: 'allowance',
  args: [sender, router],
})

// 3. Approve if needed
if (allowance < amountIn) {
  const hash = await walletClient.writeContract({
    address: tokenIn,
    abi: erc20Abi,
    functionName: 'approve',
    args: [router, maxUint256], // unlimited approval
  })
  await publicClient.waitForTransactionReceipt({ hash })
}

// 4. Re-fetch fresh quote (critical — old calldata has expired deadline)
const freshQuote = await fetch(`https://api.swapapi.dev/v1/swap/42161?tokenIn=0xaf88...&...`).then(r => r.json())
// now simulate, estimate gas, and submit
```

---

## QA: End-to-End Agent Test

Before marking any change to this repo as done, run this test to verify the full swap workflow works. Launch an agent with this exact prompt:

```
You are an autonomous agent in the middle of a task. Your objective is to swap 1 ETH
for USDC on Ethereum on behalf of your user, whose wallet is
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 (vitalik.eth).

You need to find a way to execute this swap programmatically. You just did a web
search and found this GitHub repo: https://github.com/swap-api/swap-api — it claims
to be a free token swap API for agents. Read the CLAUDE.md at
/home/qq/repos/swap-api/CLAUDE.md to understand how to use it, then carry out the
full swap workflow up until the point of actually submitting the transaction.

Work through it step by step as you would in a real task:

1. Read the docs to understand the API
2. Fetch a swap quote for 1 ETH → USDC on Ethereum (chain 1)
3. Parse the response — show the rate, price impact, expected output
4. Run through the pre-flight checklist (approval needed? balance check? price impact acceptable?)
5. Simulate the transaction with eth_call against the RPC provided in the response
6. Report the gas estimate
7. Show the final transaction that is ready to send — then STOP. Do not submit it.

Be explicit about each step as you go, as if narrating your actions to the user watching you work.
```

**Pass criteria:**
- Quote returns `status: "Successful"`
- Pre-flight checklist runs in full (approval check, balance check, price impact check)
- `eth_call` simulation succeeds without revert
- Gas is estimated with 20% buffer applied
- Agent stops before submitting — outputs the final tx but does not broadcast it

If any step fails, there is a bug in the docs, the API, or the workflow instructions.

---

## Conventions

- Do not add SDK wrappers or helper libraries around this API
- Do not abstract the HTTP call — the GET request is the interface
- Do not explain blockchain fundamentals — agents using this already know them
- Do not retry on `INVALID_PARAMS` or `UNSUPPORTED_CHAIN` — fix the request
- Do not retry `Partial` with the same amount — liquidity cap is fixed; reduce amount or change pair
