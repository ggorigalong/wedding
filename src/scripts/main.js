// Audio control functionality
let bgm = null;
let audioToggle = null;
let isPlaying = false;

// Map functionality
let map;
const weddingLocation = {
    name: "웨딩홀 이름",
    address: "서울 용산구 용산동6가 168-6",
    lat: 37.5324, // 용산역 좌표
    lng: 126.9644
};


// Audio control functionality
function initAudioControl() {
    bgm = document.getElementById('bgm');
    audioToggle = document.getElementById('audioToggle');

    if (audioToggle) {
        audioToggle.addEventListener('click', toggleAudio);
    }
}

function toggleAudio() {
    if (!bgm) return;

    if (isPlaying) {
        bgm.pause();
        audioToggle.textContent = '🔇';
        audioToggle.classList.add('muted');
        isPlaying = false;
    } else {
        bgm.play().catch(e => {
            console.log('Audio play failed:', e);
        });
        audioToggle.textContent = '🎵';
        audioToggle.classList.remove('muted');
        isPlaying = true;
    }
}

// Copy address functionality
function copyAddress(address) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(address).then(() => {
            showCopyFeedback('주소가 복사되었습니다!');
        }).catch(err => {
            console.error('복사 실패:', err);
            fallbackCopyTextToClipboard(address, '주소가 복사되었습니다!');
        });
    } else {
        fallbackCopyTextToClipboard(address, '주소가 복사되었습니다!');
    }
}

// Copy account number functionality
function copyAccount(accountNumber) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(accountNumber).then(() => {
            showCopyFeedback();
        }).catch(err => {
            console.error('복사 실패:', err);
            fallbackCopyTextToClipboard(accountNumber);
        });
    } else {
        fallbackCopyTextToClipboard(accountNumber);
    }
}

function fallbackCopyTextToClipboard(text, message = '계좌번호가 복사되었습니다!') {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        document.execCommand('copy');
        showCopyFeedback(message);
    } catch (err) {
        console.error('Copy failed:', err);
        showCopyError();
    }

    document.body.removeChild(textArea);
}

function showCopyFeedback(message = '계좌번호가 복사되었습니다!') {
    const feedback = document.createElement('div');
    feedback.textContent = message;

    // 주소 복사인지 확인해서 다른 스타일 적용
    const isAddressCopy = message.includes('주소가');

    if (isAddressCopy) {
        feedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 25px;
            border-radius: 25px;
            z-index: 9999;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            font-family: 'Noto Sans KR', sans-serif;
        `;
    } else {
        feedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 25px;
            border-radius: 25px;
            z-index: 9999;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            font-family: 'Noto Sans KR', sans-serif;
        `;
    }

    document.body.appendChild(feedback);

    setTimeout(() => {
        if (document.body.contains(feedback)) {
            document.body.removeChild(feedback);
        }
    }, 2000);
}

function showCopyError() {
    const feedback = document.createElement('div');
    feedback.textContent = '복사에 실패했습니다. 수동으로 복사해주세요.';
    feedback.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #f44336;
        color: white;
        padding: 15px 25px;
        border-radius: 25px;
        z-index: 9999;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
        font-family: 'Noto Sans KR', sans-serif;
    `;

    document.body.appendChild(feedback);

    setTimeout(() => {
        if (document.body.contains(feedback)) {
            document.body.removeChild(feedback);
        }
    }, 3000);
}

// Map functionality - Kakao Map
function initKakaoMap() {
    const container = document.getElementById('map');
    if (!container) return;

    // 카카오 지도 API 로딩 대기
    if (typeof kakao === 'undefined' || !kakao.maps) {
        setTimeout(() => initKakaoMap(), 100);
        return;
    }

    try {
        const options = {
            center: new kakao.maps.LatLng(weddingLocation.lat, weddingLocation.lng),
            level: 3
        };

        const map = new kakao.maps.Map(container, options);

        // 마커 추가
        const markerPosition = new kakao.maps.LatLng(weddingLocation.lat, weddingLocation.lng);
        const marker = new kakao.maps.Marker({
            position: markerPosition
        });
        marker.setMap(map);

        // 정보창 추가
        const infowindow = new kakao.maps.InfoWindow({
            content: `
                <div style="
                    padding: 15px;
                    text-align: center;
                    font-family: 'Noto Sans KR', sans-serif;
                    min-width: 200px;
                ">
                    <div style="font-weight: bold; font-size: 14px; color: #333; margin-bottom: 5px;">
                        ${weddingLocation.name}
                    </div>
                    <div style="font-size: 12px; color: #666; line-height: 1.4;">
                        ${weddingLocation.address}
                    </div>
                </div>
            `
        });

        // 마커 클릭 시 정보창 열기
        kakao.maps.event.addListener(marker, 'click', function() {
            infowindow.open(map, marker);
        });

        // 기본적으로 정보창 열어놓기
        infowindow.open(map, marker);

    } catch (error) {
        console.error('카카오맵 초기화 실패:', error);
        showDemoMap();
    }
}

function showDemoMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;

    mapContainer.innerHTML = `
        <div style="
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #666;
            text-align: center;
            padding: 20px;
            box-sizing: border-box;
            border-radius: 10px;
        ">
            <div style="font-size: 2rem; margin-bottom: 10px;">📍</div>
            <div style="font-weight: bold; margin-bottom: 5px;">${weddingLocation.name}</div>
            <div style="font-size: 0.9rem; line-height: 1.4;">
                ${weddingLocation.address}<br>
                <small style="color: #999;">카카오맵 API 연결중...</small>
            </div>
        </div>
    `;
}

function openKakaoMap() {
    const url = `https://map.kakao.com/link/search/${encodeURIComponent(weddingLocation.address)}`;
    window.open(url, '_blank');
}

