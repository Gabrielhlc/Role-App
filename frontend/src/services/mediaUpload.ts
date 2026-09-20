import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "react-native";
import { api } from "./api";

interface UploadMediaParams {
  roomId: string;
  userId: string;
  uri: string;
  type: "image" | "video";
  mimeType?: string;
}

// Executa o ciclo completo de envio direto ao S3 via streaming nativo:
export async function uploadMediaToRoom({
  roomId,
  userId,
  uri,
  type,
  mimeType = "image/jpeg",
}: UploadMediaParams) {
  let finalUri = uri;
  let finalMimeType = mimeType;
  let extension = mimeType.split("/")[1] || "jpg";

  // Otimização para fotos
  if (type === "image") {
    const { originalWidth } = await new Promise<{ originalWidth: number }>(
      (resolve, reject) => {
        Image.getSize(
          uri,
          (width) => resolve({ originalWidth: width }),
          (error) => reject(error),
        );
      },
    );

    const actions: ImageManipulator.Action[] = [];

    if (originalWidth > 1920) {
      actions.push({ resize: { width: 1920 } });
    }

    const manipulated = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    finalUri = manipulated.uri;
    finalMimeType = "image/jpeg";
    extension = "jpg";
  }

  // Solicita a URL pré-assinada de upload ao backend
  const { data: presignedData } = await api.post(
    `/media/rooms/${roomId}/media/upload-url`,
    {
      mimeType: finalMimeType,
      extension,
      userId,
    },
  );

  const { uploadUrl, s3Key } = presignedData;

  const fileInfo = await FileSystem.getInfoAsync(finalUri);
  const fileSize = fileInfo.exists ? fileInfo.size : undefined;

  // Upload direto nativo para o Amazon S3 via PUT
  const uploadResult = await FileSystem.uploadAsync(uploadUrl, finalUri, {
    httpMethod: "PUT",
    headers: {
      "Content-Type": finalMimeType,
    },
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    console.error("Falha no upload S3:", uploadResult);
    throw new Error(
      `Falha no upload direto para o S3 (Status HTTP ${uploadResult.status}).`,
    );
  }

  // Confirma com o backend para salvar no banco e emitir WebSocket
  const { data: savedMedia } = await api.post(
    `/media/rooms/${roomId}/media/confirm`,
    {
      roomId,
      userId,
      s3Key,
      mimeType: finalMimeType,
      fileSize,
    },
  );

  return savedMedia;
}
