from fastapi import status


def test_cross_tenant_workspace_isolation(client):
    # 1. Register User A
    res_a = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Alice",
            "last_name": "A",
            "email": "alice@tenant-a.com",
            "password": "PasswordAlice123!",
        },
    )
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Get User A's workspace
    me_a = client.get("/api/v1/auth/me", headers=headers_a).json()
    workspace_a_id = me_a["workspaces"][0]["id"]
    assert me_a["workspaces"][0]["name"] == "Alice's Workspace"

    # 2. Register User B
    res_b = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Bob",
            "last_name": "B",
            "email": "bob@tenant-b.com",
            "password": "PasswordBob123!",
        },
    )
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Get User B's workspace
    me_b = client.get("/api/v1/auth/me", headers=headers_b).json()
    workspace_b_id = me_b["workspaces"][0]["id"]
    assert me_b["workspaces"][0]["name"] == "Bob's Workspace"

    # 3. User A lists workspaces -> sees ONLY Workspace A
    list_a = client.get("/api/v1/workspaces", headers=headers_a)
    assert list_a.status_code == status.HTTP_200_OK
    workspaces_a = list_a.json()
    assert len(workspaces_a) == 1
    assert workspaces_a[0]["id"] == workspace_a_id
    assert all(ws["id"] != workspace_b_id for ws in workspaces_a)

    # 4. IDOR ATTACK: User A attempts to GET User B's workspace directly
    res_idor_get = client.get(f"/api/v1/workspaces/{workspace_b_id}", headers=headers_a)
    assert res_idor_get.status_code == status.HTTP_404_NOT_FOUND
    assert "access denied" in res_idor_get.json()["detail"].lower() or "not found" in res_idor_get.json()["detail"].lower()

    # 5. IDOR ATTACK: User A attempts to PATCH User B's workspace name
    res_idor_patch = client.patch(
        f"/api/v1/workspaces/{workspace_b_id}",
        json={"name": "Hacked Workspace Name"},
        headers=headers_a,
    )
    assert res_idor_patch.status_code == status.HTTP_404_NOT_FOUND

    # Verify User B's workspace was NOT modified
    get_b = client.get(f"/api/v1/workspaces/{workspace_b_id}", headers=headers_b)
    assert get_b.status_code == status.HTTP_200_OK
    assert get_b.json()["name"] == "Bob's Workspace"

    # 6. User A CAN update their own workspace
    update_a = client.patch(
        f"/api/v1/workspaces/{workspace_a_id}",
        json={"name": "Alice's Primary Store"},
        headers=headers_a,
    )
    assert update_a.status_code == status.HTTP_200_OK
    assert update_a.json()["name"] == "Alice's Primary Store"
