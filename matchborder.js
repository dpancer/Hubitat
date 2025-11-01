// ===============================
// Version: 7.5
// matchborder.js — Hubitat Highlighter (Devices + Apps + Top Panel Names)
// Fully reactive, incremental updates, persistent storage, detailed logging
// Updated: early exit if disabled, respect hub IP, auto-clear borders on disable or wrong IP
//          safe skip cross-origin iframes to prevent console errors
// ===============================

console.log("💡 MatchBorder initialized");

let hubitatTables = { devices: [], apps: [] };

// ------------------------------
// Utilities
// ------------------------------
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const interval = 100;
        let elapsed = 0;
        const checker = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(checker);
                resolve(el);
            } else if (elapsed >= timeout) {
                clearInterval(checker);
                reject(`Element not found: ${selector}`);
            }
            elapsed += interval;
        }, interval);
    });
}

function applyBorder(el, color) {
    if (!el) return;
    el.style.border = `4px solid ${color}`;
    el.style.borderRadius = '4px';
    el.style.setProperty('padding', '1px 3px', 'important');
}

function clearAllBorders() {
    document.querySelectorAll('.p-panel-content a').forEach(a => {
        a.style.border = '';
        a.style.borderRadius = '';
    });
    console.log('⚠️ Borders cleared');
}

// ------------------------------
// Fetch & Update Hubitat Tables
// ------------------------------
async function fetchHubitatTables(enabled, hubIp) {
    // Early exit if extension is disabled
    if (!enabled) {
        console.log('⚠️ Extension disabled — skipping table fetch');
        clearAllBorders();
        return;
    }

    // Early exit if hub IP doesn't match
    if (!hubIp || !window.location.hostname.includes(hubIp)) {
        console.log('⚠️ Hub IP mismatch — skipping table fetch');
        clearAllBorders();
        return;
    }

    // Early exit if device/app search filter has text
waitForElement('input.custom-search-input', 2000).then(searchInput => {
    if (searchInput.value.trim() !== '') {
        showToast('⚠️ Device/App search filters must be cleared to log colors properly');
        clearAllBorders();
        return;
    }
}).catch(() => {
    // Input not found — safe to continue
});




// ------------------------------
// Utility: Show toast notification (Hubitat style, green #169c00)
// ------------------------------
function showToast(message, duration = 6000) {
    // Remove any existing toast
    const existing = document.getElementById('hubitat-toast');
    if (existing) existing.remove();

    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'hubitat-toast';
    toast.textContent = message;

    // Style the toast
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 20px';
    toast.style.backgroundColor = 'rgba(22, 156, 0, 0.8)'; // Hubitat green with 80% opacity
    toast.style.color = '#ffffff';  // White text stays fully opaque
    toast.style.fontWeight = '600';          // Semi-bold for crispness
    toast.style.fontFamily = 'Inter, sans-serif'; // Hubitat font
    toast.style.fontSize = '16px';
    toast.style.borderRadius = '6px';
    toast.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    toast.style.zIndex = '9999';
    toast.style.opacity = '1';
    toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    toast.style.transform = 'translateY(-20px)';
    toast.style.willChange = 'transform, opacity';
    toast.style.webkitFontSmoothing = 'antialiased';
    toast.style.textShadow = 'none'; // remove blur

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    // Animate out and remove after duration
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}









    try {
        chrome.storage.local.get(['hubitatTables'], data => {
            hubitatTables = data.hubitatTables || { devices: [], apps: [] };

            // ----- Devices page -----
            if (window.location.pathname.includes('/device/list')) {
                waitForElement('div.p-treetable-wrapper').then(deviceTable => {
                    const deviceRows = deviceTable.querySelectorAll('tr');
                    hubitatTables.devices = Array.from(deviceRows).map(row => {
                        const anchor = row.querySelector('a.device-column-label-link');
                        if (!anchor) return null;
                        const nameSpan = anchor.querySelector('div.w-fit > span:first-child');
                        const name = nameSpan ? nameSpan.textContent.trim() : '';
                        const id = `dev:${anchor.id.replace('rowAnchorDEV-', '').trim()}`;
                        return { id, name };
                    }).filter(Boolean);

                    chrome.storage.local.set({ hubitatTables }, () => {
                        console.log("💾 Hubitat devices updated:", hubitatTables.devices);
                    });
                }).catch(e => console.warn('⚠️ Device table not found:', e));
            }

            // ----- Apps page -----
            if (window.location.pathname.includes('/installedapp/list')) {
                waitForElement('table tbody').then(appTable => {
                    const appRows = appTable.querySelectorAll('tr');
                    hubitatTables.apps = Array.from(appRows).map(row => {
                        const anchor = row.querySelector('a.app-column-label-link span');
                        if (!anchor) return null;
                        const name = anchor.textContent.replace(/\s*\(.*?\)\s*/g, '').trim();
                        const idMatch = row.querySelector('td.app-column-id span');
                        const idText = idMatch ? idMatch.textContent.trim() : '';
                        return { id: `app:${idText}`, name };
                    }).filter(Boolean);

                    chrome.storage.local.set({ hubitatTables }, () => {
                        console.log("💾 Hubitat apps updated:", hubitatTables.apps);
                    });
                }).catch(e => console.warn('⚠️ App table not found:', e));
            }
        });
    } catch (e) {
        console.warn('⚠️ Error fetching Hubitat tables:', e);
    }
}


