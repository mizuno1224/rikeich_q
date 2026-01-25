// js/admin-fs.js

// --- File System Operations ---

async function getMaterialDirHandle() {
  if (!manifestData[activeMaterialIndex]) return null;
  const matId = manifestData[activeMaterialIndex].id;
  // explanations/{matId} を返す
  return await explanationsDirHandle.getDirectoryHandle(matId, {create: true});
}

async function getDeepDirectoryHandle(root, pathStr, create=false) {
  if(!pathStr) return root;
  let dir = root;
  const parts = pathStr.split('/').filter(p => p.length > 0);
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, {create: create});
  }
  return dir;
}

async function fsRenameFolder(parentHandle, oldName, newName) {
  if(!oldName || !newName || oldName === newName) return;
  try {
    if (oldName.includes('/') || newName.includes('/')) {
        console.warn("パスを含むリネームは現在サポートしていません");
        return;
    }
    const oldDir = await parentHandle.getDirectoryHandle(oldName);
    const newDir = await parentHandle.getDirectoryHandle(newName, {create: true});
    
    for await (const [name, handle] of oldDir.entries()) {
      if (handle.kind === 'file') {
        const file = await handle.getFile();
        const newFileHandle = await newDir.getFileHandle(name, {create: true});
        const writable = await newFileHandle.createWritable();
        await writable.write(file);
        await writable.close();
      }
    }
    await parentHandle.removeEntry(oldName, {recursive: true});
  } catch(e) { console.error("FS Rename Error:", e); }
}

async function fsMoveFile(currentPath, targetFolderHandle, newFileName) {
  try {
      const parts = currentPath.split('/');
      const fileName = parts.pop();
      let dir = rootDirHandle;
      for(const p of parts) dir = await dir.getDirectoryHandle(p);
      const fileHandle = await dir.getFileHandle(fileName);

      const file = await fileHandle.getFile();
      const content = await file.text();

      const newHandle = await targetFolderHandle.getFileHandle(newFileName || fileName, {create: true});
      const w = await newHandle.createWritable();
      await w.write(content);
      await w.close();

      await dir.removeEntry(fileName);
      return true;
  } catch(e) {
      console.error("Move File Error:", e);
      return false;
  }
}

async function fsDelete(parentHandle, name) {
    if (name.includes('/')) {
        const parts = name.split('/');
        const targetName = parts.pop();
        const dir = await getDeepDirectoryHandle(parentHandle, parts.join('/'));
        await dir.removeEntry(targetName, {recursive: true});
    } else {
        await parentHandle.removeEntry(name, {recursive: true});
    }
}

async function saveManifest() {
  if (!rootDirHandle) return;
  const dataDir = await rootDirHandle.getDirectoryHandle('data', { create: true });
  const fh = await dataDir.getFileHandle('manifest.json', { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(manifestData, null, 2));
  await w.close();
}