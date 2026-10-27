from fastapi import status
from fastapi.testclient import TestClient

from tests.test_rotas import _setup_user_and_workspace


def test_manual_shift_creation_and_recalculation(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "editor_mgr@example.com", "EditorMgr")

    # 1. Create staff member
    staff_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Jane", "last_name": "Doe", "category": "full_time"},
        headers=headers,
    )
    assert staff_resp.status_code == status.HTTP_201_CREATED
    staff_id = staff_resp.json()["id"]

    # 2. Create rota
    rota_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Manual Edit Rota",
            "start_date": "2026-11-02",
            "end_date": "2026-11-08",
        },
        headers=headers,
    )
    assert rota_resp.status_code == status.HTTP_201_CREATED
    rota_id = rota_resp.json()["id"]

    # 3. Create a manual shift (09:00 - 17:00, 8h gross -> 45m break -> 7.25h net paid)
    shift_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts",
        json={
            "staff_id": staff_id,
            "date": "2026-11-02",
            "start_time": "09:00",
            "end_time": "17:00",
            "notes": "Opening shift",
        },
        headers=headers,
    )
    assert shift_resp.status_code == status.HTTP_201_CREATED
    data = shift_resp.json()
    assert data["shift"]["start_time"] == "09:00"
    assert data["shift"]["end_time"] == "17:00"
    assert data["shift"]["unpaid_break_minutes"] == 45
    assert data["shift"]["paid_hours"] == 7.25
    assert data["rota"]["total_shifts"] == 1
    assert data["rota"]["total_paid_hours"] == 7.25


def test_manual_shift_editing_and_moving(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "editor_move@example.com", "MoveMgr")

    staff_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Tom", "last_name": "Hardy", "category": "full_time"},
        headers=headers,
    )
    staff_id = staff_resp.json()["id"]

    rota_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Move Rota",
            "start_date": "2026-11-02",
            "end_date": "2026-11-08",
        },
        headers=headers,
    )
    rota_id = rota_resp.json()["id"]

    # Create shift on Monday
    create_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts",
        json={
            "staff_id": staff_id,
            "date": "2026-11-02",
            "start_time": "09:00",
            "end_time": "17:00",
        },
        headers=headers,
    )
    shift_id = create_resp.json()["shift"]["id"]

    # Edit shift: move to Tuesday and change hours to 10:00 - 16:00 (6h gross -> 30m break -> 5.5h paid)
    edit_resp = client.patch(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts/{shift_id}",
        json={
            "date": "2026-11-03",
            "start_time": "10:00",
            "end_time": "16:00",
            "notes": "Moved to Tuesday",
        },
        headers=headers,
    )
    assert edit_resp.status_code == status.HTTP_200_OK
    data = edit_resp.json()
    assert data["shift"]["date"] == "2026-11-03"
    assert data["shift"]["start_time"] == "10:00"
    assert data["shift"]["end_time"] == "16:00"
    assert data["shift"]["unpaid_break_minutes"] == 30
    assert data["shift"]["paid_hours"] == 5.5
    assert data["rota"]["total_paid_hours"] == 5.5


def test_manual_shift_copy_and_deletion(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "editor_copy@example.com", "CopyMgr")

    staff_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Emma", "last_name": "Watson", "category": "full_time"},
        headers=headers,
    )
    staff_id = staff_resp.json()["id"]

    rota_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Copy Rota",
            "start_date": "2026-11-02",
            "end_date": "2026-11-08",
        },
        headers=headers,
    )
    rota_id = rota_resp.json()["id"]

    create_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts",
        json={
            "staff_id": staff_id,
            "date": "2026-11-02",
            "start_time": "09:00",
            "end_time": "17:00",
        },
        headers=headers,
    )
    shift_id = create_resp.json()["shift"]["id"]

    # Copy to Wednesday
    copy_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts/{shift_id}/copy",
        json={"target_date": "2026-11-04"},
        headers=headers,
    )
    assert copy_resp.status_code == status.HTTP_201_CREATED
    data = copy_resp.json()
    assert data["shift"]["date"] == "2026-11-04"
    assert data["rota"]["total_shifts"] == 2
    assert data["rota"]["total_paid_hours"] == 14.5

    # Delete the copied shift
    del_resp = client.delete(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts/{data['shift']['id']}",
        headers=headers,
    )
    assert del_resp.status_code == status.HTTP_200_OK
    assert del_resp.json()["rota"]["total_shifts"] == 1
    assert del_resp.json()["rota"]["total_paid_hours"] == 7.25


