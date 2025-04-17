import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CreateFTOptions, HederaAgentKit } from "hedera-agent-kit";
import fs from "fs";

// Constants that were previously in .env
const ACCOUNT_ID = "0.0.5824374";
const DER_PRIVATE_KEY =
  "3030020100300706052b8104000a04220420969f1f80158f05f4589f6f607b09d6c6478bcd83fe3766bc2922415f8b093c23";
const DER_PUBLIC_KEY =
  "302d300706052b8104000a03220003c0f30d0b3b078d339cf198281cc803397566c89b584aa583983f7c04791014aa";
const NETWORK = "testnet";

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

// Types for balance management
interface TokenBalance {
  tokenId: string;
  balance: number;
  symbol: string;
}

interface StockBalance {
  stockCode: string;
  quantity: number;
  lockedQuantity: number;
}

interface StockNews {
  symbol: string;
  news: string[];
}

interface AggregatedBalance {
  tokens: TokenBalance[];
  stocks: StockBalance[];
  lastUpdated: number;
}

interface AssetValue {
  string: number;
}

interface MarketAnalysis {
  symbol: string;
  currentPrice: number;
  sentiment: "positive" | "negative" | "neutral";
  insights: {
    keyDevelopments: string[];
    risks: string[];
    opportunities: string[];
  };
  recommendation: {
    action: "buy" | "sell" | "hold";
    reasoning: string[];
  };
}

interface McpRequest {
  server: string;
  tool: string;
  params: Record<string, any>;
}

interface RequestExtra {
  request(req: McpRequest): Promise<any>;
}

// Add these new interfaces
interface MarketTrend {
  symbol: string;
  trend: "bullish" | "bearish" | "neutral";
  priceChange: number;
  volume: number;
  analysis: string[];
}

interface StockRecommendation {
  symbol: string;
  action: "buy" | "sell" | "hold";
  targetPrice: number;
  currentPrice: number;
  reasoning: string[];
  riskLevel: number;
}

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

interface StockAnalysis {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  dayRange: {
    low: number;
    high: number;
  };
  volume: number;
  marketCap: number;
  priceChange: {
    day: number;
    week: number;
    month: number;
    year: number;
  };
  technicalIndicators: {
    trend: "bullish" | "bearish" | "neutral";
    support: number;
    resistance: number;
  };
  fundamentals: {
    pe: number;
    eps: number;
    dividend: number;
  };
  analysis: string[];
}

async function initializeHederaAgent(): Promise<HederaAgentKit> {
  try {
    return new HederaAgentKit(
      ACCOUNT_ID,
      DER_PRIVATE_KEY,
      DER_PUBLIC_KEY,
      NETWORK
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
      const rawTokenBalances = await hederaAgent.getAllTokensBalances(NETWORK);
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
      const rawTokenBalances = await hederaAgent.getAllTokensBalances(NETWORK);
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
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(assetValues),
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
  "Compare current user portfolio with the trends of the stocks & tokens he owns",
  {
    stockCodes: z.array(z.string()).describe("Stock codes owned by the user"),
  },
  async ({ stockCodes }, extra) => {
    let stockDetailsMap: Record<string, string> = {};
    try {
      for (let i = 0; i < stockCodes.length; i++) {
        const stockDetails = await analyzeStockFromAFX(stockCodes[i]);
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

async function analyzeStockFromAFX(symbol: string): Promise<string> {
  try {
    // Normalize symbol for I&M Holdings
    const normalizedSymbol = symbol.includes("&")
      ? "imh"
      : symbol.toLowerCase();
    const url = `https://afx.kwayisi.org/nse/${normalizedSymbol}.html`;

    console.error(`Fetching AFX data for ${symbol} from ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    return html;
  } catch (error) {
    console.error(`Error analyzing stock from AFX: ${error}`);
    return "An error occurred while analyzing the stock from AFX";
  }
}

async function test(
  TEST_USER_ID: string,
  TEST_EMAIL: string,
  TEST_PASSWORD: string
) {
  try {
    console.error("Initializing Hedera agent...");
    const hederaAgent = await initializeHederaAgent();

    console.error("Fetching token balances...");
    const rawTokenBalances = await hederaAgent.getAllTokensBalances(NETWORK);

    const tokenBalances: TokenBalance[] = rawTokenBalances.map((token) => ({
      tokenId: token.tokenId,
      balance: Number(token.balance),
      symbol: token.tokenSymbol,
    }));

    const stockBalances = await fetchStockBalances(
      TEST_USER_ID,
      TEST_EMAIL,
      TEST_PASSWORD
    );

    const aggregatedData: AggregatedBalance = {
      tokens: tokenBalances,
      stocks: stockBalances,
      lastUpdated: Date.now(),
    };

    return {
      content: [
        {
          type: "text",
          text: "Successfully fetched and aggregated balance data",
        },
        {
          type: "text",
          text: JSON.stringify({
            summary: {
              totalTokens: tokenBalances.length,
              totalStocks: stockBalances.length,
              lastUpdated: new Date(
                aggregatedData.lastUpdated
              ).toLocaleString(),
            },
            details: aggregatedData,
          }),
        },
      ],
    };
  } catch (error) {
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

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    const scomPrice = await analyzeStockFromAFX("KCB");
    console.error(scomPrice);
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
