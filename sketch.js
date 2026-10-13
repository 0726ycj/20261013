const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYP0HitODGD8yKKhM3f2fkvUEjUnXWDCyrw_WgEhzOjhgsL-C9zNVMLqrYpYw4EoLovpRIeKxLr0Gy/pub?gid=1987158365&single=true&output=csv"; // 設定老師發布到網路的 Google 試算表 CSV 網址。
const REQUIRED_COLUMNS = ["question", "option1", "option2", "option3", "option4", "answer"]; // 設定 CSV 必須使用的固定欄位順序。
const QUIZ_SIZE = 5; // 設定每次測驗要抽出的題目數量。
const OPTION_COUNT = 4; // 設定每一題固定提供四個選項。
const correctAnswerColor = "#bfdbf7"; // 設定答錯時正確選項使用的背景顏色。
const CHINESE_FONT = "Noto Serif TC"; // 設定中文與中英混合文字使用的 Google Fonts 字型。
const LATIN_FONT = "Edu QLD Hand"; // 設定純英文與數字文字使用的 Google Fonts 字型。
let fontsReady = false; // 記錄 Google Fonts 是否已經準備完成。
let questionBank = []; // 儲存從 CSV 動態讀取並驗證後的完整題庫。
let quizQuestions = []; // 儲存每次從完整題庫不重複抽出的五題。
let loadingState = true; // 記錄目前是否正在載入題庫。
let loadErrorMessage = ""; // 儲存題庫載入失敗或資料格式錯誤的繁體中文訊息。
let currentQuestion = 0; // 記錄目前顯示的題目索引。
let score = 0; // 記錄使用者目前答對的題數。
let selectedAnswer = -1; // 記錄使用者在目前題目選取的選項索引。
let answerChecked = false; // 記錄目前題目是否已經檢查答案。
let quizFinished = false; // 記錄測驗是否已經全部完成。
let feedbackMessage = ""; // 儲存目前題目的答題回饋文字。
let optionRects = []; // 儲存四個選項目前的響應式點擊範圍。
let nextButton = {}; // 儲存下一題或查看結果按鈕的點擊範圍。
let restartButton = {}; // 儲存重新開始按鈕的點擊範圍。
let loadSequence = 0; // 記錄題庫載入次數以避免舊的非同步回呼覆蓋新資料。

function setup() { // 定義 p5.js 程式開始時只執行一次的初始化函式。
  const canvas = createCanvas(windowWidth, windowHeight); // 依瀏覽器視窗大小建立全螢幕畫布。
  canvas.parent("app"); // 將畫布放入 index.html 的 app 容器。
  canvas.style("display", "block"); // 移除畫布下方的預設空白。
  document.body.style.margin = "0"; // 移除瀏覽器預設的頁面外距。
  document.body.style.overflow = "hidden"; // 隱藏頁面捲軸以維持全螢幕體驗。
  document.body.style.fontFamily = '"Noto Serif TC", serif'; // 將網頁中文預設字型設定為 Noto Serif TC。
  textAlign(CENTER, CENTER); // 設定畫布文字預設為水平與垂直置中。
  rectMode(CORNER); // 設定矩形座標以左上角為起點。
  noStroke(); // 設定圖形預設不繪製外框。
  document.fonts.ready.then(function () { // 等待 index.html 載入的 Google Fonts 完成。
    fontsReady = true; // 記錄字型已經可以使用。
  }); // 結束 Google Fonts 完成後的回呼函式。
  beginQuestionBankLoad(); // 開始從 Google 試算表 CSV 載入最新題庫。
} // 結束 setup 函式。

function createCacheBustedCsvUrl() { // 建立保留原查詢參數並加入更新時間的題庫網址。
  const configuredUrl = String(GOOGLE_SHEET_CSV_URL).trim(); // 取得老師在設定常數中填入的網址。
  if (configuredUrl.length === 0 || configuredUrl === "請貼上Google試算表CSV網址") { // 判斷網址是否仍未設定。
    return ""; // 未設定網址時回傳空字串交由載入流程顯示說明。
  } // 結束未設定網址判斷。
  try { // 嘗試解析老師提供的完整網址。
    const csvUrl = new URL(configuredUrl); // 使用瀏覽器 URL 物件解析網址與原有查詢參數。
    if (csvUrl.protocol !== "https:" && csvUrl.protocol !== "http:") { // 判斷網址是否使用可讀取的 HTTP 或 HTTPS 協定。
      return ""; // 協定不正確時回傳空字串交由載入流程顯示錯誤。
    } // 結束網址協定判斷。
    csvUrl.searchParams.set("updated_at", String(Date.now())); // 加入時間參數避免瀏覽器持續使用舊 CSV 快取。
    return csvUrl.toString(); // 回傳已保留原查詢參數並完成快取破除的網址。
  } catch (error) { // 處理無法解析的網址格式。
    console.error("Google 試算表 CSV 網址格式錯誤：", error); // 將技術細節寫入瀏覽器主控台方便老師檢查。
    return ""; // 網址格式錯誤時回傳空字串交由載入流程顯示錯誤。
  } // 結束網址解析例外處理。
} // 結束建立快取破除網址函式。

