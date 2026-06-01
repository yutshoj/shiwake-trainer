const bank = QUESTION_BANK.grade3;
const MIN_JOURNAL_ROWS = 3;

const state = {
  index: 0,
  categoryId: bank.categories[0].id,
  levelId: bank.levels?.[0]?.id || "level1",
  openPicker: null,
  rows: [],
  memoOpen: false,
  calculatorOpen: false,
  calculatorExpression: "",
  calculatorJustEvaluated: false,
  activeAmount: null,
  tool: "pen",
  color: "#ef4444",
  drawing: false,
};

const els = {
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  gradeSelect: document.querySelector("#gradeSelect"),
  categorySelect: document.querySelector("#categorySelect"),
  levelSelect: document.querySelector("#levelSelect"),
  categoryCount: document.querySelector("#categoryCount"),
  categoryDescription: document.querySelector("#categoryDescription"),
  title: document.querySelector("#questionTitle"),
  body: document.querySelector("#questionBody"),
  accountOptions: document.querySelector("#accountOptions"),
  checkAnswer: document.querySelector("#checkAnswer"),
  feedback: document.querySelector("#feedback"),
  journalBoard: document.querySelector("#journalBoard"),
  journalRows: document.querySelector("#journalRows"),
  debitTotal: document.querySelector("#debitTotal"),
  creditTotal: document.querySelector("#creditTotal"),
  addJournalRow: document.querySelector("#addJournalRow"),
  clearJournal: document.querySelector("#clearJournal"),
  toggleMemo: document.querySelector("#toggleMemo"),
  toggleCalculator: document.querySelector("#toggleCalculator"),
  balanceHint: document.querySelector("#balanceHint"),
  resultPanel: document.querySelector("#resultPanel"),
  resultTitle: document.querySelector("#resultTitle"),
  resultSummary: document.querySelector("#resultSummary"),
  correctAnswerText: document.querySelector("#correctAnswerText"),
  explanationList: document.querySelector("#explanationList"),
  calculatorPanel: document.querySelector("#calculatorPanel"),
  calculatorHint: document.querySelector("#calculatorHint"),
  calculatorDisplay: document.querySelector("#calculatorDisplay"),
  applyCalculator: document.querySelector("#applyCalculator"),
  topicLabel: document.querySelector("#topicLabel"),
  prevQuestion: document.querySelector("#prevQuestion"),
  nextQuestion: document.querySelector("#nextQuestion"),
  memoPanel: document.querySelector("#memoPanel"),
  canvas: document.querySelector("#scratchCanvas"),
  clearCanvas: document.querySelector("#clearCanvas"),
  resetAnswer: document.querySelector("#resetAnswer"),
  scoreShortcut: document.querySelector("#scoreShortcut"),
};

const ctx = els.canvas.getContext("2d");

function currentCategory() {
  return bank.categories.find((category) => category.id === state.categoryId) || bank.categories[0];
}

function currentLevel() {
  return bank.levels?.find((level) => level.id === state.levelId) || { id: "level1", label: "Level 1", description: "基礎問題" };
}

function questionsForLevel(category, levelId) {
  return category.questions.filter((question) => (question.level || "level1") === levelId);
}

function currentQuestions() {
  return questionsForLevel(currentCategory(), state.levelId);
}

