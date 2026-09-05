import sys
from typing import Dict, List, Set, Any, Optional
import networkx as nx

from backend.engine.models import (
    SymbolNode, SymbolType, BlastReport, ImpactSummary, BreakingChange
)
from backend.engine.graph_builder import CodeKnowledgeGraph
from backend.engine.parser_engine import ASTParserEngine
from backend.engine.change_simulator import ChangeSimulator

class BlastRadiusAnalyzer:
    def __init__(self, ckg: CodeKnowledgeGraph):
        self.ckg = ckg
        self.simulator = ChangeSimulator(ckg)

    def analyze_impact(self, target_symbol_id: str) -> Optional[BlastReport]:
        """Calculates the blast radius and cascading impact of modifying a symbol."""
        target_sym = self.ckg.symbols_by_id.get(target_symbol_id)
        if not target_sym:
            return None

        # 1. Upstream Traversal: All callers that call target_sym (directly or transitively)
        upstream_ids = self.ckg.get_all_upstream_ancestors(target_symbol_id)
        
        # 2. Downstream Traversal: All dependencies target_sym calls (e.g. database operations)
        downstream_ids = self.ckg.get_all_downstream_descendants(target_symbol_id)

        # Categorize affected symbols
        affected_nodes: List[SymbolNode] = []
        affected_controllers: List[SymbolNode] = []
        affected_db_ops: List[SymbolNode] = []
        affected_tests: List[SymbolNode] = []

        # Upstream callers classification
        for sid in upstream_ids:
            sym = self.ckg.symbols_by_id.get(sid)
            if not sym:
                continue
            if sym.is_test or sym.symbol_type == SymbolType.TEST:
                affected_tests.append(sym)
            elif sym.symbol_type == SymbolType.CONTROLLER:
                affected_controllers.append(sym)
                affected_nodes.append(sym)
            else:
                affected_nodes.append(sym)

        # Downstream DB operations classification
        for sid in downstream_ids:
            sym = self.ckg.symbols_by_id.get(sid)
            if sym and (sym.is_db_operation or sym.symbol_type == SymbolType.REPOSITORY):
                if sym not in affected_db_ops:
                    affected_db_ops.append(sym)

        # Also check if target itself calls DB operations directly
        for sid in self.ckg.get_downstream_dependencies(target_symbol_id):
            sym = self.ckg.symbols_by_id.get(sid)
            if sym and (sym.is_db_operation or sym.symbol_type == SymbolType.REPOSITORY):
                if sym not in affected_db_ops:
                    affected_db_ops.append(sym)

        # 3. Untested Danger Zone Detection
        # Check which affected non-test upstream symbols lack direct or indirect test coverage
        untested_paths: List[str] = []
        all_tests = [s for s in self.ckg.symbols_by_id.values() if s.is_test or s.symbol_type == SymbolType.TEST]
        
        tested_symbol_ids: Set[str] = set()
        for t in all_tests:
            # Everything reachable downstream from a test is considered tested
            tested_symbol_ids.update(self.ckg.get_all_downstream_descendants(t.id))

        for node in affected_nodes:
            if node.id not in tested_symbol_ids and not node.is_test:
                untested_paths.append(f"{node.id} ({node.file_path}:{node.line_number})")

        # 4. Breaking Changes Detection (baseline check against current callers)
        breaking_changes = self.simulator.simulate_signature_change(
            target_symbol_id=target_symbol_id,
            new_parameters=target_sym.parameters
        )

        # 5. Blast Radius Score Calculation (0 to 100)
        # Factors:
        # - Upstream caller fan-out (max 35 pts)
        # - External API Controllers exposed (max 30 pts)
        # - Database Mutations/Queries involved (max 20 pts)
        # - Untested paths penalty (max 15 pts)
        fan_out_score = min(35, len(affected_nodes) * 5)
        controllers_score = min(30, len(affected_controllers) * 10)
        db_score = min(20, len(affected_db_ops) * 10)
        test_penalty = min(15, len(untested_paths) * 3)

        blast_score = min(100, fan_out_score + controllers_score + db_score + test_penalty)
        # Ensure minimum score of 10 if there are dependencies
        if (affected_nodes or affected_controllers) and blast_score < 15:
            blast_score = 15

        if blast_score >= 75:
            severity = "CRITICAL"
        elif blast_score >= 50:
            severity = "HIGH"
        elif blast_score >= 25:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        # 6. Build Hierarchical Propagation Tree (for UI ripple visualization)
        propagation_tree = self._build_propagation_tree(target_symbol_id, visited=set())

        summary = ImpactSummary(
            total_dependents=len(affected_nodes),
            controllers_count=len(affected_controllers),
            db_ops_count=len(affected_db_ops),
            tests_count=len(affected_tests),
            breaking_changes_count=len(breaking_changes),
            untested_paths_count=len(untested_paths),
        )

        return BlastReport(
            target_id=target_sym.id,
            target_name=target_sym.name,
            target_file=target_sym.file_path,
            target_type=target_sym.symbol_type,
            blast_score=blast_score,
            severity=severity,
            summary=summary,
            affected_nodes=affected_nodes,
            affected_controllers=affected_controllers,
            affected_db_ops=affected_db_ops,
            affected_tests=affected_tests,
            breaking_changes=breaking_changes,
            untested_paths=untested_paths,
            propagation_tree=propagation_tree,
        )

    def _build_propagation_tree(self, current_id: str, visited: Set[str], depth: int = 0) -> Dict[str, Any]:
        """Builds a recursive tree of upstream callers starting from the target."""
        sym = self.ckg.symbols_by_id.get(current_id)
        if not sym:
            return {"id": current_id, "name": current_id, "children": []}

        if current_id in visited or depth > 10:
            return {
                "id": sym.id,
                "name": sym.name,
                "type": sym.symbol_type.value,
                "file": sym.file_path,
                "cycle": True,
                "children": []
            }

        visited.add(current_id)
        direct_callers = self.ckg.get_upstream_callers(current_id)

        children = []
        for caller_id in sorted(direct_callers):
            child_tree = self._build_propagation_tree(caller_id, visited.copy(), depth + 1)
            children.append(child_tree)

        return {
            "id": sym.id,
            "name": sym.name,
            "type": sym.symbol_type.value,
            "file": sym.file_path,
            "line": sym.line_number,
            "children": children
        }


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    target_codebase = "sample_projects/csharp_ecommerce"
    target_fn = sys.argv[1] if len(sys.argv) > 1 else "UserService.GetUser"

    print(f"[*] Scanning codebase: {target_codebase}")
    parser = ASTParserEngine()
    symbols = parser.scan_directory(target_codebase)
    print(f"[+] Total symbols: {len(symbols)}")

    ckg = CodeKnowledgeGraph()
    ckg.build_from_symbols(symbols)
    print(f"[+] Call graph edges: {ckg.graph.number_of_edges()}")

    analyzer = BlastRadiusAnalyzer(ckg)
    print(f"[*] Analyzing blast radius for: {target_fn} ...\n")
    report = analyzer.analyze_impact(target_fn)

    if not report:
        print(f"[-] Symbol '{target_fn}' not found in graph!")
        sys.exit(1)

    print("=" * 60)
    print(f"  CODEIMPACT BLAST RADIUS REPORT: {report.target_id}")
    print("=" * 60)
    print(f"  Severity Level : [{report.severity}]")
    print(f"  Risk Score     : {report.blast_score} / 100")
    print("-" * 60)
    print(f"  [!] Dependent Functions : {report.summary.total_dependents}")
    print(f"  [!] HTTP Controllers    : {report.summary.controllers_count}")
    print(f"  [!] Database Operations : {report.summary.db_ops_count}")
    print(f"  [!] Unit Tests Covering : {report.summary.tests_count}")
    print(f"  [!] Breaking Changes   : {report.summary.breaking_changes_count}")
    print(f"  [!] Untested Paths     : {report.summary.untested_paths_count}")
    print("=" * 60)

    print("\n[Affected HTTP Controllers]")
    for c in report.affected_controllers:
        print(f"  - {c.id} ({c.http_method or 'ROUTE'} {c.file_path}:{c.line_number})")

    print("\n[Affected Database Operations]")
    for db in report.affected_db_ops:
        print(f"  - {db.id} ({db.file_path}:{db.line_number})")

    print("\n[Affected Services & Callers]")
    for node in report.affected_nodes:
        print(f"  - {node.id} ({node.symbol_type.value}) -> {node.file_path}")

    print("\n[Untested Danger Zone Callers]")
    for u in report.untested_paths:
        print(f"  * {u}")

    print("\n[Ripple Call Tree]")
    def print_tree(node, prefix=""):
        print(f"{prefix}+-- {node['id']} [{node['type']}]")
        for child in node.get("children", []):
            print_tree(child, prefix + "    ")
    print_tree(report.propagation_tree)