function openNaverMap() {
    const url = `https://map.naver.com/v5/search/${encodeURIComponent(weddingLocation.address)}`;
    window.open(url, '_blank');
}

// Smooth scrolling for internal links
function smoothScroll(target) {
    const element = document.querySelector(target);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// 수동 스크롤 시스템에서는 Intersection Observer 불필요
// 모든 애니메이션이 직접 제어됨
function initScrollAnimations() {
    // 수동 스크롤 시스템에서는 필요없음
    console.log('📢 Scroll animations handled by manual scroll system');
}

// Image lazy loading (for browsers that don't support native lazy loading)
function initLazyLoading() {
    if ('loading' in HTMLImageElement.prototype) {
        // Native lazy loading supported
        return;
    }

    const images = document.querySelectorAll('img[loading="lazy"]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.src;
                img.removeAttribute('loading');
                observer.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
}

// 새로운 수동 스크롤 시스템
import('./manualScroll.js').then(module => {
    const ManualScrollManager = module.default;
    window.manualScrollManager = new ManualScrollManager();
    window.manualScrollManager.init();
}).catch(err => {
    console.log('Manual scroll system not available:', err);
});

// 간소화된 픽셀 캐릭터 시스템
import('./simplePixelCharacter.js').then(async module => {
    const SimplePixelCharacterManager = module.default;
    window.pixelCharacterManager = new SimplePixelCharacterManager();
    await window.pixelCharacterManager.init();
    console.log('✅ Pixel character system ready with spreadsheet data');
}).catch(err => {
    console.log('Simple pixel character system not available:', err);
});

// 픽셀 캐릭터 초기화 (간소화됨)
function initPixelCharacters() {
    // 새로운 시스템에서는 자동으로 초기화됨
    console.log('✅ Simple pixel character system ready');
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎉 Wedding invitation app with manual scroll system initialized');

    // 기본 기능들 초기화
    initAudioControl();
    initKakaoMap();
    initLazyLoading();

    // 수동 스크롤 시스템은 import에서 자동 초기화됨
    // 픽셀 캐릭터 시스템도 import에서 자동 초기화됨

    // 음악 자동재생 설정
    let hasPlayed = false;
    const playAudio = () => {
        if (!hasPlayed) {
            toggleAudio();
            hasPlayed = true;
        }
    };

    document.addEventListener('click', playAudio, { once: true });
    document.addEventListener('touchstart', playAudio, { once: true });

    // Initialize gallery popup
    galleryPopup = new GalleryPopup();
    galleryPopup.init();
    console.log('🖼️ Gallery popup system initialized');

    // 시스템 준비 확인
    setTimeout(() => {
        if (window.manualScrollManager && window.pixelCharacterManager) {
            console.log('✅ All systems ready!');
            console.log('📱 Use scroll wheel, swipe, or arrow keys to navigate');

        }
    }, 1000);
})

// Guestbook Functions
function openGuestbookForm() {
    const modal = document.createElement('div');
    modal.className = 'guestbook-modal';

    const modalContent = document.createElement('div');
    modalContent.className = 'guestbook-modal-content';

    const modalHeader = document.createElement('div');
    modalHeader.className = 'guestbook-modal-header';
    modalHeader.innerHTML = '<h3>방명록 작성</h3><button class="guestbook-close-btn" onclick="closeGuestbookForm()">&times;</button>';

    const form = document.createElement('form');
    form.className = 'guestbook-form';

    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    nameGroup.innerHTML = '<label>이름</label><input type="text" id="guestbookName" placeholder="이름을 입력해주세요" required>';

    const messageGroup = document.createElement('div');
    messageGroup.className = 'form-group';
    messageGroup.innerHTML = '<label>메시지</label><textarea id="guestbookMessage" placeholder="축하 메시지를 남겨주세요" rows="4" required></textarea>';

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'form-buttons';
    buttonGroup.innerHTML = '<button type="button" class="btn-cancel" onclick="closeGuestbookForm()">취소</button><button type="submit" class="btn-submit">작성완료</button>';

    form.appendChild(nameGroup);
    form.appendChild(messageGroup);
    form.appendChild(buttonGroup);

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(form);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // 폼 제출 이벤트
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('guestbookName').value;
        const message = document.getElementById('guestbookMessage').value;

        if (name && message) {
            showCopyFeedback('방명록이 작성되었습니다!');
            closeGuestbookForm();
        }
    });
}