def test_validation_endpoint_preflight(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "val_preflight@example.com", "ValMgr")

    staff_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Alex", "last_name": "Smith", "category": "full_time"},
        headers=headers,
    )
    staff_id = staff_resp.json()["id"]

    rota_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Val Rota",
            "start_date": "2026-11-02",
            "end_date": "2026-11-08",
        },
        headers=headers,
    )
    rota_id = rota_resp.json()["id"]

    # Call pre-flight validate
    val_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts/validate",
        json={
            "staff_id": staff_id,
            "date": "2026-11-02",
            "start_time": "09:00",
            "end_time": "17:00",
        },
        headers=headers,
    )
    assert val_resp.status_code == status.HTTP_200_OK
    val_data = val_resp.json()
    assert val_data["is_valid"] is True
    assert val_data["has_warnings"] is False
    assert val_data["gross_hours"] == 8.0
    assert val_data["unpaid_break_minutes"] == 45
    assert val_data["paid_hours"] == 7.25
    assert val_data["daily_coverage"] is not None


def test_blocking_validation_errors(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "val_block@example.com", "BlockMgr")

    staff_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Archived", "last_name": "User", "category": "full_time"},
        headers=headers,
    )
    staff_id = staff_resp.json()["id"]

    # Archive the staff
    client.post(f"/api/v1/workspaces/{ws_id}/staff/{staff_id}/archive", headers=headers)

    rota_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Block Rota",
            "start_date": "2026-11-02",
            "end_date": "2026-11-08",
        },
        headers=headers,
    )
    rota_id = rota_resp.json()["id"]

    # 1. Archived staff attempt -> 400 with ARCHIVED_STAFF
    arch_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts",
        json={
            "staff_id": staff_id,
            "date": "2026-11-02",
            "start_time": "09:00",
            "end_time": "17:00",
            "override_warnings": True,  # Cannot override hard blocking constraints
        },
        headers=headers,
    )
    assert arch_resp.status_code == status.HTTP_400_BAD_REQUEST
    assert any(f["code"] == "ARCHIVED_STAFF" for f in arch_resp.json()["detail"]["findings"])

    # 2. Identical start and end time -> 400 with INVALID_TIME
    active_staff = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Active", "last_name": "User", "category": "full_time"},
        headers=headers,
    ).json()

    time_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts",
        json={
            "staff_id": active_staff["id"],
            "date": "2026-11-02",
            "start_time": "09:00",
            "end_time": "09:00",
        },
        headers=headers,
    )
    assert time_resp.status_code == status.HTTP_400_BAD_REQUEST
    assert any(f["code"] == "INVALID_TIME" for f in time_resp.json()["detail"]["findings"])

    # 3. Date outside rota period -> 400 with DATE_OUT_OF_ROTA_RANGE
    date_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts",
        json={
            "staff_id": active_staff["id"],
            "date": "2026-12-25",
            "start_time": "09:00",
            "end_time": "17:00",
        },
        headers=headers,
    )
    assert date_resp.status_code == status.HTTP_400_BAD_REQUEST
    assert any(f["code"] == "DATE_OUT_OF_ROTA_RANGE" for f in date_resp.json()["detail"]["findings"])


def test_warning_validation_and_manager_override(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "val_warn@example.com", "WarnMgr")

    # Staff with recurring day off on Monday (weekday=0)
    staff_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={
            "first_name": "Restricted",
            "last_name": "Worker",
            "category": "restricted_hours",
            "availability_rules": [
                {"weekday": 0, "is_available": False, "is_recurring_day_off": True},
            ],
        },
        headers=headers,
    )
    staff_id = staff_resp.json()["id"]

    rota_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Warn Rota",
            "start_date": "2026-11-02",  # Monday
            "end_date": "2026-11-08",
        },
        headers=headers,
    )
    rota_id = rota_resp.json()["id"]

    # Attempt save without override_warnings -> 400
    warn_attempt = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts",
        json={
            "staff_id": staff_id,
            "date": "2026-11-02",
            "start_time": "09:00",
            "end_time": "17:00",
            "override_warnings": False,
        },
        headers=headers,
    )
    assert warn_attempt.status_code == status.HTTP_400_BAD_REQUEST
    data = warn_attempt.json()["detail"]
    assert any(f["code"] == "RECURRING_DAY_OFF" for f in data["findings"])

    # Attempt save with override_warnings=True -> 201 Created and manager note stamped
    override_ok = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts",
        json={
            "staff_id": staff_id,
            "date": "2026-11-02",
            "start_time": "09:00",
            "end_time": "17:00",
            "override_warnings": True,
            "notes": "Urgent cover needed",
        },
        headers=headers,
    )
    assert override_ok.status_code == status.HTTP_201_CREATED
    saved = override_ok.json()["shift"]
    assert saved["notes"] == "Urgent cover needed"
    assert saved["active_override"] is not None
    assert saved["active_override"]["warning_codes"] == ["RECURRING_DAY_OFF"]
    assert saved["active_override"]["status"] == "active"
    assert saved["active_override"]["user_id"] is not None
    assert saved["active_override"]["overridden_at"] is not None


