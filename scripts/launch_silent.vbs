Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\adama\bower-jj"
WshShell.Run "cmd.exe /c ""C:\Users\adama\bower-jj\scripts\run_247_server.cmd""", 0, False