function closeGuestbookForm() {
    const modal = document.querySelector('.guestbook-modal');
    if (modal) {
        modal.remove();
    }
}

function openGuestbookList() {
    const modal = document.createElement('div');
    modal.className = 'guestbook-modal';

    const modalContent = document.createElement('div');
    modalContent.className = 'guestbook-modal-content large';

    const modalHeader = document.createElement('div');
    modalHeader.className = 'guestbook-modal-header';
    modalHeader.innerHTML = '<h3>방명록</h3><button class="guestbook-close-btn" onclick="closeGuestbookList()">&times;</button>';

    const guestbookList = document.createElement('div');
    guestbookList.className = 'guestbook-list';

    // 방명록 아이템들 생성
    const items = [
        { name: '김영희', date: '2024.05.20', content: '축복합니다! 두 분의 앞날에 행복만 가득하길 바랍니다.' },
        { name: '박철수', date: '2024.05.19', content: '결혼 축하해요! 행복한 가정 꾸리세요.' },
        { name: '이민정', date: '2024.05.18', content: '정말 축하드립니다! 평생 행복하게 사세요!' }
    ];

    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'guestbook-item';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'guestbook-header';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'guestbook-info';
        infoDiv.innerHTML = `<span class="guestbook-from">From. ${item.name}</span><span class="guestbook-divider">|</span><span class="guestbook-date">${item.date}</span>`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'guestbook-delete-btn';
        deleteBtn.setAttribute('onclick', `deleteGuestbook('${item.name}')`);
        deleteBtn.setAttribute('aria-label', '방명록 삭제');
        deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M20 20L4 4m16 0L4 20"></path></svg>';

        headerDiv.appendChild(infoDiv);
        headerDiv.appendChild(deleteBtn);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'guestbook-content';
        contentDiv.textContent = item.content;

        itemDiv.appendChild(headerDiv);
        itemDiv.appendChild(contentDiv);
        guestbookList.appendChild(itemDiv);
    });

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(guestbookList);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

function closeGuestbookList() {
    const modal = document.querySelector('.guestbook-modal');
    if (modal) {
        modal.remove();
    }
}

// Guestbook Delete Function
function deleteGuestbook(name) {
    const modal = document.createElement('div');
    modal.className = 'guestbook-modal';

    const modalContent = document.createElement('div');
    modalContent.className = 'guestbook-modal-content';

    const modalHeader = document.createElement('div');
    modalHeader.className = 'guestbook-modal-header';
    modalHeader.innerHTML = `<h3>방명록 삭제</h3><button class="guestbook-close-btn" onclick="closePasswordModal()">&times;</button>`;

    const passwordForm = document.createElement('form');
    passwordForm.className = 'password-form';

    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '15px';
    messageDiv.style.fontSize = '0.95rem';
    messageDiv.style.color = 'var(--text-dark)';
    messageDiv.textContent = `"${name}"님의 방명록을 삭제하시려면 비밀번호를 입력해주세요.`;

    const passwordGroup = document.createElement('div');
    passwordGroup.className = 'form-group';
    passwordGroup.innerHTML = '<label>비밀번호</label><input type="password" id="deletePassword" placeholder="비밀번호를 입력해주세요" required>';

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'form-buttons';
    buttonGroup.innerHTML = '<button type="button" class="btn-cancel" onclick="closePasswordModal()">취소</button><button type="submit" class="btn-submit">삭제</button>';

    passwordForm.appendChild(messageDiv);
    passwordForm.appendChild(passwordGroup);
    passwordForm.appendChild(buttonGroup);

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(passwordForm);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // 폼 제출 이벤트
    passwordForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const password = document.getElementById('deletePassword').value;

        // 간단한 비밀번호 체크 (실제로는 서버에서 검증해야 함)
        if (password === '1234') {
            showCopyFeedback('방명록이 삭제되었습니다.');
            closePasswordModal();
        } else {
            showCopyFeedback('비밀번호가 틀렸습니다.');
        }
    });
}

