"""
Reloads all modules in the user's workspace folders
"""
from __future__ import annotations

import importlib
import traceback
import time
import json
import sys
import os

import unreal


def reload(workspace_folders: list[str]):
    start_time = time.perf_counter()

    num_reloads = 0
    num_failed = 0

    workspace_folders = [os.path.normpath(folder).lower() for folder in workspace_folders]

    for variable in list(sys.modules.values()):
        # Check if variable is a module
        if not hasattr(variable, '__file__') or not variable.__file__:
            continue

        filepath = variable.__file__.lower()

        if not any(filepath.startswith(x) for x in workspace_folders):
            continue

        try:
            importlib.reload(variable)
        except Exception as e:
            unreal.log_error(f'Failed to reload "{filepath}":\n{traceback.format_exc()}')
            num_failed += 1
            continue

        num_reloads += 1

    elapsed_time_ms = int((time.perf_counter() - start_time) * 1000)

    print(f"Reloaded {num_reloads} modules in {elapsed_time_ms}ms")

    return json.dumps({"num_reloads": num_reloads, "time": elapsed_time_ms, "num_failed": num_failed})
