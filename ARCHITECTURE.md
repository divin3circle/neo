# Architecture Design: Neo - The Intelligent Agent

## ⚙️ Core Components

### A. Agent Controller

Responsible of handling the decision engine for portfolio analysis, trade suggestions and rebalance triggers. Interfaces with Hedera Agent Kit for blockchain actions. Also responsible for interfacing with Anthropic's MCP SDK for reflection, memory, and reasoning.

### B. Memory Architecture

Neo posses a three dimensional memory architecture as outlined below:

- Short-term memory: Stored on the client side,and includes light-weight information such as last portfolio check, user's risk mode and references
- Context memory: Lies in the MCP memory via the SDK and includes Neo's contextual information such as trade rationale, thoughts, learning and past feedback.
- Long-term memory: Stored and processed on the server side. Features data such as full action logs, historical performances, and trading patterns.

## 🔂 Agent Workflow

### 🧩 Trigger Layer

These are the triggers that are responsible for bringing Neo online.

- User initiated: Via a button click or voice command.
- Scheduled: Portfolio rebalancing happens daily/weekly etc.
- Event-based: Price deviation falls below 10%, or a news signal flags potential opportunity or risk

### 📡 Data Layer

Assemble all required data and process them in a correct manner for easier and efficient decision making process.

- Fetch user token holding data using mirror node or Hedera Agent Kit.
- Fetch user portfolio data from the broker
- Get NSE stock prices held by the user and their meta data(recent news)
- Retrieve user preferences such as risk appetite, sectors and timezone.
- Format and aggregate the above information effectively.

### 🧠 Decision Layer

Feeding the aggregated data to the decision layer, Neo uses MCP SDK to reason through the data and generate a plan for one or more of the actions below:

- Rebalancing required? Which tokens to swap?
- Mint/Redeem required? What's the liquidity data on-chain and of-chain of the token in question
- Action priority + rationale

After coming up with a decision and rationale write the rationale to the contextual memory.

### 🔐 Action Layer

Using the rationale from the previous step Neo uses the Hedera Agent Kit o perform on-chain actions such as minting and swapping. Additionally for off-chain actions, the agent users the broker endpoints to carry out actions such as stock sell and purchase.

### 🧾 Logging Layer

After a transaction goes through the backend database and the context memory are updated with full detailed logs and the decision context. Neo will continuously check on the outcome of the decision and update the transactions. Since each decision will also be an HCS topic Neo also sends message to the topic on the outcome of the action, these offers an immutable record of decision that Neo can refer to at a later stage and learn from.

### 📚 Learning & Feedback Layer

- MCP compares predicted vs actual outcomes, i.e. `Did the portfolio improve?`
- Stores evaluation and self-feedback, i.e. `Selling KCB was suboptimal under these conditions.`
- Improve future decision logic based on outcomes
