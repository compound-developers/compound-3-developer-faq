# Compound III Developer FAQ

This repository contains code examples for frequent Compound III developer tasks.

## How do I call Comet methods? From off chain? From Solidity?

Compound III has several contract files that make up the public Comet interface. The address of the Compound III upgradable proxy contract is used to call methods in Comet.sol, CometExt.sol, and CometCore.sol.

To get the ABI for Comet, run the build process in the [Compound III repository](https://github.com/compound-finance/comet). Look for the artifact of `CometInterface.sol` in the generated Hardhat artifacts folder.

```bash
## First, run the build command in the Compound III project repository
yarn run build
```

```js
// Reference the Hardhat artifact in  the Compound III project build files
const abi = require('./artifacts/contracts/CometInterface.sol/CometInterface.json').abi;

const comet = new ethers.Contract(cometAddress, abi, provider);
```

```solidity
pragma solidity 0.8.13;

import "./CometInterface.sol";

contract MyContract { //...
```

## How do I get the latest contract addresses?

Use the spider functionality in the Compound III repository. The addresses can then be found in the `deployments/` folder.

```
cd comet/
yarn
npx hardhat spider --network mainnet
```

## How do I deploy Compound III?

To deploy to a public blockchain, see the `yarn deploy` instructions in the [README file of the Comet repository](https://github.com/compound-finance/comet#multi-chain-support). Be sure to first use the `spider` command to pull in the network's existing configuration and latest contract addresses.

Compound III can be deployed to EVM compatible blockchains. Here is an example for deploying to a locally run Ethereum node.

```
## In one command line window:
git clone https://github.com/compound-finance/comet.git
cd comet/
yarn install

## This runs the ethereum node locally
## The development mnemonic or private keys can be configured in hardhat.config.ts
npx hardhat node

## In another command line window:
cd comet/
## This deploys to the running local ethereum node
## It also writes deployment information to ./deployments/localhost/
yarn deploy --network localhost
```

## Pattern Examples for Developers

See `contracts/MyContract.sol` for Solidity examples, and also the individual JavaScript files in `examples/` for the following cases:

- How do I get an asset price from the Compound III protocol's perspective?
- How do I get the Supply or Borrow APR from the protocol?
- How do I get the borrow capacity for a Compound III account?
- How do I get the borrow and liquidate collateral factors for a Compound III asset?
- How do I get the principal amount of asset for a Compound III account?
- How do I calcualte the interest earned by a Compound III account?
- TODO: How do I repay my whole borrow precisely?
- TODO: How do I transfer all of my base asset within the protocol precisely?
- TODO: How do I find out the TVL? (whole protocol example and per collateral example)
- TODO: How do I calculate the APR of COMP rewards?
- TODO: How do I find out the amount of COMP rewards currently accrued for my account?

## Running Examples

First install all of this repository's dependencies.

```
npm install
```

Be sure to set your JSON RPC provider URL at the top of `hardhat.config.js`. Also check the subdomain and make sure it points to the proper network.

```js
const providerUrl = 'https://eth-mainnet.alchemyapi.io/v2/__YOUR_API_KEY_HERE__';
```

Also make sure that the block number chosen to fork the chain for testing is near the latest block. This is also set in `hardhat.config.js` and can be found using the corresponding blockscan explorer website (i.e. Etherscan).

```js
const providerUrl = process.env.KOVAN_PROVIDER_URL;
const blockNumber = 31985000;
```

Use the mocha descriptions to run subsets of tests.

- To run all tests: `npm test`
- To run a single file's tests: `npm test -- -g "Find an account's Compound III base asset interest earned"`
  - Use the description in the top level describe block for the test file.
- To run a single test: `npm test -- -g 'Finds the interest earned of base asset'`
  - Use the description in the test level describe block.
