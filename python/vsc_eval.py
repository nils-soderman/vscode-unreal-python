import json  # Needs to be here to ensure the json module is available in the exec scope

def vsc_eval(filepath: str, function_name: str, **args):
    """
    Evaluate a function in a Python file, and return the function's return value
    This function is used to evaluate VS Code python files and return the result to the Extension
    """
    with open(filepath, 'r', encoding="utf8") as file:
        code = file.read()

    # Find the function
    function = None
    exec_globals = {}
    exec(code, exec_globals)
    if function_name in exec_globals:
        function = exec_globals[function_name]
    else:
        raise ValueError(f"Function '{function_name}' not found in file '{filepath}'")

    return function(**args)
