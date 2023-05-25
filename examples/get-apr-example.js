const assert = require('assert');
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const hre = require('hardhat');
const ethers = require('ethers');
const { resetForkedChain } = require('./common.js');
const networks = require('./addresses.json');
const net = hre.config.cometInstance;

const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
const blockNumber = hre.config.networks.hardhat.forking.blockNumber;

const myContractAbi = [
  'function getSupplyApr() public view returns (uint)',
  'function getBorrowApr() public view returns (uint)',
  'function getRewardAprForSupplyBase(address rewardTokenPriceFeed) public view returns (uint)',
  'function getRewardAprForBorrowBase(address rewardTokenPriceFeed) public view returns (uint)',
];

const cometAbi = [
  'function getSupplyRate(uint) public view returns (uint)',
  'function getBorrowRate(uint) public view returns (uint)',
  'function getUtilization() public view returns (uint)',
  'function baseTokenPriceFeed() public view returns (address)',
  'function getPrice(address) public view returns (uint128)',
  'function totalSupply() external view returns (uint256)',
  'function totalBorrow() external view returns (uint256)',
  'function baseIndexScale() external pure returns (uint64)',
  'function baseTrackingSupplySpeed() external view returns (uint)',
  'function baseTrackingBorrowSpeed() external view returns (uint)',
];

let jsonRpcServer, deployment, cometAddress, usdcAddress, myContractFactory, compPriceFeedAddress;