function currentQuestion() {
  return currentQuestions()[state.index];
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function accountChoicesForQuestion(question) {
  const answerAccounts = answerEntries(question).map((entry) => entry.account);
  const categoryAccounts = currentCategory().questions.flatMap((item) => [...item.choices, ...answerEntries(item).map((entry) => entry.account)]);
  return uniqueItems([...question.choices, ...answerAccounts, ...categoryAccounts]).slice(0, 7);
}

function emptyRow() {
  return { debit: "", debitAmount: "", credit: "", creditAmount: "" };
}

function normalizeAmount(value) {
  const text = String(value)
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replaceAll(",", "")
    .replaceAll("，", "")
    .trim();
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function formatYen(value) {
  const number = normalizeAmount(value);
  return number > 0 ? number.toLocaleString("ja-JP") : "0";
}

function answerEntries(question) {
  if (Array.isArray(question.answer.entries)) {
    return question.answer.entries.map((entry) => ({
      side: entry.side,
      account: entry.account,
      amount: Number(entry.amount),
    }));
  }

  return [
    { side: "debit", account: question.answer.debit, amount: Number(question.answer.amount) },
    { side: "credit", account: question.answer.credit, amount: Number(question.answer.amount) },
  ];
}

function entriesBySide(entries) {
  return {
    debits: entries.filter((entry) => entry.side === "debit"),
    credits: entries.filter((entry) => entry.side === "credit"),
  };
}

function initialRowsForQuestion(question) {
  const answer = entriesBySide(answerEntries(question));
  const rowCount = Math.max(MIN_JOURNAL_ROWS, answer.debits.length, answer.credits.length);
  return Array.from({ length: rowCount }, emptyRow);
}

function setQuestion(index) {
  const questions = currentQuestions();
  const category = currentCategory();
  const level = currentLevel();
  const safeIndex = (index + questions.length) % questions.length;
  const question = questions[safeIndex];
  state.index = safeIndex;

  resetEntry(false);

  els.progressText.textContent = `${safeIndex + 1} / ${questions.length}`;
  els.progressBar.style.width = `${((safeIndex + 1) / questions.length) * 100}%`;
  els.categoryCount.textContent = `${level.label} / ${questions.length}問`;
  els.categoryDescription.textContent = `${category.description} / ${level.description}`;
  els.title.textContent = question.title;
  els.body.textContent = question.body;
  els.topicLabel.textContent = `${question.topic} / ${level.label}`;

  renderOptions(accountChoicesForQuestion(question));
  renderJournal();
  updateResultPanel(null);
}

function resetEntry(renderAll = true) {
  state.openPicker = null;
  state.activeAmount = null;
  state.rows = initialRowsForQuestion(currentQuestions()[state.index]);
  els.feedback.textContent = "";
  els.feedback.className = "feedback";
  els.journalBoard.className = "journal-board";
  updateCalculatorHint();

  if (!renderAll) return;
  renderOptions(accountChoicesForQuestion(currentQuestion()));
  renderJournal();
  updateResultPanel(null);
}

function renderOptions(choices) {
  els.accountOptions.replaceChildren();

  choices.forEach((choice) => {
    const chip = document.createElement("span");
    chip.className = "account-chip";
    chip.textContent = choice;
    els.accountOptions.append(chip);
  });
}

function renderJournal() {
  els.journalRows.replaceChildren();

  state.rows.forEach((row, index) => {
    const element = document.createElement("div");
    element.className = "journal-row";
    element.append(
      createAccountCell(row, index, "debit"),
      createAmountCell(row, index, "debit"),
      createAccountCell(row, index, "credit"),
      createAmountCell(row, index, "credit"),
    );
    els.journalRows.append(element);
  });

  updateTotals();
}

function createAccountCell(row, index, side) {
  const cell = document.createElement("span");
  cell.className = `journal-account ${row[side] ? "" : "is-empty"}`;

  const button = document.createElement("button");
  button.className = "journal-account-button";
  button.type = "button";
  button.textContent = row[side] || "勘定科目を選択";
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = state.openPicker?.index === index && state.openPicker?.side === side;
    state.openPicker = isOpen ? null : { index, side };
    renderJournal();
  });
  cell.append(button);

  if (row[side]) {
    const clear = document.createElement("button");
    clear.className = "clear-cell";
    clear.type = "button";
    clear.title = `${side === "debit" ? "借方" : "貸方"}を消去`;
    clear.textContent = "×";
    clear.addEventListener("click", () => {
      state.rows[index][side] = "";
      state.rows[index][`${side}Amount`] = "";
      clearScoreState();
      renderJournal();
    });
    cell.append(clear);
  }

  if (state.openPicker?.index === index && state.openPicker?.side === side) {
    cell.append(createAccountPicker(index, side));
  }

  return cell;
}

