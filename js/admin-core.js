// js/admin-core.js

// --- Global State ---
let manifestData = [];
let currentMaterialData = null;
let currentMaterialPath = null;
let currentMaterialType = 'standard';

let rootDirHandle = null;
let explanationsDirHandle = null;

let activeMaterialIndex = 0;
let openPaths = new Set();
let currentProblem = null;       // 現在編集中の問題オブジェクト
let currentVisualEditor = null;  // 現在のエディタ要素(textarea)

// Drag & Drop State
let dragSrcProb = null;
let dragSrcField = null;

// --- DOM Elements (Global Access) ---
let ui = {};

document.addEventListener('DOMContentLoaded', () => {
  // DOM要素をキャッシュ
  ui = {
    btnOpen: document.getElementById('btn-open'),
    btnSave: document.getElementById('btn-save'),
    btnAddSubject: document.getElementById('btn-add-subject'),
    sidebarTools: document.querySelector('.sidebar-tools'),
    mainUi: document.getElementById('main-ui'),
    initialMsg: document.getElementById('initial-msg'),
    tabsArea: document.getElementById('material-tabs'),
    treeRoot: document.getElementById('tree-root'),
    editorMainWrapper: document.getElementById('editor-main-wrapper'),
    tabEdit: document.getElementById('tab-edit'),
    tabPreview: document.getElementById('tab-preview'),
    formContainer: document.getElementById('form-container'),
    viewEditor: document.getElementById('view-editor'),
    viewPreview: document.getElementById('view-preview'),
    previewContainer: document.getElementById('preview-container'),
    toastContainer: document.getElementById('toast-container'),
    emptyState: document.querySelector('.empty-state'),
    
    // AI Import Modal
    btnImportAi: document.getElementById('btn-import-ai'),
    importModal: document.getElementById('import-modal'),
    btnCloseImport: document.getElementById('btn-close-import'),
    btnExecImport: document.getElementById('btn-exec-import'),
    impHtml: document.getElementById('imp-html'),
    impJs: document.getElementById('imp-js'), // 念のため残存対応
    impJson: document.getElementById('imp-json'),
    importTargetMaterial: document.getElementById('import-target-material'),

    // Code Editor Modal
    codeModal: document.getElementById('code-modal'),
    btnSaveCode: document.getElementById('btn-save-code'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    codeEditor: document.getElementById('code-editor'),
    modalTitle: document.getElementById('modal-title'),
    
    // Header Info
    editingTitle: document.getElementById('editing-title'),
    editingId: document.getElementById('editing-id')
  };

  // --- Event Listeners Initialization ---
  
  // 1. Project Open
  ui.btnOpen.addEventListener('click', async () => {
    try {
      rootDirHandle = await window.showDirectoryPicker();
      
      try {
        const dataDir = await rootDirHandle.getDirectoryHandle('data');
        explanationsDirHandle = await dataDir.getDirectoryHandle('explanations');
      } catch (e) {
        showToast("エラー: data/explanations フォルダが見つかりません", true);
        return;
      }

      try {
        const dataDir = await rootDirHandle.getDirectoryHandle('data');
        const manifestHandle = await dataDir.getFileHandle('manifest.json');
        const file = await manifestHandle.getFile();
        manifestData = JSON.parse(await file.text());
        showToast("プロジェクトを読み込みました");
      } catch (e) {
         if(confirm("manifest.jsonが見つかりません。新規作成しますか？")) {
           manifestData = [];
           await saveManifest();
         } else { return; }
      }

      ui.initialMsg.style.display = 'none';
      ui.mainUi.style.display = 'flex';
      ui.btnSave.disabled = false;
      ui.btnOpen.textContent = "📂 " + rootDirHandle.name;

      renderTabs();

      // ★修正: 前回開いていたタブ番号を復元
      const lastIdx = localStorage.getItem('admin_last_material_index');
      const targetIdx = (lastIdx && manifestData[lastIdx]) ? parseInt(lastIdx) : 0;

      if (manifestData.length > 0) {
        await loadMaterial(targetIdx);
      } else {
        ui.treeRoot.innerHTML = '<div style="padding:20px; color:#666;">教材がありません。「＋」ボタンで追加してください。</div>';
      }

    } catch (err) { console.error(err); }
  });

  // 2. Save All
  ui.btnSave.addEventListener('click', saveAll);

  // 3. Add Subject/Category Button
  ui.btnAddSubject.addEventListener('click', handleAddSubject);

  // 4. Tab Switching (Editor <-> Preview)
  setupTabSwitching();

  // 5. Sidebar Tools (Sync, AI Import, Collapse)
  setupSidebarTools();

  // 6. Import Modal Events
  setupImportModalEvents();
});

// --- Common Helpers ---
function showToast(msg, err) {
  const t = document.createElement('div'); 
  t.className = 'toast';
  t.textContent = msg; 
  if(err) t.style.background = '#ef4444';
  if(ui.toastContainer) ui.toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}