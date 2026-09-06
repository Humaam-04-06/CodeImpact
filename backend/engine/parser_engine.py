import os
import re
import json
import shutil
import subprocess
import tempfile
from typing import List, Optional, Dict, Any, Tuple
from pathlib import Path

import tree_sitter_c_sharp as tscsharp
import tree_sitter_python as tspy
import tree_sitter_javascript as tsjs
import tree_sitter_typescript as tsts
from tree_sitter import Language, Parser, Node, Query, QueryCursor

from backend.engine.models import SymbolNode, SymbolType, Parameter, CallSite

NODE_EXECUTABLE = shutil.which("node")
JS_TS_PARSER_SCRIPT = os.path.join(os.path.dirname(__file__), "js_ts_ast_parser.js")


class ASTParserEngine:
    def __init__(self):
        # Initialize Tree-Sitter language parsers
        self.csharp_lang = Language(tscsharp.language())
        self.python_lang = Language(tspy.language())
        self.js_lang = Language(tsjs.language())
        self.ts_lang = Language(tsts.language_typescript())

        self.csharp_parser = Parser(self.csharp_lang)
        self.python_parser = Parser(self.python_lang)
        self.js_parser = Parser(self.js_lang)
        self.ts_parser = Parser(self.ts_lang)

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

        try:
            if ext == ".cs":
                return self._parse_csharp(content, rel_path)
            elif ext in [".ts", ".tsx", ".js", ".jsx"]:
                return self._parse_js_ts(file_path, content, rel_path, is_ts=ext in [".ts", ".tsx"])
            elif ext == ".py":
                return self._parse_python(content, rel_path)
        except Exception as e:
            print(f"[Parser Error] Parsing failed for {file_path}: {e}")
            return []

        return []

    # -------------------------------------------------------------------------
    # C# AST Parsing
    # -------------------------------------------------------------------------
    def _parse_csharp(self, content: str, rel_path: str) -> List[SymbolNode]:
        source_bytes = content.encode("utf-8")
        tree = self.csharp_parser.parse(source_bytes)
        symbols: List[SymbolNode] = []
        lines = content.splitlines()

        def get_text(node: Optional[Node]) -> str:
            if node is None:
                return ""
            return source_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="replace").strip()

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
                symbol = self._extract_csharp_method(node, source_bytes, lines, rel_path, current_ns, current_cls, class_attrs)
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
        source_bytes: bytes,
        lines: List[str],
        rel_path: str,
        namespace: str,
        class_name: str,
        class_attributes: List[str],
    ) -> Optional[SymbolNode]:
        def get_text(n: Optional[Node]) -> str:
            if n is None:
                return ""
            return source_bytes[n.start_byte:n.end_byte].decode("utf-8", errors="replace").strip()

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
            self._extract_csharp_calls(body_node, source_bytes, calls)

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

        id_prefix = f"{class_name}." if class_name else ""
        symbol_id = f"{id_prefix}{method_name}"
        full_name = f"{namespace}.{symbol_id}" if namespace else symbol_id

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

    def _extract_csharp_calls(self, root_node: Node, source_bytes: bytes, calls: List[CallSite]):
        def get_text(n: Optional[Node]) -> str:
            if n is None:
                return ""
            return source_bytes[n.start_byte:n.end_byte].decode("utf-8", errors="replace").strip()

        stack = [root_node]
        while stack:
            node = stack.pop()
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

            for child in reversed(node.children):
                stack.append(child)

    # -------------------------------------------------------------------------
    # TypeScript / JavaScript Parsing
    # -------------------------------------------------------------------------
    def _parse_js_ts(self, file_path: str, content: str, rel_path: str, is_ts: bool) -> List[SymbolNode]:
        """Parses JavaScript / TypeScript using native Node AST or safe fallback."""
        if NODE_EXECUTABLE and os.path.exists(JS_TS_PARSER_SCRIPT) and os.path.exists(file_path):
            try:
                proc = subprocess.run(
                    [NODE_EXECUTABLE, JS_TS_PARSER_SCRIPT, file_path],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=30
                )
                if proc.returncode == 0 and proc.stdout.strip():
                    items = json.loads(proc.stdout)
                    return self._build_js_ts_symbols(items, rel_path, is_ts)
            except Exception as err:
                print(f"[Parser Warning] Node AST parser fallback triggered for {rel_path}: {err}")

        # Safe in-process fallback using Tree-Sitter
        return self._parse_js_ts_fallback(content, rel_path, is_ts)

    def _build_js_ts_symbols(self, items: List[Dict[str, Any]], rel_path: str, is_ts: bool) -> List[SymbolNode]:
        symbols: List[SymbolNode] = []
        for item in items:
            class_name = item.get("class_name")
            fn_name = item.get("name")
            sym_id = item.get("id") or (f"{class_name}.{fn_name}" if class_name else fn_name)

            params = [
                Parameter(name=p["name"], type_annotation=p.get("type_annotation"))
                for p in item.get("parameters", [])
            ]
            calls = [
                CallSite(
                    target_name=c["target_name"],
                    line_number=c["line_number"],
                    arguments_count=c.get("arguments_count", 0),
                    raw_call=c.get("raw_call", ""),
                    caller_id=sym_id
                )
                for c in item.get("calls", [])
            ]

            st = SymbolType.SERVICE
            low_rel = rel_path.lower()
            if "controller" in low_rel or "Controller" in (class_name or ""):
                st = SymbolType.CONTROLLER
            elif "test" in low_rel or "spec" in low_rel or fn_name.startswith("test"):
                st = SymbolType.TEST
            elif "repo" in low_rel or "db" in low_rel:
                st = SymbolType.REPOSITORY

            symbols.append(
                SymbolNode(
                    id=sym_id,
                    name=fn_name,
                    full_name=sym_id,
                    file_path=rel_path,
                    line_number=item.get("line_number", 1),
                    end_line_number=item.get("end_line_number", 1),
                    symbol_type=st,
                    class_name=class_name,
                    parameters=params,
                    return_type=item.get("return_type"),
                    language="typescript" if is_ts else "javascript",
                    source_code=item.get("source_code", ""),
                    calls=calls
                )
            )
        return symbols

    def _parse_js_ts_fallback(self, content: str, rel_path: str, is_ts: bool) -> List[SymbolNode]:
        """Robust, crash-resilient in-process Tree-Sitter parser for JS/TS."""
        source_bytes = content.encode("utf-8")
        lines = content.splitlines()

        lang = self.ts_lang if is_ts else self.js_lang
        parser = Parser(lang)
        tree = parser.parse(source_bytes)

        combined_query = """
        (class_declaration name: (identifier) @cls_name) @cls
        (function_declaration name: (identifier) @fn_name) @fn
        (method_definition name: (property_identifier) @method_name) @method
        (call_expression
          function: [
            (identifier) @call_id
            (member_expression property: (property_identifier) @call_prop)
          ]
        ) @call
        """
        q = Query(lang, combined_query)
        qc = QueryCursor(q)
        matches = qc.matches(tree.root_node)

        classes = []
        functions = []
        calls = []

        for _, cap in matches:
            if "cls" in cap:
                cls_node = cap["cls"][0]
                name_node = cap["cls_name"][0]
                c_name = source_bytes[name_node.start_byte:name_node.end_byte].decode("utf-8", "replace").strip()
                classes.append({"name": c_name, "start": cls_node.start_byte, "end": cls_node.end_byte})
            elif "fn" in cap or "method" in cap:
                fn_node = cap.get("fn", cap.get("method"))[0]
                name_node = cap.get("fn_name", cap.get("method_name"))[0]
                fn_name = source_bytes[name_node.start_byte:name_node.end_byte].decode("utf-8", "replace").strip()
                functions.append({
                    "name": fn_name,
                    "start": fn_node.start_byte,
                    "end": fn_node.end_byte,
                    "start_row": fn_node.start_point.row,
                    "end_row": fn_node.end_point.row,
                })
            elif "call" in cap:
                call_node = cap["call"][0]
                target_node = cap.get("call_prop", cap.get("call_id"))[0]
                t_name = source_bytes[target_node.start_byte:target_node.end_byte].decode("utf-8", "replace").strip()
                if t_name and t_name not in ["log", "error", "warn", "then", "catch"]:
                    calls.append({
                        "name": t_name,
                        "start": call_node.start_byte,
                        "end": call_node.end_byte,
                        "row": call_node.start_point.row,
                        "raw": source_bytes[call_node.start_byte:min(call_node.end_byte, call_node.start_byte + 60)].decode("utf-8", "replace").strip()
                    })

        # Build items format to reuse _build_js_ts_symbols
        items = []
        for fn in functions:
            cls_name = ""
            for c in classes:
                if c["start"] <= fn["start"] and fn["end"] <= c["end"]:
                    cls_name = c["name"]
                    break
            fn_name = fn["name"]
            sym_id = f"{cls_name}.{fn_name}" if cls_name else fn_name
            fn_calls = [
                {
                    "target_name": c["name"],
                    "line_number": c["row"] + 1,
                    "arguments_count": 0,
                    "raw_call": c["raw"],
                    "caller_id": sym_id
                }
                for c in calls
                if fn["start"] <= c["start"] and c["end"] <= fn["end"]
            ]
            items.append({
                "id": sym_id,
                "name": fn_name,
                "class_name": cls_name or None,
                "line_number": fn["start_row"] + 1,
                "end_line_number": fn["end_row"] + 1,
                "parameters": [],
                "calls": fn_calls,
                "source_code": "\n".join(lines[fn["start_row"] : fn["end_row"] + 1])
            })

        return self._build_js_ts_symbols(items, rel_path, is_ts)

    # -------------------------------------------------------------------------
    # Python Parsing
    # -------------------------------------------------------------------------
    def _parse_python(self, content: str, rel_path: str) -> List[SymbolNode]:
        source_bytes = content.encode("utf-8")
        tree = self.python_parser.parse(source_bytes)
        symbols: List[SymbolNode] = []
        lines = content.splitlines()

        def get_text(n: Optional[Node]) -> str:
            if n is None:
                return ""
            return source_bytes[n.start_byte:n.end_byte].decode("utf-8", errors="replace").strip()

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
                    self._extract_python_calls(node, source_bytes, calls)
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

    def _extract_python_calls(self, root_node: Node, source_bytes: bytes, calls: List[CallSite]):
        def get_text(n: Optional[Node]) -> str:
            if n is None:
                return ""
            return source_bytes[n.start_byte:n.end_byte].decode("utf-8", errors="replace").strip()

        stack = [root_node]
        while stack:
            node = stack.pop()
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

            for child in reversed(node.children):
                stack.append(child)

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

        js_ts_files: List[Tuple[str, str]] = []  # (full_path, rel_path)
        other_files: List[str] = []

        for root, dirs, files in os.walk(directory_path):
            dirs[:] = [d for d in dirs if d not in ignored_dirs]
            for file in files:
                ext = Path(file).suffix.lower()
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, directory_path).replace("\\", "/")

                if ext in [".js", ".jsx", ".ts", ".tsx"]:
                    js_ts_files.append((full_path, rel_path))
                elif ext in [".cs", ".py"]:
                    other_files.append(full_path)

        # 1. Batch process JS/TS files if Node.js is available for blazing fast parsing
        if js_ts_files and NODE_EXECUTABLE and os.path.exists(JS_TS_PARSER_SCRIPT):
            try:
                manifest = [{"filePath": fp, "relPath": rp} for fp, rp in js_ts_files]
                with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json", encoding="utf-8") as tf:
                    json.dump(manifest, tf)
                    tf_path = tf.name

                proc = subprocess.run(
                    [NODE_EXECUTABLE, JS_TS_PARSER_SCRIPT, "--batch", tf_path],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=60
                )
                if os.path.exists(tf_path):
                    os.remove(tf_path)

                if proc.returncode == 0 and proc.stdout.strip():
                    batch_data = json.loads(proc.stdout)
                    for fp, rp in js_ts_files:
                        if rp in batch_data:
                            ext = Path(fp).suffix.lower()
                            is_ts = ext in [".ts", ".tsx"]
                            symbols = self._build_js_ts_symbols(batch_data[rp], rp, is_ts)
                            all_symbols.extend(symbols)
                    js_ts_files = []  # Successfully handled all
            except Exception as e:
                print(f"[Parser Warning] Batch JS/TS parser failed, falling back to individual file parsing: {e}")

        # 2. Process remaining JS/TS files individually if batch was skipped or partially failed
        for full_path, _ in js_ts_files:
            symbols = self.parse_file(full_path, base_dir=directory_path)
            all_symbols.extend(symbols)

        # 3. Process C# and Python files
        for full_path in other_files:
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
