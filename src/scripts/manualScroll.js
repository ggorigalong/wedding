// 완전 수동 스크롤 시스템
// 모든 섹션을 Y축 transform으로 직접 제어

class ManualScrollManager {
    constructor() {
        this.currentSection = 0; // 현재 섹션 인덱스 (0: hero, 1: section1 animation, 2: idle/run area)
        this.maxSections = 8; // 총 섹션 수 (section-0,1,2,3,5,6,7,8 - section-4 제외)
        this.isTransitioning = false; // 전환 중 여부
        this.isAnimationLocked = false; // 애니메이션 재생 중 잠금
        this.scrollSensitivity = 50; // 스크롤 감도
        this.virtualScrollY = 0; // 가상 스크롤 위치 (0~100vh 단위)
        this.characterScrollProgress = 0; // section-2에서 캐릭터 Y축 진행도
        this.section3ScrollProgress = 0; // section-3에서 캐릭터 Y축 진행도

        // 디바이스별 스크롤 속도 설정
        this.trackpadSpeed = 6; // 트랙패드 속도 (더 느리게)
        this.touchSpeed = 10; // 터치 속도 (절반으로 감소)
        this.keyboardSpeed = 12.5; // 키보드 속도 (기존 유지)

        // 섹션 정보 (Section-4 제거됨)
        this.sections = [
            { id: 'section-0', element: null, targetY: 0 },
            { id: 'section-1', element: null, targetY: 0 },
            { id: 'section-2', element: null, targetY: 0 },
            { id: 'section-3', element: null, targetY: 0 },
            { id: 'section-5', element: null, targetY: 0 },
            { id: 'section-6', element: null, targetY: 0 },
            { id: 'section-7', element: null, targetY: 0 },
            { id: 'section-8', element: null, targetY: 0 }
        ];

        // 터치 관련 변수
        this.touchStartY = 0;
        this.touchEndY = 0;
        this.touchLastY = 0; // 이전 터치 위치 (실시간 이동용)
        this.isTouching = false; // 터치 중 여부
        this.minSwipeDistance = 50; // 최소 스와이프 거리

        // 관성 스크롤 관련 변수
        this.touchVelocity = 0; // 터치 속도
        this.lastTouchTime = 0; // 마지막 터치 시간
        this.momentumAnimation = null; // 관성 애니메이션 ID

        // 스크롤 잠금 관련
        this.scrollLocked = false; // 스크롤 잠금 상태
        this.lockReason = ''; // 잠금 이유
        this.isLoading = false; // 로딩 중 여부
    }

    init() {
        this.setupSections();
        this.setupEventListeners();
        this.handleQueryString(); // 쿼리스트링 처리

        // 섹션 4에 있다면 섹션 0으로 강제 이동 (URL 기능은 유지)
        if (this.currentSection === 4) {
            console.log('🚨 Detected section 4, moving to section 0');
            this.currentSection = 0;
            this.virtualScrollY = 0;
            // URL에서 섹션 4 제거
            window.history.replaceState({}, '', window.location.pathname);
        }

        this.updateSectionPositions();

        // 섹션 4일 때만 강제로 섹션 0으로 이동
        setTimeout(() => {
            if (this.currentSection === 4) {
                console.log(`🔧 Force moving to section 0 from section 4`);
                this.goToSection(0);
            }
        }, 100);

        console.log(`🎮 Manual Scroll System initialized - Current section: ${this.currentSection}`);
    }

    // 모든 섹션 요소 가져오기
    setupSections() {
        this.sections.forEach(section => {
            section.element = document.getElementById(section.id);
            if (!section.element) {
                console.warn(`⚠️ Section ${section.id} not found`);
            }
        });
    }

    // 쿼리스트링 처리 (예: ?section=3)
    handleQueryString() {
        const urlParams = new URLSearchParams(window.location.search);
        const targetSection = urlParams.get('section');

        if (targetSection !== null) {
            const sectionNumber = parseInt(targetSection);
            if (sectionNumber >= 0 && sectionNumber <= this.maxSections) {
                console.log(`🔗 Query string detected: starting from section ${sectionNumber}`);
                this.currentSection = sectionNumber;
                this.virtualScrollY = sectionNumber * 100;

                // 섹션별 초기 상태 설정
                setTimeout(() => {
                    this.initializeSectionState(sectionNumber);
                }, 100);
            } else {
                console.warn(`⚠️ Invalid section number in query string: ${targetSection}`);
            }
        }
    }