// ------------------------------
// Apply Borders Based on Keywords (safe for cross-origin iframes)
// ------------------------------
function applyMatchBorders(keywords, enabled, hubIp) {
    if (!enabled) {
        console.log('⚠️ Extension disabled — skipping border application');
        clearAllBorders();
        return;
    }

    if (!hubIp || !window.location.hostname.includes(hubIp)) {
        console.log('⚠️ Hub IP mismatch — skipping border application');
        clearAllBorders();
        return;
    }

    if (!keywords || keywords.length === 0) return;

    console.log('💡 Applying borders with keywords:', keywords);

    try {
        // Filter out links inside cross-origin iframes
        const topLinks = Array.from(document.querySelectorAll('.p-panel-content a'))
            .filter(a => {
                try {
                    a.ownerDocument.defaultView;
                    return true;
                } catch (e) {
                    console.warn('⚠️ Skipping link inside cross-origin iframe:', a);
                    return false;
                }
            });

        topLinks.forEach(a => { a.style.border = ''; a.style.borderRadius = ''; });

        const matchesApplied = [];

        keywords.forEach(kw => {
            const devMatch = hubitatTables.devices.find(d => d.id === kw.key);
            const appMatch = hubitatTables.apps.find(a => a.id === kw.key);
            if (!devMatch && !appMatch) return;

            const item = devMatch || appMatch;

            topLinks.forEach(a => {
                const linkText = a.textContent.trim();
                if (linkText.startsWith(item.name)) {
                    applyBorder(a, kw.color);
                    matchesApplied.push({ id: item.id, name: linkText, color: kw.color });
                    console.log(`✨ Border applied: ${linkText} → ${kw.color}`);
                }
            });
        });

        console.log('💡 Matches applied:', matchesApplied);
    } catch (e) {
        console.warn('⚠️ Error in applyMatchBorders:', e);
    }
}

// ------------------------------
// Message Listener
// ------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.action) return;

    chrome.storage.sync.get(['enabled', 'hubIp'], data => {
        const enabled = data.enabled;
        const hubIp = data.hubIp || '';

        if (msg.action === 'applyMatchBorder') {
            if (!enabled || !hubIp || !window.location.hostname.includes(hubIp)) {
                clearAllBorders();
                if (sendResponse) sendResponse({ status: 'bordersCleared' });
                return;
            }

            if (Array.isArray(msg.keywords)) {
                chrome.storage.local.get(['hubitatTables'], data => {
                    if (data.hubitatTables) hubitatTables = data.hubitatTables;
                    applyMatchBorders(msg.keywords, enabled, hubIp);
                    if (sendResponse) sendResponse({ status: 'bordersApplied' });
                });
            }
        }

        if (msg.action === 'clearMatchBorder') {
            clearAllBorders();
            if (sendResponse) sendResponse({ status: 'bordersCleared' });
        }
    });

    return true;
});

// ------------------------------
// Auto-fetch tables & apply borders on page load
// ------------------------------
chrome.storage.sync.get(['enabled', 'rowKeywords', 'hubIp'], data => {
    const enabled = data.enabled;
    const hubIp = data.hubIp || '';
    const rowKeywords = data.rowKeywords || [];

    if (!enabled || !hubIp || !window.location.hostname.includes(hubIp)) {
        clearAllBorders();
        return;
    }

    fetchHubitatTables(enabled, hubIp);

    // Apply borders to existing top links after short delay
    setTimeout(() => {
        try {
            applyMatchBorders(rowKeywords, enabled, hubIp);
        } catch (e) {
            console.warn('⚠️ Failed to apply borders on page load:', e);
        }
    }, 500);

    // ------------------------------
    // Reactive: Watch for new top-panel links (safe for cross-origin iframes)
    // ------------------------------
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node instanceof HTMLElement) {
                    const links = Array.from(node.querySelectorAll?.('.p-panel-content a') || [])
                        .filter(a => {
                            try {
                                a.ownerDocument.defaultView;
                                return true;
                            } catch (e) {
                                console.warn('⚠️ Skipping link inside cross-origin iframe:', a);
                                return false;
                            }
                        });
                    if (links.length) {
                        console.log('🆕 New top-panel links detected:', links);
                        try {
                            applyMatchBorders(rowKeywords, enabled, hubIp);
                        } catch (e) {
                            console.warn('⚠️ Failed to apply borders in MutationObserver:', e);
                        }
                    }
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log('🔍 MutationObserver watching body for new top-panel links');
});

// ------------------------------
// Listen for storage changes
// ------------------------------
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;

    chrome.storage.sync.get(['enabled', 'hubIp', 'rowKeywords'], data => {
        const enabled = data.enabled;
        const hubIp = data.hubIp || '';
        const rowKeywords = data.rowKeywords || [];

        if (!enabled || !hubIp || !window.location.hostname.includes(hubIp)) {
            clearAllBorders();
        } else {
            try {
                applyMatchBorders(rowKeywords, enabled, hubIp);
            } catch (e) {
                console.warn('⚠️ Failed to apply borders after storage change:', e);
            }
        }
    });
});

console.log("✅ MatchBorder ready and reactive");
