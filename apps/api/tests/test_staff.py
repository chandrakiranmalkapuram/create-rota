from fastapi import status


def _setup_user_and_workspace(client, email="manager@example.com", name="Manager"):
    res = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": name,
            "last_name": "User",
            "email": email,
            "password": "Password123!",
        },
    )
    assert res.status_code == status.HTTP_201_CREATED
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/v1/auth/me", headers=headers).json()
    workspace_id = me["workspaces"][0]["id"]
    return headers, workspace_id


def test_staff_creation_and_retrieval(client):
    headers, ws_id = _setup_user_and_workspace(client, "alice@stafftest.com", "Alice")

    # 1. Create a skill first
    skill_res = client.post(
        f"/api/v1/workspaces/{ws_id}/skills",
        json={"name": "Till Operator", "color": "#10B981"},
        headers=headers,
    )
    assert skill_res.status_code == status.HTTP_201_CREATED
    skill_id = skill_res.json()["id"]

    # 2. Create staff member with skill, contract, and availability
    staff_data = {
        "first_name": "Charlie",
        "last_name": "Brown",
        "display_name": "Charlie B",
        "category": "restricted_hours",
        "notes": "Prefers morning shifts.",
        "skill_ids": [skill_id],
        "contract": {
            "contracted_hours_per_week": 24.0,
            "min_hours_per_week": 16.0,
            "max_hours_per_week": 28.0,
            "max_shifts_per_week": 4,
            "max_consecutive_days": 4,
            "min_rest_hours_between_shifts": 11.0,
        },
        "availability_rules": [
            {
                "weekday": 0,  # Monday
                "is_available": True,
                "start_time": "08:00",
                "end_time": "14:00",
                "is_recurring_day_off": False,
            },
            {
                "weekday": 1,  # Tuesday
                "is_available": False,
                "start_time": None,
                "end_time": None,
                "is_recurring_day_off": True,
            },
        ],
        "unavailability_blocks": [
            {
                "reason_category": "holiday",
                "start_date": "2026-11-01",
                "end_date": "2026-11-05",
                "notes": "Approved annual leave",
            }
        ],
    }

    create_res = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json=staff_data,
        headers=headers,
    )
    assert create_res.status_code == status.HTTP_201_CREATED
    created = create_res.json()
    assert created["first_name"] == "Charlie"
    assert created["last_name"] == "Brown"
    assert created["display_name"] == "Charlie B"
    assert created["category"] == "restricted_hours"
    assert created["is_archived"] is False
    assert len(created["skills"]) == 1
    assert created["skills"][0]["name"] == "Till Operator"
    assert created["contract"]["contracted_hours_per_week"] == 24.0
    assert len(created["availability_rules"]) == 2
    assert len(created["unavailability_blocks"]) == 1
    assert created["unavailability_blocks"][0]["reason_category"] == "holiday"

    staff_id = created["id"]

    # 3. Read staff detail
    detail_res = client.get(
        f"/api/v1/workspaces/{ws_id}/staff/{staff_id}",
        headers=headers,
    )
    assert detail_res.status_code == status.HTTP_200_OK
    assert detail_res.json()["id"] == staff_id


