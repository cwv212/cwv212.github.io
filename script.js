// --- 환경 설정 및 상수 ---
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyfH8NgvggsTWd9-GNpajUFQrBf0GF4sqHyMl9VUljqRmOYdO-NaWlrBMM-ZEDIYvDg1w/exec'; // 실제 URL 확인
const baseballBaseUrl = 'https://global-media.sooplive.com/live/soopbaseball';
const chzzkProxyBaseUrl = 'https://chzzk-api-proxy.hibiya.workers.dev/m3u8-redirect/';
const HLS_EMBED_BASE_URL = 'https://www.livereacting.com/tools/hls-player-embed?autoplay=1&controls=1&fluid=1&ratio=16:9&url='; // livereacting 임베드 URL

// --- 상태 변수 ---
let youtubeUrlsFromSheet = {};
let lckScheduleData = [];
let playerCount = 1;
let clickIndex = 0;
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
// isMobileLayout 변수 제거

// --- DOM 요소 캐싱 변수 ---
// 모바일 요소만 캐싱
let videoArea, chatArea, chatIframe, bottomNav, controlsModal, favoriteModal, favoriteList;

// --- 채널 데이터 정의 (변경 없음) ---
const baseballChannelsData = Array.from({ length: 5 }, (_, i) => ({ name: `야${i + 1}`, url: `${baseballBaseUrl}${i + 1}/master.m3u8`, type: 'm3u8', className: 'baseball-btn channel-button is-outlined' }));
const spotvChannelsData = Array.from({ length: 40 }, (_, i) => { const cn = String(i + 1).padStart(2, '0'); return { name: `${i + 1}`, url: `https://ch${cn}-nlivecdn.spotvnow.co.kr/ch${cn}/decr/medialist_14173921312004482655_hls.m3u8`, type: 'm3u8', className: 'spotv-btn channel-button is-outlined' }; });
const sportsChannels = [...baseballChannelsData, ...spotvChannelsData];
const lckChannels = [ { name: 'L', url: 'https://global-media.sooplive.com/live/lckkr/master.m3u8', type: 'm3u8', tooltip: 'soop', className: 'lck-channel-btn is-outlined' }, { name: 'C', url: `${chzzkProxyBaseUrl}9381e7d6816e6d915a44a13c0195b202`, type: 'm3u8', tooltip: 'chzzk', className: 'lck-channel-btn is-outlined' }, { name: 'K', url: '', type: 'iframe', tooltip: 'youtube', className: 'lck-channel-btn is-outlined' } ];
const streamerChannels = [ { name: '풍', id: '7ce8032370ac5121dcabce7bad375ced', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' }, { name: '침', id: 'bb382c2c0cc9fa7c86ab3b037fb5799c', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' }, { name: '추', id: '181a3baebe508d3b5fa5d9fe4d6b5241', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' }, { name: '솝', id: '34a2bd4f5988e37693e94306f0bfe57f', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' }, { name: '센', id: 'be243c7cbfb8d4e28777eedc43e28181', type: 'm3u8', className: 'chzzk-btn channel-button is-outlined' } ];

// --- DOM 요소 캐싱 함수 (모바일 요소만) ---
function cacheDOMElements() {
    videoArea = document.getElementById('video-area');
    chatArea = document.getElementById('chat-area');
    chatIframe = document.getElementById('chat-iframe');
    bottomNav = document.getElementById('bottom-nav');
    controlsModal = document.getElementById('controls-modal');
    favoriteModal = document.getElementById('favorite-modal'); // 즐겨찾기 관리 모달은 유지
    favoriteList = document.getElementById('favorite-list');     // 즐겨찾기 관리 목록도 유지
}

// --- checkLayout 함수 제거 ---
// function checkLayout() { ... }

