import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(__dirname, "../../data");

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadData() {
  ensureDataDir();
  console.log(`📁 Data directory ready at ${DATA_DIR}`);
}

export function readJSON<T>(filename: string, defaultValue: T): T {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    writeJSON(filename, defaultValue);
    return defaultValue;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return defaultValue;
  }
}

export function writeJSON<T>(filename: string, data: T): void {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