function getUrlSetupMessage() { // 建立尚未設定 Google 試算表網址時的操作說明。
  return "尚未設定 Google 試算表 CSV 網址。請先在 Google 試算表選擇「檔案」→「共用」→「發布到網路」，選擇工作表並選擇 CSV 後發布，再把產生的網址貼到 sketch.js 頂端 GOOGLE_SHEET_CSV_URL，儲存後重新整理網站。"; // 回傳清楚的繁體中文設定步驟。
} // 結束建立網址設定說明函式。

function getLoadFailureMessage() { // 建立 Google 試算表 CSV 載入失敗時的可理解訊息。
  return "無法讀取 Google 試算表 CSV。請確認網址正確、試算表已發布到網路且發布格式為 CSV。若出現 CORS 錯誤，請使用可公開讀取的發布 CSV 網址；若出現 404，請檢查試算表 ID、工作表 gid 與網址。"; // 回傳涵蓋常見錯誤原因的繁體中文訊息。
} // 結束建立載入失敗訊息函式。

function beginQuestionBankLoad() { // 定義初次載入或重新開始時讀取最新題庫的函式。
  loadSequence += 1; // 增加載入序號以識別目前最新的非同步請求。
  const currentLoadSequence = loadSequence; // 保存這次載入使用的序號。
  loadingState = true; // 顯示題庫載入中畫面。
  loadErrorMessage = ""; // 清除上一輪可能存在的錯誤訊息。
  questionBank = []; // 清除上一輪題庫以避免錯誤時誤用舊題目。
  quizQuestions = []; // 清除上一輪抽出的題目。
  optionRects = []; // 清除上一輪選項點擊範圍。
  nextButton = {}; // 清除上一輪下一題按鈕範圍。
  restartButton = {}; // 清除上一輪重新開始按鈕範圍。
  const requestUrl = createCacheBustedCsvUrl(); // 建立帶有 updated_at 時間參數的最新 CSV 網址。
  if (requestUrl.length === 0) { // 判斷網址是否尚未設定或格式不正確。
    loadingState = false; // 結束載入中狀態。
    loadErrorMessage = GOOGLE_SHEET_CSV_URL === "請貼上Google試算表CSV網址" ? getUrlSetupMessage() : "Google 試算表 CSV 網址格式不正確，請在 sketch.js 頂端填入完整的 http 或 https 網址。"; // 顯示對應的網址設定錯誤。
    return; // 網址無效時停止本次載入。
  } // 結束網址有效性判斷。
  loadTable(requestUrl, "csv", "header", function (table) { // 使用 p5.js 以 CSV 標題列模式讀取 Google 試算表。
    if (currentLoadSequence !== loadSequence) { // 判斷這是否為已經過時的舊載入回呼。
      return; // 舊回呼不覆蓋最新的題庫狀態。
    } // 結束舊回呼判斷。
    handleTableLoaded(table); // 將成功取得的表格交給驗證與抽題流程。
  }, function (error) { // 設定 Google 試算表 CSV 讀取失敗時的回呼。
    if (currentLoadSequence !== loadSequence) { // 判斷這是否為已經過時的舊載入回呼。
      return; // 舊回呼不覆蓋最新的題庫狀態。
    } // 結束舊回呼判斷。
    handleTableLoadFailed(error); // 將錯誤交給統一的繁體中文錯誤畫面處理。
  }); // 結束 Google 試算表 CSV 載入。
} // 結束題庫載入函式。

function handleTableLoaded(table) { // 定義 CSV 成功載入後的處理函式。
  const validationResult = parseAndValidateTable(table); // 解析並檢查 CSV 的欄位、題目與答案資料。
  if (!validationResult.valid) { // 判斷 CSV 是否通過完整資料驗證。
    loadingState = false; // 停止顯示載入中狀態。
    loadErrorMessage = validationResult.message; // 顯示具體的繁體中文資料錯誤訊息。
    return; // 發現資料錯誤時停止後續測驗初始化。
  } // 結束資料驗證失敗的處理區塊。
  questionBank = validationResult.questions; // 保存驗證成功的完整題庫且不修改原始資料。
  loadingState = false; // 將載入中狀態改為完成。
  loadErrorMessage = ""; // 清除可能存在的舊錯誤訊息。
  resetQuizFromBank(); // 載入完成後從最新完整題庫隨機抽出五題。
} // 結束 CSV 成功載入處理函式。

