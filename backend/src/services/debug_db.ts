import { getSession, connectNeo4j } from "../config/neo4j.js";
import "dotenv/config";

async function checkDb() {
  await connectNeo4j();
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (f:File) 
      WHERE f.hasTests = true
      RETURN f.path, f.hasTests
      LIMIT 10
    `);
    console.log("Files with hasTests=true:");
    result.records.forEach(r => {
      console.log(` - ${r.get("f.path")}`);
    });
    
    const countResult = await session.run(`
      MATCH (f:File) 
      RETURN count(f) as total, sum(case when f.hasTests then 1 else 0 end) as withTests
    `);
    const total = countResult.records[0].get("total").toNumber();
    const withTests = countResult.records[0].get("withTests").toNumber();
    console.log(`\nTotal Files: ${total}`);
    console.log(`Files with Tests: ${withTests}`);
    
    if (withTests === 0) {
      console.log("\nWARNING: No files have hasTests=true in the database!");
    } else {
      console.log("\nSUCCESS: Database contains test files.");
    }
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await session.close();
    process.exit(0);
  }
}

checkDb();