describe('Calculating the Compound III APRs', function () {
  before(async () => {
    console.log('\n    Running a hardhat local evm fork of a public net...\n');

    jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
      hostname: '127.0.0.1',
      port: 8545,
      provider: hre.network.provider
    });

    await jsonRpcServer.listen();

    compPriceFeedAddress = networks[net].COMP_Price_Feed;
    usdcAddress = networks[net].USDC;
    cometAddress = networks[net].comet;
    myContractFactory = await hre.ethers.getContractFactory('MyContract');
  });

  beforeEach(async () => {
    await resetForkedChain(hre, providerUrl, blockNumber);
    deployment = await myContractFactory.deploy(cometAddress);
  });

  after(async () => {
    await jsonRpcServer.close();
  });

  it('Calculates the Supply APR using JS', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    const secondsPerYear = 60 * 60 * 24 * 365;
    const utilization = await comet.callStatic.getUtilization();
    const supplyRate = await comet.callStatic.getSupplyRate(utilization);
    const supplyApr = +(supplyRate).toString() / 1e18 * secondsPerYear * 100;
    console.log('\tJS - Supply APR', supplyApr, '%');
  });

  it('Calculates the Borrow APR using JS', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    const secondsPerYear = 60 * 60 * 24 * 365;
    const utilization = await comet.callStatic.getUtilization();
    const borrowRate = await comet.callStatic.getBorrowRate(utilization);
    const borrowApr = +(borrowRate).toString() / 1e18 * secondsPerYear * 100;
    console.log('\tJS - Borrow APR', borrowApr, '%');
  });

  it('Calculates the COMP Reward APRs using JS', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    const priceFeedMantissa = 1e8;
    const usdcMantissa = 1e6;
    const secondsPerDay = 60 * 60 * 24;
    const daysInYear = 365;
    const baseIndexScale = +(await comet.callStatic.baseIndexScale());
    const totalSupply = await comet.callStatic.totalSupply();
    const totalBorrow = await comet.callStatic.totalBorrow();
    const baseTokenPriceFeed = await comet.callStatic.baseTokenPriceFeed();

    const compPriceInUsd = +(await comet.callStatic.getPrice(compPriceFeedAddress)).toString() / priceFeedMantissa;
    const usdcPriceInUsd = +(await comet.callStatic.getPrice(baseTokenPriceFeed)).toString() / priceFeedMantissa;

    const usdcTotalSupply = +totalSupply.toString() / usdcMantissa;
    const usdcTotalBorrow = +totalBorrow.toString() / usdcMantissa;
    const baseTrackingSupplySpeed = +(await comet.callStatic.baseTrackingSupplySpeed()).toString();
    const baseTrackingBorrowSpeed = +(await comet.callStatic.baseTrackingBorrowSpeed()).toString();

    const compToSuppliersPerDay = baseTrackingSupplySpeed / baseIndexScale * secondsPerDay;
    const compToBorrowersPerDay = baseTrackingBorrowSpeed / baseIndexScale * secondsPerDay;

    const supplyCompRewardApr = (compPriceInUsd * compToSuppliersPerDay / (usdcTotalSupply * usdcPriceInUsd)) * daysInYear * 100;
    const borrowCompRewardApr = (compPriceInUsd * compToBorrowersPerDay / (usdcTotalBorrow * usdcPriceInUsd)) * daysInYear * 100;

    console.log('\tJS - Supply Base Asset COMP Reward APR', supplyCompRewardApr, '%');
    console.log('\tJS - Borrow Base Asset COMP Reward APR', borrowCompRewardApr, '%');
  });

  it('Calculates the COMP Reward APYs using JS', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    const priceFeedMantissa = 1e8;
    const usdcMantissa = 1e6;
    const secondsPerDay = 60 * 60 * 24;
    const daysInYear = 365;
    const baseIndexScale = +(await comet.callStatic.baseIndexScale());
    const totalSupply = await comet.callStatic.totalSupply();
    const totalBorrow = await comet.callStatic.totalBorrow();
    const baseTokenPriceFeed = await comet.callStatic.baseTokenPriceFeed();

    const compPriceInUsd = +(await comet.callStatic.getPrice(compPriceFeedAddress)).toString() / priceFeedMantissa;
    const usdcPriceInUsd = +(await comet.callStatic.getPrice(baseTokenPriceFeed)).toString() / priceFeedMantissa;

    const usdcTotalSupply = +totalSupply.toString() / usdcMantissa;
    const usdcTotalBorrow = +totalBorrow.toString() / usdcMantissa;
    const baseTrackingSupplySpeed = +(await comet.callStatic.baseTrackingSupplySpeed()).toString();
    const baseTrackingBorrowSpeed = +(await comet.callStatic.baseTrackingBorrowSpeed()).toString();

    const compToSuppliersPerDay = baseTrackingSupplySpeed / baseIndexScale * secondsPerDay;
    const compToBorrowersPerDay = baseTrackingBorrowSpeed / baseIndexScale * secondsPerDay;

    const supplyCompApy = (Math.pow((1 + (compPriceInUsd * compToSuppliersPerDay / (usdcTotalSupply * usdcPriceInUsd))), daysInYear) - 1) * 100;
    const borrowCompApy = (Math.pow((1 + (compPriceInUsd * compToBorrowersPerDay / (usdcTotalBorrow * usdcPriceInUsd))), daysInYear) - 1) * 100;

    console.log('\tJS - Supply Base Asset COMP Reward APY', supplyCompApy, '%');
    console.log('\tJS - Borrow Base Asset COMP Reward APY', borrowCompApy, '%');
  });

  it('Runs COMP Reward APR examples using Solidity', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const MyContract = new ethers.Contract(deployment.address, myContractAbi, provider);

    const supplyApr = await MyContract.callStatic.getSupplyApr();
    const borrowApr = await MyContract.callStatic.getBorrowApr();
    const supplyCompRewardApr = await MyContract.callStatic.getRewardAprForSupplyBase(compPriceFeedAddress);
    const borrowCompRewardApr = await MyContract.callStatic.getRewardAprForBorrowBase(compPriceFeedAddress);

    console.log('\tSolidity - Supply Base Asset APR:', +(supplyApr).toString() / 1e18, '%');
    console.log('\tSolidity - Borrow Base Asset APR:', +(borrowApr).toString() / 1e18, '%');
    console.log('\tSolidity - Supply Base Asset COMP Reward APR:', +supplyCompRewardApr.toString() / 1e18 * 100, '%');
    console.log('\tSolidity - Borrow Base Asset COMP Reward APR:', +borrowCompRewardApr.toString() / 1e18 * 100, '%');
  });
});
