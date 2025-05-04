import os

import unreal

def get_python_stub_dir():
    """ Get the directory to where the 'unreal.py' stub file is located """
    return os.path.join(os.path.abspath(unreal.Paths.project_intermediate_dir()), "PythonStub")