def test_staff_contract_validation(client):
    headers, ws_id = _setup_user_and_workspace(client, "contract_val@test.com", "Val")

    # Contracted hours must be > 0
    bad_contract_1 = {
        "first_name": "Zero",
        "last_name": "Hours",
        "contract": {"contracted_hours_per_week": 0},
    }
    res1 = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json=bad_contract_1,
        headers=headers,
    )
    assert res1.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    # Min hours cannot exceed max hours
    bad_contract_2 = {
        "first_name": "Inverted",
        "last_name": "Hours",
        "contract": {
            "contracted_hours_per_week": 20,
            "min_hours_per_week": 30,
            "max_hours_per_week": 25,
        },
    }
    res2 = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json=bad_contract_2,
        headers=headers,
    )
    assert res2.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_staff_availability_and_leave_validation(client):
    headers, ws_id = _setup_user_and_workspace(client, "leave_val@test.com", "LeaveVal")

    # Invalid time format in availability
    bad_time = {
        "first_name": "Bad",
        "last_name": "Time",
        "availability_rules": [
            {
                "weekday": 0,
                "start_time": "25:99",
                "end_time": "17:00",
            }
        ],
    }
    res_time = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json=bad_time,
        headers=headers,
    )
    assert res_time.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    # Inverted leave dates
    bad_dates = {
        "first_name": "Bad",
        "last_name": "Dates",
        "unavailability_blocks": [
            {
                "reason_category": "holiday",
                "start_date": "2026-11-10",
                "end_date": "2026-11-05",
            }
        ],
    }
    res_dates = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json=bad_dates,
        headers=headers,
    )
    assert res_dates.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    # Invalid leave reason category
    bad_reason = {
        "first_name": "Bad",
        "last_name": "Reason",
        "unavailability_blocks": [
            {
                "reason_category": "unknown_reason",
                "start_date": "2026-11-01",
                "end_date": "2026-11-02",
            }
        ],
    }
    res_reason = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json=bad_reason,
        headers=headers,
    )
    assert res_reason.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_staff_listing_and_filtering(client):
    headers, ws_id = _setup_user_and_workspace(client, "list_filter@test.com", "Filter")

    # Add 1 full-time and 2 restricted-hours staff
    client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Diana", "last_name": "Prince", "category": "full_time"},
        headers=headers,
    )
    client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Peter", "last_name": "Parker", "category": "restricted_hours"},
        headers=headers,
    )
    client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Bruce", "last_name": "Wayne", "category": "restricted_hours"},
        headers=headers,
    )

    # 1. List all active
    all_res = client.get(f"/api/v1/workspaces/{ws_id}/staff", headers=headers)
    assert all_res.status_code == status.HTTP_200_OK
    assert all_res.json()["total"] == 3

    # 2. Filter by category
    ft_res = client.get(
        f"/api/v1/workspaces/{ws_id}/staff?category=full_time",
        headers=headers,
    )
    assert ft_res.json()["total"] == 1
    assert ft_res.json()["items"][0]["first_name"] == "Diana"

    rh_res = client.get(
        f"/api/v1/workspaces/{ws_id}/staff?category=restricted_hours",
        headers=headers,
    )
    assert rh_res.json()["total"] == 2

    # 3. Search query
    search_res = client.get(
        f"/api/v1/workspaces/{ws_id}/staff?search=parker",
        headers=headers,
    )
    assert search_res.json()["total"] == 1
    assert search_res.json()["items"][0]["first_name"] == "Peter"


def test_staff_archive_reactivate_and_delete(client):
    headers, ws_id = _setup_user_and_workspace(client, "lifecycle@test.com", "Lifecycle")

    # Create staff
    staff = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Clark", "last_name": "Kent"},
        headers=headers,
    ).json()
    staff_id = staff["id"]

    # Cannot delete active staff
    del_active = client.delete(
        f"/api/v1/workspaces/{ws_id}/staff/{staff_id}",
        headers=headers,
    )
    assert del_active.status_code == status.HTTP_400_BAD_REQUEST

    # Archive staff
    arch_res = client.post(
        f"/api/v1/workspaces/{ws_id}/staff/{staff_id}/archive",
        headers=headers,
    )
    assert arch_res.status_code == status.HTTP_200_OK
    assert arch_res.json()["is_archived"] is True

    # Active list now empty
    active_res = client.get(f"/api/v1/workspaces/{ws_id}/staff", headers=headers)
    assert active_res.json()["total"] == 0

    # Archived list shows Clark
    archived_list = client.get(
        f"/api/v1/workspaces/{ws_id}/staff?is_archived=true",
        headers=headers,
    )
    assert archived_list.json()["total"] == 1

    # Reactivate staff
    react_res = client.post(
        f"/api/v1/workspaces/{ws_id}/staff/{staff_id}/reactivate",
        headers=headers,
    )
    assert react_res.status_code == status.HTTP_200_OK
    assert react_res.json()["is_archived"] is False

    # Archive again, then delete permanently
    client.post(
        f"/api/v1/workspaces/{ws_id}/staff/{staff_id}/archive",
        headers=headers,
    )
    del_arch = client.delete(
        f"/api/v1/workspaces/{ws_id}/staff/{staff_id}",
        headers=headers,
    )
    assert del_arch.status_code == status.HTTP_204_NO_CONTENT

    # Detail now returns 404
    get_del = client.get(
        f"/api/v1/workspaces/{ws_id}/staff/{staff_id}",
        headers=headers,
    )
    assert get_del.status_code == status.HTTP_404_NOT_FOUND