// --- 초기화 함수 (모바일 전용으로 간소화) ---
async function initialize() {
     console.log("[initialize] 초기화 시작");
     cacheDOMElements();
     // checkLayout() 호출 제거

     // --- 이벤트 리스너 설정 ---
     // 즐겨찾기 관리 모달 리스너
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
                     renderControlsModalLists(); // 컨트롤 모달 목록 업데이트
                 }
             }
         });
     }

      // 컨트롤 모달 리스너
     const ctrlModalBg = controlsModal?.querySelector('.modal-background');
     if (ctrlModalBg) ctrlModalBg.addEventListener('click', closeControlsModal);
     const ctrlCloseBtn = controlsModal?.querySelector('.delete');
     if (ctrlCloseBtn) ctrlCloseBtn.addEventListener('click', closeControlsModal);
     const ctrlCancelBtn = controlsModal?.querySelector('.modal-card-foot .button');
     if (ctrlCancelBtn) ctrlCancelBtn.addEventListener('click', closeControlsModal);

     // F5 새로고침 버튼 리스너
     const refreshBtn = document.getElementById('refresh-btn');
     if (refreshBtn) {
         refreshBtn.addEventListener('click', () => {
             if (chatIframe) {
                 console.log('[F5] 채팅 iframe 새로고침 시도');
                 const currentSrc = chatIframe.src;
                 const baseUrl = currentSrc.split('?')[0].split('#')[0];
                 const hashPart = currentSrc.includes('#') ? '#' + currentSrc.split('#')[1] : '';
                 chatIframe.src = baseUrl + '?cache=' + Date.now() + hashPart;
             } else { console.warn('[F5] 채팅 iframe 요소를 찾을 수 없습니다.'); }
         });
     } else { console.warn('[initialize] F5 새로고침 버튼(refresh-btn) 요소를 찾을 수 없습니다.'); }

     // --- 데이터 로드 ---
     await fetchDataFromSheet();

     // --- 초기 설정 (모바일 전용) ---
     console.log("[initialize] 모바일 레이아웃 설정 중...");
     setSplitScreen(1);
     renderControlsModalLists(); // 컨트롤 모달 목록 렌더링
     renderLckScheduleModal();   // 컨트롤 모달 스케줄 렌더링
     console.log("[initialize] 모바일 레이아웃 설정 완료 & 초기화 완료");
}

