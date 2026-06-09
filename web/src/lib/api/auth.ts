import { request } from "./client";

export type LoginResponse = { accessToken: string };
export type MeResponse = { userId: string; role: string };

export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: (token: string) => request<MeResponse>("/auth/me", {}, token),
};
