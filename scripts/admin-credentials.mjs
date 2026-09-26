import readline from "node:readline";
import { Writable } from "node:stream";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
let muted = false;
const sink = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = readline.createInterface({
  input: process.stdin,
  output: sink,
  terminal: true,
});
rl.question(
  "Admin password (at least 12 characters; input hidden): ",
  async (password) => {
    rl.close();
    process.stdout.write("\n");
    if (password.length < 12 || Buffer.byteLength(password) > 72) {
      process.stderr.write(
        "Use 12 or more characters, at most 72 UTF-8 bytes.\n",
      );
      process.exit(1);
    }
    const digest = await hash(password, 12);
    console.log("ADMIN_PASSWORD_HASH=" + digest);
    console.log(
      "ADMIN_SESSION_SECRET=" + randomBytes(48).toString("base64url"),
    );
  },
);
muted = true;
