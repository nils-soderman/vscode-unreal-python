""" 
Module to get the directory to where the 'unreal.py' stub file is located. 
"""

import os

import unreal

FOLDER_NAME = "PythonStub"


def get_python_stub_path():
    return os.path.join(os.path.abspath(unreal.Paths.project_intermediate_dir()), FOLDER_NAME)


def main():
    unreal.log(get_python_stub_path())


main()
