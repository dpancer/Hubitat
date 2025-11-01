// ===============================
// options.js — Hubitat Highlighter V7.5
// Fully reactive: row highlights + borders
// Updated: sends proper messages to content.js and matchborder.js
// ===============================

document.addEventListener('DOMContentLoaded', () => {
  const hubIpInput = document.getElementById('hubIp');
  const enableToggle = document.getElementById('enableToggle');
  const rowKeywordList = document.getElementById('rowKeywordList');
  const inlineKeywordList = document.getElementById('inlineKeywordList');
  const addRowKeywordBtn = document.getElementById('addRowKeyword');
  const addInlineKeywordBtn = document.getElementById('addInlineKeyword');
  const saveBtn = document.getElementById('saveBtn');

  // ------------------------------
  // Load saved settings
  chrome.storage.sync.get(['hubIp','enabled','rowKeywords','inlineKeywords'], data => {
    hubIpInput.value = data.hubIp || '';
    enableToggle.checked = data.enabled !== false;
    (data.rowKeywords || []).forEach(k => addRowKeywordRow(k.key, k.color));
    (data.inlineKeywords || []).forEach(k => addInlineKeywordRow(k.key, k.color));
    console.log("💾 Options loaded:", data);
  });

  // ------------------------------
  // Event listeners
  if (addRowKeywordBtn) addRowKeywordBtn.addEventListener('click', () => addRowKeywordRow('', '#ffff00'));
  if (addInlineKeywordBtn) addInlineKeywordBtn.addEventListener('click', () => addInlineKeywordRow('', '#ffff00'));
  if (saveBtn) saveBtn.addEventListener('click', saveAndApply);

  // ------------------------------
  // Add row keyword input
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

  // Add inline keyword input
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

  // ------------------------------
  // Save settings and broadcast
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

    const settings = {
      hubIp: hubIpInput.value.trim(),
      enabled: enableToggle.checked,
      rowKeywords,
      inlineKeywords
    };

    chrome.storage.sync.set(settings, () => {
      console.log("💾 Settings saved:", settings);
      
      broadcastApplyToTabs(settings);
    });
  }

  // ------------------------------
  // Broadcast settings to all relevant tabs
  function broadcastApplyToTabs(settings) {
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        if (!tab.url) return;

        const isLogsPage = tab.url.includes('/logs');
        const isHubPage = tab.url.includes('/device') || tab.url.includes('/app') || tab.url.includes('/hub');

        if (!isLogsPage && !isHubPage) return;

        const sendMessageToTab = (tabId, message, file) => {
          chrome.tabs.sendMessage(tabId, message, response => {
            if (chrome.runtime.lastError) {
              // Content script not loaded, inject it first
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: [file]
              }, () => {
                try {
                  chrome.tabs.sendMessage(tabId, message);
                  console.log(`📤 Message sent after injection:`, message);
                } catch(e) {
                  console.warn('⚠️ Could not send message after injection', e);
                }
              });
            } else {
              console.log(`📤 Message sent:`, message);
            }
          });
        };

        // ------------------------------
        // Row & inline highlights (content.js)
        if (isLogsPage) {
          sendMessageToTab(tab.id, { action: 'applySettings' }, 'content.js');
        }

        // ------------------------------
        // Borders (matchborder.js)
        if (isHubPage || isLogsPage) {
          sendMessageToTab(tab.id, { action: 'applyMatchBorder', keywords: settings.rowKeywords }, 'matchborder.js');
        }
      });
    });
  }
});
