
from fastapi import status
from fastapi.testclient import TestClient


def _setup_user_and_workspace(client: TestClient, email: str = "manager@example.com", name: str = "Manager"):
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


def test_create_and_list_rotas(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "rota_crud@example.com", "RotaMgr")

    payload = {
        "name": "Week 45 November 2026",
        "start_date": "2026-11-02",
        "end_date": "2026-11-08",
        "default_band_start": "09:00",
        "default_band_end": "17:00",
        "default_staff_count": 2,
    }
    create_resp = client.post(f"/api/v1/workspaces/{ws_id}/rotas", json=payload, headers=headers)
    assert create_resp.status_code == status.HTTP_201_CREATED
    data = create_resp.json()
    assert data["name"] == "Week 45 November 2026"
    assert data["start_date"] == "2026-11-02"
    assert data["end_date"] == "2026-11-08"
    assert data["status"] == "draft"
    assert len(data["requirements"]) == 7  # 7 days
    rota_id = data["id"]

    # List rotas
    list_resp = client.get(f"/api/v1/workspaces/{ws_id}/rotas", headers=headers)
    assert list_resp.status_code == status.HTTP_200_OK
    list_data = list_resp.json()
    assert list_data["total"] >= 1
    assert any(r["id"] == rota_id for r in list_data["items"])


def test_copy_requirements(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "copy_req@example.com", "CopyMgr")

    # Create rota
    create_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Copy Rota",
            "start_date": "2026-11-02",
            "end_date": "2026-11-08",
        },
        headers=headers,
    )
    rota_id = create_resp.json()["id"]

    # Update Monday (2026-11-02) to have 2 distinct bands
    update_payload = {
        "requirements": [
            {
                "date": "2026-11-02",
                "bands": [
                    {"start_time": "08:00", "end_time": "12:00", "target_staff_count": 1},
                    {"start_time": "12:00", "end_time": "20:00", "target_staff_count": 3},
                ],
            }
        ]
    }
    up_resp = client.put(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/requirements",
        json=update_payload,
        headers=headers,
    )
    assert up_resp.status_code == status.HTTP_200_OK

    # Copy Monday to Tuesday and Wednesday
    copy_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/copy-requirements",
        json={
            "source_date": "2026-11-02",
            "target_dates": ["2026-11-03", "2026-11-04"],
        },
        headers=headers,
    )
    assert copy_resp.status_code == status.HTTP_200_OK
    tuesday_req = next(r for r in copy_resp.json()["requirements"] if r["date"] == "2026-11-03")
    assert len(tuesday_req["bands"]) == 2
    assert tuesday_req["bands"][0]["start_time"] == "08:00"
    assert tuesday_req["bands"][1]["target_staff_count"] == 3


def test_normal_generation_feasible(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "feasible_gen@example.com", "FeasMgr")

    # Create 3 staff members
    for name in ["Alice", "Bob", "Charlie"]:
        staff_resp = client.post(
            f"/api/v1/workspaces/{ws_id}/staff",
            json={
                "first_name": name,
                "last_name": "Smith",
                "category": "full_time",
                "contract": {"contracted_hours_per_week": 37.5},
            },
            headers=headers,
        )
        assert staff_resp.status_code == status.HTTP_201_CREATED

    # Create 7-day rota with 1 staff required per day (09:00 to 17:00)
    rota_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Feasible Week",
            "start_date": "2026-11-02",
            "end_date": "2026-11-08",
            "default_band_start": "09:00",
            "default_band_end": "17:00",
            "default_staff_count": 1,
        },
        headers=headers,
    )
    rota_id = rota_resp.json()["id"]

    # Trigger generation
    gen_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/generate",
        json={"time_limit_seconds": 10.0},
        headers=headers,
    )
    assert gen_resp.status_code == status.HTTP_200_OK
    data = gen_resp.json()
    assert data["latest_generation_status"] == "feasible"
    assert data["latest_run"]["status"] == "feasible"
    assert data["latest_run"]["coverage_score"] == 100.0
    assert len(data["shifts"]) == 7  # 7 shifts for 7 days
    # Verify no overlapping shifts on the same day for any staff
    day_staff_pairs = [(s["date"], s["staff_id"]) for s in data["shifts"]]
    assert len(day_staff_pairs) == len(set(day_staff_pairs))


