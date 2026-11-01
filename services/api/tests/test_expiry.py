"""Tests for approval request expiry background task."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.models.approval import ApprovalRequest
from deorch_api.models.audit import AuditRecord
from deorch_api.models.device import Device
from deorch_api.models.user import User
from deorch_api.services.expiry import expire_pending_requests


@pytest.mark.asyncio
async def test_expire_pending_requests(
    db: AsyncSession,
    test_user: User,
    test_device: tuple,
) -> None:
    device, _ = test_device

    # Create an expired approval request
    expired_req = ApprovalRequest(
        device_id=device.id,
        request_type="tool_use",
        action_summary="rm -rf /tmp/test",
        details={"tool": "Bash"},
        risk_level="HIGH",
        status="PENDING",
        idempotency_key=f"test-expiry-{datetime.now(UTC).isoformat()}",
        expires_at=datetime.now(UTC) - timedelta(minutes=5),
    )
    db.add(expired_req)

    # Create a still-valid approval request
    valid_req = ApprovalRequest(
        device_id=device.id,
        request_type="tool_use",
        action_summary="git status",
        details={"tool": "Bash"},
        risk_level="LOW",
        status="PENDING",
        idempotency_key=f"test-valid-{datetime.now(UTC).isoformat()}",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
    )
    db.add(valid_req)
    await db.flush()
    await db.commit()

    # Run expiry
    count = await expire_pending_requests()
    assert count >= 1

    # Verify expired request is now EXPIRED
    result = await db.execute(
        select(ApprovalRequest).where(ApprovalRequest.id == expired_req.id)
    )
    req = result.scalar_one()
    assert req.status == "EXPIRED"

    # Verify valid request is still PENDING
    result2 = await db.execute(
        select(ApprovalRequest).where(ApprovalRequest.id == valid_req.id)
    )
    req2 = result2.scalar_one()
    assert req2.status == "PENDING"

    # Verify audit record was created
    result3 = await db.execute(
        select(AuditRecord)
        .where(AuditRecord.event_type == "approval_request.expired")
        .where(AuditRecord.request_id == str(expired_req.id))
    )
    audit = result3.scalar_one_or_none()
    assert audit is not None
