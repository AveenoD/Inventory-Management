import * as SecureStore from "expo-secure-store";

export async function getPref(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setPref(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}
