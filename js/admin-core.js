// js/admin-core.js

// --- Global State ---
let manifestData = [];
let currentMaterialData = null;
let currentMaterialPath = null;
let currentMaterialType = "standard";

let rootDirHandle = null;
let explanationsDirHandle = null;
let isCloudMode = false; // クラウドモードフラグ

let activeMaterialIndex = 0;
let openPaths = new Set();
let currentProblem = null; 
let currentVisualEditor = null; 

// Drag & Drop State
let dragSrcProb = null;
let dragSrcField = null;

// 未保存の変更を追跡
let hasUnsavedChanges = false;
let originalMaterialData = null;

// --- DOM Elements (Global Access) ---
let ui = {};

document.addEventListener("DOMContentLoaded", () => {
  // DOM要素をキャッシュ
  ui = {
    btnOpen: document.getElementById("btn-open"),
    btnOpenCloud: document.getElementById("btn-open-cloud"),
    btnSave: document.getElementById("btn-save"),
    btnAddSubject: document.getElementById("btn-add-subject"),
    sidebarTools: document.querySelector(".sidebar-tools"),
    sidebarArea: document.getElementById("sidebar-area"),
    btnToggleSidebar: document.getElementById("btn-toggle-sidebar"),
    mainUi: document.getElementById("main-ui"),
    initialMsg: document.getElementById("initial-msg"),
    tabsArea: document.getElementById("material-tabs"),
    treeRoot: document.getElementById("tree-root"),
    editorMainWrapper: document.getElementById("editor-main-wrapper"),
    
    // Tabs & Views
    tabEdit: document.getElementById("tab-edit"),
    tabSpreadsheet: document.getElementById("tab-spreadsheet"),
    tabPreview: document.getElementById("tab-preview"),
    tabAnalyze: document.getElementById("tab-analyze"),
    tabRequests: document.getElementById("tab-requests"),
    viewEditor: document.getElementById("view-editor"),
    viewSpreadsheet: document.getElementById("view-spreadsheet"),
    viewPreview: document.getElementById("view-preview"),
    viewAnalyze: document.getElementById("view-analyze"),
    viewRequests: document.getElementById("view-requests"),
    
    spreadsheetContainer: document.getElementById("spreadsheet-container"),
    adminRequestsList: document.getElementById("admin-requests-list"),
    
    formContainer: document.getElementById("form-container"),
    previewContainer: document.getElementById("preview-container"),
    analyzeContainer: document.getElementById("analyze-container"),
    
    toastContainer: document.getElementById("toast-container"),
    emptyState: document.querySelector(".empty-state"),

    // AI Import Modal
    btnImportAi: document.getElementById("btn-import-ai"),
    importModal: document.getElementById("import-modal"),
    btnCloseImport: document.getElementById("btn-close-import"),
    btnExecImport: document.getElementById("btn-exec-import"),
    impHtml: document.getElementById("imp-html"),
    impJs: document.getElementById("imp-js"),
    impJson: document.getElementById("imp-json"),
    importTargetMaterial: document.getElementById("import-target-material"),

    // Code Editor Modal
    codeModal: document.getElementById("code-modal"),
    btnSaveCode: document.getElementById("btn-save-code"),
    btnCloseModal: document.getElementById("btn-close-modal"),
    codeEditor: document.getElementById("code-editor"),
    modalTitle: document.getElementById("modal-title"),

    // Header Info
    editingTitle: document.getElementById("editing-title"),
    editingId: document.getElementById("editing-id"),
  };

  // --- Event Listeners Initialization ---

  // 1. Project Open (Local)
  ui.btnOpen.addEventListener("click", async () => {
    try {
      isCloudMode = false; // ローカルモード
      rootDirHandle = await window.showDirectoryPicker();

      try {
        const dataDir = await rootDirHandle.getDirectoryHandle("data");
        explanationsDirHandle = await dataDir.getDirectoryHandle("explanations");
      } catch (e) {
        showToast("エラー: data/explanations フォルダが見つかりません", true);
        return;
      }

      try {
        const dataDir = await rootDirHandle.getDirectoryHandle("data");
        const manifestHandle = await dataDir.getFileHandle("manifest.json");
        const file = await manifestHandle.getFile();
        manifestData = JSON.parse(await file.text());
        showToast("プロジェクトを読み込みました");
      } catch (e) {
        if (confirm("manifest.jsonが見つかりません。新規作成しますか？")) {
          manifestData = [];
          await saveManifest();
        } else {
          return;
        }
      }

      setupAppReady(rootDirHandle.name);
    } catch (err) {
      console.error(err);
    }
  });

  // Project Open (Cloud)
  if(ui.btnOpenCloud) {
    ui.btnOpenCloud.addEventListener("click", async () => {
      try {
        isCloudMode = true; // クラウドモード
        rootDirHandle = null; // ローカルハンドルは無し
        
        // サーバー上の manifest.json を取得
        const res = await fetch("data/manifest.json");
        if(!res.ok) throw new Error("manifest.json load failed");
        manifestData = await res.json();
        
        showToast("クラウド上のデータを読み込みました (編集不可)");
        setupAppReady("Cloud Mode (Read Only)");
        
        // 保存ボタン等は無効化
        ui.btnSave.disabled = true;
        ui.btnAddSubject.disabled = true;
      } catch(err) {
        console.error(err);
        showToast("クラウドデータの読み込みに失敗しました", true);
      }
    });
  }

  // 2. Save All
  ui.btnSave.addEventListener("click", () => {
    if(isCloudMode) {
      alert("クラウドモードでは保存できません。編集するにはローカルフォルダを開いてください。");
      return;
    }
    saveAll();
  });

  // 3. Add Subject/Category Button
  ui.btnAddSubject.addEventListener("click", handleAddSubject);

  // 4. Tab Switching
  setupTabSwitching();

  // 5. Sidebar Tools
  setupSidebarTools();
  
  // 6. Sidebar Toggle
  if (ui.btnToggleSidebar && ui.sidebarArea) {
    // デフォルトでツリーを非表示にする
    ui.sidebarArea.classList.add("collapsed");
    ui.btnToggleSidebar.textContent = "▶";
    ui.btnToggleSidebar.title = "ツリーを開く";
    
    ui.btnToggleSidebar.addEventListener("click", () => {
      ui.sidebarArea.classList.toggle("collapsed");
      ui.btnToggleSidebar.textContent = ui.sidebarArea.classList.contains("collapsed") ? "▶" : "◀";
      ui.btnToggleSidebar.title = ui.sidebarArea.classList.contains("collapsed") ? "ツリーを開く" : "ツリーを閉じる";
    });
  }

  // 6. Import Modal Events
  setupImportModalEvents();
});

