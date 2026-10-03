const STORAGE_KEY = "porsh-invoice-v1";
const SEQUENCE_KEY = "porsh-invoice-sequences-v1";
const STANDARD_TERMS = "50% deposit required to commence any project.\nBalance due within the payment terms stated.\nNo final delivery until full payment is received.\nPayment details below.\nThank you for choosing Porsh Studios.";

const defaultInvoice = {
  documentType: "invoice",
  invoiceNumber: "PS-INV-2026-0047",
  currencySymbol: "GH₵",
  invoiceDate: "2026-09-01",
  dueDate: "2026-10-01",
  paymentTerms: "50% Deposit | Balance on Delivery",
  clientName: "Nestlé Ghana Ltd.",
  clientAttention: "Procurement Department",
  clientAddress: "P.O. Box GP 2184\nAccra, Ghana",
  projectName: "Nestlé Sale Corporate Video",
  reference: "PO-45007218",
  discount: 0,
  vatEnabled: true,
  nhilRate: 2.5,
  getFundRate: 2.5,
  taxRate: 15,
  notes: "Thank you for choosing Porsh Studios.\nPayment due within the terms stated above.",
  bankName: "GCB Bank Ltd.",
  accountName: "Porsh Studios",
  accountNumber: "1231130012345",
  accountCurrency: "GHS",
  momoProvider: "Mobile Money",
  momoName: "Ebenezer Eyimah",
  momoNumber: "0242743356",
  terms: STANDARD_TERMS,
  items: [
    { description: "Cameras and Lenses", days: 1, dailyRate: 1500 },
    { description: "Drone Coverage", days: 1, dailyRate: 500 },
    { description: "Tripod", days: 1, dailyRate: 150 },
    { description: "Lighting Equipment", days: 1, dailyRate: 800 },
    { description: "Camera Crew", days: 1, dailyRate: 3000 },
    { description: "Transportation", days: 1, dailyRate: 1000 },
    { description: "Editing & Post-Production", days: 1, dailyRate: 3500 }
  ]
};

const state = loadInvoice();
const form = document.querySelector("#invoiceForm");
const itemEditor = document.querySelector("#itemEditor");
const previewItems = document.querySelector("#previewItems");
const saveState = document.querySelector("#saveState");
const toast = document.querySelector("#toast");
let saveTimer;
let renderFrame;
let installPrompt;

function loadInvoice() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const invoice = saved ? { ...structuredClone(defaultInvoice), ...saved } : structuredClone(defaultInvoice);
    if (!String(invoice.currencySymbol || "").trim()) invoice.currencySymbol = "GH₵";
    if (!String(invoice.terms || "").trim()) invoice.terms = STANDARD_TERMS;
    if (invoice.momoName === "Porsh Studios") invoice.momoName = "Ebenezer Eyimah";
    invoice.vatEnabled = invoice.vatEnabled !== false;
    invoice.items = Array.isArray(invoice.items) ? invoice.items.map(normalizeItem) : structuredClone(defaultInvoice.items);
    return invoice;
  } catch {
    return structuredClone(defaultInvoice);
  }
}

function populateForm() {
  Object.entries(state).forEach(([key, value]) => {
    if (key === "items") return;
    const field = form.elements.namedItem(key);
    if (!field) return;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value;
  });
  renderItemEditor();
  renderPreview();
}

function renderItemEditor() {
  itemEditor.replaceChildren();
  state.items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "item-input-row";
    row.innerHTML = `
      <label class="item-description">Description<input type="text" data-item-field="description" data-index="${index}" value="${escapeHtml(item.description)}" aria-label="Item ${index + 1} description"></label>
      <label>Days<input type="number" min="0" step="0.5" data-item-field="days" data-index="${index}" value="${numberValue(item.days)}" aria-label="Item ${index + 1} number of days"></label>
      <label>Daily rate<input type="number" min="0" step="0.01" data-item-field="dailyRate" data-index="${index}" value="${numberValue(item.dailyRate)}" aria-label="Item ${index + 1} daily rate"></label>
      <div class="item-calculated"><span>Amount</span><strong>${formatNumber(itemAmount(item))}</strong></div>
      <button class="delete-item" type="button" data-delete-index="${index}" aria-label="Remove item ${index + 1}">×</button>`;
    itemEditor.append(row);
  });
}

