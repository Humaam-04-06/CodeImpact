from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"

def test_samples():
    res = client.get("/api/samples")
    assert res.status_code == 200
    samples = res.json()
    assert len(samples) >= 2
    assert any(s["id"] == "csharp_ecommerce" for s in samples)
    assert any(s["id"] == "ts_saas_api" for s in samples)

def test_scan_and_symbols():
    res = client.post("/api/scan", json={"workspace_path": "sample_projects/csharp_ecommerce"})
    assert res.status_code == 200
    data = res.json()
    assert data["total_symbols"] == 11
    assert data["total_edges"] >= 9

    res_syms = client.get("/api/symbols")
    assert res_syms.status_code == 200
    assert res_syms.json()["count"] == 11

def test_impact_analysis():
    res = client.post("/api/impact", json={"symbol_id": "UserService.GetUser"})
    assert res.status_code == 200
    report = res.json()
    assert report["target_id"] == "UserService.GetUser"
    assert report["summary"]["total_dependents"] == 7
    assert report["summary"]["controllers_count"] == 3
    assert report["summary"]["db_ops_count"] == 2
    assert report["summary"]["tests_count"] == 1
    assert report["blast_score"] > 50

def test_simulate_change():
    res = client.post(
        "/api/simulate",
        json={
            "symbol_id": "UserService.GetUser",
            "parameters": [
                {"name": "userId", "type_annotation": "string"},
                {"name": "includeHistory", "type_annotation": "bool"}
            ]
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["breaking_changes_count"] == 6

def test_graph_data():
    res = client.get("/api/graph-data?target_symbol=UserService.GetUser")
    assert res.status_code == 200
    data = res.json()
    assert len(data["nodes"]) == 11
    assert len(data["edges"]) >= 9
    assert any(e["animated"] for e in data["edges"])

def test_export_report():
    res = client.post(
        "/api/export-report",
        json={"symbol_id": "UserService.GetUser", "pr_title": "Update GetUser Contract"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "### 🛡️ CodeImpact" in data["markdown"]
    assert "AuthController.Login" in data["markdown"]

def test_ts_saas_scan():
    res = client.post("/api/scan", json={"workspace_path": "sample_projects/ts_saas_api"})
    assert res.status_code == 200
    data = res.json()
    assert data["total_symbols"] >= 4
