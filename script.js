document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables & State ---
    let splitScreenCount = 1;
    let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

    // --- Constants ---
    const extensionId = 'eakdijdofmnclopcffkkgmndadhbjgka'; // Chrome 확장 ID
    const baseballBaseUrl = 'https://global-media.sooplive.com/live/soopbaseball';
    const chzzkProxyBaseUrl = 'https://chzzk-api-proxy.hibiya.workers.dev/m3u8-redirect/';

    // --- Channel Data ---
    const lckChannels = [
        { name: 'L', url: 'https://global-media.sooplive.com/live/lckkr/master.m3u8', type: 'm3u8', tooltip: 'soop' },
        { name: 'C', url: 'https://chzzk-api-proxy.hibiya.workers.dev/m3u8-redirect/9381e7d6816e6d915a44a13c0195b202', type: 'm3u8', tooltip: 'chzzk' },
        { name: 'K', url: 'https://www.youtube.com/embed/live_stream?channel=UCw1DsweY9b2AKGjV4kGJP1A', type: 'iframe', tooltip: 'youtube' }
    ];

    const baseballChannels = Array.from({ length: 5 }, (_, i) => ({
        name: `야${i + 1}`,
        url: `${baseballBaseUrl}${i + 1}/master.m3u8`,
        type: 'm3u8',
        tooltip: 'soop'
    }));

    const spotvChannels = Array.from({ length: 40 }, (_, i) => {
        const channelNum = String(i + 1).padStart(2, '0');
        return {
            name: `${i + 1}`,
            url: `https://ch${channelNum}-nlivecdn.spotvnow.co.kr/ch${channelNum}/decr/medialist_14173921312004482655_hls.m3u8`,
            type: 'm3u8',
            tooltip: 'spotv'
        };
    });

    const tvChannels = [
        { name: 'SBS', url: 'https://bpplus-stream.sbs.co.kr/live/sbslive01/playlist.m3u8', type: 'm3u8', tooltip: 'sbs' },
        { name: 'KBS1', url: 'https://bpplus-stream.sbs.co.kr/live/kbs1live01/playlist.m3u8', type: 'm3u8', tooltip: 'kbs' },
        { name: 'KBS2', url: 'https://bpplus-stream.sbs.co.kr/live/kbs2live01/playlist.m3u8', type: 'm3u8', tooltip: 'kbs' },
        { name: 'MBC', url: 'https://bpplus-stream.sbs.co.kr/live/mbclive01/playlist.m3u8', type: 'm3u8', tooltip: 'mbc' }
    ];

    // --- DOM Elements ---
    const sidebar = document.getElementById('sidebar');
    const lckChannelList = document.getElementById('lck-channels');
    const baseballChannelList = document.getElementById('baseball-channels');
    const spotvChannelList = document.getElementById('spotv-channels');
    const tvChannelList = document.getElementById('tv-channels');
    const spotvToggle = document.getElementById('spotv-toggle');
    const spotvArrow = document.getElementById('spotv-arrow');
    const videoSection = document.getElementById('video-section');
    const chatIframe = document.getElementById('chat-iframe');
    const favoriteModal = document.getElementById('favorite-modal');
    const favoriteList = document.getElementById('favorite-list');
    const sidebarFavoriteList = document.getElementById('sidebar-favorite-list');
    const customUrlInput = document.getElementById('custom-url-input');

    // --- Utility Functions ---
    function transformUrl(url) {
        if (!url) return null;
        url = url.trim();

        // Chzzk Channel ID (32 hex chars)
        const chzzkChannelIdPattern = /^[0-9a-fA-F]{32}$/;
        if (chzzkChannelIdPattern.test(url)) {
            return `${chzzkProxyBaseUrl}${url}`;
        }

        // Direct m3u8 URL
        if (url.includes('.m3u8')) {
            return url;
        }

        // Short form: platform/id
        const shortFormPattern = /^(youtube|twitch|chzzk|kick|afreeca)\/([^\/]+)$/;
        const shortMatch = url.match(shortFormPattern);
        if (shortMatch) {
            const platform = shortMatch[1];
            const channelId = shortMatch[2];
            switch (platform) {
                case 'youtube': return `https://www.youtube.com/embed/${channelId}`;
                case 'twitch': return `https://player.twitch.tv/?channel=${channelId}&parent=lolcast.kr&parent=0c5ac3b1-playground-worker-empty-bread-9ff1.hlsp.workers.dev`;
                case 'chzzk': return `${chzzkProxyBaseUrl}${channelId}`; // Chzzk ID to m3u8 proxy
                case 'kick': return `https://player.kick.com/${channelId}`;
                case 'afreeca': return `https://play.sooplive.co.kr/${channelId}/embed`;
                default: return null;
            }
        }

        // Full URL handling
        if (!url.startsWith('http')) return null;
        if (url.startsWith('https://twitch.tv/')) {
            return `https://player.twitch.tv/?channel=${url.split('/').pop()}&parent=lolcast.kr&parent=0c5ac3b1-playground-worker-empty-bread-9ff1.hlsp.workers.dev`;
        }
        if (url.startsWith('https://lolcast.kr/#/player/youtube/')) return `https://www.youtube.com/embed/${url.split('/').pop()}`;
        if (url.startsWith('https://lolcast.kr/#/player/twitch/')) return `https://player.twitch.tv/?channel=${url.split('/').pop()}&parent=lolcast.kr&parent=0c5ac3b1-playground-worker-empty-bread-9ff1.hlsp.workers.dev`;
        if (url.startsWith('https://lolcast.kr/#/player/chzzk/')) return `${chzzkProxyBaseUrl}${url.split('/').pop()}`; // Chzzk to m3u8
        if (url.startsWith('https://lolcast.kr/#/player/kick/')) return `https://player.kick.com/${url.split('/').pop()}`;
        if (url.startsWith('https://lolcast.kr/#/player/afreeca/')) return `https://play.sooplive.co.kr/${url.split('/').pop()}/embed`;
        if (url.includes('youtu.be') || url.includes('youtube.com/watch?v=')) {
            const match = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/);
            if (match) return `https://www.youtube.com/embed/${match[1]}`;
        }
        if (url.startsWith('https://chzzk.naver.com/live/') || url.startsWith('https://chzzk.naver.com/')) {
            return `${chzzkProxyBaseUrl}${url.split('/').pop()}`; // Chzzk to m3u8
        }
        if (url.startsWith('https://kick.com/')) return `https://player.kick.com/${url.split('/').pop()}`;
        if (url.startsWith('https://play.sooplive.co.kr/')) return `https://play.sooplive.co.kr/${url.split('/')[3]}/embed`;
        if (url.startsWith('https://')) return url;
        return null;
    }

    function getPlayerUrl(m3u8Url) {
        const ua = navigator.userAgent;
        const isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua) && !/Whale/i.test(ua);
        if (isChrome) {
            // Chrome에서 확장 프로그램을 통해 m3u8 재생
            return `chrome-extension://${extensionId}/player.html#${encodeURIComponent(m3u8Url)}`;
        }
        // Chrome 외 브라우저에서는 기본 HLS 플레이어 사용
        return `https://www.livereacting.com/tools/hls-player-embed?url=${encodeURIComponent(m3u8Url)}`;
    }

    function getMultiviewColumns(layout) {
        return layout <= 2 ? layout : 2;
    }

    function playUrlInFrame(targetIframe, url) {
        if (!targetIframe || !url) return;
        const transformedUrl = transformUrl(url);
        if (transformedUrl) {
            const playerSrc = transformedUrl.includes('.m3u8') ? getPlayerUrl(transformedUrl) : transformedUrl;
            targetIframe.src = playerSrc;
        } else {
            alert('유효하지 않은 URL입니다: ' + url);
            targetIframe.src = 'about:blank';
        }
    }

    // --- Core Functions ---
    function createChannelButton(channel) {
        const btn = document.createElement('button');
        btn.className = 'channel-btn';
        btn.textContent = channel.name;
        btn.title = channel.tooltip || ''; // 툴팁 추가
        btn.draggable = true;

        btn.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', channel.url);
        });

        btn.addEventListener('click', () => {
            const iframes = videoSection.querySelectorAll('iframe');
            if (iframes.length > 0) {
                playUrlInFrame(iframes[0], channel.url);
            }
        });

        return btn;
    }

    function renderChannelButtons() {
        lckChannelList.innerHTML = '';
        baseballChannelList.innerHTML = '';
        spotvChannelList.innerHTML = '';
        tvChannelList.innerHTML = '';

        lckChannels.forEach(channel => lckChannelList.appendChild(createChannelButton(channel)));
        baseballChannels.forEach(channel => baseballChannelList.appendChild(createChannelButton(channel)));
        spotvChannels.forEach(channel => spotvChannelList.appendChild(createChannelButton(channel)));
        tvChannels.forEach(channel => tvChannelList.appendChild(createChannelButton(channel)));
    }

    function toggleSpotv() {
        const isActive = spotvChannelList.classList.toggle('active');
        spotvArrow.textContent = isActive ? '▲' : '▼';
        spotvChannelList.style.display = isActive ? 'flex' : 'none';
    }

    function setSplitScreen(count) {
        splitScreenCount = count;
        videoSection.innerHTML = '';

        if (count === 1) {
            const iframe = document.createElement('iframe');
            iframe.id = 'video-iframe-0';
            iframe.src = 'about:blank';
            iframe.frameBorder = '0';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            videoSection.appendChild(iframe);
            addDragDropEvents(videoSection);
        } else {
            const multiviewContainer = document.createElement('div');
            multiviewContainer.className = 'multiview-container';
            multiviewContainer.style.gridTemplateColumns = `repeat(${getMultiviewColumns(count)}, 1fr)`;
            multiviewContainer.style.gridTemplateRows = count <= 2 ? '1fr' : `repeat(${Math.ceil(count / 2)}, 1fr)`;

            for (let i = 0; i < count; i++) {
                const multiviewItem = document.createElement('div');
                multiviewItem.className = 'multiview-item';
                addDragDropEvents(multiviewItem);

                const iframe = document.createElement('iframe');
                iframe.id = `video-iframe-${i}`;
                iframe.src = 'about:blank';
                iframe.frameBorder = '0';
                iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
                iframe.allowFullscreen = true;
                multiviewItem.appendChild(iframe);
                multiviewContainer.appendChild(multiviewItem);
            }
            videoSection.appendChild(multiviewContainer);
        }
    }

    function addDragDropEvents(targetElement) {
        targetElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            targetElement.style.border = '2px dashed #00f';
        });
        targetElement.addEventListener('dragleave', () => {
            targetElement.style.border = '';
        });
        targetElement.addEventListener('drop', (e) => {
            e.preventDefault();
            targetElement.style.border = '';
            const droppedUrl = e.dataTransfer.getData('text/plain');
            const targetIframe = targetElement.querySelector('iframe') || targetElement;
            if (droppedUrl && targetIframe) {
                playUrlInFrame(targetIframe, droppedUrl);
            }
        });
    }

    function playCustomUrl() {
        const url = customUrlInput.value;
        if (url) {
            const iframes = videoSection.querySelectorAll('iframe');
            if (iframes.length > 0) {
                playUrlInFrame(iframes[0], url);
            }
        }
    }

    function renderSidebarFavorites() {
        sidebarFavoriteList.innerHTML = '';
        favorites.forEach(favorite => {
            const btn = createChannelButton(favorite);
            sidebarFavoriteList.appendChild(btn);
        });
    }

    function renderFavorites() {
        favoriteList.innerHTML = '';
        favorites.forEach((favorite, index) => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '5px 0';
            li.style.borderBottom = '1px solid #eee';

            const contentContainer = document.createElement('div');
            contentContainer.style.flexGrow = '1';
            contentContainer.style.marginRight = '10px';
            contentContainer.style.cursor = 'pointer';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = favorite.name;
            nameSpan.style.fontWeight = '500';
            nameSpan.style.display = 'block';

            const urlSpan = document.createElement('span');
            urlSpan.textContent = favorite.url;
            urlSpan.style.fontSize = '0.8em';
            urlSpan.style.color = '#555';
            urlSpan.style.wordBreak = 'break-all';

            contentContainer.appendChild(nameSpan);
            contentContainer.appendChild(urlSpan);

            contentContainer.addEventListener('click', () => {
                const iframes = videoSection.querySelectorAll('iframe');
                if (iframes.length > 0) {
                    playUrlInFrame(iframes[0], favorite.url);
                    favoriteModal.style.display = 'none';
                }
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '삭제';
            deleteBtn.style.backgroundColor = '#dc3545';
            deleteBtn.style.color = 'white';
            deleteBtn.style.border = 'none';
            deleteBtn.style.borderRadius = '4px';
            deleteBtn.style.padding = '3px 8px';
            deleteBtn.style.fontSize = '12px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.flexShrink = '0';
            deleteBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                deleteFavorite(index);
            });

            li.appendChild(contentContainer);
            li.appendChild(deleteBtn);
            favoriteList.appendChild(li);
        });
    }

    function addFavorite() {
        const nameInput = document.getElementById('favorite-name-input');
        const urlInput = document.getElementById('favorite-url-input');
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();

        if (name && url) {
            if (!url.startsWith('http') && !url.includes('/') && !/^[0-9a-fA-F]{32}$/.test(url) && !url.includes('.m3u8')) {
                alert('유효한 URL 형식이나 채널 ID를 입력해주세요.');
                return;
            }

            if (favorites.some(fav => fav.url === url && fav.name === name)) {
                alert('동일한 이름과 주소의 즐겨찾기가 이미 존재합니다.');
                return;
            }

            favorites.push({ name, url });
            localStorage.setItem('favorites', JSON.stringify(favorites));
            renderFavorites();
            renderSidebarFavorites();
            nameInput.value = '';
            urlInput.value = '';
            favoriteModal.style.display = 'block';
        } else {
            alert('이름과 주소를 모두 입력해주세요.');
        }
    }

    function deleteFavorite(index) {
        if (confirm(`'${favorites[index].name}' 즐겨찾기를 삭제하시겠습니까?`)) {
            favorites.splice(index, 1);
            localStorage.setItem('favorites', JSON.stringify(favorites));
            renderFavorites();
            renderSidebarFavorites();
            favoriteModal.style.display = 'block';
        }
    }

    function handleHashChange() {
        const hash = window.location.hash;
        let urlToPlay = null;

        if (hash.startsWith('#/twitch/')) urlToPlay = `https://twitch.tv/${hash.split('/')[2]}`;
        else if (hash.startsWith('#/youtube/')) urlToPlay = `https://youtube.com/watch?v=${hash.split('/')[2]}`;
        else if (hash.startsWith('#/chzzk/')) urlToPlay = `${chzzkProxyBaseUrl}${hash.split('/')[2]}`; // Chzzk hash to m3u8
        else if (hash.startsWith('#/soop/')) urlToPlay = `https://play.sooplive.co.kr/${hash.split('/')[2]}`;
        else if (hash.startsWith('#/kick/')) urlToPlay = `https://kick.com/${hash.split('/')[2]}`;
        else if (hash.startsWith('#/hls/')) {
            try {
                const decoded = decodeURIComponent(hash.substring(6));
                if (decoded.includes('.m3u8')) urlToPlay = decoded;
            } catch (e) { console.error("Error decoding HLS hash:", e); }
        }

        if (urlToPlay) {
            setSplitScreen(1);
            const iframe = videoSection.querySelector('iframe');
            playUrlInFrame(iframe, urlToPlay);
        }
    }

    // --- Initialization ---
    renderChannelButtons();
    renderSidebarFavorites();
    setSplitScreen(1);

    const lgicurl = 'https://insagirl-toto.appspot.com/chatting/lgic/';
    chatIframe.src = lgicurl;

    handleHashChange();

    // --- Event Listeners ---
    document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
    document.getElementById('close-sidebar-btn').addEventListener('click', () => {
        sidebar.classList.add('collapsed');
    });

    spotvToggle.addEventListener('click', toggleSpotv);

    document.getElementById('split-screen-buttons').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.split) {
            setSplitScreen(parseInt(e.target.dataset.split, 10));
        }
    });

    document.getElementById('play-custom-url-btn').addEventListener('click', playCustomUrl);
    customUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') playCustomUrl();
    });

    document.getElementById('hrm-btn').addEventListener('click', () => {
        window.open('https://insagirl-toto.appspot.com/hrm/?where=1', '_blank');
    });

    document.getElementById('flow-btn').addEventListener('click', () => {
        const flowUrl = 'https://insagirl.github.io/syncwatchdemo/syncwatch2.html';
        const iframes = videoSection.querySelectorAll('iframe');
        if (iframes.length > 0) {
            playUrlInFrame(iframes[0], flowUrl);
        }
    });

    document.getElementById('refresh-btn').addEventListener('click', () => {
        const currentChatSrc = chatIframe.src.split('?')[0].split('#')[0];
        const chatHashPart = chatIframe.src.includes('#') ? '#' + chatIframe.src.split('#')[1] : '';
        chatIframe.src = `${currentChatSrc}?cache=${Math.random()}${chatHashPart}`;
    });

    document.getElementById('favorite-btn').addEventListener('click', () => {
        renderFavorites();
        favoriteModal.style.display = 'block';
    });
    document.getElementById('close-favorite-modal').addEventListener('click', () => {
        favoriteModal.style.display = 'none';
    });
    document.getElementById('add-favorite-btn').addEventListener('click', addFavorite);

    window.addEventListener('hashchange', handleHashChange);
});
