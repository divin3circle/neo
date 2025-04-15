import finnhub from "finnhub";

console.log("Initializing finnhub client...");
const api_key = finnhub.ApiClient.instance.authentications["api_key"];
api_key.apiKey = "cvv5appr01qphtc98ik0cvv5appr01qphtc98ikg";
const finnhubClient = new finnhub.DefaultApi();

async function getStockSymbols() {
  console.log("Fetching stock symbols...");
  return new Promise((resolve, reject) => {
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      reject(new Error("Request timed out after 10 seconds"));
    }, 10000);

    // Use US exchange with XNYS (NYSE) mic code as shown in documentation
    finnhubClient.stockSymbols("US", (error, data, response) => {
      clearTimeout(timeout);
      if (error) {
        console.error("Error fetching symbols:", error);
        reject(error);
      } else {
        console.log(
          "Symbols data received, first few entries:",
          data.slice(0, 3)
        );
        resolve(data);
      }
    });
  });
}

async function getStockQuote(symbol) {
  console.log(`Fetching quote for symbol: ${symbol}`);
  return new Promise((resolve, reject) => {
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      reject(new Error("Request timed out after 10 seconds"));
    }, 10000);

    finnhubClient.quote(symbol, (error, data, response) => {
      clearTimeout(timeout);
      if (error) {
        console.error(`Error fetching quote for ${symbol}:`, error);
        reject(error);
      } else {
        console.log(`Quote data received for ${symbol}:`, data);
        resolve(data);
      }
    });
  });
}

async function main() {
  try {
    console.log("Starting main function...");
    const symbols = await getStockSymbols();

    // Get quote for a specific symbol (e.g., AAPL for Apple)
    const testSymbol = "AAPL";
    console.log(`Fetching quote for test symbol: ${testSymbol}`);
    const quote = await getStockQuote(testSymbol);
    console.log("Stock Quote:", quote);
  } catch (error) {
    console.error("Error in main function:", error);
    throw error;
  }
}

console.log("Script starting...");
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
