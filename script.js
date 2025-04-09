document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables & State ---
    let splitScreenCount = 1;
    let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

    // --- Channel Data ---
    const lckChannels = [
        { name: 'L', url: 'https://global-media.sooplive.com/live/lckkr/master.m3u8' },
        { name: 'C', url: 'https://chzzk-api-proxy.hibiya.workers.dev/m3u8-redirect/9381e7d6816e6d915a44a13c0195b202' },
        { name: 'K', url: 'https://www.youtube.com/embed/live_stream?channel=UCw1DsweY9b2AKGjV4kGJP1A' } // Note: Placeholder likely needs update
    ];
    const baseballChannels = Array.from({ length: 5 }, (_, i) => ({
        name: `야${i + 1}`,
        url: `https://global-media.sooplive.com/live/soopbaseball${i + 1}/master.m3u8`
    }));
    const spotvChannels = Array.from({ length: 40 }, (_, i) => {
        const channelNum = String(i + 1).padStart(2, '0');
        // Note: SPOTV URLs might change or require specific tokens/authentication
        return { name: `${i + 1}`, url: `https://ch${channelNum}-nlivecdn.spotvnow.co.kr/ch${channelNum}/decr/medialist_14173921312004482655_hls.m3u8` };
    });
    const tvChannels = [
        // Note: Public terrestrial URLs often change or have restrictions. These might not work consistently.
        { name: 'SBS', url: 'https://bpplus-stream.sbs.co.kr/live/sbslive01/playlist.m3u8' },
        { name: 'KBS1', url: 'https://bpplus-stream.sbs.co.kr/live/kbs1live01/playlist.m3u8' }, // Placeholder, likely needs update
        { name: 'KBS2', url: 'https://bpplus-stream.sbs.co.kr/live/kbs2live01/playlist.m3u8' }, // Placeholder, likely needs update
        { name: 'MBC', url: 'https://bpplus-stream.sbs.co.kr/live/mbclive01/playlist.m3u8' }  // Placeholder, likely needs update
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
        url = url.trim(); // Trim whitespace

        // Allow specific known URLs directly
        if (url === 'https://insagirl.github.io/syncwatchdemo/syncwatch2.html') return url;

        // Handle m3u8 URLs
        if (url.includes('.m3u8')) return url;

        // Handle Chzzk Channel IDs (32 hex chars)
        const chzzkChannelIdPattern = /^[0-9a-fA-F]{32}$/;
        if (chzzkChannelIdPattern.test(url)) {
            return `https://chzzk-api-proxy.hibiya.workers.dev/m3u8-redirect/${url}`;
        }

        // Handle lolcast format: https://lolcast.kr/#/player/platform/id
        if (url.startsWith('https://lolcast.kr/#/player/')) {
            const parts = url.split('/');
            if (parts.length >= 6) {
                const platform = parts[4];
                const id = parts[5];
                switch (platform) {
                    case 'youtube': return `https://www.youtube.com/embed/$${id}`; // Check if '1' prefix is correct
                    case 'twitch': return `https://player.twitch.tv/?channel=${id}&parent=${window.location.hostname}`;
                    case 'chzzk': return `https://chzzk.naver.com/live/${id}`;
                    case 'kick': return `https://player.kick.com/${id}`;
                    case 'afreeca': return `https://play.sooplive.co.kr/${id}/embed`;
                    default: break; // Fall through to other checks
                }
            }
        }

        // Handle short format: platform/id
        const shortFormPattern = /^(youtube|twitch|chzzk|kick|afreeca)\/([^\/]+)$/;
        const shortMatch = url.match(shortFormPattern);
        if (shortMatch) {
            const platform = shortMatch[1];
            const channelId = shortMatch[2];
            switch (platform) {
                case 'youtube': return `https://www.youtube.com/embed/$${channelId}`; // Check if '1' prefix is correct
                case 'twitch': return `https://player.twitch.tv/?channel=${channelId}&parent=${window.location.hostname}`;
                case 'chzzk': return `https://chzzk.naver.com/live/${channelId}`;
                case 'kick': return `https://player.kick.com/${channelId}`;
                case 'afreeca': return `https://play.sooplive.co.kr/${channelId}/embed`;
                default: return null; // Should not happen with regex match
            }
        }

        // Handle full URLs
        try {
            const parsedUrl = new URL(url); // Check if it's a valid URL structure
            const hostname = parsedUrl.hostname;
            const pathname = parsedUrl.pathname;

            if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
                const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                if (match) return `https://www.youtube.com/embed/$${match[1]}`; // Check if '1' prefix is correct
            }
            if (hostname.includes('twitch.tv')) {
                 const channel = pathname.split('/')[1];
                 if(channel) return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`;
            }
            if (hostname.includes('chzzk.naver.com')) {
                 const parts = pathname.split('/');
                 const liveIndex = parts.indexOf('live');
                 if (liveIndex !== -1 && parts.length > liveIndex + 1) {
                     return `https://chzzk.naver.com/live/${parts[liveIndex + 1]}`;
                 } else if (parts.length > 1 && parts[1]) { // Handle chzzk.naver.com/channelId case
                     return `https://chzzk.naver.com/live/${parts[1]}`;
                 }
            }
            if (hostname.includes('kick.com')) {
                 const channel = pathname.split('/')[1];
                 if(channel) return `https://player.kick.com/${channel}`;
            }
            if (hostname.includes('play.sooplive.co.kr')) {
                const channel = pathname.split('/')[1];
                if(channel) return `https://play.sooplive.co.kr/${channel}/embed`;
            }
            // If it's a valid HTTPS URL and not transformed, return it as is (e.g., direct iframe links)
             if (parsedUrl.protocol === 'https:') {
                 return url;
             }

        } catch (e) {
            // Not a valid URL format
            console.error("Invalid URL format:", url, e);
            return null;
        }

        return null; // No valid transformation found
    }

    function getPlayerUrl(m3u8Url) {
        // Basic HLS Player - Consider more robust options like HLS.js or Video.js for better compatibility/features
        // Using livereacting as a simple embed fallback
        return `https://www.livereacting.com/tools/hls-player-embed?url=${encodeURIComponent(m3u8Url)}`;
        // --- Alternative using a Chrome Extension (example) ---
        // const ua = navigator.userAgent;
        // const isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua) && !/Whale/i.test(ua);
        // if (isChrome) {
        //     // Replace with your actual extension ID if you use one
        //     const extensionId = 'eakdijdofmnclopcffkkgmndadhbjgka'; // Example: Native HLS Playback
        //     // Check if extension exists? A more robust check might be needed.
        //     // For simplicity, assume it's installed if Chrome.
        //     return `chrome-extension://${extensionId}/player.html#${encodeURIComponent(m3u8Url)}`;
        // }
        // return `https://www.livereacting.com/tools/hls-player-embed?url=${encodeURIComponent(m3u8Url)}`;
    }

    function getMultiviewColumns(layout) {
        return layout <= 2 ? layout : 2; // Max 2 columns
    }

    function playUrlInFrame(targetIframe, url) {
        if (!targetIframe || !url) return;
        const transformedUrl = transformUrl(url);
        if (transformedUrl) {
            const playerSrc = transformedUrl.includes('.m3u8') ? getPlayerUrl(transformedUrl) : transformedUrl;
            targetIframe.src = playerSrc;
        } else {
            alert('유효하지 않은 URL입니다: ' + url);
            targetIframe.src = 'about:blank'; // Clear invalid URL
        }
    }

    // --- Core Functions ---
    function createChannelButton(channel) {
        const btn = document.createElement('button');
        btn.className = 'channel-btn';
        btn.textContent = channel.name;
        btn.draggable = true; // Keep draggable attribute if drag/drop is implemented later

        // Drag start event (data setup)
        btn.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', channel.url);
        });

        // Click event (play in first available frame)
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
        videoSection.innerHTML = ''; // Clear previous iframes

        if (count === 1) {
            const iframe = document.createElement('iframe');
            iframe.id = 'video-iframe-0'; // Unique ID
            iframe.src = 'about:blank'; // Start blank
            iframe.frameBorder = '0';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            videoSection.appendChild(iframe);
             // Add drag/drop listener for single view
             addDragDropEvents(videoSection); // Apply to the container
        } else {
            const multiviewContainer = document.createElement('div');
            multiviewContainer.className = 'multiview-container';
            multiviewContainer.style.gridTemplateColumns = `repeat(${getMultiviewColumns(count)}, 1fr)`;
            multiviewContainer.style.gridTemplateRows = count <= 2 ? '1fr' : `repeat(${Math.ceil(count / 2)}, 1fr)`;

            for (let i = 0; i < count; i++) {
                const multiviewItem = document.createElement('div');
                multiviewItem.className = 'multiview-item';
                // Add drag/drop listeners for each multiview item
                addDragDropEvents(multiviewItem);

                const iframe = document.createElement('iframe');
                iframe.id = `video-iframe-${i}`; // Unique ID
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

    // Add drag & drop handlers to a target element (iframe container)
    function addDragDropEvents(targetElement) {
        targetElement.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow dropping
            targetElement.style.border = '2px dashed #00f'; // Visual feedback (optional)
        });
        targetElement.addEventListener('dragleave', (e) => {
             targetElement.style.border = ''; // Remove visual feedback
        });
        targetElement.addEventListener('drop', (e) => {
            e.preventDefault();
            targetElement.style.border = ''; // Remove visual feedback
            const droppedUrl = e.dataTransfer.getData('text/plain');
            const targetIframe = targetElement.querySelector('iframe') || targetElement; // Handle single vs multi-item drop target

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
                playUrlInFrame(iframes[0], url); // Play in the first frame
            }
        }
    }

    function renderSidebarFavorites() {
        sidebarFavoriteList.innerHTML = '';
        favorites.forEach(favorite => {
            const btn = createChannelButton(favorite); // Reuse button creation logic
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
            li.style.borderBottom = '1px solid #eee'; // Add separator

            const contentContainer = document.createElement('div');
            contentContainer.style.flexGrow = '1';
            contentContainer.style.marginRight = '10px'; // Spacing
            contentContainer.style.cursor = 'pointer'; // Indicate clickable

            const nameSpan = document.createElement('span');
            nameSpan.textContent = favorite.name;
            nameSpan.style.fontWeight = '500'; // Bolder name
            nameSpan.style.display = 'block'; // Ensure name is on its own line if URL is long

            const urlSpan = document.createElement('span');
            urlSpan.textContent = favorite.url;
            urlSpan.style.fontSize = '0.8em'; // Smaller URL text
            urlSpan.style.color = '#555';
            urlSpan.style.wordBreak = 'break-all'; // Prevent long URLs from overflowing

            contentContainer.appendChild(nameSpan);
            contentContainer.appendChild(urlSpan);

             // Click on text plays the favorite
             contentContainer.addEventListener('click', () => {
                const iframes = videoSection.querySelectorAll('iframe');
                if (iframes.length > 0) {
                    playUrlInFrame(iframes[0], favorite.url); // Play in first frame
                    favoriteModal.style.display = 'none'; // Close modal after selection
                }
            });


            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '삭제';
            deleteBtn.style.backgroundColor = '#dc3545';
            deleteBtn.style.color = 'white';
            deleteBtn.style.border = 'none';
            deleteBtn.style.borderRadius = '4px';
            deleteBtn.style.padding = '3px 8px'; // Slightly adjusted padding
            deleteBtn.style.fontSize = '12px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.flexShrink = '0'; // Prevent button shrinking
            deleteBtn.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent li click event when deleting
                deleteFavorite(index);
            });

            li.appendChild(contentContainer);
            li.appendChild(deleteBtn);
            favoriteList.appendChild(li);
        });
         // DO NOT add favoriteModal.style.display = 'block'; here
    }

    function addFavorite() {
        const nameInput = document.getElementById('favorite-name-input');
        const urlInput = document.getElementById('favorite-url-input');
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();

        if (name && url) {
            // Optional: Validate URL basic structure
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

            renderFavorites(); // Update list in modal
            renderSidebarFavorites(); // Update list in sidebar

            // Clear inputs after adding
            nameInput.value = '';
            urlInput.value = '';

             // Keep the modal open after adding
             favoriteModal.style.display = 'block';

        } else {
            alert('이름과 주소를 모두 입력해주세요.');
        }
    }

    function deleteFavorite(index) {
        if (confirm(`'${favorites[index].name}' 즐겨찾기를 삭제하시겠습니까?`)) {
            favorites.splice(index, 1);
            localStorage.setItem('favorites', JSON.stringify(favorites));
            renderFavorites(); // Update list in modal
            renderSidebarFavorites(); // Update list in sidebar

            // Keep the modal open after deleting
            favoriteModal.style.display = 'block';
        }
    }

    function handleHashChange() {
        const hash = window.location.hash;
        let urlToPlay = null;

        if (hash.startsWith('#/twitch/')) urlToPlay = `https://twitch.tv/${hash.split('/')[2]}`;
        else if (hash.startsWith('#/youtube/')) urlToPlay = `https://youtube.com/watch?v=${hash.split('/')[2]}`;
        else if (hash.startsWith('#/chzzk/')) urlToPlay = `https://chzzk.naver.com/live/${hash.split('/')[2]}`;
        else if (hash.startsWith('#/soop/')) urlToPlay = `https://play.sooplive.co.kr/${hash.split('/')[2]}`;
        else if (hash.startsWith('#/kick/')) urlToPlay = `https://kick.com/${hash.split('/')[2]}`;
        else if (hash.startsWith('#/hls/')) {
            try {
                const decoded = decodeURIComponent(hash.substring(6)); // Remove #/hls/
                if (decoded.includes('.m3u8')) {
                    urlToPlay = decoded;
                }
            } catch (e) { console.error("Error decoding HLS hash:", e); }
        }

        if (urlToPlay) {
             setSplitScreen(1); // Force single screen for hash navigation
             const iframe = videoSection.querySelector('iframe');
             playUrlInFrame(iframe, urlToPlay);
        } else {
             // Optional: Load default view if hash is invalid or not present
             // setSplitScreen(1);
             // const iframe = videoSection.querySelector('iframe');
             // playUrlInFrame(iframe, 'https://insagirl.github.io/syncwatchdemo/syncwatch2.html'); // Example default
        }
    }


    // --- Initialization ---
    renderChannelButtons();
    renderSidebarFavorites();
    setSplitScreen(1); // Initialize with 1 screen

    // Initial Chat Iframe Source
    const lgicurl = 'https://insagirl-toto.appspot.com/chatting/lgic/'; // Base URL for chat
    const chatHash = window.location.hash && window.location.hash.substring(1) ? '#' + decodeURIComponent(window.location.hash.substring(1)) : '';
    // Don't load chat based on video hash initially, maybe based on a specific chat hash?
    // For now, load default chat without hash:
    chatIframe.src = lgicurl; // Load default chat

    // Handle initial hash for video player
    handleHashChange(); // Check hash on load


    // --- Event Listeners ---
    // Sidebar Toggle
    document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
    document.getElementById('close-sidebar-btn').addEventListener('click', () => {
        sidebar.classList.add('collapsed');
    });

    // SPOTV Toggle
    spotvToggle.addEventListener('click', toggleSpotv);

    // Split Screen Buttons
    document.getElementById('split-screen-buttons').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.split) {
            setSplitScreen(parseInt(e.target.dataset.split, 10));
        }
    });

    // Custom URL Input
    document.getElementById('play-custom-url-btn').addEventListener('click', playCustomUrl);
    customUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            playCustomUrl();
        }
    });

    // Menu Buttons
    document.getElementById('hrm-btn').addEventListener('click', () => {
        window.open('https://insagirl-toto.appspot.com/hrm/?where=1', '_blank');
    });

    document.getElementById('flow-btn').addEventListener('click', () => {
        const flowUrl = 'https://insagirl.github.io/syncwatchdemo/syncwatch2.html';
        const iframes = videoSection.querySelectorAll('iframe');
        if (iframes.length > 0) {
            // Play flow URL in all frames or just the first? Let's do first.
            playUrlInFrame(iframes[0], flowUrl);
        }
    });

    document.getElementById('refresh-btn').addEventListener('click', () => {
        const currentChatSrc = chatIframe.src.split('?')[0].split('#')[0]; // Get base URL without query/hash
        const chatHashPart = chatIframe.src.includes('#') ? '#' + chatIframe.src.split('#')[1] : '';
        chatIframe.src = `${currentChatSrc}?cache=${Math.random()}${chatHashPart}`;
    });

    // Favorite Modal Buttons
    document.getElementById('favorite-btn').addEventListener('click', () => {
        renderFavorites(); // Update list content
        favoriteModal.style.display = 'block'; // Show modal
    });
    document.getElementById('close-favorite-modal').addEventListener('click', () => {
        favoriteModal.style.display = 'none';
    });
    document.getElementById('add-favorite-btn').addEventListener('click', addFavorite);

    // Hash Change Listener
    window.addEventListener('hashchange', handleHashChange);

}); // End DOMContentLoaded