// --- 화면 분할 설정 함수 (모바일 전용) ---
function setSplitScreen(count) {
    const targetContainer = videoArea; // 항상 videoArea 사용
    const maxCount = 2; // 최대 2분할

    if (!targetContainer) { console.error("[setSplitScreen] videoArea 요소를 찾을 수 없습니다!"); return; }

    if (count < 1) count = 1;
    if (count > maxCount) count = maxCount;
    playerCount = count;
    clickIndex = 0;

    console.log(`[setSplitScreen] 분할 수: ${playerCount}`);

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

// --- 플레이어 레이아웃 조정 함수 (모바일 전용, 동적 높이 및 상하 분할) ---
function adjustPlayerLayout() {
    const targetContainer = videoArea; // 항상 videoArea 사용
    const chatContainer = chatArea; // 채팅 영역 참조
    if (!targetContainer || !chatContainer) {
        console.error("adjustPlayerLayout: 비디오 또는 채팅 영역 요소를 찾을 수 없습니다.");
        return;
    }

    let videoHeightPercent = 60; // 기본값 (2분할 기준)
    let chatHeightPercent = 35;  // 기본값 (2분할 기준)
    let gridColumns = '1fr';     // 기본 그리드 컬럼 (1개)
    let gridRows = '1fr';        // 기본 그리드 행 (1개)

    // 분할 수에 따라 높이 비율 및 그리드 행 설정 변경
    if (playerCount === 1) {
        videoHeightPercent = 40; // 1분할 시 영상 45%
        chatHeightPercent = 55;  // 1분할 시 채팅 55%
        gridRows = '1fr';        // 1분할 시 행 1개
        console.log("[adjustPlayerLayout] 1분할 설정: 영상 45%, 채팅 55%, 그리드 1x1");
    } else if (playerCount === 2) {
        videoHeightPercent = 60; // 2분할 시 영상 60%
        chatHeightPercent = 35;  // 2분할 시 채팅 40%
        // ★★★ 2분할 상하 배치를 위해 행을 2개로 설정 ★★★
        gridRows = '1fr 1fr';
        console.log("[adjustPlayerLayout] 2분할 설정: 영상 60%, 채팅 40%, 그리드 1x2 (상하)");
    }
    // (참고: 현재 setSplitScreen에서 1 또는 2만 허용하므로 다른 경우는 없음)

    // 계산된 높이 비율 적용
    targetContainer.style.height = `${videoHeightPercent}%`;
    chatContainer.style.height = `${chatHeightPercent}%`;

    // 비디오 영역 내부 그리드 레이아웃 설정
    targetContainer.style.gridTemplateColumns = gridColumns;
    targetContainer.style.gridTemplateRows = gridRows;
}

// --- 모바일 컨트롤 모달 관련 함수 ---
function openControlsModal() {
    if (controlsModal) {
        renderControlsModalLists();
        renderLckScheduleModal();
        controlsModal.classList.add('is-active');
    }
}
function closeControlsModal() { if (controlsModal) controlsModal.classList.remove('is-active'); }
function openFavoritesManagerModal() { closeControlsModal(); openModal(); }
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
            finalUrl = `${chzzkProxyBaseUrl}${userInput}`; // 프록시 URL 사용 준비
            type = 'm3u8'; // 타입 m3u8
        } else {
            finalUrl = transformUrl(userInput); // 일반 iframe용 URL 변환 시도
            if (finalUrl) {
                // 변환된 URL 또는 원본 입력값이 HLS 관련인지 판단
                if (finalUrl.includes(chzzkProxyBaseUrl) || finalUrl.endsWith('.m3u8') || chzzkIdPattern.test(userInput)) {
                    type = 'm3u8';
                     // HLS 타입이면, 원본 ID나 프록시 URL을 loadPlayer에 전달해야 함.
                     // transformUrl이 ID를 반환했을 수 있으므로 원본 userInput 사용 고려
                     if(chzzkIdPattern.test(userInput)) {
                         finalUrl = userInput; // loadPlayer가 처리하도록 원본 ID 전달
                     } else if (userInput.includes(chzzkProxyBaseUrl) || userInput.endsWith('.m3u8')) {
                         finalUrl = userInput; // 원본 HLS URL 전달
                     }
                     // transformUrl 결과가 HLS URL이면 그대로 사용
                }
            }
        }

        if (finalUrl) {
            const targetContainer = videoArea; // 항상 videoArea
            const playerBoxes = targetContainer?.querySelectorAll('.player-box');
            if (playerBoxes && playerBoxes.length > 0) {
                const targetBox = playerBoxes[clickIndex % playerBoxes.length];
                loadPlayer(targetBox, finalUrl, type); // 결정된 URL과 타입 사용
                clickIndex++;
                customUrlInput.value = '';
                closeControlsModal();
            }
        } else { alert('유효하지 않거나 지원하지 않는 형식의 URL 또는 ID입니다.'); }
    }
}