def test_skill_matching_constraint(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "skill_gen@example.com", "SkillMgr")

    # Create skill "Chef"
    skill_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/skills",
        json={"name": "Chef", "color": "#E11D48"},
        headers=headers,
    )
    chef_skill_id = skill_resp.json()["id"]

    # Staff 1: Regular (no skill)
    client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={"first_name": "Dave", "last_name": "Server", "category": "full_time"},
        headers=headers,
    )

    # Staff 2: Qualified Chef
    chef_staff = client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={
            "first_name": "Gordon",
            "last_name": "Ramsay",
            "category": "full_time",
            "skill_ids": [chef_skill_id],
        },
        headers=headers,
    ).json()

    # Rota requiring Chef on 2026-11-02
    rota_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Chef Rota",
            "start_date": "2026-11-02",
            "end_date": "2026-11-02",
        },
        headers=headers,
    )
    rota_id = rota_resp.json()["id"]

    # Set band requiring chef_skill_id
    client.put(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/requirements",
        json={
            "requirements": [
                {
                    "date": "2026-11-02",
                    "bands": [
                        {
                            "start_time": "10:00",
                            "end_time": "18:00",
                            "target_staff_count": 1,
                            "skill_id": chef_skill_id,
                        }
                    ],
                }
            ]
        },
        headers=headers,
    )

    gen_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/generate",
        json={"time_limit_seconds": 10.0},
        headers=headers,
    )
    assert gen_resp.status_code == status.HTTP_200_OK
    data = gen_resp.json()
    assert data["latest_generation_status"] == "feasible"
    assert len(data["shifts"]) == 1
    # Gordon MUST be assigned, Dave CANNOT be assigned
    assert data["shifts"][0]["staff_id"] == chef_staff["id"]
    assert data["shifts"][0]["skill_id"] == chef_skill_id


def test_availability_and_recurring_day_off(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "avail_gen@example.com", "AvailMgr")

    # Staff member who has recurring day off on Sunday (weekday=6)
    # 2026-11-08 is a Sunday
    client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={
            "first_name": "Sunday",
            "last_name": "Off",
            "category": "full_time",
            "availability_rules": [
                {"weekday": 6, "is_available": False, "is_recurring_day_off": True}
            ],
        },
        headers=headers,
    )

    # Rota for Sunday only (2026-11-08)
    rota_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Sunday Rota",
            "start_date": "2026-11-08",
            "end_date": "2026-11-08",
            "default_band_start": "09:00",
            "default_band_end": "17:00",
            "default_staff_count": 1,
        },
        headers=headers,
    )
    rota_id = rota_resp.json()["id"]

    # Should be partially_feasible / unmet since only staff member has Sunday off
    gen_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/generate",
        json={"time_limit_seconds": 10.0},
        headers=headers,
    )
    assert gen_resp.status_code == status.HTTP_200_OK
    data = gen_resp.json()
    assert data["latest_generation_status"] == "partially_feasible"
    assert len(data["shifts"]) == 0  # Staff cannot work Sunday
    assert any("short by 1" in diag["message"] for diag in data["latest_run"]["diagnostics"])


def test_approved_leave_block(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "leave_gen@example.com", "LeaveMgr")

    # Staff with approved holiday block on 2026-11-03
    client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={
            "first_name": "Holiday",
            "last_name": "User",
            "category": "full_time",
            "unavailability_blocks": [
                {
                    "reason_category": "holiday",
                    "start_date": "2026-11-03",
                    "end_date": "2026-11-03",
                    "notes": "Approved annual leave",
                }
            ],
        },
        headers=headers,
    ).json()

    # Rota for 2 days: Mon 2026-11-02 and Tue 2026-11-03
    rota_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Holiday Test Rota",
            "start_date": "2026-11-02",
            "end_date": "2026-11-03",
            "default_band_start": "09:00",
            "default_band_end": "17:00",
            "default_staff_count": 1,
        },
        headers=headers,
    )
    rota_id = rota_resp.json()["id"]

    gen_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/generate",
        json={"time_limit_seconds": 10.0},
        headers=headers,
    )
    assert gen_resp.status_code == status.HTTP_200_OK
    data = gen_resp.json()
    # On 2026-11-02, staff works. On 2026-11-03, staff CANNOT work because of holiday block.
    assert len(data["shifts"]) == 1
    assert data["shifts"][0]["date"] == "2026-11-02"
    assert data["latest_generation_status"] == "partially_feasible"


