export function isDevTesting(username: string | null | undefined): boolean {
  return (username ?? "").trim().toLowerCase() === "devtesting";
}
