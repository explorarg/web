import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_ENDPOINT = process.env.R2_ENDPOINT;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_ENDPOINT) {
  console.warn('[r2] No se configuró R2_*, no se podrán eliminar archivos');
}

export async function deleteBlobAsset(key: string): Promise<void> {
  if (!R2_ACCESS_KEY_ID) throw new Error('Falta R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) throw new Error('Falta R2_SECRET_ACCESS_KEY');
  if (!R2_BUCKET) throw new Error('Falta R2_BUCKET');
  if (!R2_ENDPOINT) throw new Error('Falta R2_ENDPOINT');

  const client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );
}
