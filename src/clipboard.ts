import { spawnSync } from "node:child_process";
import { platform } from "node:os";

interface ClipboardTool {
  cmd: string;
  args: string[];
}

function hasCommand(cmd: string): boolean {
  const res = spawnSync(process.platform === "win32" ? "where" : "which", [
    cmd,
  ]);
  return res.status === 0;
}

function pickTool(): ClipboardTool {
  const p = platform();
  if (p === "darwin") return { cmd: "pbcopy", args: [] };
  if (p === "win32") return { cmd: "clip", args: [] };
  if (hasCommand("wl-copy")) return { cmd: "wl-copy", args: [] };
  if (hasCommand("xclip")) {
    return { cmd: "xclip", args: ["-selection", "clipboard"] };
  }
  if (hasCommand("xsel")) {
    return { cmd: "xsel", args: ["--clipboard", "--input"] };
  }
  throw new Error(
    "no clipboard tool found. Install xclip, xsel, or wl-copy.",
  );
}

export function copyToClipboard(text: string): void {
  const tool = pickTool();
  const res = spawnSync(tool.cmd, tool.args, { input: text });
  if (res.status !== 0) {
    const stderr = res.stderr?.toString().trim() ?? "";
    throw new Error(
      `clipboard copy via ${tool.cmd} failed${stderr ? `: ${stderr}` : ""}`,
    );
  }
}
