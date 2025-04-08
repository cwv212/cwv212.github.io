/* CHANNELS 객체 및 기본 DOM 요소 선택 */
const CHANNELS = {
    youtube: {
        id: 'UCw1DsweY9b2AKGjV4kGJP1A',
        buttonLabel: '숙제1',
        color: '#FF0000',
        url: (id) => `https://www.youtube.com/embed/live_stream?channel=${id}`
    },
    spo: {
        buttonLabel: '스포',
        color: '#00aaff',
        url: () => 'https://lc2122.github.io/lolcast/hls.html'
    },
    flow: {
        buttonLabel: 'flow',
        color: '#00FFA3',
        url: () => 'https://insagirl.github.io/syncwatchdemo/syncwatch2.html'
    }
};

const videoSection = document.getElementById('video-section');
const videoIframe = document.getElementById('video-iframe');
const youtubeBtn = document.getElementById('youtube-btn');
const spoBtn = document.getElementById('spo-btn');
const flowBtn = document.getElementById('flow-btn');
const inputBtn = document.getElementById('input-btn');
const goBtn = document.getElementById('go-btn');
const closeBtn = document.getElementById('close-btn');
const inputModal = document.getElementById('input-modal');
const multiviewCheckbox = document.getElementById('multiview-checkbox');
const singleUrlInputContainer = document.getElementById('single-url-input-container');
const urlInput = document.getElementById('url-input');
const multiviewOptions = document.getElementById('multiview-options');
const multiviewLayoutSelect = document.getElementById('multiview-layout-select');
const multiviewUrlInputs = document.getElementById('multiview-url-inputs');
const favoriteDragContainer = document.getElementById('favorite-drag-container');
const favoriteDragList = document.getElementById('favorite-drag-list');

// 멀티뷰 관련 상태 관리
let currentMultiviewLayout = 1;
let multiviewUrlInputCounter = 0;

// 즐겨찾기 데이터 (localStorage에서 불러오기)
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

/* ------------------------- 드래그 앤 드롭 관련 함수 ------------------------- */

// 즐겨찾기 드래그 목록 렌더링 (멀티뷰용)
function updateFavoriteDragContainer() {
    // favoriteDragList 내부 초기화
    favoriteDragList.innerHTML = '';
    favorites.forEach((fav, index) => {
        const favItem = document.createElement('div');
        favItem.className = 'favorite-drag-item';
        favItem.textContent = fav.name;
        favItem.setAttribute('draggable', 'true');
        // 드래그 시작 시 URL 데이터를 dataTransfer에 설정
        favItem.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', fav.url);
        });
        favoriteDragList.appendChild(favItem);
    });
}

/* 멀티뷰 입력 필드에 드래그 앤 드롭 이벤트 추가 */
function addDragDropEvents(input) {
    input.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    input.addEventListener('drop', (e) => {
        e.preventDefault();
        const droppedUrl = e.dataTransfer.getData('text/plain');
        if (droppedUrl) {
            input.value = droppedUrl;
        }
    });
}

/* ------------------------- 멀티뷰 및 단일뷰 관련 함수 ------------------------- */

// YouTube 버튼
youtubeBtn.addEventListener('click', () => {
    multiviewCheckbox.checked = false;
    showSingleInput();
    setSingleViewContent(CHANNELS.youtube.url(CHANNELS.youtube.id));
});

// 숲 버튼
spoBtn.addEventListener('click', () => {
    multiviewCheckbox.checked = false;
    showSingleInput();
    setSingleViewContent(CHANNELS.spo.url());
});

// flow 버튼
flowBtn.addEventListener('click', () => {
    multiviewCheckbox.checked = false;
    showSingleInput();
    setSingleViewContent(CHANNELS.flow.url());
});

// "Input" 버튼 클릭 시 모달 열기
inputBtn.addEventListener('click', () => {
    inputModal.style.display = 'block';
    // 모달 열 때 단일 뷰 모드로 설정
    multiviewCheckbox.checked = false;
    showSingleInput();
});

// 멀티뷰 체크박스 변경 시 표시 전환
multiviewCheckbox.addEventListener('change', () => {
    if (multiviewCheckbox.checked) {
        showMultiviewOptions();
    } else {
        showSingleInput();
    }
});

