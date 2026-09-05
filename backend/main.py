import os
from typing import List, Optional, Dict, Any
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.engine.models import (
    SymbolNode, SymbolType, Parameter, BlastReport, BreakingChange
)
from backend.engine.parser_engine import ASTParserEngine
from backend.engine.graph_builder import CodeKnowledgeGraph
from backend.engine.impact_analyzer import BlastRadiusAnalyzer
from backend.engine.change_simulator import ChangeSimulator

# Global in-memory state for the active scanned project
state: Dict[str, Any] = {
    "workspace_dir": "sample_projects/csharp_ecommerce",
    "parser": ASTParserEngine(),
    "ckg": CodeKnowledgeGraph(),
    "analyzer": None,
    "symbols": [],
    "is_scanned": False
}

def load_workspace(target_path: str):
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail=f"Workspace path not found: {target_path}")

    symbols = state["parser"].scan_directory(target_path)
    ckg = CodeKnowledgeGraph()
    ckg.build_from_symbols(symbols)
    analyzer = BlastRadiusAnalyzer(ckg)

    state["workspace_dir"] = target_path
    state["symbols"] = symbols
    state["ckg"] = ckg
    state["analyzer"] = analyzer
    state["is_scanned"] = True

    return {
        "workspace": target_path,
        "total_symbols": len(symbols),
        "total_edges": ckg.graph.number_of_edges(),
        "symbols": symbols
    }

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-scan default sample on startup
    try:
        load_workspace("sample_projects/csharp_ecommerce")
    except Exception as e:
        print(f"[Warning] Initial workspace scan deferred: {e}")
    yield

app = FastAPI(
    title="CodeImpact API",
    description="Intelligent Multi-Language Dependency & Blast Radius Analyzer API",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Request & Response Schemas
# -----------------------------------------------------------------------------
class ScanRequest(BaseModel):
    workspace_path: Optional[str] = "sample_projects/csharp_ecommerce"

class ImpactRequest(BaseModel):
    symbol_id: str

class SimulateRequest(BaseModel):
    symbol_id: str
    parameters: List[Parameter]
    return_type: Optional[str] = None

class ExportReportRequest(BaseModel):
    symbol_id: str
    pr_title: Optional[str] = "Feature / Refactoring Update"
    author: Optional[str] = "Developer"

class ProjectSample(BaseModel):
    id: str
    name: str
    language: str
    path: str
    description: str

# -----------------------------------------------------------------------------
# API Endpoints
# -----------------------------------------------------------------------------
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CodeImpact Engine",
        "active_workspace": state["workspace_dir"],
        "symbols_loaded": len(state["symbols"])
    }

@app.get("/api/samples", response_model=List[ProjectSample])
def list_samples():
    """Returns preloaded sample projects for instant 1-click demonstration."""
    return [
        ProjectSample(
            id="csharp_ecommerce",
            name="C# E-Commerce Microservice",
            language="C# (.cs)",
            path="sample_projects/csharp_ecommerce",
            description="UserService, OrderService, PaymentService, AuthController, and Db Repositories."
        ),
        ProjectSample(
            id="ts_saas_api",
            name="TypeScript Cloud Billing SaaS",
            language="TypeScript (.ts)",
            path="sample_projects/ts_saas_api",
            description="SubscriptionService, BillingController, PaymentGateway, and Unit Tests."
        )
    ]

@app.post("/api/scan")
def scan_workspace(req: ScanRequest):
    """Parses a project directory, builds the Code Knowledge Graph, and returns extracted symbols."""
    return load_workspace(req.workspace_path)

@app.get("/api/symbols")
def get_symbols():
    """Returns all extracted symbols in the active workspace."""
    if not state["is_scanned"]:
        load_workspace(state["workspace_dir"])
    return {
        "workspace": state["workspace_dir"],
        "count": len(state["symbols"]),
        "symbols": state["symbols"]
    }

