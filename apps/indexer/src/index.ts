import 'dotenv/config';

/**
 * Indexer is disabled during the Polymarket migration.
 *
 * The previous on-chain vault event pipeline is no longer used, so the
 * indexer exits immediately to avoid confusing logs and schema errors.
 */
function main() {
  console.log('Indexer disabled: on-chain vault events are deprecated.');
}

main();
