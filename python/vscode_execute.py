"""
This script will be called from 'vscode_execute_entry.py' and will execute the user script
"""

import contextlib
import traceback
import tempfile
import sys
import os
import re

from io import StringIO

TEMP_FOLDERPATH = os.path.join(tempfile.gettempdir(), "VSCode-Unreal-Python")
OUTPUT_FILENAME = "exec-out"

DATA_FILEPATH_GLOBAL_VAR_NAME = "data_filepath"


class StdOutRedirection:
    """ Re-direct the output to a text file while still printing it to the console, should be used with a 'with' statement. """
    def __init__(self, output_filepath: str):
        self.output_filepath = output_filepath
        self.stringio = StringIO()
        self.stdout = None

    def __enter__(self):
        self.stdout = sys.stdout
        sys.stdout = self.stringio

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stringio.seek(0)
        output = self.stringio.read()
        with open(self.output_filepath, 'w', encoding="utf-8") as f:
            f.write(output)
        self.stdout.write(output)
        self.stdout.flush()
        sys.stdout = self.stdout


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

        print(traceback_message)


def main(exec_file, exec_origin, command_id, is_debugging, name_var=None, additional_print=None):
    # Set some global variables
    exec_globals = get_exec_globals()

    exec_globals["__file__"] = exec_origin
    if name_var:
        exec_globals["__name__"] = name_var
    elif "__name__" in exec_globals:
        exec_globals.pop("__name__")

    output_filepath = os.path.join(
        TEMP_FOLDERPATH, f"{OUTPUT_FILENAME}-{command_id}.txt")

    with open(exec_file, 'r', encoding="utf-8") as vscode_in_file:
        if not is_debugging:
            # Re-direct the output through a text file
            with StdOutRedirection(output_filepath):
                execute_code(vscode_in_file.read(), exec_origin, is_debugging)
                if additional_print:
                    print(additional_print)
        else:
            execute_code(vscode_in_file.read(), exec_origin, is_debugging)
            if additional_print:
                print(additional_print)
