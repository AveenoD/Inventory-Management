const TOKEN_KEY = "sk_mobile_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    window.dispatchEvent(new Event("storage"));
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