// --- 채널 목록 렌더링 함수 (모바일 전용) ---
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

        let urlOrIdToLoad = ''; // loadPlayer에 전달할 최종 값
        let finalType = 'iframe'; // 최종 타입
        let originalInputForTypeCheck = ''; // 타입 결정을 위한 원본

        if (idKey && channel[idKey]) {
            urlOrIdToLoad = channel[idKey]; // ID 자체를 전달
            originalInputForTypeCheck = channel[idKey];
            finalType = 'm3u8'; // ID는 HLS로 간주
        } else if (urlKey && channel[urlKey]) {
            urlOrIdToLoad = channel[urlKey]; // URL 전달
            originalInputForTypeCheck = channel[urlKey];
        } else if (channel.url) {
            urlOrIdToLoad = channel.url; // URL 전달
            originalInputForTypeCheck = channel.url;
        }

        // 타입 재확인 및 설정
        const chzzkIdPattern = /^[0-9a-fA-F]{32}$/;
        if (channel.type === 'm3u8' || // 채널 데이터에 명시된 경우
            (typeof originalInputForTypeCheck === 'string' && originalInputForTypeCheck.endsWith('.m3u8')) || // 원본 URL이 m3u8
            (typeof originalInputForTypeCheck === 'string' && originalInputForTypeCheck.includes(chzzkProxyBaseUrl)) || // 원본 URL이 프록시
            chzzkIdPattern.test(originalInputForTypeCheck)) // 원본 입력값이 ID
        {
             finalType = 'm3u8';
        }
         // transformUrl은 iframe용 변환만 담당하므로, 여기서는 타입 결정에만 사용
         const transformedForCheck = transformUrl(urlOrIdToLoad);
         // livereacting URL은 iframe 타입
         if (transformedForCheck && transformedForCheck.startsWith('https://www.livereacting.com/')) {
             finalType = 'iframe';
             urlOrIdToLoad = transformedForCheck; // livereacting URL 직접 로드
         }


        if (urlOrIdToLoad) {
            btn.dataset.url = urlOrIdToLoad; // loadPlayer에 전달할 값 저장
            btn.dataset.type = finalType; // 최종 타입 저장
            if (channel[tooltipKey]) btn.title = channel[tooltipKey];
        } else {
            btn.dataset.url = ''; btn.dataset.type = 'iframe'; btn.classList.add('is-disabled');
            btn.title = "URL 정보 없음"; btn.draggable = false;
        }

        btn.addEventListener('dragstart', (e) => { /* 드래그 로직 동일 */
            if (btn.dataset.url && btn.dataset.type) { e.dataTransfer.setData('text/plain', btn.dataset.url); e.dataTransfer.setData('text/type', btn.dataset.type); } else { e.preventDefault(); }
        });
        btn.addEventListener('click', () => { /* 클릭 로직 (모바일 전용) */
            if (btn.dataset.url && btn.dataset.type) {
                const targetContainer = videoArea; // 항상 videoArea
                const boxes = targetContainer?.querySelectorAll('.player-box');
                if (boxes && boxes.length > 0) {
                    const targetBox = boxes[clickIndex % boxes.length];
                    loadPlayer(targetBox, btn.dataset.url, btn.dataset.type); // 저장된 값 사용
                    clickIndex++;
                    closeControlsModal(); // 모달 닫기
                }
            }
        });
        container.appendChild(btn);
    });
}

// --- 하단 네비게이션 바 채널 재생 함수 (모바일 전용) ---
function playChannelFromNav(url, type) { // 타입 인자(type)를 직접 받음
    if (!url) { console.warn("[playChannelFromNav] 재생할 URL이 없습니다."); const boxes = videoArea?.querySelectorAll('.player-box'); if (boxes && boxes.length > 0) loadPlayer(boxes[0], null, 'iframe'); return; }

    const targetContainer = videoArea; // 항상 videoArea
    const playerBoxes = targetContainer?.querySelectorAll('.player-box');
    if (playerBoxes && playerBoxes.length > 0) {
        const targetBox = playerBoxes[clickIndex % playerBoxes.length];
        // ★★★ 네비게이션 버튼에서 직접 전달된 URL과 타입 사용 ★★★
        loadPlayer(targetBox, url, type);
        clickIndex++;
    } else { console.error("[playChannelFromNav] videoArea에서 플레이어 박스를 찾을 수 없습니다."); }
}


