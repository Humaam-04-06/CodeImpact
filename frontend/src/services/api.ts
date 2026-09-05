import type {
  SymbolNode,
  BlastReport,
  BreakingChange,
  ProjectSample,
  GraphDataResponse,
  Parameter
} from "../types/impact";

const API_BASE = ""; // Vite proxy forwards /api to http://127.0.0.1:8000

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Backend offline");
  return res.json();
}

export async function fetchSamples(): Promise<ProjectSample[]> {
  const res = await fetch(`${API_BASE}/api/samples`);
  if (!res.ok) throw new Error("Failed to load sample projects");
  return res.json();
}

export async function scanWorkspace(workspacePath: string): Promise<{
  workspace: string;
  total_symbols: number;
  total_edges: number;
  symbols: SymbolNode[];
}> {
  try {
    const res = await fetch(`${API_BASE}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_path: workspacePath }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || `Scan failed with HTTP status ${res.status}`);
    }
    return res.json();
  } catch (err: any) {
    if (err.message && err.message.includes("Failed to fetch")) {
      throw new Error(
        "Cannot connect to CodeImpact backend on port 8000. Please start the backend server: backend\\venv\\Scripts\\python -m uvicorn backend.main:app --port 8000"
      );
    }
    throw err;
  }
}

export async function fetchSymbols(): Promise<{
  workspace: string;
  count: number;
  symbols: SymbolNode[];
}> {
  const res = await fetch(`${API_BASE}/api/symbols`);
  if (!res.ok) throw new Error("Failed to load symbols");
  return res.json();
}

export async function calculateImpact(symbolId: string): Promise<BlastReport> {
  const res = await fetch(`${API_BASE}/api/impact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol_id: symbolId }),
  });
  if (!res.ok) throw new Error(`Failed to calculate impact for ${symbolId}`);
  return res.json();
}

export async function simulateSignatureChange(
  symbolId: string,
  parameters: Parameter[],
  returnType?: string
): Promise<{
  symbol_id: string;
  breaking_changes_count: number;
  breaking_changes: BreakingChange[];
}> {
  const res = await fetch(`${API_BASE}/api/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol_id: symbolId,
      parameters,
      return_type: returnType,
    }),
  });
  if (!res.ok) throw new Error("Simulation failed");
  return res.json();
}

export async function fetchGraphData(targetSymbol?: string): Promise<GraphDataResponse> {
  const url = targetSymbol
    ? `${API_BASE}/api/graph-data?target_symbol=${encodeURIComponent(targetSymbol)}`
    : `${API_BASE}/api/graph-data`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load graph data");
  return res.json();
}

export async function exportPRReport(symbolId: string, prTitle?: string): Promise<{
  symbol_id: string;
  markdown: string;
}> {
  const res = await fetch(`${API_BASE}/api/export-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol_id: symbolId,
      pr_title: prTitle || "Feature / Refactor Update",
    }),
  });
  if (!res.ok) throw new Error("Failed to export report");
  return res.json();
}

export async function uploadProjectZip(
  file: File,
  projectName?: string
): Promise<{
  success: boolean;
  sample: ProjectSample;
  workspace: string;
  total_symbols: number;
  total_edges: number;
  symbols: SymbolNode[];
}> {
  const formData = new FormData();
  formData.append("file", file);
  if (projectName) {
    formData.append("project_name", projectName);
  }

  try {
    const res = await fetch(`${API_BASE}/api/upload-project`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to analyze project archive (HTTP ${res.status})`);
    }

    return res.json();
  } catch (err: any) {
    if (err.message && err.message.includes("Failed to fetch")) {
      throw new Error(
        "Cannot connect to CodeImpact backend on port 8000. Please start the backend server: backend\\venv\\Scripts\\python -m uvicorn backend.main:app --port 8000"
      );
    }
    throw err;
  }
}