@app.post("/api/impact", response_model=BlastReport)
def calculate_impact(req: ImpactRequest):
    """Calculates the complete blast radius, risk score, and cascading ripple effects for a symbol."""
    if not state["is_scanned"]:
        load_workspace(state["workspace_dir"])

    analyzer: BlastRadiusAnalyzer = state["analyzer"]
    report = analyzer.analyze_impact(req.symbol_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Symbol '{req.symbol_id}' not found in graph.")
    return report

@app.post("/api/simulate")
def simulate_change(req: SimulateRequest):
    """Simulates a function signature change and detects breaking call sites in callers."""
    if not state["is_scanned"]:
        load_workspace(state["workspace_dir"])

    ckg: CodeKnowledgeGraph = state["ckg"]
    sim = ChangeSimulator(ckg)
    breaking = sim.simulate_signature_change(
        target_symbol_id=req.symbol_id,
        new_parameters=req.parameters,
        new_return_type=req.return_type
    )
    return {
        "symbol_id": req.symbol_id,
        "breaking_changes_count": len(breaking),
        "breaking_changes": breaking
    }

@app.get("/api/graph-data")
def get_graph_data(target_symbol: Optional[str] = Query(None)):
    """
    Returns graph nodes and edges formatted specifically for React Flow rendering.
    If target_symbol is provided, highlights blast radius propagation path and upstream callers.
    """
    if not state["is_scanned"]:
        load_workspace(state["workspace_dir"])

    ckg: CodeKnowledgeGraph = state["ckg"]

    upstream_ids: set = set()
    downstream_ids: set = set()
    if target_symbol and target_symbol in ckg.symbols_by_id:
        upstream_ids = ckg.get_all_upstream_ancestors(target_symbol)
        downstream_ids = ckg.get_all_downstream_descendants(target_symbol)

    nodes = []
    edges = []

    # Layout nodes in layered columns:
    # Col 0: Controllers & Tests (Upstream surface)
    # Col 1: Intermediate Calling Services
    # Col 2: Target Function / Core Services
    # Col 3: Database Repositories & Utilities
    col_counts = {0: 0, 1: 0, 2: 0, 3: 0}

    for sym in state["symbols"]:
        is_target = sym.id == target_symbol
        is_upstream = sym.id in upstream_ids
        is_downstream = sym.id in downstream_ids
        in_blast = is_target or is_upstream or is_downstream

        # Determine column tier
        if sym.symbol_type == SymbolType.CONTROLLER or sym.is_test:
            col = 0
        elif is_upstream and not is_target:
            col = 1
        elif is_target or sym.symbol_type == SymbolType.SERVICE:
            col = 2
        else:
            col = 3

        x = col * 320 + 80
        y = col_counts[col] * 140 + 80
        col_counts[col] += 1

        nodes.append({
            "id": sym.id,
            "type": "customSymbolNode",
            "position": {"x": x, "y": y},
            "data": {
                "id": sym.id,
                "name": sym.name,
                "full_name": sym.full_name,
                "file_path": sym.file_path,
                "line_number": sym.line_number,
                "symbol_type": sym.symbol_type.value,
                "return_type": sym.return_type,
                "parameters": [p.model_dump() for p in sym.parameters],
                "http_method": sym.http_method,
                "http_route": sym.http_route,
                "is_db_operation": sym.is_db_operation,
                "is_test": sym.is_test,
                "is_target": is_target,
                "is_upstream": is_upstream,
                "is_downstream": is_downstream,
                "in_blast": in_blast,
            }
        })

    # Build edges
    edge_idx = 0
    for u, v, data in ckg.graph.edges(data=True):
        is_blast_edge = False
        if target_symbol:
            if (u in upstream_ids or u == target_symbol) and (v in upstream_ids or v == target_symbol or v in downstream_ids):
                is_blast_edge = True

        edges.append({
            "id": f"e_{edge_idx}_{u}_{v}",
            "source": u,
            "target": v,
            "animated": is_blast_edge,
            "style": {
                "stroke": "#ef4444" if is_blast_edge else "#475569",
                "strokeWidth": 2.5 if is_blast_edge else 1.5,
            },
            "data": {
                "raw_call": data.get("raw_call", ""),
                "line_number": data.get("line_number", 0),
                "is_blast_edge": is_blast_edge,
            }
        })
        edge_idx += 1

    return {
        "nodes": nodes,
        "edges": edges,
        "target_symbol": target_symbol,
        "total_nodes": len(nodes),
        "total_edges": len(edges)
    }

@app.post("/api/export-report")
def export_pr_report(req: ExportReportRequest):
    """Generates a GitHub-flavored Markdown Blast Radius Card ready for PR comments."""
    if not state["is_scanned"]:
        load_workspace(state["workspace_dir"])

    analyzer: BlastRadiusAnalyzer = state["analyzer"]
    report = analyzer.analyze_impact(req.symbol_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Symbol '{req.symbol_id}' not found.")

    severity_badge = {
        "CRITICAL": "🔴 **CRITICAL RISK**",
        "HIGH": "🟠 **HIGH RISK**",
        "MEDIUM": "🟡 **MEDIUM RISK**",
        "LOW": "🟢 **LOW RISK**",
    }.get(report.severity, report.severity)

    md = f"""### 🛡️ CodeImpact — Blast Radius & Dependency Impact Report

**Target Changed**: `{report.target_id}` (`{report.target_file}`)  
**Risk Score**: `{report.blast_score} / 100` — {severity_badge}

---

#### 📊 Impact Summary
| Metric | Count | Status |
| :--- | :--- | :--- |
| **Dependent Callers** | `{report.summary.total_dependents}` | Upstream functions that call this symbol |
| **Exposed HTTP Endpoints** | `{report.summary.controllers_count}` | Public API routes affected |
| **Database Operations** | `{report.summary.db_ops_count}` | State mutations / queries in chain |
| **Unit Test Coverage** | `{report.summary.tests_count}` | Tests executing this path |
| **Untested High-Risk Paths** | `{report.summary.untested_paths_count}` | Paths with 0 test coverage |

---

#### 🌐 Affected Public Endpoints
"""
    if report.affected_controllers:
        for c in report.affected_controllers:
            md += f"- `{c.http_method or 'ROUTE'}` **`{c.id}`** (`{c.file_path}:{c.line_number}`)\n"
    else:
        md += "_No external controllers or HTTP routes affected._\n"

    md += "\n#### 💾 Affected Database Operations\n"
    if report.affected_db_ops:
        for db in report.affected_db_ops:
            md += f"- **`{db.id}`** (`{db.file_path}:{db.line_number}`)\n"
    else:
        md += "_No direct database operations in call path._\n"

    if report.untested_paths:
        md += "\n> ⚠️ **Untested Danger Zone Alert**: The following affected callers lack unit tests:\n"
        for u in report.untested_paths:
            md += f"> - `{u}`\n"

    md += f"\n_Generated automatically by CodeImpact for PR: {req.pr_title}_"

    return {
        "symbol_id": req.symbol_id,
        "markdown": md
    }
