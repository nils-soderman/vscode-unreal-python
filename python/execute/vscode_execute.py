from __future__ import annotations

"""
This script will be called from 'vscode_execute_entry.py' and will execute the user script
"""

import traceback
import tempfile
import logging
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


def execute_code(code: str, filename: str):
    try:
        exec(compile(code, filename, "exec"), get_exec_globals())
    except Exception as e:
        exception_type, exc, traceback_type = sys.exc_info()

        traceback_lines = []
        for line in traceback.format_exception(exception_type, exc, traceback_type):
            if execute_code.__name__ in line:
                continue

            # Reformat path to include the file number, example: 'myfile.py:5'
            if re.findall(r'file ".*", line \d*, in ', line.lower()):
                components = line.split(",", 2)
                line_number = "".join(x for x in components[1] if x.isdigit())
                components[0] = f'"{components[0][:-1]}:{line_number}"'
                line = ",".join(components)
            line = line.replace('"', "", 1)

            traceback_lines.append(line)

        traceback_message = "".join(traceback_lines).strip()

        unreal.log_error(traceback_message)


def main(exec_file: str, exec_origin: str, is_debugging: bool, name_var: str | None = None):
    # Set some global variables
    exec_globals = get_exec_globals()

    exec_globals["__file__"] = exec_origin
    if name_var:
        exec_globals["__name__"] = name_var
    elif "__name__" in exec_globals:
        exec_globals.pop("__name__")

    with open(exec_file, 'r', encoding="utf-8") as vscode_in_file:
        with UnrealLogRedirectDebugging() if is_debugging else nullcontext():
            execute_code(vscode_in_file.read(), exec_origin)
