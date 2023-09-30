# Change Log

## [1.1.0] - 2023-09-30

### Added:
- Config `ue-python.execute.unattended` that allows the user to execute code with the `-unattended` flag [#14](https://github.com/nils-soderman/vscode-unreal-python/issues/14)

### Changed:
- Code is no longer executed with the `-unattended` flag by default [#14](https://github.com/nils-soderman/vscode-unreal-python/issues/14)

### Fixed:
- Functions/methods not displaying properly in the documentation

### Removed:
- Config `ue-python.execute.enableShortcut`


## [1.0.0] - 2023-09-09

### Added:
- Added command `ue-python.selectInstance` that allows the user to select which Unreal Engine instance to connect to. [#3](https://github.com/nils-soderman/vscode-unreal-python/issues/3)
- Added status bar item that shows the currently connected Unreal Engine instance
- Added success/error messages when setting up code completion

### Changed:
- `ue-python.remote.timeout` config is now in milliseconds instead of seconds. To be consistent with other VS Code timeout configs
- Output is no longer written to a file, it's instead transferred through the `unreal-remote-exectution` socket
    - [unreal-remote-exectution](https://www.npmjs.com/package/unreal-remote-execution) is now a standalone NodeJS package
- Catch any errors that occurs during the installation of debugpy and log them to the output
- The ReadMe now uses WebP animations instead of GIFs
- esbuild is now used for building the extension. Resulting in a smaller extension size and faster activation time


## [0.2.3] - 2023-06-21

### Fixed:
- Unreal functions `log`, `log_warning` & `log_error` not showing up in the VS Code output. Issue [#8](https://github.com/nils-soderman/vscode-unreal-python/issues/8)
- Output not showing up if it's too large. Issue [#8](https://github.com/nils-soderman/vscode-unreal-python/issues/8)


## [0.2.2] - 2023-03-26

### Changed:
- Documentation now caches the open states of the dropdowns
- Improved filtering for the Documentation
- Having a word selected will auto insert it into the searchbar when opening the documentation

### Fixed:
- A bug where selecting a single indented line of code would fail to execute.
- Documentation now remembers the applied filter when going back to the index page
- Some broken UI styling for the documentation
- Not being able to open functions in the documentation


## [0.2.1] - 2023-03-13

### Added: 
- Added command "Unreal Python: Open Documentation" _(`ue-python.openDocumentation`)_ that opens the UE python documentation in a new tab.

### Changed:
- Removed documentation panel from the sidebar.

### Fixed:
- Output not showing up in Unreal Engine's "Output Log" if not attached.
- Use UTF-8 to decode the files in Python


## [0.2.0] - 2023-02-18

### Added:
- Documentation sidebar

### Changed:
- Updated README.md to clarify that commands can be executed through the command palette. Closes [#2](https://github.com/nils-soderman/vscode-unreal-python/issues/2)

### Fixed:
- Configs not read correctly from the folder settings
- Fixed bug that would cause `Setup Code Completion` to continue asking the user to enable Developer Mode even if it was already enabled


## [0.1.2] - 2022-10-17

### Added: 
- Added configuration `ue-python.strictPort` that prevents this extension from automatically finding a free port, and will strictly only use the ports assigned in the config.

### Fixed:
- Support for multiple VS Code instances connecting to the same Unreal Engine instance.


## [0.1.1] - 2022-10-09

### Added: 
- Added command `ue-python.setupCodeCompletion` that adds the '\<PROJECT\>/Intermediate/PythonStub/' path to `python.analysis.extraPaths`.


## [0.1.0] - 2022-10-06

### Added: 
- Added command `ue-python.attach` that attaches VS Code to Unreal Engine.
- Added configuration `ue-python.debug.port` to set which port to use for the python debugpy server.

### Changed:
- Removed the 'Settings' section from ReadMe.md


## [0.0.2] - 2022-10-01

### Added:

- Added configuration `ue-python.execute.name` that set's the python `__name__` variable while executing code, defaults to "\_\_main\_\_".
- Added configuration `ue-python.execute.enableShortcut` which can be used to disable the `ue-python.execute` shortcut in specific workspaces
- Added a help button if it fails to connect with Unreal Engine, that will bring the user to a troubleshooting webpage

### Changed:
- The command `ue-python.execute` is now only enabled when a Python file is open
- Updated default value of `ue-python.remote.timeout` to be 3 seconds.


## [0.0.1] - 2022-09-25

- Initial pre-release
