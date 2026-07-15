fs=require("fs");
const c=fs.readFileSync("src/screens/CommunityScreen.tsx","utf8");
fs.writeFileSync("src/screens/CommunityScreen.tsx",c);
console.log("ok");