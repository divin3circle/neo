import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { HederaAgentKit } from "hedera-agent-kit";
import { Client, PrivateKey } from "@hashgraph/sdk";
import dotenv from "dotenv";
import {
  getAuthToken,
  fetchStockBalances,
  fetchTokenBalances,
  getAssetValue,
  fetchMarketNews,
  generateReport,
  mintTokens,
  redeemTokens,
  swapForUSDC,
  MarketNews,
  hcsManager,
  getNativeTokenPrice,
  deductFees,
  getUserMainTopicId,
  createTopic,
  addMessageToTopic,
  generateAuthToken,
  initiateSTKPush,
} from "./helpers.js";

dotenv.config();

const ACCOUNT_ID = "0.0.5483001";
const DER_PRIVATE_KEY =
  "a21d310e140357b2b623fe74a9499af53d8847b1fd0f0b23376ef76d2ea0bce0";
const NETWORK = "testnet";
const MOCK_USDC = "0.0.5791936";
const CUSTOM_FEE = 5;
const API_BASE_URL = "http://localhost:5004/api";

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

const PRIVATE_KEY = PrivateKey.fromBytesECDSA(
  Buffer.from(DER_PRIVATE_KEY, "hex")
);
let client = Client.forTestnet();

client.setOperator(ACCOUNT_ID, PRIVATE_KEY);

const server = new McpServer({
  name: "neo",
  version: "0.1.0",
  description:
    "Intelligent Portfolio Management Agent to help user rebalance their on-chain portfolio. The agent can execute trading actions such as minting, redeeming and swapping to USDC of tokenized stock tokens based on the user's portfolio and the trends of the stocks & tokens he owns.",
  capabilities: {
    tools: {
      "get-balances": true,
      "get-portfolio-value": true,
      "compare-portfolio-with-trends": true,
      "generate-report": true,
      "execute-trading-actions": true,
    },
  },
});

/**
 * Get the balances of all token holdings and stocks for a given portfolio.
 * @param userId - Unique identifier for the portfolio
 * @param accountId - Hedera account ID of the user
 * @param privateKey - DER encoded ECDSA private key of the user
 * @param userEmail - User's email address
 * @param password - Account password for the user
 * @returns Promise<{content: Array<{type: string, text: string}>}> - Portfolio balances and transaction details
 * @throws Error - If authentication fails or data fetching fails
 * @side-effects - Makes HTTP requests to fetch balances and creates HCS message
 * @performance - O(n) where n is number of holdings
 * @example
 * const balances = await getBalances({
 *   userId: "user123",
 *   accountId: "0.0.123",
 *   privateKey: "private-key",
 *   userEmail: "user@example.com",
 *   password: "password123",
 * });
 */
