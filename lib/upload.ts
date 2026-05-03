import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PickedImage = {
  uri: string;
  mimeType: string;
  fileName?: string;
};

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
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    fileName: asset.fileName ?? undefined,
  };
}

export async function uploadImage(
  uploadUrl: string,
  image: PickedImage
): Promise<string> {
  // Convex returns { storageId } from a successful POST to a generated URL.
  let body: Blob | Uint8Array;
  if (Platform.OS === 'web') {
    const res = await fetch(image.uri);
    body = await res.blob();
  } else {
    const res = await fetch(image.uri);
    body = await res.blob();
  }
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': image.mimeType },
    body: body as any,
  });
  if (!response.ok) {
    throw new Error('Falhou o upload da imagem.');
  }
  const { storageId } = await response.json();
  return storageId as string;
}
