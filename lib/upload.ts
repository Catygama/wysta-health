import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  ATTACHMENT_SIZE_ERROR,
  ATTACHMENT_TYPE_ERROR,
  DOCUMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  isAllowedDocument,
  isAllowedImage,
} from '@/convex/lib/attachments';

export type PickedFile = {
  uri: string;
  mimeType: string;
  fileName?: string;
  size?: number;
};

export type PickedImage = PickedFile;

export async function pickImage(): Promise<PickedImage | null> {
  // Web does not require permission (browser handles it). Native must request.
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      throw new Error('Permissão de galeria recusada.');
    }
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.8,
    exif: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return checkAttachment(
    {
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileName: asset.fileName ?? undefined,
      size: asset.fileSize ?? undefined,
    },
    isAllowedImage,
  );
}

export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // PDF or an image (e.g. a photo of a test result). The server checks again.
    type: [...DOCUMENT_MIME_TYPES],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return checkAttachment(
    {
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      fileName: asset.name,
      size: asset.size ?? undefined,
    },
    isAllowedDocument,
  );
}

// Early, friendly check before uploading; the server is the authority.
function checkAttachment(file: PickedFile, isAllowed: (mime: string) => boolean): PickedFile {
  if (!isAllowed(file.mimeType)) throw new Error(ATTACHMENT_TYPE_ERROR);
  if (file.size !== undefined && file.size > MAX_ATTACHMENT_BYTES) throw new Error(ATTACHMENT_SIZE_ERROR);
  return file;
}

export async function uploadFile(
  uploadUrl: string,
  file: PickedFile
): Promise<string> {
  // Convex returns { storageId } from a successful POST to a generated URL.
  const fetched = await fetch(file.uri);
  const body = await fetched.blob();
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': file.mimeType },
    body: body as any,
  });
  if (!response.ok) {
    throw new Error('Falhou o upload do ficheiro.');
  }
  const { storageId } = await response.json();
  return storageId as string;
}

export const uploadImage = uploadFile;