function handleTableLoadFailed(error) { // 定義 CSV 載入失敗時的錯誤處理函式。
  loadingState = false; // 停止顯示載入中狀態。
  loadErrorMessage = getLoadFailureMessage(); // 顯示涵蓋 CORS、404 與未發布狀況的繁體中文錯誤訊息。
  console.error("Google 試算表 CSV 載入錯誤：", error); // 將詳細錯誤保留在瀏覽器主控台方便除錯。
} // 結束 CSV 載入失敗處理函式。

function parseAndValidateTable(table) { // 定義解析並驗證 p5.Table 題庫資料的函式。
  if (!table || typeof table.getRowCount !== "function") { // 判斷 p5 是否傳回有效的表格物件。
    return { valid: false, message: "題庫格式無法讀取，請確認 Google 試算表已發布為 CSV。" }; // 回傳無效表格的繁體中文錯誤訊息。
  } // 結束無效表格判斷。
  const actualColumns = Array.isArray(table.columns) ? table.columns : []; // 取得 CSV 實際欄位名稱以便檢查。
  const hasCorrectColumns = REQUIRED_COLUMNS.length === actualColumns.length && REQUIRED_COLUMNS.every(function (columnName, index) { return actualColumns[index] === columnName; }); // 檢查欄位數量、名稱與順序是否完全符合規定。
  if (!hasCorrectColumns) { // 判斷 CSV 欄位是否不符合固定格式。
    return { valid: false, message: "題庫欄位錯誤，Google 試算表第一列必須是 question,option1,option2,option3,option4,answer。" }; // 回傳欄位格式錯誤訊息。
  } // 結束欄位格式錯誤判斷。
  if (table.getRowCount() < QUIZ_SIZE) { // 判斷題庫是否至少包含五筆題目。
    return { valid: false, message: `題庫不足，至少需要 ${QUIZ_SIZE} 題，目前只有 ${table.getRowCount()} 題。` }; // 回傳題庫數量不足的繁體中文訊息。
  } // 結束題庫數量不足判斷。
  const parsedQuestions = []; // 建立新的陣列儲存解析後的題目，不改寫 p5.Table 原始資料。
  for (let rowIndex = 0; rowIndex < table.getRowCount(); rowIndex += 1) { // 逐列讀取 CSV 題目資料。
    const row = table.getRow(rowIndex); // 取得目前資料列。
    const questionText = row.getString("question").trim(); // 動態讀取並整理題目文字。
    const options = [row.getString("option1").trim(), row.getString("option2").trim(), row.getString("option3").trim(), row.getString("option4").trim()]; // 動態讀取四個選項文字。
    const answerNumber = Number(row.getString("answer").trim()); // 將 CSV 中 1 到 4 的答案編號轉換成數字。
    const hasValidText = questionText.length > 0 && options.every(function (optionText) { return optionText.length > 0; }); // 檢查題目與四個選項是否都有內容。
    const hasValidAnswer = Number.isInteger(answerNumber) && answerNumber >= 1 && answerNumber <= OPTION_COUNT; // 檢查答案是否為 1 到 4 的整數。
    if (!hasValidText || !hasValidAnswer) { // 判斷目前資料列是否有空白文字或錯誤答案。
      return { valid: false, message: `題庫第 ${rowIndex + 2} 列資料無效，題目與四個選項不可空白，answer 必須是 1 到 4。` }; // 回傳指出資料列位置的錯誤訊息。
    } // 結束單列資料錯誤判斷。
    parsedQuestions.push({ question: questionText, options: options, answer: answerNumber - 1 }); // 建立新題目物件並將答案轉成 0-based 索引。
  } // 結束逐列解析迴圈。
  return { valid: true, questions: parsedQuestions }; // 回傳驗證成功且可供測驗使用的完整題庫。
} // 結束題庫解析驗證函式。

function draw() { // 定義 p5.js 每一幀執行的繪圖函式。
  background("#f4f7fb"); // 清除畫布並設定整體淡色背景。
  if (loadingState) { // 判斷題庫是否仍在載入中。
    drawStatusScreen("正在載入 Google 試算表題庫，請稍候。", "#183b56"); // 顯示指定的題庫載入中訊息。
    return; // 完成載入畫面後停止本幀其他繪圖。
  } // 結束載入中狀態判斷。
  if (loadErrorMessage.length > 0) { // 判斷是否存在題庫錯誤訊息。
    drawStatusScreen(loadErrorMessage, "#a33a3a"); // 顯示清楚的繁體中文題庫錯誤訊息。
    return; // 完成錯誤畫面後停止本幀其他繪圖。
  } // 結束題庫錯誤狀態判斷。
  if (quizFinished) { // 判斷測驗是否已經全部完成。
    drawResultScreen(); // 顯示答對題數與重新開始按鈕。
    return; // 完成結果畫面後停止本幀其他繪圖。
  } // 結束測驗完成狀態判斷。
  if (quizQuestions.length !== QUIZ_SIZE) { // 防止題目資料尚未準備好時存取不存在的題目。
    drawStatusScreen("題庫尚未準備完成，請稍候。", "#183b56"); // 顯示等待題庫準備完成的訊息。
    return; // 完成等待畫面後停止本幀其他繪圖。
  } // 結束題目資料未準備狀態判斷。
  drawQuizScreen(); // 顯示目前題目、四個選項與答題操作。
} // 結束 draw 函式。