server.tool(
  "get-balances",
  "Get the balances of all token holdings and stocks for a given portfolio",
  {
    userId: z.string().describe("Unique identifier for the portfolio"),
    accountId: z.string().describe("Hedera account ID account id of the user"),
    privateKey: z
      .string()
      .describe("DER encoded ECDSA private key of the user"),
    userEmail: z.string().describe("User's email address"),
    password: z.string().describe("Account password for the user"),
  },
  async ({ userId, accountId, privateKey, userEmail, password }, extra) => {
    try {
      const publicKey = PrivateKey.fromStringECDSA(privateKey).publicKey;
      const hederaAgent = new HederaAgentKit(
        accountId,
        privateKey,
        publicKey.toString(),
        "testnet"
      );

      const tokenBalances = await fetchTokenBalances(
        userId,
        userEmail,
        password
      );

      if (!tokenBalances || tokenBalances.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Warning: No token balances found or failed to fetch token balances",
            },
          ],
        };
      }

      const stockBalances = await fetchStockBalances(
        userId,
        userEmail,
        password
      );

      if (!stockBalances || stockBalances.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Warning: No stock balances found or failed to fetch stock balances",
            },
          ],
        };
      }

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

      const usdcBalance = await hederaAgent.getHtsBalance(
        "0.0.5791936",
        NETWORK
      );

      if (usdcBalance < 1) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Insufficient USDC balance for transaction",
            },
          ],
        };
      }

      const balanceMessage = `Fetched portfolio balances for ${userId} on ${new Date().toISOString()}. Costed 1 USDC, remaining balance: ${
        usdcBalance - 1
      } USDC`;

      const authToken = await getAuthToken(userEmail, password);

      if (!authToken) {
        return {
          content: [
            {
              type: "text",
              text: "Auth token absent! Authentication failed",
            },
          ],
        };
      }

      const topicId = await getUserMainTopicId(userId, authToken);

      const hcsManagerResponse = await hcsManager(
        topicId,
        balanceMessage,
        accountId,
        privateKey,
        userId,
        userEmail,
        password
      );

      const txId =
        accountId +
        "@" +
        Math.round(Date.now() / 1000).toString() +
        "." +
        Math.round(Date.now()).toString();

      let message;

      if (!authToken) {
        message = "Auth token absent!!";
      } else {
        message = await deductFees(txId, authToken);
      }

      return {
        content: [
          {
            type: "text",
            text: "Successfully fetched portfolio balances",
          },
          {
            type: "text",
            text: JSON.stringify(
              {
                summary: {
                  totalTokens: tokenBalances.length,
                  totalStocks: stockBalances.length,
                  lastUpdated: portfolioData.lastUpdated,
                },
                details: portfolioData,
              },
              null,
              2
            ),
          },
          {
            type: "text",
            text: JSON.stringify(hcsManagerResponse, null, 2),
          },
          {
            type: "text",
            text: JSON.stringify(message, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorCode =
        error instanceof Error && "code" in error
          ? (error as any).code
          : "UNKNOWN";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching balances: ${errorMessage} (Code: ${errorCode})`,
          },
        ],
      };
    }
  }
);

/**
 * Get the current value of the portfolio in KES.
 * @param userId - Unique identifier for the portfolio
 * @param userEmail - User's email address
 * @param password - Account password for the user
 * @param accountId - Hedera account ID of the user
 * @param privateKey - DER encoded ECDSA private key of the user
 * @returns Promise<{content: Array<{type: string, text: string}>}> - Portfolio value and transaction details
 * @throws Error - If authentication fails or price fetching fails
 * @side-effects - Makes HTTP requests to fetch prices and creates HCS message
 * @performance - O(n) where n is number of assets
 * @example
 * const value = await getPortfolioValue({
 *   userId: "user123",
 *   userEmail: "user@example.com",
 *   password: "password123",
 *   accountId: "0.0.123",
 *   privateKey: "private-key",
 * });
 */
server.tool(
  "get-portfolio-value",
  "Get the current value of the portfolio. The value should be in KES and should be the sum of the current price of the stocks and tokens in the portfolio. Since the tokens are pegged to their  respective stocks, their value should be the current price of the stock they represent. ",
  {
    userId: z.string().describe("Unique identifier for the portfolio"),
    userEmail: z.string().describe("User's email address"),
    password: z.string().describe("Account password for the user"),
    accountId: z.string().describe("Hedera account ID account id of the user"),
    privateKey: z
      .string()
      .describe("DER encoded ECDSA private key of the user"),
  },
  async ({ userId, userEmail, password, accountId, privateKey }, extra) => {
    try {
      const tokenBalances = await fetchTokenBalances(
        userId,
        userEmail,
        password
      );

      if (!tokenBalances || tokenBalances.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Warning: No token balances found or failed to fetch token balances",
            },
          ],
        };
      }

      const stockBalances = await fetchStockBalances(
        userId,
        userEmail,
        password
      );

      if (!stockBalances || stockBalances.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Warning: No stock balances found or failed to fetch stock balances",
            },
          ],
        };
      }
      const nativeTokens = tokenBalances.filter(
        (token) => token.symbol === "HBAR" || token.symbol === "USDC"
      );

      const assetValues = await getAssetValue([
        ...stockBalances.map(
          (stock: { stockCode: string; quantity: number }) => ({
            symbol: stock.stockCode,
            balance: stock.quantity,
          })
        ),
      ]);

      const nativeTokenValues = await getNativeTokenPrice(nativeTokens);

      const fullAssetValues = assetValues.concat(nativeTokenValues);

      if (!fullAssetValues || fullAssetValues.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Failed to fetch current asset values",
            },
          ],
        };
      }

      let totalValue = 0;
      for (let i = 0; i < fullAssetValues.length; i++) {
        if (fullAssetValues[i].value < 0) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Invalid negative value for asset ${fullAssetValues[i].symbol}`,
              },
            ],
          };
        }
        totalValue += fullAssetValues[i].value;
      }

      const valueMessage = `Aggregated portfolio value for ${userId} on ${new Date().toISOString()} is ${totalValue} KES`;

      const authToken = await getAuthToken(userEmail, password);

      if (!authToken) {
        return {
          content: [
            {
              type: "text",
              text: "Auth token absent! Authentication failed",
            },
          ],
        };
      }

      const topicId = await getUserMainTopicId(userId, authToken);

      const hcsManagerResponse = await hcsManager(
        topicId,
        valueMessage,
        accountId,
        privateKey,
        userId,
        userEmail,
        password
      );

      const txId =
        accountId +
        "@" +
        Math.round(Date.now() / 1000).toString() +
        "." +
        Math.round(Date.now()).toString();

      let message;

      if (!authToken) {
        message = "Auth token absent!!";
      } else {
        message = await deductFees(txId, authToken);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(fullAssetValues, null, 2),
          },
          {
            type: "text",
            text: `Total value of the portfolio is ${totalValue}`,
          },
          {
            type: "text",
            text: JSON.stringify(hcsManagerResponse, null, 2),
          },
          {
            type: "text",
            text: JSON.stringify(message, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorCode =
        error instanceof Error && "code" in error
          ? (error as any).code
          : "UNKNOWN";
      return {
        content: [
          {
            type: "text",
            text: `Error calculating portfolio value: ${errorMessage} (Code: ${errorCode})`,
          },
        ],
      };
    }
  }
);