def test_overlapping_shifts_and_insufficient_rest(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "rest_overlap@example.com", "RestMgr")

    staff = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Dave", "last_name": "Driver", "category": "full_time"},
        headers=headers,
    ).json()
    staff_id = staff["id"]

    rota = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Rest Test Rota",
            "start_date": "2026-11-02",
            "end_date": "2026-11-08",
        },
        headers=headers,
    ).json()
    rota_id = rota["id"]

    # Shift 1: Monday 09:00 - 17:00
    client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts",
        json={
            "staff_id": staff_id,
            "date": "2026-11-02",
            "start_time": "09:00",
            "end_time": "17:00",
        },
        headers=headers,
    )

    # Overlapping Shift on Monday: 14:00 - 20:00 -> OVERLAPPING_SHIFT
    overlap_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts/validate",
        json={
            "staff_id": staff_id,
            "date": "2026-11-02",
            "start_time": "14:00",
            "end_time": "20:00",
        },
        headers=headers,
    )
    assert overlap_resp.status_code == status.HTTP_200_OK
    assert any(f["code"] == "OVERLAPPING_SHIFT" for f in overlap_resp.json()["findings"])

    # Shift 2 on Tuesday evening: 18:00 - 23:00
    client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts",
        json={
            "staff_id": staff_id,
            "date": "2026-11-03",
            "start_time": "18:00",
            "end_time": "23:00",
        },
        headers=headers,
    )

    # Early Shift on Wednesday: 06:00 - 14:00 (7 hours rest after 23:00 < 11h required) -> INSUFFICIENT_REST
    rest_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts/validate",
        json={
            "staff_id": staff_id,
            "date": "2026-11-04",
            "start_time": "06:00",
            "end_time": "14:00",
        },
        headers=headers,
    )
    assert rest_resp.status_code == status.HTTP_200_OK
    assert any(f["code"] == "INSUFFICIENT_REST" for f in rest_resp.json()["findings"])


def test_published_and_archived_rota_protection(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "pub_protect@example.com", "PubProtectMgr")

    staff = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Paul", "last_name": "Protected", "category": "full_time"},
        headers=headers,
    ).json()

    rota = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Published Protection Rota",
            "start_date": "2026-11-02",
            "end_date": "2026-11-08",
        },
        headers=headers,
    ).json()
    rota_id = rota["id"]

    # Create shift in draft
    shift = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts",
        json={
            "staff_id": staff["id"],
            "date": "2026-11-02",
            "start_time": "09:00",
            "end_time": "17:00",
        },
        headers=headers,
    ).json()["shift"]

    # Mark rota as published via dedicated approve endpoint
    pub = client.post(f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/approve", headers=headers)
    assert pub.status_code == status.HTTP_200_OK

    # Create blocked
    c_block = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts",
        json={"staff_id": staff["id"], "date": "2026-11-03", "start_time": "09:00", "end_time": "17:00"},
        headers=headers,
    )
    assert c_block.status_code == status.HTTP_400_BAD_REQUEST

    # Update blocked
    u_block = client.patch(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts/{shift['id']}",
        json={"notes": "Illegal edit"},
        headers=headers,
    )
    assert u_block.status_code == status.HTTP_400_BAD_REQUEST

    # Copy blocked
    cp_block = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts/{shift['id']}/copy",
        json={"target_date": "2026-11-04"},
        headers=headers,
    )
    assert cp_block.status_code == status.HTTP_400_BAD_REQUEST

    # Delete blocked
    d_block = client.delete(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/shifts/{shift['id']}",
        headers=headers,
    )
    assert d_block.status_code == status.HTTP_400_BAD_REQUEST