function drawStatusScreen(message, colorValue) { // 定義繪製載入或錯誤狀態畫面的函式。
  const compact = width < 420 || height < 620; // 判斷目前畫面是否為手機窄小尺寸。
  const cardWidth = min(width - 28, 720); // 計算狀態卡片寬度並避免超出畫布。
  const cardHeight = min(height - 28, compact ? 300 : 260); // 計算狀態卡片高度並保留安全邊界。
  const cardX = (width - cardWidth) / 2; // 計算狀態卡片水平位置。
  const cardY = (height - cardHeight) / 2; // 計算狀態卡片垂直位置。
  fill("#ffffff"); // 設定狀態卡片背景為白色。
  rect(cardX, cardY, cardWidth, cardHeight, 20); // 繪製圓角狀態卡片。
  fill(colorValue); // 設定狀態文字顏色。
  textStyle(BOLD); // 設定狀態文字使用粗體。
  textSize(constrain(min(width * 0.052, height * 0.045), 16, 26)); // 設定適合各種畫面的狀態文字大小。
  drawTextByContent(message, cardX + 24, cardY + 24, max(0, cardWidth - 48), max(0, cardHeight - 48)); // 繪製可自動換行的狀態訊息。
  textStyle(NORMAL); // 將文字樣式還原為一般樣式。
} // 結束狀態畫面繪製函式。

function setTextFontByContent(content) { // 依文字內容判斷並套用對應 Google Fonts 字型。
  const textContent = String(content); // 將輸入內容統一轉換為字串。
  const hasChinese = /[\u3400-\u9fff\uf900-\ufaff]/u.test(textContent); // 判斷文字是否包含中文漢字。
  textFont(hasChinese ? CHINESE_FONT : LATIN_FONT); // 中文或混合內容使用 Noto Serif TC，純英文數字使用 Edu QLD Hand。
} // 結束字型判斷函式。

function drawTextByContent(content, x, y, widthValue, heightValue) { // 定義依內容套用字型並繪製文字的函式。
  setTextFontByContent(content); // 先依文字內容選擇正確字型。
  if (widthValue === undefined || heightValue === undefined) { // 判斷目前是否為不需要換行的單行文字。
    text(content, x, y); // 使用 p5.js 單行文字繪製方式。
    return; // 完成單行文字後結束函式。
  } // 結束單行文字判斷。
  text(content, x, y, widthValue, heightValue); // 使用 p5.js 指定範圍方式繪製可換行文字。
} // 結束文字繪製函式。

function windowResized() { // 定義瀏覽器視窗尺寸改變時執行的函式。
  resizeCanvas(windowWidth, windowHeight); // 依新的視窗寬高調整全螢幕畫布。
  optionRects = []; // 清除舊選項點擊範圍以便重新計算。
  nextButton = {}; // 清除舊下一題按鈕範圍以便重新計算。
  restartButton = {}; // 清除舊重新開始按鈕範圍以便重新計算。
} // 結束視窗尺寸變更函式。

function calculateQuizLayout() { // 定義計算響應式測驗版面的函式。
  const shortSide = min(width, height); // 取得畫布較短邊作為版面縮放基準。
  const margin = constrain(shortSide * 0.055, 14, 56); // 依畫布尺寸計算安全邊界。
  const panelWidth = max(0, min(width - margin * 2, 960)); // 限制內容面板寬度不超過畫布與最大寬度。
  const panelX = (width - panelWidth) / 2; // 計算內容面板的水平起點。
  const isCompact = height < 620 || width < 420; // 判斷是否需要手機緊湊版尺寸。
  const columns = width >= 640 ? 2 : 1; // 寬畫面使用雙欄，窄畫面使用單欄。
  const rows = ceil(OPTION_COUNT / columns); // 依欄數計算選項排列的列數。
  const titleSize = constrain(min(width * 0.065, height * 0.065), isCompact ? 21 : 24, 40); // 計算響應式標題大小。
  const progressSize = constrain(min(width * 0.042, height * 0.04), 14, 20); // 計算響應式進度文字大小。
  const questionSize = constrain(min(width * 0.052, height * 0.047), isCompact ? 15 : 17, 27); // 計算響應式題目文字大小。
  const optionSize = constrain(min(width * 0.045, height * 0.038), isCompact ? 14 : 15, 22); // 計算響應式選項文字大小。
  const topY = constrain(height * 0.055, isCompact ? 18 : 26, 52); // 計算標題頂端位置。
  const questionY = topY + titleSize + progressSize + (isCompact ? 16 : 22); // 計算題目卡片垂直位置。
  const questionHeight = constrain(height * (isCompact ? 0.16 : 0.145), 76, 142); // 計算題目卡片高度。
  const optionStartY = questionY + questionHeight + (isCompact ? 12 : 20); // 計算選項區域起點。
  const optionGap = constrain(shortSide * 0.022, 8, 15); // 計算選項之間的間距。
  const buttonHeight = constrain(height * 0.085, 48, 60); // 計算按鈕高度並保留觸控空間。
  const feedbackReserve = buttonHeight + (isCompact ? 38 : 46); // 預留回饋文字與按鈕的底部空間。
  const availableOptionHeight = max(40, height - optionStartY - feedbackReserve - 16); // 計算選項可使用的總高度。
  const calculatedOptionHeight = (availableOptionHeight - optionGap * (rows - 1)) / rows; // 依列數平均計算選項高度。
  const optionHeight = min(92, max(42, calculatedOptionHeight)); // 限制選項高度在可閱讀與可觸控的範圍。
  return { panelWidth, panelX, columns, rows, isCompact, titleSize, progressSize, questionSize, optionSize, topY, questionY, questionHeight, optionStartY, optionGap, optionHeight, buttonHeight }; // 回傳完整響應式版面資料。
} // 結束響應式版面計算函式。

