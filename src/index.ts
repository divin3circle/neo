import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  CreateFTOptions,
  CreateNFTOptions,
  HederaAgentKit,
  HederaNetworkType,
} from "hedera-agent-kit";
import {
  AccountId,
  Client,
  CustomFixedFee,
  Hbar,
  PrivateKey,
  TokenId,
  TopicCreateTransaction,
  TransferTransaction,
} from "@hashgraph/sdk";
import dotenv from "dotenv";

dotenv.config();

// Constants that were previously in .env
const ACCOUNT_ID = process.env.OPERATOR_ACCOUNT_ID;
const DER_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;
const NETWORK = process.env.NETWORK;
const MOCK_USDC = process.env.MOCK_USDC;
const CUSTOM_FEE = process.env.CUSTOM_FEE;
const API_BASE_URL = process.env.API_BASE_URL;

if (
  !ACCOUNT_ID ||
  !DER_PRIVATE_KEY ||
  !NETWORK ||
  !MOCK_USDC ||
  !CUSTOM_FEE ||
  !API_BASE_URL
) {
  throw new Error("Missing environment variables");
}

console.log("API_BASE_URL:", API_BASE_URL);

const PRIVATE_KEY = PrivateKey.fromBytesECDSA(
  Buffer.from(DER_PRIVATE_KEY, "hex")
);
const PUBLIC_KEY = PRIVATE_KEY.publicKey;
let client = Client.forTestnet();

client.setOperator(ACCOUNT_ID, PRIVATE_KEY);

const TEST_EMAIL = "sylusabel4@example.com";
const TEST_PASSWORD = "sam@2002";
const TEST_USER_ID = "67e50b7ce4a9ae751ea2e999";

const server = new McpServer({
  name: "neo",
  version: "0.1.0",
  description: "Intelligent Portfolio Management Agent",
  capabilities: {
    resources: {},
    tools: {},
  },
});

interface NewsItem {
  title: string;
  description: string;
  url: string;
  publishTime: string;
  sentiment: "positive" | "negative" | "neutral";
}

interface MarketNews {
  symbol: string;
  news: NewsItem[];
  overallSentiment: "positive" | "negative" | "neutral";
  summary: string[];
}

interface MintTransactionResponse {
  message: string;
  transaction: {
    userId: string;
    tokenId: string;
    stockCode: string;
    amount: number;
    hederaTransactionId: string;
    type: "MINT" | "REDEEM" | "SWAP";
    status: "COMPLETED" | "PENDING" | "FAILED" | string;
    fee: number;
    paymentTokenId: string;
    paymentAmount: number;
    _id: string;
    createdAt: string;
    updatedAt: string;
    __v: number;
  };
}

async function initializeHederaAgent(): Promise<HederaAgentKit> {
  try {
    return new HederaAgentKit(
      ACCOUNT_ID!,
      PRIVATE_KEY.toString(),
      PUBLIC_KEY.toString(),
      NETWORK! as HederaNetworkType
    );
  } catch (error) {
    console.error("Error initializing Hedera Agent Kit:", error);
    throw error;
  }
}

