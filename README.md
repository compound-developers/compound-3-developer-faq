# Compound III Developer FAQ

This repository contains code examples for frequent Compound III developer tasks.

## How to call methods on the Comet Contract

Compound III has several contract files that make up the public Comet interface. The address of the upgradable proxy contract is used to call methods in Comet.sol, CometExt.sol, and CometCore.sol.

To get the ABI for Comet, run the build process in the Compound III repository. Look for the artifact of `CometInterface.sol` in the generated Hardhat artifacts folder.

```js
// Built Hardhat artifact in Compound III project repository
const abi = require('./artifacts/contracts/CometInterface.sol/CometInterface.json').abi;

const comet = new ethers.Contract(cometAddress, abi, provider);
```

## Patterns for Developers

See `contracts/MyContract.sol` for Solidity examples, and also the individual JavaScript files in `examples/` for the following cases:

- How to get an asset price from the Compound III protocol's perspective
- How to get the Supply or Borrow APR from the protocol
- How to get the borrow capacity for a Compound III account.
- How to get the borrow and liquidate collateral factors for a Compound III asset.
- How to get the principal amount of asset for a Compound III account.
- How to calcualte the interest earned by a Compound III account.
- TODO: How do I fully repay my borrow precisely? (use bulker)
- TODO: How do I find out the TVL? (whole protocol example and per collateral example)

## Deploying Compound III

To deploy to a public blockchain, see the `yarn deploy` instructions in the (README file of the Comet repository)[https://github.com/compound-finance/comet#multi-chain-support]. Be sure to first use the `spider` command to pull in the network's existing configuration and latest contract addresses.

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

## Running Examples

First install all of the repository dependencies.

```
npm install
```

Be sure to set your JSON RPC provider URL at the top of `hardhat.config.js`.

```js
const providerUrl = 'https://eth-mainnet.alchemyapi.io/v2/__YOUR_API_KEY_HERE__';
```

Use the mocha descriptions to run subsets of tests.

- To run all tests: `npm test`
- To run a single file's tests: `npm test -- -g "Find an account's Compound III base asset interest earned"`
- To run a single test: `npm test -- -g 'Finds the interest earned of base asset'`
