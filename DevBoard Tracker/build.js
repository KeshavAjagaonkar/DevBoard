import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function copyFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${src} -> ${dest}`);
}

try {
  console.log("Compiling TypeScript...");
  execSync("npx tsc", { stdio: "inherit" });

  console.log("Copying static assets...");
  copyFile("src/manifest.json", "dist/manifest.json");
  copyFile("src/popup/popup.html", "dist/popup/popup.html");
  copyFile("src/popup/popup.css", "dist/popup/popup.css");

  const iconSrcDir = "src/icons";
  const iconDestDir = "dist/icons";
  if (fs.existsSync(iconSrcDir)) {
    if (!fs.existsSync(iconDestDir)) {
      fs.mkdirSync(iconDestDir, { recursive: true });
    }
    fs.readdirSync(iconSrcDir).forEach((file) => {
      copyFile(path.join(iconSrcDir, file), path.join(iconDestDir, file));
    });
  }

  console.log("Build completed successfully!");
} catch (err) {
  console.error("Build failed:", err);
  process.exit(1);
}