// 멀티뷰 레이아웃 선택 변경 시
multiviewLayoutSelect.addEventListener('change', () => {
    currentMultiviewLayout = parseInt(multiviewLayoutSelect.value);
    updateMultiviewUrlInputs();
});

// "Go" 버튼 클릭 시 멀티뷰 또는 단일뷰 실행
goBtn.addEventListener('click', () => {
    if (multiviewCheckbox.checked) {
        startMultiview();
    } else {
        startSingleView();
    }
    inputModal.style.display = 'none';
});

// "닫기" 버튼 클릭 시 입력 모달 닫기
closeBtn.addEventListener('click', () => {
    inputModal.style.display = 'none';
});

/* 멀티뷰 관련 함수 */
function showSingleInput() {
    singleUrlInputContainer.style.display = 'block';
    multiviewOptions.style.display = 'none';
    urlInput.value = '';
}

function showMultiviewOptions() {
    singleUrlInputContainer.style.display = 'none';
    multiviewOptions.style.display = 'block';
    // 멀티뷰 옵션 표시될 때 입력 필드 및 드래그 영역 초기화 후 생성
    multiviewUrlInputs.innerHTML = '';
    multiviewUrlInputCounter = 0;
    for (let i = 0; i < currentMultiviewLayout; i++) {
        addMultiviewInput();
    }
    // 업데이트한 즐겨찾기 드래그 목록도 함께 업데이트
    updateFavoriteDragContainer();
}

function updateMultiviewUrlInputs() {
    const currentInputs = multiviewUrlInputs.querySelectorAll('.multiview-input');
    const diff = currentMultiviewLayout - currentInputs.length;
    if (diff > 0) {
        for (let i = 0; i < diff; i++) {
            addMultiviewInput();
        }
    } else if (diff < 0) {
        for (let i = 0; i < -diff; i++) {
            if (multiviewUrlInputs.lastChild) {
                multiviewUrlInputs.removeChild(multiviewUrlInputs.lastChild);
                multiviewUrlInputCounter--;
            }
        }
    }
}

function addMultiviewInput() {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'multiview-input';
    input.placeholder = `URL ${multiviewUrlInputCounter + 1}`;
    // 드래그 앤 드롭 이벤트 등록
    addDragDropEvents(input);
    multiviewUrlInputs.appendChild(input);
    multiviewUrlInputCounter++;
}

function startSingleView() {
    const url = urlInput.value.trim();
    setSingleViewContent(url);
}

function setSingleViewContent(url) {
    const transformedUrl = transformUrl(url);
    if (transformedUrl) {
        // URL에서 쿼리스트링 제거 후 m3u8 여부 확인
        const urlWithoutQuery = transformedUrl.split('?')[0];
        if (urlWithoutQuery.endsWith('.m3u8')) {
            videoIframe.src = getPlayerUrl(transformedUrl);
        } else {
            videoIframe.src = transformedUrl;
        }
    }
}

function startMultiview() {
    // 멀티뷰 입력 필드의 값 읽어오기
    const inputs = multiviewUrlInputs.querySelectorAll('.multiview-input');
    const urls = Array.from(inputs).map(input => {
        const trimmed = input.value.trim();
        const transformed = transformUrl(trimmed);
        if (!transformed) return '';
        const urlWithoutQuery = transformed.split('?')[0];
        return urlWithoutQuery.endsWith('.m3u8')
            ? getPlayerUrl(transformed)
            : transformed;
    });

    // 1분할 예외 처리 (실제로 단일뷰로 전환)
    if (currentMultiviewLayout === 1) {
        multiviewCheckbox.checked = false;
        showSingleInput();
        startSingleView();
        return;
    }

    // 멀티뷰 컨테이너 생성
    videoSection.innerHTML = `
        <div class="multiview-container" 
             style="grid-template-columns: repeat(${getMultiviewColumns(currentMultiviewLayout)}, 1fr);">
            ${urls.map(url => `
                <div class="multiview-item">
                    <iframe src="${url}" frameborder="0" allowfullscreen></iframe>
                </div>
            `).join('')}
        </div>
    `;

    // 멀티뷰 모드에서 iframe 크기 조정
    const multiviewItems = videoSection.querySelectorAll('.multiview-item');
    multiviewItems.forEach(item => {
        const iframe = item.querySelector('iframe');
        if (iframe) {
            iframe.style.width = '100%';
            iframe.style.height = '100%';
        }
    });
}

