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
            temp_var = "__vscode_temp__"

            # Assign the last expression to a temporary variable
            temp_var_assign = ast.Assign(
                targets=[ast.Name(id=temp_var, ctx=ast.Store(),
                                  lineno=last_expr.lineno, col_offset=last_expr.col_offset)],
                value=last_expr.value,
                lineno=last_expr.lineno,
                col_offset=last_expr.col_offset
            )

            # If the temporary variable isn't None, print it
            print_stmt = ast.IfExp(
                test=ast.Compare(
                    left=ast.Name(id=temp_var, ctx=ast.Load(), lineno=last_expr.lineno, col_offset=last_expr.col_offset),
                    ops=[ast.IsNot()],
                    comparators=[ast.Constant(value=None, lineno=last_expr.lineno, col_offset=last_expr.col_offset)],
                    lineno=last_expr.lineno,
                    col_offset=last_expr.col_offset
                ),
                body=ast.Call(
                    func=ast.Name(id='print', ctx=ast.Load(), lineno=last_expr.lineno, col_offset=last_expr.col_offset),
                    args=[ast.Name(id=temp_var, ctx=ast.Load(), lineno=last_expr.lineno, col_offset=last_expr.col_offset)],
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


def handle_exception():
    exception_type, exc, traceback_type = sys.exc_info()

    traceback_lines = []
    for line in traceback.format_exception(exception_type, exc, traceback_type):
        if execute_code.__name__ in line:
            continue

        # Reformat path to include the file number, example: 'myfile.py:5'
        # This is to make VS Code recognize this as a link to a spesific line number
        if re.findall(r'file ".*", line \d*', line.lower()):
            file_desc, _, number_and_module = line.partition(",")
            line_number = "".join(x for x in number_and_module.partition(",")[0] if x.isdigit())
            file_desc = '%s:%s"' % (file_desc[:-1], line_number)
            line = file_desc + "," + number_and_module

        traceback_lines.append(line)

    traceback_message = "".join(traceback_lines).strip()

    unreal.log_error(traceback_message)


def execute_code(code: str, filename: str, print_last_expr: bool):
    if print_last_expr:
        try:
            parsed_code = ast.parse(code, filename)
        except (SyntaxError, ValueError) as e:
            handle_exception()
            return

        parsed_code = add_print_for_last_expr(parsed_code)
    else:
        parsed_code = code

    try:
        exec(compile(parsed_code, filename, 'exec'), get_exec_globals())
    except Exception as e:
        handle_exception()


def main(exec_file: str, exec_origin: str, is_debugging: bool, name_var: str | None = None, print_last_expr = False):
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
