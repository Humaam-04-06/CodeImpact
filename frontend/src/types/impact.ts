export type SymbolType = "controller" | "service" | "repository" | "test" | "model" | "function";

export interface Parameter {
  name: string;
  type_annotation?: string;
  default_value?: string;
}

export interface CallSite {
  target_name: string;
  line_number: number;
  arguments_count: number;
  raw_call: string;
  caller_id?: string;
}

export interface SymbolNode {
  id: string;
  name: string;
  full_name: string;
  file_path: string;
  line_number: number;
  end_line_number: number;
  symbol_type: SymbolType;
  class_name?: string;
  namespace?: string;
  return_type?: string;
  parameters: Parameter[];
  decorators: string[];
  http_method?: string;
  http_route?: string;
  is_db_operation: boolean;
  is_test: boolean;
  source_code: string;
  calls: CallSite[];
}

export interface BreakingChange {
  call_site_file: string;
  call_site_line: number;
  caller_name: string;
  issue: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  recommended_fix?: string;
}

export interface ImpactSummary {
  total_dependents: number;
  controllers_count: number;
  db_ops_count: number;
  tests_count: number;
  breaking_changes_count: number;
  untested_paths_count: number;
}

export interface BlastReport {
  target_id: string;
  target_name: string;
  target_file: string;
  target_type: SymbolType;
  blast_score: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: ImpactSummary;
  affected_nodes: SymbolNode[];
  affected_controllers: SymbolNode[];
  affected_db_ops: SymbolNode[];
  affected_tests: SymbolNode[];
  breaking_changes: BreakingChange[];
  untested_paths: string[];
  propagation_tree: {
    id: string;
    name: string;
    type: string;
    file?: string;
    line?: number;
    children?: any[];
  };
}

export interface ProjectSample {
  id: string;
  name: string;
  language: string;
  path: string;
  description: string;
}

export interface GraphDataResponse {
  nodes: any[];
  edges: any[];
  target_symbol?: string;
  total_nodes: number;
  total_edges: number;
}