// --- 컨트롤 모달 LCK 스케줄 렌더링 함수 ---
function renderLckScheduleModal() {
    const container = document.getElementById('lck-schedule-modal');
    if (!container) return;
    const logoBasePath = '/img/'; const logoExtension = '.png'; const defaultLogoPath = '/img/default.png';
    if (!Array.isArray(lckScheduleData) || lckScheduleData.length === 0) { container.innerHTML = '<p class="has-text-grey has-text-centered py-2 is-size-7">오늘 경기 정보 없음</p>'; return; }
    container.innerHTML = '';
    lckScheduleData.forEach(match => { /* ... 스케줄 항목 생성 로직 (변경 없음) ... */
     if (!match || !match.team1 || !match.team2) return; const itemDiv = document.createElement('div'); itemDiv.className = 'is-flex is-align-items-center is-justify-content-center py-1 schedule-item-modal'; itemDiv.style.borderBottom = '1px dashed #444'; itemDiv.style.fontSize = '0.8rem'; const team1Span = document.createElement('span'); team1Span.className = 'team-display is-flex is-align-items-center'; const team1LogoFig = document.createElement('figure'); team1LogoFig.className = 'image is-16x16 mr-1'; const team1Logo = document.createElement('img'); team1Logo.src = `${logoBasePath}${match.team1}${logoExtension}`; team1Logo.alt = `${match.team1} 로고`; team1Logo.onerror = function() { this.src = defaultLogoPath; this.onerror = null; }; team1LogoFig.appendChild(team1Logo); const team1Name = document.createTextNode(` ${match.team1}`); team1Span.appendChild(team1LogoFig); team1Span.appendChild(team1Name); const vsSpan = document.createElement('span'); vsSpan.textContent = ' vs '; vsSpan.className = 'vs-separator mx-1 is-size-7 has-text-grey-light'; const team2Span = document.createElement('span'); team2Span.className = 'team-display is-flex is-align-items-center'; const team2Name = document.createTextNode(`${match.team2} `); const team2LogoFig = document.createElement('figure'); team2LogoFig.className = 'image is-16x16 ml-1'; const team2Logo = document.createElement('img'); team2Logo.src = `${logoBasePath}${match.team2}${logoExtension}`; team2Logo.alt = `${match.team2} 로고`; team2Logo.onerror = function() { this.src = defaultLogoPath; this.onerror = null; }; team2LogoFig.appendChild(team2Logo); team2Span.appendChild(team2Name); team2Span.appendChild(team2LogoFig); itemDiv.appendChild(team1Span); itemDiv.appendChild(vsSpan); itemDiv.appendChild(team2Span); container.appendChild(itemDiv);
     });
    const lastItem = container.querySelector('.schedule-item-modal:last-child');
    if(lastItem) lastItem.style.borderBottom = 'none';
}

// --- 모든 플레이어 새로고침 함수 (모바일 전용) ---
function refreshAllPlayers() {
    const targetContainer = videoArea; // 항상 videoArea
    const activeIframes = targetContainer?.querySelectorAll('.player-box iframe') || [];
    console.log(`[refreshAllPlayers] ${activeIframes.length}개의 플레이어 새로고침 시도...`);
    activeIframes.forEach(iframe => {
        if (iframe && iframe.src) {
            const currentSrc = iframe.getAttribute('src');
            const parentBox = iframe.closest('.player-box');
            if (!parentBox) return;
            if (currentSrc.startsWith(HLS_EMBED_BASE_URL)) {
                try { const urlParams = new URLSearchParams(currentSrc.split('?')[1]); const originalUrl = urlParams.get('url'); if (originalUrl) { console.log(`[refreshAllPlayers] livereacting HLS 플레이어 새로고침: ${originalUrl}`); loadPlayer(parentBox, originalUrl, 'm3u8'); } else { console.warn(`[refreshAllPlayers] livereacting URL에서 원본 M3U8 추출 실패, src 재설정: ${currentSrc}`); iframe.src = currentSrc; } } catch(e) { console.error(`[refreshAllPlayers] livereacting URL 파싱 오류, src 재설정: ${currentSrc}`, e); iframe.src = currentSrc; }
            } else { console.log(`[refreshAllPlayers] 일반 iframe 플레이어 새로고침: ${currentSrc}`); loadPlayer(parentBox, currentSrc, 'iframe'); }
        }
    });
}


// --- 즐겨찾기 추가 함수 (모바일 전용) ---
function addFavorite() {
    const nameInput = document.getElementById('favorite-name-input');
    const urlInput = document.getElementById('favorite-url-input');
    if (!nameInput || !urlInput) return;
    const name = nameInput.value.trim(); const urlOrId = urlInput.value.trim();
    if (name && urlOrId) {
        if (favorites.some(fav => fav.name === name || fav.url === urlOrId)) { alert('이미 같은 이름 또는 URL/ID의 즐겨찾기가 존재합니다.'); return; }
        favorites.push({ name: name, url: urlOrId });
        localStorage.setItem('favorites', JSON.stringify(favorites));
        renderControlsModalLists(); // 컨트롤 모달 목록 업데이트
        renderFavorites();          // 관리 모달 목록 업데이트
        nameInput.value = ''; urlInput.value = '';
        closeModal(); // 관리 모달 닫기
    } else { alert('이름과 URL 또는 채널 ID를 모두 입력해주세요.'); }
}

