// --- 환경 설정 및 상수 ---
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyfH8NgvggsTWd9-GNpajUFQrBf0GF4sqHyMl9VUljqRmOYdO-NaWlrBMM-ZEDIYvDg1w/exec'; // Keep if used for schedule/youtube
const baseballBaseUrl = 'https://global-media.sooplive.com/live/soopbaseball';
const chzzkProxyBaseUrl = 'https://chzzk-api-proxy.hibiya.workers.dev/m3u8-redirect/';
const HLS_PLAYER_EMBED_BASE_URL = 'https://www.livereacting.com/tools/hls-player-embed?url='; // New HLS Player

// --- 상태 변수 ---
// Removed isFirefoxMode, extensionId
let youtubeUrlsFromSheet = {};
let lckScheduleData = [];
let playerCount = 1;
let clickIndex = 0;
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

// --- DOM 요소 캐싱 변수 ---
let lckChannelList, favoriteChannelList, sportsChannelList,
    playerContainer, sidebar, favoriteModal, favoriteList,
    lckScheduleContainer, toggleBtnElement, chatContainer; // Removed modeToggleBtn, firefoxNotice, chromeNotice. Added chatContainer

// --- 채널 데이터 정의 (No changes needed here, but ensure className is appropriate) ---
const baseballChannelsData = Array.from({ length: 5 }, (_, i) => ({
    name: `야${i + 1}`, url: `${baseballBaseUrl}${i + 1}/master.m3u8`, type: 'm3u8', className: 'channel-button is-outlined'
}));
const spotvChannelsData = Array.from({ length: 40 }, (_, i) => {
    const cn = String(i + 1).padStart(2, '0');
    return { name: `${i + 1}`, url: `https://ch${cn}-nlivecdn.spotvnow.co.kr/ch${cn}/decr/medialist_14173921312004482655_hls.m3u8`, type: 'm3u8', className: 'channel-button is-outlined' };
});
const sportsChannels = [...baseballChannelsData, ...spotvChannelsData];
const lckChannels = [
    { name: 'L', url: 'https://global-media.sooplive.com/live/lckkr/master.m3u8', type: 'm3u8', tooltip: 'soop', className: 'lck-channel-btn is-outlined' },
    { name: 'C', url: `${chzzkProxyBaseUrl}9381e7d6816e6d915a44a13c0195b202`, type: 'm3u8', tooltip: 'chzzk', className: 'lck-channel-btn is-outlined' },
    { name: 'K', url: '', type: 'iframe', tooltip: 'youtube', className: 'lck-channel-btn is-outlined' }
];
const streamerChannels = [
    { name: '풍', id: '7ce8032370ac5121dcabce7bad375ced', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' },
    { name: '침', id: 'bb382c2c0cc9fa7c86ab3b037fb5799c', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' },
    { name: '추', id: '181a3baebe508d3b5fa5d9fe4d6b5241', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' },
    { name: '솝', id: '34a2bd4f5988e37693e94306f0bfe57f', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' },
    { name: '센', id: 'be243c7cbfb8d4e28777eedc43e28181', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' }
];

// --- DOM 요소 캐싱 함수 ---
function cacheDOMElements() {
    lckChannelList = document.getElementById('lck-channels');
    favoriteChannelList = document.getElementById('favorite-channels');
    sportsChannelList = document.getElementById('sports-channels');
    playerContainer = document.getElementById('player-container');
    sidebar = document.getElementById('sidebar');
    favoriteModal = document.getElementById('favorite-modal');
    favoriteList = document.getElementById('favorite-list');
    // modeToggleBtn, firefoxNotice, chromeNotice removed
    lckScheduleContainer = document.getElementById('lck-schedule');
    toggleBtnElement = document.getElementById('toggle-btn');
    chatContainer = document.getElementById('chat-container'); // Cache chat container
}

// --- 함수 정의 ---

// Removed updateModeStyles()
// Removed toggleMode()

// --- KST Date and YouTube URL Fetching (Keep if needed) ---
function getKstDate() {
    const date = new Date();
    const kstOffset = 9 * 60;
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const kstDate = new Date(utc + (kstOffset * 60000));
    return kstDate.toISOString().split('T')[0];
}

function getYouTubeLiveOrUpcoming() {
    const today = getKstDate();
    if (youtubeUrlsFromSheet && youtubeUrlsFromSheet[today] && youtubeUrlsFromSheet[today].url) {
        return youtubeUrlsFromSheet[today].url;
    }
    return null; // Keep default behavior
}

// --- URL Transformation (Keep as is, it prepares the URL for loadPlayer) ---
function transformUrl(url) {
    // This function remains crucial for converting various inputs
    // (Chzzk IDs, short URLs, channel pages) into direct embeddable
    // or m3u8 URLs. The output of this function is then used by loadPlayer.
     if (!url) return null;
     if (url.includes('.m3u8')) return url; // Already m3u8, pass through
     const chzzkIdPattern = /^[0-9a-fA-F]{32}$/;
     if (chzzkIdPattern.test(url)) return `${chzzkProxyBaseUrl}${url}`; // Convert Chzzk ID to proxy m3u8 URL

     // Handle lolcast URLs
     if (url.startsWith('https://lolcast.kr/#/player/')) {
         try {
             const hashPart = url.split('#')[1];
             if (hashPart) {
                 const pathSegments = hashPart.split('/').filter(segment => segment.length > 0);
                 if (pathSegments.length === 3 && pathSegments[0] === 'player') {
                     const platform = pathSegments[1].toLowerCase();
                     const channelId = pathSegments[2];
                     console.log(`[transformUrl] lolcast.kr 파싱: 플랫폼=${platform}, 채널ID=${channelId}`);
                     switch (platform) {
                         case 'youtube': return `https://www.youtube.com/embed/${channelId}`;
                         case 'twitch': return `https://player.twitch.tv/?channel=${channelId}&parent=${window.location.hostname}&parent=lolcast.kr&autoplay=true&muted=true`; // Added autoplay/muted
                         case 'chzzk':
                             return chzzkIdPattern.test(channelId) ? `${chzzkProxyBaseUrl}${channelId}` : `https://chzzk.naver.com/live/${channelId}`;
                         case 'kick': return `https://player.kick.com/${channelId}`;
                         case 'afreeca': return `https://play.sooplive.co.kr/${channelId}/embed`;
                         default: console.warn(`[transformUrl] lolcast.kr URL 내 알 수 없는 플랫폼: ${platform}`); return url;
                     }
                 } else { console.warn(`[transformUrl] lolcast.kr URL 경로 구조 오류: ${hashPart}`); }
             }
         } catch (error) { console.error("[transformUrl] lolcast.kr URL 파싱 중 오류:", error, url); return url; }
         return url; // Return original on error or structure mismatch
     }

     // Handle platform/channelId shorthand
     const platformChannelPattern = /^(youtube|twitch|chzzk|kick|afreeca)\/([^\/]+)$/;
     const platformMatch = url.match(platformChannelPattern);
     if (platformMatch) {
         const platform = platformMatch[1];
         const channelId = platformMatch[2];
         switch (platform) {
             case 'youtube': return `https://www.youtube.com/embed/${channelId}`;
             case 'twitch': return `https://player.twitch.tv/?channel=${channelId}&parent=${window.location.hostname}&parent=lolcast.kr&autoplay=true&muted=true`;
             case 'chzzk': return chzzkIdPattern.test(channelId) ? `${chzzkProxyBaseUrl}${channelId}` : `https://chzzk.naver.com/live/${channelId}`;
             case 'kick': return `https://player.kick.com/${channelId}`;
             case 'afreeca': return `https://play.sooplive.co.kr/${channelId}/embed`;
             default: return url;
         }
     }

     // Handle specific URLs
     if (url.startsWith('https://www.youtube.com/watch?v=') || url.startsWith('https://youtu.be/')) {
         const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
         if (youtubeMatch && youtubeMatch[1]) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
     }
     if (url.startsWith('https://www.youtube.com/embed/')) return url; // Already embed
     if (url.includes('youtube.com/channel/') || url.includes('youtube.com/@')) return url; // Channel URL, maybe show info page?

     if (url.startsWith('https://twitch.tv/') || url.startsWith('https://www.twitch.tv/')) {
         const channelId = url.split('/').filter(Boolean).pop();
         if (channelId) return `https://player.twitch.tv/?channel=${channelId}&parent=${window.location.hostname}&parent=lolcast.kr&autoplay=true&muted=true`;
     }
     if (url.startsWith('https://player.twitch.tv/')) return url; // Already player

     if (url.startsWith('https://chzzk.naver.com/live/')) {
         const pathParts = url.split('/');
         const liveIndex = pathParts.indexOf('live');
         if (liveIndex !== -1 && pathParts.length > liveIndex + 1) {
             const channelId = pathParts[liveIndex + 1].split('?')[0];
             return chzzkIdPattern.test(channelId) ? `${chzzkProxyBaseUrl}${channelId}` : url; // Return proxy if ID, else original live page
         }
     }
     if (url.startsWith('https://chzzk.naver.com/')) { // General chzzk links
         const pathParts = url.split('/');
         const potentialId = pathParts.pop() || pathParts.pop();
         if (potentialId && chzzkIdPattern.test(potentialId)) {
             return `${chzzkProxyBaseUrl}${potentialId}`;
         }
         // If not an ID, maybe it's a channel page? Return original or try live page.
         // return url; // Keep original
     }

     if (url.startsWith('https://kick.com/')) {
         const channelId = url.split('/').filter(Boolean).pop();
         if (channelId) return `https://player.kick.com/${channelId}`;
     }
     if (url.startsWith('https://player.kick.com/')) return url;

     if (url.startsWith('https://play.sooplive.co.kr/')) {
         const pathParts = url.split('/');
         if (pathParts.length >= 4 && pathParts[3]) {
             const channelId = pathParts[3].split('/')[0];
             return `https://play.sooplive.co.kr/${channelId}/embed`; // Ensure embed format
         }
         return url; // Return original if structure is unexpected
     }
     if (url.startsWith('http://bj.afreecatv.com/')) { // Handle old Afreeca links
        const channelId = url.split('/').filter(Boolean).pop();
        if(channelId) return `https://play.sooplive.co.kr/${channelId}/embed`;
     }


     // Basic URL validation (already done better above, but keep as fallback)
     if (!url.startsWith('http://') && !url.startsWith('https://')) {
         console.warn(`[transformUrl] 유효하지 않은 URL 스키마 또는 형식: ${url}`);
         return null;
     }

     console.log(`[transformUrl] 처리 규칙 없음, 원본 반환: ${url}`);
     return url; // Return original URL if no specific rule matched
 }

// --- Play Custom URL (No change needed, relies on transformUrl and loadPlayer) ---
function playCustomUrl() {
    const customUrlInput = document.getElementById('custom-url-input');
    if (!customUrlInput) return;
    const userInput = customUrlInput.value.trim();
    if (userInput) {
        const finalUrl = transformUrl(userInput); // Transform first
        let type = 'iframe'; // Default

        if (finalUrl) {
            // Determine type based on the *transformed* URL
            if (finalUrl.includes(chzzkProxyBaseUrl) || finalUrl.endsWith('.m3u8')) {
                type = 'm3u8';
            }

            const playerBoxes = playerContainer?.querySelectorAll('.player-box');
            if (playerBoxes && playerBoxes.length > 0) {
                const targetBox = playerBoxes[clickIndex % playerBoxes.length];
                loadPlayer(targetBox, finalUrl, type); // Load with transformed URL and determined type
                clickIndex++;
                customUrlInput.value = '';
            }
        } else {
            alert('유효하지 않거나 지원하지 않는 형식의 URL 또는 ID입니다.');
        }
    }
}


// --- Render Channel Lists (Adapt slightly for mobile interaction) ---
function renderChannelList(container, channels, defaultClassName, options = {}) {
    if (!container) return;
    const { tooltipKey = 'tooltip', urlKey = 'url', idKey = 'id', nameKey = 'name' } = options;

    channels.forEach(channel => {
        const btn = document.createElement('button');
        const baseClasses = 'button is-small';
        const customClasses = channel.className || defaultClassName || '';
        btn.className = `${baseClasses} ${customClasses}`.trim().replace(/\s+/g, ' ');

        // btn.draggable = true; // Drag and drop might be less useful on mobile, keep?
        btn.textContent = channel[nameKey];

        let urlToTransform = '';
        if (idKey && channel[idKey]) { urlToTransform = channel[idKey]; } // Pass ID to transformUrl
        else if (urlKey && channel[urlKey]) { urlToTransform = channel[urlKey]; }
        else if (channel.url) { urlToTransform = channel.url; }

        const finalUrl = transformUrl(urlToTransform); // Transform to get final URL
        let finalType = 'iframe'; // Determine type based on final URL

        if (finalUrl) {
             if (finalUrl.includes(chzzkProxyBaseUrl) || finalUrl.endsWith('.m3u8')) {
                finalType = 'm3u8';
            }
            btn.dataset.url = finalUrl; // Store the final URL
            btn.dataset.type = finalType;
            if (channel[tooltipKey]) btn.title = channel[tooltipKey]; // Tooltips less useful on mobile tap
        } else {
            btn.dataset.url = ''; btn.dataset.type = 'iframe';
            btn.classList.add('is-disabled'); btn.title = "URL 정보 없음";
            // btn.draggable = false;
        }

        // Removed dragstart listener
        // btn.addEventListener('dragstart', ...);

        btn.addEventListener('click', () => {
            if (btn.dataset.url && btn.dataset.type) {
                const boxes = playerContainer?.querySelectorAll('.player-box');
                if (boxes && boxes.length > 0) {
                    const targetBox = boxes[clickIndex % boxes.length];
                    loadPlayer(targetBox, btn.dataset.url, btn.dataset.type);
                    clickIndex++;
                    toggleSidebar(); // Close sidebar after selection on mobile
                }
            }
        });
        container.appendChild(btn);
    });
}

// --- Render Specific Channel Sections (No changes needed) ---
async function renderLckChannels() { /* ... No changes needed ... */
    try {
        const youtubeUrl = getYouTubeLiveOrUpcoming();
        const kButton = lckChannels.find(ch => ch.name === 'K');
        if (kButton) { kButton.url = youtubeUrl || ''; kButton.type = 'iframe'; } // Type might be overridden by transformUrl later

        if (lckChannelList) {
            lckChannelList.innerHTML = ''; // Clear before render
            renderChannelList(lckChannelList, lckChannels, 'lck-channel-btn', { tooltipKey: 'tooltip', nameKey: 'name', urlKey: 'url' });
             lckChannelList.classList.add('buttons', 'are-small', 'is-flex-wrap-wrap');
        }
    } catch (error) { console.error('LCK 채널 렌더링 오류:', error); }
}
function renderSidebarFavorites() { /* ... No changes needed ... */
    if (!favoriteChannelList) return;
    favoriteChannelList.innerHTML = '';

    renderChannelList(favoriteChannelList, streamerChannels, '', { nameKey: 'name', idKey: 'id' });
    const userFavoritesWithClass = favorites.map(fav => ({
        ...fav, className: 'favorite-btn-channel channel-button is-outlined'
    }));
    renderChannelList(favoriteChannelList, userFavoritesWithClass, '', { nameKey: 'name', urlKey: 'url' });
    favoriteChannelList.classList.add('buttons', 'are-small', 'is-flex-wrap-wrap');
}
function renderSportsChannels() { /* ... No changes needed ... */
    if (!sportsChannelList) return;
    sportsChannelList.innerHTML = '';
    renderChannelList(sportsChannelList, sportsChannels, '', { nameKey: 'name', urlKey: 'url' });
    sportsChannelList.classList.add('buttons', 'are-small', 'is-flex-wrap-wrap');
}

// --- Favorites Modal Logic (Keep as is) ---
function renderFavorites() { /* ... No changes needed ... */
     if (!favoriteList) return;
    favoriteList.innerHTML = '';

    favorites.forEach((favorite, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'level is-mobile mb-1';
        const levelLeft = document.createElement('div'); levelLeft.className = 'level-left';
        const levelItemText = document.createElement('div'); levelItemText.className = 'level-item'; levelItemText.style.wordBreak = 'break-all';
        const span = document.createElement('span'); span.className = 'is-size-7'; span.textContent = `${favorite.name}: ${favorite.url}`;
        levelItemText.appendChild(span); levelLeft.appendChild(levelItemText);
        const levelRight = document.createElement('div'); levelRight.className = 'level-right';
        const levelItemButton = document.createElement('div'); levelItemButton.className = 'level-item';
        const deleteBtn = document.createElement('button'); deleteBtn.className = 'button is-danger is-small is-delete'; deleteBtn.textContent = '삭제'; deleteBtn.dataset.index = index;
        levelItemButton.appendChild(deleteBtn); levelRight.appendChild(levelItemButton);
        itemDiv.appendChild(levelLeft); itemDiv.appendChild(levelRight);
        favoriteList.appendChild(itemDiv);
    });
}
function addFavorite() { /* ... No changes needed ... */
    const nameInput = document.getElementById('favorite-name-input');
    const urlInput = document.getElementById('favorite-url-input');
    if (!nameInput || !urlInput) return;
    const name = nameInput.value.trim();
    const urlOrId = urlInput.value.trim();
    if (name && urlOrId) {
        if (favorites.some(fav => fav.name === name || fav.url === urlOrId)) { alert('이미 같은 이름 또는 URL/ID의 즐겨찾기가 존재합니다.'); return; }
        favorites.push({ name: name, url: urlOrId });
        localStorage.setItem('favorites', JSON.stringify(favorites));
        renderFavorites();
        renderSidebarFavorites();
        nameInput.value = ''; urlInput.value = '';
        closeModal();
    } else { alert('이름과 URL 또는 채널 ID를 모두 입력해주세요.'); }
}
function openModal() { /* ... No changes needed ... */
    if (favoriteModal) { renderFavorites(); favoriteModal.classList.add('is-active'); }
    else { console.error("즐겨찾기 모달 요소를 찾을 수 없습니다."); }
}
function closeModal() { /* ... No changes needed ... */
    if (favoriteModal) { favoriteModal.classList.remove('is-active'); }
}


// --- Sidebar Toggle (Modified for Overlay) ---
function toggleSidebar() {
    if (sidebar) {
        sidebar.classList.toggle('is-visible'); // Toggle the visibility class
        // No need to call adjustPlayerLayout here anymore
    }
}

// --- Split Screen Setup (Modified for Max 2 Vertical) ---
function setSplitScreen(count) {
    // Force count to be 1 or 2
    playerCount = Math.max(1, Math.min(2, count));
    console.log(`[setSplitScreen] Setting playerCount to: ${playerCount}`);
    clickIndex = 0;

    if(!playerContainer) return;

    // Clear player container (keep sidebar toggle outside)
    playerContainer.innerHTML = '';

    // Create 1 or 2 player boxes
    for (let i = 0; i < playerCount; i++) {
        const box = document.createElement('div');
        box.className = 'player-box has-background-dark'; // Use dark background
        box.id = `p-${i}`;
        // Removed drag/drop listeners
        // box.addEventListener('dragover', ...);
        // box.addEventListener('drop', ...);
        playerContainer.appendChild(box);
    }

    // Adjust layout based on the new playerCount
    adjustPlayerLayout();
}

// --- Adjust Player Layout (Modified for Vertical Split) ---
function adjustPlayerLayout() {
    if (!playerContainer) return;

    // Removed sidebar width logic

    // --- Grid columns/rows for vertical split ---
    let columns = 1;
    let rows = playerCount === 2 ? 2 : 1; // 1 row for 1 player, 2 rows for 2 players

    playerContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    playerContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    console.log(`[adjustPlayerLayout] playerCount: ${playerCount}, Set grid: ${columns}x${rows}`);

    // --- Reset individual box styles (less critical now but good practice) ---
    const boxes = playerContainer.querySelectorAll('.player-box');
    boxes.forEach(box => {
        box.style.gridColumn = '';
        box.style.gridRow = '';
    });

    // Removed 3-split specific layout
    // Removed updateModeStyles call
}


// --- Load Player (MODIFIED for new HLS player, removed extension logic) ---
function loadPlayer(box, url, type) {
    // Clear previous content
    while (box.firstChild) box.removeChild(box.firstChild);

    // Handle null/empty URL
    if (!url) {
        box.innerHTML='<div class="has-text-grey is-size-6 p-2">URL 없음</div>'; // Added padding
        box.className='player-box has-background-dark is-flex is-align-items-center is-justify-content-center'; // Center text
        return;
    }

    const iframe = document.createElement('iframe');
    iframe.setAttribute('allow','autoplay; fullscreen; encrypted-media; picture-in-picture');
    iframe.setAttribute('allowfullscreen','');
    iframe.style.border = 'none'; // Ensure no border

    // Determine if it's an HLS stream (m3u8)
    // Use the 'type' determined earlier or check the URL ending
    const isHls = (type === 'm3u8') || url.endsWith('.m3u8');

    if (isHls) {
        // *** Use the new LiveReacting HLS Player Embed ***
        const playerUrl = `${HLS_PLAYER_EMBED_BASE_URL}${encodeURIComponent(url)}`;
        iframe.src = playerUrl;
        console.log(`[loadPlayer] Loading HLS: ${playerUrl}`);
        iframe.onerror = (e) => {
            console.error(`HLS Player Load Error: ${playerUrl}`, e);
            box.innerHTML=`<div class="has-text-danger p-2">HLS 로드 실패<br><small>${url}</small></div>`;
            box.className='player-box has-background-dark is-flex is-align-items-center is-justify-content-center';
        };
    } else {
        // For non-HLS (YouTube, Twitch embed, etc.), use the URL directly
        // transformUrl should have already prepared it
        iframe.src = url;
        console.log(`[loadPlayer] Loading IFrame: ${url}`);
        iframe.onerror = (e) => {
            console.error(`IFrame Load Error: ${url}`, e);
            box.innerHTML=`<div class="has-text-danger p-2">로드 실패<br><small>${url}</small></div>`;
            box.className='player-box has-background-dark is-flex is-align-items-center is-justify-content-center';
        };
    }

    box.appendChild(iframe);
    box.className = 'player-box'; // Reset class to remove background/text alignment on success
}


// --- Drag/Drop Handler (Removed - less useful on mobile) ---
// function createDropHandler(box) { ... }


// --- Toggle Sports Section (Keep as is) ---
function toggleSports(headerElement) {
    if (sportsChannelList && headerElement) {
        const isActive = sportsChannelList.classList.toggle('active');
        headerElement.classList.toggle('collapsed', !isActive);
    }
}

// --- Fetch Data from Sheet (Keep if needed for schedule/youtube) ---
async function fetchDataFromSheet() {
    // Only fetch if the URL is set and seems valid
    const targetUrl = GOOGLE_APPS_SCRIPT_URL;
    if (!targetUrl || targetUrl.includes('YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL')) {
        console.warn("Google Apps Script URL not configured. Skipping data fetch.");
        youtubeUrlsFromSheet = {};
        lckScheduleData = [];
        return;
    }
    try {
        console.log("Fetching data from Google Sheet...");
        const response = await fetch(targetUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Data received:", data);
        youtubeUrlsFromSheet = data.youtubeUrls || {};
        lckScheduleData = data.lckSchedule || [];
    } catch (error) {
        console.error('Error fetching data from Google Sheet:', error);
        youtubeUrlsFromSheet = {}; // Reset on error
        lckScheduleData = [];     // Reset on error
        // Optionally display an error to the user in the schedule area
        if (lckScheduleContainer) {
             lckScheduleContainer.innerHTML = '<p class="has-text-danger has-text-centered py-2">데이터 로드 실패</p>';
        }
    }
}

// --- Render LCK Schedule (Keep as is, uses Bulma classes) ---
function renderLckSchedule() { /* ... No significant changes needed ... */
    if (!lckScheduleContainer) return;
    console.log("[renderLckSchedule] 시작, 데이터:", lckScheduleData);

    const logoBasePath = '/img/'; // Make sure this path is correct relative to your server setup
    const logoExtension = '.png';
    const defaultLogoPath = '/img/default.png';

    if (!Array.isArray(lckScheduleData) || lckScheduleData.length === 0) {
        lckScheduleContainer.innerHTML = '<p class="has-text-grey has-text-centered py-2">오늘 경기 정보 없음</p>';
        return;
    }

    lckScheduleContainer.innerHTML = ''; // Clear before render

    lckScheduleData.forEach(match => {
        if (!match || !match.team1 || !match.team2) return;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'is-flex is-align-items-center is-justify-content-center py-1 schedule-item';

        const team1Span = document.createElement('span'); team1Span.className = 'team-display is-flex is-align-items-center';
        const team1LogoFig = document.createElement('figure'); team1LogoFig.className = 'image is-24x24 mr-1';
        const team1Logo = document.createElement('img'); team1Logo.src = `${logoBasePath}${match.team1}${logoExtension}`; team1Logo.alt = `${match.team1} 로고`; team1Logo.onerror = function() { this.src = defaultLogoPath; this.onerror = null; };
        team1LogoFig.appendChild(team1Logo); const team1Name = document.createTextNode(` ${match.team1}`);
        team1Span.appendChild(team1LogoFig); team1Span.appendChild(team1Name);

        const vsSpan = document.createElement('span'); vsSpan.textContent = ' vs '; vsSpan.className = 'vs-separator mx-1 is-size-7 has-text-grey';

        const team2Span = document.createElement('span'); team2Span.className = 'team-display is-flex is-align-items-center';
        const team2LogoFig = document.createElement('figure'); team2LogoFig.className = 'image is-24x24 ml-1';
        const team2Logo = document.createElement('img'); team2Logo.src = `${logoBasePath}${match.team2}${logoExtension}`; team2Logo.alt = `${match.team2} 로고`; team2Logo.onerror = function() { this.src = defaultLogoPath; this.onerror = null; };
        team2LogoFig.appendChild(team2Logo); const team2Name = document.createTextNode(`${match.team2} `);
        team2Span.appendChild(team2Name); team2Span.appendChild(team2LogoFig);

        itemDiv.appendChild(team1Span); itemDiv.appendChild(vsSpan); itemDiv.appendChild(team2Span);
        lckScheduleContainer.appendChild(itemDiv);
    });

    console.log("[renderLckSchedule] 완료");
}

// --- Refresh Players (Simplified, re-calls loadPlayer) ---
function refreshAllPlayers() {
    const activePlayerIframes = playerContainer?.querySelectorAll('.player-box iframe') || [];
    console.log(`[refreshAllPlayers] Found ${activePlayerIframes.length} iframes to refresh.`);
    activePlayerIframes.forEach(iframe => {
        if (iframe && iframe.src) {
            const currentSrc = iframe.getAttribute('src');
            const parentBox = iframe.closest('.player-box');
            if (!parentBox) return;

            console.log(`[refreshAllPlayers] Refreshing box ${parentBox.id} with src: ${currentSrc}`);

            // Determine original URL and type to re-load
            let originalUrl = currentSrc;
            let type = 'iframe'; // Default assumption

            if (currentSrc.startsWith(HLS_PLAYER_EMBED_BASE_URL)) {
                // Extract URL from LiveReacting embed
                try {
                    const urlParams = new URLSearchParams(currentSrc.split('?')[1]);
                    originalUrl = urlParams.get('url');
                    type = 'm3u8';
                    console.log(`[refreshAllPlayers] Extracted HLS URL: ${originalUrl}`);
                } catch (e) {
                    console.error("[refreshAllPlayers] Error parsing HLS player URL", e);
                    // Fallback to trying the full src as iframe
                    originalUrl = currentSrc;
                    type = 'iframe';
                }
            }
            // No specific check needed for other types, assume iframe if not HLS embed

            if (originalUrl) {
                 // Re-call loadPlayer with the deduced original URL and type
                loadPlayer(parentBox, originalUrl, type);
            } else {
                console.warn("[refreshAllPlayers] Could not determine original URL for refresh.");
                // Optionally clear the box or show an error
                parentBox.innerHTML = '<div class="has-text-warning p-2">새로고침 오류</div>';
                parentBox.className='player-box has-background-dark is-flex is-align-items-center is-justify-content-center';
            }
        }
    });
}


// --- Initialization (Updated) ---
async function initialize() {
     console.log("[initialize] Mobile version starting...");
     cacheDOMElements();

     // --- Modal Event Listeners (Keep as is) ---
     const modalBackground = favoriteModal?.querySelector('.modal-background');
     if (modalBackground) modalBackground.addEventListener('click', closeModal);
     const closeButton = favoriteModal?.querySelector('.delete');
     if (closeButton) closeButton.addEventListener('click', closeModal);
     const cancelButtons = favoriteModal?.querySelectorAll('.modal-card-foot .button:not(.is-success)');
     cancelButtons?.forEach(btn => btn.addEventListener('click', closeModal));

     // --- Favorite Deletion Event Listener (Keep as is) ---
     if (favoriteList) {
         favoriteList.addEventListener('click', (event) => {
             if (event.target.classList.contains('is-delete')) {
                 const index = parseInt(event.target.dataset.index, 10);
                 if (!isNaN(index) && index >= 0 && index < favorites.length) {
                     favorites.splice(index, 1);
                     localStorage.setItem('favorites', JSON.stringify(favorites));
                     renderFavorites();
                     renderSidebarFavorites();
                 } else { console.error("Invalid index for favorite deletion:", event.target.dataset.index); }
             }
         });
     }
    if (toggleBtnElement) {
        toggleBtnElement.addEventListener('touchstart', (event) => {
            // 기본 브라우저 터치 동작(스크롤, 줌 등)을 막을 필요가 있을 수 있음
            // event.preventDefault(); // <<< 필요에 따라 주석 해제

            console.log("Toggle button touched!"); // 로그 추가
            toggleSidebar(); // 사이드바 토글 함수 호출
        }, { passive: true }); // 스크롤 성능 저하 방지를 위해 passive: true 권장 (preventDefault 사용 안 할 경우)
        // 만약 preventDefault를 사용해야 한다면 { passive: false } 로 설정하거나 이 옵션을 제거해야 합니다.

        console.log("Touchstart event listener added to toggle button.");
    } else {
        console.error("Toggle button element not found for adding listener.");
    }
     // Removed Firefox check and updateModeStyles call

    await fetchDataFromSheet();
    setSplitScreen(1);
    renderSidebarFavorites();
    renderSportsChannels();
    await renderLckChannels();
    renderLckSchedule();

    console.log("[initialize] Mobile version ready.");
}

// Page load execution
window.onload = initialize;
