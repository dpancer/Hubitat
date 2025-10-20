// ===============================
// content.js — Hubitat Highlighter V24 fixed for live logs
// Updated: fully reactive with MutationObserver; respects enabled checkbox and hub IP
// ===============================

if (!window.hubHighlightInitialized) {
    window.hubHighlightInitialized = true;

    const processedRows = new WeakSet();
    let currentSettings = { rowKeywords: [], inlineKeywords: [], hubIp: '', enabled: false };
    let observer = null;
    let isActive = false; // whether highlighter is currently active

    // ------------------------------
    // Utility: Escape RegExp special characters
    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // ------------------------------
    // Compare numeric IPs to avoid string issues like .1 vs .10
    function ipMatches(hostname, hubIp) {
        if (!hostname || !hubIp) return false;
        const hParts = hostname.split('.').map(Number);
        const ipParts = hubIp.split('.').map(Number);
        if (hParts.length !== 4 || ipParts.length !== 4) return false;
        return hParts.every((v, i) => v === ipParts[i]);
    }

    // ------------------------------
    // Inline highlight
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
        } catch (e) { console.warn("⚠️ highlightInline error:", e); }
    }

    // ------------------------------
    // Row highlight
    function highlightRow(row, color, borderColor) {
        if (!row || !document.body.contains(row)) return;
        try {
            row.style.backgroundColor = color;
            row.style.borderLeft = `4px solid ${borderColor}`;
            processedRows.add(row);
        } catch (e) { console.warn("⚠️ highlightRow error:", e); }
    }

    // ------------------------------
    // Clear highlights from a row
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
        } catch (e) { console.warn("⚠️ clearHighlight error:", e); }
    }

    // ------------------------------
    // Process a single row for highlighting
    function processRow(row, rowKeywords, inlineKeywords) {
        if (!row || !document.body.contains(row)) return;

        // Clear previous highlights
        clearHighlight(row);

        // Only process if active
        if (!isActive) return;

        try {
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
            row.dataset.hubicol = "1"; // mark processed
        } catch (e) { console.warn("⚠️ processRow error:", e); }
    }

    // ------------------------------
    // Apply highlights to all rows
    function applyAll() {
        const rows = document.querySelectorAll('div.mb-1');
        if (!isActive) {
            rows.forEach(clearHighlight);
            return;
        }
        rows.forEach(row => processRow(row, currentSettings.rowKeywords, currentSettings.inlineKeywords));
    }

    // ------------------------------
    // Start MutationObserver (react to new rows)
    function startObserver() {
        if (observer) observer.disconnect();

        observer = new MutationObserver(mutations => {
            if (!isActive) return;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    if (node.matches && node.matches('div.mb-1')) {
                        processRow(node, currentSettings.rowKeywords, currentSettings.inlineKeywords);
                    } else {
                        const nodes = node.querySelectorAll && node.querySelectorAll('div.mb-1');
                        if (nodes && nodes.length) nodes.forEach(r => processRow(r, currentSettings.rowKeywords, currentSettings.inlineKeywords));
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
        console.log("👀 MutationObserver started for live logs");

        // Apply existing rows immediately
        applyAll();
    }

    // ------------------------------
    // Stop observer
    function stopObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        console.log("🛑 MutationObserver stopped");
    }

    // ------------------------------
    // Update active state (start/stop observers only on transition)
    function updateActiveState() {
        const shouldBeActive = currentSettings.enabled && ipMatches(window.location.hostname, currentSettings.hubIp);

        if (shouldBeActive && !isActive) {
            isActive = true;
            console.log("✅ Activating highlighter (enabled + IP match)");
            startObserver();
        } else if (!shouldBeActive && isActive) {
            isActive = false;
            console.log("❌ Disabling highlighter (disabled or IP mismatch)");
            stopObserver();
            document.querySelectorAll('div.mb-1').forEach(clearHighlight);
        } else if (isActive) {
            applyAll();
        } else {
            document.querySelectorAll('div.mb-1').forEach(clearHighlight);
        }
    }

    // ------------------------------
    // Load settings safely from storage
    function safeLoadSettings(callback) {
        if (!chrome?.storage?.sync?.get) return;
        chrome.storage.sync.get(['hubIp', 'enabled', 'rowKeywords', 'inlineKeywords'], data => {
            currentSettings = {
                rowKeywords: data.rowKeywords || [],
                inlineKeywords: data.inlineKeywords || [],
                hubIp: data.hubIp || '',
                enabled: data.enabled
            };
            console.log("💾 Loaded settings:", currentSettings);
            updateActiveState();
            if (callback) callback();
        });
    }

    // ------------------------------
    // Listen for messages from popup.js
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg && msg.action === 'applySettings') {
            safeLoadSettings(() => {
                if (sendResponse) sendResponse({ status: 'applied' });
            });
            return true;
        }
    });

    // ------------------------------
    // React to storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        const relevantKeys = ['hubIp', 'enabled', 'rowKeywords', 'inlineKeywords'];
        if (relevantKeys.some(k => changes[k])) {
            safeLoadSettings();
        }
    });

    // ------------------------------
    // Initial load
    safeLoadSettings();

    console.log("✅ Hubitat Highlighter V24 live logs fully reactive (MutationObserver, no setInterval)");
}