// --- 플레이어 로드 함수 (모바일 전용, livereacting 사용) ---
function loadPlayer(box, url, type) {
    while (box.firstChild) box.removeChild(box.firstChild);
    if (!url) { box.innerHTML='<div class="has-text-grey is-size-6 has-text-centered p-2">URL 없음</div>'; box.className='player-box'; return; }

    const iframe = document.createElement('iframe');
    iframe.setAttribute('allow','autoplay; fullscreen; encrypted-media; picture-in-picture');
    iframe.setAttribute('allowfullscreen','');
    iframe.style.border = 'none';

    // HLS 스트림 판단 로직 (원본 URL/ID 기준)
    const chzzkIdPattern = /^[0-9a-fA-F]{32}$/;
    let isHlsStream = (type === 'm3u8') ||
                      (typeof url === 'string' && url.endsWith('.m3u8')) ||
                      (typeof url === 'string' && url.includes(chzzkProxyBaseUrl)) ||
                      chzzkIdPattern.test(url); // ID 자체도 HLS로 간주

    console.log(`[loadPlayer] 로딩 시작 - URL/ID: ${url}, 타입: ${type}, HLS 여부: ${isHlsStream}, 대상 박스: ${box.id}`);

    if (isHlsStream) {
        // HLS 스트림 -> livereacting.com URL 생성
        let hlsUrl = url;
        // 만약 입력값이 ID였다면 프록시 URL로 변경
        if (chzzkIdPattern.test(url)) {
            hlsUrl = `${chzzkProxyBaseUrl}${url}`;
        }
        const embedUrl = HLS_EMBED_BASE_URL + encodeURIComponent(hlsUrl);
        iframe.src = embedUrl;
        console.log(`[loadPlayer] livereacting HLS 임베드 로드: ${embedUrl}`);
        iframe.onerror = (e) => { console.error(`[loadPlayer] livereacting HLS 임베드 로드 오류: ${embedUrl}`, e); box.innerHTML=`<div class="has-text-danger is-size-7 has-text-centered p-2">HLS 플레이어 로드 실패<br><small>외부 서비스 오류 또는 URL 확인</small></div>`; box.className='player-box'; };
    } else {
        // HLS 아님 -> 일반 iframe 처리
        const finalUrl = transformUrl(url) || url; // transformUrl은 이제 iframe용 변환만
        iframe.src = finalUrl;
        console.log(`[loadPlayer] 일반 Iframe 로드: ${finalUrl}`);
        iframe.onerror = (e) => { console.error(`[loadPlayer] Iframe 로드 오류: ${finalUrl}`, e); box.innerHTML=`<div class="has-text-danger is-size-7 has-text-centered p-2">플레이어 로드 실패<br><small>${url}</small></div>`; box.className='player-box'; };
    }
    box.appendChild(iframe);
}

// --- 기타 유틸리티 함수 (변경 없음) ---
function getKstDate() { /* ... */
 const date = new Date(); const kstOffset = 9 * 60; const utc = date.getTime() + (date.getTimezoneOffset() * 60000); const kstDate = new Date(utc + (kstOffset * 60000)); return kstDate.toISOString().split('T')[0];
 }
function getYouTubeLiveOrUpcoming() { /* ... */
 const today = getKstDate(); if (youtubeUrlsFromSheet && youtubeUrlsFromSheet[today] && youtubeUrlsFromSheet[today].url) return youtubeUrlsFromSheet[today].url; return null;
 }