/**
 * Compare current user portfolio with the trends of the stocks & tokens he owns.
 * @param stockCodes - Array of stock codes owned by the user
 * @param accountId - Hedera account ID of the user
 * @param privateKey - DER encoded ECDSA private key of the user
 * @param userId - Unique identifier for the portfolio
 * @returns Promise<{content: Array<{type: string, text: string}>}> - Market trends analysis and transaction details
 * @throws Error - If news fetching fails
 * @side-effects - Makes HTTP requests to fetch news and creates HCS message
 * @performance - O(n) where n is number of stock codes
 * @example
 * const trends = await comparePortfolioWithTrends({
 *   stockCodes: ["KCB", "SCOM"],
 *   accountId: "0.0.123",
 *   privateKey: "private-key",
 *   userId: "user123"
 * });
 */
server.tool(
  "compare-portfolio-with-trends",
  "Use Brave Search to get the latest news and trends of the stocks & tokens he owns and compare it with the current portfolio",
  {
    stockCodes: z.array(z.string()).describe("Stock codes owned by the user"),
    accountId: z.string().describe("Hedera account ID account id of the user"),
    privateKey: z
      .string()
      .describe("DER encoded ECDSA private key of the user"),
    userId: z.string().describe("Unique identifier for the portfolio"),
    userEmail: z.string().describe("User's email address"),
    password: z.string().describe("Account password for the user"),
  },
  async (
    { stockCodes, accountId, privateKey, userId, userEmail, password },
    extra
  ) => {
    let stockDetailsMap: Record<string, MarketNews> = {};
    try {
      for (let i = 0; i < stockCodes.length; i++) {
        const stockDetails = await fetchMarketNews(stockCodes[i]);
        stockDetailsMap[stockCodes[i]] = stockDetails;
      }
    } catch (error) {
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

    const comparisonMessage = `Comparison of the user portfolio with the trends of the stocks & tokens he owns for ${userId} on ${new Date().toISOString()}`;

    const authToken = await getAuthToken(userEmail, password);

    if (!authToken) {
      return {
        content: [{ type: "text", text: "Auth token absent!!" }],
      };
    }

    const topicId = await getUserMainTopicId(userId, authToken);
    const hcsManagerResponse = await hcsManager(
      topicId,
      comparisonMessage,
      accountId,
      privateKey,
      userId,
      userEmail,
      password
    );

    const txId =
      accountId +
      "@" +
      Math.round(Date.now() / 1000).toString() +
      "." +
      Math.round(Date.now()).toString();

    let message;

    if (!authToken) {
      message = "Auth token absent!!";
    } else {
      message = await deductFees(txId, authToken);
    }
    return {
      content: [
        {
          type: "text",
          text: "Successfully fetched user portfolio and their trends in html format",
        },
        {
          type: "text",
          text: JSON.stringify(stockDetailsMap, null, 2),
        },
        {
          type: "text",
          text: JSON.stringify(hcsManagerResponse, null, 2),
        },
        {
          type: "text",
          text: JSON.stringify(message, null, 2),
        },
      ],
    };
  }
);

/**
 * Generate a report and recommended actions for the user based on the portfolio and the trends.
 * @param stockCodes - Array of stock codes owned by the user
 * @param accountId - Hedera account ID of the user
 * @param privateKey - DER encoded ECDSA private key of the user
 * @param userId - Unique identifier for the portfolio
 * @returns Promise<{content: Array<{type: string, text: string}>}> - Report with recommendations and transaction details
 * @throws Error - If report generation fails
 * @side-effects - Makes HTTP requests to fetch news and creates HCS message
 * @performance - O(n) where n is number of stock codes
 * @example
 * const report = await generateReport({
 *   stockCodes: ["KCB", "SCOM"],
 *   accountId: "0.0.123",
 *   privateKey: "private-key",
 *   userId: "user123"
 * });
 */
server.tool(
  "generate-report",
  "Use Brave Search to generate a brief report and recommended actions(mint, redeem or swap for USDC) for the user based on the portfolio and the trends. The report should include the action needed, the rationale behind it, and the amount of token to be redeemed swapped or minted. If a market sentiment is negative or neutral/negative mint action then a swap actions of the token to USDC action, if a market sentiment is positive suggest a mint action or a swap action from USDC to the token.",
  {
    stockCodes: z.array(z.string()).describe("Stock codes owned by the user"),
    accountId: z.string().describe("Hedera account ID account id of the user"),
    privateKey: z
      .string()
      .describe("DER encoded ECDSA private key of the user"),
    userId: z.string().describe("Unique identifier for the portfolio"),
    userEmail: z.string().describe("User's email address"),
    password: z.string().describe("Account password for the user"),
  },
  async (
    { stockCodes, accountId, privateKey, userId, userEmail, password },
    extra
  ) => {
    try {
      const news = await generateReport(stockCodes);
      const reportMessage = `Report and recommended actions for ${userId} on ${new Date().toISOString()}`;

      const authToken = await getAuthToken(userEmail, password);

      if (!authToken) {
        return {
          content: [{ type: "text", text: "Auth token absent!!" }],
        };
      }

      const topicId = await getUserMainTopicId(userId, authToken);
      const hcsManagerResponse = await hcsManager(
        topicId,
        reportMessage,
        accountId,
        privateKey,
        userId,
        userEmail,
        password
      );

      const txId =
        accountId +
        "@" +
        Math.round(Date.now() / 1000).toString() +
        "." +
        Math.round(Date.now()).toString();

      let message;

      if (!authToken) {
        message = "Auth token absent!!";
      } else {
        message = await deductFees(txId, authToken);
      }
      return {
        content: [
          { type: "text", text: JSON.stringify(news, null, 2) },
          { type: "text", text: JSON.stringify(hcsManagerResponse, null, 2) },
          { type: "text", text: JSON.stringify(message, null, 2) },
        ],
      };
    } catch (error) {
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

/**
 * Execute trading actions based on the report or user's request.
 * @param actions - Array of actions to be executed (mint, redeem, or swap)
 * @param email - User's email for authentication
 * @param password - User's password for authentication
 * @param privateKey - DER encoded ECDSA private key for transaction signing
 * @param accountId - Hedera account ID for transaction signing
 * @param userId - Unique identifier for the portfolio
 * @returns Promise<{content: Array<{type: string, text: string}>}> - Transaction results and details
 * @throws Error - If authentication fails or transaction execution fails
 * @side-effects - Creates blockchain transactions and HCS messages
 * @performance - O(n) where n is number of actions
 * @example
 * const results = await executeTradingActions({
 *   actions: [{
 *     type: "mint",
 *     token: "KCB",
 *     tokenId: "0.0.789",
 *     amount: 100,
 *     rationale: "Positive market sentiment",
 *     targetToken: "USDC"
 *   }],
 *   email: "user@example.com",
 *   password: "password123",
 *   privateKey: "private-key",
 *   accountId: "0.0.123",
 *   userId: "user123"
 * });
 */
server.tool(
  "execute-trading-actions",
  "Use Hedera Agent Kit to execute the trading actions based on the report or by a user's request.",
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
          targetToken: z.string().describe("The token to be swapped to"),
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
      .describe(
        "The Hedera account ID of the user to sign trade transactions."
      ),
    userId: z.string().describe("Unique identifier for the portfolio"),
  },
  async (
    { actions, email, password, privateKey, accountId, userId },
    extra
  ) => {
    let responseContent;
    try {
      const authToken = await getAuthToken(email, password);
      if (!authToken) {
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
          const mintResponse = await mintTokens(
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

          const mintMessage = `Minted ${action.amount} ${
            action.token
          } tokens for ${userId} on ${new Date().toISOString()}`;
          const topicId = await getUserMainTopicId(userId, authToken);
          const hcsManagerResponse = await hcsManager(
            topicId,
            mintMessage,
            accountId,
            privateKey,
            userId,
            email,
            password
          );

          const txId =
            accountId +
            "@" +
            Math.round(Date.now() / 1000).toString() +
            "." +
            Math.round(Date.now()).toString();

          let message;

          if (!authToken) {
            message = "Auth token absent!!";
          } else {
            message = await deductFees(txId, authToken);
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: mintResponse.message,
                    transaction: {
                      tokenId: mintResponse.transaction.tokenId,
                      amount: mintResponse.transaction.amount,
                      status: mintResponse.transaction.status,
                      hederaTransactionId:
                        mintResponse.transaction.hederaTransactionId,
                    },
                  },
                  null,
                  2
                ),
              },
              {
                type: "text",
                text: JSON.stringify(hcsManagerResponse, null, 2),
              },
              {
                type: "text",
                text: JSON.stringify(message, null, 2),
              },
            ],
          };
        } else if (action.type === "redeem") {
          const redeemResponse = await redeemTokens(
            action.token,
            action.amount,
            authToken,
            PrivateKey.fromStringDer(privateKey),
            accountId,
            action.tokenId
          );
          if (!redeemResponse) {
            responseContent = "Failed to redeem tokens.";
            return {
              content: [
                {
                  type: "text",
                  text: responseContent,
                },
              ],
            };
          }
          const redeemMessage = `Redeemed ${action.amount} ${
            action.token
          } tokens for ${userId} on ${new Date().toISOString()}`;
          const topicId = await getUserMainTopicId(userId, authToken);
          const hcsManagerResponse = await hcsManager(
            topicId,
            redeemMessage,
            accountId,
            privateKey,
            userId,
            email,
            password
          );
          const txId =
            accountId +
            "@" +
            Math.round(Date.now() / 1000).toString() +
            "." +
            Math.round(Date.now()).toString();

          let message;

          if (!authToken) {
            message = "Auth token absent!!";
          } else {
            message = await deductFees(txId, authToken);
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(redeemResponse, null, 2),
              },
              {
                type: "text",
                text: JSON.stringify(hcsManagerResponse, null, 2),
              },
              {
                type: "text",
                text: JSON.stringify(message, null, 2),
              },
            ],
          };
        } else if (action.type === "swap") {
          const swapResponse = await swapForUSDC(
            action.token,
            action.amount,
            authToken,
            accountId,
            privateKey
          );
          if (!swapResponse) {
            responseContent = "Failed to swap tokens.";
            return {
              content: [
                {
                  type: "text",
                  text: responseContent,
                },
              ],
            };
          }
          const swapMessage = `Swapped ${action.amount} ${
            action.token
          } for USDC for ${userId} on ${new Date().toISOString()}`;
          const topicId = await getUserMainTopicId(userId, authToken);
          const hcsManagerResponse = await hcsManager(
            topicId,
            swapMessage,
            accountId,
            privateKey,
            userId,
            email,
            password
          );
          const txId =
            accountId +
            "@" +
            Math.round(Date.now() / 1000).toString() +
            "." +
            Math.round(Date.now()).toString();

          let message;

          if (!authToken) {
            message = "Auth token absent!!";
          } else {
            message = await deductFees(txId, authToken);
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(swapResponse, null, 2),
              },
              {
                type: "text",
                text: JSON.stringify(hcsManagerResponse, null, 2),
              },
              {
                type: "text",
                text: JSON.stringify(message, null, 2),
              },
            ],
          };
        } else {
          const noActionMessage = `No action to execute for ${userId} on ${new Date().toISOString()}`;
          const topicId = await getUserMainTopicId(userId, authToken);
          const hcsManagerResponse = await hcsManager(
            topicId,
            noActionMessage,
            accountId,
            privateKey,
            userId,
            email,
            password
          );
          const txId =
            accountId +
            "@" +
            Math.round(Date.now() / 1000).toString() +
            "." +
            Math.round(Date.now()).toString();

          let message;

          if (!authToken) {
            message = "Auth token absent!!";
          } else {
            message = await deductFees(txId, authToken);
          }
          return {
            content: [
              { type: "text", text: "No action to execute" },
              {
                type: "text",
                text: JSON.stringify(hcsManagerResponse, null, 2),
              },
              {
                type: "text",
                text: JSON.stringify(message, null, 2),
              },
            ],
          };
        }
      }
      const noActionMessage = `No action to execute for ${userId} on ${new Date().toISOString()}`;
      const topicId = await getUserMainTopicId(userId, authToken);
      const hcsManagerResponse = await hcsManager(
        topicId,
        noActionMessage,
        accountId,
        privateKey,
        userId,
        email,
        password
      );
      const txId =
        accountId +
        "@" +
        Math.round(Date.now() / 1000).toString() +
        "." +
        Math.round(Date.now()).toString();
      let message;

      if (!authToken) {
        message = "Auth token absent!!";
      } else {
        message = await deductFees(txId, authToken);
      }
      return {
        content: [
          { type: "text", text: "No action to execute" },
          { type: "text", text: JSON.stringify(hcsManagerResponse, null, 2) },
          { type: "text", text: JSON.stringify(message, null, 2) },
        ],
      };
    } catch (error) {
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

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    process.exit(1);
  }
}

main().catch(() => {
  process.exit(1);
});
