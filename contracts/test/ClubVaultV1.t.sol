// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {ClubVaultV1} from "../src/ClubVaultV1.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract ClubVaultV1Test is Test {
    ClubVaultV1 public vault;
    MockERC20 public usdc;
    MockERC20 public otherToken;

    address public safe = address(0x5AFE);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public charlie = address(0xC4A711E);

    uint256 constant INITIAL_BALANCE = 10_000e6; // 10,000 USDC

    function setUp() public {
        // Deploy mock USDC
        usdc = new MockERC20("USD Coin", "USDC", 6);
        otherToken = new MockERC20("Other Token", "OTHER", 18);

        // Deploy vault
        vault = new ClubVaultV1(safe, address(usdc));

        // Mint USDC to test users
        usdc.mint(alice, INITIAL_BALANCE);
        usdc.mint(bob, INITIAL_BALANCE);
        usdc.mint(charlie, INITIAL_BALANCE);

        // Approve vault for all users
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);

        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);

        vm.prank(charlie);
        usdc.approve(address(vault), type(uint256).max);
    }

    // =========================================================================
    // Constructor Tests
    // =========================================================================

    function test_Constructor_SetsImmutables() public view {
        assertEq(vault.safe(), safe);
        assertEq(address(vault.collateralToken()), address(usdc));
    }

    function test_Constructor_RevertsOnZeroSafe() public {
        vm.expectRevert(ClubVaultV1.ZeroAddress.selector);
        new ClubVaultV1(address(0), address(usdc));
    }

    function test_Constructor_RevertsOnZeroCollateral() public {
        vm.expectRevert(ClubVaultV1.ZeroAddress.selector);
        new ClubVaultV1(safe, address(0));
    }

    // =========================================================================
    // Deposit Tests
    // =========================================================================

    function test_Deposit_IncreasesAvailable() public {
        uint256 depositAmount = 1000e6;

        vm.prank(alice);
        vault.deposit(depositAmount);

        ClubVaultV1.MemberBalance memory bal = vault.balanceOf(alice);
        assertEq(bal.available, depositAmount);
        assertEq(bal.committed, 0);
        assertEq(vault.availableOf(alice), depositAmount);
    }

    function test_Deposit_TransfersTokens() public {
        uint256 depositAmount = 1000e6;
        uint256 aliceBalBefore = usdc.balanceOf(alice);
        uint256 vaultBalBefore = usdc.balanceOf(address(vault));

        vm.prank(alice);
        vault.deposit(depositAmount);

        assertEq(usdc.balanceOf(alice), aliceBalBefore - depositAmount);
        assertEq(usdc.balanceOf(address(vault)), vaultBalBefore + depositAmount);
    }

    function test_Deposit_EmitsEvent() public {
        uint256 depositAmount = 1000e6;

        vm.expectEmit(true, false, false, true);
        emit ClubVaultV1.Deposited(alice, depositAmount);

        vm.prank(alice);
        vault.deposit(depositAmount);
    }

    function test_Deposit_RevertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(ClubVaultV1.ZeroAmount.selector);
        vault.deposit(0);
    }

    function test_DepositFor_CreditsTargetMember() public {
        uint256 depositAmount = 500e6;

        vm.prank(alice);
        vault.depositFor(bob, depositAmount);

        // Alice paid
        assertEq(usdc.balanceOf(alice), INITIAL_BALANCE - depositAmount);

        // Bob credited
        assertEq(vault.availableOf(bob), depositAmount);
        assertEq(vault.availableOf(alice), 0);
    }

    function test_DepositFor_RevertsOnZeroMember() public {
        vm.prank(alice);
        vm.expectRevert(ClubVaultV1.ZeroAddress.selector);
        vault.depositFor(address(0), 100e6);
    }

    // =========================================================================
    // Commit Tests
    // =========================================================================

    function test_Commit_ReducesAvailableIncreasesCommitted() public {
        uint256 depositAmount = 1000e6;
        uint256 commitAmount = 400e6;
        bytes32 cohortId = keccak256("cohort-1");

        // Setup: deposit
        vm.prank(alice);
        vault.deposit(depositAmount);

        // Commit
        ClubVaultV1.CommitEntry[] memory entries = new ClubVaultV1.CommitEntry[](1);
        entries[0] = ClubVaultV1.CommitEntry({member: alice, amount: commitAmount});

        vm.prank(safe);
        vault.commitToCohort(cohortId, entries);

        // Verify balances
        ClubVaultV1.MemberBalance memory bal = vault.balanceOf(alice);
        assertEq(bal.available, depositAmount - commitAmount);
        assertEq(bal.committed, commitAmount);
    }

    function test_Commit_UpdatesCohortAccounting() public {
        uint256 depositAmount = 1000e6;
        uint256 commitAmount = 400e6;
        bytes32 cohortId = keccak256("cohort-1");

        vm.prank(alice);
        vault.deposit(depositAmount);

        ClubVaultV1.CommitEntry[] memory entries = new ClubVaultV1.CommitEntry[](1);
        entries[0] = ClubVaultV1.CommitEntry({member: alice, amount: commitAmount});

        vm.prank(safe);
        vault.commitToCohort(cohortId, entries);

        assertEq(vault.cohortCommittedRemaining(cohortId, alice), commitAmount);
        assertEq(vault.cohortTotalRemaining(cohortId), commitAmount);
        assertFalse(vault.cohortFinalized(cohortId));
    }

    function test_Commit_MultipleMembers() public {
        bytes32 cohortId = keccak256("cohort-1");

        // Deposits
        vm.prank(alice);
        vault.deposit(1000e6);
        vm.prank(bob);
        vault.deposit(2000e6);

        // Commit both
        ClubVaultV1.CommitEntry[] memory entries = new ClubVaultV1.CommitEntry[](2);
        entries[0] = ClubVaultV1.CommitEntry({member: alice, amount: 300e6});
        entries[1] = ClubVaultV1.CommitEntry({member: bob, amount: 500e6});

        vm.prank(safe);
        vault.commitToCohort(cohortId, entries);

        assertEq(vault.committedOf(alice), 300e6);
        assertEq(vault.committedOf(bob), 500e6);
        assertEq(vault.cohortTotalRemaining(cohortId), 800e6);
    }

    function test_Commit_EmitsEvents() public {
        bytes32 cohortId = keccak256("cohort-1");

        vm.prank(alice);
        vault.deposit(1000e6);

        ClubVaultV1.CommitEntry[] memory entries = new ClubVaultV1.CommitEntry[](1);
        entries[0] = ClubVaultV1.CommitEntry({member: alice, amount: 500e6});

        vm.expectEmit(true, true, false, true);
        emit ClubVaultV1.CohortCommitted(cohortId, alice, 500e6);

        vm.prank(safe);
        vault.commitToCohort(cohortId, entries);
    }

    function test_Commit_RevertsOnInsufficientAvailable() public {
        bytes32 cohortId = keccak256("cohort-1");

        vm.prank(alice);
        vault.deposit(100e6);

        ClubVaultV1.CommitEntry[] memory entries = new ClubVaultV1.CommitEntry[](1);
        entries[0] = ClubVaultV1.CommitEntry({member: alice, amount: 200e6});

        vm.prank(safe);
        vm.expectRevert(
            abi.encodeWithSelector(ClubVaultV1.InsufficientAvailable.selector, alice, 100e6, 200e6)
        );
        vault.commitToCohort(cohortId, entries);
    }

    function test_Commit_RevertsOnFinalizedCohort() public {
        bytes32 cohortId = keccak256("cohort-1");

        // Deposit and commit
        vm.prank(alice);
        vault.deposit(1000e6);

        ClubVaultV1.CommitEntry[] memory entries = new ClubVaultV1.CommitEntry[](1);
        entries[0] = ClubVaultV1.CommitEntry({member: alice, amount: 500e6});

        vm.prank(safe);
        vault.commitToCohort(cohortId, entries);

        // Settle fully to finalize
        ClubVaultV1.SettleEntry[] memory settleEntries = new ClubVaultV1.SettleEntry[](1);
        settleEntries[0] = ClubVaultV1.SettleEntry({member: alice, commitAmount: 500e6, payoutAmount: 600e6});

        vm.prank(safe);
        vault.settleCohort(cohortId, settleEntries);

        assertTrue(vault.cohortFinalized(cohortId));

        // Try to commit again
        vm.prank(safe);
        vm.expectRevert(abi.encodeWithSelector(ClubVaultV1.CohortFinalized.selector, cohortId));
        vault.commitToCohort(cohortId, entries);
    }

    function test_Commit_RevertsIfNotSafe() public {
        bytes32 cohortId = keccak256("cohort-1");

        ClubVaultV1.CommitEntry[] memory entries = new ClubVaultV1.CommitEntry[](1);
        entries[0] = ClubVaultV1.CommitEntry({member: alice, amount: 100e6});

        vm.prank(alice);
        vm.expectRevert(ClubVaultV1.OnlySafe.selector);
        vault.commitToCohort(cohortId, entries);
    }

    function test_Commit_RevertsOnZeroAddress() public {
        bytes32 cohortId = keccak256("cohort-1");

        ClubVaultV1.CommitEntry[] memory entries = new ClubVaultV1.CommitEntry[](1);
        entries[0] = ClubVaultV1.CommitEntry({member: address(0), amount: 100e6});

        vm.prank(safe);
        vm.expectRevert(ClubVaultV1.ZeroAddress.selector);
        vault.commitToCohort(cohortId, entries);
    }

    function test_Commit_RevertsOnZeroAmount() public {
        bytes32 cohortId = keccak256("cohort-1");

        vm.prank(alice);
        vault.deposit(1000e6);

        ClubVaultV1.CommitEntry[] memory entries = new ClubVaultV1.CommitEntry[](1);
        entries[0] = ClubVaultV1.CommitEntry({member: alice, amount: 0});

        vm.prank(safe);
        vm.expectRevert(ClubVaultV1.ZeroAmount.selector);
        vault.commitToCohort(cohortId, entries);
    }

    // =========================================================================
    // Withdraw Tests
    // =========================================================================

    function test_Withdraw_RevertsIfAmountGreaterThanAvailable() public {
        vm.prank(alice);
        vault.deposit(100e6);

        vm.prank(safe);
        vm.expectRevert(
            abi.encodeWithSelector(ClubVaultV1.InsufficientAvailable.selector, alice, 100e6, 200e6)
        );
        vault.withdraw(alice, 200e6);
    }

    function test_Withdraw_SucceedsFromAvailable() public {
        uint256 depositAmount = 1000e6;
        uint256 withdrawAmount = 400e6;

        vm.prank(alice);
        vault.deposit(depositAmount);

        uint256 aliceBalBefore = usdc.balanceOf(alice);

        vm.prank(safe);
        vault.withdraw(alice, withdrawAmount);

        assertEq(vault.availableOf(alice), depositAmount - withdrawAmount);
        assertEq(usdc.balanceOf(alice), aliceBalBefore + withdrawAmount);
    }

    function test_Withdraw_UsesWithdrawAddress() public {
        address withdrawDest = address(0xDEST);

        vm.prank(alice);
        vault.deposit(1000e6);

        vm.prank(alice);
        vault.setWithdrawAddress(withdrawDest);

        uint256 destBalBefore = usdc.balanceOf(withdrawDest);

        vm.prank(safe);
        vault.withdraw(alice, 500e6);

        assertEq(usdc.balanceOf(withdrawDest), destBalBefore + 500e6);
    }

    function test_Withdraw_EmitsEvent() public {
        vm.prank(alice);
        vault.deposit(1000e6);

        vm.expectEmit(true, true, false, true);
        emit ClubVaultV1.Withdrawn(alice, alice, 500e6);

        vm.prank(safe);
        vault.withdraw(alice, 500e6);
    }

    function test_Withdraw_RevertsIfNotSafe() public {
        vm.prank(alice);
        vault.deposit(1000e6);

        vm.prank(alice);
        vm.expectRevert(ClubVaultV1.OnlySafe.selector);
        vault.withdraw(alice, 500e6);
    }

    function test_Withdraw_RevertsOnZeroAddress() public {
        vm.prank(safe);
        vm.expectRevert(ClubVaultV1.ZeroAddress.selector);
        vault.withdraw(address(0), 100e6);
    }

    function test_Withdraw_RevertsOnZeroAmount() public {
        vm.prank(alice);
        vault.deposit(1000e6);

        vm.prank(safe);
        vm.expectRevert(ClubVaultV1.ZeroAmount.selector);
        vault.withdraw(alice, 0);
    }

    // =========================================================================
    // Settle Tests
    // =========================================================================

    function test_Settle_MovesCommittedDownCreditsAvailable() public {
        bytes32 cohortId = keccak256("cohort-1");

        // Deposit and commit
        vm.prank(alice);
        vault.deposit(1000e6);

        ClubVaultV1.CommitEntry[] memory commitEntries = new ClubVaultV1.CommitEntry[](1);
        commitEntries[0] = ClubVaultV1.CommitEntry({member: alice, amount: 500e6});

        vm.prank(safe);
        vault.commitToCohort(cohortId, commitEntries);

        // Verify committed state
        assertEq(vault.availableOf(alice), 500e6);
        assertEq(vault.committedOf(alice), 500e6);

        // Settle with profit
        ClubVaultV1.SettleEntry[] memory settleEntries = new ClubVaultV1.SettleEntry[](1);
        settleEntries[0] = ClubVaultV1.SettleEntry({
            member: alice,
            commitAmount: 500e6,
            payoutAmount: 700e6 // 200 profit
        });

        vm.prank(safe);
        vault.settleCohort(cohortId, settleEntries);

        // Verify final state
        assertEq(vault.committedOf(alice), 0);
        assertEq(vault.availableOf(alice), 500e6 + 700e6); // remaining + payout
    }

    function test_Settle_EmitsEvents() public {
        bytes32 cohortId = keccak256("cohort-1");

        vm.prank(alice);
        vault.deposit(1000e6);

        ClubVaultV1.CommitEntry[] memory commitEntries = new ClubVaultV1.CommitEntry[](1);
        commitEntries[0] = ClubVaultV1.CommitEntry({member: alice, amount: 500e6});

        vm.prank(safe);
        vault.commitToCohort(cohortId, commitEntries);

        ClubVaultV1.SettleEntry[] memory settleEntries = new ClubVaultV1.SettleEntry[](1);
        settleEntries[0] = ClubVaultV1.SettleEntry({member: alice, commitAmount: 500e6, payoutAmount: 600e6});

        vm.expectEmit(true, true, false, true);
        emit ClubVaultV1.CohortSettled(cohortId, alice, 500e6, 600e6);

        vm.prank(safe);
        vault.settleCohort(cohortId, settleEntries);
    }

    function test_Settle_RevertsOnInsufficientCohortCommit() public {
        bytes32 cohortId = keccak256("cohort-1");

        vm.prank(alice);
        vault.deposit(1000e6);

        ClubVaultV1.CommitEntry[] memory commitEntries = new ClubVaultV1.CommitEntry[](1);
        commitEntries[0] = ClubVaultV1.CommitEntry({member: alice, amount: 200e6});

        vm.prank(safe);
        vault.commitToCohort(cohortId, commitEntries);

        // Try to settle more than committed to this cohort
        ClubVaultV1.SettleEntry[] memory settleEntries = new ClubVaultV1.SettleEntry[](1);
        settleEntries[0] = ClubVaultV1.SettleEntry({member: alice, commitAmount: 300e6, payoutAmount: 300e6});

        vm.prank(safe);
        vm.expectRevert(
            abi.encodeWithSelector(ClubVaultV1.InsufficientCohortCommit.selector, cohortId, alice, 200e6, 300e6)
        );
        vault.settleCohort(cohortId, settleEntries);
    }

    function test_Settle_RevertsOnInsufficientCommitted() public {
        bytes32 cohortId1 = keccak256("cohort-1");
        bytes32 cohortId2 = keccak256("cohort-2");

        vm.prank(alice);
        vault.deposit(1000e6);

        // Commit to cohort 1
        ClubVaultV1.CommitEntry[] memory entries1 = new ClubVaultV1.CommitEntry[](1);
        entries1[0] = ClubVaultV1.CommitEntry({member: alice, amount: 400e6});
        vm.prank(safe);
        vault.commitToCohort(cohortId1, entries1);

        // Commit to cohort 2
        ClubVaultV1.CommitEntry[] memory entries2 = new ClubVaultV1.CommitEntry[](1);
        entries2[0] = ClubVaultV1.CommitEntry({member: alice, amount: 400e6});
        vm.prank(safe);
        vault.commitToCohort(cohortId2, entries2);

        // Settle cohort 1
        ClubVaultV1.SettleEntry[] memory settle1 = new ClubVaultV1.SettleEntry[](1);
        settle1[0] = ClubVaultV1.SettleEntry({member: alice, commitAmount: 400e6, payoutAmount: 400e6});
        vm.prank(safe);
        vault.settleCohort(cohortId1, settle1);

        // Now alice has 400 committed (for cohort2)
        // Try to settle cohort2 with more than her total committed
        ClubVaultV1.SettleEntry[] memory settle2 = new ClubVaultV1.SettleEntry[](1);
        settle2[0] = ClubVaultV1.SettleEntry({member: alice, commitAmount: 500e6, payoutAmount: 500e6});

        vm.prank(safe);
        vm.expectRevert(
            abi.encodeWithSelector(ClubVaultV1.InsufficientCohortCommit.selector, cohortId2, alice, 400e6, 500e6)
        );
        vault.settleCohort(cohortId2, settle2);
    }

    // =========================================================================
    // Cohort Remaining Accounting Tests
    // =========================================================================

    function test_CohortRemainingAccounting_Finalizes() public {
        bytes32 cohortId = keccak256("cohort-1");

        // Deposit and commit multiple members
        vm.prank(alice);
        vault.deposit(1000e6);
        vm.prank(bob);
        vault.deposit(1000e6);

        ClubVaultV1.CommitEntry[] memory entries = new ClubVaultV1.CommitEntry[](2);
        entries[0] = ClubVaultV1.CommitEntry({member: alice, amount: 300e6});
        entries[1] = ClubVaultV1.CommitEntry({member: bob, amount: 200e6});

        vm.prank(safe);
        vault.commitToCohort(cohortId, entries);

        assertEq(vault.cohortTotalRemaining(cohortId), 500e6);
        assertFalse(vault.cohortFinalized(cohortId));

        // Partial settle
        ClubVaultV1.SettleEntry[] memory partial = new ClubVaultV1.SettleEntry[](1);
        partial[0] = ClubVaultV1.SettleEntry({member: alice, commitAmount: 300e6, payoutAmount: 350e6});

        vm.prank(safe);
        vault.settleCohort(cohortId, partial);

        assertEq(vault.cohortTotalRemaining(cohortId), 200e6);
        assertFalse(vault.cohortFinalized(cohortId));

        // Final settle
        ClubVaultV1.SettleEntry[] memory final_ = new ClubVaultV1.SettleEntry[](1);
        final_[0] = ClubVaultV1.SettleEntry({member: bob, commitAmount: 200e6, payoutAmount: 150e6});

        vm.prank(safe);
        vault.settleCohort(cohortId, final_);

        assertEq(vault.cohortTotalRemaining(cohortId), 0);
        assertTrue(vault.cohortFinalized(cohortId));
    }

    function test_CohortRemainingAccounting_MultipleCohortsIndependent() public {
        bytes32 cohortId1 = keccak256("cohort-1");
        bytes32 cohortId2 = keccak256("cohort-2");

        vm.prank(alice);
        vault.deposit(1000e6);

        // Commit to cohort 1
        ClubVaultV1.CommitEntry[] memory entries1 = new ClubVaultV1.CommitEntry[](1);
        entries1[0] = ClubVaultV1.CommitEntry({member: alice, amount: 300e6});
        vm.prank(safe);
        vault.commitToCohort(cohortId1, entries1);

        // Commit to cohort 2
        ClubVaultV1.CommitEntry[] memory entries2 = new ClubVaultV1.CommitEntry[](1);
        entries2[0] = ClubVaultV1.CommitEntry({member: alice, amount: 200e6});
        vm.prank(safe);
        vault.commitToCohort(cohortId2, entries2);

        // Verify independent tracking
        assertEq(vault.cohortCommittedRemaining(cohortId1, alice), 300e6);
        assertEq(vault.cohortCommittedRemaining(cohortId2, alice), 200e6);
        assertEq(vault.committedOf(alice), 500e6);

        // Settle cohort 1 only
        ClubVaultV1.SettleEntry[] memory settle1 = new ClubVaultV1.SettleEntry[](1);
        settle1[0] = ClubVaultV1.SettleEntry({member: alice, commitAmount: 300e6, payoutAmount: 400e6});
        vm.prank(safe);
        vault.settleCohort(cohortId1, settle1);

        // Verify cohort 2 unchanged
        assertEq(vault.cohortCommittedRemaining(cohortId1, alice), 0);
        assertEq(vault.cohortCommittedRemaining(cohortId2, alice), 200e6);
        assertEq(vault.committedOf(alice), 200e6);
        assertTrue(vault.cohortFinalized(cohortId1));
        assertFalse(vault.cohortFinalized(cohortId2));
    }

    // =========================================================================
    // Rescue Token Tests
    // =========================================================================

    function test_RescueToken_CannotRescueCollateral() public {
        vm.prank(safe);
        vm.expectRevert(ClubVaultV1.CannotRescueCollateral.selector);
        vault.rescueToken(address(usdc), safe, 100e6);
    }

    function test_RescueToken_CanRescueOtherTokens() public {
        // Send other tokens to vault
        otherToken.mint(address(vault), 1000e18);

        uint256 safeBalBefore = otherToken.balanceOf(safe);

        vm.prank(safe);
        vault.rescueToken(address(otherToken), safe, 500e18);

        assertEq(otherToken.balanceOf(safe), safeBalBefore + 500e18);
        assertEq(otherToken.balanceOf(address(vault)), 500e18);
    }

    function test_RescueToken_EmitsEvent() public {
        otherToken.mint(address(vault), 1000e18);

        vm.expectEmit(true, true, false, true);
        emit ClubVaultV1.TokenRescued(address(otherToken), safe, 500e18);

        vm.prank(safe);
        vault.rescueToken(address(otherToken), safe, 500e18);
    }

    function test_RescueToken_RevertsIfNotSafe() public {
        otherToken.mint(address(vault), 1000e18);

        vm.prank(alice);
        vm.expectRevert(ClubVaultV1.OnlySafe.selector);
        vault.rescueToken(address(otherToken), alice, 500e18);
    }

    function test_RescueToken_RevertsOnZeroToken() public {
        vm.prank(safe);
        vm.expectRevert(ClubVaultV1.ZeroAddress.selector);
        vault.rescueToken(address(0), safe, 100);
    }

    function test_RescueToken_RevertsOnZeroTo() public {
        otherToken.mint(address(vault), 1000e18);

        vm.prank(safe);
        vm.expectRevert(ClubVaultV1.ZeroAddress.selector);
        vault.rescueToken(address(otherToken), address(0), 100);
    }

    function test_RescueToken_RevertsOnZeroAmount() public {
        otherToken.mint(address(vault), 1000e18);

        vm.prank(safe);
        vm.expectRevert(ClubVaultV1.ZeroAmount.selector);
        vault.rescueToken(address(otherToken), safe, 0);
    }

    // =========================================================================
    // Withdraw Address Tests
    // =========================================================================

    function test_SetWithdrawAddress_UpdatesAddress() public {
        address newAddr = address(0xNEW);

        vm.prank(alice);
        vault.setWithdrawAddress(newAddr);

        assertEq(vault.withdrawAddressOf(alice), newAddr);
    }

    function test_SetWithdrawAddress_EmitsMemberRegisteredOnFirstSet() public {
        address newAddr = address(0xNEW);

        vm.expectEmit(true, true, false, false);
        emit ClubVaultV1.MemberRegistered(alice, newAddr);

        vm.prank(alice);
        vault.setWithdrawAddress(newAddr);
    }

    function test_SetWithdrawAddress_EmitsUpdatedOnSubsequentSet() public {
        address addr1 = address(0x1111);
        address addr2 = address(0x2222);

        vm.prank(alice);
        vault.setWithdrawAddress(addr1);

        vm.expectEmit(true, true, true, false);
        emit ClubVaultV1.WithdrawAddressUpdated(alice, addr1, addr2);

        vm.prank(alice);
        vault.setWithdrawAddress(addr2);
    }

    function test_SetWithdrawAddress_RevertsOnZero() public {
        vm.prank(alice);
        vm.expectRevert(ClubVaultV1.ZeroAddress.selector);
        vault.setWithdrawAddress(address(0));
    }

    function test_WithdrawAddressOf_DefaultsToMember() public view {
        assertEq(vault.withdrawAddressOf(alice), alice);
    }

    // =========================================================================
    // Fuzz Tests
    // =========================================================================

    function testFuzz_Deposit_AnyAmount(uint256 amount) public {
        vm.assume(amount > 0 && amount <= INITIAL_BALANCE);

        vm.prank(alice);
        vault.deposit(amount);

        assertEq(vault.availableOf(alice), amount);
    }

    function testFuzz_CommitWithdraw_Consistency(uint256 depositAmt, uint256 commitAmt, uint256 withdrawAmt) public {
        vm.assume(depositAmt > 0 && depositAmt <= INITIAL_BALANCE);
        vm.assume(commitAmt > 0 && commitAmt <= depositAmt);
        vm.assume(withdrawAmt > 0 && withdrawAmt <= depositAmt - commitAmt);

        bytes32 cohortId = keccak256("fuzz-cohort");

        vm.prank(alice);
        vault.deposit(depositAmt);

        ClubVaultV1.CommitEntry[] memory entries = new ClubVaultV1.CommitEntry[](1);
        entries[0] = ClubVaultV1.CommitEntry({member: alice, amount: commitAmt});

        vm.prank(safe);
        vault.commitToCohort(cohortId, entries);

        uint256 availableBefore = vault.availableOf(alice);

        vm.prank(safe);
        vault.withdraw(alice, withdrawAmt);

        assertEq(vault.availableOf(alice), availableBefore - withdrawAmt);
        assertEq(vault.committedOf(alice), commitAmt);
    }
}
