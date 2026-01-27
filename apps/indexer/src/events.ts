import { type Log, decodeEventLog } from 'viem';
import { ClubVaultV1Abi, type ClubVaultV1EventName } from '@prediction-club/chain';
import { prisma, Prisma } from '@prediction-club/db';

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
      payloadJson: payloadJson as Prisma.InputJsonValue,
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
      // Update prediction round status in DB
      await handlePredictionRoundCommitted(clubId, payload);
      break;

    case 'CohortSettled':
      // Update prediction round member payouts
      await handlePredictionRoundSettled(clubId, payload);
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
async function handlePredictionRoundCommitted(
  clubId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const cohortId = payload.cohortId as string;

  // Find the prediction round by on-chain ID
  const predictionRound = await prisma.predictionRound.findFirst({
    where: {
      clubId,
      cohortId,
    },
  });

  if (predictionRound && predictionRound.status === 'PENDING') {
    await prisma.predictionRound.update({
      where: { id: predictionRound.id },
      data: { status: 'COMMITTED' },
    });
    console.log(`Updated prediction round ${predictionRound.id} to COMMITTED`);
  }
}

/**
 * Handle CohortSettled event
 */
async function handlePredictionRoundSettled(
  clubId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const cohortId = payload.cohortId as string;
  const member = payload.member as string;
  const commitAmount = payload.commitAmount as string;
  const payoutAmount = payload.payoutAmount as string;

  // Find the prediction round
  const predictionRound = await prisma.predictionRound.findFirst({
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

  if (!predictionRound) {
    console.log(`Prediction round not found for settlement: ${cohortId}`);
    return;
  }

  // Find the member by wallet address
  const predictionRoundMember = predictionRound.members.find(
    (m) => m.user.walletAddress.toLowerCase() === member.toLowerCase()
  );

  if (predictionRoundMember) {
    const pnl = BigInt(payoutAmount) - BigInt(commitAmount);
    await prisma.predictionRoundMember.update({
      where: { id: predictionRoundMember.id },
      data: {
        payoutAmount,
        pnlAmount: pnl.toString(),
      },
    });
    console.log(`Updated prediction round member ${predictionRoundMember.id} payout`);
  }

  // Check if all members are settled
  // This is a simplified check - in production, query the chain for cohortTotalRemaining
  const unsettledMembers = await prisma.predictionRoundMember.count({
    where: {
      predictionRoundId: predictionRound.id,
      payoutAmount: '0',
      commitAmount: { not: '0' },
    },
  });

  if (unsettledMembers === 0) {
    await prisma.predictionRound.update({
      where: { id: predictionRound.id },
      data: { status: 'SETTLED' },
    });
    console.log(`Prediction round ${predictionRound.id} fully settled`);
  }
}
