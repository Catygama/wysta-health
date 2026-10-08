import { Share } from 'react-native';

// Native: hand the JSON to the share sheet (save to Files, send by email…).
export async function saveJson(fileName: string, data: unknown): Promise<void> {
  await Share.share({ title: fileName, message: JSON.stringify(data, null, 2) });
}
