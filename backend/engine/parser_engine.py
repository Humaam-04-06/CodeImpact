import os
import re
from typing import List, Optional, Dict, Any, Tuple
from pathlib import Path

import tree_sitter_c_sharp as tscsharp
import tree_sitter_python as tspy
import tree_sitter_javascript as tsjs
import tree_sitter_typescript as tsts
from tree_sitter import Language, Parser, Node

from backend.engine.models import SymbolNode, SymbolType, Parameter, CallSite

class ASTParserEngine:
    def __init__(self):
        # Initialize Tree-Sitter language parsers
        self.csharp_parser = Parser(Language(tscsharp.language()))
        self.python_parser = Parser(Language(tspy.language()))
        self.js_parser = Parser(Language(tsjs.language()))
        self.ts_parser = Parser(Language(tsts.language_typescript()))

    def parse_file(self, file_path: str, base_dir: str = "") -> List[SymbolNode]:
        """Parses a single source file and returns extracted symbols."""
        ext = Path(file_path).suffix.lower()
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
        except Exception as e:
            print(f"[Parser Error] Unable to read {file_path}: {e}")
            return []

        rel_path = os.path.relpath(file_path, base_dir) if base_dir else file_path
        rel_path = rel_path.replace("\\", "/")

        if ext == ".cs":
            return self._parse_csharp(content, rel_path)
        elif ext in [".ts", ".tsx"]:
            return self._parse_typescript(content, rel_path)
        elif ext in [".js", ".jsx"]:
            return self._parse_javascript(content, rel_path)
        elif ext == ".py":
            return self._parse_python(content, rel_path)
        return []

    # -------------------------------------------------------------------------
    # C# AST Parsing
    # -------------------------------------------------------------------------
    def _parse_csharp(self, content: str, rel_path: str) -> List[SymbolNode]:
        tree = self.csharp_parser.parse(content.encode("utf-8"))
        symbols: List[SymbolNode] = []
        lines = content.splitlines()

        def get_text(node: Optional[Node]) -> str:
            if node is None:
                return ""
            return node.text.decode("utf-8", errors="replace").strip()

        def walk(node: Node, current_ns: str = "", current_cls: str = "", class_attrs: Optional[List[str]] = None):
            if class_attrs is None:
                class_attrs = []

            # Namespace
            if node.type in ["namespace_declaration", "file_scoped_namespace_declaration"]:
                ns_name = ""
                name_node = node.child_by_field_name("name")
                if name_node:
                    ns_name = get_text(name_node)
                else:
                    for child in node.children:
                        if child.type in ["qualified_name", "identifier"]:
                            ns_name = get_text(child)
                            break
                for child in node.children:
                    walk(child, ns_name, current_cls, class_attrs)
                return

            # Class
            if node.type == "class_declaration":
                c_name = ""
                name_node = node.child_by_field_name("name")
                if name_node:
                    c_name = get_text(name_node)
                else:
                    for child in node.children:
                        if child.type == "identifier":
                            c_name = get_text(child)
                            break

                collected_attrs: List[str] = []
                for child in node.children:
                    if child.type == "attribute_list":
                        collected_attrs.append(get_text(child))

                for child in node.children:
                    walk(child, current_ns, c_name or current_cls, collected_attrs)
                return

            # Method
            if node.type == "method_declaration":
                symbol = self._extract_csharp_method(node, lines, rel_path, current_ns, current_cls, class_attrs)
                if symbol:
                    symbols.append(symbol)
                return

            # Generic child recursion
            for child in node.children:
                walk(child, current_ns, current_cls, class_attrs)

        walk(tree.root_node)
        return symbols

    def _extract_csharp_method(
        self,
        node: Node,
        lines: List[str],
        rel_path: str,
        namespace: str,
        class_name: str,
        class_attributes: List[str],
    ) -> Optional[SymbolNode]:
        def get_text(n: Optional[Node]) -> str:
            if n is None:
                return ""
            return n.text.decode("utf-8", errors="replace").strip()

        name_node = node.child_by_field_name("name")
        method_name = get_text(name_node)
        if not method_name:
            for child in node.children:
                if child.type == "identifier":
                    method_name = get_text(child)
                    name_node = child
                    break

        if not method_name:
            return None

        # Return type
        return_type = "void"
        for child in node.children:
            if child == name_node:
                break
            if child.type not in ["modifier", "attribute_list"]:
                return_type = get_text(child)

        # Parameters
        parameters: List[Parameter] = []
        p_list = node.child_by_field_name("parameters")
        if p_list:
            for p in p_list.children:
                if p.type == "parameter":
                    p_name_node = p.child_by_field_name("name")
                    p_type_node = p.child_by_field_name("type")
                    p_name = get_text(p_name_node)
                    p_type = get_text(p_type_node)
                    if p_name:
                        parameters.append(Parameter(name=p_name, type_annotation=p_type))

        # Attributes on the method
        decorators: List[str] = []
        for child in node.children:
            if child.type == "attribute_list":
                decorators.append(get_text(child))

        # Invocations / Calls inside method body
        calls: List[CallSite] = []
        body_node = node.child_by_field_name("body")
        if not body_node:
            for child in node.children:
                if child.type in ["block", "arrow_expression_clause"]:
                    body_node = child
                    break

        if body_node:
            self._extract_csharp_calls(body_node, calls)

        start_line = node.start_point.row + 1
        end_line = node.end_point.row + 1
        source_code = "\n".join(lines[start_line - 1 : end_line])

        # Symbol Classification
        all_decorators_str = " ".join(decorators + class_attributes)
        symbol_type = SymbolType.SERVICE
        http_method = None
        http_route = None
        is_db_op = False
        is_test = False

        # 1. Controller detection
        if "ApiController" in all_decorators_str or "Controller" in class_name or "Route" in all_decorators_str or "/Controllers/" in rel_path or "Controller.cs" in rel_path:
            symbol_type = SymbolType.CONTROLLER
            for m in ["HttpGet", "HttpPost", "HttpPut", "HttpDelete", "HttpPatch"]:
                if m in all_decorators_str:
                    http_method = m.replace("Http", "").upper()
                    match = re.search(rf'\[{m}\("?([^"\)]*)"?\)\]', all_decorators_str)
                    if match:
                        http_route = match.group(1)
                    break
            if not http_method:
                # Default controller endpoint if not annotated
                http_method = "GET" if "Get" in method_name else "POST"

        # 2. Test detection
        elif "Fact" in all_decorators_str or "Test" in all_decorators_str or "Tests" in class_name or "/Tests/" in rel_path or "Tests.cs" in rel_path:
            symbol_type = SymbolType.TEST
            is_test = True

        # 3. Database operation detection
        is_repository_class = "Repository" in class_name or "DbContext" in class_name or "/Repositories/" in rel_path
        has_db_queries = any(kw in source_code for kw in ["SELECT ", "UPDATE ", "INSERT ", "DELETE ", "FindByIdAsync", "UpdateLastLoginAsync", "SaveChangesAsync"])
        
        if is_repository_class:
            symbol_type = SymbolType.REPOSITORY
            is_db_op = True
        elif has_db_queries or any(c.target_name in ["FindByIdAsync", "UpdateLastLoginAsync", "SaveChangesAsync", "ExecuteSqlAsync"] for c in calls):
            is_db_op = True


        # Construct unique ID
        id_prefix = f"{class_name}." if class_name else ""
        symbol_id = f"{id_prefix}{method_name}"
        full_name = f"{namespace}.{symbol_id}" if namespace else symbol_id

        # Attach caller_id to all calls
        for c in calls:
            c.caller_id = symbol_id

        return SymbolNode(
            id=symbol_id,
            name=method_name,
            full_name=full_name,
            file_path=rel_path,
            line_number=start_line,
            end_line_number=end_line,
            symbol_type=symbol_type,
            class_name=class_name,
            namespace=namespace,
            return_type=return_type,
            parameters=parameters,
            decorators=decorators,
            http_method=http_method,
            http_route=http_route,
            is_db_operation=is_db_op,
            is_test=is_test,
            language="csharp",
            source_code=source_code,
            calls=calls,
        )

    def _extract_csharp_calls(self, node: Node, calls: List[CallSite]):
        def get_text(n: Optional[Node]) -> str:
            if n is None:
                return ""
            return n.text.decode("utf-8", errors="replace").strip()

        if node.type == "invocation_expression":
            target_name = ""
            args_count = 0
            func = node.child_by_field_name("function")
            args = node.child_by_field_name("arguments")

            if func:
                if func.type == "member_access_expression":
                    name_node = func.child_by_field_name("name")
                    target_name = get_text(name_node)
                else:
                    target_name = get_text(func)
            else:
                for child in node.children:
                    if child.type == "member_access_expression":
                        target_name = get_text(child.child_by_field_name("name"))
                    elif child.type == "identifier":
                        target_name = get_text(child)

            if args:
                args_count = sum(1 for c in args.children if c.type == "argument")

            if target_name and target_name not in ["Delay", "NewGuid", "ToString", "Substring", "Assert", "NotNull", "Equal", "IsNullOrEmpty", "nameof"]:
                calls.append(
                    CallSite(
                        target_name=target_name,
                        line_number=node.start_point.row + 1,
                        arguments_count=args_count,
                        raw_call=get_text(node)[:60],
                    )
                )

        for child in node.children:
            self._extract_csharp_calls(child, calls)

    # -------------------------------------------------------------------------
    # TypeScript / JavaScript Parsing
    # -------------------------------------------------------------------------
    def _parse_typescript(self, content: str, rel_path: str) -> List[SymbolNode]:
        tree = self.ts_parser.parse(content.encode("utf-8"))
        return self._extract_js_ts_symbols(tree.root_node, content, rel_path)

    def _parse_javascript(self, content: str, rel_path: str) -> List[SymbolNode]:
        tree = self.js_parser.parse(content.encode("utf-8"))
        return self._extract_js_ts_symbols(tree.root_node, content, rel_path)

    def _extract_js_ts_symbols(self, root: Node, content: str, rel_path: str) -> List[SymbolNode]:
        symbols: List[SymbolNode] = []
        lines = content.splitlines()

        def get_text(n: Optional[Node]) -> str:
            if n is None:
                return ""
            return n.text.decode("utf-8", errors="replace").strip()

        def walk(node: Node, class_name: str = ""):
            if node.type == "class_declaration":
                c_name = get_text(node.child_by_field_name("name"))
                for child in node.children:
                    walk(child, c_name or class_name)
                return

            if node.type in ["method_definition", "function_declaration"]:
                name_node = node.child_by_field_name("name")
                fn_name = get_text(name_node)
                parameters: List[Parameter] = []
                p_list = node.child_by_field_name("parameters")
                if p_list:
                    for p in p_list.children:
                        if p.type in ["identifier", "required_parameter"]:
                            p_name = get_text(p).split(":")[0].strip()
                            parameters.append(Parameter(name=p_name))

                if fn_name:
                    calls: List[CallSite] = []
                    self._extract_js_calls(node, calls)
                    start_line = node.start_point.row + 1
                    end_line = node.end_point.row + 1
                    symbol_id = f"{class_name}.{fn_name}" if class_name else fn_name

                    for c in calls:
                        c.caller_id = symbol_id

                    st = SymbolType.SERVICE
                    if "controller" in rel_path.lower() or "Controller" in class_name:
                        st = SymbolType.CONTROLLER
                    elif "test" in rel_path.lower() or "spec" in rel_path.lower():
                        st = SymbolType.TEST
                    elif "repo" in rel_path.lower() or "db" in rel_path.lower():
                        st = SymbolType.REPOSITORY

                    symbols.append(
                        SymbolNode(
                            id=symbol_id,
                            name=fn_name,
                            full_name=symbol_id,
                            file_path=rel_path,
                            line_number=start_line,
                            end_line_number=end_line,
                            symbol_type=st,
                            class_name=class_name,
                            parameters=parameters,
                            language="typescript" if rel_path.endswith((".ts", ".tsx")) else "javascript",
                            source_code="\n".join(lines[start_line - 1 : end_line]),
                            calls=calls,
                        )
                    )
                return

            for child in node.children:
                walk(child, class_name)

        walk(root)
        return symbols

    def _extract_js_calls(self, node: Node, calls: List[CallSite]):
        def get_text(n: Optional[Node]) -> str:
            if n is None:
                return ""
            return n.text.decode("utf-8", errors="replace").strip()

        if node.type == "call_expression":
            target_name = ""
            args_count = 0
            func = node.child_by_field_name("function")
            args = node.child_by_field_name("arguments")

            if func:
                if func.type == "member_expression":
                    prop = func.child_by_field_name("property")
                    target_name = get_text(prop)
                else:
                    target_name = get_text(func)

            if args:
                args_count = sum(1 for c in args.children if c.type not in ["(", ")", ","])

            if target_name and target_name not in ["log", "error", "then", "catch"]:
                calls.append(
                    CallSite(
                        target_name=target_name,
                        line_number=node.start_point.row + 1,
                        arguments_count=args_count,
                        raw_call=get_text(node)[:60],
                    )
                )

        for child in node.children:
            self._extract_js_calls(child, calls)

    # -------------------------------------------------------------------------
    # Python Parsing
    # -------------------------------------------------------------------------
    def _parse_python(self, content: str, rel_path: str) -> List[SymbolNode]:
        tree = self.python_parser.parse(content.encode("utf-8"))
        symbols: List[SymbolNode] = []
        lines = content.splitlines()

        def get_text(n: Optional[Node]) -> str:
            if n is None:
                return ""
            return n.text.decode("utf-8", errors="replace").strip()

        def walk(node: Node, class_name: str = ""):
            if node.type == "class_definition":
                c_name = get_text(node.child_by_field_name("name"))
                for child in node.children:
                    walk(child, c_name or class_name)
                return

            if node.type == "function_definition":
                name_node = node.child_by_field_name("name")
                fn_name = get_text(name_node)
                parameters: List[Parameter] = []
                p_list = node.child_by_field_name("parameters")
                if p_list:
                    for p in p_list.children:
                        if p.type in ["identifier", "typed_parameter", "default_parameter"]:
                            p_text = get_text(p).split(":")[0].split("=")[0].strip()
                            if p_text and p_text not in ["self", "cls"]:
                                parameters.append(Parameter(name=p_text))

                if fn_name:
                    calls: List[CallSite] = []
                    self._extract_python_calls(node, calls)
                    start_line = node.start_point.row + 1
                    end_line = node.end_point.row + 1
                    symbol_id = f"{class_name}.{fn_name}" if class_name else fn_name

                    for c in calls:
                        c.caller_id = symbol_id

                    st = SymbolType.SERVICE
                    if "controller" in rel_path.lower() or "router" in rel_path.lower():
                        st = SymbolType.CONTROLLER
                    elif "test" in rel_path.lower() or fn_name.startswith("test_"):
                        st = SymbolType.TEST
                    elif "repo" in rel_path.lower() or "db" in rel_path.lower():
                        st = SymbolType.REPOSITORY

                    symbols.append(
                        SymbolNode(
                            id=symbol_id,
                            name=fn_name,
                            full_name=symbol_id,
                            file_path=rel_path,
                            line_number=start_line,
                            end_line_number=end_line,
                            symbol_type=st,
                            class_name=class_name,
                            parameters=parameters,
                            language="python",
                            source_code="\n".join(lines[start_line - 1 : end_line]),
                            calls=calls,
                        )
                    )
                return

            for child in node.children:
                walk(child, class_name)

        walk(tree.root_node)
        return symbols

    def _extract_python_calls(self, node: Node, calls: List[CallSite]):
        def get_text(n: Optional[Node]) -> str:
            if n is None:
                return ""
            return n.text.decode("utf-8", errors="replace").strip()

        if node.type == "call":
            target_name = ""
            args_count = 0
            func = node.child_by_field_name("function")
            args = node.child_by_field_name("arguments")

            if func:
                if func.type == "attribute":
                    target_name = get_text(func.child_by_field_name("attribute"))
                else:
                    target_name = get_text(func)

            if args:
                args_count = sum(1 for c in args.children if c.type not in ["(", ")", ","])

            if target_name and target_name not in ["print", "len", "range", "str", "int"]:
                calls.append(
                    CallSite(
                        target_name=target_name,
                        line_number=node.start_point.row + 1,
                        arguments_count=args_count,
                        raw_call=get_text(node)[:60],
                    )
                )

        for child in node.children:
            self._extract_python_calls(child, calls)

    # -------------------------------------------------------------------------
    # Directory Scanning
    # -------------------------------------------------------------------------
    def scan_directory(self, directory_path: str) -> List[SymbolNode]:
        """Recursively parses all supported source files in a directory."""
        all_symbols: List[SymbolNode] = []
        ignored_dirs = {
            "node_modules", ".git", "venv", ".venv", "env",
            "bin", "obj", "dist", "build", "__pycache__", ".idea", ".vscode"
        }

        for root, dirs, files in os.walk(directory_path):
            dirs[:] = [d for d in dirs if d not in ignored_dirs]
            for file in files:
                ext = Path(file).suffix.lower()
                if ext in [".cs", ".ts", ".tsx", ".js", ".jsx", ".py"]:
                    full_path = os.path.join(root, file)
                    symbols = self.parse_file(full_path, base_dir=directory_path)
                    all_symbols.extend(symbols)

        return all_symbols


if __name__ == "__main__":
    import sys
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "sample_projects/csharp_ecommerce"
    print(f"[*] Scanning codebase: {target_dir}")
    engine = ASTParserEngine()
    symbols = engine.scan_directory(target_dir)
    print(f"[+] Total symbols extracted: {len(symbols)}\n")
    print(f"{'TYPE':<12} | {'SYMBOL ID':<35} | {'FILE':<35} | {'CALLS'}")
    print("-" * 110)
    for s in symbols:
        calls_str = ", ".join([c.target_name for c in s.calls]) if s.calls else "none"
        print(f"{s.symbol_type.value:<12} | {s.id:<35} | {s.file_path:<35} | {calls_str}")
