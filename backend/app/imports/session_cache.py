from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional
from uuid import uuid4

from imports.parser import ParsedSpreadsheet


TTL_SECONDS = 60 * 60


@dataclass
class ImportSession:
    id: str
    user_id: int
    parsed: ParsedSpreadsheet
    created_at: float = field(default_factory=time.time)


class ImportSessionStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: dict[str, ImportSession] = {}

    def _purge_expired(self) -> None:
        now = time.time()
        expired = [
            key
            for key, session in self._sessions.items()
            if now - session.created_at > TTL_SECONDS
        ]
        for key in expired:
            self._sessions.pop(key, None)

    def put(self, user_id: int, parsed: ParsedSpreadsheet) -> ImportSession:
        with self._lock:
            self._purge_expired()
            session = ImportSession(id=str(uuid4()), user_id=user_id, parsed=parsed)
            self._sessions[session.id] = session
            return session

    def get(self, session_id: str, user_id: int) -> Optional[ImportSession]:
        with self._lock:
            self._purge_expired()
            session = self._sessions.get(session_id)
            if not session or session.user_id != user_id:
                return None
            return session

    def pop(self, session_id: str, user_id: int) -> Optional[ImportSession]:
        with self._lock:
            self._purge_expired()
            session = self._sessions.get(session_id)
            if not session or session.user_id != user_id:
                return None
            return self._sessions.pop(session_id, None)


session_store = ImportSessionStore()