def test_cross_workspace_idor_protection(client: TestClient):
    headers_a, ws_a = _setup_user_and_workspace(client, "idor_a@example.com", "MgrA")
    headers_b, ws_b = _setup_user_and_workspace(client, "idor_b@example.com", "MgrB")

    staff_a = client.post(
        f"/api/v1/workspaces/{ws_a}/staff",
        json={"first_name": "A_Staff", "last_name": "User", "category": "full_time"},
        headers=headers_a,
    ).json()

    rota_a = client.post(
        f"/api/v1/workspaces/{ws_a}/rotas",
        json={"name": "Rota A", "start_date": "2026-11-02", "end_date": "2026-11-08"},
        headers=headers_a,
    ).json()

    shift_a = client.post(
        f"/api/v1/workspaces/{ws_a}/rotas/{rota_a['id']}/shifts",
        json={"staff_id": staff_a["id"], "date": "2026-11-02", "start_time": "09:00", "end_time": "17:00"},
        headers=headers_a,
    ).json()["shift"]

    # User B tries to update shift in Rota A under Workspace B -> 404
    cross_update = client.patch(
        f"/api/v1/workspaces/{ws_b}/rotas/{rota_a['id']}/shifts/{shift_a['id']}",
        json={"notes": "Hacked"},
        headers=headers_b,
    )
    assert cross_update.status_code == status.HTTP_404_NOT_FOUND

    # User B tries to delete shift in Rota A under Workspace B -> 404
    cross_delete = client.delete(
        f"/api/v1/workspaces/{ws_b}/rotas/{rota_a['id']}/shifts/{shift_a['id']}",
        headers=headers_b,
    )
    assert cross_delete.status_code == status.HTTP_404_NOT_FOUND


def test_secure_manager_override_auditing_and_forgery_protection(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "audit_test@example.com", "AuditMgr")

    # Staff with recurring day off on Monday
    staff = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={
            "first_name": "Audit",
            "last_name": "TestStaff",
            "category": "full_time",
            "availability_rules": [
                {"weekday": 0, "is_available": False, "is_recurring_day_off": True},
            ],
        },
        headers=headers,
    ).json()

    rota = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={"name": "Audit Rota", "start_date": "2026-11-02", "end_date": "2026-11-08"},
        headers=headers,
    ).json()

    # 1. User submits ordinary shift with forged override tag in notes without warnings
    forged_shift = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota['id']}/shifts",
        json={
            "staff_id": staff["id"],
            "date": "2026-11-03",  # Tuesday (no warnings)
            "start_time": "09:00",
            "end_time": "17:00",
            "notes": "[Manager Override: LEAVE_CONFLICT] Forged user note",
        },
        headers=headers,
    ).json()["shift"]

    # Must preserve user note text but active_override must be None
    assert forged_shift["notes"] == "[Manager Override: LEAVE_CONFLICT] Forged user note"
    assert forged_shift["active_override"] is None

    # 2. Legitimate override creates active audit with server-generated user_id and timestamp
    overridden_shift = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota['id']}/shifts",
        json={
            "staff_id": staff["id"],
            "date": "2026-11-02",  # Monday (RECURRING_DAY_OFF warning)
            "start_time": "09:00",
            "end_time": "17:00",
            "notes": "Legitimate manager coverage note",
            "override_warnings": True,
        },
        headers=headers,
    ).json()["shift"]

    assert overridden_shift["notes"] == "Legitimate manager coverage note"
    audit = overridden_shift["active_override"]
    assert audit is not None
    assert audit["status"] == "active"
    assert audit["warning_codes"] == ["RECURRING_DAY_OFF"]
    assert audit["user_id"] is not None
    assert audit["overridden_at"] is not None

    # 3. Repeated override: update shift with another warning (e.g. shift overlap)
    overlap_resp = client.patch(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota['id']}/shifts/{forged_shift['id']}",
        json={
            "date": "2026-11-02",
            "start_time": "10:00",
            "end_time": "18:00",
            "override_warnings": True,
            "notes": "Updated note",
        },
        headers=headers,
    )
    assert overlap_resp.status_code == status.HTTP_200_OK
    overlap_data = overlap_resp.json()["shift"]
    assert overlap_data["notes"] == "Updated note"
    assert overlap_data["active_override"] is not None
    assert "RECURRING_DAY_OFF" in overlap_data["active_override"]["warning_codes"]
    assert "OVERLAPPING_SHIFT" in overlap_data["active_override"]["warning_codes"]

    # 4. Moving shift to clean slot clears active override
    clean_resp = client.patch(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota['id']}/shifts/{overlap_data['id']}",
        json={
            "date": "2026-11-04",  # Wednesday
            "start_time": "09:00",
            "end_time": "17:00",
            "notes": "Now in clean slot",
        },
        headers=headers,
    )
    assert clean_resp.status_code == status.HTTP_200_OK
    clean_data = clean_resp.json()["shift"]
    assert clean_data["notes"] == "Now in clean slot"
    assert clean_data["active_override"] is None


