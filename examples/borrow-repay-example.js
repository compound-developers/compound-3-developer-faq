const assert = require('assert');
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const hre = require('hardhat');
const ethers = require('ethers');
const { resetForkedChain } = require('./common.js');
const networks = require('./addresses.json');
const net = 'kovan';

const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
const blockNumber = hre.config.networks.hardhat.forking.blockNumber;

const myContractAbi = [
  'function supply(address asset, uint amount) public',
  'function withdraw(address asset, uint amount) public',
];

const cometAbi = [
  'event Supply(address indexed from, address indexed dst, uint256 amount)',
  'function supply(address asset, uint amount)',
  'function withdraw(address asset, uint amount)',
  'function balanceOf(address account) returns (uint256)',
  'function borrowBalanceOf(address account) returns (uint256)',
  'function collateralBalanceOf(address account, address asset) external view returns (uint128)',
];

const wethAbi = [
  'function deposit() payable',
  'function balanceOf(address) returns (uint)',
  'function approve(address, uint) returns (bool)',
  'function transfer(address, uint)',
];

const stdErc20Abi = [
  'function approve(address, uint) returns (bool)',
  'function transfer(address, uint)',
  'function balanceOf(address) returns (uint)',
];

let jsonRpcServer, deployment, cometAddress, myContractFactory, baseAssetAddress, wethAddress;

const mnemonic = hre.network.config.accounts.mnemonic;
const addresses = [];
const privateKeys = [];
for (let i = 0; i < 20; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`);
  addresses.push(wallet.address);
  privateKeys.push(wallet._signingKey().privateKey);
}

describe("Compound III Borrow Examples", function () {
  before(async () => {
    console.log('\n    Running a hardhat local evm fork of a public net...\n');

    jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
      hostname: 'localhost',
      port: 8545,
      provider: hre.network.provider
    });

    await jsonRpcServer.listen();

    baseAssetAddress = networks[net].USDC;
    usdcAddress = baseAssetAddress;
    cometAddress = networks[net].comet;
    wethAddress = networks[net].WETH;
    myContractFactory = await hre.ethers.getContractFactory('MyContract');
  });

  beforeEach(async () => {
    await resetForkedChain(hre, providerUrl, blockNumber);
    deployment = await myContractFactory.deploy(cometAddress);
  });

  after(async () => {
    await jsonRpcServer.close();
  });

  it('Borrows the base asset from Compound', async () => {
    const me = addresses[0];
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const signer = provider.getSigner(me);
    const comet = new ethers.Contract(cometAddress, cometAbi, signer);
    const weth = new ethers.Contract(wethAddress, wethAbi, signer);
    const wethMantissa = 1e18; // WETH and ETH have 18 decimal places
    const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);
    const baseAssetMantissa = 1e6; // USDC has 6 decimal places

    let tx = await weth.deposit({ value: ethers.utils.parseEther('10') });
    await tx.wait(1);

    console.log('\tApproving Comet to move WETH collateral...');
    tx = await weth.approve(cometAddress, ethers.constants.MaxUint256);
    await tx.wait(1);

    console.log('\tSending initial WETH supply of collateral to Compound...');
    tx = await comet.supply(wethAddress, ethers.utils.parseEther('10'));
    await tx.wait(1);

    // Accounts cannot hold a borrow smaller than baseBorrowMin (1000 USDC).
    const borrowSize = 1000;
    console.log('\tExecuting initial borrow of the base asset from Compound...');
    console.log('\tBorrow size:', borrowSize);

    tx = await comet.withdraw(usdcAddress, (borrowSize * baseAssetMantissa).toString());
    await tx.wait(1);

    let bal = await usdc.callStatic.balanceOf(me);
    console.log('\tMy current base asset balance:', +bal.toString() / baseAssetMantissa);

    // Repay some of the open borrow
    const repayAmount = 250; // USDC

    tx = await usdc.approve(cometAddress, (repayAmount * baseAssetMantissa).toString());
    await tx.wait(1);

    tx = await comet.supply(usdcAddress, repayAmount * baseAssetMantissa);
    await tx.wait(1);

    bal = await usdc.callStatic.balanceOf(me);
    console.log('\tMy current base asset balance:', +bal.toString() / baseAssetMantissa);
  });

  it('Borrows the base asset from Compound using solidity', async () => {
    const me = addresses[0];
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const signer = provider.getSigner(me);
    const comet = new ethers.Contract(cometAddress, cometAbi, signer);
    const MyContract = new ethers.Contract(deployment.address, myContractAbi, signer);
    const weth = new ethers.Contract(wethAddress, wethAbi, signer);
    const wethMantissa = 1e18; // WETH and ETH have 18 decimal places
    const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);
    const baseAssetMantissa = 1e6; // USDC has 6 decimal places

    let tx = await weth.deposit({ value: ethers.utils.parseEther('10') });
    await tx.wait(1);

    console.log('\tTransferring WETH to MyContract to use as collateral...');
    tx = await weth.transfer(MyContract.address, ethers.utils.parseEther('10'));
    await tx.wait(1);

    console.log('\tSending initial supply to Compound...');
    tx = await MyContract.supply(wethAddress, ethers.utils.parseEther('10'));
    await tx.wait(1);

    // Accounts cannot hold a borrow smaller than baseBorrowMin (1000 USDC).
    const borrowSize = 1000;
    console.log('\tExecuting initial borrow of the base asset from Compound...');
    console.log('\tBorrow size:', borrowSize);

    tx = await MyContract.withdraw(usdcAddress, (borrowSize * baseAssetMantissa).toString());
    await tx.wait(1);

    let bal = await usdc.callStatic.balanceOf(MyContract.address);
    console.log("\tMyContract's current base asset balance:", +bal.toString() / baseAssetMantissa);

    // Repay some of the open borrow
    const repayAmount = 250; // USDC

    tx = await MyContract.supply(usdcAddress, repayAmount * baseAssetMantissa);
    await tx.wait(1);

    bal = await usdc.callStatic.balanceOf(MyContract.address);
    console.log("\tMyContract's current base asset balance:", +bal.toString() / baseAssetMantissa);
  });
});