// アプリ起動時の共通処理
async function setupAppReady(name) {
  ui.initialMsg.style.display = "none";
  ui.mainUi.style.display = "flex";
  
  if(!isCloudMode) {
    ui.btnSave.disabled = false;
    ui.btnOpen.textContent = "📂 " + name;
    ui.btnOpenCloud.style.display = "none";
  } else {
    ui.btnSave.disabled = true;
    ui.btnOpenCloud.textContent = "☁️ " + name;
    ui.btnOpen.style.display = "none";
  }

  renderTabs();

  // 前回開いていたタブ番号を復元
  const lastIdx = localStorage.getItem("admin_last_material_index");
  const targetIdx = lastIdx && manifestData[lastIdx] ? parseInt(lastIdx) : 0;

  if (manifestData.length > 0) {
    await loadMaterial(targetIdx);
  } else {
    ui.treeRoot.innerHTML =
      '<div style="padding:20px; color:#666;">教材がありません。</div>';
  }
}

// --- Common Helpers ---
function showToast(msg, err) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  if (err) t.style.background = "#ef4444";
  if (ui.toastContainer) ui.toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/**
 * 集計データを取得する関数
 * Firestoreが有効な場合は本番データを、無効な場合はダミーデータを返す
 */
async function fetchAnalysisData(problemId) {
  // 1. Firestore接続確認
  if (window.db && window.firebase) {
    try {
      const logsRef = window.db.collection("student_logs");
      const snapshot = await logsRef.where("contentId", "==", problemId).get();
      
      if (snapshot.empty) return [];

      const logs = [];
      snapshot.forEach(doc => {
        logs.push(doc.data());
      });
      return logs;
    } catch (e) {
      console.error("Firestore Error:", e);
      return [];
    }
  } else {
    // 2. 未接続時はデモ用のダミーデータを生成して返す
    console.warn("Firestore not connected. Showing demo data.");
    
    const demoLogs = [];
    const users = ["demo_student_A", "demo_student_B", "demo_student_C"];
    
    // カード0〜4に対して適当なデータを生成
    for (let cardIdx = 0; cardIdx < 5; cardIdx++) {
      users.forEach(u => {
        // ランダムに反応させる
        if (Math.random() > 0.4) {
          const rType = Math.random() > 0.3 ? "good" : "hmm";
          const memo = Math.random() > 0.8 ? "ここの式変形がわかりません" : "";
          
          demoLogs.push({
            contentId: problemId,
            cardIndex: cardIdx,
            userId: u,
            reaction: rType,
            memo: memo,
            timestamp: new Date()
          });
        }
      });
    }
    return demoLogs;
  }
}