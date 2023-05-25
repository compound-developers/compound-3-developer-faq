# Compound III Developer FAQ

This repository contains code examples for frequent Compound III developer tasks.

## Pattern Examples for Developers

See `contracts/MyContract.sol` for **Solidity examples**, and also the individual **JavaScript files** in `examples/` for the following cases:

- How do I supply collateral to Compound III? ([supply-withdraw-example.js](examples/supply-withdraw-example.js))
- How do I borrow the base asset from Compound III? ([borrow-repay-example.js](examples/borrow-repay-example.js))
- How do I get an asset price from the Compound III protocol's perspective? ([get-a-price.js](examples/get-a-price.js))
- How do I get the supported asset addresses from Compound III? ([get-supported-assets.js](examples/get-supported-assets.js))
- How do I get the price feed addresses for assets supported by an instance of Compound III?([get-asset-price-feeds.js](examples/get-asset-price-feeds.js))
- How do I get the Supply or Borrow APR from the protocol? ([get-apr-example.js](examples/get-apr-example.js))
- How do I get the borrow capacity for a Compound III account? ([get-borrowable-amount.js](examples/get-borrowable-amount.js))
- How do I get the borrow and liquidate collateral factors for a Compound III asset? ([get-cf-examples.js](examples/get-cf-examples.js))
- How do I get the principal amount of asset for a Compound III account? ([get-principal-example.js](examples/get-principal-example.js))
- How do I calculate the interest earned by a Compound III account? ([interest-earned-example.js](examples/interest-earned-example.js))
- How do I repay my whole borrow precisely? ([repay-full-borrow-example.js](examples/repay-full-borrow-example.js))
- How do I calculate the APR of COMP rewards? ([get-apr-example.js](examples/get-apr-example.js))
- How do I find out the amount of COMP rewards currently accrued for my account? ([claim-reward-example.js](examples/claim-reward-example.js))
- How do I find out the TVL? ([tvl-example.js](examples/tvl-example.js))

## Running The Examples

First install all of this repository's dependencies.

```
npm install
```

Be sure to set your JSON RPC provider URL at the top of `hardhat.config.js`. Also pick the supported Comet instance to run tests against locally.

```js
const providerUrl = 'https://eth-mainnet.alchemyapi.io/v2/__YOUR_API_KEY_HERE__';
const cometInstance = 'usdc-mainnet';
```

Use the mocha descriptions to run subsets of tests. The Comet instances supported by the tests are listed in `hardhat.config.js`.

- To run all tests: `npm test`. With the environment variable if not set already `MAINNET_PROVIDER_URL="__Alchemy_or_Infura_provider_URL_here__" npm test`.
- To run a single file's tests: `npm test -- -g "Find an account's Compound III base asset interest earned"`
  - Use the description in the top (whole file) level describe block for the test file.
- To run a single test: `npm test -- -g 'Finds the interest earned of base asset'`
  - Use the description in the test level describe block.

## How do I call Comet methods? From off chain? From Solidity?

Compound III has several contract files that make up the public Comet interface. The address of the Compound III upgradable proxy contract is used to call methods in Comet.sol, CometExt.sol, and CometCore.sol.

To get the ABI for Comet, run the build process in the [Compound III repository](https://github.com/compound-finance/comet). Look for the artifact of `CometInterface.sol` in the generated Hardhat artifacts folder.

```bash
## First, run the build command in the Compound III project repository
git clone https://github.com/compound-finance/comet.git
cd comet/
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
git clone https://github.com/compound-finance/comet.git
cd comet/
yarn
npx hardhat spider --deployment mainnet
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
