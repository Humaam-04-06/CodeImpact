from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class SymbolType(str, Enum):
    CONTROLLER = "controller"
    SERVICE = "service"
    REPOSITORY = "repository"
    TEST = "test"
    MODEL = "model"
    FUNCTION = "function"

class Parameter(BaseModel):
    name: str
    type_annotation: Optional[str] = None
    default_value: Optional[str] = None

class CallSite(BaseModel):
    target_name: str
    line_number: int
    arguments_count: int = 0
    raw_call: str = ""
    caller_id: Optional[str] = None

class SymbolNode(BaseModel):
    id: str  # Unique identifier: e.g. "UserService.GetUser"
    name: str  # e.g. "GetUser"
    full_name: str  # e.g. "ECommerce.Services.UserService.GetUser"
    file_path: str  # Relative path to workspace
    line_number: int
    end_line_number: int
    symbol_type: SymbolType = SymbolType.FUNCTION
    class_name: Optional[str] = None
    namespace: Optional[str] = None
    return_type: Optional[str] = None
    parameters: List[Parameter] = Field(default_factory=list)
    decorators: List[str] = Field(default_factory=list)
    http_method: Optional[str] = None  # GET, POST, PUT, DELETE
    http_route: Optional[str] = None
    is_db_operation: bool = False
    is_test: bool = False
    source_code: str = ""
    calls: List[CallSite] = Field(default_factory=list)

class BreakingChange(BaseModel):
    call_site_file: str
    call_site_line: int
    caller_name: str
    issue: str
    severity: str = "CRITICAL"  # CRITICAL, WARNING, INFO
    recommended_fix: Optional[str] = None

class ImpactSummary(BaseModel):
    total_dependents: int = 0
    controllers_count: int = 0
    db_ops_count: int = 0
    tests_count: int = 0
    breaking_changes_count: int = 0
    untested_paths_count: int = 0

class BlastReport(BaseModel):
    target_id: str
    target_name: str
    target_file: str
    target_type: SymbolType
    blast_score: int  # 0 to 100
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    summary: ImpactSummary
    affected_nodes: List[SymbolNode] = Field(default_factory=list)
    affected_controllers: List[SymbolNode] = Field(default_factory=list)
    affected_db_ops: List[SymbolNode] = Field(default_factory=list)
    affected_tests: List[SymbolNode] = Field(default_factory=list)
    breaking_changes: List[BreakingChange] = Field(default_factory=list)
    untested_paths: List[str] = Field(default_factory=list)
    propagation_tree: Dict[str, Any] = Field(default_factory=dict)
