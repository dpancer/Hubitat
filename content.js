// ===============================
// content.js — Hubitat Highlighter V24
// Row + inline highlights, live + reload-safe + fully reactive to settings
// ===============================

if (!window.hubHighlightInitialized) {
    window.hubHighlightInitialized = true;

    const processedRows = new WeakSet();
    let currentSettings = { rowKeywords: [], inlineKeywords: [], hubIp: '', enabled: false };
    const containerSelector = '#pv_id_34_0_content';
    let observer = null;
    let refreshInterval = null;

    // ------------------------------
    // Utilities
    // ------------------------------
    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function highlightInline(span, inlineKeywords) {
        if (!span || !document.body.contains(span)) return;
        try {
            span.querySelectorAll('span.inline-highlight').forEach(s => {
                const parent = s.parentNode;
                while (s.firstChild) parent.insertBefore(s.firstChild, s);
                parent.removeChild(s);
            });

            inlineKeywords.forEach(ik => {
                if (!ik.key) return;
                const regex = new RegExp(escapeRegExp(ik.key), 'gi');
                const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
                const nodes = [];
                while (walker.nextNode()) nodes.push(walker.currentNode);

                nodes.forEach(textNode => {
                    const frag = document.createDocumentFragment();
                    let lastIndex = 0, match;
                    const text = textNode.textContent;
                    while ((match = regex.exec(text)) !== null) {
                        if (match.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                        const highlight = document.createElement('span');
                        highlight.className = 'inline-highlight';
                        highlight.style.backgroundColor = ik.color;
                        highlight.textContent = match[0];
                        frag.appendChild(highlight);
                        lastIndex = match.index + match[0].length;
                    }
                    if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
                    textNode.parentNode.replaceChild(frag, textNode);
                });
            });
        } catch(e) {}
    }

    function highlightRow(row, color, borderColor) {
        if (!row || !document.body.contains(row)) return;
        try {
            row.style.backgroundColor = color;
            row.style.borderLeft = `4px solid ${borderColor}`;
            processedRows.add(row);
        } catch(e){}
    }

    function clearHighlight(row) {
        if (!row || !document.body.contains(row)) return;
        try {
            row.style.backgroundColor = '';
            row.style.borderLeft = '';
            const logSpan = row.querySelector('span.pl-1');
            if (logSpan) {
                logSpan.querySelectorAll('span.inline-highlight').forEach(s => {
                    const parent = s.parentNode;
                    while (s.firstChild) parent.insertBefore(s.firstChild, s);
                    parent.removeChild(s);
                });
            }
            processedRows.delete(row);
        } catch(e){}
    }

    function processRow(row, rowKeywords, inlineKeywords) {
        if (!row || !document.body.contains(row)) return;
        try {
            clearHighlight(row);
            const logSpan = row.querySelector('span.pl-1');
            if (!logSpan) return;
            const fullText = row.textContent.trim();
            for (const rk of rowKeywords) {
                if (!rk.key) continue;
                const regex = new RegExp(`^${escapeRegExp(rk.key)}`, 'i');
                if (regex.test(fullText)) {
                    highlightRow(row, rk.color, 'orange');
                    break;
                }
            }
            highlightInline(logSpan, inlineKeywords);
            row.dataset.hubicol = "1";
        } catch(e){}
    }

    function applyAll() {
        const rows = document.querySelectorAll('div.mb-1');
        if (!currentSettings.enabled || !window.location.hostname.includes(currentSettings.hubIp)) {
            // Clear highlights if disabled or wrong IP
            rows.forEach(clearHighlight);
            return;
        }
        rows.forEach(row => processRow(row, currentSettings.rowKeywords, currentSettings.inlineKeywords));
    }

    // ------------------------------
    // Load settings safely
    // ------------------------------
    function safeLoadSettings(callback) {
        if (!chrome?.storage?.sync?.get) return;
        chrome.storage.sync.get(['hubIp','enabled','rowKeywords','inlineKeywords'], data => {
            currentSettings = {
                rowKeywords: data.rowKeywords || [],
                inlineKeywords: data.inlineKeywords || [],
                hubIp: data.hubIp || '',
                enabled: data.enabled
            };
            if (callback) callback();
        });
    }

    // ------------------------------
    // Initialize MutationObserver and interval
    // ------------------------------
    function initObserverAndInterval() {
        const container = document.querySelector(containerSelector);
        if (!container || !document.body.contains(container)) {
            setTimeout(initObserverAndInterval, 200);
            return;
        }

        // Disconnect previous observer if exists
        if (observer) observer.disconnect();

        observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if(node.nodeType === 1 && node.classList.contains('mb-1')) {
                        processRow(node, currentSettings.rowKeywords, currentSettings.inlineKeywords);
                    }
                });
            });
        });
        observer.observe(container, { childList: true, subtree: true });

        // Clear old interval if exists
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => applyAll(), 1000);

        // Apply highlights initially
        applyAll();
    }

    // ------------------------------
    // Listen for save/apply messages
    // ------------------------------
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'applySettings') {
            safeLoadSettings(() => {
                applyAll();
                if (sendResponse) sendResponse({ status: 'applied' });
            });
            return true; // keep async channel open
        }
    });

    // Initial load
    safeLoadSettings(() => initObserverAndInterval());

    console.log("✅ Hubitat Highlighter V24 running (row + inline, live + reload + reactive settings)");
}
