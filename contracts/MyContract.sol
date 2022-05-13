// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

interface Comet {
  struct AssetInfo {
    uint8 offset;
    address asset;
    address priceFeed;
    uint64 scale;
    uint64 borrowCollateralFactor;
    uint64 liquidateCollateralFactor;
    uint64 liquidationFactor;
    uint128 supplyCap;
  }

  function supply(address asset, uint amount) external;
  function withdraw(address asset, uint amount) external;

  function getSupplyRate() external view returns (uint);
  function getBorrowRate() external view returns (uint);

  function getBorrowLiquidity(address account) external view returns (int256);

  function getAssetInfoByAddress(address asset) external view returns (AssetInfo memory);

  function getPrice(address priceFeed) external view returns (uint128);
}

interface ERC20 {
  function approve(address spender, uint256 amount) external returns (bool);
}

contract MyContract {
  address public cometAddress;

  constructor(address _cometAddress) {
    cometAddress = _cometAddress;
  }

  /*
   * Get the current supply APR in Compound III
   */
  function getSupplyApr() public view returns (uint) {
    Comet comet = Comet(cometAddress);
    return comet.getSupplyRate();
  }

  /*
   * Get the current borrow APR in Compound III
   */
  function getBorrowApr() public view returns (uint) {
    Comet comet = Comet(cometAddress);
    return comet.getBorrowRate();
  }

  /*
   * Get the amount of base asset that can be borrowed by an account
   *     scaled up by 10 ^ 8
   */
  function getBorrowableAmount(address account) public view returns (int) {
    Comet comet = Comet(cometAddress);
    return comet.getBorrowLiquidity(account);
  }

  /*
   * Get the borrow collateral factor for an asset
   */
  function getBorrowCollateralFactor(address asset) public view returns (uint) {
    Comet comet = Comet(cometAddress);
    return comet.getAssetInfoByAddress(asset).borrowCollateralFactor;
  }

  /*
   * Get the liquidation collateral factor for an asset
   */
  function getLiquidateCollateralFactor(address asset) public view returns (uint) {
    Comet comet = Comet(cometAddress);
    return comet.getAssetInfoByAddress(asset).liquidateCollateralFactor;
  }

    /*
   * Get the liquidation collateral factor for an asset
   */
  function getCompoundPrice(address singleAssetPriceFeed) public view returns (uint) {
    Comet comet = Comet(cometAddress);
    return comet.getPrice(singleAssetPriceFeed);
  }
}
