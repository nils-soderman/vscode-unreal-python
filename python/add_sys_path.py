""" 
Script to add the given paths to sys.path
"""

from __future__ import annotations

import sys
import os

def add_paths(paths: list[str]):
    for vsc_path in paths:
        normalized_path = os.path.normpath(vsc_path)
        # Make sure the path doesn't already exist in sys.path
        if not any(normalized_path.lower() == os.path.normpath(path).lower() for path in sys.path):
            sys.path.append(normalized_path)
            print(f'Added "{normalized_path}" to sys.path')
