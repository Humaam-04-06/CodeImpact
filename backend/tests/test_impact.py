"""
Comprehensive Automated Test Suite for CodeImpact Engine.
Covers:
- Multi-language AST parsing (C#, TypeScript, Python)
- Code Knowledge Graph construction, cross-file resolution & cycle resilience
- Exact blast radius calculation, severity classification & untested danger zones
- What-If signature change simulation & breaking change diagnostics
- GitHub PR Blast Radius Card report generation
"""

import pytest
import networkx as nx
from backend.engine.models import SymbolNode, SymbolType, Parameter, CallSite
from backend.engine.parser_engine import ASTParserEngine
from backend.engine.graph_builder import CodeKnowledgeGraph
from backend.engine.impact_analyzer import BlastRadiusAnalyzer
from backend.engine.change_simulator import ChangeSimulator
from backend.main import generate_pr_markdown

# =============================================================================
# 1. Multi-Language AST Parser Tests
# =============================================================================

def test_csharp_parser_accuracy():
    """Verify C# parsing extracts exact symbols, parameters, and roles."""
    parser = ASTParserEngine()
    symbols = parser.scan_directory("sample_projects/csharp_ecommerce")
    
    # 11 total symbols expected in the e-commerce scenario
    assert len(symbols) == 11
    
    sym_map = {s.id: s for s in symbols}
    
    # Target: UserService.GetUser
    assert "UserService.GetUser" in sym_map
    get_user = sym_map["UserService.GetUser"]
    assert get_user.symbol_type == SymbolType.SERVICE
    assert get_user.language == "csharp"
    assert get_user.return_type == "Task<UserRecord>"
    assert len(get_user.parameters) == 1
    assert get_user.parameters[0].name == "userId"
    assert get_user.parameters[0].type_annotation == "string"
    
    # Verify Controllers
    controllers = [s for s in symbols if s.symbol_type == SymbolType.CONTROLLER]
    assert len(controllers) == 3
    controller_ids = {c.id for c in controllers}
    assert "AuthController.Login" in controller_ids
    assert "OrderController.Checkout" in controller_ids
    assert "UserController.GetProfile" in controller_ids
    
    # Verify DB Repositories
    db_ops = [s for s in symbols if s.symbol_type == SymbolType.REPOSITORY]
    assert len(db_ops) == 2
    db_ids = {d.id for d in db_ops}
    assert "UserRepository.FindByIdAsync" in db_ids
    assert "UserRepository.UpdateLastLoginAsync" in db_ids
    
    # Verify Unit Tests
    tests = [s for s in symbols if s.symbol_type == SymbolType.TEST]
    assert len(tests) == 1
    assert tests[0].id == "UserServiceTests.GetUser_ReturnsValidUser_WhenUserExists"


def test_typescript_parser_accuracy():
    """Verify TypeScript parsing extracts symbols, parameters, and calls."""
    parser = ASTParserEngine()
    symbols = parser.scan_directory("sample_projects/ts_saas_api")
    
    assert len(symbols) >= 4
    sym_map = {s.id: s for s in symbols}
    
    # Verify SubscriptionService.cancelSubscription
    assert "SubscriptionService.cancelSubscription" in sym_map
    cancel_fn = sym_map["SubscriptionService.cancelSubscription"]
    assert cancel_fn.language in ("typescript", "javascript")
    assert any(p.name == "subscriptionId" for p in cancel_fn.parameters)


def test_python_parser_accuracy():
    """Verify Python parsing extracts functions, parameters, and roles."""
    parser = ASTParserEngine()
    symbols = parser.scan_directory("sample_projects/python_ai_service")
    
    assert len(symbols) == 8
    sym_map = {s.id: s for s in symbols}
    
    assert "ModelService.predict_sentiment" in sym_map
    predict_fn = sym_map["ModelService.predict_sentiment"]
    assert predict_fn.language == "python"
    assert len(predict_fn.parameters) >= 1
    assert predict_fn.parameters[0].name == "text"
    
    assert "test_predict_sentiment" in sym_map
    test_fn = sym_map["test_predict_sentiment"]
    assert test_fn.symbol_type == SymbolType.TEST


# =============================================================================
# 2. Code Knowledge Graph & Graph Theory Tests
# =============================================================================

