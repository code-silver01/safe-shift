import { isTestFile } from "./gitService.js";

const testPaths = [
    "C:\\Users\\safe-shift\\workspace\\uuid\\lib\\router.js",
    "C:\\Users\\safe-shift\\workspace\\uuid\\test\\router.js",
    "C:\\Users\\safe-shift\\workspace\\uuid\\test\\app.router.js",
    "C:\\Users\\safe-shift\\workspace\\uuid\\__tests__\\auth.test.js",
    "C:\\Users\\safe-shift\\workspace\\uuid\\spec\\api_spec.ts",
    "/home/user/workspace/uuid/test/router.js",
    "/home/user/workspace/uuid/lib/router.js"
];

console.log("Testing isTestFile logic:");
testPaths.forEach(p => {
    console.log(`${p} -> isTestFile: ${isTestFile(p)}`);
});
