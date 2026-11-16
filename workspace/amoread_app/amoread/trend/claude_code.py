"""Claude via the locally installed Claude Code CLI, using the PC's logged-in Claude subscription.

Pattern:
  claude -p --output-format json  (prompt on stdin)
Safety choices:
  - --tools ""                 : no file, shell or web tools; the CLI is a text generator here
  - --strict-mcp-config        : no MCP servers
  - --setting-sources ""       : ignore user/project settings and hooks
  - --no-session-persistence   : do not store a session
  - empty working directory    : no CLAUDE.md or project files are read
  - ANTHROPIC_API_KEY removed  : keep using the subscription login, never a stray API key
  - --effort low               : default effort spent 150 s+ thinking before any output on promotion_plan
Data still leaves the PC (to Anthropic), so the caller must require external-transfer consent.
"""
import asyncio
import json
import os
import shutil
import subprocess
import time
from pathlib import Path

SYSTEM = ("You are a JSON generator for a Korean marketing exploration tool. "
          "Return exactly one JSON object and nothing else. Never use tools.")
_STATUS_CACHE = {"at": 0.0, "value": None}


class ClaudeCodeError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


def executable():
    path = os.getenv("CLAUDE_CODE_PATH") or shutil.which("claude")
    if not path:
        local = Path.home() / ".local" / "bin" / ("claude.exe" if os.name == "nt" else "claude")
        path = str(local) if local.exists() else None
    return path


def _command(path):
    # npm installs on Windows are .cmd shims that cannot be executed directly (EINVAL).
    if os.name == "nt" and path.lower().endswith((".cmd", ".bat")):
        return ["cmd.exe", "/d", "/c", path]
    return [path]


def _env():
    env = dict(os.environ)
    for key in ("ANTHROPIC_API_KEY", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
        env.pop(key, None)
    return env


def _workdir():
    folder = Path(__file__).resolve().parents[2] / "planner" / "data" / "trend" / "claude_code_cwd"   # 빈 폴더: 프로젝트 파일을 읽지 않게
    folder.mkdir(parents=True, exist_ok=True)
    return str(folder)


def status():
    """Login state from `claude auth status`. It only proves stored credentials, not a working token."""
    now = time.monotonic()
    if _STATUS_CACHE["value"] and now - _STATUS_CACHE["at"] < 60:
        return _STATUS_CACHE["value"]
    path = executable()
    value = {"installed": bool(path), "logged_in": False, "subscription": None,
             "note": "로그인 정보만 확인. 토큰 만료는 실제 호출에서만 드러남"}
    if path:
        try:
            out = subprocess.run(_command(path) + ["auth", "status"], capture_output=True, text=True,
                                 encoding="utf-8", timeout=20, env=_env(), cwd=_workdir())
            data = json.loads(out.stdout or "{}")
            value.update(logged_in=bool(data.get("loggedIn")), subscription=data.get("subscriptionType"),
                         auth_method=data.get("authMethod"))
        except (OSError, subprocess.SubprocessError, ValueError):
            value["note"] = "claude auth status 실행 실패"
    _STATUS_CACHE.update(at=now, value=value)
    return value


def _run(prompt, model, timeout):
    path = executable()
    if not path:
        raise ClaudeCodeError("Claude Code CLI를 찾지 못했습니다. 설치 후 `claude` 로그인 또는 CLAUDE_CODE_PATH 설정", 503)
    args = _command(path) + ["-p", "--output-format", "json", "--tools", "", "--no-session-persistence",
                             "--strict-mcp-config", "--setting-sources", "", "--system-prompt", SYSTEM]
    if model:
        args += ["--model", model]
    # Default effort makes the model think for minutes before answering this structured task; low is enough.
    effort = os.getenv("CLAUDE_CODE_EFFORT", "low").strip()
    if effort:
        args += ["--effort", effort]
    try:
        out = subprocess.run(args, input=prompt, capture_output=True, text=True, encoding="utf-8",
                             timeout=timeout, env=_env(), cwd=_workdir())
    except subprocess.TimeoutExpired as exc:
        raise ClaudeCodeError("Claude Code 응답 시간이 초과됐습니다", 504) from exc
    except OSError as exc:
        raise ClaudeCodeError(f"Claude Code 실행 실패({type(exc).__name__})", 503) from exc
    try:
        data = json.loads(out.stdout.strip().splitlines()[-1] if out.stdout.strip() else "{}")
    except ValueError as exc:
        raise ClaudeCodeError("Claude Code 출력을 읽지 못했습니다") from exc
    if not data or data.get("is_error") or data.get("subtype") != "success":
        code = data.get("api_error_status")
        text = str(data.get("result") or out.stderr or "")[:200]
        if code in (401, 403) or "login" in text.lower() or "auth" in text.lower():
            raise ClaudeCodeError("Claude Code 로그인 만료 또는 권한 없음 · 터미널에서 `claude` 로그인을 다시 하세요", 401)
        if code == 429 or "limit" in text.lower():
            raise ClaudeCodeError("Claude 구독 사용 한도에 도달했습니다 · 잠시 후 다시 시도하세요", 429)
        raise ClaudeCodeError("Claude Code 호출 실패" + (f" (HTTP {code})" if code else ""))
    usage = data.get("modelUsage") or {}
    return data.get("result", ""), {
        "model": next(iter(usage), model or "default"),
        "duration_ms": data.get("duration_ms"),
        "cost_usd_equivalent": data.get("total_cost_usd"),
    }


async def generate(prompt, model=None, timeout=300):
    """Returns (raw_text, meta). Runs the CLI in a worker thread (works with any asyncio loop on Windows)."""
    return await asyncio.to_thread(_run, prompt, model, timeout)
