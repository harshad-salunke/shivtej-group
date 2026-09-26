// Supports both standard local development and a supervised preview's Vite-style flags.
import { spawn } from "node:child_process";
const input = process.argv.slice(2);
let port = "3000",
  host = "0.0.0.0";
for (let i = 0; i < input.length; i++) {
  if (input[i] === "--port") port = input[++i];
  else if (input[i] === "--host" || input[i] === "--hostname")
    host = input[++i];
}
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    host,
    "--port",
    port,
  ],
  { stdio: "inherit", env: process.env },
);
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
