const { HederaAgentKit } = require("@hashgraph/hedera-sdk");
import { TokenId } from "@hashgraph/sdk";
import { initializeHederaAgent } from "../src/helpers";

const kit = await initializeHederaAgent();

const tokenId = "0.0.5791936";
const recipientAccountId = "";
const amount = 100;

const transferResult = await kit.transferToken(
  TokenId.fromString(tokenId),
  recipientAccountId,
  amount
);
console.log(JSON.stringify(transferResult, null, 2));
