declare module "*.js" {
  const options: {
    name: string;
    symbol: string;
    decimals: number;
    initialSupply: number;
    maxSupply: number;
    treasuryAccountId: string;
    adminKey: string;
    supplyKey: string;
    freezeKey: string;
    wipeKey: string;
    pauseKey: string;
  };
  export default options;
}
