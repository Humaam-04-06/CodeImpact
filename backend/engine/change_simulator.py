from typing import List, Optional, Dict, Any
from backend.engine.models import SymbolNode, Parameter, BreakingChange, CallSite
from backend.engine.graph_builder import CodeKnowledgeGraph

class ChangeSimulator:
    def __init__(self, ckg: CodeKnowledgeGraph):
        self.ckg = ckg

    def simulate_signature_change(
        self,
        target_symbol_id: str,
        new_parameters: List[Parameter],
        new_return_type: Optional[str] = None
    ) -> List[BreakingChange]:
        """
        Simulates changing a function's parameters or return type,
        and identifies exact breaking call sites across all direct callers.
        """
        breaking_changes: List[BreakingChange] = []
        target_sym = self.ckg.symbols_by_id.get(target_symbol_id)
        if not target_sym:
            return breaking_changes

        # Direct callers who invoke this target symbol
        caller_ids = self.ckg.get_upstream_callers(target_symbol_id)
        
        # Calculate required parameters (parameters without default values)
        required_params = [p for p in new_parameters if not p.default_value]
        required_count = len(required_params)
        total_param_count = len(new_parameters)
        old_param_count = len(target_sym.parameters)

        for caller_id in caller_ids:
            caller_sym = self.ckg.symbols_by_id.get(caller_id)
            if not caller_sym:
                continue

            # Find matching calls in this caller
            for call in caller_sym.calls:
                cleaned_target = call.target_name.split(".")[-1].strip()
                if cleaned_target == target_sym.name or call.target_name == target_sym.id:
                    # 1. Parameter count check
                    if call.arguments_count < required_count:
                        missing = [p.name for p in required_params[call.arguments_count:]]
                        missing_str = ", ".join(missing)
                        breaking_changes.append(
                            BreakingChange(
                                call_site_file=caller_sym.file_path,
                                call_site_line=call.line_number,
                                caller_name=caller_sym.id,
                                issue=(
                                    f"Argument count mismatch: call site passes {call.arguments_count} argument(s), "
                                    f"but new signature requires {required_count} parameter(s). Missing: {missing_str}"
                                ),
                                severity="CRITICAL",
                                recommended_fix=(
                                    f"Provide parameter(s) '{missing_str}' at line {call.line_number} in {caller_sym.file_path} "
                                    f"or specify a default value in {target_sym.name}'s signature."
                                ),
                            )
                        )
                    elif call.arguments_count > total_param_count:
                        breaking_changes.append(
                            BreakingChange(
                                call_site_file=caller_sym.file_path,
                                call_site_line=call.line_number,
                                caller_name=caller_sym.id,
                                issue=(
                                    f"Too many arguments: call site passes {call.arguments_count} argument(s), "
                                    f"but new signature only accepts {total_param_count}."
                                ),
                                severity="CRITICAL",
                                recommended_fix=f"Remove extraneous arguments from call site in {caller_sym.file_path}:{call.line_number}.",
                            )
                        )

            # 2. Return type breaking change detection
            if new_return_type and target_sym.return_type and new_return_type != target_sym.return_type:
                breaking_changes.append(
                    BreakingChange(
                        call_site_file=caller_sym.file_path,
                        call_site_line=caller_sym.line_number,
                        caller_name=caller_sym.id,
                        issue=(
                            f"Return type changed from '{target_sym.return_type}' to '{new_return_type}'. "
                            f"Caller may experience type mismatch or compilation failure."
                        ),
                        severity="WARNING",
                        recommended_fix=f"Verify return handling and variable types in {caller_sym.id}.",
                    )
                )

        return breaking_changes
