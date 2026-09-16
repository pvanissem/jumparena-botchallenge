import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { botTracePlugin } from "./vite/botTracePlugin";

const botFile = fileURLToPath(new URL("./src/bot/current-bot.js", import.meta.url));

if (!existsSync(botFile)) {
  console.error(
    "\n❌ client/src/bot/current-bot.js fehlt.\n" +
      "   Bitte im Repo-Root einmalig ausführen: npm run reset-bot\n"
  );
  process.exit(1);
}

export default defineConfig({
  plugins: [react(), botTracePlugin()],
  server: {
    host: "127.0.0.1",
    watch: { ignored: ["**/src/bot/runs/**"] },
  },
  build: {
    outDir: "dist",
  },
});
