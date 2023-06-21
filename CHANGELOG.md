# Change Log

## v0.2.3
[2023-06-21]

### Fixed:
- Unreal functions `log`, `log_warning` & `log_error` not showing up in the VS Code output. Issue [#8](https://github.com/nils-soderman/vscode-unreal-python/issues/8)
- Output not showing up if it's too large. Issue [#8](https://github.com/nils-soderman/vscode-unreal-python/issues/8)


## v0.2.2
[2023-03-26]

### Changed:
- Documentation now caches the open states of the dropdowns
- Improved filtering for the Documentation
- Having a word selected will auto insert it into the searchbar when opening the documentation

### Fixed:
- A bug where selecting a single indented line of code would fail to execute.
- Documentation now remembers the applied filter when going back to the index page
- Some broken UI styling for the documentation
- Not being able to open functions in the documentation

<br>

## v0.2.1
[2023-03-13]

### Added: 
- Added command "Unreal Python: Open Documentation" _(`ue-python.openDocumentation`)_ that opens the UE python documentation in a new tab.

### Changed:
- Removed documentation pannel from the sidebar.

### Fixed:
- Output not showing up in Unreal Engine's "Output Log" if not attached.
- Use UTF-8 to decode the files in Python


<br>


## v0.2.0
[2023-02-18]

### Added:
- Documentation sidebar

### Changed:
- Updated README.md to clarify that commands can be executed through the command palette. Closes [#2](https://github.com/nils-soderman/vscode-unreal-python/issues/2)

### Fixed:
- Configs not read correctly from the folder settings
- Fixed bug that would cause `Setup Code Completion` to continue asking the user to enable Developer Mode even if it was already enabled


<br>


## v0.1.2
[2022-10-17]

### Added: 
- Added configuration `ue-python.strictPort` that prevents this extension from automatically finding a free port, and will strictly only use the ports assigned in the config.

### Fixed:
- Support for multiple VS Code instances connecting to the same Unreal Engine instance.

<br>


## v0.1.1
[2022-10-09]

### Added: 
- Added command `ue-python.setupCodeCompletion` that adds the '\<PROJECT\>/Intermediate/PythonStub/' path to `python.analysis.extraPaths`.

<br>


## v0.1.0
[2022-10-06]

### Added: 
- Added command `ue-python.attach` that attaches VS Code to Unreal Engine.
- Added configuration `ue-python.debug.port` to set which port to use for the python debugpy server.

### Changed:
- Removed the 'Settings' section from ReadMe.md

<br>


## v0.0.2
[2022-10-01]

### Added:

- Added configuration `ue-python.execute.name` that set's the python `__name__` variable while executing code, defaults to "\_\_main\_\_".
- Added configuration `ue-python.execute.enableShortcut` which can be used to disable the `ue-python.execute` shortcut in spesific workspaces
- Added a help button if it fails to connect with Unreal Engine, that will bring the user to a troubleshooting webpage

### Changed:

- The command `ue-python.execute` is now only enabled when a Python file is open
- Updated default value of `ue-python.remote.timeout` to be 3 seconds.

<br>


## v0.0.1
[2022-09-25]

- Initial pre-release