def test_contract_limits_and_consecutive_days(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "contract_limits@example.com", "LimitMgr")

    # Staff with max 2 shifts per week and max 2 consecutive days
    client.post(
        f"/api/v1/workspaces/{ws_id}/staff",
        json={
            "first_name": "Limited",
            "last_name": "Staff",
            "category": "restricted_hours",
            "contract": {
                "contracted_hours_per_week": 16.0,
                "max_shifts_per_week": 2,
                "max_consecutive_days": 2,
            },
        },
        headers=headers,
    )

    # 5-day rota (Mon-Fri)
    rota_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "5 Day Rota",
            "start_date": "2026-11-02",
            "end_date": "2026-11-06",
            "default_band_start": "09:00",
            "default_band_end": "17:00",
            "default_staff_count": 1,
        },
        headers=headers,
    )
    rota_id = rota_resp.json()["id"]

    gen_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/generate",
        json={"time_limit_seconds": 10.0},
        headers=headers,
    )
    assert gen_resp.status_code == status.HTTP_200_OK
    data = gen_resp.json()
    # Staff can work at most 2 shifts
    assert len(data["shifts"]) == 2
    assert data["latest_generation_status"] == "partially_feasible"


def test_infeasible_when_no_active_staff(client: TestClient):
    headers, ws_id = _setup_user_and_workspace(client, "no_staff@example.com", "EmptyMgr")

    rota_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas",
        json={
            "name": "Empty Workspace Rota",
            "start_date": "2026-11-02",
            "end_date": "2026-11-03",
        },
        headers=headers,
    )
    rota_id = rota_resp.json()["id"]

    gen_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/rotas/{rota_id}/generate",
        json={"time_limit_seconds": 10.0},
        headers=headers,
    )
    assert gen_resp.status_code == status.HTTP_200_OK
    data = gen_resp.json()
    assert data["latest_generation_status"] == "infeasible"
    assert any("No active staff members found" in d["message"] for d in data["latest_run"]["diagnostics"])


def test_workspace_isolation_and_idor(client: TestClient):
    headers_a, ws_a_id = _setup_user_and_workspace(client, "ws_a@example.com", "MgrA")
    headers_b, ws_b_id = _setup_user_and_workspace(client, "ws_b@example.com", "MgrB")

    # Tenant A creates rota
    rota_a_resp = client.post(
        f"/api/v1/workspaces/{ws_a_id}/rotas",
        json={
            "name": "Tenant A Secret Rota",
            "start_date": "2026-11-02",
            "end_date": "2026-11-08",
        },
        headers=headers_a,
    )
    rota_a_id = rota_a_resp.json()["id"]

    # Tenant B tries to access Tenant A's rota under workspace A -> 403 Forbidden
    cross_get_resp = client.get(
        f"/api/v1/workspaces/{ws_a_id}/rotas/{rota_a_id}",
        headers=headers_b,
    )
    assert cross_get_resp.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    # Tenant B tries to access Tenant A's rota under workspace B -> 404 Not Found
    idor_get_resp = client.get(
        f"/api/v1/workspaces/{ws_b_id}/rotas/{rota_a_id}",
        headers=headers_b,
    )
    assert idor_get_resp.status_code == status.HTTP_404_NOT_FOUND

    # Tenant B tries to generate shifts on Tenant A's rota -> 404 Not Found
    idor_gen_resp = client.post(
        f"/api/v1/workspaces/{ws_b_id}/rotas/{rota_a_id}/generate",
        json={"time_limit_seconds": 5.0},
        headers=headers_b,
    )
    assert idor_gen_resp.status_code == status.HTTP_404_NOT_FOUND

    # Tenant B tries to delete Tenant A's rota -> 404 Not Found
    idor_del_resp = client.delete(
        f"/api/v1/workspaces/{ws_b_id}/rotas/{rota_a_id}",
        headers=headers_b,
    )
    assert idor_del_resp.status_code == status.HTTP_404_NOT_FOUND