function drawQuizScreen() { // 定義繪製答題畫面的函式。
  const layout = calculateQuizLayout(); // 取得目前畫面尺寸適用的版面配置。
  const questionData = quizQuestions[currentQuestion]; // 取得目前抽中題目的資料。
  drawHeader(layout); // 繪製測驗標題與答題進度。
  drawQuestionCard(layout, questionData); // 繪製目前題目的文字卡片。
  drawOptions(layout, questionData); // 繪製四個可操作的答案選項。
  drawFeedback(layout, questionData); // 繪製答題回饋與下一題按鈕。
} // 結束答題畫面繪製函式。

function drawHeader(layout) { // 定義繪製標題與進度的函式。
  fill("#183b56"); // 設定標題顏色。
  textStyle(BOLD); // 設定標題使用粗體。
  textSize(layout.titleSize); // 套用響應式標題大小。
  drawTextByContent("p5.js 簡易指令測驗", width / 2, layout.topY); // 繪製測驗標題。
  textStyle(NORMAL); // 將文字樣式還原為一般樣式。
  fill("#5b7083"); // 設定進度文字顏色。
  textSize(layout.progressSize); // 套用響應式進度文字大小。
  drawTextByContent(`第 ${currentQuestion + 1} 題／共 ${QUIZ_SIZE} 題`, width / 2, layout.topY + layout.titleSize + 8); // 繪製目前題目進度。
} // 結束標題繪製函式。

function drawQuestionCard(layout, questionData) { // 定義繪製題目卡片的函式。
  fill("#ffffff"); // 設定題目卡片背景為白色。
  rect(layout.panelX, layout.questionY, layout.panelWidth, layout.questionHeight, 16); // 繪製圓角題目卡片。
  fill("#183b56"); // 設定題目文字顏色。
  textStyle(BOLD); // 設定題目文字使用粗體。
  textSize(layout.questionSize); // 套用響應式題目文字大小。
  drawTextByContent(questionData.question, layout.panelX + 18, layout.questionY + 10, max(0, layout.panelWidth - 36), max(0, layout.questionHeight - 20)); // 繪製動態讀取的題目文字並自動換行。
  textStyle(NORMAL); // 將文字樣式還原為一般樣式。
} // 結束題目卡片繪製函式。

