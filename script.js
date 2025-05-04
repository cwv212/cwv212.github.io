// --- 환경 설정 및 상수 ---
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyfH8NgvggsTWd9-GNpajUFQrBf0GF4sqHyMl9VUljqRmOYdO-NaWlrBMM-ZEDIYvDg1w/exec'; // 실제 URL 확인
const CHROME_EXTENSION_ID = 'eakdijdofmnclopcffkkgmndadhbjgka';
const FIREFOX_EXTENSION_ID = 'ace413ec-8009-4e7c-841a-d0b581794b61';
const baseballBaseUrl = 'https://global-media.sooplive.com/live/soopbaseball';
const chzzkProxyBaseUrl = 'https://chzzk-api-proxy.hibiya.workers.dev/m3u8-redirect/';

// --- 상태 변수 ---
let isFirefoxMode = false;
let extensionId = CHROME_EXTENSION_ID;
let youtubeUrlsFromSheet = {};
let lckScheduleData = [];
let playerCount = 1;
let clickIndex = 0;
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let isMobileLayout = false; // 모바일 레이아웃 여부 플래그

// --- DOM 요소 캐싱 변수 ---
// 데스크톱 요소
let lckChannelList, favoriteChannelList, sportsChannelList,
    playerContainer, sidebar, favoriteModal, favoriteList, modeToggleBtn, firefoxNotice, chromeNotice,
    lckScheduleContainer, toggleBtnElement;
// 모바일 요소
let videoArea, chatArea, chatIframe, bottomNav, controlsModal; // chatPlaceholder 제거

