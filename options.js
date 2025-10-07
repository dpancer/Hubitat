// options.js — Hubitat Highlighter V12

document.addEventListener('DOMContentLoaded', () => {
  const hubIpInput = document.getElementById('hubIp');
  const enableToggle = document.getElementById('enableToggle');
  const rowKeywordList = document.getElementById('rowKeywordList');
  const inlineKeywordList = document.getElementById('inlineKeywordList');
  const addRowKeywordBtn = document.getElementById('addRowKeyword');
  const addInlineKeywordBtn = document.getElementById('addInlineKeyword');
  const saveBtn = document.getElementById('saveBtn');

  // Load saved settings
  chrome.storage.sync.get(['hubIp','enabled','rowKeywords','inlineKeywords'], data => {
    hubIpInput.value = data.hubIp || '';
    enableToggle.checked = data.enabled !== false;
    (data.rowKeywords || []).forEach(k => addRowKeywordRow(k.key, k.color));
    (data.inlineKeywords || []).forEach(k => addInlineKeywordRow(k.key, k.color));
  });

  // Event listeners
  if (addRowKeywordBtn) addRowKeywordBtn.addEventListener('click', () => addRowKeywordRow('', '#ffff00'));
  if (addInlineKeywordBtn) addInlineKeywordBtn.addEventListener('click', () => addInlineKeywordRow('', '#ffff00'));
  if (saveBtn) saveBtn.addEventListener('click', saveAndApply);

  function addRowKeywordRow(key = '', color = '#ffff00') {
    const row = document.createElement('div');
    row.className = 'keywordRow';
    row.innerHTML = `
      <input type="text" class="key" placeholder="Keyword" value="${key}">
      <input type="color" class="color" value="${color}">
      <button class="remove">X</button>
    `;
    row.querySelector('.remove').addEventListener('click', () => row.remove());
    rowKeywordList.appendChild(row);
  }

  function addInlineKeywordRow(key = '', color = '#ffff00') {
    const row = document.createElement('div');
    row.className = 'keywordRow';
    row.innerHTML = `
      <input type="text" class="key" placeholder="Keyword" value="${key}">
      <input type="color" class="color" value="${color}">
      <button class="remove">X</button>
    `;
    row.querySelector('.remove').addEventListener('click', () => row.remove());
    inlineKeywordList.appendChild(row);
  }

  function saveAndApply() {
    const rowKeywords = [];
    rowKeywordList.querySelectorAll('.keywordRow').forEach(r => {
      const keyInput = r.querySelector('.key');
      const colorInput = r.querySelector('.color');
      if (keyInput && keyInput.value.trim()) rowKeywords.push({ key: keyInput.value.trim(), color: colorInput.value || '#ffff00' });
    });

    const inlineKeywords = [];
    inlineKeywordList.querySelectorAll('.keywordRow').forEach(r => {
      const keyInput = r.querySelector('.key');
      const colorInput = r.querySelector('.color');
      if (keyInput && keyInput.value.trim()) inlineKeywords.push({ key: keyInput.value.trim(), color: colorInput.value || '#ffff00' });
    });

    chrome.storage.sync.set({
      hubIp: hubIpInput.value.trim(),
      enabled: enableToggle.checked,
      rowKeywords,
      inlineKeywords
    }, () => {
      alert('Settings saved!');
      broadcastApplyToTabs();
    });
  }

  function broadcastApplyToTabs() {
    // Query all tabs, apply to any /logs page
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        if (!tab.url || !tab.url.includes('/logs')) return;

        chrome.tabs.sendMessage(tab.id, { action: 'applySettings' }, response => {
          if (chrome.runtime.lastError) {
            // Content script not loaded, inject
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            }, () => {
              try {
                chrome.tabs.sendMessage(tab.id, { action: 'applySettings' });
              } catch(e) {
                console.warn('Could not apply highlights after injection', e);
              }
            });
          }
        });
      });
    });
  }
});
