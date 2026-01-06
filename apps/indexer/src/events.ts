import { type Log, decodeEventLog } from 'viem';
import { ClubVaultV1Abi, type ClubVaultV1EventName } from '@prediction-club/chain';
import { prisma } from '@prediction-club/db';

/**
 * Parse and store a vault event
 */
export async function processVaultEvent(
  clubId: string,
  log: Log,
  blockTime: Date
): Promise<void> {
  const txHash = log.transactionHash!;
  const logIndex = log.logIndex!;

  // Check if event already processed (idempotency)
  const existing = await prisma.vaultEvent.findUnique({
    where: {
      txHash_logIndex: {
        txHash,
        logIndex,
      },
    },
  });

  if (existing) {
    console.log(`Event already processed: ${txHash}:${logIndex}`);
    return;
  }

  // Decode the event
  let decoded: { eventName: string; args: Record<string, unknown> };
  try {
    decoded = decodeEventLog({
      abi: ClubVaultV1Abi,
      data: log.data,
      topics: log.topics,
    }) as { eventName: string; args: Record<string, unknown> };
  } catch (error) {
    console.error(`Failed to decode event ${txHash}:${logIndex}:`, error);
    return;
  }

  const eventName = decoded.eventName as ClubVaultV1EventName;

  // Convert BigInt values to strings for JSON storage
  const payloadJson = Object.fromEntries(
    Object.entries(decoded.args).map(([key, value]) => [
      key,
      typeof value === 'bigint' ? value.toString() : value,
    ])
  );

  // Store the event
  await prisma.vaultEvent.create({
    data: {
      clubId,
      txHash,
      logIndex,
      eventName,
      payloadJson,
      blockNumber: BigInt(log.blockNumber!),
      blockTime,
    },
  });

  console.log(`Stored event: ${eventName} at ${txHash}:${logIndex}`);

  // Handle specific event types
  await handleEventSideEffects(clubId, eventName, payloadJson);
}

/**
 * Handle side effects for specific event types
 */
async function handleEventSideEffects(
  clubId: string,
  eventName: ClubVaultV1EventName,
  payload: Record<string, unknown>
): Promise<void> {
  switch (eventName) {
    case 'Deposited':
      // Could update cached balances, send notifications, etc.
      console.log(`Deposit: ${payload.member} deposited ${payload.amount}`);
      break;

    case 'CohortCommitted':
      // Update cohort status in DB
      await handleCohortCommitted(clubId, payload);
      break;

    case 'CohortSettled':
      // Update cohort member payouts
      await handleCohortSettled(clubId, payload);
      break;

    case 'Withdrawn':
      console.log(`Withdrawal: ${payload.member} withdrew ${payload.amount} to ${payload.to}`);
      break;

    default:
      // Other events don't need special handling
      break;
  }
}

/**
 * Handle CohortCommitted event
 */
async function handleCohortCommitted(
  clubId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const cohortId = payload.cohortId as string;

  // Find the cohort by on-chain ID
  const cohort = await prisma.cohort.findFirst({
    where: {
      clubId,
      cohortId,
    },
  });

  if (cohort && cohort.status === 'PENDING') {
    await prisma.cohort.update({
      where: { id: cohort.id },
      data: { status: 'COMMITTED' },
    });
    console.log(`Updated cohort ${cohort.id} to COMMITTED`);
  }
}

/**
 * Handle CohortSettled event
 */
async function handleCohortSettled(
  clubId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const cohortId = payload.cohortId as string;
  const member = payload.member as string;
  const commitAmount = payload.commitAmount as string;
  const payoutAmount = payload.payoutAmount as string;

  // Find the cohort
  const cohort = await prisma.cohort.findFirst({
    where: {
      clubId,
      cohortId,
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!cohort) {
    console.log(`Cohort not found for settlement: ${cohortId}`);
    return;
  }

  // Find the member by wallet address
  const cohortMember = cohort.members.find(
    (m) => m.user.walletAddress.toLowerCase() === member.toLowerCase()
  );

  if (cohortMember) {
    const pnl = BigInt(payoutAmount) - BigInt(commitAmount);
    await prisma.cohortMember.update({
      where: { id: cohortMember.id },
      data: {
        payoutAmount,
        pnlAmount: pnl.toString(),
      },
    });
    console.log(`Updated cohort member ${cohortMember.id} payout`);
  }

  // Check if all members are settled
  // This is a simplified check - in production, query the chain for cohortTotalRemaining
  const unsettledMembers = await prisma.cohortMember.count({
    where: {
      cohortId: cohort.id,
      payoutAmount: '0',
      commitAmount: { not: '0' },
    },
  });

  if (unsettledMembers === 0) {
    await prisma.cohort.update({
      where: { id: cohort.id },
      data: { status: 'SETTLED' },
    });
    console.log(`Cohort ${cohort.id} fully settled`);
  }
}
