from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath

from unidiff import PatchSet, UnidiffParseError


MAX_DIFF_BYTES = 100_000
MAX_FILES = 30


class DiffValidationError(ValueError):
    pass


@dataclass(frozen=True)
class ChangedLine:
    file_path: str
    new_line: int
    value: str


@dataclass(frozen=True)
class ParsedDiff:
    files: tuple[str, ...]
    added_lines: tuple[ChangedLine, ...]
    raw: str

    def allows(self, file_path: str, new_line: int | None) -> bool:
        if file_path not in self.files:
            return False
        if new_line is None:
            return True
        return any(
            line.file_path == file_path and line.new_line == new_line
            for line in self.added_lines
        )


def _safe_path(path: str) -> str:
    normalized = path.replace("\\", "/")
    pure = PurePosixPath(normalized)
    if pure.is_absolute() or ".." in pure.parts or normalized.startswith(("/", "~")):
        raise DiffValidationError("unsafe_diff_path")
    return normalized


def parse_unified_diff(diff_text: str) -> ParsedDiff:
    if not diff_text.strip():
        raise DiffValidationError("empty_diff")
    if len(diff_text.encode("utf-8")) > MAX_DIFF_BYTES:
        raise DiffValidationError("diff_too_large")
    if "GIT binary patch" in diff_text or "Binary files " in diff_text:
        raise DiffValidationError("binary_diff_not_supported")
    try:
        patch = PatchSet(diff_text)
    except (UnidiffParseError, ValueError) as exc:
        raise DiffValidationError("malformed_diff") from exc
    if not patch or len(patch) > MAX_FILES:
        raise DiffValidationError("invalid_file_count")

    files: list[str] = []
    added: list[ChangedLine] = []
    for changed_file in patch:
        path = _safe_path(changed_file.path)
        files.append(path)
        for hunk in changed_file:
            for line in hunk:
                if line.is_added and line.target_line_no is not None:
                    added.append(ChangedLine(path, line.target_line_no, line.value.rstrip("\n")))
    if not added:
        raise DiffValidationError("no_added_lines")
    return ParsedDiff(tuple(files), tuple(added), diff_text)


def build_memory_query(parsed: ParsedDiff) -> str:
    snippets = " ".join(line.value.strip() for line in parsed.added_lines)
    tokens: list[str] = []
    if "prisma" in snippets.lower():
        tokens.append("direct ORM write")
    if "status" in snippets.lower():
        tokens.append("state transition")
    concepts = ", ".join(tokens) if tokens else "changed behavior"
    return f"Review historical guidance relevant to {concepts} in {', '.join(parsed.files)}."
