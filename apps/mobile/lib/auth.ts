import * as SecureStore from "expo-secure-store";

export const TOKEN_KEY = "sk_mobile_token";

let tokenCache: string | null = null;
let loaded = false;

export function getToken(): string | null {
  return tokenCache;
}

export function isTokenLoaded(): boolean {
  return loaded;
}

export async function loadToken(): Promise<string | null> {
  try {
    tokenCache = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    tokenCache = null;
  }
  loaded = true;
  return tokenCache;
}

export async function setToken(token: string): Promise<void> {
  tokenCache = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  tokenCache = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