function drawOptions(layout, questionData) { // 定義繪製四個選項與其互動範圍的函式。
  optionRects = []; // 每次重繪前清除舊的選項範圍。
  for (let optionIndex = 0; optionIndex < questionData.options.length; optionIndex += 1) { // 逐一處理目前題目的四個動態選項。
    const column = optionIndex % layout.columns; // 計算目前選項所在的欄位。
    const row = floor(optionIndex / layout.columns); // 計算目前選項所在的列位。
    const columnWidth = (layout.panelWidth - layout.optionGap * (layout.columns - 1)) / layout.columns; // 計算單一選項寬度。
    const optionX = layout.panelX + column * (columnWidth + layout.optionGap); // 計算選項水平位置。
    const optionY = layout.optionStartY + row * (layout.optionHeight + layout.optionGap); // 計算選項垂直位置。
    const isCorrectOption = optionIndex === questionData.answer; // 判斷目前選項是否為正確答案。
    const shouldBounce = answerChecked && selectedAnswer !== questionData.answer && isCorrectOption; // 判斷答錯後是否讓正確選項上下跳動。
    const bounceOffset = shouldBounce ? sin(frameCount * 0.2) * min(8, layout.optionHeight * 0.12) : 0; // 計算正確選項的上下動畫位移。
    const visualY = optionY + bounceOffset; // 計算選項目前實際繪製的垂直位置。
    const optionRect = { x: optionX, y: visualY, width: columnWidth, height: layout.optionHeight }; // 建立與畫面同步的選項點擊範圍。
    optionRects.push(optionRect); // 將目前選項的互動範圍加入陣列。
    let optionColor = "#ffffff"; // 設定尚未作答時的選項背景色。
    if (answerChecked && isCorrectOption && selectedAnswer !== questionData.answer) { // 判斷答錯後的正確選項。
      optionColor = correctAnswerColor; // 套用指定的 #bfdbf7 正確答案背景色。
    } else if (answerChecked && optionIndex === selectedAnswer && selectedAnswer !== questionData.answer) { // 判斷使用者答錯時選取的選項。
      optionColor = "#fecaca"; // 將選錯的選項設為淡紅色。
    } else if (answerChecked && optionIndex === selectedAnswer && selectedAnswer === questionData.answer) { // 判斷使用者答對時選取的選項。
      optionColor = "#bbf7d0"; // 將答對的選項設為淡綠色。
    } // 結束選項背景色判斷。
    fill(optionColor); // 套用目前選項背景色。
    rect(optionRect.x, optionRect.y, optionRect.width, optionRect.height, 14); // 繪製圓角選項按鈕。
    fill("#2d5d7b"); // 設定選項英文字母顏色。
    textStyle(BOLD); // 設定選項英文字母使用粗體。
    textSize(max(14, layout.optionSize)); // 套用選項英文字母大小。
    drawTextByContent(`${String.fromCharCode(65 + optionIndex)}.`, optionRect.x + 25, optionRect.y + optionRect.height / 2); // 繪製 A 到 D 的選項編號。
    fill("#263746"); // 設定選項內容文字顏色。
    textStyle(NORMAL); // 將選項內容設定為一般字體樣式。
    textSize(layout.optionSize); // 套用選項內容文字大小。
    textAlign(LEFT, CENTER); // 設定選項內容靠左且垂直置中。
    drawTextByContent(questionData.options[optionIndex], optionRect.x + 48, optionRect.y + 8, max(0, optionRect.width - 60), max(0, optionRect.height - 16)); // 繪製從 CSV 動態讀取的選項文字。
    textAlign(CENTER, CENTER); // 將文字對齊還原為水平與垂直置中。
    textStyle(NORMAL); // 確保後續繪圖不沿用選項樣式。
  } // 結束四個選項的繪製迴圈。
} // 結束選項繪製函式。

function drawFeedback(layout, questionData) { // 定義繪製答題回饋與下一題按鈕的函式。
  const optionsBottom = layout.optionStartY + layout.rows * layout.optionHeight + (layout.rows - 1) * layout.optionGap; // 計算所有選項的底部位置。
  const buttonWidth = min(layout.panelWidth, 240); // 計算下一題按鈕寬度。
  const buttonX = (width - buttonWidth) / 2; // 計算下一題按鈕水平位置。
  const idealButtonY = optionsBottom + (layout.isCompact ? 12 : 18); // 計算按鈕理想垂直位置。
  const buttonY = min(height - layout.buttonHeight - 16, idealButtonY); // 將按鈕限制在畫布安全範圍內。
  if (answerChecked) { // 判斷目前題目是否已經完成作答。
    fill(selectedAnswer === questionData.answer ? "#237804" : "#28536b"); // 依答對或答錯設定回饋文字顏色。
    textSize(layout.progressSize); // 設定回饋文字大小。
    drawTextByContent(feedbackMessage, width / 2, max(16, buttonY - 18)); // 繪製答題回饋文字。
    nextButton = { x: buttonX, y: buttonY, width: buttonWidth, height: layout.buttonHeight }; // 記錄下一題按鈕的互動範圍。
    fill("#183b56"); // 設定下一題按鈕背景顏色。
    rect(nextButton.x, nextButton.y, nextButton.width, nextButton.height, 12); // 繪製下一題按鈕。
    fill("#ffffff"); // 設定下一題按鈕文字顏色。
    textStyle(BOLD); // 設定下一題按鈕文字使用粗體。
    textSize(max(15, layout.optionSize)); // 設定下一題按鈕文字大小。
    drawTextByContent(currentQuestion === QUIZ_SIZE - 1 ? "查看結果" : "下一題", nextButton.x + nextButton.width / 2, nextButton.y + nextButton.height / 2); // 繪製下一題或查看結果文字。
    textStyle(NORMAL); // 將文字樣式還原為一般樣式。
  } else { // 處理尚未作答的畫面狀態。
    nextButton = {}; // 尚未作答時清除下一題按鈕範圍。
  } // 結束答題回饋狀態判斷。
} // 結束答題回饋繪製函式。