def test_graph_construction_and_cross_file_resolution():
    """Verify directed edge creation and cross-file method call linkage."""
    parser = ASTParserEngine()
    symbols = parser.scan_directory("sample_projects/csharp_ecommerce")
    
    ckg = CodeKnowledgeGraph()
    ckg.build_from_symbols(symbols)
    
    assert ckg.graph.number_of_nodes() == 11
    assert ckg.graph.number_of_edges() >= 9
    
    # UserService.GetUser should be called by OrderService.CreateOrder, etc.
    caller_ids = ckg.get_upstream_callers("UserService.GetUser")
    assert "OrderService.CreateOrder" in caller_ids
    assert "OrderService.GetUserOrderHistory" in caller_ids
    assert "AuthController.Login" in caller_ids
    assert "UserController.GetProfile" in caller_ids
    
    # UserService.GetUser should call UserRepository.FindByIdAsync
    callee_ids = ckg.get_downstream_dependencies("UserService.GetUser")
    assert "UserRepository.FindByIdAsync" in callee_ids


def test_graph_cycles_resilience():
    """Verify graph traversal handles circular dependencies without infinite loops."""
    # Synthetic circular call setup: A -> B -> C -> A
    sym_a = SymbolNode(
        id="FuncA", name="FuncA", full_name="A.FuncA", file_path="A.cs",
        line_number=1, end_line_number=5, symbol_type=SymbolType.SERVICE,
        calls=[CallSite(target_name="FuncB", line_number=10)]
    )
    sym_b = SymbolNode(
        id="FuncB", name="FuncB", full_name="B.FuncB", file_path="B.cs",
        line_number=1, end_line_number=5, symbol_type=SymbolType.SERVICE,
        calls=[CallSite(target_name="FuncC", line_number=20)]
    )
    sym_c = SymbolNode(
        id="FuncC", name="FuncC", full_name="C.FuncC", file_path="C.cs",
        line_number=1, end_line_number=5, symbol_type=SymbolType.SERVICE,
        calls=[CallSite(target_name="FuncA", line_number=30)]
    )
    
    ckg = CodeKnowledgeGraph()
    ckg.build_from_symbols([sym_a, sym_b, sym_c])
    
    # Reachability must terminate without RecursionError
    ancestors = ckg.get_all_upstream_ancestors("FuncA")
    assert len(ancestors) == 2  # FuncB and FuncC
    
    descendants = ckg.get_all_downstream_descendants("FuncA")
    assert len(descendants) == 2


def test_disconnected_components():
    """Verify isolated functions do not falsely appear in blast radius."""
    sym_target = SymbolNode(
        id="TargetService.Execute", name="Execute", full_name="Target.Execute", file_path="Target.cs",
        line_number=1, end_line_number=10, symbol_type=SymbolType.SERVICE, calls=[]
    )
    sym_isolated = SymbolNode(
        id="Helper.FormatDate", name="FormatDate", full_name="Helper.FormatDate", file_path="Helper.cs",
        line_number=1, end_line_number=10, symbol_type=SymbolType.FUNCTION, calls=[]
    )
    
    ckg = CodeKnowledgeGraph()
    ckg.build_from_symbols([sym_target, sym_isolated])
    
    analyzer = BlastRadiusAnalyzer(ckg)
    report = analyzer.analyze_impact("TargetService.Execute")
    
    assert report.summary.total_dependents == 0
    assert "Helper.FormatDate" not in [d.id for d in report.affected_nodes]


# =============================================================================
# 3. Blast Radius & Impact Calculation Tests
# =============================================================================

def test_user_service_get_user_exact_metrics():
    """
    Verify prompt target scenario for UserService.GetUser:
    - 7 dependent functions
    - 3 controllers
    - 2 database operations
    - 1 unit test
    - Untested danger zones identified
    - Blast score > 50 (Critical / High severity)
    """
    parser = ASTParserEngine()
    symbols = parser.scan_directory("sample_projects/csharp_ecommerce")
    
    ckg = CodeKnowledgeGraph()
    ckg.build_from_symbols(symbols)
    
    analyzer = BlastRadiusAnalyzer(ckg)
    report = analyzer.analyze_impact("UserService.GetUser")
    
    # 7 dependent callers total (direct + cascading transitive callers)
    assert report.summary.total_dependents == 7
    
    # 3 controllers reachable
    assert report.summary.controllers_count == 3
    
    # 2 database operations reachable downstream
    assert report.summary.db_ops_count == 2
    
    # 1 unit test covering it
    assert report.summary.tests_count == 1
    
    # Risk score and severity
    assert report.blast_score > 50
    assert report.severity in ("CRITICAL", "HIGH")
    
    # Untested danger zones (dependents without unit tests)
    assert report.summary.untested_paths_count >= 5
    assert len(report.untested_paths) >= 5


