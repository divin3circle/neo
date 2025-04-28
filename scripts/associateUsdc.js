import {
  AccountId,
  PrivateKey,
  Client,
  TokenAssociateTransaction,
} from "@hashgraph/sdk";

async function main() {
  let client;
  const tokenId = "0.0.5791936";
  try {
    // Your account ID and private key from string value
    const MY_ACCOUNT_ID = AccountId.fromString("0.0.5913311");
    const MY_PRIVATE_KEY = PrivateKey.fromStringDer(
      "3030020100300706052b8104000a04220420b09884fafa1916f965d9b7273c8fefe69d70012a4a7ca6d21bbffa7c80c4f320"
    );

    // Pre-configured client for test network (testnet)
    client = Client.forTestnet();

    //Set the operator with the account ID and private key
    client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

    // Start your code here

    //Associate a token to an account and freeze the unsigned transaction for signing
    const txTokenAssociate = await new TokenAssociateTransaction()
      .setAccountId(MY_ACCOUNT_ID)
      .setTokenIds([tokenId]) //Fill in the token ID
      .freezeWith(client);

    //Sign with the private key of the account that is being associated to a token
    const signTxTokenAssociate = await txTokenAssociate.sign(MY_PRIVATE_KEY);

    //Submit the transaction to a Hedera network
    const txTokenAssociateResponse = await signTxTokenAssociate.execute(client);

    //Request the receipt of the transaction
    const receiptTokenAssociateTx = await txTokenAssociateResponse.getReceipt(
      client
    );

    //Get the transaction consensus status
    const statusTokenAssociateTx = receiptTokenAssociateTx.status;

    //Get the Transaction ID
    const txTokenAssociateId =
      txTokenAssociateResponse.transactionId.toString();

    console.log(
      "--------------------------------- Token Associate ---------------------------------"
    );
    console.log(
      "Receipt status           :",
      statusTokenAssociateTx.toString()
    );
    console.log("Transaction ID           :", txTokenAssociateId);
    console.log(
      "Hashscan URL             :",
      "https://hashscan.io/testnet/tx/" + txTokenAssociateId
    );
  } catch (error) {
    console.error(error);
  } finally {
    if (client) client.close();
  }
}

main();