function createAccountPicker(index, side) {
  const picker = document.createElement("div");
  picker.className = "account-picker";
  picker.addEventListener("click", (event) => event.stopPropagation());

  accountChoicesForQuestion(currentQuestion()).forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = choice;
    button.addEventListener("click", () => {
      state.rows[index][side] = choice;
      state.openPicker = null;
      clearScoreState();
      renderJournal();
    });
    picker.append(button);
  });

  return picker;
}

function createAmountCell(row, index, side) {
  const cell = document.createElement("span");
  cell.className = "journal-amount-cell";

  const input = document.createElement("input");
  input.className = "journal-amount-input";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.placeholder = "金額";
  input.dataset.amountTarget = `${index}:${side}`;
  input.value = row[`${side}Amount`];
  input.disabled = !row[side];
  input.classList.toggle("is-active-amount", isActiveAmount(index, side));
  input.addEventListener("focus", () => setActiveAmount(index, side));
  input.addEventListener("click", () => setActiveAmount(index, side));
  input.addEventListener("input", () => {
    state.rows[index][`${side}Amount`] = input.value;
    clearScoreState();
    updateTotals();
  });

  cell.append(input);
  return cell;
}

function sideLabel(side) {
  return side === "debit" ? "借方" : "貸方";
}

function isActiveAmount(index, side) {
  return state.activeAmount?.index === index && state.activeAmount?.side === side;
}

function setActiveAmount(index, side) {
  state.activeAmount = { index, side };
  document.querySelectorAll(".journal-amount-input").forEach((input) => {
    input.classList.toggle("is-active-amount", input.dataset.amountTarget === `${index}:${side}`);
  });
  updateCalculatorHint();
}

function updateCalculatorHint(message = "") {
  if (!els.calculatorHint) return;

  if (message) {
    els.calculatorHint.textContent = message;
    return;
  }

  if (!state.activeAmount) {
    els.calculatorHint.textContent = "金額欄を選ぶと結果を入力できます";
    return;
  }

  els.calculatorHint.textContent = `${state.activeAmount.index + 1}行目の${sideLabel(state.activeAmount.side)}金額へ入力できます`;
}

function clearScoreState() {
  els.feedback.textContent = "";
  els.feedback.className = "feedback";
  els.resultPanel.className = "result-panel";
  els.journalBoard.className = "journal-board";
  els.resultTitle.textContent = "採点すると解説が表示されます";
  els.correctAnswerText.textContent = "-";
  setResultBadges(["科目", "金額", "貸借"], "");
  els.explanationList.replaceChildren();

  const item = document.createElement("li");
  item.textContent = "採点後にここへ解説が表示されます。";
  els.explanationList.append(item);
}

function collectUserEntries() {
  const entries = [];

  state.rows.forEach((row) => {
    if (row.debit) {
      entries.push({ side: "debit", account: row.debit, amount: normalizeAmount(row.debitAmount) });
    }
    if (row.credit) {
      entries.push({ side: "credit", account: row.credit, amount: normalizeAmount(row.creditAmount) });
    }
  });

  return entries;
}

function updateTotals() {
  const entries = collectUserEntries();
  const debitTotal = entries.filter((entry) => entry.side === "debit").reduce((sum, entry) => sum + entry.amount, 0);
  const creditTotal = entries.filter((entry) => entry.side === "credit").reduce((sum, entry) => sum + entry.amount, 0);

  els.debitTotal.textContent = debitTotal.toLocaleString("ja-JP");
  els.creditTotal.textContent = creditTotal.toLocaleString("ja-JP");

  if (debitTotal === 0 && creditTotal === 0) {
    els.balanceHint.textContent = "一致待ち";
    els.balanceHint.className = "";
  } else if (debitTotal === creditTotal) {
    els.balanceHint.textContent = "貸借一致";
    els.balanceHint.className = "is-balanced";
  } else {
    els.balanceHint.textContent = "貸借不一致";
    els.balanceHint.className = "is-unbalanced";
  }
}

function entrySignature(entries, includeAmount) {
  return entries
    .map((entry) => `${entry.side}:${entry.account}${includeAmount ? `:${entry.amount}` : ""}`)
    .sort()
    .join("|");
}

