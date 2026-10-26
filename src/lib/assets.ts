import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { blobToBase64 } from './base64';

const isWeb = Platform.OS === 'web';

async function assetUri(module: number): Promise<string> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  if (!uri) {
    throw new Error('No se pudo acceder al asset empaquetado.');
  }
  return uri;
}

export async function assetToBase64(module: number): Promise<string> {
  const uri = await assetUri(module);

  if (isWeb) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`No se pudo leer el asset (estado ${response.status}).`);
    }
    return blobToBase64(await response.blob());
  }

  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function assetToText(module: number): Promise<string> {
  const uri = await assetUri(module);

  if (isWeb) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`No se pudo leer el asset (estado ${response.status}).`);
    }
    return response.text();
  }

  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function fileUriToBase64(uri: string, file?: File): Promise<string> {
  if (isWeb) {
    if (file) return blobToBase64(file);
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`No se pudo leer el archivo (estado ${response.status}).`);
    }
    return blobToBase64(await response.blob());
  }

  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