# =============================================================================
# 4. What-If Change Simulation Tests
# =============================================================================

def test_change_simulation_add_required_parameter():
    """Verify adding a required parameter flags all non-test callers as breaking."""
    parser = ASTParserEngine()
    symbols = parser.scan_directory("sample_projects/csharp_ecommerce")
    
    ckg = CodeKnowledgeGraph()
    ckg.build_from_symbols(symbols)
    
    simulator = ChangeSimulator(ckg)
    
    # Simulate adding required parameter 'includeHistory: bool'
    modified_params = [
        Parameter(name="userId", type_annotation="string", default_value=None),
        Parameter(name="includeHistory", type_annotation="bool", default_value=None)
    ]
    
    breaking = simulator.simulate_signature_change(
        target_symbol_id="UserService.GetUser",
        new_parameters=modified_params
    )
    
    # 6 callers pass only 1 argument, thus missing required argument
    assert len(breaking) == 6
    for b in breaking:
        assert "argument" in b.issue.lower() or "parameter" in b.issue.lower()
        assert b.severity == "CRITICAL"


def test_change_simulation_optional_parameter_no_breaking():
    """Verify adding an optional parameter does NOT break existing callers."""
    parser = ASTParserEngine()
    symbols = parser.scan_directory("sample_projects/csharp_ecommerce")
    
    ckg = CodeKnowledgeGraph()
    ckg.build_from_symbols(symbols)
    
    simulator = ChangeSimulator(ckg)
    
    # Optional parameter with default value
    modified_params = [
        Parameter(name="userId", type_annotation="string", default_value=None),
        Parameter(name="includeHistory", type_annotation="bool", default_value="false")
    ]
    
    breaking = simulator.simulate_signature_change(
        target_symbol_id="UserService.GetUser",
        new_parameters=modified_params
    )
    
    # Zero breaking changes because new parameter has default value
    assert len(breaking) == 0


def test_change_simulation_return_type_mismatch():
    """Verify changing return type flags downstream breaking changes."""
    parser = ASTParserEngine()
    symbols = parser.scan_directory("sample_projects/csharp_ecommerce")
    
    ckg = CodeKnowledgeGraph()
    ckg.build_from_symbols(symbols)
    
    simulator = ChangeSimulator(ckg)
    
    # Original return type: Task<User> -> New: Task<UserSummaryDto>
    original_params = [
        Parameter(name="userId", type_annotation="string", default_value=None)
    ]
    
    breaking = simulator.simulate_signature_change(
        target_symbol_id="UserService.GetUser",
        new_parameters=original_params,
        new_return_type="Task<UserSummaryDto>"
    )
    
    assert len(breaking) >= 1
    assert any("return type" in b.issue.lower() for b in breaking)


# =============================================================================
# 5. GitHub PR Blast Radius Card & Report Generation Tests
# =============================================================================

def test_markdown_report_formatting():
    """Verify PR report generates compliant GitHub Markdown with badges and tables."""
    parser = ASTParserEngine()
    symbols = parser.scan_directory("sample_projects/csharp_ecommerce")
    ckg = CodeKnowledgeGraph()
    ckg.build_from_symbols(symbols)
    analyzer = BlastRadiusAnalyzer(ckg)
    report = analyzer.analyze_impact("UserService.GetUser")
    
    md = generate_pr_markdown(report, pr_title="Refactor GetUser API", author="Humaam-04-06")
    
    assert "### 🛡️ CodeImpact — Blast Radius & Dependency Impact Report" in md
    assert "Refactor GetUser API" in md
    assert "Humaam-04-06" in md
    assert "Exposed HTTP Endpoints" in md
    assert "Database Operations" in md
    assert "AuthController.Login" in md
    assert "UserRepository.FindByIdAsync" in md