function closePasswordModal() {
    const modal = document.querySelector('.guestbook-modal');
    if (modal) {
        modal.remove();
    }
}

// 전역 함수로 등록
window.openGuestbookForm = openGuestbookForm;
window.closeGuestbookForm = closeGuestbookForm;
window.openGuestbookList = openGuestbookList;
window.closeGuestbookList = closeGuestbookList;
window.deleteGuestbook = deleteGuestbook;
window.closePasswordModal = closePasswordModal;

// Handle visibility change (pause music when tab is not active)
document.addEventListener('visibilitychange', function() {
    if (!bgm) return;

    if (document.hidden && isPlaying) {
        bgm.pause();
    } else if (!document.hidden && isPlaying) {
        bgm.play().catch(e => console.log('Resume play failed:', e));
    }
});

// 갤러리 위치 계산 함수
function getGalleryDimensions() {
    const gallery = document.querySelector('.gallery');
    const galleryGrid = document.querySelector('.gallery-grid');
    const galleryImage = document.querySelector('.gallery-item img');

    if (!gallery) return null;

    const galleryRect = gallery.getBoundingClientRect();
    const gridRect = galleryGrid ? galleryGrid.getBoundingClientRect() : null;
    const imageRect = galleryImage ? galleryImage.getBoundingClientRect() : null;

    // transform 값 고려하여 실제 위치 계산
    const computedStyle = window.getComputedStyle(gallery);
    const transform = computedStyle.transform;

    let actualTop = galleryRect.top;
    if (transform && transform !== 'none') {
        // transform matrix에서 translateY 값 추출
        const matrix = new DOMMatrixReadOnly(transform);
        actualTop += matrix.m42; // translateY 값
    }

    const dimensions = {
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        },
        gallery: {
            top: actualTop,
            bottom: actualTop + galleryRect.height,
            left: galleryRect.left,
            right: galleryRect.right,
            width: galleryRect.width,
            height: galleryRect.height,
            transform: computedStyle.transform
        }
    };

    if (gridRect) {
        dimensions.grid = {
            top: gridRect.top,
            bottom: gridRect.bottom,
            left: gridRect.left,
            right: gridRect.right,
            width: gridRect.width,
            height: gridRect.height
        };
    }

    if (imageRect) {
        dimensions.image = {
            top: imageRect.top,
            bottom: imageRect.bottom,
            left: imageRect.left,
            right: imageRect.right,
            width: imageRect.width,
            height: imageRect.height
        };
    }

    return dimensions;
}

// 갤러리 사진 영역만 계산하는 함수
function getGalleryImagePosition() {
    const galleryImage = document.querySelector('.gallery-item img');
    const galleryGrid = document.querySelector('.gallery-grid');

    if (!galleryImage || !galleryGrid) return null;

    const imageRect = galleryImage.getBoundingClientRect();
    const gridRect = galleryGrid.getBoundingClientRect();

    return {
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        },
        imageArea: {
            top: imageRect.top,
            bottom: imageRect.bottom,
            left: imageRect.left,
            right: imageRect.right,
            width: imageRect.width,
            height: imageRect.height
        },
        gridContainer: {
            top: gridRect.top,
            bottom: gridRect.bottom,
            left: gridRect.left,
            right: gridRect.right,
            width: gridRect.width,
            height: gridRect.height
        }
    };
}

// 갤러리 사진 위치 로그 출력 함수
function logGalleryImagePosition() {
    const position = getGalleryImagePosition();
    if (position) {
        console.log('🖼️ Gallery Image Position:', position);
        console.log(`📍 Image Top: ${position.imageArea.top}px (${(position.imageArea.top / position.viewport.height * 100).toFixed(1)}%)`);
        console.log(`📍 Image Bottom: ${position.imageArea.bottom}px (${(position.imageArea.bottom / position.viewport.height * 100).toFixed(1)}%)`);
        console.log(`📏 Image Height: ${position.imageArea.height}px`);
    }
    return position;
}


// Gallery popup system
class GalleryPopup {
    constructor() {
        this.overlay = null;
        this.image = null;
        this.loading = null;
        this.prevBtn = null;
        this.nextBtn = null;
        this.closeBtn = null;
        this.counter = null;
        this.currentIndex = 0;
        this.images = [];
        this.isOpen = false;
        this.isLoading = false;
    }

