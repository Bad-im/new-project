export type LoginResponse = {
  status: "ok";
  token: string;
  role: "admin";
  username: string;
};

export type LoginErrorResponse = {
  status: "error";
  message: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function loginAdmin(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
  const data = (await response.json()) as LoginResponse | LoginErrorResponse;

  if (!response.ok || data.status === "error") {
    throw new Error(data.status === "error" ? data.message : "Не удалось войти");
  }

  return data;
}
