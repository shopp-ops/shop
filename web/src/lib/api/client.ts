const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export async function request<T>(
  path: string,
  options?: RequestInit,
  token?: string,
): Promise<T> {
  const headers: HeadersInit = {};
  if (options?.body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body?.message ?? "Request failed");
  }

  return body as T;
}
