/**
 * data/materials/*.json の全 explanationPath に対し、ファイルが存在するかチェックする。
 * 使い方: node scripts/check-explanation-paths.js
 * ルートで実行するか、scripts からは node check-explanation-paths.js（要パス調整）
 */
var fs = require("fs");
var path = require("path");

var rootDir = path.join(__dirname, "..");
var manifestPath = path.join(rootDir, "data", "manifest.json");
var materialsDir = path.join(rootDir, "data", "materials");

function readJson(filePath) {
  try {
    var content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function collectPaths(obj, out) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(function (item) {
      collectPaths(item, out);
    });
    return;
  }
  if (obj.explanationPath) {
    out.push(obj.explanationPath);
  }
  if (obj.subjects) {
    obj.subjects.forEach(function (sub) {
      if (sub.fields) {
        sub.fields.forEach(function (fld) {
          if (fld.problems) {
            fld.problems.forEach(function (p) {
              if (p.explanationPath) out.push(p.explanationPath);
            });
          }
        });
      }
    });
  }
}

var manifest = readJson(manifestPath);
if (!manifest || !Array.isArray(manifest)) {
  console.error("manifest.json の読み込みに失敗しました");
  process.exit(1);
}

var allPaths = [];
manifest.forEach(function (entry) {
  var matPath = entry.path;
  if (!matPath) return;
  var fullPath = path.join(rootDir, matPath);
  var data = readJson(fullPath);
  if (data) collectPaths(data, allPaths);
});

var uniquePaths = [];
var seen = {};
allPaths.forEach(function (p) {
  if (!seen[p]) {
    seen[p] = true;
    uniquePaths.push(p);
  }
});

var missing = [];
var checked = 0;
uniquePaths.forEach(function (relPath) {
  var fullPath = path.join(rootDir, relPath);
  checked++;
  if (!fs.existsSync(fullPath)) {
    missing.push(relPath);
  }
});

if (missing.length === 0) {
  console.log("OK: " + checked + " 件の解説パスを確認しました。不足はありません。");
  process.exit(0);
}

console.error("次の " + missing.length + " 件の解説ファイルが見つかりません:");
missing.forEach(function (p) {
  console.error("  - " + p);
});
process.exit(1);
