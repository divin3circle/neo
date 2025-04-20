import {
  AccountId,
  Client,
  CustomFixedFee,
  Hbar,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TransactionReceipt,
  TransferTransaction,
} from "@hashgraph/sdk";
import { HederaAgentKit } from "hedera-agent-kit";
import { HederaNetworkType } from "hedera-agent-kit";

/** CONSTANTS */
const ACCOUNT_ID = "0.0.5483001";
const DER_PRIVATE_KEY =
  "a21d310e140357b2b623fe74a9499af53d8847b1fd0f0b23376ef76d2ea0bce0";
const MOCK_USDC = "0.0.5791936";
const NETWORK = "testnet";
const API_BASE_URL = "http://localhost:5004/api";
const PRIVATE_KEY = PrivateKey.fromBytesECDSA(
  Buffer.from(DER_PRIVATE_KEY, "hex")
);
const PUBLIC_KEY = PRIVATE_KEY.publicKey;
const BRAVE_API_KEY = "BSACEBx42fdjEYy1bZ2mcgvO1GLT9Fv";
const EXCHANGE_RATE = 129.69;

/** BINANCE PRICE URL */
const binancePriceUrl = `https://api.binance.com/api/v3/ticker/price?symbol=`;

/** INTERFACES */
export interface NewsItem {
  title: string;
  description: string;
  url: string;
  publishTime: string;
  sentiment: "positive" | "negative" | "neutral";
}

export interface MarketNews {
  symbol: string;
  news: NewsItem[];
  overallSentiment: "positive" | "negative" | "neutral";
  summary: string[];
}

export interface Asset {
  symbol: string;
  value: number;
}

export interface UserAsset {
  symbol: string;
  balance: number;
}

export interface MintTransactionResponse {
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

export interface HcsManagerResponse {
  content: { type: string; text: string }[];
}

export interface StockBalance {
  stockCode: string;
  quantity: number;
  lockedQuantity: number;
}

export interface TokenBalance {
  tokenId: string;
  balance: number;
  symbol: string;
  name: string;
  stockCode: string;
}

export interface PriceFromBinance {
  symbol: string;
  price: string;
}

/** HELPER FUNCTIONS */
/**
 * Authenticates a user and retrieves an auth token.
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise<string | null> - Auth token if successful, null if failed
 * @throws Error - If network connection fails or response parsing fails
 * @side-effects - Makes HTTP request to auth service
 * @performance - O(1) time complexity, single HTTP request
 * @example
 * const token = await getAuthToken("user@example.com", "password123");
 */
export async function getAuthToken(
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
    }).catch(() => {
      throw new Error("Failed to connect to authentication service");
    });

    if (!loginResponse.ok) {
      return null;
    }

    const loginData = await loginResponse.json().catch(() => {
      return { token: null };
    });

    if (!loginData.token) {
      return null;
    }
    return loginData.token;
  } catch (error) {
    return null;
  }
}

/**
 * Fetches stock balances for a user from the backend.
 * @param userId - Unique identifier for the user
 * @param email - User's email for authentication
 * @param password - User's password for authentication
 * @returns Promise<Array<StockBalance>> - Array of stock holdings
 * @throws Error - If authentication fails or data parsing fails
 * @side-effects - Makes HTTP requests to auth and stock services
 * @performance - O(n) where n is number of stock holdings
 * @example
 * const stocks = await fetchStockBalances("user123", "user@example.com", "password123");
 */
