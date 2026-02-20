type Role = "trainer" | "user";

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
};