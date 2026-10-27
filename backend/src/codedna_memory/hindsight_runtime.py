from __future__ import annotations

import os
import threading
from contextlib import contextmanager
from typing import Any, Iterator

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from .hindsight_service import HindsightMemoryService
from .models import MemoryDocument, Repository
from .policy_service import prepare_evolved_demo


def autostart_enabled() -> bool:
    return os.getenv("CODEDNA_HINDSIGHT_AUTOSTART", "1") != "0"


def boot_hindsight_server() -> tuple[Any, Any]:
    if not autostart_enabled():
        raise RuntimeError("hindsight_autostart_disabled")
    from hindsight import HindsightServer
    from hindsight_client import Hindsight

    key = os.getenv("HINDSIGHT_API_LLM_API_KEY")
    if not key:
        raise RuntimeError("hindsight_unconfigured")
    provider = os.getenv("HINDSIGHT_API_LLM_PROVIDER", "gemini")
    model = os.getenv(
        "HINDSIGHT_API_LLM_MODEL",
        os.getenv("CODEDNA_REVIEW_MODEL", "gemini-3.1-flash-lite"),
    )
    server = HindsightServer(
        db_url=os.getenv("HINDSIGHT_API_DATABASE_URL", "pg0"),
        llm_provider=provider,
        llm_api_key=key,
        llm_model=model,
        log_level="warning",
    ).start(timeout=180)
    client = Hindsight(base_url=server.url, timeout=60)
    return server, client


def retain_outstanding_documents(session: Session, client: Any) -> None:
    documents = session.scalars(
        select(MemoryDocument).where(
            MemoryDocument.ingestion_status.in_(("pending", "failed"))
        )
    ).all()
    for document in documents:
        repository = session.get(Repository, document.repository_id)
        if repository is None:
            continue
        try:
            HindsightMemoryService(session, client).retain_decision(
                repository.slug, document.decision_id
            )
        except Exception:
            continue


class SharedHindsightRuntime:
    def __init__(self) -> None:
        self.status = "unavailable"
        self.base_url: str | None = None
        self._client: Any | None = None
        self._server: Any | None = None
        self._thread: threading.Thread | None = None
        self._ready = threading.Event()
        self._state = threading.Lock()
        self._client_use = threading.Lock()

    def begin(self, sessions: sessionmaker[Session]) -> None:
        with self._state:
            if not autostart_enabled():
                if self._client is None:
                    self.status = "unavailable"
                return
            if self.status in {"starting", "ready"}:
                return
            if not os.getenv("HINDSIGHT_API_LLM_API_KEY"):
                self.status = "unavailable"
                return
            self.status = "starting"
            self._ready.clear()
            self._thread = threading.Thread(
                target=self._boot,
                args=(sessions,),
                name="codedna-hindsight",
                daemon=True,
            )
            self._thread.start()

    def _boot(self, sessions: sessionmaker[Session]) -> None:
        server = None
        client = None
        try:
            server, client = boot_hindsight_server()
            self._server = server
            self._client = client
            self.base_url = str(server.url)
            with sessions() as session:
                if os.getenv("CODEDNA_DEMO_SCENE") == "evolved":
                    prepare_evolved_demo(session, memory_client=client)
                retain_outstanding_documents(session, client)
            self.status = "ready"
        except Exception:
            self.status = "unavailable"
            self.base_url = None
            self._client = None
            self._server = None
            if client is not None:
                close = getattr(client, "close", None)
                if callable(close):
                    try:
                        close()
                    except Exception:
                        pass
            if server is not None:
                stop = getattr(server, "stop", None)
                if callable(stop):
                    try:
                        stop(timeout=60)
                    except Exception:
                        pass
        finally:
            self._ready.set()

    def wait_for_client(self, timeout: float = 240) -> Any:
        if not autostart_enabled() and self._client is None:
            raise ValueError("hindsight_unavailable")
        if self.status == "ready" and self._client is not None:
            return self._client
        if self.status == "unavailable":
            raise ValueError("hindsight_unavailable")
        if not self._ready.wait(timeout):
            raise ValueError("hindsight_unavailable")
        if self.status != "ready" or self._client is None:
            raise ValueError("hindsight_unavailable")
        return self._client

    def shutdown(self) -> None:
        with self._state:
            client = self._client
            server = self._server
            self._client = None
            self._server = None
            self.base_url = None
            self.status = "unavailable"
        if client is not None:
            close = getattr(client, "close", None)
            if callable(close):
                try:
                    close()
                except Exception:
                    pass
        if server is not None:
            stop = getattr(server, "stop", None)
            if callable(stop):
                try:
                    stop(timeout=60)
                except Exception:
                    pass


_runtime = SharedHindsightRuntime()


def get_runtime() -> SharedHindsightRuntime:
    return _runtime


@contextmanager
def shared_memory_client() -> Iterator[Any]:
    """Open a caller-thread Hindsight client for the shared server.

    The SDK binds its HTTP session to the thread that first uses a client.
    The boot client stays on the startup thread; request work gets a new one.
    """
    runtime = get_runtime()
    runtime.wait_for_client()
    base_url = runtime.base_url
    if not base_url:
        raise ValueError("hindsight_unavailable")
    from hindsight_client import Hindsight

    client = Hindsight(base_url=base_url, timeout=60)
    try:
        with runtime._client_use:
            yield client
    finally:
        close = getattr(client, "close", None)
        if callable(close):
            try:
                close()
            except Exception:
                pass
