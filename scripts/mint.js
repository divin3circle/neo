const options = {
  name: "I&M Holdings Group", // Token name (string, required)
  symbol: "I&M", // Token symbol (string, required)
  decimals: 2, // Number of decimal places (optional, defaults to 0)
  initialSupply: 1000, // Initial supply of tokens (optional, defaults to 0), given in base unit
  isSupplyKey: true, // Supply key flag (optional, defaults to false)
  maxSupply: 10000000, // Maximum token supply (optional, if not set there is no maxSupply), given in base unit
  isMetadataKey: true, // Metadata key flag (optional, defaults to false)
  isAdminKey: true, // Admin key flag (optional, defaults to false)
  tokenMetadata: new TextEncoder().encode("I&M Holdings Group"), // Token metadata (optional, can be omitted if not needed)
  memo: "Initial Token Creation", // Optional memo (string)
};

export default options;
