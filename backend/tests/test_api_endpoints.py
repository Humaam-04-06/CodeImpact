import io
import zipfile
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

def test_upload_project_zip():
    import io
    import zipfile
    
    # Create in-memory zip archive containing a sample Python service
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as z:
        py_code = """
class CalculatorService:
    def add(self, a: int, b: int) -> int:
        return a + b

    def compute_total(self, items: list) -> int:
        return self.add(10, 20)
"""
        z.writestr("calc_service.py", py_code)
    
    zip_buffer.seek(0)
    
    res = client.post(
        "/api/upload-project",
        files={"file": ("calculator_app.zip", zip_buffer, "application/zip")},
        data={"project_name": "Calculator Microservice"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "Calculator Microservice" in data["sample"]["name"]
    assert data["total_symbols"] >= 2
    
    # Verify it appears in GET /api/samples
    samples_res = client.get("/api/samples")
    assert samples_res.status_code == 200
    samples = samples_res.json()
    assert any("Calculator Microservice" in s["name"] for s in samples)

def test_upload_invalid_file():
    # Attempt to upload a non-zip file
    res = client.post(
        "/api/upload-project",
        files={"file": ("invalid_text.txt", io.BytesIO(b"Hello world"), "text/plain")}
    )
    assert res.status_code == 400
    assert "Only .zip archive files are supported" in res.json()["detail"]

