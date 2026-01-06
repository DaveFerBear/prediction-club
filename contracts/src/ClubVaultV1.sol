// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * ClubVaultV1
 *
 * MVP implementation goals:
 * - Hold collateral (USDC / USDC.e) in this contract.
 * - Track per-member balances: available vs committed.
 * - Enforce: withdrawals can only come from available.
 * - Support "cohorts" as an accounting primitive:
 *    - Safe commits funds into a cohort (locks balances).
 *    - Safe settles a cohort (unlocks + credits payouts).
 *
 * Key assumptions (MVP):
 * - Cohort membership and stake sizing are decided off-chain.
 * - The Safe is the only actor allowed to commit/settle/withdraw/rescue.
 * - The platform/indexer uses emitted events + off-chain DB for analytics.
 */
contract ClubVaultV1 {
    // ---------- Types ----------

    struct MemberBalance {
        uint256 available; // withdrawable
        uint256 committed; // locked in open cohorts
    }

    struct CommitEntry {
        address member;
        uint256 amount; // move available -> committed
    }

    struct SettleEntry {
        address member;
        uint256 commitAmount; // move committed -> released
        uint256 payoutAmount; // add to available
    }

    // ---------- Events ----------

    event MemberRegistered(address indexed member, address indexed withdrawAddress);

    event WithdrawAddressUpdated(
        address indexed member,
        address indexed oldWithdrawAddress,
        address indexed newWithdrawAddress
    );

    event Deposited(address indexed member, uint256 amount);

    event CohortCommitted(bytes32 indexed cohortId, address indexed member, uint256 amount);

    event CohortSettled(
        bytes32 indexed cohortId,
        address indexed member,
        uint256 commitAmount,
        uint256 payoutAmount
    );

    event Withdrawn(address indexed member, address indexed to, uint256 amount);

    event TokenRescued(address indexed token, address indexed to, uint256 amount);

    // ---------- Errors ----------

    error OnlySafe();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientAvailable(address member, uint256 have, uint256 need);
    error InsufficientCommitted(address member, uint256 have, uint256 need);
    error InsufficientCohortCommit(bytes32 cohortId, address member, uint256 have, uint256 need);
    error CohortFinalized(bytes32 cohortId);
    error CannotRescueCollateral();

    // ---------- Storage ----------

    IERC20 public immutable collateralToken;
    address public immutable safe;

    mapping(address => MemberBalance) private _balances;

    // Optional: restrict withdrawals to a registered destination.
    mapping(address => address) private _withdrawAddress;

    // Cohort accounting: how much each member still has committed for a cohort.
    mapping(bytes32 => mapping(address => uint256)) private _cohortCommittedRemaining;

    // Total remaining committed for a cohort (helps finalize).
    mapping(bytes32 => uint256) private _cohortTotalRemaining;

    // Once finalized, no further commits.
    mapping(bytes32 => bool) private _cohortFinalized;

    // ---------- Reentrancy Guard ----------

    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "REENTRANCY");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ---------- Modifiers ----------

    modifier onlySafe() {
        if (msg.sender != safe) revert OnlySafe();
        _;
    }

    // ---------- Constructor ----------

    constructor(address safe_, address collateralToken_) {
        if (safe_ == address(0) || collateralToken_ == address(0)) revert ZeroAddress();
        safe = safe_;
        collateralToken = IERC20(collateralToken_);
    }

    // ---------- Views ----------

    function withdrawAddressOf(address member) public view returns (address) {
        address w = _withdrawAddress[member];
        return w == address(0) ? member : w;
    }

    function balanceOf(address member) external view returns (MemberBalance memory) {
        return _balances[member];
    }

    function availableOf(address member) external view returns (uint256) {
        return _balances[member].available;
    }

    function committedOf(address member) external view returns (uint256) {
        return _balances[member].committed;
    }

    function cohortCommittedRemaining(bytes32 cohortId, address member) external view returns (uint256) {
        return _cohortCommittedRemaining[cohortId][member];
    }

    function cohortTotalRemaining(bytes32 cohortId) external view returns (uint256) {
        return _cohortTotalRemaining[cohortId];
    }

    function cohortFinalized(bytes32 cohortId) external view returns (bool) {
        return _cohortFinalized[cohortId];
    }

    // ---------- Member actions ----------

    /**
     * @notice Set or update your withdrawal address.
     * @dev Optional but recommended for safety: prevents manager from redirecting withdrawals.
     */
    function setWithdrawAddress(address withdrawAddress) external {
        if (withdrawAddress == address(0)) revert ZeroAddress();

        address old = withdrawAddressOf(msg.sender);
        _withdrawAddress[msg.sender] = withdrawAddress;

        if (old == msg.sender && old != withdrawAddress) {
            // First time setting away from default: treat as "registered".
            emit MemberRegistered(msg.sender, withdrawAddress);
        } else {
            emit WithdrawAddressUpdated(msg.sender, old, withdrawAddress);
        }
    }

    /**
     * @notice Deposit collateral into the vault; credits msg.sender's available balance.
     * @dev Requires prior ERC20 approval by msg.sender.
     */
    function deposit(uint256 amount) external nonReentrant {
        _depositFor(msg.sender, msg.sender, amount);
    }

    /**
     * @notice Deposit on behalf of another member; credits that member's available balance.
     * @dev Requires prior ERC20 approval by msg.sender.
     */
    function depositFor(address member, uint256 amount) external nonReentrant {
        _depositFor(msg.sender, member, amount);
    }

    function _depositFor(address from, address member, uint256 amount) internal {
        if (member == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        // Pull funds
        bool ok = collateralToken.transferFrom(from, address(this), amount);
        require(ok, "TRANSFER_FROM_FAILED");

        // Credit available
        _balances[member].available += amount;

        emit Deposited(member, amount);
    }

    // ---------- Safe-only actions ----------

    /**
     * @notice Lock funds into a cohort (available -> committed) for each member entry.
     * @dev Safe-only. Emits one event per entry.
     */
    function commitToCohort(bytes32 cohortId, CommitEntry[] calldata entries) external onlySafe {
        if (_cohortFinalized[cohortId]) revert CohortFinalized(cohortId);

        uint256 n = entries.length;
        for (uint256 i = 0; i < n; i++) {
            address m = entries[i].member;
            uint256 amt = entries[i].amount;

            if (m == address(0)) revert ZeroAddress();
            if (amt == 0) revert ZeroAmount();

            MemberBalance storage b = _balances[m];
            if (b.available < amt) revert InsufficientAvailable(m, b.available, amt);

            // Move available -> committed
            b.available -= amt;
            b.committed += amt;

            // Track remaining committed by cohort for later settlement attribution.
            _cohortCommittedRemaining[cohortId][m] += amt;
            _cohortTotalRemaining[cohortId] += amt;

            emit CohortCommitted(cohortId, m, amt);
        }
    }

    /**
     * @notice Settle a cohort by releasing committed capital and crediting payouts.
     * @dev Safe-only. Allows partial settlement across multiple calls.
     *
     * For each entry:
     *  - member must have enough committed overall
     *  - and enough remaining committed for this cohort
     *  - payoutAmount is credited to available
     */
    function settleCohort(bytes32 cohortId, SettleEntry[] calldata entries) external onlySafe {
        uint256 n = entries.length;
        for (uint256 i = 0; i < n; i++) {
            address m = entries[i].member;
            uint256 commitAmt = entries[i].commitAmount;
            uint256 payoutAmt = entries[i].payoutAmount;

            if (m == address(0)) revert ZeroAddress();
            if (commitAmt == 0 && payoutAmt == 0) revert ZeroAmount();

            // Enforce cohort-specific remaining commitment
            uint256 cohortRem = _cohortCommittedRemaining[cohortId][m];
            if (cohortRem < commitAmt) revert InsufficientCohortCommit(cohortId, m, cohortRem, commitAmt);

            MemberBalance storage b = _balances[m];
            if (b.committed < commitAmt) revert InsufficientCommitted(m, b.committed, commitAmt);

            // Release commitment
            if (commitAmt > 0) {
                b.committed -= commitAmt;
                _cohortCommittedRemaining[cohortId][m] = cohortRem - commitAmt;

                uint256 totalRem = _cohortTotalRemaining[cohortId];
                // totalRem should always be >= commitAmt if accounting is consistent
                _cohortTotalRemaining[cohortId] = totalRem - commitAmt;
            }

            // Credit payout to available (principal +/- PnL)
            if (payoutAmt > 0) {
                b.available += payoutAmt;
            }

            emit CohortSettled(cohortId, m, commitAmt, payoutAmt);
        }

        // Auto-finalize when fully settled (prevents future commits under same cohortId).
        if (_cohortTotalRemaining[cohortId] == 0) {
            _cohortFinalized[cohortId] = true;
        }
    }

    /**
     * @notice Withdraw from a member's available balance to their configured withdraw address.
     * @dev Safe-only (Tier 1). Emits Withdrawn.
     */
    function withdraw(address member, uint256 amount) external onlySafe nonReentrant {
        if (member == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        MemberBalance storage b = _balances[member];
        if (b.available < amount) revert InsufficientAvailable(member, b.available, amount);

        b.available -= amount;

        address to = withdrawAddressOf(member);

        bool ok = collateralToken.transfer(to, amount);
        require(ok, "TRANSFER_FAILED");

        emit Withdrawn(member, to, amount);
    }

    /**
     * @notice Rescue non-collateral tokens sent to this contract.
     * @dev Safe-only. Cannot rescue collateralToken.
     */
    function rescueToken(address token, address to, uint256 amount) external onlySafe nonReentrant {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (token == address(collateralToken)) revert CannotRescueCollateral();

        bool ok = IERC20(token).transfer(to, amount);
        require(ok, "RESCUE_TRANSFER_FAILED");

        emit TokenRescued(token, to, amount);
    }
}