function getMultiviewColumns(layout) {
    return layout > 2 ? 2 : layout;
}

function getPlayerUrl(m3u8Url) {
  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isChrome = /Chrome/i.test(ua);
  const isWhale = /Whale/i.test(ua);
  const isEdge = /Edg/i.test(ua);
  // 모바일 브라우저인 경우 Livereacting 플레이어 사용
  if (isMobile) {
    return `https://www.livereacting.com/tools/hls-player-embed?url=${encodeURIComponent(m3u8Url)}`;
  }
  // 데스크탑 환경에서 Chrome, Whale, Edge인 경우 chrome-extension URL 사용
  if (isChrome || isWhale || isEdge) {
    return `chrome-extension://eakdijdofmnclopcffkkgmndadhbjgka/player.html#${m3u8Url}`;
  }
  // 그 외의 브라우저에서는 Livereacting 플레이어 사용 (데스크탑)
  return `https://www.livereacting.com/tools/hls-player-embed?url=${encodeURIComponent(m3u8Url)}`;
}

/* 즐겨찾기 모달 관련 기존 함수 (독립적 동작) */
function renderFavorites() {
    const favoriteModal = document.getElementById('favorite-modal');
    const favoriteList = document.getElementById('favorite-list');
    favoriteList.innerHTML = '';
    favorites.forEach((favorite, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${favorite.name}</span>
            <button onclick="deleteFavorite(${index})">삭제</button>
        `;
        li.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                multiviewCheckbox.checked = false;
                showSingleInput();
                const transformedUrl = transformUrl(favorite.url);
                if (transformedUrl) {
                    videoIframe.src = transformedUrl.endsWith('.m3u8') 
                        ? getPlayerUrl(transformedUrl) 
                        : transformedUrl;
                    favoriteModal.style.display = 'none';
                }
            }
        });
        favoriteList.appendChild(li);
    });
    favoriteModal.style.display = 'block';
}

const favoriteBtn = document.getElementById('favorite-btn');
favoriteBtn.addEventListener('click', () => {
    renderFavorites();
});

const closeFavoriteModal = document.getElementById('close-favorite-modal');
closeFavoriteModal.addEventListener('click', () => {
    document.getElementById('favorite-modal').style.display = 'none';
});

function addFavorite(url, name) {
    if (!url || !name) {
        alert('URL과 이름을 입력해주세요.');
        return;
    }
    if (favorites.some(fav => fav.url === url)) {
        alert('이미 등록된 URL입니다.');
        return;
    }
    favorites.push({ url, name });
    localStorage.setItem('favorites', JSON.stringify(favorites));
    alert('즐겨찾기에 추가되었습니다.');
    renderFavorites();
    document.getElementById('favorite-name-input').value = '';
    document.getElementById('favorite-url-input').value = '';
}

function deleteFavorite(index) {
    if (confirm('정말로 삭제하시겠습니까?')) {
        favorites.splice(index, 1);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        renderFavorites();
    }
}

const addFavoriteBtn = document.getElementById('add-favorite-btn');
addFavoriteBtn.addEventListener('click', () => {
    const url = document.getElementById('favorite-url-input').value.trim();
    const name = document.getElementById('favorite-name-input').value.trim();
    addFavorite(url, name);
});

/* URL 변환 함수 */
function transformUrl(url) {
    if (!url) return null;

    // 치지직 채널 ID 감지 (32자리 16진수 문자열)
    const chzzkChannelIdPattern = /^[0-9a-fA-F]{32}$/;
    if (chzzkChannelIdPattern.test(url)) {
        return `https://chzzk-api-proxy.hibiya.workers.dev/m3u8-redirect/${url}`;
    }

    // m3u8 URL 처리
    if (url.includes('.m3u8')) {
        return url; // m3u8 URL은 그대로 반환
    }

    // 기존 로직 (단축 URL 및 기타 URL 처리)
    const isShortForm = /^(youtube|twitch|chzzk|kick|afreeca)\/[^\/]+$/.test(url);
    if (url === 'https://play.sooplive.co.kr/aflol/281494910/embed') {
        return url;
    }
    if (isShortForm) {
        const [platform, channelId] = url.split('/');
        switch (platform) {
            case 'youtube': return `https://www.youtube.com/embed/${channelId}`;
            case 'twitch': return `https://player.twitch.tv/?channel=${channelId}&parent=lc2122.github.io`;
            case 'chzzk': return `https://chzzk.naver.com/live/${channelId}`;
            case 'kick': return `https://player.kick.com/${channelId}`;
            case 'afreeca': return `https://play.sooplive.co.kr/${channelId}/embed`;
            default: alert('지원하지 않는 플랫폼입니다.'); return null;
        }
    }
    if (!url.startsWith('http')) { alert('유효한 URL을 입력해주세요.'); return null; }
    if (url.startsWith('https://lolcast.kr/#/player/youtube/')) return `https://www.youtube.com/embed/${url.split('/').pop()}`;
    if (url.startsWith('https://lolcast.kr/#/player/twitch/')) return `https://player.twitch.tv/?channel=${url.split('/').pop()}&parent=lc2122.github.io`;
    if (url.startsWith('https://lolcast.kr/#/player/chzzk/')) return `https://chzzk.naver.com/live/${url.split('/').pop()}`;
    if (url.startsWith('https://lolcast.kr/#/player/kick/')) return `https://player.kick.com/${url.split('/').pop()}`;
    if (url.startsWith('https://lolcast.kr/#/player/afreeca/')) return `https://play.sooplive.co.kr/${url.split('/').pop()}/embed`;
    if (url.includes('youtu.be') || url.includes('youtube.com/watch?v=')) {
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/);
        if (match) return `https://www.youtube.com/embed/${match[1]}`;
    }
    if (url.startsWith('https://twitch.tv/')) return `https://player.twitch.tv/?channel=${url.split('/').pop()}&parent=lc2122.github.io`;
    if (url.startsWith('https://chzzk.naver.com/live/') || url.startsWith('https://chzzk.naver.com/')) return `https://chzzk.naver.com/live/${url.split('/').pop()}`;
    if (url.startsWith('https://kick.com/')) return `https://player.kick.com/${url.split('/').pop()}`;
    if (url.startsWith('https://play.sooplive.co.kr/')) return `https://play.sooplive.co.kr/${url.split('/')[3]}/embed`;
    if (url.startsWith('https://')) return url;
    alert('지원하지 않는 URL 형식입니다.'); return null;
}