function transformUrl(url) { // iframe용 URL 변환만 담당
    if (!url) return null; if (typeof url !== 'string') url = String(url);
    // HLS URL/ID는 원본 반환
    if (url.endsWith('.m3u8')) return url; const chzzkIdPattern = /^[0-9a-fA-F]{32}$/; if (chzzkIdPattern.test(url)) return url; if (url.includes(chzzkProxyBaseUrl)) return url; if (url.startsWith('https://www.livereacting.com/')) return url;
    // lolcast.kr 파싱 (HLS 관련 로직 제거)
    if (url.startsWith('https://lolcast.kr/#/player/')) { try { const hashPart = url.split('#')[1]; if (hashPart) { const pathSegments = hashPart.split('/').filter(segment => segment.length > 0); if (pathSegments.length >= 3 && pathSegments[0] === 'player') { const platform = pathSegments[1].toLowerCase(); const channelId = pathSegments[2]; switch (platform) { case 'youtube': return `https://www.youtube.com/embed/${channelId}`; case 'twitch': return `https://player.twitch.tv/?channel=${channelId}&parent=${window.location.hostname}&parent=lolcast.kr`; case 'chzzk': return `https://chzzk.naver.com/live/${channelId}`; case 'kick': return `https://player.kick.com/${channelId}`; case 'afreeca': return `https://play.sooplive.co.kr/${channelId}/embed`; default: return url; } } } } catch (error) { return url; } }
    // 플랫폼/채널ID 파싱 (HLS 관련 로직 제거)
    const platformChannelPattern = /^(youtube|twitch|chzzk|kick|afreeca)\/([^\/]+)$/; const platformMatch = url.match(platformChannelPattern); if (platformMatch) { const platform = platformMatch[1]; const channelId = platformMatch[2]; switch (platform) { case 'youtube': return `https://www.youtube.com/embed/${channelId}`; case 'twitch': return `https://player.twitch.tv/?channel=${channelId}&parent=${window.location.hostname}&parent=lolcast.kr`; case 'chzzk': return `https://chzzk.naver.com/live/${channelId}`; case 'kick': return `https://player.kick.com/${channelId}`; case 'afreeca': return `https://play.sooplive.co.kr/${channelId}/embed`; default: return url; } }
    // 개별 플랫폼 URL -> iframe URL 변환
    if (url.startsWith('https://www.youtube.com/watch?v=') || url.startsWith('https://youtu.be/')) { const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/); if (youtubeMatch && youtubeMatch[1]) return `https://www.youtube.com/embed/${youtubeMatch[1]}`; } if (url.startsWith('https://www.youtube.com/embed/')) return url; if (url.includes('youtube.com/channel/') || url.includes('youtube.com/@')) return url;
    if (url.startsWith('https://twitch.tv/') || url.startsWith('https://www.twitch.tv/')) { const channelId = url.split('/').filter(Boolean).pop(); if(channelId) return `https://player.twitch.tv/?channel=${channelId}&parent=${window.location.hostname}&parent=lolcast.kr`; } if (url.startsWith('https://player.twitch.tv/')) return url;
    if (url.startsWith('https://chzzk.naver.com/live/')) { const pathParts = url.split('/'); const liveIndex = pathParts.indexOf('live'); if (liveIndex !== -1 && pathParts.length > liveIndex + 1) { const channelId = pathParts[liveIndex + 1].split('?')[0]; if (!chzzkIdPattern.test(channelId)) return `https://chzzk.naver.com/live/${channelId}`; } }
    if (url.startsWith('https://kick.com/')) { const channelId = url.split('/').filter(Boolean).pop(); if(channelId) return `https://player.kick.com/${channelId}`; } if (url.startsWith('https://player.kick.com/')) return url;
    if (url.startsWith('https://play.sooplive.co.kr/')) { const pathParts = url.split('/'); if (pathParts.length >= 4 && pathParts[3]) { const channelId = pathParts[3].split('/')[0]; return `https://play.sooplive.co.kr/${channelId}/embed`; } } if (url.includes('.sooplive.co.kr/') && url.includes('/embed')) return url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) { console.warn(`[transformUrl] 유효하지 않은 URL 스키마: ${url}`); return null; }
    return url;
 }
