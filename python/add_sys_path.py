""" 
Script to add the given paths to sys.path
"""

import sys

def main():
    paths = globals().get("vsc_paths", [])
    for path in paths:
        if path not in sys.path:
            sys.path.append(path)
            print(f'Added "{path}" to sys.path')


main()