import { headers } from "next/headers";
import { isPasswordAuthenticated } from "./password-auth";
import { PasswordGate } from "./password-gate";
import { TodoApp } from "./todo-app";

export default async function Home() {
  const requestHeaders = await headers();
  const isAuthenticated = await isPasswordAuthenticated(
    requestHeaders.get("cookie")
  );

  return isAuthenticated ? <TodoApp /> : <PasswordGate />;
}
