"""
Module for executing python code in Unreal
"""

import contextlib
import traceback
import tempfile
import json
import sys
import os
import re


TEMP_FOLDERPATH = os.path.join(tempfile.gettempdir(), "VSCode-Unreal-Python")
OUTPUT_FILENAME = "exec-out"

DATA_FILEPATH_GLOBAL_VAR_NAME = "data_filepath"


def read_input_data():
    """ Read input data that was written with typescript (`writeDataFile()` in `execute-script.ts`) """
    filepath = os.path.join(TEMP_FOLDERPATH, globals().get(DATA_FILEPATH_GLOBAL_VAR_NAME))
    if os.path.isfile(filepath):
        with open(filepath, 'r') as vs_code_settings_file:
            return json.load(vs_code_settings_file)
    return {}


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


def main():
    vscode_data = read_input_data()
    is_vscode_debugging = vscode_data.get("is_debugging", False)
    additional_print_str = vscode_data.get("additionalPrint", "")

    # Set some global variables
    exec_globals = get_exec_globals()

    target_filepath = vscode_data.get("__file__", "")
    exec_globals["__file__"] = target_filepath
    if "__name__" in vscode_data and vscode_data["__name__"]:
        exec_globals["__name__"] = vscode_data["__name__"]
    elif "__name__" in exec_globals:
        exec_globals.pop("__name__")

    command_id = vscode_data.get("id", "")
    output_filepath = os.path.join(TEMP_FOLDERPATH, f"{OUTPUT_FILENAME}-{command_id}.txt")

    with open(vscode_data["file"], 'r') as vscode_in_file:
        if not is_vscode_debugging and sys.version_info.major >= 3:
            # Re-direct the output through a text file
            with open(output_filepath, 'w') as vscode_out_file, contextlib.redirect_stdout(vscode_out_file):
                execute_code(vscode_in_file.read(),
                                  target_filepath, is_vscode_debugging)
        else:
            execute_code(vscode_in_file.read(), target_filepath, is_vscode_debugging)

        if additional_print_str:
            print(additional_print_str)

main()
