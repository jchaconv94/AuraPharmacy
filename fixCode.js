const fs = require("fs");
const path = "./components/SheetSearchModule.tsx";
let code = fs.readFileSync(path, "utf-8");

code = code.replace(/\.filter\(u => u\.url !== "SUPABASE_NATIVE" && !u\.url\.startsWith\("SUPABASE_VIRTUAL_"\)\)/g, "");
code = code.replace(/ && u\.url !== "SUPABASE_NATIVE" && !u\.url\.startsWith\("SUPABASE_VIRTUAL_"\)/g, "");

fs.writeFileSync(path, code);