    // 섹션별 초기 상태 설정
    initializeSectionState(sectionNumber) {
        if (sectionNumber === 0) {
            // Section-0: Hero - 아무것도 안함
            console.log('🏠 Starting from Hero section');
        } else if (sectionNumber === 1) {
            // Section-1: 메인 애니메이션 완료 상태로 시작
            console.log('🎬 Starting from Section-1 (animation completed state)');
        } else if (sectionNumber === 5) {
            // Section-5: 슬라임 애니메이션 표시
            console.log(`🟢 Starting from Section-5 with slime animation`);
            if (window.pixelCharacterManager) {
                window.pixelCharacterManager.switchToSlimeState();
            }
        } else if (sectionNumber >= 2) {
            // Section-2 이상: 캐릭터 표시
            console.log(`🏃 Starting from Section-${sectionNumber} with character`);
            if (window.pixelCharacterManager) {
                const startHeight = sectionNumber === 2 ? 60 : -25;
                window.pixelCharacterManager.switchToSectionState(sectionNumber, startHeight);
            }
        }
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 마우스 휠 이벤트
        document.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        // 터치 이벤트 (모바일 스와이프)
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });

        // 키보드 이벤트
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // 네이티브 스크롤 완전 차단
        document.addEventListener('scroll', (e) => {
            window.scrollTo(0, 0);
            e.preventDefault();
        }, { passive: false });
    }

    // 마우스 휠 처리
    handleWheel(e) {
        e.preventDefault();

        if (this.isTransitioning) return;

        const delta = e.deltaY;
        this.handleScrollDelta(delta, 'trackpad');
    }

    // 터치 시작
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            this.touchStartY = e.touches[0].clientY;
            this.touchLastY = e.touches[0].clientY; // 실시간 이동용 초기화
            this.isTouching = true;

            // 관성 애니메이션 중단
            if (this.momentumAnimation) {
                cancelAnimationFrame(this.momentumAnimation);
                this.momentumAnimation = null;
            }

            this.touchVelocity = 0;
            this.lastTouchTime = Date.now();
        }
    }

    // 터치 이동 (실시간 스크롤 처리)
    handleTouchMove(e) {
        e.preventDefault(); // 네이티브 스크롤 방지

        if (!this.isTouching || e.touches.length !== 1) return;

        const currentY = e.touches[0].clientY;
        const currentTime = Date.now();
        const delta = this.touchLastY - currentY; // 이전 프레임 대비 이동량

        // 실시간으로 스크롤 처리
        if (Math.abs(delta) > 1) { // 최소 1px 이상 이동시만
            this.handleScrollDelta(delta, 'touch');

            // 속도 계산 (픽셀/밀리초)
            const timeDiff = currentTime - this.lastTouchTime;
            if (timeDiff > 0) {
                this.touchVelocity = delta / timeDiff;
            }

            this.touchLastY = currentY; // 현재 위치를 이전 위치로 업데이트
            this.lastTouchTime = currentTime;
        }
    }

    // 터치 종료 (관성 스크롤 활성화 - 미끄러지는 효과)
    handleTouchEnd(e) {
        this.isTouching = false;
        this.touchEndY = e.changedTouches[0].clientY;

        // 관성 스크롤 시작 (속도가 충분히 클 때만)
        if (Math.abs(this.touchVelocity) > 0.1) {
            this.startMomentumScroll();
            console.log('👆 Touch ended - starting momentum scroll');
        } else {
            console.log('👆 Touch ended - no momentum (velocity too low)');
        }
    }

    // 키보드 처리 (방향키 + 숫자키)
    handleKeyboard(e) {
        if (this.isTransitioning) return;

        switch(e.key) {
            case 'ArrowDown':
            case 'PageDown':
                e.preventDefault();
                this.handleScrollDelta(12.5, 'keyboard'); // 4배 느린 정규화된 속도
                break;
            case 'ArrowUp':
            case 'PageUp':
                e.preventDefault();
                this.handleScrollDelta(-12.5, 'keyboard'); // 4배 느린 정규화된 속도
                break;
            // 숫자키로 직접 섹션 이동 (개발용)
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
                const sectionNumber = parseInt(e.key);
                if (sectionNumber <= this.maxSections) {
                    e.preventDefault();
                    console.log(`⌨️ Keyboard shortcut: jumping to section ${sectionNumber}`);
                    this.goToSection(sectionNumber);
                }
                break;
        }
    }

    // 스크롤 델타 처리 (공통 로직)
    handleScrollDelta(delta, inputType = 'unknown') {
        // 애니메이션 재생 중에는 스크롤 차단
        if (this.isAnimationLocked) {
            console.log('🔒 Scroll blocked - animation playing');
            return;
        }

        // 초기 로딩 스크린이 있으면 스크롤 차단
        const initialLoading = document.getElementById('initial-loading');
        const pixelLoading = window.pixelCharacterManager?.isLoadingSection1Data;
        const pixelNotInitialized = !window.pixelCharacterManager?.isFullyInitialized;

        if (this.isTransitioning || this.scrollLocked || this.isLoading || pixelLoading || initialLoading || pixelNotInitialized) {
            const reason = initialLoading ? 'initial loading' :
                          this.isTransitioning ? 'transitioning' :
                          this.isLoading || pixelLoading ? 'data loading' :
                          pixelNotInitialized ? 'system initializing' :
                          `locked (${this.lockReason})`;
            console.log(`🔒 Scroll blocked - ${reason}`);
            return;
        }

        // 디바이스별 속도 설정
        let speed;
        switch(inputType) {
            case 'trackpad':
                speed = this.trackpadSpeed;
                break;
            case 'touch':
                speed = this.touchSpeed;
                break;
            case 'keyboard':
                speed = this.keyboardSpeed;
                break;
            default:
                speed = this.trackpadSpeed; // 기본값은 트랙패드
        }

        // 일정한 속도로 정규화 (디바이스별 다른 속도)
        const scrollDirection = delta > 0 ? 'down' : 'up';
        const normalizedDelta = scrollDirection === 'down' ? speed : -speed;
        const scrollMagnitude = Math.abs(normalizedDelta);

        console.log(`🔄 Scroll: ${scrollDirection} (${inputType}: ${scrollMagnitude}), Section: ${this.currentSection}`);

        // 섹션별 특별 처리
        if (this.currentSection === 0) {
            // Section-0 (Hero): 아래로만 Section-1 애니메이션 트리거
            if (scrollDirection === 'down' && scrollMagnitude > 5) {
                this.triggerSection1Transition();
            }
            // 위로는 스크롤 불가 (최상단)
        } else if (this.currentSection === 1) {
            // Section-1: 아래로만 캐릭터 이동, 위로는 직접 전환 (애니메이션 재실행 방지)
            if (scrollDirection === 'down') {
                this.handleCharacterMovement(normalizedDelta, this.currentSection);
            } else {
                // 위로는 바로 Section-0로 전환
                this.goToSection(0);
            }
        } else if (this.currentSection === 5) {
            // Section-5: 슬라임 애니메이션 (idle/run 정책 적용)
            this.handleCharacterMovement(normalizedDelta, this.currentSection);
        } else if (this.currentSection >= 2) {
            // Section-2부터는 모든 섹션에서 캐릭터 Y축 이동 (Section-5 제외)
            this.handleCharacterMovement(normalizedDelta, this.currentSection);
        } else {
            // 기타 섹션들은 일반적인 섹션 전환
            const targetSection = scrollDirection === 'down' ?
                this.currentSection + 1 : this.currentSection - 1;

            if (targetSection >= 0 && targetSection <= this.maxSections) {
                this.goToSection(targetSection);
            }
        }
    }

    // 특정 섹션으로 이동
    goToSection(sectionIndex) {
        if (sectionIndex < 0 || sectionIndex > this.maxSections || this.isTransitioning) {
            return;
        }

        console.log(`🚀 Moving to section ${sectionIndex} from ${this.currentSection}`);

        this.isTransitioning = true;
        this.currentSection = sectionIndex;
        this.virtualScrollY = sectionIndex * 100; // 스크롤 위치도 조정

        // URL 업데이트 (히스토리 추가하지 않고)
        this.updateURL(sectionIndex);

        // 모든 섹션의 위치 업데이트
        this.updateSectionPositions();

        // 캐릭터 전환 애니메이션 트리거
        this.triggerCharacterTransition();

        // 전환 완료 후 잠금 해제 (즉시)
        setTimeout(() => {
            this.isTransitioning = false;
        }, 50); // 즉시 해제 (약간의 딜레이만)
    }

    // URL 업데이트 (쿼리스트링 업데이트 비활성화)
    updateURL(sectionIndex) {
        // 쿼리스트링 업데이트 비활성화 - 개발 편의를 위해서만 유지
        // console.log(`🔗 URL update skipped for section ${sectionIndex}`);
        return; // 아무것도 하지 않음
    }

    // 모든 섹션의 Y축 위치 업데이트
    updateSectionPositions() {
        // 현재 섹션의 배열 인덱스 찾기
        const currentSectionIndex = this.sections.findIndex(section =>
            section.id === `section-${this.currentSection}`);

        this.sections.forEach((section, index) => {
            if (!section.element) return;

            // 현재 섹션을 기준으로 상대적 위치 계산 (배열 인덱스 기준)
            const relativePosition = index - currentSectionIndex;
            const targetY = relativePosition * 100; // 100vh 단위

            // Y축 transform 적용
            section.element.style.transform = `translateY(${targetY}vh)`;
            section.targetY = targetY;

            console.log(`📍 Section ${section.id} (index ${index}): translateY(${targetY}vh)`);
        });

        // Section-8 접근시 특별 애니메이션
        if (this.currentSection === 8) {
            this.triggerSection8Animation();
        }
    }

    // Section-8 지진 및 enemy-hit 애니메이션
    triggerSection8Animation() {
        // 스크롤 잠금
        this.scrollLocked = true;
        this.lockReason = 'Section8 animation sequence';
        console.log('🔒 Scroll locked for Section8 animation');

        // enemy_run 애니메이션 트리거
        const pixelManager = window.pixelCharacterManager ||
                           window.SimplePixelCharacterManager ||
                           document.querySelector('#pixel-character-container')?.__pixelManager;

        if (pixelManager && pixelManager.triggerEnemyRun) {
            pixelManager.triggerEnemyRun();
        } else if (window.pixelCharacterManager) {
            window.pixelCharacterManager.triggerEnemyRun();
        } else {
            // pixelCharacterManager가 없으면 임시 애니메이션 실행
            this.createTemporaryEnemyRun();
        }
    }

    // JavaScript 지진 효과
    triggerEarthquakeEffect() {
        const duration = 500;
        const strength = 50;

        const body = document.body;
        const start = performance.now();

        const shake = (now) => {
            const elapsed = now - start;

            if (elapsed < duration) {
                const decay = 1 - elapsed / duration;

                const x = Math.round((Math.random() - 0.5) * strength * decay);
                const y = Math.round((Math.random() - 0.5) * strength * decay);

                const rotate = (Math.random() - 0.5) * 2 * decay;

                body.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg)`;

                requestAnimationFrame(shake);
            } else {
                body.style.transform = "";
                // 지진 완료 후 스크롤 잠금 해제
                this.scrollLocked = false;
                this.lockReason = '';
                console.log('🔓 Scroll unlocked after Section8 animation complete');

                // 캐릭터 애니메이션을 leafsflowerdouble 버전으로 변경
                this.switchToLeafsFlowerDouble();
            }
        };

        requestAnimationFrame(shake);
    }

    // 캐릭터를 leafsflowerdouble 버전으로 전환
    switchToLeafsFlowerDouble() {
        console.log('🌸 Switching character animations to leafsflowerdouble version');

        const pixelManager = window.pixelCharacterManager ||
                           window.SimplePixelCharacterManager ||
                           document.querySelector('#pixel-character-container')?.__pixelManager;

        if (pixelManager && pixelManager.switchAnimationSet) {
            pixelManager.switchAnimationSet('leafsflowerdouble');
        } else if (pixelManager) {
            // leafsflowerdouble 플래그 설정
            pixelManager.hasLeafsFlowerDouble = true;
            console.log('🌸✨ LeafsFlowerDouble flag activated in manualScroll!');

            // 현재 상태 다시 적용하여 새 애니메이션으로 전환
            if (pixelManager.currentState === 'idle' || pixelManager.currentState === 'run') {
                const currentState = pixelManager.currentState;
                pixelManager.switchToState(currentState);
            }

            console.log('🌸 LeafsFlowerDouble upgrade completed from manualScroll');
        } else {
            console.log('⚠️ PixelCharacterManager not found, cannot switch animation set');
        }
    }

    // 로딩 상태 설정
    setLoadingState(loading) {
        this.isLoading = loading;
        console.log(`${loading ? '⏳' : '✅'} Loading state: ${loading}`);

        if (loading) {
            this.showLoadingMessage();
        } else {
            this.hideLoadingMessage();
            this.showScrollGuide();
        }
    }

    // 로딩 메시지 표시
    showLoadingMessage() {
        // 기존 로딩 메시지 제거
        const existing = document.getElementById('loading-message');
        if (existing) existing.remove();

        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-message';
        loadingDiv.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 20px 30px;
                border-radius: 10px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 16px;
                z-index: 10000;
                text-align: center;
                backdrop-filter: blur(5px);
            ">
                <div style="margin-bottom: 10px;">⏳ Loading...</div>
                <div style="font-size: 14px; opacity: 0.8;">잠시만 기다려주세요</div>
            </div>
        `;
        document.body.appendChild(loadingDiv);
    }

    // 로딩 메시지 숨기기
    hideLoadingMessage() {
        // HTML의 초기 로딩 스크린 제거
        const initialLoading = document.getElementById('initial-loading');
        if (initialLoading) {
            initialLoading.remove();
        }

        // JavaScript로 생성된 로딩 메시지도 제거
        const loadingDiv = document.getElementById('loading-message');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    // 스크롤 가이드 표시
    showScrollGuide() {
        setTimeout(() => {
            // 기존 가이드 제거
            const existing = document.getElementById('scroll-guide');
            if (existing) existing.remove();

            const guideDiv = document.createElement('div');
            guideDiv.id = 'scroll-guide';
            guideDiv.innerHTML = `
                <div style="
                    position: fixed;
                    bottom: 30px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(255,255,255,0.9);
                    color: #333;
                    padding: 15px 25px;
                    border-radius: 25px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    font-size: 14px;
                    z-index: 9999;
                    text-align: center;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    animation: bounceIn 0.8s ease-out, fadeOut 3s ease-in 2s forwards;
                ">
                    <div style="margin-bottom: 5px;">↓</div>
                    <div>스크롤해주세요</div>
                </div>
                <style>
                    @keyframes bounceIn {
                        0% { transform: translateX(-50%) scale(0.3); opacity: 0; }
                        50% { transform: translateX(-50%) scale(1.05); opacity: 1; }
                        70% { transform: translateX(-50%) scale(0.9); }
                        100% { transform: translateX(-50%) scale(1); }
                    }
                    @keyframes fadeOut {
                        0% { opacity: 1; }
                        100% { opacity: 0; visibility: hidden; }
                    }
                </style>
            `;
            document.body.appendChild(guideDiv);

            // 5초 후 제거
            setTimeout(() => {
                if (guideDiv.parentNode) {
                    guideDiv.remove();
                }
            }, 5000);
        }, 500);
    }

    // 임시 enemy-hit 애니메이션 (pixelCharacterManager 없을 때)
    createTemporaryEnemyRun() {
        console.log('🏃 Creating temporary enemy_run animation');

        const enemyRunElement = document.createElement('img');
        const charSize = 96; // 32px * 3 scale
        enemyRunElement.style.position = 'fixed';
        enemyRunElement.style.left = '50%';
        enemyRunElement.style.top = '10vh';
        enemyRunElement.style.width = `${charSize}px`;
        enemyRunElement.style.height = `${charSize}px`;
        enemyRunElement.style.transform = 'translateX(-50%)';
        enemyRunElement.style.imageRendering = 'pixelated';
        enemyRunElement.style.imageRendering = '-moz-crisp-edges';
        enemyRunElement.style.imageRendering = 'crisp-edges';
        enemyRunElement.style.zIndex = '99999';
        enemyRunElement.style.opacity = '1';
        enemyRunElement.style.pointerEvents = 'none';

        let currentFrame = 1;
        const totalFrames = 6; // enemy_run1.png ~ enemy_run6.png
        const frameInterval = 100; // 100ms 간격
        let currentY = 10; // 10vh에서 시작

        const animate = () => {
            // 프레임 업데이트
            const imagePath = `/animation/enemy_run/enemy_run${currentFrame}.png`;
            enemyRunElement.src = imagePath;

            // 위로 이동 (매 프레임마다 1vh씩 위로)
            currentY -= 1;
            enemyRunElement.style.top = `${currentY}vh`;

            // 화면 위쪽으로 완전히 사라지면 enemy-hit 시퀀스 실행
            if (currentY < -15) {
                // enemy-run 애니메이션 제거
                if (enemyRunElement.parentNode) {
                    enemyRunElement.parentNode.removeChild(enemyRunElement);
                }
                // enemy-hit 시퀀스 실행
                this.triggerEnemyHitSequenceTemp();
                return;
            }

            // 다음 프레임으로
            currentFrame++;
            if (currentFrame > totalFrames) {
                currentFrame = 1;
            }

            // 다음 프레임 스케줄링 (계속 반복)
            setTimeout(animate, frameInterval);
        };

        document.body.appendChild(enemyRunElement);
        animate(); // 첫 프레임 시작
    }

    // 임시 Enemy Hit 시퀀스 (pixelCharacterManager 없을 때)
    triggerEnemyHitSequenceTemp() {
        console.log('💥 Starting temporary enemy-hit sequence');

        const positions = [
            { top: '0vh', image: 1 },      // 화면 최상단
            { top: '70vh', image: 2 },     // 70vh 위치
            { top: '100vh', image: 3 }     // 화면 맨끝
        ];

        let currentIndex = 0;
        const frameInterval = 25; // 더 빠른 프레임 (50ms)

        const showNextHit = () => {
            if (currentIndex >= positions.length) {
                // 모든 enemy-hit 완료 후 지진 효과
                console.log('💥 Enemy-hit sequence completed, starting earthquake');
                this.triggerEarthquakeEffect();
                return;
            }

            const pos = positions[currentIndex];
            this.createEnemyHitElementTemp(pos.top, pos.image);
            currentIndex++;

            // 다음 hit을 스케줄링
            setTimeout(showNextHit, frameInterval);
        };

        // 시퀀스 시작
        showNextHit();
    }

    // 임시 개별 Enemy Hit 엘리먼트 생성
    createEnemyHitElementTemp(topPosition, imageNumber) {
        const enemyHitElement = document.createElement('img');
        enemyHitElement.src = `/animation/enemy-hit/enemy-hit${imageNumber}.png`;
        enemyHitElement.style.position = 'fixed';
        enemyHitElement.style.left = '50%';
        enemyHitElement.style.top = topPosition;
        enemyHitElement.style.width = '96px'; // enemy_run과 동일한 크기
        enemyHitElement.style.height = '96px';
        enemyHitElement.style.transform = 'translateX(-50%)';
        enemyHitElement.style.imageRendering = 'pixelated';
        enemyHitElement.style.imageRendering = '-moz-crisp-edges';
        enemyHitElement.style.imageRendering = 'crisp-edges';
        enemyHitElement.style.zIndex = '99999';
        enemyHitElement.style.opacity = '1';
        enemyHitElement.style.pointerEvents = 'none';

        document.body.appendChild(enemyHitElement);

        // 25ms 후 제거 (다음 hit이 나오기 전에 제거)
        setTimeout(() => {
            if (enemyHitElement.parentNode) {
                enemyHitElement.parentNode.removeChild(enemyHitElement);
            }
        }, 25);

        console.log(`💥 Enemy-hit${imageNumber} displayed at ${topPosition}`);
    }

    // 캐릭터 위치 업데이트 (현재 섹션 내에서의 미세한 움직임)
    updateCharacterPosition() {
        // 픽셀 캐릭터 매니저와 연동
        if (window.pixelCharacterManager) {
            const sectionProgress = (this.virtualScrollY % 100) / 100; // 0~1
            window.pixelCharacterManager.updateCharacterByManualScroll(sectionProgress);
        }
    }

    // 캐릭터 전환 애니메이션 트리거
    triggerCharacterTransition() {
        if (window.pixelCharacterManager) {
            if (this.currentSection === 5) {
                // Section-5로 전환시 슬라임 상태로
                window.pixelCharacterManager.switchToSlimeState();
            } else {
                // 다른 섹션은 기본 전환
                window.pixelCharacterManager.handleSectionTransition(this.currentSection);
            }
        }
    }

    // Section-0에서 Section-1으로의 특별 전환
    triggerSection1Transition() {
        console.log('🎬 Triggering Section-1 main animation');

        // 섹션 이동
        this.goToSection(1);

        // 애니메이션 잠금 활성화
        this.isAnimationLocked = true;

        // 픽셀 캐릭터 매니저에 메인 애니메이션 시작 요청
        if (window.pixelCharacterManager && window.pixelCharacterManager.characters && window.pixelCharacterManager.characters.has('main')) {
            window.pixelCharacterManager.playMainAnimation(() => {
                // 애니메이션 완료 콜백
                console.log('🎉 Section-1 animation completed, moving to Section-2');

                // 애니메이션 잠금 해제
                this.isAnimationLocked = false;

                // Section-2로 자동 이동 (캐릭터 시작)
                this.goToSection(2);

                // Section-2에서 idle 상태로 시작 (60% 높이에서)
                if (window.pixelCharacterManager) {
                    window.pixelCharacterManager.switchToSectionState(2, 60);
                }
            });
        } else {
            console.error('❌ PixelCharacterManager or main character not ready - cannot play main animation');
            console.log('Debug info:', {
                pixelManager: !!window.pixelCharacterManager,
                characters: !!window.pixelCharacterManager?.characters,
                hasMain: window.pixelCharacterManager?.characters?.has('main')
            });

            // 초기화가 안된 경우 약간 기다렸다가 재시도
            setTimeout(() => {
                if (window.pixelCharacterManager?.characters?.has('main')) {
                    console.log('🔄 Retrying main animation after delay...');
                    window.pixelCharacterManager.playMainAnimation(() => {
                        this.isAnimationLocked = false;
                        this.goToSection(2);
                    });
                } else {
                    console.error('❌ Still cannot start main animation, unlocking manually');
                    this.isAnimationLocked = false;
                    this.goToSection(2);
                }
            }, 500);
        }
    }

    // 모든 섹션에서 캐릭터 Y축 이동 처리
    handleCharacterMovement(delta, currentSectionIndex) {
        // 섹션별로 개별 진행도 관리
        const sectionKey = `section${currentSectionIndex}ScrollProgress`;
        if (!this[sectionKey]) {
            this[sectionKey] = 0;
        }

        // 스크롤 방향에 따라 해당 섹션의 Y축 진행도 업데이트 (4배 더 느리게)
        this[sectionKey] += delta * 0.002; // 0.002 → 0.0005 (4배 감소)
        this[sectionKey] = Math.max(-0.3, Math.min(1.5, this[sectionKey])); // -0.3~1.5 범위 (위로도 이동 가능)

        console.log(`🏃 Section-${currentSectionIndex} Character Y progress: ${(this[sectionKey] * 100).toFixed(1)}%`);

        // 포털 시스템: 아래로 1.2 이상이면 다음 섹션으로, 위로 -0.2 이하면 이전 섹션으로
        if (this[sectionKey] >= 1.2) {
            console.log(`🚪 Character reached bottom portal (120%) - moving to Section-${currentSectionIndex + 1}`);
            this.triggerPortalTransition(currentSectionIndex, 'down');
            return;
        } else if (this[sectionKey] <= -0.2 && currentSectionIndex >= 1) {
            console.log(`🚪 Character reached top portal (-20%) - moving to Section-${currentSectionIndex - 1}`);

            // Section-1에서 위로 가는 경우 특별 처리 (Section-0로 바로 전환)
            if (currentSectionIndex === 1) {
                this.goToSection(0);
                this[sectionKey] = 0; // 진행도 리셋
            } else {
                this.triggerPortalTransition(currentSectionIndex, 'up');
            }
            return;
        }

        // 픽셀 캐릭터 매니저에 움직임 알림
        if (window.pixelCharacterManager) {
            const startHeight = currentSectionIndex === 2 ? 60 : -25; // Section-2는 60%, 나머지는 상단 바깥(-25%)
            window.pixelCharacterManager.updateSectionMovement(delta, this[sectionKey], currentSectionIndex, startHeight);
        }
    }

    // 포털 전환 (섹션간 이동) - 위/아래 방향 지원
    triggerPortalTransition(fromSection, direction = 'down') {
        if (this.isTransitioning) return;

        // Section-3에서 Section-5로 직접 이동 (Section-4 스킵)
        let targetSection;
        if (direction === 'down') {
            if (fromSection === 3) {
                targetSection = 5; // Section-3 → Section-5 (Section-4 스킵)
            } else {
                targetSection = fromSection + 1;
            }
        } else {
            if (fromSection === 5) {
                targetSection = 3; // Section-5 → Section-3 (Section-4 스킵)
            } else {
                targetSection = fromSection - 1;
            }
        }

        // 경계 체크 (실제 존재하는 섹션인지 확인)
        const targetSectionExists = this.sections.some(section => section.id === `section-${targetSection}`);
        if (!targetSectionExists) {
            console.log(`🚫 Cannot move ${direction} from section ${fromSection} to non-existent section ${targetSection}`);
            return;
        }

        // Section-1로 위로 가려고 하면 애니메이션 재실행 방지
        if (targetSection === 1 && direction === 'up') {
            console.log('🚫 Cannot move up to Section-1 (animation replay prevention)');
            return;
        }

        console.log(`🌀 Portal transition triggered - Section-${fromSection} → Section-${targetSection} (${direction})`);

        // 캐릭터 숨기기
        if (window.pixelCharacterManager) {
            window.pixelCharacterManager.hideCharacter();
        }

        // 해당 섹션 진행도 리셋
        const sectionKey = `section${fromSection}ScrollProgress`;
        this[sectionKey] = 0;

        // 목표 섹션으로 이동
        this.goToSection(targetSection);

        // 목표 섹션에서 캐릭터 시작 (방향에 따라 시작 위치 다르게)
        setTimeout(() => {
            if (window.pixelCharacterManager && targetSection >= 2) {
                let startHeight;
                if (targetSection === 2) {
                    startHeight = 60; // Section-2는 항상 60%에서 시작
                } else if (direction === 'down') {
                    startHeight = -25; // 아래로 이동시 상단에서 시작
                } else {
                    startHeight = 120; // 위로 이동시 하단에서 시작
                }

                // 위로 이동시 해당 섹션의 진행도를 120%로 설정 (하단에서 시작)
                if (direction === 'up') {
                    const targetSectionKey = `section${targetSection}ScrollProgress`;
                    this[targetSectionKey] = 1.2;
                }

                window.pixelCharacterManager.switchToSectionState(targetSection, startHeight);
            }
        }, 100);
    }

    // 애니메이션 잠금 제어
    lockForAnimation() {
        this.isAnimationLocked = true;
    }

    unlockAfterAnimation() {
        this.isAnimationLocked = false;
    }

    // 외부에서 섹션 이동 호출
    nextSection() {
        if (!this.isAnimationLocked) {
            this.goToSection(this.currentSection + 1);
        }
    }

    prevSection() {
        if (!this.isAnimationLocked) {
            this.goToSection(this.currentSection - 1);
        }
    }

    // 관성 스크롤 애니메이션
    startMomentumScroll() {
        const deceleration = 0.85; // 감속 계수 (0.95→0.85, 더 빨리 멈춤)
        const minVelocity = 0.01; // 최소 속도 (이하로 떨어지면 멈춤)
        const velocityScale = 0.3; // 속도 스케일 (0.3, 더 느리게)

        const animate = () => {
            if (this.isTransitioning || this.isTouching) {
                this.momentumAnimation = null;
                return;
            }

            // 속도가 충분히 작아지면 멈춤
            if (Math.abs(this.touchVelocity) < minVelocity) {
                this.momentumAnimation = null;
                return;
            }

            // 관성 스크롤 적용 (속도를 delta로 변환, 더 느리게)
            const delta = this.touchVelocity * 16 * velocityScale; // 속도 스케일 적용
            this.handleScrollDelta(delta, 'touch');

            // 속도 감속
            this.touchVelocity *= deceleration;

            // 다음 프레임 예약
            this.momentumAnimation = requestAnimationFrame(animate);
        };

        this.momentumAnimation = requestAnimationFrame(animate);
        console.log(`🚀 Momentum scroll started with velocity: ${this.touchVelocity.toFixed(3)}`);
    }

    // 현재 상태 정보
    getState() {
        return {
            currentSection: this.currentSection,
            virtualScrollY: this.virtualScrollY,
            isTransitioning: this.isTransitioning,
            isAnimationLocked: this.isAnimationLocked,
            characterScrollProgress: this.characterScrollProgress,
            scrollLocked: this.scrollLocked,
            lockReason: this.lockReason
        };
    }

    // 스크롤 잠금
    lockScroll(reason = 'unknown') {
        this.scrollLocked = true;
        this.lockReason = reason;
        console.log(`🔒 Scroll locked: ${reason}`);

        // 진행 중인 관성 애니메이션 중단
        if (this.momentumAnimation) {
            cancelAnimationFrame(this.momentumAnimation);
            this.momentumAnimation = null;
        }
    }

    // 스크롤 잠금 해제
    unlockScroll(reason = 'unknown') {
        this.scrollLocked = false;
        this.lockReason = '';
        console.log(`🔓 Scroll unlocked: ${reason}`);
    }
}

export default ManualScrollManager;