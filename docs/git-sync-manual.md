# Git リモート・ローカル同期マニュアル

リモート（GitHub など）とローカルを「新しい方」に合わせて同期する手順です。

---

## 1. いつ使うか

- 別の PC や GitHub 上で変更を入れたあと、この PC の内容を最新にしたい
- どちらが新しいか分からないが、両方を同じ状態に揃えたい

---

## 2. 基本の流れ（3ステップ）

### ステップ 1：現在の状態を確認する

プロジェクトのフォルダでターミナルを開き、次を実行します。

```bash
git status
```

- **「Your branch is up to date with 'origin/main'」**  
  → いったんはリモートと一致している状態です。このあと `git fetch` で最新を取ります。

### ステップ 2：リモートの最新情報を取得する

```bash
git fetch
```

- リモートの最新コミット情報だけを取得します（ローカルのファイルはまだ変わりません）。
- 例：`main -> origin/main` のように、リモート側が進んでいると表示されることがあります。

### ステップ 3：新しい方に合わせる

#### パターン A：リモートの方が新しい場合（よくあるパターン）

`git fetch` のあと、リモートにだけ新しいコミットがあるときは、次でローカルをリモートに合わせます。

```bash
git pull origin main
```

- これでローカルがリモートと同じ（新しい方）になります。
- 「Fast-forward」と出れば、履歴が一直線に進んだ状態でマージされています。

#### パターン B：ローカルの方が新しい場合

ローカルにだけコミットがあって、まだ push していないときは、次でリモートをローカルに合わせます。

```bash
git push origin main
```

- リモートがローカル（新しい方）と同じ内容になります。

---

## 3. どちらが「新しい」か確認する方法

`git fetch` を実行したあとに、次で比較できます。

```bash
# ローカル main と リモート origin/main の差分
git log main..origin/main --oneline   # リモートにあってローカルにないコミット
git log origin/main..main --oneline   # ローカルにあってリモートにないコミット
```

- **1つ目にコミットが表示される** → リモートの方が新しい → `git pull origin main`
- **2つ目にコミットが表示される** → ローカルの方が新しい → `git push origin main`
- **両方とも何も出ない** → すでに同じ状態

---

## 4. よく使う「同期コマンド」まとめ

| 目的 | コマンド |
|------|----------|
| リモートの最新を取得（ファイルはまだ更新しない） | `git fetch` |
| リモートが新しい → ローカルをリモートに合わせる | `git pull origin main` |
| ローカルが新しい → リモートをローカルに合わせる | `git push origin main` |
| 同期後の状態確認 | `git status` |

---

## 5. 注意点

1. **作業中の変更がある場合**  
   `git status` で「Changes not staged」や「Untracked files」が出る場合は、先に次を決めてから同期してください。
   - **残す** → `git add` → `git commit` してから `pull` / `push`
   - **捨てる** → `git checkout .` や `git clean` など（必要な場合のみ）

2. **ブランチ名が main でない場合**  
   実際に使っているブランチ名（例：`master`）に読み替えてください。  
   - 例：`git pull origin master` / `git push origin master`

3. **コンフリクトが出た場合**  
   `git pull` のときに「Conflict」と出たら、ファイル内の `<<<<<<<` ～ `>>>>>>>` を編集して解消し、  
   `git add` → `git commit` してから再度 `git push` します。

---

## 6. クイックリファレンス（コピペ用）

**「とにかくリモートの最新に合わせたい」とき：**

```bash
git fetch
git pull origin main
git status
```

**「ローカルの変更をリモートに反映したい」とき：**

```bash
git status
git add .
git commit -m "変更内容のメッセージ"
git push origin main
```

---

*最終更新：このマニュアルは、リモートとローカルを「新しい方」に揃える作業をまとめたものです。*
