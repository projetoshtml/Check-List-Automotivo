const STORAGE_KEY = 'trocoleoChecklistDraftV1';
const PDF_STORAGE_KEY = 'trocoleoChecklistLastPdf';
const STATUS_OPTIONS = ['Presente', 'Ausente', 'Não verificado'];
const CITY_NAME = 'São Paulo';
const IS_FILE_PROTOCOL = window.location.protocol === 'file:';

const EXTERNAL_ITEMS = [
  { id: 'ext_right', title: 'Foto lado direito com seta piscante', help: 'Registre o lado direito do veículo com sinalização acionada.' },
  { id: 'ext_left', title: 'Foto lado esquerdo com seta piscante', help: 'Registre o lado esquerdo do veículo com sinalização acionada.' },
  { id: 'ext_front', title: 'Foto parte da frente com faróis e luz de emergência acesos', help: 'Capture a parte frontal com iluminação ligada.' },
  { id: 'ext_rear', title: 'Foto parte de trás com luz de emergência, luz de ré e de freio acesas', help: 'Capture a traseira com os sinais solicitados.' },
  { id: 'ext_top', title: 'Foto parte de cima', help: 'Registre a parte superior do veículo.' }
];

const INTERNAL_ITEMS = [
  { id: 'int_dashboard_key', title: 'Foto luzes do painel — com a chave virada', help: 'Subitem 1 de luzes do painel.', placeholder: 'Ex.: luzes acendem corretamente com a chave virada.' },
  { id: 'int_dashboard_engine', title: 'Foto luzes do painel — com o motor em funcionamento', help: 'Subitem 2 de luzes do painel.', placeholder: 'Ex.: luzes estabilizadas após partida do motor.' },
  { id: 'int_panel_components', title: 'Foto do painel e seus componentes (volante, sons, multimídia)', help: 'Registre volante, sons e multimídia.', placeholder: 'Ex.: multimídia sem imagem, volante com desgaste, som funcionando normalmente.' },
  { id: 'int_front_seats', title: 'Foto dos bancos dianteiros e tapetes', help: 'Registre bancos e tapetes da frente.', placeholder: 'Ex.: banco rasgado, tapete faltando, sujeira visível.' },
  { id: 'int_rear_seats', title: 'Foto dos bancos traseiros e tapetes', help: 'Registre bancos e tapetes traseiros.', placeholder: 'Ex.: banco em bom estado e tapetes presentes.' },
  { id: 'int_spare_tire', title: 'Foto do estepe', help: 'Registre o estado e presença do estepe.', placeholder: 'Ex.: estepe usado, estepe murcho, ausência do estepe.' },
  { id: 'int_wheel_wrench', title: 'Foto da chave de roda', help: 'Registre a chave de roda.', placeholder: 'Ex.: item presente no compartimento original.' },
  { id: 'int_fire_extinguisher', title: 'Foto do extintor', help: 'Registre presença, validade e lacre.', placeholder: 'Ex.: validade vencida, extintor ausente, lacre rompido.' },
  { id: 'int_horn_sound', title: 'Som da buzina', help: 'Registre o resultado da vistoria da buzina.', placeholder: 'Ex.: buzina funcionando, som fraco, inoperante.', hasTestCheckbox: true, photoOptional: true }
];

const state = {
  protocol: '',
  form: {},
  items: {},
  signature: null,
  pdfBlob: null
};

const dom = {
  form: document.getElementById('checklistForm'),
  externalItems: document.getElementById('externalItems'),
  internalItems: document.getElementById('internalItems'),
  protocolDisplay: document.getElementById('protocolDisplay'),
  saveStatus: document.getElementById('saveStatus'),
  termAcceptanceText: document.getElementById('termAcceptanceText'),
  termDeliveryText: document.getElementById('termDeliveryText'),
  imageModal: document.getElementById('imageModal'),
  modalImage: document.getElementById('modalImage'),
  modalCaption: document.getElementById('modalCaption'),
  closeImageModal: document.getElementById('closeImageModal'),
  imageModalBackdrop: document.getElementById('imageModalBackdrop'),
  logo: document.getElementById('brandLogo'),
  signatureCanvas: document.getElementById('signaturePad'),
  signatureStatus: document.getElementById('signatureStatus')
};

const itemTemplate = document.getElementById('inspectionItemTemplate');
let signaturePad;

init();

