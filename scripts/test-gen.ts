// scripts/test-gen.ts
// Quick CLI test for the generator. Usage:
//   npx tsx scripts/test-gen.ts
// Requires ANTHROPIC_API_KEY in env (or .env.local).

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { generateSegment } from "../src/lib/generator";

async function main() {
  const format = (process.argv[2] as "news") ?? "news";

  console.log(`Generating PRGE ${format} segment...\n`);

  const result = await generateSegment({
    format,
    inWorldTime: "19:02",
    hosts: ["quinn", "caroline", "holden", "tim"],
    durationSec: 240,
    notes:
      "Sign-on / opening news. Quinn opens the broadcast. Set the tone of the night. Caroline first weather, Holden pre-Purge sports.",
  });

  console.log(result.body);
  console.log("\n--- usage ---");
  console.log(`input:           ${result.usage.input_tokens}`);
  console.log(`output:          ${result.usage.output_tokens}`);
  if (result.usage.cache_creation_input_tokens) {
    console.log(`cache created:   ${result.usage.cache_creation_input_tokens}`);
  }
  if (result.usage.cache_read_input_tokens) {
    console.log(`cache read:      ${result.usage.cache_read_input_tokens}`);
  }
  console.log(`model:           ${result.modelId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
