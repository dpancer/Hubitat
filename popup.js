document.addEventListener('DOMContentLoaded', () => {
  const hubIpInput = document.getElementById('hubIp');
  const enableToggle = document.getElementById('enableToggle');
  const rowKeywordList = document.getElementById('rowKeywordList');
  const inlineKeywordList = document.getElementById('inlineKeywordList');
  const addRowKeywordBtn = document.getElementById('addRowKeyword');
  const addInlineKeywordBtn = document.getElementById('addInlineKeyword');
  const saveBtn = document.getElementById('saveBtn');
  const openOptionsBtn = document.getElementById('openOptions');

  // Load saved settings
  chrome.storage.sync.get(['hubIp','enabled','rowKeywords','inlineKeywords'], data => {
    hubIpInput.value = data.hubIp || '';
    enableToggle.checked = data.enabled !== false;
    (data.rowKeywords || []).forEach(k => addRowKeywordRow(k.key, k.color));
    (data.inlineKeywords || []).forEach(k => addInlineKeywordRow(k.key, k.color));
  });

  if (addRowKeywordBtn) addRowKeywordBtn.addEventListener('click', () => addRowKeywordRow('', '#ffff00'));
  if (addInlineKeywordBtn) addInlineKeywordBtn.addEventListener('click', () => addInlineKeywordRow('', '#ffff00'));
  if (saveBtn) saveBtn.addEventListener('click', () => saveAndApply());
  if (openOptionsBtn) openOptionsBtn.addEventListener('click', () => saveAndApply(() => chrome.runtime.openOptionsPage()));

  function addRowKeywordRow(key='', color='#ffff00') {
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

  function addInlineKeywordRow(key='', color='#ffff00') {
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

  function saveAndApply(callback) {
    const rowKeywords = Array.from(rowKeywordList.querySelectorAll('.keywordRow'))
      .map(r => {
        const key = r.querySelector('.key').value.trim();
        const color = r.querySelector('.color').value || '#ffff00';
        return key ? { key, color } : null;
      }).filter(Boolean);

    const inlineKeywords = Array.from(inlineKeywordList.querySelectorAll('.keywordRow'))
      .map(r => {
        const key = r.querySelector('.key').value.trim();
        const color = r.querySelector('.color').value || '#ffff00';
        return key ? { key, color } : null;
      }).filter(Boolean);

    chrome.storage.sync.set({
      hubIp: hubIpInput.value.trim(),
      enabled: enableToggle.checked,
      rowKeywords,
      inlineKeywords
    }, () => {
      if (callback) callback();
      else alert('Settings saved!');

      // Apply to active /logs tab
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (!tabs || !tabs[0]) return;
        const tabId = tabs[0].id;

        try {
          chrome.tabs.sendMessage(tabId, { action: 'applySettings' }, response => {
            if (chrome.runtime.lastError) {
              // Inject content script dynamically if not present
              chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js']
              }, () => {
                try {
                  chrome.tabs.sendMessage(tabId, { action: 'applySettings' });
                } catch(e) {
                  console.warn('Failed to apply highlights after injection:', e);
                }
              });
            }
          });
        } catch(e) {
          console.warn('Error sending message to content script:', e);
        }
      });
    });
  }
});
