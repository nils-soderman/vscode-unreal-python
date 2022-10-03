""" 
This entry script is needed for ignoring the actual module 'vscode_execute' from the debugger
"""
# import importlib
import sys
import os



vscode_execute = globals().get("vscode_execute")
if not vscode_execute:
    current_filepath = globals().get("__vscodeExecFile__")  # Essentially __file__, but set through 'execute.ts'
    sys.path.append(os.path.dirname(current_filepath))
    import vscode_execute
    sys.path.remove(os.path.dirname(current_filepath))

# importlib.reload(vscode_execute)

data_filepath = globals().get("data_filepath")
vscode_execute.main(data_filepath)