function drawResultScreen() { // 定義繪製測驗結果畫面的函式。
  const compact = width < 420 || height < 620; // 判斷結果頁是否需要手機緊湊配置。
  const cardWidth = min(width - 24, 620); // 計算結果卡片寬度。
  const cardHeight = min(height - 24, compact ? 420 : 440); // 計算結果卡片高度。
  const cardX = (width - cardWidth) / 2; // 計算結果卡片水平位置。
  const cardY = (height - cardHeight) / 2; // 計算結果卡片垂直位置。
  const titleSize = constrain(min(width * 0.09, height * 0.08), 26, 48); // 計算結果標題大小。
  const scoreSize = constrain(min(width * 0.18, height * 0.17), 48, 92); // 計算成績數字大小。
  const resultTextSize = constrain(min(width * 0.052, height * 0.045), 15, 23); // 計算結果鼓勵文字大小。
  fill("#ffffff"); // 設定結果卡片背景為白色。
  rect(cardX, cardY, cardWidth, cardHeight, 20); // 繪製圓角結果卡片。
  fill("#183b56"); // 設定結果標題顏色。
  textStyle(BOLD); // 設定結果標題使用粗體。
  textSize(titleSize); // 套用結果標題大小。
  drawTextByContent("測驗完成！", width / 2, cardY + cardHeight * 0.19); // 顯示測驗完成標題。
  fill("#2d5d7b"); // 設定成績數字顏色。
  textSize(scoreSize); // 套用成績數字大小。
  drawTextByContent(`${score}／${QUIZ_SIZE}`, width / 2, cardY + cardHeight * 0.45); // 顯示答對題數與五題總數。
  fill("#5b7083"); // 設定鼓勵文字顏色。
  textStyle(NORMAL); // 將鼓勵文字設定為一般樣式。
  textSize(resultTextSize); // 套用鼓勵文字大小。
  drawTextByContent(getResultMessage(), cardX + 18, cardY + cardHeight * 0.64, max(0, cardWidth - 36), 54); // 顯示依分數變化的鼓勵文字。
  const buttonWidth = min(cardWidth - 36, 240); // 計算重新開始按鈕寬度。
  const buttonHeight = constrain(height * 0.085, 48, 60); // 計算重新開始按鈕高度。
  const buttonY = min(cardY + cardHeight - buttonHeight - 24, cardY + cardHeight * 0.77); // 計算重新開始按鈕垂直位置。
  restartButton = { x: (width - buttonWidth) / 2, y: buttonY, width: buttonWidth, height: buttonHeight }; // 記錄重新開始按鈕互動範圍。
  fill("#183b56"); // 設定重新開始按鈕背景顏色。
  rect(restartButton.x, restartButton.y, restartButton.width, restartButton.height, 12); // 繪製重新開始按鈕。
  fill("#ffffff"); // 設定重新開始按鈕文字顏色。
  textStyle(BOLD); // 設定重新開始按鈕文字使用粗體。
  textSize(max(15, resultTextSize - 1)); // 設定重新開始按鈕文字大小。
  drawTextByContent("重新開始並更新題庫", width / 2, restartButton.y + restartButton.height / 2); // 繪製重新開始按鈕文字。
  textStyle(NORMAL); // 將文字樣式還原為一般樣式。
} // 結束結果畫面繪製函式。

function getResultMessage() { // 定義依分數回傳繁體中文鼓勵文字的函式。
  if (score === QUIZ_SIZE) { // 判斷是否五題全部答對。
    return "太棒了！你已經熟悉這些 p5.js 指令。"; // 回傳滿分鼓勵訊息。
  } // 結束滿分判斷。
  if (score >= 3) { // 判斷是否至少答對三題。
    return "做得很好！再練習一下就能全部答對。"; // 回傳中高分鼓勵訊息。
  } // 結束中高分判斷。
  return "別灰心！重新挑戰一次，熟悉 p5.js 指令吧！"; // 回傳需要繼續練習的鼓勵訊息。
} // 結束結果訊息函式。

function mousePressed() { // 定義滑鼠按下畫布時執行的函式。
  handlePointerPress(mouseX, mouseY); // 將滑鼠座標交給共用的點擊處理函式。
  return false; // 阻止瀏覽器額外處理滑鼠事件。
} // 結束滑鼠操作函式。

function touchStarted() { // 定義觸控按下畫布時執行的函式。
  if (touches.length > 0) { // 判斷目前是否至少有一個觸控點。
    handlePointerPress(touches[0].x, touches[0].y); // 使用第一個觸控點座標處理操作。
  } // 結束觸控點存在判斷。
  return false; // 阻止瀏覽器預設觸控滑動行為。
} // 結束觸控操作函式。

