// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

library CometStructs {
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

  struct UserBasic {
    int104 principal;
    uint64 baseTrackingIndex;
    uint64 baseTrackingAccrued;
    uint16 assetsIn;
    uint8 _reserved;
  }

  struct TotalsBasic {
    uint64 baseSupplyIndex;
    uint64 baseBorrowIndex;
    uint64 trackingSupplyIndex;
    uint64 trackingBorrowIndex;
    uint104 totalSupplyBase;
    uint104 totalBorrowBase;
    uint40 lastAccrualTime;
    uint8 pauseFlags;
  }

  struct UserCollateral {
    uint128 balance;
    uint128 _reserved;
  }
}

interface Comet {
  function supply(address asset, uint amount) external;
  function withdraw(address asset, uint amount) external;

  function getSupplyRate(uint utilization) external view returns (uint);
  function getBorrowRate(uint utilization) external view returns (uint);

  function getAssetInfoByAddress(address asset) external view returns (CometStructs.AssetInfo memory);
  function getAssetInfo(uint8 i) external view returns (CometStructs.AssetInfo memory);


  function getPrice(address priceFeed) external view returns (uint128);

  function userBasic(address) external view returns (CometStructs.UserBasic memory);
  function totalsBasic() external view returns (CometStructs.TotalsBasic memory);
  function userCollateral(address, address) external view returns (CometStructs.UserCollateral memory);

  function baseTokenPriceFeed() external view returns (address);

  function numAssets() external view returns (uint8);

  function getUtilization() external view returns (uint);
}

interface ERC20 {
  function approve(address spender, uint256 amount) external returns (bool);
}

contract MyContract {
  address public cometAddress;
  uint constant public SECONDS_PER_YEAR = 60 * 60 * 24 * 365;

  constructor(address _cometAddress) {
    cometAddress = _cometAddress;
  }

  /*
   * Get the current supply APR in Compound III
   */
  function getSupplyApr() public view returns (uint) {
    Comet comet = Comet(cometAddress);
    uint utilization = comet.getUtilization();
    return comet.getSupplyRate(utilization) * SECONDS_PER_YEAR;
  }

  /*
   * Get the current borrow APR in Compound III
   */
  function getBorrowApr() public view returns (uint) {
    Comet comet = Comet(cometAddress);
    uint utilization = comet.getUtilization();
    return comet.getBorrowRate(utilization) * SECONDS_PER_YEAR;
  }

  /*
   * Get the amount of base asset that can be borrowed by an account
   *     scaled up by 10 ^ 8
   */
  function getBorrowableAmount(address account) public view returns (int) {
    Comet comet = Comet(cometAddress);
    uint8 numAssets = comet.numAssets();
    uint16 assetsIn = comet.userBasic(account).assetsIn;
    uint64 si = comet.totalsBasic().baseSupplyIndex;
    uint64 bi = comet.totalsBasic().baseBorrowIndex;
    address baseTokenPriceFeed = comet.baseTokenPriceFeed();

    int liquidity = int(
      presentValue(comet.userBasic(account).principal, si, bi) *
      int256(getCompoundPrice(baseTokenPriceFeed)) /
      int256(1e6) // base token has 6 decimal places
    );

    for (uint8 i = 0; i < numAssets; i++) {
      if (isInAsset(assetsIn, i)) {
        CometStructs.AssetInfo memory asset = comet.getAssetInfo(i);
        uint newAmount = uint(comet.userCollateral(account, asset.asset).balance) * getCompoundPrice(asset.priceFeed) / asset.scale;
        liquidity += int(
          newAmount * asset.borrowCollateralFactor / 1e18
        );
      }
    }

    return liquidity;
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
   * Get the current price of an asset from the protocol's persepctive
   */
  function getCompoundPrice(address singleAssetPriceFeed) public view returns (uint) {
    Comet comet = Comet(cometAddress);
    return comet.getPrice(singleAssetPriceFeed);
  }

  function presentValue(
    int104 principalValue_,
    uint64 baseSupplyIndex_,
    uint64 baseBorrowIndex_
  ) internal pure returns (int104) {
    uint64 BASE_INDEX_SCALE = 1e15;

    if (principalValue_ >= 0) {
      return int104(uint104(principalValue_) * baseSupplyIndex_ / BASE_INDEX_SCALE);
    } else {
      return -int104(uint104(principalValue_) * baseBorrowIndex_ / BASE_INDEX_SCALE);
    }
  }

  function isInAsset(uint16 assetsIn, uint8 assetOffset) internal pure returns (bool) {
    return (assetsIn & (uint16(1) << assetOffset) != 0);
  }
}
