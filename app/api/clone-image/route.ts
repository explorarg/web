import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE;

function ensureR2Config() {
  if (!R2_ACCESS_KEY_ID) throw new Error('Falta R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) throw new Error('Falta R2_SECRET_ACCESS_KEY');
  if (!R2_BUCKET) throw new Error('Falta R2_BUCKET');
  if (!R2_ENDPOINT) throw new Error('Falta R2_ENDPOINT');
  if (!R2_PUBLIC_BASE) throw new Error('Falta R2_PUBLIC_BASE');
}

function getR2Client(): S3Client {
  ensureR2Config();
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT as string,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID as string,
      secretAccessKey: R2_SECRET_ACCESS_KEY as string,
    },
    forcePathStyle: true,
  });
}

function buildPublicUrl(key: string): string {
  ensureR2Config();
  const base = new URL((R2_PUBLIC_BASE as string).endsWith('/') ? (R2_PUBLIC_BASE as string) : `${R2_PUBLIC_BASE}/`);
  return new URL(key, base).toString();
}

function getExtensionFromSource(contentType: string | undefined, sourceUrl: string): string {
  const mime = String(contentType || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('avif')) return 'avif';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';

  const match = sourceUrl.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
  return match?.[1]?.toLowerCase() || 'jpg';
}

export async function POST(request: Request) {
  try {
    ensureR2Config();
    const payload = await request.json();
    const { sourceUrl, fileBaseName } = payload;

    if (!sourceUrl) {
      return NextResponse.json(
        { error: 'sourceUrl is required' },
        { status: 400 }
      );
    }

    // Server-side fetch to get the image (no CORS issues!)
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: `No se pudo obtener la imagen desde ${sourceUrl}` },
        { status: 400 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: response.headers.get('content-type') || undefined });
    const extension = getExtensionFromSource(blob.type, sourceUrl);
    const key = `${randomUUID()}-${fileBaseName || 'image'}.${extension}`;

    const client = getR2Client();

    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET as string,
        Key: key,
        Body: Buffer.from(arrayBuffer),
        ContentType: blob.type || 'application/octet-stream',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    return NextResponse.json({ url: buildPublicUrl(key), key });
  } catch (error) {
    console.error('Error cloning image:', error);
    return NextResponse.json(
      { error: 'Clone failed' },
      { status: 500 }
    );
  }
}
