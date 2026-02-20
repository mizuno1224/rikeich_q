# コンテンツ作成リクエストをスプレッドシートに記録する設定

生徒・教員が「📖リクエスト」「📹リクエスト」を押すと、リクエスト内容を **Google スプレッドシート** に記録できます。

## 手順概要

1. Google スプレッドシートを用意する  
2. スプレッドシートに紐づく「Apps Script」で Web アプリを作成する  
3. デプロイして取得した URL をサイトの設定に書く  

---

## 1. スプレッドシートを作る

1. [Google スプレッドシート](https://sheets.google.com) で新規作成  
2. 1行目に次のヘッダーを入力（A1〜G1）  

   | A | B | C | D | E | F | G |
   |---||---||---||---||---|---|
   | 種別 | 教材名 | 科目名 | 章・分野 | 問題パス | 問題タイトル | 日時 |

3. シート名は「リクエスト」など分かりやすい名前にしておく  

---

## 2. Apps Script を書く

1. スプレッドシートのメニュー **拡張機能** → **Apps Script** を開く  
2. デフォルトの `function myFunction() {}` を削除し、次のコードを貼り付けて保存する  

```javascript
/**
 * コンテンツ作成リクエストをスプレッドシートに追記する Web アプリ
 * POST で JSON を受け取り、シートの次の行に追加する
 */
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var body = e.postData ? JSON.parse(e.postData.contents) : {};
    var row = [
      body.type === "video" ? "動画" : "HTML",
      body.materialName || "",
      body.subjectName || "",
      body.fieldName || "",
      body.problemPath || "",
      body.problemTitle || "",
      body.timestamp || new Date().toISOString()
    ];
    sheet.appendRow(row);
    return createJsonResponse({ ok: true });
  } catch (err) {
    return createJsonResponse({ ok: false, error: String(err) }, 500);
  }
}

function createJsonResponse(obj, statusCode) {
  statusCode = statusCode || 200;
  var output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
```

3. **CORS 対応のため、サイトから呼べるようにする**  
   - 上記の `return createJsonResponse(...)` の戻り値にヘッダーを付ける必要はありません（Apps Script の Web アプリは同一オリジン扱いで動作します）。  
   - 外部サイト（Physics Lab. のドメイン）から呼ぶ場合は、**「デプロイ」時に「次のユーザーとして実行」を自分、「誰がアクセスできるか」を「全員」** にすると、多くの環境でリクエストが届きます。  
   - それでも CORS エラーになる場合は、次のように **オプションリクエスト（OPTIONS）にも対応** するとよいです。  

```javascript
function doGet(e) {
  return createJsonResponse({ message: "POST only" });
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var body = e.postData ? JSON.parse(e.postData.contents) : {};
    var row = [
      body.type === "video" ? "動画" : "HTML",
      body.materialName || "",
      body.subjectName || "",
      body.fieldName || "",
      body.problemPath || "",
      body.problemTitle || "",
      body.timestamp || new Date().toISOString()
    ];
    sheet.appendRow(row);
    return createJsonResponse({ ok: true });
  } catch (err) {
    return createJsonResponse({ ok: false, error: String(err) }, 500);
  }
}

function createJsonResponse(obj, statusCode) {
  statusCode = statusCode || 200;
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

（Google の Web アプリは GET が来てもエラーにしないよう doGet を用意しておくと扱いやすいです。）

---

## 3. Web アプリとしてデプロイする

1. Apps Script エディタで **デプロイ** → **新しいデプロイ**  
2. 種類で **ウェブアプリ** を選択  
3. 設定  
   - **説明**: 任意（例：「リクエスト記録」）  
   - **次のユーザーとして実行**: 自分  
   - **誰がアクセスできるか**: **全員**  
4. **デプロイ** を押す  
5. **ウェブアプリの URL** が表示されるのでコピーする  
   - 形式は `https://script.google.com/macros/s/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec` のようになります  

---

## 4. サイト側の設定

1. プロジェクトの **`config/firebase-config.js`** を開く  
2. 末尾の  

   ```javascript
   window.contentRequestSpreadsheetUrl = "";
   ```  

   の `""` の中に、コピーした **ウェブアプリの URL** を貼り付けて保存する  

   ```javascript
   window.contentRequestSpreadsheetUrl = "https://script.google.com/macros/s/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec";
   ```  

3. サイトを再読み込みすると、リクエスト送信先がスプレッドシート用 Web アプリになります  

- **URL を空のまま** にすると、従来どおり **Firestore** の `content_requests` に保存されます（Firebase 設定がある場合）。  

---

## 送信されるデータ（JSON）

| キー | 説明 |
|------|------|
| `type` | `"html"` または `"video"` |
| `materialName` | 教材名 |
| `subjectName` | 科目名 |
| `fieldName` | 章・分野名 |
| `problemPath` | 問題の解説パス |
| `problemTitle` | 問題タイトル |
| `timestamp` | ISO 8601 形式の日時 |

---

## CORS について（別ドメインでサイトを配信している場合）

サイトを **Firebase Hosting や GitHub Pages など、`script.google.com` と異なるドメイン** で配信している場合、ブラウザの CORS により、Web アプリへの `fetch` がブロックされ、「スプレッドシートへの送信に失敗しました」となることがあります。

その場合は次のいずれかを検討してください。

- **Firestore に保存する**: `contentRequestSpreadsheetUrl` を空のままにし、従来どおり Firestore の `content_requests` に保存する。教員・管理画面で一覧を確認できる。
- **中継サーバーを用意する**: 同じドメインのサーバー（Cloud Functions など）でリクエストを受け、そのサーバーから Apps Script の URL へ転送する。
- **同じオリジンで試す**: 同一ドメインで配信している場合や、ローカルで `file://` や `localhost` で開いている場合は、問題なく送信できることがあります。

---

## トラブルシューティング

- **「スプレッドシートへの送信に失敗しました」と出る**  
  - デプロイの「誰がアクセスできるか」が **全員** になっているか確認する  
  - URL のコピーミス（前後の空白や欠け）がないか確認する  
  - ブラウザの開発者ツール（F12）の「ネットワーク」で、該当リクエストが 200 で返っているか・CORS エラーになっていないか確認する  

- **スプレッドシートに追記されない**  
  - Apps Script の「実行ログ」や「ログ」でエラーが出ていないか確認する  
  - `getActiveSheet()` で、今開いている（または最初の）シートに追記されます。記録用のシートを指定したい場合は、`getSheetByName("リクエスト")` などに変更してください。