def test_cross_tenant_staff_idor_isolation(client):
    headers_a, ws_a = _setup_user_and_workspace(client, "alice_idor@test.com", "Alice")
    headers_b, ws_b = _setup_user_and_workspace(client, "bob_idor@test.com", "Bob")

    # Alice creates a staff member in Workspace A
    staff_a = client.post(
        f"/api/v1/workspaces/{ws_a}/staff",
        json={"first_name": "AliceStaff", "last_name": "One"},
        headers=headers_a,
    ).json()
    staff_a_id = staff_a["id"]

    # Bob attempts IDOR to read Alice's staff member via Bob's workspace or Alice's workspace
    # Case 1: Bob requests Alice's staff using Alice's workspace_id -> 404 (access denied to workspace)
    idor_res1 = client.get(
        f"/api/v1/workspaces/{ws_a}/staff/{staff_a_id}",
        headers=headers_b,
    )
    assert idor_res1.status_code == status.HTTP_404_NOT_FOUND

    # Case 2: Bob requests Alice's staff using Bob's workspace_id -> 404 (staff does not belong to ws_b)
    idor_res2 = client.get(
        f"/api/v1/workspaces/{ws_b}/staff/{staff_a_id}",
        headers=headers_b,
    )
    assert idor_res2.status_code == status.HTTP_404_NOT_FOUND

    # Case 3: Bob attempts to PATCH Alice's staff
    idor_patch = client.patch(
        f"/api/v1/workspaces/{ws_a}/staff/{staff_a_id}",
        json={"first_name": "Hacked"},
        headers=headers_b,
    )
    assert idor_patch.status_code == status.HTTP_404_NOT_FOUND

    # Case 4: Bob attempts to delete Alice's staff
    idor_del = client.delete(
        f"/api/v1/workspaces/{ws_a}/staff/{staff_a_id}",
        headers=headers_b,
    )
    assert idor_del.status_code == status.HTTP_404_NOT_FOUND

    # Verify Alice's staff is completely intact
    alice_check = client.get(
        f"/api/v1/workspaces/{ws_a}/staff/{staff_a_id}",
        headers=headers_a,
    )
    assert alice_check.status_code == status.HTTP_200_OK
    assert alice_check.json()["first_name"] == "AliceStaff"


def test_leave_management(client):
    headers, ws_id = _setup_user_and_workspace(client, "leave_mgmt@test.com", "LeaveUser")

    # Create staff
    staff = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Arthur", "last_name": "Dent"},
        headers=headers,
    ).json()
    staff_id = staff["id"]

    # Add sickness leave (only dates, no medical info)
    leave_res = client.post(
        f"/api/v1/workspaces/{ws_id}/staff/{staff_id}/leave",
        json={
            "reason_category": "sickness",
            "start_date": "2026-11-15",
            "end_date": "2026-11-17",
            "notes": "Unavailable to work",
        },
        headers=headers,
    )
    assert leave_res.status_code == status.HTTP_201_CREATED
    block_id = leave_res.json()["id"]

    # Verify leave appears on staff detail
    detail = client.get(
        f"/api/v1/workspaces/{ws_id}/staff/{staff_id}",
        headers=headers,
    ).json()
    assert len(detail["unavailability_blocks"]) == 1
    assert detail["unavailability_blocks"][0]["reason_category"] == "sickness"

    # Remove leave block
    del_leave = client.delete(
        f"/api/v1/workspaces/{ws_id}/staff/{staff_id}/leave/{block_id}",
        headers=headers,
    )
    assert del_leave.status_code == status.HTTP_204_NO_CONTENT

    # Verify leave block removed
    detail_after = client.get(
        f"/api/v1/workspaces/{ws_id}/staff/{staff_id}",
        headers=headers,
    ).json()
    assert len(detail_after["unavailability_blocks"]) == 0