function sameEntries(userEntries, answer, includeAmount) {
  return entrySignature(userEntries, includeAmount) === entrySignature(answer, includeAmount);
}

function sideTotal(entries, side) {
  return entries.filter((entry) => entry.side === side).reduce((sum, entry) => sum + entry.amount, 0);
}

function checkAnswer() {
  const question = currentQuestion();
  const answer = answerEntries(question);
  const userEntries = collectUserEntries();
  const accountCorrect = sameEntries(userEntries, answer, false);
  const amountCorrect = sameEntries(userEntries, answer, true);
  const debitTotal = sideTotal(userEntries, "debit");
  const creditTotal = sideTotal(userEntries, "credit");
  const balanceCorrect = debitTotal > 0 && debitTotal === creditTotal;
  const isCorrect = accountCorrect && amountCorrect && balanceCorrect;

  els.feedback.className = `feedback ${isCorrect ? "is-correct" : "is-wrong"}`;
  els.feedback.textContent = isCorrect ? "正解です。この仕訳で貸借が一致しています。" : `もう一度確認しましょう。正解は ${formatAnswerText(answer)} です。`;
  updateResultPanel({ isCorrect, accountCorrect, amountCorrect, balanceCorrect });
}

function formatEntry(entry) {
  return `${entry.account} ${entry.amount.toLocaleString("ja-JP")}円`;
}

function formatAnswerText(entries) {
  const grouped = entriesBySide(entries);
  const debits = grouped.debits.map(formatEntry).join(" / ");
  const credits = grouped.credits.map(formatEntry).join(" / ");
  return `借方 ${debits} / 貸方 ${credits}`;
}

function updateResultPanel(result) {
  const question = currentQuestion();
  const answer = answerEntries(question);
  els.correctAnswerText.textContent = result ? formatAnswerText(answer) : "-";
  els.explanationList.replaceChildren();

  const explanationItems = result ? question.explanation : ["採点後にここへ解説が表示されます。"];
  explanationItems.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    els.explanationList.append(item);
  });

  els.resultPanel.className = "result-panel";
  els.journalBoard.className = "journal-board";

  if (!result) {
    els.resultTitle.textContent = "採点すると解説が表示されます";
    setResultBadges(["科目", "金額", "貸借"], "");
    return;
  }

  const resultClass = result.isCorrect ? "is-correct" : result.amountCorrect ? "is-account-wrong" : result.accountCorrect ? "is-amount-wrong" : "is-wrong";
  els.resultPanel.classList.add(resultClass);
  els.journalBoard.classList.add(resultClass);
  els.resultTitle.textContent = result.isCorrect ? "正解" : "直すポイントがあります";
  setResultBadges(
    [
      result.accountCorrect ? "科目 OK" : "科目ミス",
      result.amountCorrect ? "金額 OK" : "金額ミス",
      result.balanceCorrect ? "貸借一致" : "貸借不一致",
    ],
    "scored",
  );
}

function setResultBadges(labels, mode) {
  els.resultSummary.replaceChildren();
  labels.forEach((label) => {
    const badge = document.createElement("span");
    badge.textContent = label;
    if (mode) {
      if (label.includes("OK") || label.includes("一致")) badge.className = "badge-ok";
      if (label.includes("金額ミス") || label.includes("不一致")) badge.className = "badge-warn";
      if (label.includes("科目ミス")) badge.className = "badge-bad";
    }
    els.resultSummary.append(badge);
  });
}

function addJournalRow() {
  state.rows.push(emptyRow());
  clearScoreState();
  renderJournal();
}

function toggleMemo() {
  state.memoOpen = !state.memoOpen;
  els.memoPanel.classList.toggle("is-open", state.memoOpen);
  els.toggleMemo.textContent = state.memoOpen ? "メモを閉じる" : "メモを開く";

  if (state.memoOpen) {
    requestAnimationFrame(resizeCanvasBuffer);
  }
}

