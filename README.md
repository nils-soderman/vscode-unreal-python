# Unreal Engine Python (Visual Studio Code)

Editor features to assist when writing Python code for Unreal Engine.

**Please note that this extension is currently in pre-release, if you want to wait for a stable version, check back in a month or so!**

<br>

## Features

### Execute Code

Run code in Unreal Engine directly from within the editor

![execute code in unreal demo](https://github.com/nils-soderman/vscode-unreal-python/blob/main/media/demo/demo-exec.gif?raw=true)


Command: `Unreal Python: Execute` <br>
Keyboard Shortcut: <kbd>Ctrl</kbd> + <kbd>Enter</kbd>

The selected text will be executed, if nothing is selected the entire document will be executed.

<br>

## Settings

This extension contributes the following settings:

| Setting  | Default | Description |
| --- | --- | --- |
| `unreal-engine-python.execute.showOutput` | true | Bring up the Output log after running the execute command. |
| `unreal-engine-python.execute.clearOutput` | false | Clear the output log before executing the code. |
| `unreal-engine-python.remote.multicastGroupEndpoint` | "239.0.0.1:6766" | The multicast group endpoint _(must match the \"Multicast Group Endpoint\" setting in the Python plugin)_ |
| `unreal-engine-python.remote.multicastBindAdress` | "0.0.0.0" | The adapter address that the UDP multicast socket should bind to, or 0.0.0.0 to bind to all adapters _(must match the \"Multicast Bind Address\" setting in the Python plugin)_ |
| `unreal-engine-python.remote.multicastTTL` | 0 | Multicast TTL _(0 is limited to the local host, 1 is limited to the local subnet)_ |
| `unreal-engine-python.remote.commandEndpoint` | "127.0.0.1:6776" | The endpoint for the TCP command connection hosted by this client _(that the remote client will connect to)_ |
| `unreal-engine-python.remote.timeout` | 2 | How many seconds to wait while trying to connect to Unreal Engine before terminating the command |

<br>

# Contact
If you have any questions, feature requests or run into any bugs, don't hesitate to get in contact with me:

[Report an issue](https://github.com/nils-soderman/vscode-motionbuilder/issues "Report a bug on the GitHub repository")<br>
[Personal Website](https://nilssoderman.com)<br>
[Twitter](https://twitter.com/nilssoderman "@nilssoderman")

<br>

_* This is a third-party extension and is not associated with Unreal Engine or Epic Games in any way._
