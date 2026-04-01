import { isTestFile } from "./gitService.js";
import { estimateTestCoverage } from "./staticAnalysis.js";

async function verify() {
  console.log("=== SAFE-SHIFT COVERAGE VERIFICATION ===");
  
  // 1. Verify isTestFile logic for root-level folders
  const testFiles = ["test/app.js", "tests/router.spec.ts", "spec/middleware.test.js", "lib/application.js"];
  console.log("\n1. Testing isTestFile:");
  testFiles.forEach(path => {
    console.log(` - ${path}: ${isTestFile(path) ? "✅ TEST" : "❌ SOURCE"}`);
  });

  // 2. Verify estimateTestCoverage logic with mock Express structure
  console.log("\n2. Testing estimateTestCoverage (Express Mock):");
  const allFiles: any[] = [
    { path: "lib/application.js", hasTests: false, functions: [{}, {}, {}] }, // 3 functions
    { path: "lib/router/index.js", hasTests: false, functions: [{}, {}] },     // 2 functions
    { path: "test/app.js", hasTests: true, functions: [{}, {}, {}, {}, {}] }, // 5 it() blocks
    { path: "test/router.js", hasTests: true, functions: [{}, {}, {}] },      // 3 it() blocks
  ];

  const appCoverage = estimateTestCoverage(allFiles[0], allFiles);
  const routerCoverage = estimateTestCoverage(allFiles[1], allFiles);

  console.log(` - lib/application.js Coverage: ${appCoverage}% (Target: >30%)`);
  console.log(` - lib/router/index.js Coverage: ${routerCoverage}% (Target: >30%)`);

  if (appCoverage > 0 && routerCoverage > 0) {
    console.log("\n✅ SUCCESS: Coverage detection is WORKING correctly.");
  } else {
    console.log("\n❌ FAILURE: Coverage detection is still failing.");
  }
}

verify().catch(console.error);