function formatCalculatorValue(value) {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function calculatorText() {
  if (!state.calculatorExpression) return "0";
  if (/^\d+(?:\.\d+)?$/.test(state.calculatorExpression)) {
    return Number(state.calculatorExpression).toLocaleString("ja-JP");
  }

  return state.calculatorExpression.replaceAll("*", "×").replaceAll("/", "÷");
}

function updateCalculatorDisplay() {
  els.calculatorDisplay.textContent = calculatorText();
}

function applyOperator(values, ops) {
  const right = values.pop();
  const left = values.pop();
  const operator = ops.pop();

  if (left === undefined || right === undefined) return false;
  if (operator === "+") values.push(left + right);
  if (operator === "-") values.push(left - right);
  if (operator === "*") values.push(left * right);
  if (operator === "/") {
    if (right === 0) return false;
    values.push(left / right);
  }

  return true;
}

function calculateExpression(expression) {
  const clean = expression.replace(/[+\-*/]+$/, "");
  if (!clean || !/^\d+(?:\.\d+)?(?:[+\-*/]\d+(?:\.\d+)?)*$/.test(clean)) return null;

  const tokens = clean.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  const values = [];
  const ops = [];
  const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };

  for (const token of tokens) {
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      values.push(Number(token));
      continue;
    }

    while (ops.length && precedence[ops.at(-1)] >= precedence[token]) {
      if (!applyOperator(values, ops)) return null;
    }
    ops.push(token);
  }

  while (ops.length) {
    if (!applyOperator(values, ops)) return null;
  }

  const result = values[0];
  return Number.isFinite(result) ? result : null;
}

function handleCalculatorAction(action, value) {
  if (action === "number") {
    if (state.calculatorJustEvaluated) {
      state.calculatorExpression = "";
      state.calculatorJustEvaluated = false;
    }
    state.calculatorExpression += value;
    state.calculatorExpression = state.calculatorExpression.replace(/^0+(?=\d)/, "");
  }

  if (action === "operator") {
    state.calculatorJustEvaluated = false;
    if (!state.calculatorExpression) return;
    if (/[+\-*/]$/.test(state.calculatorExpression)) {
      state.calculatorExpression = state.calculatorExpression.slice(0, -1) + value;
    } else {
      state.calculatorExpression += value;
    }
  }

  if (action === "backspace") {
    state.calculatorExpression = state.calculatorExpression.slice(0, -1);
    state.calculatorJustEvaluated = false;
  }

  if (action === "clear") {
    state.calculatorExpression = "";
    state.calculatorJustEvaluated = false;
    updateCalculatorHint();
  }

  if (action === "equals") {
    const result = calculateExpression(state.calculatorExpression);
    if (result === null) {
      updateCalculatorHint("式を確認してください");
    } else {
      state.calculatorExpression = formatCalculatorValue(result);
      state.calculatorJustEvaluated = true;
      updateCalculatorHint();
    }
  }

  updateCalculatorDisplay();
}

function toggleCalculator() {
  state.calculatorOpen = !state.calculatorOpen;
  els.calculatorPanel.classList.toggle("is-open", state.calculatorOpen);
  els.toggleCalculator.textContent = state.calculatorOpen ? "電卓を閉じる" : "電卓を開く";
  updateCalculatorDisplay();
  updateCalculatorHint();
}

function applyCalculatorToAmount() {
  const result = calculateExpression(state.calculatorExpression);

  if (result === null) {
    updateCalculatorHint("計算式を入力してから金額欄へ入れてください");
    return;
  }

  if (!state.activeAmount) {
    updateCalculatorHint("先に入力したい金額欄を選んでください");
    return;
  }

  const { index, side } = state.activeAmount;
  const row = state.rows[index];

  if (!row || !row[side]) {
    updateCalculatorHint("先に勘定科目を選ぶと金額を入力できます");
    return;
  }

  row[`${side}Amount`] = formatCalculatorValue(result);
  clearScoreState();
  renderJournal();
  updateCalculatorHint(`${index + 1}行目の${sideLabel(side)}金額に入力しました`);
}