function renderFavorites() { // 관리 모달 목록 렌더링 (변경 없음)
    if (!favoriteList) return; favoriteList.innerHTML = ''; favorites.forEach((favorite, index) => { /* ... 목록 항목 생성 로직 ... */ const itemDiv = document.createElement('div'); itemDiv.className = 'level is-mobile mb-1'; const levelLeft = document.createElement('div'); levelLeft.className = 'level-left'; const levelItemText = document.createElement('div'); levelItemText.className = 'level-item'; levelItemText.style.wordBreak = 'break-all'; const span = document.createElement('span'); span.className = 'is-size-7'; span.textContent = `${favorite.name}: ${favorite.url}`; levelItemText.appendChild(span); levelLeft.appendChild(levelItemText); const levelRight = document.createElement('div'); levelRight.className = 'level-right'; const levelItemButton = document.createElement('div'); levelItemButton.className = 'level-item'; const deleteBtn = document.createElement('button'); deleteBtn.className = 'button is-danger is-small is-delete'; deleteBtn.setAttribute('aria-label', '삭제'); deleteBtn.dataset.index = index; levelItemButton.appendChild(deleteBtn); levelRight.appendChild(levelItemButton); itemDiv.appendChild(levelLeft); itemDiv.appendChild(levelRight); favoriteList.appendChild(itemDiv); });
 }
function openModal() { if (favoriteModal) { renderFavorites(); favoriteModal.classList.add('is-active'); } } // 관리 모달 열기
function closeModal() { if (favoriteModal) { favoriteModal.classList.remove('is-active'); } } // 관리 모달 닫기
function createDropHandler(box) { // 드래그 앤 드롭 (모바일 전용)
    return (e) => {
        e.preventDefault(); const url = e.dataTransfer.getData('text/plain'); const typeFromData = e.dataTransfer.getData('text/type');
        let finalUrl = url; // 기본적으로 원본 URL/ID 사용
        let finalType = 'iframe';
        const chzzkIdPattern = /^[0-9a-fA-F]{32}$/;
        let isHlsStream = (typeFromData === 'm3u8') || (typeof url === 'string' && url.endsWith('.m3u8')) || (typeof url === 'string' && url.includes(chzzkProxyBaseUrl)) || chzzkIdPattern.test(url);
        if (isHlsStream) { finalType = 'm3u8'; } else { finalUrl = transformUrl(url) || url; } // HLS 아니면 iframe용 변환
        if (finalUrl) { loadPlayer(box, finalUrl, finalType); const targetContainer = videoArea; const boxes = Array.from(targetContainer.querySelectorAll('.player-box')); clickIndex = (boxes.indexOf(box) + 1) % boxes.length; }
    };
}
async function fetchDataFromSheet() { /* ... 데이터 가져오기 로직 (변경 없음) ... */
 const targetUrl = GOOGLE_APPS_SCRIPT_URL; if (!targetUrl || targetUrl.includes('YOUR_GOOGLE_APPS_SCRIPT')) { console.error("Google Apps Script URL이 설정되지 않았습니다!"); youtubeUrlsFromSheet={}; lckScheduleData=[]; return; } try { console.log("[fetchDataFromSheet] 데이터 가져오기 시도:", targetUrl); const response = await fetch(targetUrl); if (!response.ok) throw new Error(`HTTP 오류! 상태: ${response.status}`); const data = await response.json(); if (data.error) throw new Error(`Apps Script 오류: ${data.error}`); youtubeUrlsFromSheet = data.youtubeUrls || {}; lckScheduleData = data.lckSchedule || []; console.log("[fetchDataFromSheet] 데이터 로드 성공:", { youtubeUrls: Object.keys(youtubeUrlsFromSheet).length, lckSchedule: lckScheduleData.length }); } catch (error) { console.error("[fetchDataFromSheet] 데이터 가져오기 오류:", error); youtubeUrlsFromSheet={}; lckScheduleData=[]; }
 }

// --- 페이지 로드 시 초기화 함수 실행 ---
window.onload = initialize;