function renderPreview() {
  const isReceipt = state.documentType === "receipt";
  document.querySelector("#documentTitle").textContent = isReceipt ? "RECEIPT" : "INVOICE";
  document.querySelector("#documentNumberFieldLabel").textContent = isReceipt ? "Receipt number" : "Invoice number";
  document.querySelector("#documentDateLabel").textContent = isReceipt ? "RECEIPT DATE" : "INVOICE DATE";
  document.querySelector("#billToLabel").textContent = isReceipt ? "RECEIVED FROM" : "BILL TO";
  document.querySelector("#totalLabel").textContent = isReceipt ? "AMOUNT PAID" : "TOTAL DUE";
  document.querySelectorAll(".invoice-only").forEach((element) => { element.hidden = isReceipt; });

  document.querySelectorAll("[data-preview]").forEach((element) => {
    const value = state[element.dataset.preview] ?? "";
    const prefix = value ? element.dataset.prefix || "" : "";
    element.textContent = `${prefix}${value}`;
  });
  document.querySelectorAll("[data-preview-date]").forEach((element) => {
    element.textContent = formatDate(state[element.dataset.previewDate]);
  });

  previewItems.replaceChildren();
  previewItems.classList.toggle("dense", state.items.length > 8);
  previewItems.style.gridTemplateRows = `repeat(${Math.max(state.items.length, 1)}, 1fr)`;
  state.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "preview-item";
    const description = document.createElement("span");
    const days = document.createElement("span");
    const dailyRate = document.createElement("span");
    const amount = document.createElement("span");
    description.textContent = item.description;
    days.textContent = formatNumber(item.days, 2);
    setMoney(dailyRate, item.dailyRate);
    setMoney(amount, itemAmount(item));
    row.append(description, days, dailyRate, amount);
    previewItems.append(row);
  });

  if (!state.items.length) {
    const empty = document.createElement("div");
    empty.className = "preview-item";
    empty.innerHTML = "<span>No items added</span><span>—</span><span>—</span><span>—</span>";
    previewItems.append(empty);
  }

  const subtotal = state.items.reduce((sum, item) => sum + itemAmount(item), 0);
  const discount = positiveNumber(state.discount);
  const taxable = Math.max(0, subtotal - discount);
  const taxesEnabled = state.vatEnabled !== false;
  const nhil = taxesEnabled ? taxable * positiveNumber(state.nhilRate) / 100 : 0;
  const getFund = taxesEnabled ? taxable * positiveNumber(state.getFundRate) / 100 : 0;
  const taxSubtotal = taxable + nhil + getFund;
  const tax = taxesEnabled ? taxable * positiveNumber(state.taxRate) / 100 : 0;
  const total = taxSubtotal + tax;

  document.querySelector("#taxRateFields").hidden = !taxesEnabled;
  document.querySelector("#taxHelp").hidden = !taxesEnabled;
  document.querySelectorAll(".tax-row").forEach((row) => { row.hidden = !taxesEnabled; });

  setMoney(document.querySelector("#subtotalPreview"), subtotal);
  setMoney(document.querySelector("#discountPreview"), discount);
  document.querySelector("#nhilLabel").textContent = `NHIL (${formatRate(state.nhilRate)}%)`;
  setMoney(document.querySelector("#nhilPreview"), nhil);
  document.querySelector("#getFundLabel").textContent = `GETFUND (${formatRate(state.getFundRate)}%)`;
  setMoney(document.querySelector("#getFundPreview"), getFund);
  setMoney(document.querySelector("#taxSubtotalPreview"), taxSubtotal);
  document.querySelector("#taxLabel").textContent = `VAT (${formatRate(state.taxRate)}%)`;
  setMoney(document.querySelector("#taxPreview"), tax);
  setMoney(document.querySelector("#totalPreview"), total);

  const terms = String(state.terms || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const termsPreview = document.querySelector("#termsPreview");
  termsPreview.replaceChildren();
  terms.forEach((term) => {
    const item = document.createElement("li");
    item.textContent = term;
    termsPreview.append(item);
  });
}

function schedulePreview() {
  if (renderFrame) cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(() => {
    renderFrame = null;
    renderPreview();
  });
}

function setMoney(element, value) {
  const number = positiveNumber(value);
  const formattedNumber = number.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const currency = document.createElement("span");
  const amount = document.createElement("span");
  currency.className = "money-currency";
  currency.setAttribute("aria-hidden", "true");
  currency.innerHTML = 'GH<span class="cedi-mark">C</span>';
  amount.textContent = formattedNumber;
  element.replaceChildren(currency, amount);
  element.setAttribute("aria-label", `GH₵${formattedNumber}`);
}

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function numberValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatNumber(value, maximumFractionDigits = 2) {
  return positiveNumber(value).toLocaleString("en-GH", { maximumFractionDigits });
}

function normalizeItem(item = {}) {
  const hasDailyRate = Number.isFinite(Number(item.dailyRate));
  return {
    description: String(item.description || ""),
    days: hasDailyRate ? positiveNumber(item.days) : 1,
    dailyRate: hasDailyRate ? positiveNumber(item.dailyRate) : positiveNumber(item.amount)
  };
}

function itemAmount(item) {
  return positiveNumber(item.days) * positiveNumber(item.dailyRate);
}

