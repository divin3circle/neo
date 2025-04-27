# NEO -> 0.0.5913311

## Key Details

1. Neo Agent Account -> 0.0.5913311
1. Mock USDC token -> 0.0.5791936
1. Sample topic with test user account ->

## Consumptions

To effectively perform rebalancing Neo will uses the following.

### On-Chain Data

- User's token balances
- Token prices
- Historical transactions by the user or rebalancing decisions
- Hashes & real-time historical reads using mirror node apis

### Off-Chain Data

- NSE Shares & Stock prices held by the user
- New around shares and stocks being held by the user or those of interest to him
- M-Pesa transaction info
- User defined constraints

## Actions Logic

### Rebalancing

Neo will perform a portfolio rebalance when one or more of the following conditions/actions are triggered:

1. Portfolio deviates from target allocations or user constraints
1. Market volatility suggest safe diversifications
1. A sentiment shift in the market or news flag a risky holding

The steps for rebalancing is as follows but not restricted to:

- Fetch current portfolio balances from a user's Hedera account and broker portfolio
- Compare the portfolio against user's target allocation or an AI model or both
- Calculate required actions, swap over-presented tokens for USDC or other under-presented tokens
- Estimate fees and slippage
- Prepare and sign the transaction using Hedera Agent Kit with user's prior consent
- Log the rebalancing action into the user-agent or agent-agent private topic

### Minting/Redeeming

Minting of tokens would be against user's deposited fiat or USDC holding within the app. Similarly redeeming would be to USDC or fiat that can be withdrawn to M-pesa by the user.

#### Criteria

Just as the rebalancing logic, Neo will check the user's current holding stocks-wise and token wise, previous logs and their outcomes plus market sentiment and news flags to determine the best action to perform on a token/share in holding by the user.

## Logging & Learning

Each action, i.e. rebalancing, minting or redeeming by Neo will be logged to HCS as a topic, and or saved in a database for learning purposes and review. With these memory Neo can get smarter without the need to train while adapting to a user's specific habits, appetite and the market it finds itself in.
The goal is to have Neo capable of executing transactions on the blockchain, able to justify decision and learn from old mistakes to continuously improve.

Neo creates a topic with the HIP 991 standard, with a custom fee of 0.1 USDC(now they user has a reason to deposit USDC via M-Pesa). Each user prompts is treated a message subscription paid to the AI agent. The communication is done over HCS-10.