// Get the balances of all token holdings and stocks for a given portfolio
server.tool(
  "get-balances",
  "Get the balances of all token holdings and stocks for a given portfolio",
  {
    userId: z.string().describe("Unique identifier for the portfolio"),
  },
  async ({ userId }, extra) => {
    try {
      console.error("Fetching balances for user:", userId);

      // Initialize Hedera agent
      console.error("Initializing Hedera agent...");
      const hederaAgent = await initializeHederaAgent();

      // Fetch token balances
      console.error("Fetching token balances...");
      const rawTokenBalances = await hederaAgent.getAllTokensBalances(
        NETWORK as HederaNetworkType
      );
      const tokenBalances = rawTokenBalances.map((token) => ({
        tokenId: token.tokenId,
        balance: Number(token.balance),
        symbol: token.tokenSymbol,
      }));
      console.error(`Found ${tokenBalances.length} token balances`);

      // Fetch stock balances
      console.error("Fetching stock balances...");
      const stockBalances = await fetchStockBalances(
        userId,
        TEST_EMAIL,
        TEST_PASSWORD
      );
      console.error(`Found ${stockBalances.length} stock balances`);

      // Aggregate the data
      const portfolioData = {
        tokens: tokenBalances.map((token) => ({
          tokenId: token.tokenId,
          balance: token.balance,
          symbol: token.symbol,
        })),
        stocks: stockBalances.map((stock) => ({
          stockCode: stock.stockCode,
          quantity: stock.quantity,
          lockedQuantity: stock.lockedQuantity,
        })),
        lastUpdated: new Date().toISOString(),
      };

      return {
        content: [
          {
            type: "text",
            text: "Successfully fetched portfolio balances",
          },
          {
            type: "text",
            text: JSON.stringify({
              summary: {
                totalTokens: tokenBalances.length,
                totalStocks: stockBalances.length,
                lastUpdated: portfolioData.lastUpdated,
              },
              details: portfolioData,
            }),
          },
        ],
      };
    } catch (error) {
      console.error("Error fetching balances:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching balances: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Get the current value of the portfolio in KES
server.tool(
  "get-portfolio-value",
  "Get the current value of the portfolio",
  {
    userId: z.string().describe("Unique identifier for the portfolio"),
  },
  async ({ userId }, extra) => {
    try {
      const hederaAgent = await initializeHederaAgent();

      console.error("Fetching token balances...");
      const rawTokenBalances = await hederaAgent.getAllTokensBalances(
        NETWORK as HederaNetworkType
      );
      const tokenBalances = rawTokenBalances.map((token) => ({
        tokenId: token.tokenId,
        balance: Number(token.balance),
        symbol: token.tokenSymbol,
      }));
      console.error(`Found ${tokenBalances.length} token balances`);

      console.error("Fetching stock balances...");
      const stockBalances = await fetchStockBalances(
        userId,
        TEST_EMAIL,
        TEST_PASSWORD
      );
      console.log(stockBalances);
      console.log(tokenBalances);
      // map on each token and stock get't it current price and aggregate the data
      const assetValues = await getAssetValue([
        ...stockBalances.map((stock) => stock.stockCode),
        ...tokenBalances.map((token) => token.symbol),
      ]);
      const totalValue = Object.values(assetValues).reduce(
        (acc, curr) => acc + curr,
        0
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(assetValues),
          },
          {
            type: "text",
            text: `Total value of the portfolio is ${totalValue}`,
          },
        ],
      };
    } catch (error) {
      console.error(error);
      console.error("Error fetching balances:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching balances: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Compare current user portfolio with the trends of the stocks & tokens he owns
server.tool(
  "compare-portfolio-with-trends",
  "Use Brave Search to get the latest news and trends of the stocks & tokens he owns and compare it with the current portfolio",
  {
    stockCodes: z.array(z.string()).describe("Stock codes owned by the user"),
  },
  async ({ stockCodes }, extra) => {
    let stockDetailsMap: Record<string, MarketNews> = {};
    try {
      for (let i = 0; i < stockCodes.length; i++) {
        const stockDetails = await fetchMarketNews(stockCodes[i]);
        stockDetailsMap[stockCodes[i]] = stockDetails;
      }
    } catch (error) {
      console.error(error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching user portfolio and their trends: ${errorMessage}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: "Successfully fetched user portfolio and their trends in html format",
        },
        {
          type: "text",
          text: JSON.stringify(stockDetailsMap),
        },
      ],
    };
  }
);

// Generate a report and recommended actions(mint, redeem or swap for USDC) for the user based on the portfolio and the trends
// The conclusion should include they action needed, the rationale behind it, and the amount of token to be redeemed swapped or minted
// E.g if KCB is trending upwards and SCOM downwards, the report should recommend the user to swap SCOM to USDC then swap the USDC to KCB
// The report will be used by the next tool to make the necessary actions
server.tool(
  "generate-report",
  "Use Brave Search to generate a report and recommended actions(mint, redeem or swap for USDC) for the user based on the portfolio and the trends. The report should include the action needed, the rationale behind it, and the amount of token to be redeemed swapped or minted.",
  {
    stockCodes: z.array(z.string()).describe("Stock codes owned by the user"),
  },
  async ({ stockCodes }, extra) => {
    try {
      const news = await generateReport(stockCodes);
      return {
        content: [{ type: "text", text: JSON.stringify(news) }],
      };
    } catch (error) {
      console.error(error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error generating report: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Make the necessary actions based on the report
server.tool(
  "execute-trading-actions",
  "Use Hedera Agent Kit to execute the trading actions based on the report or by a user's request",
  {
    actions: z
      .array(
        z.object({
          type: z.enum(["mint", "redeem", "swap"]),
          token: z
            .string()
            .describe("The token symbol to be minted, redeemed or swapped"),
          tokenId: z
            .string()
            .describe("The token id to be minted, redeemed or swapped"),
          amount: z
            .number()
            .describe("The amount of token to be minted, redeemed or swapped"),
          rationale: z.string().describe("The rationale behind the action"),
          targetToken: z.string().describe("The token to be swapped to"), // only used when type is swap
        })
      )
      .describe("The actions to be executed"),
    email: z.string().describe("The email of the user"),
    password: z
      .string()
      .describe("The password of the user for authentication."),
    privateKey: z
      .string()
      .describe(
        "The DER encoded ECDSA private key of the user to sign trade transactions."
      ),
    accountId: z
      .string()
      .describe("The account id of the user to sign trade transactions."),
  },
  async ({ actions, email, password, privateKey, accountId }, extra) => {
    let responseContent;
    try {
      const authToken = await getAuthToken(email, password);
      if (!authToken) {
        console.log("Failed to get authenticate user.");
        responseContent =
          "Couldn't safely authenticate you with the email provided.";
        return {
          content: [
            {
              type: "text",
              text: responseContent,
            },
          ],
        };
      }
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        if (action.type === "mint") {
          // call our backend to mint the required tokens
          const mintResponse: MintTransactionResponse = await mintTokens(
            action.token,
            action.amount,
            authToken
          );
          if (!mintResponse) {
            responseContent = "Failed to mint tokens.";
            return {
              content: [
                {
                  type: "text",
                  text: responseContent,
                },
              ],
            };
          }
          return {
            content: [
              {
                type: "text",
                text: `Successfully minted ${action.amount} ${action.token} tokens`,
                body: JSON.stringify(mintResponse),
              },
            ],
          };
        } else if (action.type === "redeem") {
          const redeemResponse = await redeemTokens(
            action.token,
            action.amount,
            authToken,
            PrivateKey.fromStringECDSA(privateKey),
            accountId,
            action.tokenId
          );
        }
      }
      return {
        content: [
          { type: "text", text: "Successfully executed trading actions" },
        ],
      };
    } catch (error) {
      console.error(error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error executing trading actions: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Helper functions
async function fetchStockBalances(
  userId: string,
  email: string,
  password: string
): Promise<{ stockCode: string; quantity: number; lockedQuantity: number }[]> {
  try {
    console.error("Attempting to fetch stock balances...");

    const loginResponse = await fetch(`http://localhost:5004/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    }).catch((error) => {
      console.error("Network error during login:", error);
      throw new Error("Failed to connect to authentication service");
    });

    if (!loginResponse.ok) {
      console.error("Login failed with status:", loginResponse.status);
      return [];
    }

    const loginData = await loginResponse.json().catch((error) => {
      console.error("Error parsing login response:", error);
      return { token: null };
    });

    if (!loginData.token) {
      console.error("No token received in login response");
      return [];
    }

    const authResponse = await fetch(`http://localhost:5004/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${loginData.token}`,
        "Content-Type": "application/json",
      },
    }).catch((error) => {
      console.error("Network error fetching user profile:", error);
      return null;
    });

    if (!authResponse?.ok) {
      console.error("Auth request failed with status:", authResponse?.status);
      return [];
    }

    const authData = await authResponse.json().catch((error) => {
      console.error("Error parsing auth response:", error);
      return { user: { stockHoldings: [] } };
    });

    const stocks = authData?.user?.stockHoldings || [];

    if (!Array.isArray(stocks)) {
      console.error("Invalid stock holdings format:", stocks);
      return [];
    }

    return stocks.map((holding: any) => ({
      stockCode: holding.stockCode || "",
      quantity: Number(holding.quantity) || 0,
      lockedQuantity: Number(holding.lockedQuantity) || 0,
    }));
  } catch (error) {
    console.error("Error in fetchStockBalances:", error);
    return [];
  }
}

async function scrapStockPriceFromNse(symbol: string): Promise<number> {
  const url = `https://afx.kwayisi.org/chart/nse/${symbol}`;
  try {
    // fetch the html page
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // 2. Regex‑extract the contents of `series[0].data = [ ... ]`
    //    We capture everything between data:[   HERE   ]
    const dataBlockMatch = html.match(
      /series\s*:\s*\[\{[^]*?data\s*:\s*\[([\s\S]+?)\]\s*\}/
    );
    if (!dataBlockMatch) {
      throw new Error("Could not find Highcharts data array");
    }
    const rawData = dataBlockMatch[1];

    // 3. Find all [d("DATE"), PRICE] pairs
    const pairRE = /\[d\("([^"]+)"\)\s*,\s*([\d.]+)\]/g;
    const pairs = Array.from(rawData.matchAll(pairRE)).map((m) => ({
      date: m[1], // e.g. "2025-04-16"
      price: parseFloat(m[2]), // e.g. 44.1
    }));

    if (pairs.length === 0) {
      throw new Error("No data points parsed");
    }

    // 4. The last entry is the most recent
    const latest = pairs[pairs.length - 1];
    return latest.price;
  } catch (error) {
    console.error("Error scraping stock price from NSE:", error);
    return -1;
  }
}

async function getAssetValue(
  assets: string[]
): Promise<Record<string, number>> {
  if (assets.length === 0) {
    console.log("No assets found.");
    return {};
  }
  let priceMap: Record<string, number> = {};

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    let parsedAsset = asset;
    if (asset.includes("&")) {
      parsedAsset = "IMH";
    }
    const price = await scrapStockPriceFromNse(parsedAsset);
    priceMap[asset] = price;
  }

  return priceMap;
}

async function fetchMarketNews(symbol: string): Promise<MarketNews> {
  try {
    console.error(`Fetching news for ${symbol}...`);
    const searchQuery = `NSE:${symbol} stock Nairobi Securities Exchange Kenya company news.`;
    const url = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(
      searchQuery
    )}`;

    const headers = {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token":
        process.env.BRAVE_API_KEY || "BSACEBx42fdjEYy1bZ2mcgvO1GLT9Fv",
    };

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const newsItems: NewsItem[] = [];
    let positiveCount = 0;
    let negativeCount = 0;

    // Keywords for sentiment analysis
    const positiveKeywords = [
      "growth",
      "profit",
      "increase",
      "rise",
      "gain",
      "positive",
      "success",
      "strong",
      "improve",
    ];
    const negativeKeywords = [
      "loss",
      "decline",
      "decrease",
      "fall",
      "negative",
      "weak",
      "poor",
      "risk",
      "concern",
    ];

    // Process each news item
    for (const item of data.results || []) {
      // Simple sentiment analysis based on keywords
      let sentiment: "positive" | "negative" | "neutral" = "neutral";
      const combinedText = `${item.title} ${item.description}`.toLowerCase();

      const positiveMatches = positiveKeywords.filter((word) =>
        combinedText.includes(word)
      ).length;
      const negativeMatches = negativeKeywords.filter((word) =>
        combinedText.includes(word)
      ).length;

      if (positiveMatches > negativeMatches) {
        sentiment = "positive";
        positiveCount++;
      } else if (negativeMatches > positiveMatches) {
        sentiment = "negative";
        negativeCount++;
      }

      newsItems.push({
        title: item.title,
        description: item.description,
        url: item.url,
        publishTime: item.publishTime,
        sentiment,
      });
    }

    // Determine overall sentiment
    let overallSentiment: "positive" | "negative" | "neutral" = "neutral";
    if (positiveCount > negativeCount) overallSentiment = "positive";
    else if (negativeCount > positiveCount) overallSentiment = "negative";

    // Generate summary points
    const summary = [];
    if (newsItems.length > 0) {
      summary.push(`Found ${newsItems.length} recent news items`);
      summary.push(`Overall market sentiment: ${overallSentiment}`);
      if (positiveCount > 0)
        summary.push(`${positiveCount} positive developments reported`);
      if (negativeCount > 0)
        summary.push(`${negativeCount} concerning developments noted`);
    } else {
      summary.push("No recent news found");
    }

    return {
      symbol,
      news: newsItems,
      overallSentiment,
      summary,
    };
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error);
    return {
      symbol,
      news: [],
      overallSentiment: "neutral",
      summary: ["Unable to fetch market news"],
    };
  }
}

async function generateReport(stockCodes: string[]): Promise<MarketNews> {
  try {
    const report: MarketNews = {
      symbol: "",
      news: [],
      overallSentiment: "neutral",
      summary: [],
    };
    for (let i = 0; i < stockCodes.length; i++) {
      const stockDetails = await fetchMarketNews(stockCodes[i]);
      report.symbol = stockDetails.symbol;
      report.news = stockDetails.news;
      report.overallSentiment = stockDetails.overallSentiment;
      report.summary = stockDetails.summary;
    }
    return report;
  } catch (error) {
    console.error(error);
    return {
      symbol: "",
      news: [],
      overallSentiment: "neutral",
      summary: ["Unable to generate report"],
    };
  }
}

// Create a topic for each client interaction
async function createTopic(
  topicName: string,
  topicMemo: string,
  privateKey: PrivateKey
) {
  try {
    console.log("Setting up a custom fee configuration ...");
    const customFee = new CustomFixedFee()
      .setDenominatingTokenId(MOCK_USDC!)
      .setAmount(Number(CUSTOM_FEE))
      .setFeeCollectorAccountId(ACCOUNT_ID!);
    console.log(
      `Custom fee configured: ${CUSTOM_FEE} ${MOCK_USDC} tokens per message`
    );

    console.log("Creating new topic with custom fee...");
    const topicCreateTx = new TopicCreateTransaction()
      .setTopicMemo(`${topicName}: ${topicMemo}`)
      .setSubmitKey(privateKey)
      .setCustomFees([customFee]);

    const executeTopicCreateTx = await topicCreateTx.execute(client);
    const topicCreateReceipt = await executeTopicCreateTx.getReceipt(client);
    const topicId = topicCreateReceipt.topicId;
    console.log(`Topic created successfully with ID: ${topicId}`);
  } catch (error) {
    console.error("Error creating topic:", error);
  }
}

async function getAuthToken(
  email: string,
  password: string
): Promise<string | null> {
  try {
    const loginResponse = await fetch(`http://localhost:5004/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    }).catch((error) => {
      console.error("Network error during login:", error);
      throw new Error("Failed to connect to authentication service");
    });

    if (!loginResponse.ok) {
      console.error("Login failed with status:", loginResponse.status);
      return null;
    }

    const loginData = await loginResponse.json().catch((error) => {
      console.error("Error parsing login response:", error);
      return { token: null };
    });

    if (!loginData.token) {
      console.error("No token received in login response");
      return null;
    }
    return loginData.token;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function mintTokens(
  tokenCode: string,
  amount: number,
  authToken: string
) {
  try {
    const url = `${API_BASE_URL}/tokens/${tokenCode.toUpperCase()}/mint`;
    console.log("Attempting to mint tokens with:", {
      url,
      tokenCode,
      amount,
      hasAuthToken: !!authToken,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ amount }),
    });

    console.log("Response status:", response.status);
    console.log("Response status text:", response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to mint tokens. Response:", errorText);
      return null;
    }

    const data = await response.json();
    console.log("Mint successful. Response:", data);
    return data;
  } catch (error) {
    console.error("Error in mintTokens:", error);
    return null;
  }
}

async function redeemTokens(
  tokenCode: string,
  amount: number,
  authToken: string,
  privateKey: PrivateKey,
  accountId: string,
  tokenId: string
) {
  try {
    console.log("Creating transfer transaction...");
    console.log(`From: ${accountId}`);
    console.log(`To: ${ACCOUNT_ID}`);
    console.log(`Amount: ${amount}`);
    console.log(`Token ID: ${tokenId} - ${tokenCode}`);

    const hederaPrivateKey = privateKey;

    const MY_ACCOUNT_ID = AccountId.fromString("0.0.5171455");
    const MY_PRIVATE_KEY = PrivateKey.fromStringED25519(
      "4666f5b5e528d5c549ea78d540b31ee18802145e242f31e3af079e0975da2294"
    );

    client = Client.forTestnet();
    client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

    console.log(`Client set to: ${client}`);

    const transaction = new TransferTransaction()
      .addTokenTransfer(tokenId, AccountId.fromString(accountId), -amount)
      .addTokenTransfer(tokenId, AccountId.fromString(ACCOUNT_ID!), amount);

    // Set max transaction fee
    transaction.setMaxTransactionFee(new Hbar(10));

    console.log("Freezing transaction with client...");
    const frozenTx = transaction.freezeWith(client);
    console.log("Transaction frozen successfully");

    console.log("Transaction created, signing...");
    const signedTx = await frozenTx.sign(hederaPrivateKey);
    console.log("Transaction signed, executing...");
    const txResponse = await signedTx.execute(client);
    console.log("Transaction executed, getting receipt...");
    const receipt = await txResponse.getReceipt(client);

    if (receipt.status.toString() !== "SUCCESS") {
      console.error(
        "Transaction failed with status:",
        receipt.status.toString()
      );
      throw new Error(`Token transfer failed: ${receipt.status.toString()}`);
    }

    console.log("Transaction successful, sending to backend...");
    console.log("Transaction ID:", txResponse.transactionId.toString());

    // Send the burn request with transaction ID to the backend
    const burnResponse = await fetch(
      `${API_BASE_URL}/tokens/${tokenCode}/burn`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          amount,
          transactionId: txResponse.transactionId.toString(),
        }),
      }
    );

    if (!burnResponse.ok) {
      const errorData = await burnResponse.json();
      console.error("Backend burn request failed:", errorData);
      throw new Error(errorData.message || "Failed to burn tokens");
    }

    const result = await burnResponse.json();
    console.log("Backend response:", result);
    if (!result) {
      throw new Error("No response from backend");
    }
    return result;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function main() {
  try {
    const hederaAgent = await initializeHederaAgent();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    const authToken = await getAuthToken("js_cool@gmail.com", "sam@2002");
    if (!authToken) {
      console.error("Failed to get authenticate user.");
      return;
    }
    console.log(authToken);
    const redeemTxn = await redeemTokens(
      "SCOM",
      1,
      authToken,
      PrivateKey.fromStringDer(
        "302e020100300506032b657004220420d1d6329a0d2295106943714c2a289e21d87f2257a55692a70be2d0a1d51c085c"
      ),
      "0.0.5802927",
      "0.0.5784606"
    );
    console.error("Neo MCP Server running on stdio");
  } catch (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
