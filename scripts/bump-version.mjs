import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const part = process.argv[2];
const valid = new Set(["major", "minor", "patch"]);
if (!valid.has(part)) {
  console.error("用法: node scripts/bump-version.mjs <major|minor|patch>");
  process.exit(1);
}

function parseSemver(text, source) {
  const m = text.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    throw new Error(`${source} 不是三段 semver: ${text}`);
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function bump([major, minor, patch]) {
  if (part === "major") return [major + 1, 0, 0];
  if (part === "minor") return [major, minor + 1, 0];
  return [major, minor, patch + 1];
}

function replaceTomlVersion(content, version) {
  const replaced = content.replace(/^version\s*=\s*"\d+\.\d+\.\d+"/m, `version = "${version}"`);
  if (replaced === content) {
    throw new Error("Cargo.toml 未找到可替换的 version 字段");
  }
  return replaced;
}

function replaceTsConst(content, key, version) {
  const regex = new RegExp(`export const ${key} = "\\d+\\.\\d+\\.\\d+";`);
  const replaced = content.replace(regex, `export const ${key} = "${version}";`);
  if (replaced === content) {
    throw new Error(`未找到 ${key} 常量`);
  }
  return replaced;
}

const packagePath = "package.json";
const tauriConfigPath = "src-tauri/tauri.conf.json";
const cargoPath = "src-tauri/Cargo.toml";
const constantsPath = "src/constants/languages.ts";

const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
const tauriConf = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
const cargo = readFileSync(cargoPath, "utf8");
const constants = readFileSync(constantsPath, "utf8");
const constantMatch = constants.match(/export const APP_SEMVER = "(\d+\.\d+\.\d+)";/);
if (!constantMatch) {
  throw new Error("src/constants/languages.ts 缺少 APP_SEMVER");
}

const candidates = [pkg.version, tauriConf.version, constantMatch[1]]
  .filter(Boolean)
  .map((v) => ({ raw: v, parsed: parseSemver(v, "json version") }));

if (candidates.length === 0) {
  throw new Error("未找到基础版本号");
}

function compare(a, b) {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

const base = candidates
  .map((entry) => entry.parsed)
  .sort(compare)
  .at(-1);

if (!base) {
  throw new Error("无法确定基线版本");
}

const [baseMajor, baseMinor, basePatch] = base;
const next = bump([baseMajor, baseMinor, basePatch]);
const nextVersion = `${next[0]}.${next[1]}.${next[2]}`;
const tag = `v${nextVersion}`;

pkg.version = nextVersion;
tauriConf.version = nextVersion;

const nextCargo = replaceTomlVersion(cargo, nextVersion);
const nextConstants = replaceTsConst(constants, "APP_SEMVER", nextVersion);

writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
writeFileSync(tauriConfigPath, `${JSON.stringify(tauriConf, null, 2)}\n`, "utf8");
writeFileSync(cargoPath, nextCargo, "utf8");
writeFileSync(constantsPath, nextConstants, "utf8");
execSync("cargo generate-lockfile --manifest-path src-tauri/Cargo.toml", { stdio: "inherit" });

const releaseFiles = [
  packagePath,
  tauriConfigPath,
  cargoPath,
  "src-tauri/Cargo.lock",
  constantsPath,
];
execSync(`git add ${releaseFiles.join(" ")}`, { stdio: "inherit" });
execSync(`git commit -m "chore(release): 🔧 bump version to ${nextVersion}"`, { stdio: "inherit" });

const existingTags = execSync("git tag --list", { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
if (existingTags.includes(tag)) {
  throw new Error(`tag 已存在: ${tag}`);
}

execSync(`git tag ${tag}`, { stdio: "inherit" });

console.log(`版本已更新为 ${nextVersion}`);
console.log(`已创建 tag: ${tag}`);