function init() {
  bootProtocol();
  setupLogoFallback();
  renderInspectionItems();
  initSignaturePad();
  bindBaseEvents();
  bindMasks();
  restoreDraft(true);
  updateTerms();
  autoSave('Rascunho pronto.');
}

function bootProtocol() {
  const existing = loadDraft();
  state.protocol = existing?.protocol || createProtocol();
  dom.protocolDisplay.textContent = state.protocol;
}

function createProtocol() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
  return `TROC-${stamp}`;
}

function setupLogoFallback() {
  const title = document.getElementById('brandLogo');
  if (title && title.tagName === 'IMG') {
    const nameEl = document.createElement('div');
    nameEl.id = 'brandLogo';
    nameEl.className = 'brand-logo logo-fallback';
    nameEl.setAttribute('aria-label', 'TrocÓleo');
    nameEl.textContent = 'TrocÓleo';
    title.replaceWith(nameEl);
    dom.logo = nameEl;
  }
}

function renderInspectionItems() {
  EXTERNAL_ITEMS.forEach(item => createInspectionCard(item, dom.externalItems, false));
  INTERNAL_ITEMS.forEach(item => createInspectionCard(item, dom.internalItems, true));
}

function createInspectionCard(item, container, withStatus) {
  const node = itemTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.itemId = item.id;
  node.querySelector('.inspection-title').textContent = item.title;
  node.querySelector('.inspection-help').textContent = item.help || '';
  const observation = node.querySelector('.item-observation');
  if (item.placeholder) observation.placeholder = item.placeholder;

  const statusGroup = node.querySelector('.status-group');
  if (withStatus) {
    STATUS_OPTIONS.forEach(status => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'status-chip';
      button.dataset.value = status;
      button.textContent = status;
      button.addEventListener('click', () => setItemStatus(item.id, status, node));
      statusGroup.appendChild(button);
    });
  } else {
    statusGroup.classList.add('hidden');
  }

  const testCheckboxWrap = node.querySelector('.test-checkbox');
  if (item.hasTestCheckbox) {
    testCheckboxWrap.classList.remove('hidden');
    testCheckboxWrap.querySelector('.test-performed-input').addEventListener('change', () => autoSave());
  }

  node.querySelector('.camera-input').addEventListener('change', event => handleFiles(item.id, event.target.files));
  node.querySelector('.gallery-input').addEventListener('change', event => handleFiles(item.id, event.target.files));
  node.querySelector('.remove-all-photos').addEventListener('click', () => removeAllPhotos(item.id));
  observation.addEventListener('input', () => autoSave());

  container.appendChild(node);
  state.items[item.id] = state.items[item.id] || { photos: [], status: withStatus ? 'Não verificado' : '', observation: '', testPerformed: false };
  hydrateItemCard(item.id);
}

function bindBaseEvents() {
  dom.form.addEventListener('input', () => {
    updateTerms();
    autoSave();
  });

  const bindClick = (id, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  };

  bindClick('saveDraftBtn', () => autoSave('Rascunho salvo com sucesso.'));
  bindClick('saveDraftBtnBottom', () => autoSave('Rascunho salvo com sucesso.'));
  bindClick('restoreDraftBtn', () => restoreDraft(false));
  bindClick('newChecklistBtn', handleNewChecklist);
  bindClick('clearAllBtn', handleClearAll);
  bindClick('generatePdfBtn', async () => downloadPdf());
  bindClick('generatePdfBtnBottom', async () => downloadPdf());
  bindClick('previewPdfBtn', async () => previewPdf());
  bindClick('previewPdfBtnBottom', async () => previewPdf());
  bindClick('sharePdfBtn', async () => sharePdf());
  bindClick('sharePdfBtnBottom', async () => sharePdf());
  bindClick('printBtn', async () => printPdf());
  bindClick('printBtnBottom', async () => printPdf());
  bindClick('exportPhotosBtn', exportPhotosZip);

  document.getElementById('clearSignatureBtn').addEventListener('click', () => {
    signaturePad.clear();
    state.signature = null;
    dom.signatureStatus.textContent = 'Assinatura limpa.';
    autoSave();
  });

  document.getElementById('redoSignatureBtn').addEventListener('click', () => {
    signaturePad.clear();
    state.signature = null;
    dom.signatureStatus.textContent = 'Assine novamente.';
    autoSave();
  });

  dom.closeImageModal.addEventListener('click', closeImageModal);
  if (dom.imageModalBackdrop) dom.imageModalBackdrop.addEventListener('click', closeImageModal);
  dom.imageModal.addEventListener('click', event => {
    if (event.target === dom.imageModal) closeImageModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeImageModal();
  });
}

