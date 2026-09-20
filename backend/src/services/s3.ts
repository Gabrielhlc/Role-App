import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

// Inicializa o cliente autenticado pelas variáveis de ambiente
export const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;

interface GenerateUploadUrlParams {
  roomId: string;
  userId: string;
  mimeType: string;
  extension: string;
}

/**
 * Gera uma URL assinada para o app fazer o upload direto (PUT) no S3
 * Validade: 10 minutos (600 segundos)
 */
export async function generatePresignedUploadUrl({
  roomId,
  userId,
  mimeType,
  extension,
}: GenerateUploadUrlParams) {
  const mediaId = uuidv4();
  const folder = mimeType.startsWith("video/") ? "videos" : "images";
  const s3Key = `roles/${roomId}/${folder}/${mediaId}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 600,
  });

  return {
    uploadUrl,
    s3Key,
    mediaId,
  };
}

/**
 * Gera uma URL temporária de leitura para download/exibição da mídia
 * Validade: 2 horas (7200 segundos)
 */
export async function generatePresignedViewUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 7200,
  });
}