// --- 채널 데이터 정의 (is-outlined 클래스 포함) ---
const baseballChannelsData = Array.from({ length: 5 }, (_, i) => ({ name: `야${i + 1}`, url: `${baseballBaseUrl}${i + 1}/master.m3u8`, type: 'm3u8', className: 'baseball-btn channel-button is-outlined' }));
const spotvChannelsData = Array.from({ length: 40 }, (_, i) => { const cn = String(i + 1).padStart(2, '0'); return { name: `${i + 1}`, url: `https://ch${cn}-nlivecdn.spotvnow.co.kr/ch${cn}/decr/medialist_14173921312004482655_hls.m3u8`, type: 'm3u8', className: 'spotv-btn channel-button is-outlined' }; });
const sportsChannels = [...baseballChannelsData, ...spotvChannelsData];
const lckChannels = [ { name: 'L', url: 'https://global-media.sooplive.com/live/lckkr/master.m3u8', type: 'm3u8', tooltip: 'soop', className: 'lck-channel-btn is-outlined' }, { name: 'C', url: `${chzzkProxyBaseUrl}9381e7d6816e6d915a44a13c0195b202`, type: 'm3u8', tooltip: 'chzzk', className: 'lck-channel-btn is-outlined' }, { name: 'K', url: '', type: 'iframe', tooltip: 'youtube', className: 'lck-channel-btn is-outlined' } ];
const streamerChannels = [ { name: '풍', id: '7ce8032370ac5121dcabce7bad375ced', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' }, { name: '침', id: 'bb382c2c0cc9fa7c86ab3b037fb5799c', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' }, { name: '추', id: '181a3baebe508d3b5fa5d9fe4d6b5241', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' }, { name: '솝', id: '34a2bd4f5988e37693e94306f0bfe57f', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' }, { name: '센', id: 'be243c7cbfb8d4e28777eedc43e28181', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' } ];

// --- DOM 요소 캐싱 함수 (모바일 요소 추가) ---
function cacheDOMElements() {
    // 데스크톱 요소
    lckChannelList = document.getElementById('lck-channels');
    favoriteChannelList = document.getElementById('favorite-channels');
    sportsChannelList = document.getElementById('sports-channels');
    playerContainer = document.getElementById('player-container');
    sidebar = document.getElementById('sidebar');
    favoriteModal = document.getElementById('favorite-modal');
    favoriteList = document.getElementById('favorite-list');
    modeToggleBtn = document.getElementById('mode-toggle-btn');
    firefoxNotice = document.getElementById('firefox-notice');
    chromeNotice = document.getElementById('chrome-notice');
    lckScheduleContainer = document.getElementById('lck-schedule');
    toggleBtnElement = document.getElementById('toggle-btn');

    // 모바일 요소
    videoArea = document.getElementById('video-area');
    chatArea = document.getElementById('chat-area');
    chatIframe = document.getElementById('chat-iframe');
    // chatPlaceholder 제거
    bottomNav = document.getElementById('bottom-nav');
    controlsModal = document.getElementById('controls-modal');
}

// --- 현재 레이아웃 확인 함수 ---
function checkLayout() {
    isMobileLayout = document.body.classList.contains('is-mobile-layout');
    console.log(`[checkLayout] 모바일 레이아웃 활성화: ${isMobileLayout}`);
}

// --- 초기화 함수 (레이아웃 분기 처리) ---
async function initialize() {
     console.log("[initialize] 초기화 시작");
     cacheDOMElements();
     checkLayout();

     // --- 공통 이벤트 리스너 설정 ---
     // 기존 즐겨찾기 관리 모달 관련 이벤트 리스너
     const favModalBg = favoriteModal?.querySelector('.modal-background');
     if (favModalBg) favModalBg.addEventListener('click', closeModal);
     const favCloseBtn = favoriteModal?.querySelector('.delete');
     if (favCloseBtn) favCloseBtn.addEventListener('click', closeModal);
     const favCancelBtns = favoriteModal?.querySelectorAll('.modal-card-foot .button:not(.is-success)');
     favCancelBtns?.forEach(btn => btn.addEventListener('click', closeModal));
     if (favoriteList) {
         favoriteList.addEventListener('click', (event) => {
             if (event.target.classList.contains('is-delete')) {
                 const index = parseInt(event.target.dataset.index, 10);
                 if (!isNaN(index) && index >= 0 && index < favorites.length) {
                     favorites.splice(index, 1);
                     localStorage.setItem('favorites', JSON.stringify(favorites));
                     renderFavorites();
                     if (isMobileLayout) {
                         renderControlsModalLists();
                     } else {
                         renderSidebarFavorites();
                     }
                 }
             }
         });
     }

      // 새로운 컨트롤 모달 관련 이벤트 리스너
     const ctrlModalBg = controlsModal?.querySelector('.modal-background');
     if (ctrlModalBg) ctrlModalBg.addEventListener('click', closeControlsModal);
     const ctrlCloseBtn = controlsModal?.querySelector('.delete');
     if (ctrlCloseBtn) ctrlCloseBtn.addEventListener('click', closeControlsModal);
     const ctrlCancelBtn = controlsModal?.querySelector('.modal-card-foot .button');
     if (ctrlCancelBtn) ctrlCancelBtn.addEventListener('click', closeControlsModal);

         // ★★★ F5 새로고침 버튼 이벤트 리스너 추가 (모바일 레이아웃일 때만?) ★★★
     if (isMobileLayout) { // 모바일 하단 네비에만 버튼이 있으므로 isMobileLayout 조건 추가 가능
         const refreshBtn = document.getElementById('refresh-btn');
         if (refreshBtn) {
             refreshBtn.addEventListener('click', () => {
                 const chatIframe = document.getElementById('chat-iframe');
                 if (chatIframe) {
                     console.log('[F5] 채팅 iframe 새로고침 시도');
                     // 기존 src 가져오기 (베이스 URL 재사용)
                     const currentSrc = chatIframe.src;
                     // URL에서 '?' 앞부분 (기본 URL)과 '#' 뒷부분 (해시) 분리 시도
                     const baseUrl = currentSrc.split('?')[0].split('#')[0]; // ?나 # 앞부분 추출
                     const hashPart = currentSrc.includes('#') ? '#' + currentSrc.split('#')[1] : ''; // # 있으면 추출

                     // 캐시 무효화를 위해 타임스탬프 추가, 기존 해시 유지
                     chatIframe.src = baseUrl + '?cache=' + Date.now() + hashPart;
                 } else {
                     console.warn('[F5] 채팅 iframe 요소를 찾을 수 없습니다.');
                 }
             });
         } else {
              console.warn('[initialize] F5 새로고침 버튼(refresh-btn) 요소를 찾을 수 없습니다.');
         }
     }
    
     // --- 공통 데이터 로드 ---
     if (navigator.userAgent.includes('Firefox')) {
         isFirefoxMode = true;
     }
     await fetchDataFromSheet();

     // --- 레이아웃에 따른 초기 설정 ---
     if (isMobileLayout) {
         // 모바일 레이아웃 초기 설정
         console.log("[initialize] 모바일 레이아웃 설정 중...");
         setSplitScreen(1);
         renderControlsModalLists();
         updateModeStylesModal();
         renderLckScheduleModal();
         // 채팅 관련 초기화 로직 제거 (HTML에서 src를 직접 설정)
         console.log("[initialize] 모바일 레이아웃 설정 완료");
     } else {
         // 데스크톱 레이아웃 초기 설정
         console.log("[initialize] 데스크톱 레이아웃 설정 중...");
         updateModeStyles();
         setSplitScreen(1);
         renderSidebarFavorites();
         renderSportsChannels();
         await renderLckChannels();
         renderLckSchedule();
         console.log("[initialize] 데스크톱 레이아웃 설정 완료");
     }

     console.log("[initialize] 초기화 완료");
}

// --- 화면 분할 설정 함수 (레이아웃 분기) ---
function setSplitScreen(count) {
    const targetContainer = isMobileLayout ? videoArea : playerContainer;
    const maxCount = isMobileLayout ? 2 : 4;

    if (!targetContainer) {
        console.error("[setSplitScreen] 대상 컨테이너를 찾을 수 없습니다!");
        return;
    }

    if (count < 1) count = 1;
    if (count > maxCount) count = maxCount;
    playerCount = count;
    clickIndex = 0;

    console.log(`[setSplitScreen] 레이아웃: ${isMobileLayout ? '모바일' : '데스크톱'}, 분할 수: ${playerCount}`);

    targetContainer.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const box = document.createElement('div');
        box.className = 'player-box';
        box.id = `p-${i}`;
        box.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
        box.addEventListener('drop', createDropHandler(box));
        targetContainer.appendChild(box);
    }

    adjustPlayerLayout();
}

// --- 플레이어 레이아웃 조정 함수 (레이아웃 분기) ---
function adjustPlayerLayout() {
    const targetContainer = isMobileLayout ? videoArea : playerContainer;
    if (!targetContainer) return;

    if (isMobileLayout) {
        // 모바일 레이아웃 조정 (videoArea 내부 Grid 설정)
        let columns = 1;
        if (playerCount === 2) {
            columns = 2;
        }
        targetContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        targetContainer.style.gridTemplateRows = '1fr';
        console.log(`[adjustPlayerLayout 모바일] Grid 설정: ${columns} 열 x 1 행`);
    } else {
        // 데스크톱 레이아웃 조정
        if (!sidebar) return;
        const isCollapsed = sidebar.classList.contains('is-collapsed');
        const sidebarWidth = isCollapsed ? 0 : 220;
        playerContainer.style.marginLeft = `${sidebarWidth}px`;
        playerContainer.style.width = `calc(100% - ${sidebarWidth}px)`;

        let columns = 1, rows = 1;
        if (playerCount === 2) { columns = 2; rows = 1; }
        else if (playerCount === 3) { columns = 2; rows = 2; }
        else if (playerCount === 4) { columns = 2; rows = 2; }

        playerContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        playerContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        console.log(`[adjustPlayerLayout 데스크톱] 분할 수: ${playerCount}, Grid 설정: ${columns} 열 x ${rows} 행`);

        const boxes = playerContainer.querySelectorAll('.player-box');
        boxes.forEach(box => { box.style.gridColumn = ''; box.style.gridRow = ''; });

        if (playerCount === 3 && boxes.length === 3) {
             console.log("[adjustPlayerLayout 데스크톱] 3분할 특수 레이아웃 적용");
             if (boxes[0]) { boxes[0].style.gridColumn = '1 / 2'; boxes[0].style.gridRow = '1 / 2'; }
             if (boxes[1]) { boxes[1].style.gridColumn = '2 / 3'; boxes[1].style.gridRow = '1 / 2'; }
             if (boxes[2]) { boxes[2].style.gridColumn = '1 / 3'; boxes[2].style.gridRow = '2 / 3'; }
        }
        updateModeStyles();
    }
}

// --- HLS 모드 UI 업데이트 함수 ---
// 데스크톱용
function updateModeStyles() {
    if (!sidebar || !toggleBtnElement) { return; }
    const isCollapsed = sidebar.classList.contains('is-collapsed');
    const targetSidebarWidth = isCollapsed ? 0 : 220;
    const modeButtonStyle = isFirefoxMode ? 'is-success' : 'is-link';

    if (modeToggleBtn) {
        modeToggleBtn.textContent = isFirefoxMode ? '크롬 모드로 전환' : '파폭 모드로 전환';
        modeToggleBtn.className = `button is-fullwidth mt-auto ${modeButtonStyle}`;
    }
    if (firefoxNotice) firefoxNotice.style.display = isFirefoxMode ? 'block' : 'none';
    if (chromeNotice) chromeNotice.style.display = isFirefoxMode ? 'none' : 'block';

    toggleBtnElement.className = `button is-small is-rounded ${modeButtonStyle}`;
    const toggleBtnLeft = targetSidebarWidth + 5;
    toggleBtnElement.style.left = `${toggleBtnLeft}px`;

    extensionId = isFirefoxMode ? FIREFOX_EXTENSION_ID : CHROME_EXTENSION_ID;
}

// 모바일용
function updateModeStylesModal() {
     const modalBtn = document.getElementById('mode-toggle-btn-modal');
     const ffNoticeModal = document.getElementById('firefox-notice-modal');
     const chNoticeModal = document.getElementById('chrome-notice-modal');
     const modeButtonStyle = isFirefoxMode ? 'is-success' : 'is-link';

     if (modalBtn) {
         modalBtn.textContent = isFirefoxMode ? '크롬 모드로 전환' : '파폭 모드로 전환';
         modalBtn.className = `button is-fullwidth mt-4 ${modeButtonStyle}`;
     }
     if (ffNoticeModal) ffNoticeModal.style.display = isFirefoxMode ? 'block' : 'none';
     if (chNoticeModal) chNoticeModal.style.display = isFirefoxMode ? 'none' : 'block';

     extensionId = isFirefoxMode ? FIREFOX_EXTENSION_ID : CHROME_EXTENSION_ID;
}

// HLS 모드 토글 함수
function toggleMode() {
    isFirefoxMode = !isFirefoxMode;
    if (isMobileLayout) {
        updateModeStylesModal();
    } else {
        updateModeStyles();
    }
    refreshAllPlayers();
}

// --- 모바일 컨트롤 모달 관련 함수 ---
function openControlsModal() {
    if (controlsModal) {
        renderControlsModalLists();
        renderLckScheduleModal();
        updateModeStylesModal();
        controlsModal.classList.add('is-active');
    }
}

function closeControlsModal() {
    if (controlsModal) controlsModal.classList.remove('is-active');
}

function openFavoritesManagerModal() {
    closeControlsModal();
    openModal(); // 기존 즐겨찾기 관리 모달 열기
}

function toggleSection(headerElement, sectionId) {
    const section = document.getElementById(sectionId);
    if (section && headerElement) {
        const isActive = section.style.display === 'block';
        section.style.display = isActive ? 'none' : 'block';
        headerElement.classList.toggle('collapsed', !isActive);
    }
}

function renderControlsModalLists() {
    const favContainer = document.getElementById('favorite-channels-modal');
    const sportsContainer = document.getElementById('sports-channels-modal');

    if (favContainer) {
        favContainer.innerHTML = '';
        const streamerChannelsModal = streamerChannels.map(ch => ({...ch, className: 'channel-button is-outlined' }));
        renderChannelList(favContainer, streamerChannelsModal, '', { nameKey: 'name', idKey: 'id' });
        const userFavoritesModal = favorites.map(fav => ({ ...fav, className: 'favorite-btn-channel channel-button is-outlined' }));
        renderChannelList(favContainer, userFavoritesModal, '', { nameKey: 'name', urlKey: 'url' });
        favContainer.classList.add('buttons', 'are-small', 'is-flex-wrap-wrap');
    }

    if (sportsContainer) {
        sportsContainer.innerHTML = '';
        const sportsChannelsModal = sportsChannels.map(ch => ({...ch, className: `${ch.className || ''} is-outlined`.trim()}));
        renderChannelList(sportsContainer, sportsChannelsModal, '', { nameKey: 'name', urlKey: 'url' });
        sportsContainer.classList.add('buttons', 'are-small', 'is-flex-wrap-wrap');
    }
}

function playCustomUrlModal() {
    const customUrlInput = document.getElementById('custom-url-input-modal');
    if (!customUrlInput) return;
    const userInput = customUrlInput.value.trim();

    if (userInput) {
        let finalUrl = null;
        let type = 'iframe';
        const chzzkIdPattern = /^[0-9a-fA-F]{32}$/;

        if (chzzkIdPattern.test(userInput)) {
            finalUrl = `${chzzkProxyBaseUrl}${userInput}`;
            type = 'm3u8';
        } else {
            finalUrl = transformUrl(userInput);
            if (finalUrl) {
                if (finalUrl.includes(chzzkProxyBaseUrl) || finalUrl.endsWith('.m3u8')) {
                    type = 'm3u8';
                }
            }
        }

        if (finalUrl) {
            const targetContainer = isMobileLayout ? videoArea : playerContainer;
            const playerBoxes = targetContainer?.querySelectorAll('.player-box');

            if (playerBoxes && playerBoxes.length > 0) {
                const targetBox = playerBoxes[clickIndex % playerBoxes.length];
                loadPlayer(targetBox, finalUrl, type);
                clickIndex++;
                customUrlInput.value = '';
                closeControlsModal();
                // 채팅 로드 호출 제거
            }
        } else {
            alert('유효하지 않거나 지원하지 않는 형식의 URL 또는 ID입니다.');
        }
    }
}

// --- 채널 목록 렌더링 함수 (모바일 로직 포함, 채팅 로드 제거) ---
function renderChannelList(container, channels, defaultClassName, options = {}) {
    if (!container) return;
    const { tooltipKey = 'tooltip', urlKey = 'url', idKey = 'id', nameKey = 'name' } = options;

    channels.forEach(channel => {
        const btn = document.createElement('button');
        const baseClasses = 'button is-small';
        const customClasses = channel.className || defaultClassName || '';
        btn.className = `${baseClasses} ${customClasses}`.trim().replace(/\s+/g, ' ');

        btn.draggable = true;
        btn.textContent = channel[nameKey];

        let urlToTransform = '';
        if (idKey && channel[idKey]) { urlToTransform = `${chzzkProxyBaseUrl}${channel[idKey]}`; }
        else if (urlKey && channel[urlKey]) { urlToTransform = channel[urlKey]; }
        else if (channel.url) { urlToTransform = channel.url; }

        const finalUrl = transformUrl(urlToTransform) || urlToTransform;

        let finalType = 'iframe';
        const chzzkIdPattern = /^[0-9a-fA-F]{32}$/;
        if (finalUrl && (finalUrl.includes(chzzkProxyBaseUrl) || finalUrl.endsWith('.m3u8'))) {
             finalType = 'm3u8';
        } else if (finalUrl && chzzkIdPattern.test(finalUrl)) {
            finalType = 'm3u8';
        }

        if (finalUrl) {
            const urlToStore = chzzkIdPattern.test(finalUrl) ? `${chzzkProxyBaseUrl}${finalUrl}` : finalUrl;
            btn.dataset.url = urlToStore;
            btn.dataset.type = finalType;
            if (channel[tooltipKey]) btn.title = channel[tooltipKey];
        } else {
            btn.dataset.url = '';
            btn.dataset.type = 'iframe';
            btn.classList.add('is-disabled');
            btn.title = "URL 정보 없음";
            btn.draggable = false;
        }

        btn.addEventListener('dragstart', (e) => {
            if (btn.dataset.url && btn.dataset.type) {
                e.dataTransfer.setData('text/plain', btn.dataset.url);
                e.dataTransfer.setData('text/type', btn.dataset.type);
            } else {
                e.preventDefault();
            }
        });

        // 클릭 이벤트 리스너 (채팅 로드 제거)
        btn.addEventListener('click', () => {
            if (btn.dataset.url && btn.dataset.type) {
                const targetContainer = isMobileLayout ? videoArea : playerContainer;
                const boxes = targetContainer?.querySelectorAll('.player-box');

                if (boxes && boxes.length > 0) {
                    const targetBox = boxes[clickIndex % boxes.length];
                    loadPlayer(targetBox, btn.dataset.url, btn.dataset.type);
                    clickIndex++;

                    if (isMobileLayout) {
                        closeControlsModal(); // 모달만 닫기
                    }
                }
            }
        });

        container.appendChild(btn);
    });
}

// --- 하단 네비게이션 바에서 직접 채널 재생 함수 (채팅 로드 제거) ---
function playChannelFromNav(url, type) {
    if (!url) {
         console.warn("[playChannelFromNav] 재생할 URL이 없습니다.");
         const targetContainer = videoArea;
         const playerBoxes = targetContainer?.querySelectorAll('.player-box');
          if (playerBoxes && playerBoxes.length > 0) {
              loadPlayer(playerBoxes[0], null, 'iframe');
          }
        return;
    }

    const targetContainer = videoArea;
    const playerBoxes = targetContainer?.querySelectorAll('.player-box');

    if (playerBoxes && playerBoxes.length > 0) {
        const targetBox = playerBoxes[clickIndex % playerBoxes.length];
        loadPlayer(targetBox, url, type);
        clickIndex++;
        // 채팅 로드 호출 제거
    } else {
        console.error("[playChannelFromNav] videoArea에서 플레이어 박스를 찾을 수 없습니다.");
    }
}

// --- 컨트롤 모달 내 LCK 스케줄 렌더링 함수 ---
function renderLckScheduleModal() {
    const container = document.getElementById('lck-schedule-modal');
    if (!container) return;

    const logoBasePath = '/img/'; const logoExtension = '.png'; const defaultLogoPath = '/img/default.png';

    if (!Array.isArray(lckScheduleData) || lckScheduleData.length === 0) {
        container.innerHTML = '<p class="has-text-grey has-text-centered py-2 is-size-7">오늘 경기 정보 없음</p>';
        return;
    }

    container.innerHTML = '';
    lckScheduleData.forEach(match => {
        if (!match || !match.team1 || !match.team2) return;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'is-flex is-align-items-center is-justify-content-center py-1 schedule-item-modal';
        itemDiv.style.borderBottom = '1px dashed #444';
        itemDiv.style.fontSize = '0.8rem';

        const team1Span = document.createElement('span');
        team1Span.className = 'team-display is-flex is-align-items-center';
        const team1LogoFig = document.createElement('figure');
        team1LogoFig.className = 'image is-16x16 mr-1';
        const team1Logo = document.createElement('img');
        team1Logo.src = `${logoBasePath}${match.team1}${logoExtension}`;
        team1Logo.alt = `${match.team1} 로고`;
        team1Logo.onerror = function() { this.src = defaultLogoPath; this.onerror = null; };
        team1LogoFig.appendChild(team1Logo);
        const team1Name = document.createTextNode(` ${match.team1}`);
        team1Span.appendChild(team1LogoFig);
        team1Span.appendChild(team1Name);

        const vsSpan = document.createElement('span');
        vsSpan.textContent = ' vs ';
        vsSpan.className = 'vs-separator mx-1 is-size-7 has-text-grey-light';

        const team2Span = document.createElement('span');
        team2Span.className = 'team-display is-flex is-align-items-center';
        const team2Name = document.createTextNode(`${match.team2} `);
        const team2LogoFig = document.createElement('figure');
        team2LogoFig.className = 'image is-16x16 ml-1';
        const team2Logo = document.createElement('img');
        team2Logo.src = `${logoBasePath}${match.team2}${logoExtension}`;
        team2Logo.alt = `${match.team2} 로고`;
        team2Logo.onerror = function() { this.src = defaultLogoPath; this.onerror = null; };
        team2LogoFig.appendChild(team2Logo);
        team2Span.appendChild(team2Name);
        team2Span.appendChild(team2LogoFig);

        itemDiv.appendChild(team1Span);
        itemDiv.appendChild(vsSpan);
        itemDiv.appendChild(team2Span);
        container.appendChild(itemDiv);
    });

    const lastItem = container.querySelector('.schedule-item-modal:last-child');
    if(lastItem) lastItem.style.borderBottom = 'none';
}

// --- 모든 플레이어 새로고침 함수 (레이아웃 분기) ---
function refreshAllPlayers() {
    const targetContainer = isMobileLayout ? videoArea : playerContainer;
    const activeIframes = targetContainer?.querySelectorAll('.player-box iframe') || [];

    console.log(`[refreshAllPlayers] ${activeIframes.length}개의 플레이어 새로고침 시도...`);

    activeIframes.forEach(iframe => {
        if (iframe && iframe.src) {
            const currentSrc = iframe.getAttribute('src');
            const parentBox = iframe.closest('.player-box');
            if (!parentBox) return;

            if (currentSrc.includes('/player.html#')) {
                const originalUrlEncoded = currentSrc.split('#')[1];
                if (originalUrlEncoded) {
                    const originalUrl = decodeURIComponent(originalUrlEncoded);
                    console.log(`[refreshAllPlayers] HLS 플레이어 새로고침: ${originalUrl}`);
                    loadPlayer(parentBox, originalUrl, 'm3u8');
                }
            } else {
                console.log(`[refreshAllPlayers] 일반 iframe 플레이어 새로고침: ${currentSrc}`);
                loadPlayer(parentBox, currentSrc, 'iframe');
            }
        }
    });
}


// --- 즐겨찾기 추가 함수 (레이아웃 분기 추가) ---
function addFavorite() {
    const nameInput = document.getElementById('favorite-name-input');
    const urlInput = document.getElementById('favorite-url-input');
    if (!nameInput || !urlInput) return;

    const name = nameInput.value.trim();
    const urlOrId = urlInput.value.trim();

    if (name && urlOrId) {
        if (favorites.some(fav => fav.name === name || fav.url === urlOrId)) {
            alert('이미 같은 이름 또는 URL/ID의 즐겨찾기가 존재합니다.');
            return;
        }
        favorites.push({ name: name, url: urlOrId });
        localStorage.setItem('favorites', JSON.stringify(favorites));

        if (isMobileLayout) {
            renderControlsModalLists();
        } else {
            renderSidebarFavorites();
        }
        renderFavorites(); // 관리 모달 목록 업데이트

        nameInput.value = '';
        urlInput.value = '';
        closeModal(); // 관리 모달 닫기
    } else {
        alert('이름과 URL 또는 채널 ID를 모두 입력해주세요.');
    }
}

// --- 플레이어 로드 함수 ---
function loadPlayer(box, url, type) {
    while (box.firstChild) box.removeChild(box.firstChild);
    if (!url) { box.innerHTML='<div class="has-text-grey is-size-6 has-text-centered p-2">URL 없음</div>'; box.className='player-box'; return; }

    const iframe = document.createElement('iframe');
    iframe.setAttribute('allow','autoplay; fullscreen; encrypted-media; picture-in-picture');
    iframe.setAttribute('allowfullscreen','');
    iframe.style.border = 'none';

    let useExtension = (type === 'm3u8') || (typeof url === 'string' && url.endsWith('.m3u8'));
    if (!useExtension && typeof url === 'string' && url.includes(chzzkProxyBaseUrl)) {
        useExtension = true;
        type = 'm3u8';
    }

    console.log(`[loadPlayer] 로딩 시작 - URL: ${url}, 타입: ${type}, 확장 사용: ${useExtension}, 대상 박스: ${box.id}`);

    if (useExtension) {
        const currentExtensionId = isFirefoxMode ? FIREFOX_EXTENSION_ID : CHROME_EXTENSION_ID;
        const extensionPrefix = isFirefoxMode ? 'moz-extension://' : 'chrome-extension://';

        if (!currentExtensionId) {
            console.error(`[loadPlayer] HLS 플레이어 확장 프로그램 ID 오류! 현재 모드: ${isFirefoxMode ? 'Firefox' : 'Chrome'}`);
            box.innerHTML=`<div class="has-text-danger is-size-7 has-text-centered p-2">HLS 플레이어 ID 오류</div>`;
            box.className='player-box';
            return;
        }
        const playerUrl = `${extensionPrefix}${currentExtensionId}/player.html#${encodeURIComponent(url)}`;
        iframe.src = playerUrl;
        iframe.onerror = (e) => {
            console.error(`[loadPlayer] HLS 확장 프로그램 로드 오류: ${playerUrl}`, e);
            box.innerHTML=`<div class="has-text-danger is-size-7 has-text-centered p-2">HLS 플레이어 로드 실패<br><small>확장 프로그램 설치 및 활성화 확인</small></div>`;
            box.className='player-box';
        };
        console.log(`[loadPlayer] HLS 플레이어 로드: ${playerUrl}`);
    } else {
        const finalUrl = transformUrl(url) || url;
        iframe.src = finalUrl;
        iframe.onerror = (e) => {
            console.error(`[loadPlayer] Iframe 로드 오류: ${finalUrl}`, e);
            box.innerHTML=`<div class="has-text-danger is-size-7 has-text-centered p-2">플레이어 로드 실패<br><small>${url}</small></div>`;
            box.className='player-box';
        };
        console.log(`[loadPlayer] 일반 Iframe 로드: ${finalUrl}`);
    }

    box.appendChild(iframe);
}

// --- 데스크톱 전용 함수 보호 또는 수정 ---
function toggleSidebar() {
    if (!isMobileLayout && sidebar) {
        sidebar.classList.toggle('is-collapsed');
        adjustPlayerLayout();
    } else if (isMobileLayout) {
        console.warn("[toggleSidebar] 모바일 레이아웃에서는 사이드바 토글 기능이 없습니다.");
    } else {
        console.warn("[toggleSidebar] 사이드바 요소를 찾을 수 없습니다.");
    }
}

function renderSidebarFavorites() {
    if (isMobileLayout) return;
    if (!favoriteChannelList) return;
    favoriteChannelList.innerHTML = '';
    renderChannelList(favoriteChannelList, streamerChannels, '', { nameKey: 'name', idKey: 'id' });
    const userFavoritesWithClass = favorites.map(fav => ({ ...fav, className: 'favorite-btn-channel channel-button is-outlined' }));
    renderChannelList(favoriteChannelList, userFavoritesWithClass, '', { nameKey: 'name', urlKey: 'url' });
    favoriteChannelList.classList.add('buttons', 'are-small', 'is-flex-wrap-wrap');
}

function renderSportsChannels() {
    if (isMobileLayout) return;
    if (!sportsChannelList) return;
    sportsChannelList.innerHTML = '';
    renderChannelList(sportsChannelList, sportsChannels, '', { nameKey: 'name', urlKey: 'url' });
    sportsChannelList.classList.add('buttons', 'are-small', 'is-flex-wrap-wrap');
}

async function renderLckChannels() {
    if (isMobileLayout) return;
    try {
        const youtubeUrl = getYouTubeLiveOrUpcoming();
        const kButton = lckChannels.find(ch => ch.name === 'K');
        if (kButton) { kButton.url = youtubeUrl || ''; kButton.type = 'iframe'; }
        if (lckChannelList) {
            lckChannelList.innerHTML = '';
            renderChannelList(lckChannelList, lckChannels, '', { tooltipKey: 'tooltip', nameKey: 'name', urlKey: 'url' });
            lckChannelList.classList.add('buttons', 'are-small', 'is-flex-wrap-wrap');
        }
    } catch (error) { console.error('LCK 채널 렌더링 오류:', error); }
}

function renderLckSchedule() {
    if (isMobileLayout) return;
    if (!lckScheduleContainer) return;

    const logoBasePath = '/img/'; const logoExtension = '.png'; const defaultLogoPath = '/img/default.png';

    if (!Array.isArray(lckScheduleData) || lckScheduleData.length === 0) {
        lckScheduleContainer.innerHTML = '<p class="has-text-grey has-text-centered py-2">오늘 경기 정보 없음</p>'; return;
    }
    lckScheduleContainer.innerHTML = '';
    lckScheduleData.forEach(match => {
        if (!match || !match.team1 || !match.team2) return;
        const itemDiv = document.createElement('div'); itemDiv.className = 'is-flex is-align-items-center is-justify-content-center py-1 schedule-item';
        const team1Span = document.createElement('span'); team1Span.className = 'team-display is-flex is-align-items-center'; const team1LogoFig = document.createElement('figure'); team1LogoFig.className = 'image is-24x24 mr-1'; const team1Logo = document.createElement('img'); team1Logo.src = `${logoBasePath}${match.team1}${logoExtension}`; team1Logo.alt = `${match.team1} 로고`; team1Logo.onerror = function() { this.src = defaultLogoPath; this.onerror = null; }; team1LogoFig.appendChild(team1Logo); const team1Name = document.createTextNode(` ${match.team1}`); team1Span.appendChild(team1LogoFig); team1Span.appendChild(team1Name);
        const vsSpan = document.createElement('span'); vsSpan.textContent = ' vs '; vsSpan.className = 'vs-separator mx-1 is-size-7 has-text-grey';
        const team2Span = document.createElement('span'); team2Span.className = 'team-display is-flex is-align-items-center'; const team2LogoFig = document.createElement('figure'); team2LogoFig.className = 'image is-24x24 ml-1'; const team2Logo = document.createElement('img'); team2Logo.src = `${logoBasePath}${match.team2}${logoExtension}`; team2Logo.alt = `${match.team2} 로고`; team2Logo.onerror = function() { this.src = defaultLogoPath; this.onerror = null; }; team2LogoFig.appendChild(team2Logo); const team2Name = document.createTextNode(`${match.team2} `); team2Span.appendChild(team2Name); team2Span.appendChild(team2LogoFig);
        itemDiv.appendChild(team1Span); itemDiv.appendChild(vsSpan); itemDiv.appendChild(team2Span); lckScheduleContainer.appendChild(itemDiv);
    });
}

// --- 기타 기존 함수들 ---
// KST 날짜 가져오기
function getKstDate() {
    const date = new Date();
    const kstOffset = 9 * 60;
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const kstDate = new Date(utc + (kstOffset * 60000));
    return kstDate.toISOString().split('T')[0];
}

// YouTube 라이브/예정 URL 가져오기
function getYouTubeLiveOrUpcoming() {
    const today = getKstDate();
    if (youtubeUrlsFromSheet && youtubeUrlsFromSheet[today] && youtubeUrlsFromSheet[today].url) {
        return youtubeUrlsFromSheet[today].url;
    }
    return null;
}

// URL 변환 함수 (iframe src 또는 HLS URL 생성)
 function transformUrl(url) {
     if (!url) return null; // URL 없으면 null 반환
     if (typeof url !== 'string') url = String(url); // 문자열 아닐 경우 변환 시도

     // 1. .m3u8 로 끝나는 경우 원본 반환
     if (url.endsWith('.m3u8')) return url;

     // 2. 32자리 Hex ID (치지직 ID) 형식인 경우 프록시 URL 반환
     const chzzkIdPattern = /^[0-9a-fA-F]{32}$/;
     if (chzzkIdPattern.test(url)) return `${chzzkProxyBaseUrl}${url}`;

     // 3. lolcast.kr URL 파싱
     if (url.startsWith('https://lolcast.kr/#/player/')) {
         try {
             const hashPart = url.split('#')[1];
             if (hashPart) {
                 const pathSegments = hashPart.split('/').filter(segment => segment.length > 0);
                 if (pathSegments.length >= 3 && pathSegments[0] === 'player') {
                     const platform = pathSegments[1].toLowerCase();
                     const channelId = pathSegments[2];
                     console.log(`[transformUrl] lolcast.kr 파싱: 플랫폼=${platform}, 채널ID=${channelId}`);
                     switch (platform) {
                         case 'youtube': return `https://www.youtube.com/embed/${channelId}`;
                         case 'twitch': return `https://player.twitch.tv/?channel=${channelId}&parent=${window.location.hostname}&parent=lolcast.kr`;
                         case 'chzzk': return chzzkIdPattern.test(channelId) ? `${chzzkProxyBaseUrl}${channelId}` : `https://chzzk.naver.com/live/${channelId}`;
                         case 'kick': return `https://player.kick.com/${channelId}`;
                         case 'afreeca': return `https://play.sooplive.co.kr/${channelId}/embed`;
                         default: console.warn(`[transformUrl] lolcast.kr URL 내 알 수 없는 플랫폼: ${platform}`); return url; // 모르는 플랫폼은 원본 반환
                     }
                 } else { console.warn(`[transformUrl] lolcast.kr URL 경로 구조 오류: ${hashPart}`); }
             }
         } catch (error) { console.error("[transformUrl] lolcast.kr URL 파싱 중 오류:", error, url); return url; }
     }

     // 4. "플랫폼/채널ID" 형식 파싱
     const platformChannelPattern = /^(youtube|twitch|chzzk|kick|afreeca)\/([^\/]+)$/;
     const platformMatch = url.match(platformChannelPattern);
     if (platformMatch) {
         const platform = platformMatch[1];
         const channelId = platformMatch[2];
         switch (platform) {
             case 'youtube': return `https://www.youtube.com/embed/${channelId}`;
             case 'twitch': return `https://player.twitch.tv/?channel=${channelId}&parent=${window.location.hostname}&parent=lolcast.kr`;
             case 'chzzk': return chzzkIdPattern.test(channelId) ? `${chzzkProxyBaseUrl}${channelId}` : `https://chzzk.naver.com/live/${channelId}`;
             case 'kick': return `https://player.kick.com/${channelId}`;
             case 'afreeca': return `https://play.sooplive.co.kr/${channelId}/embed`;
             default: return url; // 모르는 플랫폼은 원본 반환
         }
     }

     // 5. 개별 플랫폼 URL 형식 변환
     // YouTube (watch, youtu.be, embed)
     if (url.startsWith('https://www.youtube.com/watch?v=') || url.startsWith('https://youtu.be/')) {
         const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
         if (youtubeMatch && youtubeMatch[1]) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
     }
     if (url.startsWith('https://www.youtube.com/embed/')) return url; // 이미 embed 형식이면 그대로 반환
     // YouTube 채널 URL 등은 그대로 반환 (임베드 불가)
     if (url.includes('youtube.com/channel/') || url.includes('youtube.com/@')) return url;

     // Twitch (채널 페이지, 플레이어 페이지)
     if (url.startsWith('https://twitch.tv/') || url.startsWith('https://www.twitch.tv/')) {
         const channelId = url.split('/').filter(Boolean).pop();
         if(channelId) return `https://player.twitch.tv/?channel=${channelId}&parent=${window.location.hostname}&parent=lolcast.kr`;
     }
     if (url.startsWith('https://player.twitch.tv/')) return url; // 이미 플레이어 형식이면 그대로 반환

     // Chzzk (live 페이지, 채널 페이지)
     if (url.startsWith('https://chzzk.naver.com/live/')) {
         const pathParts = url.split('/');
         const liveIndex = pathParts.indexOf('live');
         if (liveIndex !== -1 && pathParts.length > liveIndex + 1) {
             const channelId = pathParts[liveIndex + 1].split('?')[0];
             if (chzzkIdPattern.test(channelId)) {
                 return `${chzzkProxyBaseUrl}${channelId}`; // ID 형식이면 m3u8 프록시
             } else {
                 // ID 형식이 아니면 그대로 반환 (채널 ID 문자열 등), 필요시 iframe용 URL 반환?
                 // return `https://chzzk.naver.com/live/${channelId}`;
                 return url; // 일단 원본 반환
             }
         }
     }
     if (url.startsWith('https://chzzk.naver.com/') && !url.includes('/live/')) {
         const pathParts = url.split('/');
         const potentialId = pathParts.pop() || pathParts.pop(); // URL 마지막 또는 그 앞 부분
         if (potentialId && chzzkIdPattern.test(potentialId)) {
             return `${chzzkProxyBaseUrl}${potentialId}`; // ID 형식이면 m3u8 프록시
         }
         // ID 아니면 채널 페이지 URL이므로 그대로 반환 (임베드 불가)
         return url;
     }

     // Kick (채널 페이지, 플레이어 페이지)
     if (url.startsWith('https://kick.com/')) {
         const channelId = url.split('/').filter(Boolean).pop();
         if(channelId) return `https://player.kick.com/${channelId}`;
     }
     if (url.startsWith('https://player.kick.com/')) return url; // 이미 플레이어 형식이면 그대로 반환

     // AfreecaTV (Soop) (방송국 페이지, 플레이어 페이지)
     if (url.startsWith('https://play.sooplive.co.kr/')) {
         const pathParts = url.split('/');
         // 예: https://play.sooplive.co.kr/아이디/중간숫자
         if (pathParts.length >= 4 && pathParts[3]) {
             const channelId = pathParts[3].split('/')[0]; // 아이디 부분 추출
             return `https://play.sooplive.co.kr/${channelId}/embed`; // 임베드 URL 반환
         }
     }
     if (url.includes('.sooplive.co.kr/') && url.includes('/embed')) { // 이미 임베드 형식이면 그대로 반환
        return url;
     }

     // 6. 위 규칙에 해당하지 않으면 원본 URL 반환 (일반 웹사이트 등)
     // http/https 스키마 검사 (선택 사항)
     if (!url.startsWith('http://') && !url.startsWith('https://')) {
         console.warn(`[transformUrl] 유효하지 않은 URL 스키마 또는 형식: ${url}`);
         return null; // 유효하지 않으면 null 반환
     }

     // 모든 규칙에 해당 안되면 원본 반환
     // console.log(`[transformUrl] 처리 규칙 없음, 원본 반환: ${url}`);
     return url;
 }


// 즐겨찾기 관리 모달 목록 렌더링
function renderFavorites() {
    if (!favoriteList) return;
    favoriteList.innerHTML = '';
    favorites.forEach((favorite, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'level is-mobile mb-1'; // Bulma level 사용
        // 왼쪽 (텍스트)
        const levelLeft = document.createElement('div'); levelLeft.className = 'level-left';
        const levelItemText = document.createElement('div'); levelItemText.className = 'level-item'; levelItemText.style.wordBreak = 'break-all'; // 긴 URL 줄바꿈
        const span = document.createElement('span'); span.className = 'is-size-7'; span.textContent = `${favorite.name}: ${favorite.url}`;
        levelItemText.appendChild(span); levelLeft.appendChild(levelItemText);
        // 오른쪽 (삭제 버튼)
        const levelRight = document.createElement('div'); levelRight.className = 'level-right';
        const levelItemButton = document.createElement('div'); levelItemButton.className = 'level-item';
        const deleteBtn = document.createElement('button'); deleteBtn.className = 'button is-danger is-small is-delete'; // is-delete 클래스로 X 모양
        deleteBtn.setAttribute('aria-label', '삭제');
        deleteBtn.dataset.index = index; // 삭제할 인덱스 저장
        levelItemButton.appendChild(deleteBtn); levelRight.appendChild(levelItemButton);
        // div에 왼쪽, 오른쪽 추가
        itemDiv.appendChild(levelLeft); itemDiv.appendChild(levelRight);
        favoriteList.appendChild(itemDiv); // 목록에 추가
    });
}

// 즐겨찾기 관리 모달 열기/닫기 (Bulma 기본)
function openModal() { if (favoriteModal) { renderFavorites(); favoriteModal.classList.add('is-active'); } }
function closeModal() { if (favoriteModal) { favoriteModal.classList.remove('is-active'); } }

// 드래그 앤 드롭 핸들러 생성
function createDropHandler(box) {
    return (e) => {
        e.preventDefault(); // 기본 동작 방지
        const url = e.dataTransfer.getData('text/plain'); // 드래그 데이터에서 URL 가져오기
        const typeFromData = e.dataTransfer.getData('text/type'); // 드래그 데이터에서 타입 가져오기

        let finalUrl = transformUrl(url) || url; // URL 변환 시도
        let finalType = 'iframe'; // 기본 타입

        // 1. 드래그 데이터에 타입 정보가 있으면 우선 사용
        if (typeFromData && (typeFromData === 'm3u8' || typeFromData === 'iframe')) {
            finalType = typeFromData;
        }
        // 2. 타입 정보 없으면 URL 기반으로 재판단
        else {
            const chzzkIdPattern = /^[0-9a-fA-F]{32}$/;
            // m3u8 프록시 포함, .m3u8로 끝나거나, 원본 URL(ID)이 치지직 ID 형식인 경우
            if (finalUrl.includes(chzzkProxyBaseUrl) || finalUrl.endsWith('.m3u8') || chzzkIdPattern.test(url)) {
                finalType = 'm3u8';
            }
        }
         // 3. 최종 타입이 m3u8이고, 최종 URL이 치지직 ID 형식 자체라면 프록시 URL로 변환
        const chzzkIdPatternCheck = /^[0-9a-fA-F]{32}$/;
        if (finalType === 'm3u8' && chzzkIdPatternCheck.test(finalUrl)) {
             finalUrl = `${chzzkProxyBaseUrl}${finalUrl}`;
        }

        // 최종 URL이 있으면 플레이어 로드
        if (finalUrl) {
            loadPlayer(box, finalUrl, finalType); // 플레이어 로드
            // 다음 클릭 인덱스 설정
            const targetContainer = isMobileLayout ? videoArea : playerContainer;
            const boxes = Array.from(targetContainer.querySelectorAll('.player-box'));
            clickIndex = (boxes.indexOf(box) + 1) % boxes.length;
        }
    };
}

// Google Apps Script에서 데이터 가져오기
async function fetchDataFromSheet() {
     const targetUrl = GOOGLE_APPS_SCRIPT_URL;
     if (!targetUrl || targetUrl.includes('YOUR_GOOGLE_APPS_SCRIPT')) {
         console.error("Google Apps Script URL이 설정되지 않았습니다!");
         youtubeUrlsFromSheet={}; lckScheduleData=[]; // 데이터 비우기
         return;
     }
     try {
         console.log("[fetchDataFromSheet] 데이터 가져오기 시도:", targetUrl);
         const response = await fetch(targetUrl);
         if (!response.ok) throw new Error(`HTTP 오류! 상태: ${response.status}`);
         const data = await response.json();
         if (data.error) throw new Error(`Apps Script 오류: ${data.error}`);
         youtubeUrlsFromSheet = data.youtubeUrls || {};
         lckScheduleData = data.lckSchedule || [];
         console.log("[fetchDataFromSheet] 데이터 로드 성공:", { youtubeUrls: Object.keys(youtubeUrlsFromSheet).length, lckSchedule: lckScheduleData.length });
     } catch (error) {
         console.error("[fetchDataFromSheet] 데이터 가져오기 오류:", error);
         youtubeUrlsFromSheet={}; lckScheduleData=[]; // 오류 시 데이터 비우기
         // 사용자에게 오류 알림 (선택 사항)
         // alert("데이터를 불러오는 중 오류가 발생했습니다.");
     }
 }

// --- 페이지 로드 시 초기화 함수 실행 ---
window.onload = initialize;
