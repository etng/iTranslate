import { check } from "@tauri-apps/plugin-updater";
import { confirm, message } from "@tauri-apps/plugin-dialog";
import { APP_BUILD_NUMBER, APP_SEMVER, UPDATE_METADATA_URL } from "../constants/languages";
import type { UpdateMetadata } from "../types";
import { isTauriRuntime } from "../utils/runtime";

function parseVersionParts(version: string): [number, number, number, number] {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 0];
}

function hasNewerBuild(current: string, remote: string): boolean {
  const [cMajor, cMinor, cPatch, cBuild] = parseVersionParts(current);
  const [rMajor, rMinor, rPatch, rBuild] = parseVersionParts(remote);

  if (rMajor !== cMajor) return rMajor > cMajor;
  if (rMinor !== cMinor) return rMinor > cMinor;
  if (rPatch !== cPatch) return rPatch > cPatch;
  return rBuild > cBuild;
}

function getCurrentVersionWithBuild(): string {
  return `${APP_SEMVER}.${APP_BUILD_NUMBER}`;
}

async function fetchLatestMetadata(): Promise<UpdateMetadata> {
  const response = await fetch(UPDATE_METADATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`更新元信息拉取失败：${response.status}`);
  }

  const data = (await response.json()) as {
    version: string;
    notes?: string;
    platforms?: Record<string, { url?: string }>;
    build_number?: number;
    download_url?: string;
  };

  return {
    version: data.version,
    buildNumber: data.build_number ?? parseVersionParts(data.version)[3],
    notes: data.notes,
    downloadUrl: data.download_url,
  };
}

export async function checkForUpdatesByMenu(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const current = getCurrentVersionWithBuild();
  const latest = await fetchLatestMetadata();
  const remoteVersion = latest.buildNumber
    ? `${latest.version}.${latest.buildNumber}`
    : latest.version;

  if (!hasNewerBuild(current, remoteVersion)) {
    await message("当前已经是最新版本", { title: "检查更新", kind: "info" });
    return;
  }

  const shouldUpdate = await confirm(
    `发现新版本 ${remoteVersion}。\n${latest.notes ?? ""}\n是否立即下载并安装？`,
    { title: "检查更新", kind: "info" },
  );

  if (!shouldUpdate) {
    return;
  }

  const update = await check();
  if (!update) {
    await message(
      "检测到新版本信息，但当前平台没有可用安装包，请到 GitHub Release 手动下载。",
      { title: "检查更新", kind: "warning" },
    );
    return;
  }

  await update.downloadAndInstall();
  await message("更新安装完成，请手动重启应用以生效。", { title: "更新完成", kind: "info" });
}
