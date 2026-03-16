Execute a token swap using the SwapAPI.

When the user invokes /swap, guide them through the full swap workflow end-to-end:

## Step 1: Gather inputs

Ask for (or parse from the user's message if already provided):
- Chain name or ID (e.g. "Base" or "8453")
- Token in (symbol or address, e.g. "ETH" or "0xEeee...")
- Token out (symbol or address)
- Amount (human units, e.g. "1 ETH" or "100 USDC")
- Sender address (0x...)
- Slippage (optional, default 0.5%)

Resolve chain ID and token addresses using the tables in llms.txt. Use `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for any native gas token.

Convert human amount to wei: `amount * 10^decimals` (integer, no decimals in result).

## Step 2: Fetch quote

Build the URL and fetch it using WebFetch:

```
GET https://api.swapapi.dev/v1/swap/{chainId}?tokenIn={address}&tokenOut={address}&amount={wei}&sender={address}&maxSlippage={slippage}
```

If the primary URL fails, retry with `https://site-production-b91c.up.railway.app/v1/swap/{chainId}?...`

## Step 3: Parse and present

Show the user:
- Status (Successful / Partial / NoRoute)
- Human-readable amounts: `expectedAmountOut / 10^tokenTo.decimals`
- Price: `(expectedAmountOut / 10^tokenTo.decimals) / (amountIn / 10^tokenFrom.decimals)`
- Price impact (flag if worse than -5%)
- If Partial: note what partial amount was quoted vs what was requested
- If NoRoute: stop and suggest alternatives

## Step 4: Pre-flight checks

Walk through the checklist before offering to proceed:

1. **Price impact** — warn if `priceImpact < -0.05`
2. **ERC-20 approval** — if tokenIn is not `0xEeee...`:
   - Note that the user must call `approve(tx.to, amountIn)` on the tokenIn contract
   - Remind: USDT on Ethereum requires zeroing allowance first
   - Remind: re-fetch quote after approval confirms
3. **Balance check** — remind user to verify: native `balance >= tx.value` or ERC-20 `balanceOf >= amountIn`
4. **Gas estimation** — show the command to estimate gas; remind to add 20% buffer
5. **Simulation** — show the `cast call` or viem snippet to simulate before submitting
6. **30-second deadline** — note that calldata expires; re-fetch if delayed

## Step 5: Show execution

Present the ready-to-run commands for the user's preferred tooling.

**cast (Foundry):**
```bash
# Estimate gas
cast estimate --rpc-url RPC --from SENDER --value VALUE TX_TO TX_DATA

# Simulate
cast call --rpc-url RPC --from SENDER --value VALUE TX_TO TX_DATA

# Submit (fill in gasLimit from estimate * 1.2)
cast send TX_TO TX_DATA \
  --value VALUE \
  --rpc-url RPC \
  --private-key $PK \
  --gas GASLIMIT
```

**viem (TypeScript):**
```ts
// Simulate
await publicClient.call({ account: sender, to: tx.to, data: tx.data, value: BigInt(tx.value) })

// Estimate
const gas = await publicClient.estimateGas({ account: sender, to: tx.to, data: tx.data, value: BigInt(tx.value) })

// Submit
const hash = await walletClient.sendTransaction({
  to: tx.to, data: tx.data, value: BigInt(tx.value),
  gas: (gas * 120n) / 100n,
})
```

Fill in the actual values from `data.tx` — `TX_TO` = `tx.to`, `TX_DATA` = `tx.data`, `VALUE` = `tx.value`.

## Notes

- Do not decode or modify `tx.data`
- If the user wants to approve first, remind them to re-fetch the quote after the approval confirms
- If status is NoRoute, suggest: different amount, different pair, or checking if the token is supported on that chain
- Rate limit is ~30 req/min — if 429, wait 5-10 seconds and retry with exponential backoff
