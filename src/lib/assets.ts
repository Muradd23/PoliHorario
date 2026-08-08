import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

export async function assetToBase64(module: number): Promise<string> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('No se pudo acceder al asset empaquetado.');
  }
  return FileSystem.readAsStringAsync(asset.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function assetToText(module: number): Promise<string> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('No se pudo acceder al asset empaquetado.');
  }
  return FileSystem.readAsStringAsync(asset.localUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function fileUriToBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