function resizeCanvasBuffer() {
  const rect = els.canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const image = ctx.getImageData(0, 0, els.canvas.width, els.canvas.height);
  els.canvas.width = Math.max(1, Math.floor(rect.width * scale));
  els.canvas.height = Math.max(1, Math.floor(rect.height * scale));
  ctx.putImageData(image, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function pointerPosition(event) {
  const rect = els.canvas.getBoundingClientRect();
  const scaleX = els.canvas.width / rect.width;
  const scaleY = els.canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function startDrawing(event) {
  state.drawing = true;
  const point = pointerPosition(event);
  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
}

function draw(event) {
  if (!state.drawing) return;
  const point = pointerPosition(event);
  ctx.globalCompositeOperation = state.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = state.color;
  ctx.lineWidth = state.tool === "eraser" ? 26 : 5;
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
}

function stopDrawing() {
  state.drawing = false;
  ctx.closePath();
}

document.querySelectorAll(".tool-button[data-tool]").forEach((button) => {
  button.addEventListener("click", () => {
    state.tool = button.dataset.tool;
    document.querySelectorAll(".tool-button[data-tool]").forEach((item) => item.classList.toggle("is-active", item === button));
  });
});

document.querySelectorAll(".color-dot").forEach((button) => {
  button.addEventListener("click", () => {
    state.color = button.dataset.color;
    document.querySelectorAll(".color-dot").forEach((item) => item.classList.toggle("is-active", item === button));
  });
});

function renderCategorySelect() {
  els.categorySelect.replaceChildren();

  bank.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    els.categorySelect.append(option);
  });

  els.categorySelect.value = state.categoryId;
}

function renderLevelSelect() {
  els.levelSelect.replaceChildren();

  bank.levels.forEach((level) => {
    const option = document.createElement("option");
    option.value = level.id;
    option.textContent = level.label;
    els.levelSelect.append(option);
  });

  els.levelSelect.value = state.levelId;
}

els.categorySelect.addEventListener("change", () => {
  state.categoryId = els.categorySelect.value;
  setQuestion(0);
});

els.levelSelect.addEventListener("change", () => {
  state.levelId = els.levelSelect.value;
  setQuestion(0);
});

els.checkAnswer.addEventListener("click", checkAnswer);
els.addJournalRow.addEventListener("click", addJournalRow);
els.clearJournal.addEventListener("click", () => resetEntry(true));
els.toggleMemo.addEventListener("click", toggleMemo);
els.toggleCalculator.addEventListener("click", toggleCalculator);
els.applyCalculator.addEventListener("click", applyCalculatorToAmount);
els.resetAnswer.addEventListener("click", () => resetEntry(true));
els.scoreShortcut.addEventListener("click", checkAnswer);
els.prevQuestion.addEventListener("click", () => setQuestion(state.index - 1));
els.nextQuestion.addEventListener("click", () => setQuestion(state.index + 1));
els.clearCanvas.addEventListener("click", () => ctx.clearRect(0, 0, els.canvas.width, els.canvas.height));

document.querySelectorAll("[data-calc-action]").forEach((button) => {
  button.addEventListener("click", () => handleCalculatorAction(button.dataset.calcAction, button.dataset.value || ""));
});

window.addEventListener("keydown", (event) => {
  if (event.target.matches("input, select, textarea")) return;
  if (event.key.toLowerCase() === "q") document.querySelector(".question-pane").scrollIntoView({ behavior: "smooth", block: "start" });
  if (event.key.toLowerCase() === "r") resetEntry(true);
  if (event.key.toLowerCase() === "s") checkAnswer();
});

document.addEventListener("mousedown", (event) => {
  if (!state.openPicker || event.target.closest(".journal-account")) return;
  state.openPicker = null;
  renderJournal();
});

els.canvas.addEventListener("pointerdown", startDrawing);
els.canvas.addEventListener("pointermove", draw);
els.canvas.addEventListener("pointerup", stopDrawing);
els.canvas.addEventListener("pointerleave", stopDrawing);

window.addEventListener("resize", resizeCanvasBuffer);

resizeCanvasBuffer();
updateCalculatorDisplay();
renderCategorySelect();
renderLevelSelect();
setQuestion(0);
