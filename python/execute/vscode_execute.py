from __future__ import annotations

"""
This script will be called from 'vscode_execute_entry.py' and will execute the user script
"""

import traceback
import tempfile
import logging
import ast
import sys
import os
import re

from contextlib import nullcontext

import unreal

TEMP_FOLDERPATH = os.path.join(tempfile.gettempdir(), "VSCode-Unreal-Python")
OUTPUT_FILENAME = "exec-out"

DATA_FILEPATH_GLOBAL_VAR_NAME = "data_filepath"


class UnrealLogRedirectDebugging:
    """ 
    Re-directs the Unreal log functions so that they are printed to python's stdout and can be read by the debugger
    """

    def __init__(self):
        self.logger = logging.getLogger("Unreal")
        self.original_log = unreal.log
        self.original_log_error = unreal.log_error
        self.original_log_warning = unreal.log_warning

    def redirect_warning(self, msg: str):
        self.logger.warning(msg)

    def redirect_error(self, msg: str):
        self.logger.error(msg)

    def redirect(self, msg: str):
        print(msg)

    def __enter__(self):
        unreal.log = self.redirect
        unreal.log_error = self.redirect_error
        unreal.log_warning = self.redirect_warning

    def __exit__(self, exc_type, exc_val, exc_tb):
        unreal.log = self.original_log
        unreal.log_error = self.original_log_error
        unreal.log_warning = self.original_log_warning


def get_exec_globals() -> dict:
    """ Get globals to be used in the exec function when executing user scripts """
    if "__VsCodeVariables__" not in globals():
        globals()["__VsCodeVariables__"] = {
            "__builtins__": __builtins__, "__IsVsCodeExec__": True}
    return globals()["__VsCodeVariables__"]


def find_package(filepath: str):
    """ Find the expected __package__ value for the executed file, so relative imports work """
    normalized_filepath = os.path.normpath(filepath).lower()

    valid_packages = []
    for path in sys.path:
        normalized_path = os.path.normpath(path).lower()
        if normalized_filepath.startswith(normalized_path):
            package = os.path.relpath(os.path.dirname(filepath), path).replace(os.sep, ".")
            if package != ".":
                valid_packages.append(package)

    # If there are multiple valid packages, choose the shortest one
    if valid_packages:
        return min(valid_packages, key=len)

    return ""


def add_print_for_last_expr(parsed_code: ast.Module) -> ast.Module:
    """
    Modify the ast to print the last expression if it isn't None.
    """
    if parsed_code.body:
        last_expr = parsed_code.body[-1]
        if isinstance(last_expr, ast.Expr):
            temp_var_name = "_"

            # Assign the last expression to a temporary variable
            temp_var_assign = ast.Assign(
                targets=[ast.Name(id=temp_var_name, ctx=ast.Store(),
                                  lineno=last_expr.lineno, col_offset=last_expr.col_offset)],
                value=last_expr.value,
                lineno=last_expr.lineno,
                col_offset=last_expr.col_offset
            )

            # If the temporary variable isn't None, print it
            print_stmt = ast.IfExp(
                test=ast.Compare(
                    left=ast.Name(id=temp_var_name, ctx=ast.Load(), lineno=last_expr.lineno, col_offset=last_expr.col_offset),
                    ops=[ast.IsNot()],
                    comparators=[ast.Constant(value=None, lineno=last_expr.lineno, col_offset=last_expr.col_offset)],
                    lineno=last_expr.lineno,
                    col_offset=last_expr.col_offset
                ),
                body=ast.Call(
                    func=ast.Name(id='print', ctx=ast.Load(), lineno=last_expr.lineno, col_offset=last_expr.col_offset),
                    args=[ast.Name(id=temp_var_name, ctx=ast.Load(), lineno=last_expr.lineno, col_offset=last_expr.col_offset)],
                    keywords=[],
                    lineno=last_expr.lineno,
                    col_offset=last_expr.col_offset
                ),
                orelse=ast.Constant(value=None, lineno=last_expr.lineno, col_offset=last_expr.col_offset),
                lineno=last_expr.lineno,
                col_offset=last_expr.col_offset
            )

            parsed_code.body[-1] = temp_var_assign
            parsed_code.body.append(ast.Expr(value=print_stmt, lineno=last_expr.lineno, col_offset=last_expr.col_offset))

    return parsed_code


def format_exception(exception_in: BaseException, code: str, num_ignore_tracebacks: int = 0) -> str:
    seen_exceptions = set()
    messages = []
    lines = code.splitlines()

    exception = exception_in
    while exception:
        if id(exception) in seen_exceptions:
            break
        seen_exceptions.add(id(exception))

        traceback_stack = []
        for frame_summary in traceback.extract_tb(exception.__traceback__):
            if num_ignore_tracebacks > 0:
                num_ignore_tracebacks -= 1
                continue

            if frame_summary.lineno is not None and 0 < frame_summary.lineno <= len(lines):
                line = lines[frame_summary.lineno - 1]
            else:
                line = frame_summary.line

            traceback_stack.append(
                traceback.FrameSummary(
                    f"{frame_summary.filename}:{frame_summary.lineno}",
                    frame_summary.lineno,
                    frame_summary.name,
                    lookup_line=False,
                    locals=frame_summary.locals,
                    line=line,
                    end_lineno=frame_summary.end_lineno,
                    colno=frame_summary.colno,
                    end_colno=frame_summary.end_colno
                )
            )

        text = "Traceback (most recent call last):\n"
        text += "".join(traceback.format_list(traceback_stack))
        text += "".join(traceback.format_exception_only(type(exception), exception))

        messages.append(text)

        exception = exception.__context__

    return "\nDuring handling of the above exception, another exception occurred:\n\n".join(reversed(messages))


def execute_code(code: str, filename: str, print_last_expr: bool):
    if print_last_expr:
        try:
            parsed_code = ast.parse(code, filename)
        except (SyntaxError, ValueError) as e:
            unreal.log_error(format_exception(e, code, num_ignore_tracebacks=2))
            return

        parsed_code = add_print_for_last_expr(parsed_code)
    else:
        parsed_code = code

    try:
        exec(compile(parsed_code, filename, 'exec'), get_exec_globals())
    except Exception as e:
        unreal.log_error(format_exception(e, code, num_ignore_tracebacks=1))


def main(exec_file: str, exec_origin: str, is_debugging: bool, name_var: str | None = None, print_last_expr=False):
    # Set some global variables
    exec_globals = get_exec_globals()

    exec_globals["__file__"] = exec_origin
    if name_var:
        exec_globals["__name__"] = name_var
    elif "__name__" in exec_globals:
        exec_globals.pop("__name__")

    exec_globals["__package__"] = find_package(exec_origin)

    with open(exec_file, 'r', encoding="utf-8") as vscode_in_file:
        with UnrealLogRedirectDebugging() if is_debugging else nullcontext():
            execute_code(vscode_in_file.read(), exec_origin, print_last_expr)