    init() {
        this.overlay = document.getElementById('galleryOverlay');
        this.image = document.getElementById('galleryImage');
        this.loading = document.getElementById('galleryLoading');
        this.prevBtn = document.getElementById('galleryPrev');
        this.nextBtn = document.getElementById('galleryNext');
        this.closeBtn = document.getElementById('galleryClose');
        this.counter = document.getElementById('galleryCounter');

        // Get all gallery images
        this.images = Array.from(document.querySelectorAll('.gallery-item img'));

        // Add click listeners to gallery items
        this.images.forEach((img, index) => {
            img.addEventListener('click', () => this.openGallery(index));
            img.style.cursor = 'pointer';
        });

        // Add navigation listeners
        this.prevBtn?.addEventListener('click', () => this.prevImage());
        this.nextBtn?.addEventListener('click', () => this.nextImage());
        this.closeBtn?.addEventListener('click', () => this.closeGallery());

        // Click overlay to close
        this.overlay?.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.closeGallery();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;

            switch(e.key) {
                case 'Escape':
                    this.closeGallery();
                    break;
                case 'ArrowLeft':
                    this.prevImage();
                    break;
                case 'ArrowRight':
                    this.nextImage();
                    break;
            }
        });

        // Touch/swipe navigation for mobile
        this.initTouchNavigation();
    }

    initTouchNavigation() {
        let startX = 0;
        let endX = 0;
        const minSwipeDistance = 50;

        this.image?.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        }, { passive: true });

        this.image?.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scrolling
        });

        this.image?.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            const distance = startX - endX;

            if (Math.abs(distance) > minSwipeDistance) {
                if (distance > 0) {
                    this.nextImage();
                } else {
                    this.prevImage();
                }
            }
        }, { passive: true });

        // Mouse wheel navigation
        this.overlay?.addEventListener('wheel', (e) => {
            if (!this.isOpen) return;
            e.preventDefault();

            if (e.deltaY > 0) {
                this.nextImage();
            } else {
                this.prevImage();
            }
        }, { passive: false });
    }

    openGallery(index) {
        this.currentIndex = index;
        this.isOpen = true;
        this.showImage();
        this.overlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeGallery() {
        this.isOpen = false;
        this.overlay?.classList.remove('active');
        document.body.style.overflow = '';
    }

    nextImage() {
        if (this.isLoading) return;
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this.showImage();
    }

    prevImage() {
        if (this.isLoading) return;
        this.currentIndex = this.currentIndex === 0 ? this.images.length - 1 : this.currentIndex - 1;
        this.showImage();
    }

    showImage() {
        if (!this.images[this.currentIndex]) return;

        this.isLoading = true;
        this.loading.style.display = 'block';
        this.image.style.opacity = '0.5';

        const currentImage = this.images[this.currentIndex];
        const newSrc = currentImage.src;

        // Preload image for smooth transition
        const preloadImg = new Image();
        preloadImg.onload = () => {
            this.image.src = newSrc;
            this.image.alt = currentImage.alt;
            this.loading.style.display = 'none';
            this.image.style.opacity = '1';
            this.isLoading = false;
            this.updateCounter();
        };

        preloadImg.onerror = () => {
            console.error('Failed to load image:', newSrc);
            this.loading.style.display = 'none';
            this.image.style.opacity = '1';
            this.isLoading = false;
        };

        preloadImg.src = newSrc;

        // Preload next and previous images for performance
        this.preloadAdjacentImages();
    }

    preloadAdjacentImages() {
        const nextIndex = (this.currentIndex + 1) % this.images.length;
        const prevIndex = this.currentIndex === 0 ? this.images.length - 1 : this.currentIndex - 1;

        // Preload next image
        if (this.images[nextIndex]) {
            const nextPreload = new Image();
            nextPreload.src = this.images[nextIndex].src;
        }

        // Preload previous image
        if (this.images[prevIndex]) {
            const prevPreload = new Image();
            prevPreload.src = this.images[prevIndex].src;
        }
    }

    updateCounter() {
        if (this.counter) {
            this.counter.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
        }
    }
}

// Initialize gallery popup
let galleryPopup = null;

// Make functions globally available for onclick handlers
window.copyAddress = copyAddress;
window.copyAccount = copyAccount;
window.openKakaoMap = openKakaoMap;
window.openNaverMap = openNaverMap;
window.smoothScroll = smoothScroll;
window.getGalleryDimensions = getGalleryDimensions;
window.getGalleryImagePosition = getGalleryImagePosition;
window.logGalleryImagePosition = logGalleryImagePosition;