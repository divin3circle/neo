import {
  AccountId,
  Client,
  CustomFixedFee,
  Hbar,
  PrivateKey,
  TokenId,
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
const EXCHANGE_RATE_URL =
  "https://www.xe.com/api/protected/statistics/?from=USD&to=KES";
const USDC_TOKEN_ID = "0.0.5791936";

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

interface TimeSeriesStats {
  to: string;
  high: number;
  low: number;
  average: number;
  standardDeviation: number;
  volatility: number;
  highTimestamp: string;
  lowTimestamp: string;
  dataPoints: number;
}

interface TimeSeriesData {
  last1Days: TimeSeriesStats;
  last7Days: TimeSeriesStats;
  last30Days: TimeSeriesStats;
  last60Days: TimeSeriesStats;
  last90Days: TimeSeriesStats;
}

interface User {
  _id: string;
  name: string;
  email: string;
}

interface Message {
  _id: string;
  content: string;
  sender: User;
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
}

interface Topic {
  _id: string;
  userId: User;
  name: string;
  description: string;
  topicId: string;
  hederaTopicID: string;
  messages: Message[];
  topicMemo: string;
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
  __v: number;
}

interface TopicsResponse {
  topics: Topic[];
}

export type RequestExtended = Request & { token?: string };

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
      body: JSON.stringify({ email, password }, null, 2),
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
 * const stocks = await fetchStockBalances("user123", "user@example.com",
 * "password123");
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
      body: JSON.stringify({ email, password }, null, 2),
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
 * const tokens = await fetchTokenBalances("user123", "user@example.com",
 * "password123");
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
    throw new Error("Failed to connect to authentication service: " + error);
  });

  if (!authResponse?.ok) {
    throw new Error("Auth request failed with status: " + authResponse?.status);
  }

  const authData = await authResponse.json().catch((error) => {
    throw new Error("Error parsing auth response: " + error);
  });

  const tokens = authData?.user?.tokens || [];

  if (!Array.isArray(tokens)) {
    throw new Error("Invalid stock holdings format: " + tokens);
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
 * Calculates current value of assets based on their quantities and current
 * prices.
 * @param assets - Array of assets with symbol and balance
 * @returns Promise<Array<{symbol: string, value: number}>> - Array of
 * assets with their current values
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

/**
 * Fetches the current KES/USD exchange rate from XE API.
 * @returns Promise<number> Returns the current exchange rate. If the API
 * call fails, returns a default rate of 129.65
 * @throws Error - If the API request fails or response cannot be parsed
 * @side-effects Makes an HTTP request to external XE API
 * @performance O(1) - Single API call
 * @description
 * - Fetches real-time exchange rate from XE API
 * - Uses last 24 hours average rate
 * - Falls back to default rate of 129.65 if API call fails
 * @example
 * const rate = await getExchangeRate();
 * console.log(rate); // 129.65
 */
export async function getExchangeRate(): Promise<number> {
  try {
    const response = await fetch(EXCHANGE_RATE_URL);
    if (!response.ok) {
      return 129.65; // Default fallback rate
    }
    const data: TimeSeriesData = await response.json();
    return data.last1Days.average;
  } catch (error) {
    return 129.65; // Default fallback rate on error
  }
}

/**
 * Fetches current prices for native tokens (HBAR, USDC) from Binance API
 * and calculates their value in KES.
 * @param assets - Array of token assets containing symbol and balance
 * @returns Promise<Array<{symbol: string, value: number}>> Array of assets
 * with their KES values
 * @throws Error - If Binance API request fails or returns invalid data
 * @side-effects
 * - Makes HTTP requests to Binance API for each token
 * - Makes HTTP request to get exchange rate
 * @performance
 * - O(n) where n is number of assets
 * - Makes n+1 API calls (n tokens + 1 exchange rate)
 * @example
 * const nativeTokens = [
 *   { symbol: "HBAR", balance: 100 },
 *   { symbol: "USDC", balance: 50 }
 * ];
 * const values = await getNativeTokenPrice(nativeTokens);
 */
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
      value: price * assets[i].balance * (await getExchangeRate()),
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
 * @returns Promise<MintTransactionResponse | null> - Transaction
 * details if successful
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
      body: JSON.stringify({ amount }, null, 2),
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
 * const response = await redeemTokens("KCB", 100, "auth-token", privateKey,
 *  "0.0.123", "0.0.456");
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
        body: JSON.stringify(
          {
            amount,
            transactionId: txResponse.transactionId.toString(),
          },
          null,
          2
        ),
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
 * const response = await swapForUSDC("KCB", 100, "auth-token", "0.0.123",
 *  "private-key");
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
      body: JSON.stringify(
        {
          amount,
          accountId,
          privateKey,
        },
        null,
        2
      ),
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
 * const receipt = await createTopic("user123", "Conversation with Neo",
 * privateKey, 1);
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
 * const receipt = await submitMessage("0.0.123", "Hello World", "0.0.456",
 *  "private-key");
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
 * Manages HCS topic creation and message submission on Hedera Network.
 * @param topicId - Optional ID of existing topic
 * @param message - Message to submit
 * @param accountId - Account ID for transaction signing
 * @param privateKey - Private key for transaction signing
 * @param userId - User ID for topic naming
 * @param userEmail - User email for authentication
 * @param password - User password for authentication
 * @returns Promise<HcsManagerResponse> - Response with transaction details
 * @throws Error - If transaction fails
 * @side-effects - Creates blockchain transaction(s)
 * @performance - O(1) time complexity, 1-2 transactions
 * @example
 * const response = await hcsManager("0.0.123", "Hello", "0.0.456", "private-key",
 *  "user123");
 */
export async function hcsManager(
  topicId: string | undefined,
  message: string,
  accountId: string,
  privateKey: string,
  userId: string,
  userEmail: string,
  password: string
): Promise<HcsManagerResponse> {
  try {
    let topicID;
    const authToken = await getAuthToken(userEmail, password);
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

      if (!authToken) {
        return {
          content: [{ type: "text", text: "Auth token absent!!" }],
        };
      }
      // TODO: Add error handling
      const createTopicResponse = await createTopicOnBackend(
        `${userId}-${accountId}`,
        `${accountId} conversation with Neo`,
        `${accountId} conversation with Neo`,
        topicID,
        authToken
      );
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

      const addMessageResponse = await addMessageToTopic(
        topicID,
        message,
        authToken
      );

      return {
        content: [
          {
            type: "text",
            text: `Topic created successfully with ID: ${topicID}`,
          },
          {
            type: "text",
            text: JSON.stringify(messageReceipt, null, 2),
          },
          {
            type: "text",
            text: `${messageReceipt.scheduledTransactionId?.toString()}`,
          },
          {
            type: "text",
            text: JSON.stringify(addMessageResponse, null, 2),
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
    if (!authToken) {
      return {
        content: [{ type: "text", text: "Auth token absent!!" }],
      };
    }
    const addMessageResponse = await addMessageToTopic(
      topicId!,
      message,
      authToken
    );

    return {
      content: [
        { type: "text", text: JSON.stringify(messageReceipt, null, 2) },
        {
          type: "text",
          text: `Message submitted successfully to topic ${topicId}`,
        },
        {
          type: "text",
          text: `${messageReceipt.scheduledTransactionId?.toString()}`,
        },
        {
          type: "text",
          text: JSON.stringify(addMessageResponse, null, 2),
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
 * @dependencies - Requires ACCOUNT_ID, PRIVATE_KEY, PUBLIC_KEY, and NETWORK
 *  environment variables
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

/**
 * Calls the deduct endpoint to deduct message submission fees from our backend
 * @param transactionId - The transaction ID of the message submission
 * @returns Promise<DeductResponse> - Response with transaction details
 * @throws Error - If API request fails or transaction fails
 * @side-effects - Makes HTTP request and creates blockchain transaction
 * @performance - O(1) time complexity, single HTTP request
 * @example
 * const response = await deductFees("0.0.123", "Hello", "0.0.456", "private-key"
 * , "user123");
 */
export async function deductFees(transactionId: string, authToken: string) {
  try {
    const url = `${API_BASE_URL}/tokens/deduct-usdc/${transactionId}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ transactionId }, null, 2),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to deduct fees");
    }
    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Create a topic that has been created on Hedera Network on our backend
 * @param topicName - the name of the topic created on Hedera Network
 * @param description - the description of the topic created on Hedera Network
 * @param topicMemo - the memo of the topic created on Hedera Network
 * @param hederaTopicId - the Hedera Topic ID of the topic created on Hedera Network
 * @param authToken - the authentication token of the user
 * @returns Promise<CreateTopicResponse> - Response with transaction details
 * @throws Error - If API request fails or transaction fails
 * @performance - O(1) time complexity, single transaction
 * @example
 * const response = await createTopic("user123", "Conversation with Neo",
 * "private-key", 1);
 */
export async function createTopicOnBackend(
  topicName: string,
  description: string,
  topicMemo: string,
  hederaTopicId: string,
  authToken: string
) {
  try {
    const url = `${API_BASE_URL}/topics/`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(
        { topicName, description, topicMemo, hederaTopicId },
        null,
        2
      ),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to create topic on backend");
    }
    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Add a new message to a topic that has been created on our backend
 * @param hederaTopicId - the Hedera Topic ID of the topic created on Hedera Network
 * @param message - the message to be added to the topic
 * @param authToken - the authentication token of the user
 * @returns Promise<AddMessageResponse> - Response with transaction details
 * @throws Error - If API request fails or transaction fails
 * @performance - O(1) time complexity, single transaction
 * @example
 * const response = await addMessage("0.0.123", "Hello", "0.0.456", "private-key",
 * "user123");
 */
export async function addMessageToTopic(
  hederaTopicId: string,
  message: string,
  authToken: string
) {
  try {
    const url = `${API_BASE_URL}/topics/${hederaTopicId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ message }, null, 2),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to add message to topic");
    }
    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Get the hedera topics from user id
 * @param userId - the user id of the user
 * @param authToken - the authentication token of the user
 * @returns Promise<TopicsResponse> - Response with transaction details
 * @throws Error - If API request fails or transaction fails
 * @performance - O(1) time complexity, single transaction
 */
export async function getHederaTopicsFromBackend(
  userId: string,
  authToken: string
): Promise<TopicsResponse> {
  try {
    const url = `${API_BASE_URL}/topics/user/${userId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to get hedera topics");
    }
    const result = await response.json();
    return result as TopicsResponse;
  } catch (error) {
    throw error;
  }
}

/**
 * Get the main topic for a user
 * @param userId - the user id of the user
 * @param authToken - the authentication token of the user
 * @returns Promise<string | null> - The main topic id or null if no topics exist
 * @throws Error - If API request fails or transaction fails
 * @performance - O(1) time complexity, single transaction
 * @example
 * const mainTopic = await getUserMainTopic("user123", "private-key");
 */
export async function getUserMainTopicId(
  userId: string,
  authToken: string
): Promise<string | undefined> {
  try {
    const topics = await getHederaTopicsFromBackend(userId, authToken);
    if (topics.topics.length === 0) {
      return undefined;
    }
    return topics.topics[0].hederaTopicID;
  } catch (error) {
    throw error;
  }
}

/**
 * Get the USDC balance of a user using Hedera Agent Kit
 * @param accountId - the account id of the user
 * @param privateKey - the private key of the user
 * @param publicKey - the public key of the user
 * @returns Promise<number> - The USDC balance of the user
 * @throws Error - If API request fails or transaction fails
 * @performance - O(1) time complexity, single transaction
 * @example
 * const usdcBalance = await getUSDCBalance("0.0.123", "private-key",
 * "0.0.456");
 */
export async function getUSDCBalance(
  accountId: string,
  privateKey: string,
  publicKey: string
): Promise<number> {
  try {
    const userAgent = new HederaAgentKit(
      accountId,
      privateKey,
      publicKey,
      "testnet"
    );
    const htsBalance = await userAgent.getHtsBalance(USDC_TOKEN_ID, "testnet");
    return htsBalance;
  } catch (error) {
    throw error;
  }
}

/**
 * Initiate an STK push transaction
 * @param phoneNumber - the phone number of the user
 * @param amount - the amount to be pushed
 * @param accountReference - the account reference of the user
 * @param txnDesc - transaction description
 */
export async function initiateSTKPush(
  phoneNumber: number,
  amount: number,
  accountReference: string,
  txnDesc: string
) {
  const businessShortCode = 174379;
  const passKey =
    "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
  const timeStamp = getTimestamp();
  const password = Buffer.from(
    `${businessShortCode}${passKey}${timeStamp}`
  ).toString("base64");

  const headers = new Headers();
  headers.append("Content-Type", "application/json");
  headers.append("Authorization", "Bearer Pg1lPbk34iKPW8pLIaGvxTZYKB8A");

  const payload = {
    BusinessShortCode: businessShortCode,
    Password: password,
    Timestamp: timeStamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: businessShortCode,
    PhoneNumber: phoneNumber,
    CallBackURL: "https://webhook.site/e5186c20-7499-4797-8d18-9816fce848d4",
    AccountReference: "NSEBridge",
    TransactionDesc: txnDesc,
  };

  try {
    const response = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    const result = await response.text();
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Transfer USDC from treasury account to user account
 * @param amount - the amount(in KES) to be transferred
 * @param accountId - the account id of the user
 * @returns Promise<string> - The transaction id
 */
export async function transferUSDCFromTreasuryToUser(
  amount: number,
  accountId: string
) {
  // Get the exchange rate
  const exchangeRate = await getExchangeRate();
  const amountInUSDC = amount / exchangeRate;

  try {
    const kit = await initializeHederaAgent();
    const transaction = await kit.transferToken(
      TokenId.fromString(USDC_TOKEN_ID),
      accountId,
      amountInUSDC
    );
    return transaction;
  } catch (error) {
    throw error;
  }
}

/**
 * Generate an authentication token for a user
 * @returns Promise<string> - The authentication token
 */
export async function generateAuthToken(): Promise<string> {
  const SECRET =
    "UX7bF1kXB1u7tBLaerGPZ7w5aMwtwMW9pvNhGwDUSxcaySnFpCPSV8uF0sPTlisA";
  const KEY = "xRcQpyqn22bp1YurRlxJiWbCzvSOGkBVRz9GOBxXWzdH1ZrQ";
  const url =
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

  if (!url || !SECRET || !KEY) {
    throw new Error("Missing environment variables");
  }

  const auth = Buffer.from(`${KEY}:${SECRET}`).toString("base64");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    throw error;
  }
}

/**
 * Generate a timestamp
 * @returns string - The timestamp
 */
export const getTimestamp = () => {
  const date = new Date();
  return (
    date.getFullYear() +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    ("0" + date.getDate()).slice(-2) +
    ("0" + date.getHours()).slice(-2) +
    ("0" + date.getMinutes()).slice(-2) +
    ("0" + date.getSeconds()).slice(-2)
  );
};