function handleHashChange() {
    const hash = window.location.hash;
    if (hash.startsWith('#/twitch/')) {
        setSingleViewContent(`https://player.twitch.tv/?channel=${hash.split('/')[2]}&parent=lc2122.github.io`);
    } else if (hash.startsWith('#/youtube/')) {
        setSingleViewContent(`https://www.youtube.com/embed/${hash.split('/')[2]}`);
    } else if (hash.startsWith('#/chzzk/')) {
        setSingleViewContent(`https://chzzk.naver.com/live/${hash.split('/')[2]}`);
    } else if (hash.startsWith('#/soop/')) {
        setSingleViewContent(`https://play.sooplive.co.kr/${hash.split('/')[2]}/embed`);
    } else if (hash.startsWith('#/kick/')) {
        setSingleViewContent(`https://player.kick.com/${hash.split('/')[2]}`);
    } else if (hash.startsWith('#/hls/')) {
        const m3u8Url = decodeURIComponent(hash.split('#/hls/')[1]);
        if (m3u8Url.includes('.m3u8')) {
            setSingleViewContent(m3u8Url);
        }
    } else {
        // 기본값으로 flow 설정 (필요에 따라 수정)
        setSingleViewContent(CHANNELS.flow.url());
    }
}

// 초기 로드 시 실행
window.addEventListener('load', () => {
    handleHashChange(); // 초기 해시 처리
});

// 해시 변경 시 실시간 반영
window.addEventListener('hashchange', () => {
    handleHashChange(); // 해시 변경 시 동일 로직 실행
});
