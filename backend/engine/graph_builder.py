from typing import List, Dict, Optional, Tuple, Set
import networkx as nx

from backend.engine.models import SymbolNode, SymbolType, CallSite

class CodeKnowledgeGraph:
    def __init__(self):
        # Directed multi-graph: edge (u, v) means u CALLS v
        self.graph = nx.DiGraph()
        self.symbols_by_id: Dict[str, SymbolNode] = {}
        self.symbols_by_name: Dict[str, List[SymbolNode]] = {}

    def build_from_symbols(self, symbols: List[SymbolNode]):
        """Constructs the directed call graph from a list of extracted symbols."""
        self.graph.clear()
        self.symbols_by_id.clear()
        self.symbols_by_name.clear()

        # 1. Register all nodes
        for sym in symbols:
            self.symbols_by_id[sym.id] = sym
            if sym.name not in self.symbols_by_name:
                self.symbols_by_name[sym.name] = []
            self.symbols_by_name[sym.name].append(sym)

            self.graph.add_node(
                sym.id,
                name=sym.name,
                full_name=sym.full_name,
                file_path=sym.file_path,
                line_number=sym.line_number,
                symbol_type=sym.symbol_type.value,
                is_db_operation=sym.is_db_operation,
                is_test=sym.is_test,
                http_method=sym.http_method,
                http_route=sym.http_route,
                parameters=[p.model_dump() for p in sym.parameters],
                return_type=sym.return_type,
            )

        # 2. Resolve call sites to target symbols and add directed edges (caller -> callee)
        for sym in symbols:
            for call in sym.calls:
                target_sym = self._resolve_target(call.target_name, sym)
                if target_sym:
                    self.graph.add_edge(
                        sym.id,
                        target_sym.id,
                        line_number=call.line_number,
                        arguments_count=call.arguments_count,
                        raw_call=call.raw_call,
                    )

    def _resolve_target(self, call_target_name: str, caller_sym: SymbolNode) -> Optional[SymbolNode]:
        """Resolves an invocation target name to a SymbolNode in the graph."""
        # Clean target name (e.g. _userRepository.FindByIdAsync -> FindByIdAsync)
        cleaned_target = call_target_name.split(".")[-1].strip()

        # 1. Exact ID match (e.g. "UserService.GetUser")
        if call_target_name in self.symbols_by_id:
            return self.symbols_by_id[call_target_name]

        # 2. Direct name match
        candidates = self.symbols_by_name.get(cleaned_target, [])
        if not candidates:
            return None

        if len(candidates) == 1:
            return candidates[0]

        # 3. Disambiguation: Prefer candidate in the same file or class
        for c in candidates:
            if c.file_path == caller_sym.file_path:
                return c

        # 4. Disambiguation: Check variable/field prefix matching
        if "." in call_target_name:
            prefix = call_target_name.split(".")[0].lower().lstrip("_")
            for c in candidates:
                if c.class_name and prefix in c.class_name.lower():
                    return c

        return candidates[0]

    def get_upstream_callers(self, symbol_id: str) -> Set[str]:
        """Returns all direct callers of symbol_id (who calls this symbol?)."""
        if symbol_id not in self.graph:
            return set()
        return set(self.graph.predecessors(symbol_id))

    def get_downstream_dependencies(self, symbol_id: str) -> Set[str]:
        """Returns all direct dependencies of symbol_id (what does this symbol call?)."""
        if symbol_id not in self.graph:
            return set()
        return set(self.graph.successors(symbol_id))

    def get_all_upstream_ancestors(self, symbol_id: str) -> Set[str]:
        """Recursively finds all upstream callers (transitive closure of callers)."""
        if symbol_id not in self.graph:
            return set()
        # In NetworkX: predecessors are callers. Reverse graph to find reachable callers.
        rev_graph = self.graph.reverse()
        ancestors = set(nx.descendants(rev_graph, symbol_id))
        return ancestors

    def get_all_downstream_descendants(self, symbol_id: str) -> Set[str]:
        """Recursively finds all downstream dependencies (what this symbol transitively calls)."""
        if symbol_id not in self.graph:
            return set()
        return set(nx.descendants(self.graph, symbol_id))
