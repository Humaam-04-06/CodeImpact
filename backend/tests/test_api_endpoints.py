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

def test_upload_deduplication_and_multiple_projects():
    # Upload first project
    buf1 = io.BytesIO()
    with zipfile.ZipFile(buf1, "w") as z:
        z.writestr("app.py", "def first_fn(): pass")
    buf1.seek(0)
    res1 = client.post(
        "/api/upload-project",
        files={"file": ("first_project.zip", buf1, "application/zip")},
        data={"project_name": "Project Alpha"}
    )
    assert res1.status_code == 200

    # Upload same project again with same name (should deduplicate, not duplicate)
    buf2 = io.BytesIO()
    with zipfile.ZipFile(buf2, "w") as z:
        z.writestr("app.py", "def first_fn(): pass")
    buf2.seek(0)
    res2 = client.post(
        "/api/upload-project",
        files={"file": ("first_project.zip", buf2, "application/zip")},
        data={"project_name": "Project Alpha"}
    )
    assert res2.status_code == 200

    # Upload second distinct project
    buf3 = io.BytesIO()
    with zipfile.ZipFile(buf3, "w") as z:
        z.writestr("app.py", "def second_fn(): pass")
    buf3.seek(0)
    res3 = client.post(
        "/api/upload-project",
        files={"file": ("second_project.zip", buf3, "application/zip")},
        data={"project_name": "Project Beta"}
    )
    assert res3.status_code == 200

    # Verify samples list
    samples_res = client.get("/api/samples")
    assert samples_res.status_code == 200
    samples = samples_res.json()
    
    alpha_count = sum(1 for s in samples if "Project Alpha" in s["name"])
    beta_count = sum(1 for s in samples if "Project Beta" in s["name"])
    assert alpha_count == 1, "Project Alpha should be deduplicated to exactly 1 entry"
    assert beta_count == 1, "Project Beta should exist as 1 entry"
    # Project Beta should be at index 0 (most recent)
    assert "Project Beta" in samples[0]["name"]

def test_js_ts_arrow_functions_and_return_types():
    # Test that arrow functions, function expressions, and return types are extracted properly
    buf = io.BytesIO()
    js_code = """
    export const calculateDiscount = (price: number, rate: number): number => {
        return price * rate;
    };
    export const logPayment = function(id: string): void {
        calculateDiscount(100, 0.2);
    };
    """
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("services/discountService.ts", js_code)
    buf.seek(0)

    res = client.post(
        "/api/upload-project",
        files={"file": ("ts_arrow_test.zip", buf, "application/zip")},
        data={"project_name": "TS Arrow Project"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_symbols"] >= 2
    sym_names = [s["name"] for s in data["symbols"]]
    assert "calculateDiscount" in sym_names
    assert "logPayment" in sym_names

    calc_sym = next(s for s in data["symbols"] if s["name"] == "calculateDiscount")
    assert calc_sym["return_type"] == "number"
    assert len(calc_sym["parameters"]) == 2
    assert calc_sym["parameters"][0]["name"] == "price"