function initSignaturePad() {
  resizeSignatureCanvas();
  signaturePad = new SignaturePad(dom.signatureCanvas, {
    minWidth: 1,
    maxWidth: 2.4,
    penColor: '#14213d',
    backgroundColor: 'rgba(255,255,255,0)'
  });

  signaturePad.addEventListener('endStroke', () => {
    state.signature = signaturePad.toDataURL('image/png');
    dom.signatureStatus.textContent = 'Assinatura capturada.';
    autoSave();
  });

  window.addEventListener('resize', resizeSignatureCanvas);
}

function resizeSignatureCanvas() {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const parent = dom.signatureCanvas.parentElement;
  const width = parent.clientWidth;
  const height = parseFloat(getComputedStyle(dom.signatureCanvas).height);
  dom.signatureCanvas.width = width * ratio;
  dom.signatureCanvas.height = height * ratio;
  const ctx = dom.signatureCanvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (signaturePad && state.signature) {
    signaturePad.fromDataURL(state.signature, { ratio, width, height });
  }
}

function bindMasks() {
  const cpfInput = dom.form.querySelector('[name="ownerCpf"]');
  const phoneInput = dom.form.querySelector('[name="ownerPhone"]');
  const mileageInput = dom.form.querySelector('[name="vehicleMileage"]');
  const plateInput = dom.form.querySelector('[name="vehiclePlate"]');

  if (cpfInput) cpfInput.addEventListener('input', () => cpfInput.value = formatCpf(cpfInput.value));
  if (phoneInput) phoneInput.addEventListener('input', () => phoneInput.value = formatPhone(phoneInput.value));
  if (mileageInput) {
    mileageInput.addEventListener('input', () => { mileageInput.value = onlyDigits(mileageInput.value); });
    mileageInput.addEventListener('blur', () => { mileageInput.value = formatMileage(mileageInput.value); });
    mileageInput.addEventListener('focus', () => { mileageInput.value = onlyDigits(mileageInput.value); });
  }
  if (plateInput) plateInput.addEventListener('input', () => plateInput.value = formatPlate(plateInput.value));
}

function onlyDigits(value) { return String(value || '').replace(/D/g, ''); }
function formatCpf(value) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits.replace(/(d{3})(d)/, '$1.$2').replace(/(d{3})(d)/, '$1.$2').replace(/(d{3})(d{1,2})$/, '$1-$2');
}
function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(d{2})(d)/, '($1) $2').replace(/(d{4})(d)/, '$1-$2');
  return digits.replace(/(d{2})(d)/, '($1) $2').replace(/(d{5})(d)/, '$1-$2');
}
function formatMileage(value) { return onlyDigits(value).slice(0, 9); }
function formatPlate(value) {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (raw.length <= 3) return raw;
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}
function closeImageModal() {
  dom.imageModal.classList.add('hidden');
  dom.imageModal.setAttribute('aria-hidden', 'true');
  dom.modalImage.removeAttribute('src');
  dom.modalCaption.textContent = '';
}

function collectFormData() {
  const formData = new FormData(dom.form);
  const data = {};
  formData.forEach((value, key) => { data[key] = typeof value === 'string' ? value : ''; });
  document.querySelectorAll('.inspection-card').forEach(card => {
    const itemId = card.dataset.itemId;
    const observation = card.querySelector('.item-observation')?.value || '';
    const testPerformed = card.querySelector('.test-performed-input')?.checked || false;
    state.items[itemId] = state.items[itemId] || { photos: [], status: '', observation: '', testPerformed: false };
    state.items[itemId].observation = observation;
    state.items[itemId].testPerformed = testPerformed;
  });
  return data;
}

