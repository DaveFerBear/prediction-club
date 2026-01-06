// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ClubVaultV1} from "../src/ClubVaultV1.sol";

/**
 * @title Deploy
 * @notice Deployment script for ClubVaultV1
 *
 * Usage:
 *   # Dry run on Amoy
 *   forge script script/Deploy.s.sol --rpc-url amoy
 *
 *   # Deploy to Amoy
 *   forge script script/Deploy.s.sol --rpc-url amoy --broadcast --verify
 *
 *   # Deploy to Polygon mainnet
 *   forge script script/Deploy.s.sol --rpc-url polygon --broadcast --verify
 *
 * Required environment variables:
 *   - PRIVATE_KEY: Deployer private key
 *   - SAFE_ADDRESS: Gnosis Safe address that will own the vault
 *   - COLLATERAL_TOKEN: USDC address on the target network
 */
contract Deploy is Script {
    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address safeAddress = vm.envAddress("SAFE_ADDRESS");
        address collateralToken = vm.envAddress("COLLATERAL_TOKEN");

        console2.log("Deployer:", vm.addr(deployerPrivateKey));
        console2.log("Safe address:", safeAddress);
        console2.log("Collateral token:", collateralToken);

        vm.startBroadcast(deployerPrivateKey);

        ClubVaultV1 vault = new ClubVaultV1(safeAddress, collateralToken);

        console2.log("ClubVaultV1 deployed at:", address(vault));
        console2.log("Vault safe:", vault.safe());
        console2.log("Vault collateralToken:", address(vault.collateralToken()));

        vm.stopBroadcast();
    }
}

/**
 * @title DeployTestnet
 * @notice Convenience script for testnet deployment with commonly used addresses
 */
contract DeployTestnet is Script {
    // Polygon Amoy testnet addresses
    address constant AMOY_USDC = 0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582; // Example - verify actual address

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address safeAddress = vm.envAddress("SAFE_ADDRESS");

        // Use env override or default testnet USDC
        address collateralToken = vm.envOr("COLLATERAL_TOKEN", AMOY_USDC);

        console2.log("=== Testnet Deployment ===");
        console2.log("Deployer:", vm.addr(deployerPrivateKey));
        console2.log("Safe address:", safeAddress);
        console2.log("Collateral token:", collateralToken);

        vm.startBroadcast(deployerPrivateKey);

        ClubVaultV1 vault = new ClubVaultV1(safeAddress, collateralToken);

        console2.log("");
        console2.log("=== Deployment Complete ===");
        console2.log("ClubVaultV1:", address(vault));

        vm.stopBroadcast();
    }
}
