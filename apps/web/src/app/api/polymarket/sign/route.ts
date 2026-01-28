import { NextRequest, NextResponse } from 'next/server';
import { buildHmacSignature, type BuilderApiKeyCreds } from '@polymarket/builder-signing-sdk';

const BUILDER_CREDENTIALS: BuilderApiKeyCreds = {
  key: process.env.POLY_BUILDER_API_KEY || '',
  secret: process.env.POLY_BUILDER_SECRET || '',
  passphrase: process.env.POLY_BUILDER_PASSPHRASE || '',
};

export async function POST(request: NextRequest) {
  if (!BUILDER_CREDENTIALS.key || !BUILDER_CREDENTIALS.secret || !BUILDER_CREDENTIALS.passphrase) {
    return NextResponse.json(
      { error: { code: 'MISSING_BUILDER_CREDS', message: 'Builder credentials not configured' } },
      { status: 500 }
    );
  }

  const { method, path, body } = await request.json();
  const timestamp = Date.now().toString();

  const signature = buildHmacSignature(
    BUILDER_CREDENTIALS.secret,
    Number(timestamp),
    method,
    path,
    body
  );

  return NextResponse.json({
    POLY_BUILDER_SIGNATURE: signature,
    POLY_BUILDER_TIMESTAMP: timestamp,
    POLY_BUILDER_API_KEY: BUILDER_CREDENTIALS.key,
    POLY_BUILDER_PASSPHRASE: BUILDER_CREDENTIALS.passphrase,
  });
}
