/* js/data.js */

// --- 1. MathJax Config ---
window.MathJax = {
  tex: {
    inlineMath: [["$", "$"], ["\\(", "\\)"]],
    displayMath: [["$$", "$$"]],
    macros: {
      strong: ['\\textcolor{#3b82f6}{\\boldsymbol{#1}}', 1]
    }
  },
  svg: { fontCache: "global" },
};

// --- 2. Firebase Config ---
window.appFirebaseConfig = {
  // ... (既存設定) ...
};