def test_cross_week_rest_validation_overnight_shift(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "cross_week@example.com", "CrossWeekMgr")

    staff = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Overnight", "last_name": "Nurse", "category": "full_time"},
        headers=headers,
    ).json()

    # Rota 1: Week 1 (Monday 2026-11-02 to Sunday 2026-11-08)
    rota_1 = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={"name": "Week 1", "start_date": "2026-11-02", "end_date": "2026-11-08"},
        headers=headers,
    ).json()

    # Rota 2: Week 2 (Monday 2026-11-09 to Sunday 2026-11-15)
    rota_2 = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={"name": "Week 2", "start_date": "2026-11-09", "end_date": "2026-11-15"},
        headers=headers,
    ).json()

    # Staff works Sunday overnight shift in Rota 1: 2026-11-08 22:00 to Monday 2026-11-09 06:00
    client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_1['id']}/shifts",
        json={
            "staff_id": staff["id"],
            "date": "2026-11-08",
            "start_time": "22:00",
            "end_time": "06:00",
        },
        headers=headers,
    )

    # 1. Pre-flight validate Monday morning shift in Rota 2: 2026-11-09 08:00 to 16:00
    # Elapsed rest is 08:00 - 06:00 = 2.0h (< 11.0h required)
    val_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_2['id']}/shifts/validate",
        json={
            "staff_id": staff["id"],
            "date": "2026-11-09",
            "start_time": "08:00",
            "end_time": "16:00",
        },
        headers=headers,
    )
    assert val_resp.status_code == status.HTTP_200_OK
    val_data = val_resp.json()
    assert val_data["has_warnings"] is True
    assert val_data["adjacent_rest_checks"].get("previous_week") == "verified"
    insufficient_rest = next((f for f in val_data["findings"] if f["code"] == "INSUFFICIENT_REST"), None)
    assert insufficient_rest is not None
    assert "2.0h < 11.0h" in insufficient_rest["message"]
    assert "previous rota" in insufficient_rest["message"]

    # 2. Saving without override fails with 400
    save_fail = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_2['id']}/shifts",
        json={
            "staff_id": staff["id"],
            "date": "2026-11-09",
            "start_time": "08:00",
            "end_time": "16:00",
            "override_warnings": False,
        },
        headers=headers,
    )
    assert save_fail.status_code == status.HTTP_400_BAD_REQUEST

    # 3. Saving with override succeeds and records audit
    save_ok = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_2['id']}/shifts",
        json={
            "staff_id": staff["id"],
            "date": "2026-11-09",
            "start_time": "08:00",
            "end_time": "16:00",
            "override_warnings": True,
            "notes": "Emergency morning handover",
        },
        headers=headers,
    )
    assert save_ok.status_code == status.HTTP_201_CREATED
    shift_created = save_ok.json()["shift"]
    assert shift_created["active_override"] is not None
    assert "INSUFFICIENT_REST" in shift_created["active_override"]["warning_codes"]


