/**
 * ship.mjs — deploy to Vercel production and pin the alias
 * Run: npm run ship
 */
import { execSync } from "child_process";

const ALIAS = "rmmedia-studio.vercel.app";

console.log("🚀 Deploying to Vercel production…\n");

let deploymentUrl;
try {
  const out = execSync("npx vercel --prod 2>&1", {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });

  // Extract the deployment URL from the output (looks like studio-xxxx.vercel.app)
  const match = out.match(/https:\/\/(studio-[a-z0-9]+-[a-z0-9-]+\.vercel\.app)/);
  if (!match) throw new Error("Could not find deployment URL in output:\n" + out);
  deploymentUrl = match[1];
  console.log(`✓ Deployed: https://${deploymentUrl}`);
} catch (e) {
  console.error("❌ Vercel deployment failed:", e.message);
  process.exit(1);
}

console.log(`\n📌 Pinning ${ALIAS} → new deployment…`);
try {
  execSync(`npx vercel alias set ${deploymentUrl} ${ALIAS} 2>&1`, {
    stdio: "inherit",
  });
  console.log(`\n✅ Live at https://${ALIAS}`);
} catch (e) {
  console.error("❌ Alias update failed — run manually:");
  console.error(`   npx vercel alias set ${deploymentUrl} ${ALIAS}`);
  process.exit(1);
}