function handlePointerPress(pointX, pointY) { // 定義滑鼠與觸控共用的點擊處理函式。
  if (loadingState || loadErrorMessage.length > 0 || quizQuestions.length !== QUIZ_SIZE) { // 判斷目前是否尚未完成載入或存在錯誤。
    return; // 載入或錯誤狀態不處理點擊。
  } // 結束載入與錯誤狀態判斷。
  if (quizFinished) { // 判斷目前是否位於測驗結果畫面。
    if (isPointInside(pointX, pointY, restartButton)) { // 判斷是否按下重新開始按鈕。
      restartQuiz(); // 隨機抽取五題並重設測驗狀態。
    } // 結束重新開始按鈕判斷。
    return; // 結果畫面不再處理其他點擊。
  } // 結束結果畫面判斷。
  if (answerChecked) { // 判斷目前題目是否已經作答。
    if (isPointInside(pointX, pointY, nextButton)) { // 判斷是否按下下一題按鈕。
      goToNextQuestion(); // 前往下一題或顯示結果頁。
    } // 結束下一題按鈕判斷。
    return; // 已作答時不允許再次選取其他選項。
  } // 結束已作答狀態判斷。
  for (let optionIndex = 0; optionIndex < optionRects.length; optionIndex += 1) { // 逐一檢查四個選項的點擊範圍。
    if (isPointInside(pointX, pointY, optionRects[optionIndex])) { // 判斷點擊位置是否落在目前選項內。
      checkAnswer(optionIndex); // 檢查使用者選取的答案。
      return; // 找到被點擊的選項後停止檢查。
    } // 結束目前選項的點擊判斷。
  } // 結束選項點擊檢查迴圈。
} // 結束共用點擊處理函式。

function isPointInside(pointX, pointY, targetRect) { // 定義判斷座標是否位於矩形範圍內的函式。
  if (!targetRect || targetRect.width === undefined) { // 判斷目標矩形是否存在且具有寬度。
    return false; // 無效矩形時回傳未點擊。
  } // 結束無效矩形判斷。
  return pointX >= targetRect.x && pointX <= targetRect.x + targetRect.width && pointY >= targetRect.y && pointY <= targetRect.y + targetRect.height; // 回傳座標是否位於矩形內。
} // 結束矩形點擊判斷函式。

function checkAnswer(answerIndex) { // 定義檢查使用者答案的函式。
  selectedAnswer = answerIndex; // 記錄使用者選取的選項索引。
  answerChecked = true; // 將目前題目標記為已檢查答案。
  if (answerIndex === quizQuestions[currentQuestion].answer) { // 判斷使用者是否選取正確選項。
    score += 1; // 答對時將目前分數增加一分。
    feedbackMessage = "答對了！"; // 設定答對時的繁體中文提示。
    return; // 答對後結束答案檢查函式。
  } // 結束答對判斷。
  feedbackMessage = "答錯了！淺藍色並上下跳動的選項是正確答案。"; // 設定答錯時的繁體中文提示。
} // 結束答案檢查函式。

function goToNextQuestion() { // 定義前往下一題或結果頁面的函式。
  if (currentQuestion < QUIZ_SIZE - 1) { // 判斷目前是否還有下一題。
    currentQuestion += 1; // 將目前題目索引增加一題。
  } else { // 處理最後一題答完的情況。
    quizFinished = true; // 將測驗狀態設定為已完成。
  } // 結束下一題判斷。
  selectedAnswer = -1; // 清除上一題的選項選取狀態。
  answerChecked = false; // 清除上一題的答案檢查狀態。
  feedbackMessage = ""; // 清除上一題的回饋文字。
} // 結束前往下一題函式。

function resetQuizFromBank() { // 定義使用目前已載入題庫重新抽出五題的函式。
  const shuffledBank = questionBank.slice(); // 複製完整題庫以避免修改原始資料。
  shuffle(shuffledBank, true); // 將題庫副本隨機打亂。
  quizQuestions = shuffledBank.slice(0, QUIZ_SIZE); // 從打亂後副本取出五題不重複題目。
  currentQuestion = 0; // 將題目索引重設為第一題。
  score = 0; // 將分數重設為零分。
  selectedAnswer = -1; // 清除選項選取狀態。
  answerChecked = false; // 清除答案檢查狀態。
  quizFinished = false; // 將測驗狀態重設為尚未完成。
  feedbackMessage = ""; // 清除答題回饋文字。
  optionRects = []; // 清除舊選項點擊範圍。
  nextButton = {}; // 清除舊下一題按鈕點擊範圍。
  restartButton = {}; // 清除舊重新開始按鈕點擊範圍。
} // 結束使用題庫重新抽題函式。

function restartQuiz() { // 定義重新載入最新題庫並重新開始測驗的函式。
  beginQuestionBankLoad(); // 重新讀取 Google 試算表最新內容並在成功後重新抽出五題。
} // 結束重新開始測驗函式。
