""" 
Script to add the given paths to sys.path
"""

import sys
import os

def main():
    vsc_paths = globals().get("vsc_paths", [])

    vsc_paths.sort(key=len, reverse=True)  # Sort the paths by length to ensure that the most specific paths are added first

    for vsc_path in vsc_paths:
        normalized_path = os.path.normpath(vsc_path)
        # Make sure the path doesn't already exist in sys.path
        if not any(normalized_path.lower() == os.path.normpath(path).lower() for path in sys.path):
            sys.path.append(normalized_path)
            print(f'Added "{normalized_path}" to sys.path')

main()