export async function fetchStockBalances(
  userId: string,
  email: string,
  password: string
): Promise<StockBalance[]> {
  try {
    const loginResponse = await fetch(`http://localhost:5004/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    }).catch(() => {
      throw new Error("Failed to connect to authentication service");
    });

    if (!loginResponse.ok) {
      return [];
    }

    const loginData = await loginResponse.json().catch(() => {
      return { token: null };
    });

    if (!loginData.token) {
      return [];
    }

    const authResponse = await fetch(`http://localhost:5004/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${loginData.token}`,
        "Content-Type": "application/json",
      },
    }).catch(() => null);

    if (!authResponse?.ok) {
      return [];
    }

    const authData = await authResponse.json().catch(() => {
      return { user: { stockHoldings: [] } };
    });

    const stocks = authData?.user?.stockHoldings || [];

    if (!Array.isArray(stocks)) {
      return [];
    }

    return stocks.map((holding: any) => ({
      stockCode: holding.stockCode || "",
      quantity: Number(holding.quantity) || 0,
      lockedQuantity: Number(holding.lockedQuantity) || 0,
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Fetches token balances for a user from the backend.
 * @param userId - Unique identifier for the user
 * @param email - User's email for authentication
 * @param password - User's password for authentication
 * @returns Promise<Array<TokenBalance>> - Array of token holdings
 * @throws Error - If authentication fails or data parsing fails
 * @side-effects - Makes HTTP requests to auth and token services
 * @performance - O(n) where n is number of token holdings
 * @example
 * const tokens = await fetchTokenBalances("user123", "user@example.com", "password123");
 */
export async function fetchTokenBalances(
  userId: string,
  email: string,
  password: string
): Promise<TokenBalance[]> {
  const authToken = await getAuthToken(email, password);
  const authResponse = await fetch(`http://localhost:5004/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
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
    return { user: { tokens: [] } };
  });

  const tokens = authData?.user?.tokens || [];

  if (!Array.isArray(tokens)) {
    console.error("Invalid stock holdings format:", tokens);
    return [];
  }

  return tokens.map((holding: any) => ({
    tokenId: holding.tokenId || "",
    balance: Number(holding.balance) || 0,
    symbol: holding.symbol || "",
    name: holding.name || "",
    stockCode: holding.stockCode || "",
  }));
}

/**
 * Scrapes current stock price from NSE website.
 * @param symbol - Stock symbol to fetch price for
 * @returns Promise<number> - Current stock price, -1 if failed
 * @throws Error - If HTTP request fails or data parsing fails
 * @side-effects - Makes HTTP request to external website
 * @performance - O(1) time complexity, single HTTP request
 * @example
 * const price = await scrapStockPriceFromNse("KCB");
 */
export async function scrapStockPriceFromNse(symbol: string): Promise<number> {
  const url = `https://afx.kwayisi.org/chart/nse/${symbol}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const dataBlockMatch = html.match(
      /series\s*:\s*\[\{[^]*?data\s*:\s*\[([\s\S]+?)\]\s*\}/
    );
    if (!dataBlockMatch) {
      throw new Error("Could not find Highcharts data array");
    }
    const rawData = dataBlockMatch[1];

    const pairRE = /\[d\("([^"]+)"\)\s*,\s*([\d.]+)\]/g;
    const pairs = Array.from(rawData.matchAll(pairRE)).map((m) => ({
      date: m[1],
      price: parseFloat(m[2]),
    }));

    if (pairs.length === 0) {
      throw new Error("No data points parsed");
    }

    const latest = pairs[pairs.length - 1];
    return latest.price;
  } catch (error) {
    return -1;
  }
}

/**
 * Calculates current value of assets based on their quantities and current prices.
 * @param assets - Array of assets with symbol and balance
 * @returns Promise<Array<{symbol: string, value: number}>> - Array of assets with their current values
 * @throws Error - If price fetching fails
 * @side-effects - Makes HTTP requests to fetch current prices
 * @performance - O(n) where n is number of assets, makes n HTTP requests
 * @example
 * const values = await getAssetValue([{symbol: "KCB", balance: 100}]);
 */
export async function getAssetValue(assets: UserAsset[]): Promise<Asset[]> {
  if (assets.length === 0) {
    return [];
  }
  let assetsAndPrices: Asset[] = [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    let parsedAsset = asset.symbol;
    if (asset.symbol.includes("&")) {
      parsedAsset = "IMH";
    }
    const price = await scrapStockPriceFromNse(parsedAsset);
    assetsAndPrices.push({
      symbol: asset.symbol,
      value: price * asset.balance,
    });
  }

  return assetsAndPrices;
}

export async function getNativeTokenPrice(
  assets: UserAsset[]
): Promise<Asset[]> {
  if (assets.length === 0) {
    return [];
  }
  let assetsAndPrices: Asset[] = [];

  for (let i = 0; i < assets.length; i++) {
    const priceResponse = await fetch(
      `${binancePriceUrl}${assets[i].symbol}USDT`
    );
    if (!priceResponse.ok) {
      throw new Error(`HTTP ${priceResponse.status}`);
    }
    const priceData: PriceFromBinance = await priceResponse.json();
    const price = Number(priceData.price);
    assetsAndPrices.push({
      symbol: assets[i].symbol,
      value: price * assets[i].balance * EXCHANGE_RATE,
    });
  }
  return assetsAndPrices;
}

/**
 * Fetches market news and sentiment analysis for a stock symbol.
 * @param symbol - Stock symbol to fetch news for
 * @returns Promise<MarketNews> - News items with sentiment analysis
 * @throws Error - If API request fails or data parsing fails
 * @side-effects - Makes HTTP request to Brave Search API
 * @performance - O(n) where n is number of news items
 * @example
 * const news = await fetchMarketNews("KCB");
 */
export async function fetchMarketNews(symbol: string): Promise<MarketNews> {
  try {
    const searchQuery = `NSE:${symbol} stock Nairobi Securities Exchange Kenya company news.`;
    const url = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(
      searchQuery
    )}`;

    const headers = {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": BRAVE_API_KEY,
    };

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const newsItems: NewsItem[] = [];
    let positiveCount = 0;
    let negativeCount = 0;

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

    for (const item of data.results || []) {
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

    let overallSentiment: "positive" | "negative" | "neutral" = "neutral";
    if (positiveCount > negativeCount) overallSentiment = "positive";
    else if (negativeCount > positiveCount) overallSentiment = "negative";

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
    return {
      symbol,
      news: [],
      overallSentiment: "neutral",
      summary: ["Unable to fetch market news"],
    };
  }
}

/**
 * Generates a comprehensive report for multiple stocks.
 * @param stockCodes - Array of stock symbols to generate report for
 * @returns Promise<MarketNews> - Aggregated news and analysis
 * @throws Error - If news fetching fails
 * @side-effects - Makes multiple HTTP requests
 * @performance - O(n) where n is number of stock codes
 * @example
 * const report = await generateReport(["KCB", "SCOM"]);
 */
export async function generateReport(
  stockCodes: string[]
): Promise<MarketNews> {
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
    return {
      symbol: "",
      news: [],
      overallSentiment: "neutral",
      summary: ["Unable to generate report"],
    };
  }
}

/**
 * Mints new tokens for a user.
 * @param tokenCode - Symbol of token to mint
 * @param amount - Amount of tokens to mint
 * @param authToken - User's authentication token
 * @returns Promise<MintTransactionResponse | null> - Transaction details if successful
 * @throws Error - If API request fails or transaction fails
 * @side-effects - Makes HTTP request and creates blockchain transaction
 * @performance - O(1) time complexity, single HTTP request
 * @example
 * const response = await mintTokens("KCB", 100, "auth-token");
 */
export async function mintTokens(
  tokenCode: string,
  amount: number,
  authToken: string
): Promise<MintTransactionResponse | null> {
  try {
    const url = `${API_BASE_URL}/tokens/${tokenCode.toUpperCase()}/mint`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ amount }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return null;
  }
}

/**
 * Redeems (burns) tokens for a user.
 * @param tokenCode - Symbol of token to redeem
 * @param amount - Amount of tokens to redeem
 * @param authToken - User's authentication token
 * @param privateKey - User's private key for transaction signing
 * @param accountId - User's Hedera account ID
 * @param tokenId - ID of token to redeem
 * @returns Promise<any> - Transaction details if successful
 * @throws Error - If transaction fails or API request fails
 * @side-effects - Creates blockchain transaction and makes HTTP request
 * @performance - O(1) time complexity, single transaction
 * @example
 * const response = await redeemTokens("KCB", 100, "auth-token", privateKey, "0.0.123", "0.0.456");
 */
export async function redeemTokens(
  tokenCode: string,
  amount: number,
  authToken: string,
  privateKey: PrivateKey,
  accountId: string,
  tokenId: string
) {
  try {
    const transaction = new TransferTransaction()
      .addTokenTransfer(tokenId, AccountId.fromString(accountId), -amount)
      .addTokenTransfer(tokenId, AccountId.fromString(ACCOUNT_ID!), amount);

    transaction.setMaxTransactionFee(new Hbar(10));

    const signedTx = await transaction.sign(privateKey);
    const txResponse = await signedTx.execute(Client.forTestnet());
    const receipt = await txResponse.getReceipt(Client.forTestnet());

    if (receipt.status.toString() !== "SUCCESS") {
      throw new Error(`Token transfer failed: ${receipt.status.toString()}`);
    }

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
      throw new Error(errorData.message || "Failed to burn tokens");
    }

    const result = await burnResponse.json();
    if (!result) {
      throw new Error("No response from backend");
    }
    return result;
  } catch (error) {
    return null;
  }
}

/**
 * Swaps tokens for USDC.
 * @param tokenCode - Symbol of token to swap
 * @param amount - Amount of tokens to swap
 * @param authToken - User's authentication token
 * @param accountId - User's Hedera account ID
 * @param privateKey - User's private key for transaction signing
 * @returns Promise<any> - Transaction details if successful
 * @throws Error - If API request fails or transaction fails
 * @side-effects - Makes HTTP request and creates blockchain transaction
 * @performance - O(1) time complexity, single HTTP request
 * @example
 * const response = await swapForUSDC("KCB", 100, "auth-token", "0.0.123", "private-key");
 */
export async function swapForUSDC(
  tokenCode: string,
  amount: number,
  authToken: string,
  accountId: string,
  privateKey: string
) {
  try {
    const response = await fetch(`${API_BASE_URL}/tokens/${tokenCode}/sell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        amount,
        accountId,
        privateKey,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to swap tokens");
    }

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    return null;
  }
}

/**
 * Creates a new HCS topic with custom fee configuration.
 * @param topicName - Name of the topic
 * @param topicMemo - Description of the topic
 * @param privateKey - Private key for transaction signing
 * @param fee - Custom fee amount in USDC
 * @returns Promise<TransactionReceipt> - Transaction receipt if successful
 * @throws Error - If transaction fails
 * @side-effects - Creates blockchain transaction
 * @performance - O(1) time complexity, single transaction
 * @example
 * const receipt = await createTopic("user123", "Conversation with Neo", privateKey, 1);
 */
export async function createTopic(
  topicName: string,
  topicMemo: string,
  privateKey: PrivateKey,
  fee: number
): Promise<TransactionReceipt> {
  try {
    const customFee = new CustomFixedFee()
      .setDenominatingTokenId(MOCK_USDC!)
      .setAmount(Number(fee))
      .setFeeCollectorAccountId(ACCOUNT_ID!);

    let client;
    client = Client.forTestnet();
    client.setOperator(ACCOUNT_ID, PRIVATE_KEY);

    const topicCreateTx = new TopicCreateTransaction()
      .setTopicMemo(`${topicName}: ${topicMemo}`)
      .setSubmitKey(privateKey)
      .setCustomFees([customFee]);

    const executeTopicCreateTx = await topicCreateTx.execute(client);
    const topicCreateReceipt = await executeTopicCreateTx.getReceipt(client);
    return topicCreateReceipt;
  } catch (error) {
    throw error;
  }
}

/**
 * Submits a message to an existing HCS topic.
 * @param topicID - ID of the topic to submit to
 * @param message - Message content to submit
 * @param accountID - Account ID for transaction signing
 * @param privateKey - Private key for transaction signing
 * @returns Promise<TransactionReceipt> - Transaction receipt if successful
 * @throws Error - If transaction fails
 * @side-effects - Creates blockchain transaction
 * @performance - O(1) time complexity, single transaction
 * @example
 * const receipt = await submitMessage("0.0.123", "Hello World", "0.0.456", "private-key");
 */
export async function submitMessage(
  topicID: string,
  message: string,
  accountID: string,
  privateKey: string
): Promise<TransactionReceipt> {
  try {
    let client;
    client = Client.forTestnet();
    client.setOperator(accountID, privateKey);

    const submitMessageTx = new TopicMessageSubmitTransaction()
      .setTopicId(topicID)
      .setMessage(message);
    const executeSubmitMessageTx = await submitMessageTx.execute(client);
    const submitMessageReceipt = await executeSubmitMessageTx.getReceipt(
      client
    );
    return submitMessageReceipt;
  } catch (error) {
    throw error;
  }
}

/**
 * Manages HCS topic creation and message submission.
 * @param topicId - Optional ID of existing topic
 * @param message - Message to submit
 * @param accountId - Account ID for transaction signing
 * @param privateKey - Private key for transaction signing
 * @param userId - User ID for topic naming
 * @returns Promise<HcsManagerResponse> - Response with transaction details
 * @throws Error - If transaction fails
 * @side-effects - Creates blockchain transaction(s)
 * @performance - O(1) time complexity, 1-2 transactions
 * @example
 * const response = await hcsManager("0.0.123", "Hello", "0.0.456", "private-key", "user123");
 */
export async function hcsManager(
  topicId: string | undefined,
  message: string,
  accountId: string,
  privateKey: string,
  userId: string
): Promise<HcsManagerResponse> {
  try {
    let topicID;
    if (!topicId) {
      const topicReceipt: TransactionReceipt = await createTopic(
        `${userId}-${accountId}`,
        `${accountId} conversation with Neo`,
        PrivateKey.fromStringDer(privateKey),
        1
      );
      topicID = topicReceipt.topicId?.toString();
      if (!topicID) {
        return {
          content: [
            { type: "text", text: `Failed to create topic: ${topicID}` },
          ],
        };
      }
      const messageReceipt = await submitMessage(
        topicID,
        message,
        accountId,
        privateKey
      );
      if (messageReceipt.status.toString() !== "SUCCESS") {
        return {
          content: [
            {
              type: "text",
              text: `Failed to submit message: ${messageReceipt.status.toString()}`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Topic created successfully with ID: ${topicID}`,
          },
          {
            type: "text",
            text: JSON.stringify(messageReceipt),
          },
        ],
      };
    }
    const messageReceipt = await submitMessage(
      topicId!,
      message,
      accountId,
      privateKey
    );
    if (messageReceipt.status.toString() !== "SUCCESS") {
      return {
        content: [
          {
            type: "text",
            text: `Failed to submit message: ${messageReceipt.status.toString()}`,
          },
        ],
      };
    }

    return {
      content: [
        { type: "text", text: JSON.stringify(messageReceipt) },
        {
          type: "text",
          text: `Message submitted successfully to topic ${topicId}`,
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text", text: `Error submitting message: ${errorMessage}` },
      ],
    };
  }
}

/**
 * Initializes and configures a Hedera Agent Kit instance.
 * @returns Promise<HederaAgentKit> - Configured Hedera Agent Kit instance
 * @throws Error - If initialization fails or environment variables are missing
 * @side-effects - Creates a new Hedera Agent Kit instance
 * @performance - O(1) time complexity, single initialization
 * @dependencies - Requires ACCOUNT_ID, PRIVATE_KEY, PUBLIC_KEY, and NETWORK environment variables
 * @example
 * const agent = await initializeHederaAgent();
 */
export async function initializeHederaAgent(): Promise<HederaAgentKit> {
  try {
    return new HederaAgentKit(
      ACCOUNT_ID!,
      PRIVATE_KEY.toString(),
      PUBLIC_KEY.toString(),
      NETWORK! as HederaNetworkType
    );
  } catch (error) {
    throw error;
  }
}
