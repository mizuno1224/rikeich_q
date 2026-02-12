/**
 * sw.js の CACHE_NAME のバージョン番号を 1 つ増やす。
 * デプロイ前に実行すると、iPad/Safari 等でキャッシュが自動で更新される。
 */
var fs = require("fs");
var path = require("path");

var swPath = path.join(__dirname, "..", "sw.js");
var content = fs.readFileSync(swPath, "utf8");

var match = content.match(/CACHE_NAME\s*=\s*"rikeich-explanations-v(\d+)"/);
if (!match) {
  console.error("bump-sw-cache-version: CACHE_NAME のパターンが見つかりません");
  process.exit(1);
}

var current = parseInt(match[1], 10);
var next = current + 1;
var newContent = content.replace(
  /CACHE_NAME\s*=\s*"rikeich-explanations-v\d+"/,
  'CACHE_NAME = "rikeich-explanations-v' + next + '"'
);

fs.writeFileSync(swPath, newContent, "utf8");
console.log("sw.js: キャッシュ名を v" + current + " → v" + next + " に更新しました");
