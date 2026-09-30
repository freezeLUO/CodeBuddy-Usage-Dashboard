"""枚举会话目录并做增量指纹判定。

只按两级 glob 定位 `history/<workspaceHash>/<conversationId>/index.json`，
绝不递归 walk（同级 file-tree/ 有超长路径，会触发 Windows MAX_PATH 错误）。
"""
import re
from dataclasses import dataclass
from pathlib import Path

from ..config import DATA_ROOT

HEX_ID_RE = re.compile(r"^[0-9a-f]{32}$")


@dataclass(frozen=True)
class ConvRef:
    conversation_id: str
    workspace_hash: str
    index_path: Path
    mtime_ns: int
    size: int

    @property
    def key(self) -> str:
        return str(self.index_path)


def fingerprint(path: Path) -> tuple[int, int] | None:
    try:
        st = path.stat()
    except OSError:
        return None
    return (st.st_mtime_ns, st.st_size)


def discover() -> dict[str, ConvRef]:
    """返回 {conversation_id: ConvRef}。仅包含文件名合法的会话目录。"""
    found: dict[str, ConvRef] = {}
    if not DATA_ROOT.is_dir():
        return found
    for index_path in DATA_ROOT.glob("*/VSCode/*/history/*/*/index.json"):
        conv_id = index_path.parent.name
        ws_hash = index_path.parent.parent.name
        if not HEX_ID_RE.match(conv_id) or not HEX_ID_RE.match(ws_hash):
            continue
        fp = fingerprint(index_path)
        if fp is None:
            continue
        found[conv_id] = ConvRef(conv_id, ws_hash, index_path, fp[0], fp[1])
    return found


def messages_dir(conv: ConvRef) -> Path:
    return conv.index_path.parent / "messages"


def message_path(conv: ConvRef, message_id: str) -> Path:
    return messages_dir(conv) / f"{message_id}.json"