function autoSave(message = 'Salvo automaticamente no navegador.') {
  state.form = collectFormData();
  state.signature = signaturePad && !signaturePad.isEmpty() ? signaturePad.toDataURL('image/png') : state.signature;
  const payload = { protocol: state.protocol, form: state.form, items: state.items, signature: state.signature, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  dom.saveStatus.textContent = `${message} Última atualização: ${new Date().toLocaleString('pt-BR')}`;
  updateTerms();
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function restoreDraft(silent = false) {
  const draft = loadDraft();
  if (!draft) {
    if (!silent) alert('Nenhum rascunho encontrado neste navegador.');
    return;
  }
  state.protocol = draft.protocol || state.protocol || createProtocol();
  dom.protocolDisplay.textContent = state.protocol;
  state.items = draft.items || state.items || {};
  state.form = draft.form || {};
  state.signature = draft.signature || null;
  Array.from(dom.form.elements).forEach(el => {
    if (!el.name) return;
    if (Object.prototype.hasOwnProperty.call(state.form, el.name)) el.value = state.form[el.name];
  });
  const cpfInput = dom.form.querySelector('[name="ownerCpf"]');
  const phoneInput = dom.form.querySelector('[name="ownerPhone"]');
  const mileageInput = dom.form.querySelector('[name="vehicleMileage"]');
  const plateInput = dom.form.querySelector('[name="vehiclePlate"]');
  if (cpfInput) cpfInput.value = formatCpf(cpfInput.value);
  if (phoneInput) phoneInput.value = formatPhone(phoneInput.value);
  if (mileageInput) mileageInput.value = onlyDigits(mileageInput.value);
  if (plateInput) plateInput.value = formatPlate(plateInput.value);
  document.querySelectorAll('.inspection-card').forEach(card => hydrateItemCard(card.dataset.itemId));
  if (signaturePad) {
    signaturePad.clear();
    if (state.signature) {
      signaturePad.fromDataURL(state.signature);
      dom.signatureStatus.textContent = 'Assinatura recuperada.';
    }
  }
  updateTerms();
  dom.saveStatus.textContent = silent ? 'Rascunho carregado automaticamente.' : 'Rascunho recuperado com sucesso.';
}

function hydrateItemCard(itemId) {
  const card = document.querySelector(`[data-item-id="${itemId}"]`);
  const data = state.items[itemId] || { photos: [], status: 'Não verificado', observation: '', testPerformed: false };
  state.items[itemId] = data;
  const observation = card.querySelector('.item-observation');
  if (observation) observation.value = data.observation || '';
  const testInput = card.querySelector('.test-performed-input');
  if (testInput) testInput.checked = !!data.testPerformed;
  card.querySelectorAll('.status-chip').forEach(chip => chip.classList.toggle('active', chip.dataset.value === data.status));
  renderThumbs(itemId);
}

function setItemStatus(itemId, status, card) {
  state.items[itemId] = state.items[itemId] || { photos: [], status: '', observation: '', testPerformed: false };
  state.items[itemId].status = status;
  card.querySelectorAll('.status-chip').forEach(chip => chip.classList.toggle('active', chip.dataset.value === status));
  autoSave();
}

async function handleFiles(itemId, fileList) {
  const files = Array.from(fileList || []).filter(file => file && file.type && file.type.startsWith('image/'));
  if (!files.length) return;
  state.items[itemId] = state.items[itemId] || { photos: [], status: '', observation: '', testPerformed: false };
  const converted = await Promise.all(files.map(fileToDataObject));
  state.items[itemId].photos.push(...converted);
  renderThumbs(itemId);
  autoSave('Fotos adicionadas ao rascunho.');
  document.querySelector(`[data-item-id="${itemId}"] .camera-input`).value = '';
  document.querySelector(`[data-item-id="${itemId}"] .gallery-input`).value = '';
}

function renderThumbs(itemId) {
  const card = document.querySelector(`[data-item-id="${itemId}"]`);
  const list = card.querySelector('.thumb-grid');
  const counter = card.querySelector('.photo-counter');
  const photos = state.items[itemId]?.photos || [];
  counter.textContent = `${photos.length} foto(s)`;
  list.innerHTML = '';
  if (!photos.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Nenhuma foto adicionada.';
    list.appendChild(empty);
    return;
  }
  photos.forEach((photo, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'thumb-card';
    const image = document.createElement('img');
    image.src = photo.dataUrl;
    image.alt = photo.name;
    image.addEventListener('click', () => openImageModal(photo.dataUrl, photo.name));
    const actions = document.createElement('div');
    actions.className = 'thumb-actions';
    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.textContent = 'Ver';
    viewBtn.addEventListener('click', () => openImageModal(photo.dataUrl, photo.name));
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remover';
    removeBtn.addEventListener('click', () => removePhoto(itemId, index));
    actions.append(viewBtn, removeBtn);
    cardEl.append(image, actions);
    list.appendChild(cardEl);
  });
}

function removePhoto(itemId, index) {
  state.items[itemId].photos.splice(index, 1);
  renderThumbs(itemId);
  autoSave('Foto removida.');
}

function removeAllPhotos(itemId) {
  if (!confirm('Deseja remover todas as fotos deste item?')) return;
  state.items[itemId].photos = [];
  renderThumbs(itemId);
  autoSave('Todas as fotos do item foram removidas.');
}

function openImageModal(src, caption) {
  dom.modalImage.src = src;
  dom.modalCaption.textContent = caption;
  dom.imageModal.classList.remove('hidden');
  dom.imageModal.setAttribute('aria-hidden', 'false');
}

function updateTerms() {
  const data = collectFormData();
  const nome = data.ownerName || '[nome]';
  const cpf = data.ownerCpf || '[cpf]';
  const dataAtendimento = formatDateLong(data.serviceDate) || '[data]';
  dom.termAcceptanceText.textContent = `Eu, ${nome}; CPF: ${cpf}, proprietário atual do veículo acima identificado, aceito a descrição acima, referente aos aspectos externos e internos do veículo e seus acessórios. ${CITY_NAME}, ${dataAtendimento}. Proprietário: assino e reconheço sua autenticidade para fins legais.`;
  dom.termDeliveryText.textContent = `Eu, ${nome}; CPF: ${cpf}, proprietário atual do veículo acima identificado, declaro para todos os fins que recebi o veículo, em estado geral e componentes, de acordo com o checklist acima, por mim assinado. Desde já, isento a TrocÓleo e seus colaboradores de qualquer responsabilidade quanto ao estado geral e componentes do veículo. ${CITY_NAME}, ${dataAtendimento}. Proprietário: assino e reconheço sua autenticidade para fins legais.`;
}

function formatDateLong(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString('pt-BR');
}

function handleNewChecklist() {
  if (!confirm('Criar um novo checklist mantendo o sistema aberto?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state.protocol = createProtocol();
  state.form = {};
  state.items = {};
  state.signature = null;
  dom.form.reset();
  dom.protocolDisplay.textContent = state.protocol;
  document.querySelectorAll('.inspection-card').forEach(card => {
    const itemId = card.dataset.itemId;
    state.items[itemId] = { photos: [], status: card.querySelector('.status-group').classList.contains('hidden') ? '' : 'Não verificado', observation: '', testPerformed: false };
    hydrateItemCard(itemId);
  });
  signaturePad.clear();
  dom.signatureStatus.textContent = 'Assinatura pendente.';
  updateTerms();
  autoSave('Novo checklist iniciado.');
}

function handleClearAll() {
  if (!confirm('Tem certeza que deseja limpar todo o formulário e apagar o rascunho salvo?')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PDF_STORAGE_KEY);
  handleNewChecklist();
}

function validateForm() {
  const requiredFields = Array.from(dom.form.querySelectorAll('[required]'));
  const missing = requiredFields.filter(field => !String(field.value || '').trim());
  if (missing.length) {
    missing[0].focus();
    alert('Preencha todos os campos obrigatórios antes de continuar.');
    return false;
  }
  if (!state.signature && signaturePad.isEmpty()) {
    alert('A assinatura do cliente é obrigatória para gerar o PDF.');
    return false;
  }
  return true;
}

function getChecklistData() {
  state.form = collectFormData();
  state.form.ownerCpf = formatCpf(state.form.ownerCpf);
  state.form.ownerPhone = formatPhone(state.form.ownerPhone);
  state.form.vehicleMileage = onlyDigits(state.form.vehicleMileage);
  state.form.vehiclePlate = formatPlate(state.form.vehiclePlate);
  state.signature = signaturePad && !signaturePad.isEmpty() ? signaturePad.toDataURL('image/png') : state.signature;
  return { protocol: state.protocol, form: state.form, items: state.items, signature: state.signature, generatedAt: new Date().toISOString() };
}

async function buildPdfBlob() {
  try {
    if (!validateForm()) return null;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    let y = 12;
    const data = getChecklistData();
    const addPageIfNeeded = (needed = 12) => {
      if (y + needed > pageHeight - 14) { doc.addPage(); y = 14; }
    };
    const textBlock = (text, x, top, maxWidth, lineHeight = 5.3) => {
      const lines = doc.splitTextToSize(text || '-', maxWidth);
      doc.text(lines, x, top);
      return lines.length * lineHeight;
    };
    const sectionTitle = title => {
      addPageIfNeeded(16);
      doc.setFillColor(10, 91, 215);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 10, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(title, margin + 4, y + 6.8);
      doc.setTextColor(20, 33, 61);
      y += 14;
    };
    const fieldGrid = fields => {
      const colGap = 4;
      const cols = 2;
      const boxWidth = (pageWidth - margin * 2 - colGap) / cols;
      const rowHeight = 16;
      fields.forEach((field, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = margin + col * (boxWidth + colGap);
        const top = y + row * (rowHeight + 3);
        addPageIfNeeded(rowHeight + 6);
        doc.setDrawColor(215, 223, 235);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, top, boxWidth, rowHeight, 3, 3, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(field.label, x + 3, top + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(String(field.value || '-'), boxWidth - 6);
        doc.text(lines.slice(0, 2), x + 3, top + 11);
      });
      y += (Math.ceil(fields.length / 2) * (rowHeight + 3)) + 2;
    };
    const addPhotosGrid = async (photos, captionPrefix) => {
      if (!photos?.length) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.text('Nenhuma foto registrada.', margin + 2, y);
        y += 6;
        return;
      }
      const cols = 2;
      const gap = 4;
      const imgW = (pageWidth - margin * 2 - gap) / cols;
      const imgH = 44;
      for (let i = 0; i < photos.length; i++) {
        const col = i % cols;
        if (col === 0) addPageIfNeeded(imgH + 14);
        const rowStart = y;
        const x = margin + col * (imgW + gap);
        const format = (photos[i].type || 'image/jpeg').includes('png') ? 'PNG' : 'JPEG';
        doc.setDrawColor(215, 223, 235);
        doc.roundedRect(x, rowStart, imgW, imgH, 3, 3);
        doc.addImage(photos[i].dataUrl, format, x + 1, rowStart + 1, imgW - 2, imgH - 2, undefined, 'FAST');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`${captionPrefix} ${i + 1}`, x, rowStart + imgH + 4);
        if (col === 1 || i === photos.length - 1) y = rowStart + imgH + 8;
      }
    };
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('', margin, y + 8);
    doc.setFontSize(16);
    doc.text('Check List Automotivo', margin, y + 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Empresa: TrocÓleo', 42, y + 15);
    doc.text(`Protocolo: ${data.protocol}`, 42, y + 21);
    doc.text(`Data de geração: ${new Date().toLocaleString('pt-BR')}`, pageWidth - margin, y + 8, { align: 'right' });
    doc.setDrawColor(215, 223, 235);
    doc.line(margin, y + 30, pageWidth - margin, y + 30);
    y += 38;
    sectionTitle('Dados do proprietário');
    fieldGrid([
      { label: 'Nome do proprietário atual', value: data.form.ownerName },
      { label: 'CPF', value: data.form.ownerCpf },
      { label: 'Habilitação', value: data.form.ownerLicense },
      { label: 'Telefone', value: data.form.ownerPhone },
      { label: 'Email', value: data.form.ownerEmail },
      { label: 'Endereço', value: data.form.ownerAddress }
    ]);
    sectionTitle('Identificação do veículo');
    fieldGrid([
      { label: 'Data do atendimento', value: formatDateLong(data.form.serviceDate) },
      { label: 'Marca', value: data.form.vehicleBrand },
      { label: 'Modelo', value: data.form.vehicleModel },
      { label: 'Cor', value: data.form.vehicleColor },
      { label: 'Ano', value: data.form.vehicleYear },
      { label: 'Placa', value: data.form.vehiclePlate },
      { label: 'Quilometragem atual', value: data.form.vehicleMileage ? `${Number(data.form.vehicleMileage).toLocaleString('pt-BR')} km` : '' }
    ]);
    sectionTitle('Aspectos externos');
    for (const item of EXTERNAL_ITEMS) {
      addPageIfNeeded(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(item.title, margin, y);
      y += 5;
      await addPhotosGrid(data.items[item.id]?.photos || [], item.title);
      y += 2;
    }
    sectionTitle('Aspectos internos');
    for (const item of INTERNAL_ITEMS) {
      addPageIfNeeded(28);
      const itemData = data.items[item.id] || {};
      doc.setDrawColor(215, 223, 235);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 18, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(item.title, margin + 3, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(`Status: ${itemData.status || 'Não verificado'}`, margin + 3, y + 12);
      if (item.hasTestCheckbox) doc.text(`Teste realizado: ${itemData.testPerformed ? 'Sim' : 'Não'}`, pageWidth - margin - 3, y + 12, { align: 'right' });
      y += 22;
      doc.setFont('helvetica', 'bold');
      doc.text('Observação:', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      const used = textBlock(itemData.observation || '-', margin, y, pageWidth - margin * 2);
      y += used + 2;
      await addPhotosGrid(itemData.photos || [], item.title);
      y += 4;
    }
    sectionTitle('Observações gerais');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    y += textBlock(data.form.generalNotes || '-', margin, y, pageWidth - margin * 2, 5.5) + 4;
    sectionTitle('Termos');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Termo de aceite', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    y += textBlock(dom.termAcceptanceText.textContent, margin, y, pageWidth - margin * 2, 5.4) + 5;
    addPageIfNeeded(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Termo de recebimento do veículo, após realização dos serviços de manutenção preventiva', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    y += textBlock(dom.termDeliveryText.textContent, margin, y, pageWidth - margin * 2, 5.4) + 10;
    addPageIfNeeded(58);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Assinatura do cliente', margin, y);
    y += 6;
    doc.setDrawColor(182, 195, 216);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 42, 3, 3);
    if (data.signature) doc.addImage(data.signature, 'PNG', margin + 2, y + 2, pageWidth - margin * 2 - 4, 38, undefined, 'FAST');
    y += 46;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Assinado por: ${data.form.ownerName || '-'} | CPF: ${data.form.ownerCpf || '-'} | ${CITY_NAME}, ${formatDateLong(data.form.serviceDate) || '-'}`, margin, y);
    const blob = doc.output('blob');
    state.pdfBlob = blob;
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    localStorage.setItem(PDF_STORAGE_KEY, base64);
    return blob;
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('Não foi possível gerar o PDF neste navegador.');
    return null;
  }
}

async function downloadPdf() {
  const blob = await buildPdfBlob();
  if (!blob) return;
  if (typeof saveAs === 'function') {
    saveAs(blob, `${state.protocol}-checklist-trocoleo.pdf`);
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${state.protocol}-checklist-trocoleo.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function previewPdf() {
  const blob = await buildPdfBlob();
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
}

async function printPdf() {
  const blob = await buildPdfBlob();
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => { URL.revokeObjectURL(url); iframe.remove(); }, 1500);
    }
  };
}

async function sharePdf() {
  const blob = await buildPdfBlob();
  if (!blob) return;
  const file = new File([blob], `${state.protocol}-checklist-trocoleo.pdf`, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ title: 'TrocÓleo Check List Automotivo', text: `Checklist ${state.protocol}`, files: [file] });
      return;
    } catch (e) {}
  }
  await downloadPdf();
}

async function exportPhotosZip() {
  const zip = new JSZip();
  const data = getChecklistData();
  const addFolderPhotos = async (folderName, item) => {
    const folder = zip.folder(folderName);
    const itemFolder = folder.folder(sanitizeFileName(item.title));
    const photos = data.items[item.id]?.photos || [];
    if (!photos.length) return;
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const ext = (photo.type || 'image/jpeg').includes('png') ? 'png' : 'jpg';
      const base64 = photo.dataUrl.split(',')[1];
      itemFolder.file(`${String(i + 1).padStart(2, '0')}-${sanitizeFileName(item.title)}.${ext}`, base64, { base64: true });
    }
  };
  for (const item of EXTERNAL_ITEMS) await addFolderPhotos('aspectos-externos', item);
  for (const item of INTERNAL_ITEMS) await addFolderPhotos('aspectos-internos', item);
  const hasAnyPhoto = [...EXTERNAL_ITEMS, ...INTERNAL_ITEMS].some(item => (data.items[item.id]?.photos || []).length);
  if (!hasAnyPhoto) { alert('Não há fotos para exportar neste atendimento.'); return; }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${state.protocol}-fotos-trocoleo.zip`);
}

function sanitizeFileName(value) {
  return String(value || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function fileToDataObject(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type || 'image/jpeg', size: file.size, dataUrl: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(binary);
}