function formatRate(value) {
  return positiveNumber(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function saveInvoice() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveState.textContent = "Saved locally";
}

function parseInvoiceNumber(value) {
  const match = String(value || "").match(/^(.*?)(\d+)(\D*)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    number: Number(match[2]),
    width: match[2].length,
    suffix: match[3]
  };
}

function loadSequences() {
  try {
    return JSON.parse(localStorage.getItem(SEQUENCE_KEY)) || {};
  } catch {
    return {};
  }
}

function advanceInvoiceNumber(finalizedNumber) {
  const parsed = parseInvoiceNumber(finalizedNumber);
  if (!parsed || !Number.isFinite(parsed.number)) {
    showToast("The invoice number was saved, but it needs trailing digits before it can advance automatically.");
    return null;
  }

  const sequences = loadSequences();
  const sequenceName = `${parsed.prefix}|${parsed.suffix}`;
  const lastFinalized = Math.max(parsed.number, Number(sequences[sequenceName]) || 0);
  sequences[sequenceName] = lastFinalized;
  localStorage.setItem(SEQUENCE_KEY, JSON.stringify(sequences));

  const nextSerial = String(lastFinalized + 1).padStart(parsed.width, "0");
  const nextInvoiceNumber = `${parsed.prefix}${nextSerial}${parsed.suffix}`;
  state.invoiceNumber = nextInvoiceNumber;
  state.terms = STANDARD_TERMS;
  form.elements.namedItem("invoiceNumber").value = nextInvoiceNumber;
  form.elements.namedItem("terms").value = STANDARD_TERMS;
  renderPreview();
  saveInvoice();
  return nextInvoiceNumber;
}

function scheduleSave() {
  saveState.textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveInvoice, 250);
}

function syncField(event) {
  const field = event.target;
  if (!field.name || field.closest(".item-input-row")) return;
  state[field.name] = field.type === "checkbox" ? field.checked : field.type === "number" ? positiveNumber(field.value) : field.value;
  schedulePreview();
  scheduleSave();
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML.replaceAll('"', "&quot;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 4000);
}

form.addEventListener("input", syncField);

itemEditor.addEventListener("input", (event) => {
  const field = event.target;
  const index = Number(field.dataset.index);
  if (!Number.isInteger(index) || !state.items[index]) return;
  state.items[index][field.dataset.itemField] = field.dataset.itemField === "description" ? field.value : positiveNumber(field.value);
  const calculated = field.closest(".item-input-row")?.querySelector(".item-calculated strong");
  if (calculated) calculated.textContent = formatNumber(itemAmount(state.items[index]));
  schedulePreview();
  scheduleSave();
});

itemEditor.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-index]");
  if (!button) return;
  state.items.splice(Number(button.dataset.deleteIndex), 1);
  renderItemEditor();
  renderPreview();
  scheduleSave();
});

document.querySelector("#addItemButton").addEventListener("click", () => {
  state.items.push({ description: "New item", days: 1, dailyRate: 0 });
  renderItemEditor();
  renderPreview();
  scheduleSave();
  itemEditor.lastElementChild?.querySelector("input")?.select();
});

document.querySelector("#restoreTermsButton").addEventListener("click", () => {
  state.terms = STANDARD_TERMS;
  form.elements.namedItem("terms").value = STANDARD_TERMS;
  renderPreview();
  saveInvoice();
  showToast("The standard terms and conditions have been restored.");
});

document.querySelector("#resetButton").addEventListener("click", () => {
  if (!confirm("Reset all invoice fields to the original template example?")) return;
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, structuredClone(defaultInvoice));
  populateForm();
  saveInvoice();
  showToast("Invoice reset to the template example.");
});

document.querySelector("#pdfButton").addEventListener("click", () => {
  saveInvoice();
  const finalizedNumber = state.invoiceNumber;
  const documentName = state.documentType === "receipt" ? "receipt" : "invoice";
  showToast("In the print window, select “Save as PDF” or your device’s PDF option.");
  setTimeout(() => {
    window.print();
    const wasSaved = window.confirm(`Was ${documentName} ${finalizedNumber} saved successfully as a PDF?\n\nChoose OK to finalize it and advance to the next document number.`);
    if (!wasSaved) {
      showToast(`Invoice number remains ${finalizedNumber}.`);
      return;
    }
    const nextInvoiceNumber = advanceInvoiceNumber(finalizedNumber);
    if (nextInvoiceNumber) showToast(`${finalizedNumber} finalized. The next document number is ${nextInvoiceNumber}.`);
  }, 250);
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  document.querySelector("#installButton").hidden = false;
});

document.querySelector("#installButton").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  document.querySelector("#installButton").hidden = true;
});

function fitPreviewOnSmallScreens() {
  const page = document.querySelector("#invoicePage");
  const area = document.querySelector(".preview-area");
  if (window.innerWidth > 600) {
    page.style.transform = "";
    area.style.height = "";
    return;
  }
  const available = area.clientWidth;
  const scale = Math.min(1, available / 794);
  page.style.transform = `scale(${scale})`;
  area.style.height = `${1123 * scale + 70}px`;
}

window.addEventListener("resize", fitPreviewOnSmallScreens);
window.addEventListener("pagehide", () => {
  clearTimeout(saveTimer);
  saveInvoice();
});
populateForm();
fitPreviewOnSmallScreens();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    showToast("The app has been updated. Your current invoice is safe.");
  });
  navigator.serviceWorker.register("sw.js?v=12").then((registration) => registration.update());
}
