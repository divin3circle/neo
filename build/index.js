import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { HederaAgentKit } from "hedera-agent-kit";
import fs from "fs";
// Constants that were previously in .env
const ACCOUNT_ID = "0.0.5824374";
const DER_PRIVATE_KEY = "3030020100300706052b8104000a04220420969f1f80158f05f4589f6f607b09d6c6478bcd83fe3766bc2922415f8b093c23";
const DER_PUBLIC_KEY = "302d300706052b8104000a03220003c0f30d0b3b078d339cf198281cc803397566c89b584aa583983f7c04791014aa";
const NETWORK = "testnet";
const TEST_EMAIL = "sylusabel4@example.com";
const TEST_PASSWORD = "sam@2002";
const TEST_USER_ID = "67e50b7ce4a9ae751ea2e999";
// Mapping between token symbols and their corresponding stock codes
const SYMBOL_TO_STOCK_CODE = {
    "I&M": "IMH",
    // Add more mappings as needed
};
// Create server without Hedera initialization
const server = new McpServer({
    name: "neo",
    version: "0.1.0",
    description: "Intelligent Portfolio Management Agent",
    capabilities: {
        resources: {},
        tools: {},
    },
});
// Helper function to initialize Hedera agent
async function initializeHederaAgent() {
    try {
        return new HederaAgentKit(ACCOUNT_ID, DER_PRIVATE_KEY, DER_PUBLIC_KEY, NETWORK);
    }
    catch (error) {
        console.error("Error initializing Hedera Agent Kit:", error);
        throw error;
    }
}
// Register get portfolio and token balance tool
server.tool("get-balances", "Get the balances of all token holdings and stocks for a given portfolio", {
    userId: z.string().describe("Unique identifier for the portfolio"),
    includePrices: z
        .boolean()
        .optional()
        .describe("Include current USD prices in the response"),
}, async ({ userId, includePrices = true }) => {
    try {
        console.error("Initializing Hedera agent...");
        const hederaAgent = await initializeHederaAgent();
        console.error("Fetching token balances...");
        const rawTokenBalances = await hederaAgent.getAllTokensBalances(NETWORK);
        const tokenBalances = rawTokenBalances.map((token) => ({
            tokenId: token.tokenId,
            balance: token.balance,
            symbol: token.tokenSymbol,
        }));
        const stockBalances = await fetchStockBalances(userId, TEST_EMAIL, TEST_PASSWORD);
        let tokenPrices = {};
        let stockPrices = {};
        if (includePrices) {
            tokenPrices = await fetchStockPrices(tokenBalances.map((t) => t.symbol));
            stockPrices = await fetchStockPrices(stockBalances.map((s) => s.stockCode));
        }
        const aggregatedData = {
            tokens: tokenBalances.map((token) => ({
                ...token,
                value: includePrices
                    ? token.balance * (tokenPrices[token.symbol] || 0)
                    : 0,
            })),
            stocks: stockBalances.map((stock) => ({
                ...stock,
                value: includePrices
                    ? stock.quantity * (stockPrices[stock.stockCode] || 0)
                    : 0,
            })),
            totalValue: 0,
            lastUpdated: Date.now(),
        };
        aggregatedData.totalValue =
            aggregatedData.tokens.reduce((sum, t) => sum + t.value, 0) +
                aggregatedData.stocks.reduce((sum, s) => sum + s.value, 0);
        return {
            content: [
                {
                    type: "text",
                    text: "Successfully fetched and aggregated balance data",
                },
                {
                    type: "text",
                    text: JSON.stringify(aggregatedData, null, 2),
                },
            ],
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [
                {
                    type: "text",
                    text: `Error fetching balances: ${errorMessage}`,
                },
            ],
        };
    }
});
// Helper functions
async function fetchStockBalances(userId, email, password) {
    try {
        console.log("---------------🔂Attempting to fetch stock balances🔂---------------");
        console.log("\n");
        const loginResponse = await fetch(`http://localhost:5004/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
        });
        if (!loginResponse.ok) {
            throw new Error(`*************❌Login failed: ${loginResponse.statusText}❌*************`);
        }
        const loginData = await loginResponse.json();
        const token = loginData.token;
        console.log("--------------👌Login successful, token received👌----------------");
        console.log("\n");
        const authResponse = await fetch(`http://localhost:5004/api/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
        if (!authResponse.ok) {
            throw new Error(`Failed to fetch user profile: ${authResponse.statusText}`);
        }
        const authData = await authResponse.json();
        const stocks = authData.user.stockHoldings;
        if (!stocks || !Array.isArray(stocks)) {
            throw new Error("Invalid stock holdings data format");
        }
        const stockHoldings = stocks.map((holding) => ({
            _id: holding._id || "",
            stockCode: holding.stockCode || "",
            quantity: Number(holding.quantity) || 0,
            lockedQuantity: Number(holding.lockedQuantity) || 0,
            value: Number(holding.value) || 0,
        }));
        console.log(`--------------✅${stockHoldings.length} stocks holdings processed✅----------------`, stockHoldings);
        console.log("\n");
        return stockHoldings;
    }
    catch (error) {
        console.error(`*************❌Error in fetchStockBalances: ${error}❌*************`);
        console.log("\n");
        throw error;
    }
}
async function fetchStockPrices(symbols) {
    try {
        console.error("Original symbols:", symbols);
        // Convert token symbols to stock codes using the mapping
        const stockCodes = symbols.map((symbol) => {
            const stockCode = SYMBOL_TO_STOCK_CODE[symbol] || symbol;
            if (stockCode !== symbol) {
                console.error(`Mapped ${symbol} to ${stockCode}`);
            }
            return stockCode;
        });
        console.error("Converted to stock codes:", stockCodes);
        const csvData = await fs.promises.readFile("data/nse_stocks_2024.csv", "utf-8");
        const rows = csvData.split("\n");
        console.error("CSV header:", rows[0]);
        const prices = {};
        let matchedSymbols = 0;
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].split(",");
            if (row.length < 8)
                continue;
            const code = row[1].trim();
            const dayPrice = row[7].trim();
            if (!code || !dayPrice || dayPrice === "-")
                continue;
            if (stockCodes.includes(code)) {
                console.error(`Found match for ${code} with price ${dayPrice}`);
                const price = parseFloat(dayPrice.replace(/,/g, ""));
                if (!isNaN(price)) {
                    // Find the original symbol for this stock code
                    const originalSymbol = symbols[stockCodes.indexOf(code)];
                    prices[originalSymbol] = price;
                    matchedSymbols++;
                }
            }
        }
        console.error(`Matched ${matchedSymbols} out of ${symbols.length} symbols`);
        console.error("Unmatched symbols:", symbols.filter((s) => !prices[s]));
        console.error("Final prices object:", prices);
        symbols.forEach((symbol) => {
            if (!prices[symbol]) {
                console.error(`No price match found for symbol: ${symbol} (stock code: ${SYMBOL_TO_STOCK_CODE[symbol] || symbol})`);
                prices[symbol] = 0;
            }
        });
        return prices;
    }
    catch (error) {
        console.error("Error reading stock prices:", error);
        if (error instanceof Error && error.message.includes("ENOENT")) {
            console.error("CSV file not found at data/nse_stocks_2024.csv");
        }
        return {};
    }
}
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Neo MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
