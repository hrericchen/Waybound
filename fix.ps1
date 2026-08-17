$file = "c:\Users\qifeng\Desktop\Waybound\src\screens\ProfileScreen.tsx"
$c = [System.IO.File]::ReadAllText($file)
$old = 'onPress={() => {'
$old += [Environment]::NewLine
$old += '                    setShowRenameInput(false);'
$old += [Environment]::NewLine
$old += '                    Alert.alert(''Name Updated'', `Your display name has been changed to "${renameText}". Restart the app to see changes.`);'
$old += [Environment]::NewLine
$old += '                  }'

$new = 'onPress={async () => {'
$new += [Environment]::NewLine
$new += '                    if (!renameText.trim()) return;'
$new += [Environment]::NewLine
$new += '                    try { const usrs = await communityService.getUsers(); if (usrs.some((u: any) => u.name?.toLowerCase() === renameText.trim().toLowerCase() && u.id !== user?.id)) { Alert.alert(''Name Taken'', ''This display name is already in use.''); return; } } catch {}'
$new += [Environment]::NewLine
$new += '                    setShowRenameInput(false);'
$new += [Environment]::NewLine
$new += '                    try { const current = await storageService.load(storageService.STORAGE_KEYS.USER) || {}; current.name = renameText.trim(); await storageService.save(storageService.STORAGE_KEYS.USER, current); await communityService.registerUser({ id: current.id, name: renameText.trim(), email: current.email, avatarUrl: current.avatarUrl, tag: current.tag }); } catch {}'
$new += [Environment]::NewLine
$new += '                  }'

if ($c.Contains($old)) { $c = $c.Replace($old, $new); [System.IO.File]::WriteAllText($file, $c); Write-Host 'REPLACED' } else { Write-Host 'NOT FOUND' }
