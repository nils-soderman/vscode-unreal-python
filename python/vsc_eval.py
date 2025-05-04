import json  # Needs to be here to ensure the json module is available in remote-handler.ts `evaluateFunction`


def vsc_eval(filepath: str, function_name: str, use_globals: bool, **kwargs):
    """
    Evaluate a function in a Python file, and return the function's return value
    This function is used to evaluate VS Code python files and return the result to the Extension
    """
    with open(filepath, 'r', encoding="utf8") as file:
        code = file.read()

    # Find the function
    if use_globals:
        exec_globals = globals()
    else:
        exec_globals = {}

    exec(compile(code, filepath, 'exec'), exec_globals)

    if function_name in exec_globals:
        function = exec_globals[function_name]
        return function(**kwargs)
    else:
        raise ValueError(f"Function '{function_name}' not found in file '{filepath}'")