def test_cross_week_safe_interval_and_missing_adjacent_rota(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "safe_interval@example.com", "SafeMgr")

    staff = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Safe", "last_name": "Interval", "category": "full_time"},
        headers=headers,
    ).json()

    # Create Rota 1: Sunday 2026-11-08 shift ends at 18:00
    rota_1 = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={"name": "Prior Rota", "start_date": "2026-11-02", "end_date": "2026-11-08"},
        headers=headers,
    ).json()

    client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_1['id']}/shifts",
        json={
            "staff_id": staff["id"],
            "date": "2026-11-08",
            "start_time": "10:00",
            "end_time": "18:00",
        },
        headers=headers,
    )

    # Rota 2: Monday 2026-11-09 starts at 09:00 (rest is 15h >= 11h)
    rota_2 = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={"name": "Next Rota", "start_date": "2026-11-09", "end_date": "2026-11-15"},
        headers=headers,
    ).json()

    val_safe = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_2['id']}/shifts/validate",
        json={
            "staff_id": staff["id"],
            "date": "2026-11-09",
            "start_time": "09:00",
            "end_time": "17:00",
        },
        headers=headers,
    ).json()
    assert val_safe["has_warnings"] is False
    assert val_safe["adjacent_rest_checks"].get("previous_week") == "verified"
    assert not any(f["code"] == "INSUFFICIENT_REST" for f in val_safe["findings"])

    # Create isolated Rota 3 with NO prior or next rota
    rota_3 = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={"name": "Isolated Rota", "start_date": "2026-12-07", "end_date": "2026-12-13"},
        headers=headers,
    ).json()

    val_isolated = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_3['id']}/shifts/validate",
        json={
            "staff_id": staff["id"],
            "date": "2026-12-07",
            "start_time": "08:00",
            "end_time": "16:00",
        },
        headers=headers,
    ).json()
    assert val_isolated["has_warnings"] is False
    assert val_isolated["adjacent_rest_checks"].get("previous_week") == "unavailable"


def test_moving_shift_without_false_self_conflict_and_cross_workspace_isolation(client: TestClient):
    headers_a, ws_a = _setup_user_and_workspace(client, "move_iso_a@example.com", "MoveA")
    headers_b, ws_b = _setup_user_and_workspace(client, "move_iso_b@example.com", "MoveB")

    staff_a = client.post(
        f"/api/v1/workspaces/{ws_a}/staff",
        json={"first_name": "Alice", "last_name": "Move", "category": "full_time"},
        headers=headers_a,
    ).json()

    rota_a = client.post(
        f"/api/v1/workspaces/{ws_a}/rotas",
        json={"name": "Rota A", "start_date": "2026-11-02", "end_date": "2026-11-08"},
        headers=headers_a,
    ).json()

    # In Workspace B, create a rota on the prior week and schedule a shift that would conflict if leaked
    staff_b = client.post(
        f"/api/v1/workspaces/{ws_b}/staff",
        json={"first_name": "Bob", "last_name": "Move", "category": "full_time"},
        headers=headers_b,
    ).json()
    rota_b = client.post(
        f"/api/v1/workspaces/{ws_b}/rotas",
        json={"name": "Rota B", "start_date": "2026-10-26", "end_date": "2026-11-01"},
        headers=headers_b,
    ).json()
    client.post(
        f"/api/v1/workspaces/{ws_b}/rotas/{rota_b['id']}/shifts",
        json={
            "staff_id": staff_b["id"],
            "date": "2026-11-01",
            "start_time": "22:00",
            "end_time": "06:00",
        },
        headers=headers_b,
    )

    # Validating Alice in Workspace A on Monday:
    # Must NOT see Workspace B's adjacent Sunday shift
    val_a = client.post(
        f"/api/v1/workspaces/{ws_a}/rotas/{rota_a['id']}/shifts/validate",
        json={
            "staff_id": staff_a["id"],
            "date": "2026-11-02",
            "start_time": "08:00",
            "end_time": "16:00",
        },
        headers=headers_a,
    ).json()
    assert not any(f["code"] == "INSUFFICIENT_REST" for f in val_a["findings"])
    assert val_a["adjacent_rest_checks"].get("previous_week") == "unavailable"

    # Create shift for Alice on Monday
    shift_res = client.post(
        f"/api/v1/workspaces/{ws_a}/rotas/{rota_a['id']}/shifts",
        json={
            "staff_id": staff_a["id"],
            "date": "2026-11-02",
            "start_time": "09:00",
            "end_time": "17:00",
        },
        headers=headers_a,
    ).json()["shift"]

    # Moving Alice's shift to 10:00 - 18:00 on the same date:
    # Must exclude itself from self-conflict checks
    val_move = client.post(
        f"/api/v1/workspaces/{ws_a}/rotas/{rota_a['id']}/shifts/validate",
        json={
            "shift_id": shift_res["id"],
            "staff_id": staff_a["id"],
            "date": "2026-11-02",
            "start_time": "10:00",
            "end_time": "18:00",
        },
        headers=headers_a,
    ).json()
    assert val_move["has_warnings"] is False
    assert not any(f["code"] == "OVERLAPPING_SHIFT" for f in val_move["findings"])
