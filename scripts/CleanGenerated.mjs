import fs from "node:fs";
import path from "node:path";

const RootDir = process.cwd();

const Targets = [
  "node_modules",
  "apps/api/node_modules",
  "apps/api/dist",
  "apps/web/node_modules",
  "apps/web/.next",
];

function RemovePath(RelativePath) {
  const FullPath = path.resolve(RootDir, RelativePath);

  if (!FullPath.startsWith(RootDir)) {
    throw new Error(`Refusing to remove outside root: ${FullPath}`);
  }

  if (fs.existsSync(FullPath)) {
    fs.rmSync(FullPath, { recursive: true, force: true });
    console.log(`Removed ${RelativePath}`);
  }
}

for (const Target of Targets) {
  RemovePath(Target);
}
