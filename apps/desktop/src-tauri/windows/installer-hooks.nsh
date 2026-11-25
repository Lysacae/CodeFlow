; Ferme CodeFlow avant installation / mise à jour pour écraser proprement les fichiers.
!macro NSIS_HOOK_PREINSTALL
  nsExec::ExecToLog 'taskkill /F /IM CodeFlow.exe /T'
  Sleep 800
!macroend

!macro NSIS_HOOK_PREUPDATE
  nsExec::ExecToLog 'taskkill /F /IM CodeFlow.exe /T'
  Sleep 800
!macroend
