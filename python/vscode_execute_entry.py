""" 
This entry script is needed for ignoring the actual module 'vscode_execute' from the debugger
"""
import json
import sys
import os

vscode_globals = globals().get("vscode_globals")
vscode_globals = json.loads(vscode_globals)

vscode_execute = globals().get("vscode_execute")
if not vscode_execute:
    # current_filepath = globals().get("__vscodeExecFile__")  # Essentially __file__, but set through 'execute.ts'
    print("__file__: %s" %(__file__))
    sys.path.append(os.path.dirname(__file__))
    import vscode_execute
    sys.path.remove(os.path.dirname(__file__))

vscode_execute.main(
    vscode_globals.get("file"),
    vscode_globals.get("__file__"),
    vscode_globals.get("id"),
    vscode_globals.get("isDebugging"),
    vscode_globals.get("__name__"),
    vscode_globals.get("additionalPrint")
)
