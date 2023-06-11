"""
This script will be called from 'vscode_execute_entry.py' and will execute the user script
"""

import traceback
import tempfile
import json
import sys
import os
import re

from io import StringIO
from typing import Callable

import unreal

TEMP_FOLDERPATH = os.path.join(tempfile.gettempdir(), "VSCode-Unreal-Python")
OUTPUT_FILENAME = "exec-out"

DATA_FILEPATH_GLOBAL_VAR_NAME = "data_filepath"


class CustomStdoutRedirection(StringIO):
    def __init__(self, function: Callable) -> None:
        super().__init__()

        self.function = function

    def write(self, __s: str) -> int:
        self.function(__s)
        return super().write(__s)


class UnrealLogRedirect:
    def __init__(self, output_filepath: str):
        self.output_filepath = output_filepath

        self.output = []

        self.original_stdout = sys.stdout

        self.original_log = unreal.log
        self.original_log_error = unreal.log_error
        self.original_log_warning = unreal.log_warning

    def redirect(self, msg: str):
        self.output.append((msg, "log"))
        self.original_log(msg)

    def redirect_error(self, msg: str):
        self.output.append((msg, "error"))
        self.original_log_error(msg)

    def redirect_warning(self, msg: str):
        self.output.append((msg, "warning"))
        self.original_log_warning(msg)

    def __enter__(self):
        sys.stdout = CustomStdoutRedirection(self.redirect)

        unreal.log = self.redirect
        unreal.log_error = self.redirect_error
        unreal.log_warning = self.redirect_warning

    def __exit__(self, exc_type, exc_val, exc_tb):
        unreal.log = self.original_log
        unreal.log_error = self.original_log_error
        unreal.log_warning = self.original_log_warning

        sys.stdout = self.original_stdout

        with open(self.output_filepath, 'w', encoding="utf-8") as f:
            json.dump(self.output, f)


def get_exec_globals():
    """ Get globals to be used in the exec function when executing user scripts """
    if "__VsCodeVariables__" not in globals():
        globals()["__VsCodeVariables__"] = {
            "__builtins__": __builtins__, "__IsVsCodeExec__": True}
    return globals()["__VsCodeVariables__"]


def execute_code(code, filename, is_vscode_debugging):
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
        # Color the message red (this is only supported by 'Debug Console' in VsCode, and not not 'Output' log)
        if is_vscode_debugging:
            traceback_message = '\033[91m' + traceback_message + '\033[0m'

        unreal.log_error(traceback_message)


def main(exec_file, exec_origin, command_id, is_debugging, name_var=None):
    # Set some global variables
    exec_globals = get_exec_globals()

    exec_globals["__file__"] = exec_origin
    if name_var:
        exec_globals["__name__"] = name_var
    elif "__name__" in exec_globals:
        exec_globals.pop("__name__")

    output_filepath = os.path.join(TEMP_FOLDERPATH, f"{OUTPUT_FILENAME}-{command_id}.txt")

    with open(exec_file, 'r', encoding="utf-8") as vscode_in_file:
        if not is_debugging:
            # Re-direct the output through a text file
            with UnrealLogRedirect(output_filepath):
                execute_code(vscode_in_file.read(), exec_origin, is_debugging)
        else:
            execute_code(vscode_in_file.read(), exec_origin, is_debugging)
