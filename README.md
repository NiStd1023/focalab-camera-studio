# FOCALAB 光圈實驗室

用瀏覽器練習攝影。選擇「雨後台北」或「山間茶園」，也可以上傳自己的照片。調整相機後，直接在觀景窗比較構圖、曝光、景深、色調與動態拖影。

[開啟攝影模擬器](https://nistd1023.github.io/focalab-camera-studio/) · [原始發布站](https://focalab-camera-studio.naturalsalmon.chatgpt.site/)

## 可以練習什麼

- 在 P、S、A、M 模式調整光圈、快門與 ISO，搭配測光及曝光指示判讀亮度。
- 切換 18 至 600 mm 的 11 個焦段，點選或手動對焦，比較視角、景深與安全快門。
- 分別調整環境光與白平衡 K 值。匯入照片時，模擬器會依支援的 EXIF 光源資訊或影像色彩估算光源。
- 在「主體動態」點選、框選或塗抹移動範圍，用不同大小的筆刷補畫、用橡皮擦修邊，套用後以慢快門觀察拖影。可以移除標記或還原場景預設。
- 開關防手震、測試手持穩定度、完成六項拍攝任務，並在相簿比較拍攝結果。

## 在電腦上執行

複製專案後，在版本庫根目錄執行下列指令，再開啟 <http://localhost:8000/>。網站以原生 HTML、CSS 與 JavaScript 執行，範例圖片和字型都包含在專案中。

```sh
python3 -m http.server 8000 --directory docs
```

## 更新與發布

`main` 是公開版本的主分支。GitHub Pages 的發布來源為 **Deploy from a branch → main → /docs**。將網站變更提交至 `main` 後，GitHub 會自動發布，可在版本庫的 **Actions** 確認結果。

| 檔案或目錄 | 用途 |
| --- | --- |
| `docs/index.html`、`docs/style.css`、`docs/app.js` | 相機介面、操作流程與場景狀態 |
| `docs/optics.js`、`docs/renderer.js` | 焦段、景深、曝光、白平衡與影像渲染 |
| `docs/motion-editor.js`、`docs/motion-mask.js` | 主體範圍編輯及其在原圖上的位置 |
| `docs/steady.js`、`docs/learning.js`、`docs/exif.js` | 穩定度測驗、任務、相簿儲存與照片資訊 |
| `docs/sw.js`、`docs/manifest.webmanifest` | 離線快取與 PWA 安裝 |
| `docs/assets/` | 示範圖、圖示、字型與字型授權原文 |

修改快取中的程式或素材時，請同步更新 `sw.js` 的快取版本與相關資源網址。新增離線需要的檔案時，將相對路徑加入預先快取清單。

## 版本與資料

- **v1.1.0** 加入主體框選、可調筆刷、局部擦除、移除標記與選取範圍保存。
- **v1.0.0** 初版攝影模擬器，含點選主體、相機控制、拍攝任務、相簿與 PWA。

初次連網載入並完成快取後，可在支援的瀏覽器離線練習。上傳照片、拍攝結果、主體範圍及學習進度儲存在當前網站的瀏覽器中。原始發布站與 GitHub Pages 各自保存練習資料。需要保留的成品可以從相簿下載。

示範照片為專案生成素材。內附字型為 Noto Sans CJK 的繁體中文字型子集，授權原文收錄於 [FONT-LICENSE.txt](docs/assets/FONT-LICENSE.txt)。
