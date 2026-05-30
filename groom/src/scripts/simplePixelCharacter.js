// 간소화된 픽셀 캐릭터 시스템 - 수동 스크롤과 연동

class SimplePixelCharacterManager {
    constructor() {
        this.characters = new Map();
        this.container = null;
        this.currentState = 'hidden'; // 'hidden', 'main', 'lee-idle', 'lee-run'
        this.currentSection = 0;
        this.characterY = 50; // Lee 캐릭터 Y 위치 (퍼센트)
        this.songY = 125; // Song 캐릭터 Y 위치 (퍼센트, Lee와 반대 방향)
        this.isScrolling = false;
        this.scrollTimeout = null;
        this.mainAnimationCallback = null; // 메인 애니메이션 완료 콜백
        this.hitSlimeTriggered = false; // hit-slime 애니메이션 트리거 여부
        this.isHitSlimePlaying = false; // hit-slime 애니메이션 재생 중 여부
        this.isHitIdlePlaying = false; // hit-idle 애니메이션 재생 중 여부
        this.hasFlower = false; // 꽃 아이템 획득 여부 (hit-idle 완료 후)
        this.hasLeafsFlowerDouble = false; // leafsflowerdouble 아이템 획득 여부 (Section8 완료 후)
        this.galleryLeafsTriggered = false; // 갤러리 leafs 트리거 여부 (초기화)
        this.idleWowTriggered = false; // idle-wow 애니메이션 트리거 여부
        this.isIdleWowPlaying = false; // idle-wow 애니메이션 재생 중 여부
        this.idleWowPhase = 1; // 1: 전체실행(1~15), 2: 부분반복(11~15)
        this.idleWowRepeatCount = 0; // 11~15 반복 횟수 (최대 5회)
        this.hasIdleWowCompleted = false; // idle-wow 완료 여부 (idle-wow-normal 상태용)
        this.endingTriggered = false; // ending 애니메이션 트리거 여부
        this.isEndingPlaying = false; // ending 애니메이션 재생 중 여부
        this.skipPositionUpdate = false; // 위치 업데이트 스킵 플래그
        this.isLoadingSection1Data = false; // section1.json 로딩 중 여부
        this.isLoadingCriticalAssets = false; // 중요 애셋 로딩 중 여부
        this.isFullyInitialized = false; // 완전 초기화 여부

        // 통합 캐릭터 컨테이너
        this.mainCharacter = null;
        this.animationStates = {};
        this.sectionTransitionTimer = null; // 섹션 전환 복원 타이머

        // 모바일 디바이스 감지
        this.isMobile = this.detectMobile();

        // 성능 최적화를 위한 프레임 제어
        this.lastFrameTime = 0;

        // IMG 태그 기반 애니메이션 시스템
        this.frameImages = new Map(); // 애니메이션별 IMG 태그들 저장
    }

    // 모바일 디바이스 감지
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
    }

    async init() {
        this.createContainer();
        await this.setupUnifiedCharacter();
        await this.setupCharacters();

        // 초기화 완료 후 쿼리스트링이 없을 때만 section0에서 시작하도록 설정
        const urlParams = new URLSearchParams(window.location.search);
        const hasQuerySection = urlParams.get('section') !== null;

        if (!hasQuerySection && window.manualScrollManager && window.manualScrollManager.currentSection !== 0) {
            console.log('🔄 No query string detected, forcing start from section0 for proper initialization');
            window.manualScrollManager.goToSection(0);
        } else if (hasQuerySection) {
            console.log(`🔗 Query string detected: section=${urlParams.get('section')}, maintaining current section`);
        }

        console.log(`🎮 Simple Pixel Character System initialized (${this.isMobile ? 'Mobile' : 'Desktop'} mode)`);
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'pixel-character-container';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 100;
            overflow: hidden;
        `;
        document.body.appendChild(this.container);
    }

    // 통합 캐릭터 시스템 설정 (IMG 태그 방식)
    async setupUnifiedCharacter() {
        // 메인 캐릭터 컨테이너 생성
        this.mainCharacter = {
            element: document.createElement('div'),
            currentAnimation: null,
            currentFrame: 0,
            animationTimer: null,
            isActive: false
        };

        // 컨테이너 스타일 설정 (이미지 원본 크기 + scale(4))
        this.mainCharacter.element.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%) scale(2);
            z-index: 10;
            opacity: 0;
            pointer-events: none;
        `;

        // 컨테이너에 추가
        this.container.appendChild(this.mainCharacter.element);

        // 프리로드된 이미지 저장소 (호환성 유지)
        this.preloadedImages = {};

        // 로딩 그룹 분류
        this.criticalAnimations = ['lee-idle', 'lee-run']; // Section 0-1에서 즉시 필요
        this.backgroundAnimations = [
            'lee-idle-wow', 'lee-idle-wow-normal', 'lee-idle-flower', 'lee-run-flower',
            'hit-idle', 'hit-slime', 'lee-idle-leafs', 'lee-run-leafsflower',
            'lee-idle-leafsflowerdouble', 'lee-run-leafsflowerdouble'
        ]; // 나중에 필요한 것들

        // 애니메이션 상태들 먼저 정의
        this.animationStates = {
            'lee-idle': {
                framePrefix: 'groom/public/animation/lee-idle/idle',
                frameCount: 2, // idle1.png, idle2.png
                frameRate: 15, // 8 → 15
                loop: true
            },
            'lee-run': {
                framePrefix: 'groom/public/animation/lee-run/run',
                frameCount: 7, // run1.png ~ run7.png
                frameRate: 18, // 12 → 18
                loop: true
            },
            'lee-idle-wow': {
                framePrefix: 'groom/public/animation/idle-wow/idle-wow',
                frameCount: 15, // idle-wow1.png ~ idle-wow15.png
                frameRate: 12, // 10 → 20 (두배 빠르게)
                loop: false // 커스텀 반복 로직 사용
            },
            'lee-idle-wow-normal': {
                framePrefix: 'groom/public/animation/idle-wow-normal/idle-wow-normal',
                frameCount: 5, // idle-wow-normal1.png, idle-wow-normal2.png (기본 idle과 유사)
                frameRate: 8,
                loop: true
            },
            'lee-idle-flower': {
                framePrefix: 'groom/public/animation/idle-flower/idle',
                frameCount: 2,
                frameRate: 15, // 8 → 15
                loop: true
            },
            'lee-run-flower': {
                framePrefix: 'groom/public/animation/run-flower1/run-flower',
                frameCount: 7,
                frameRate: 18, // 12 → 18
                loop: true
            },
            'hit-idle': {
                framePrefix: 'groom/public/animation/hit-idle/hit-idle',
                frameCount: 5,
                frameRate: 15, // 8 → 15
                loop: true
            },
            'hit-slime': {
                framePrefix: 'groom/public/animation/hit-slime/hit-slime',
                frameCount: 21,
                frameRate: 18, // 12 → 18
                loop: false
            },
            'lee-idle-leafs': {
                framePrefix: 'groom/public/animation/idle-leafs/idle',
                frameCount: 2,
                frameRate: 15, // 8 → 15
                loop: true
            },
            'lee-run-leafsflower': {
                framePrefix: 'groom/public/animation/run-leafsflower/run-leafsflower',
                frameCount: 7,
                frameRate: 18, // 12 → 18
                loop: true
            },
            'lee-idle-leafsflowerdouble': {
                framePrefix: 'groom/public/animation/idle-leafsflowerdouble/idle',
                frameCount: 2,
                frameRate: 15,
                loop: true
            },
            'lee-run-leafsflowerdouble': {
                framePrefix: 'groom/public/animation/run-leafsflowerdouble/run',
                frameCount: 7,
                frameRate: 18,
                loop: true
            },
        };

        // 각 애니메이션의 IMG 태그들 생성
        await this.createFrameImages();

        // 중요 애니메이션만 먼저 로드 (로딩창에 포함)
        this.isLoadingCriticalAssets = true;
        this.preloadCriticalAnimations()
            .then(() => {
                this.isLoadingCriticalAssets = false;
                console.log('✅ Critical assets loading completed');
            })
            .catch(err => {
                this.isLoadingCriticalAssets = false;
                console.warn('⚠️ Critical image preloading failed:', err);
            });

        // 나머지 애니메이션은 백그라운드에서 로드 (로딩창 무관)
        setTimeout(() => {
            this.preloadAllBackgroundAssets().catch(err =>
                console.warn('⚠️ Background assets preloading failed:', err)
            );
        }, 100); // 초기화 완료 후 백그라운드 로딩 시작

        console.log('🔧 Unified character system initialized (IMG tag method)');
    }

    // 각 애니메이션의 IMG 태그들 미리 생성 (깜빡임 방지)
    async createFrameImages() {
        console.log('🖼️ Creating IMG tags for all animations...');

        for (const [animationName, config] of Object.entries(this.animationStates)) {
            const frameImageArray = [];

            // 각 프레임별로 IMG 태그 생성
            for (let i = 1; i <= config.frameCount; i++) {
                const img = document.createElement('img');
                const imagePath = `${config.framePrefix}${i}.png`;

                // IMG 태그 스타일 설정 (중앙정렬 + 원본 이미지 크기)
                img.style.cssText = `
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    visibility: hidden;
                    pointer-events: none;
                    image-rendering: pixelated;
                    image-rendering: -moz-crisp-edges;
                    image-rendering: crisp-edges;
                    transition: none;
                `;

                img.src = imagePath;
                img.alt = `${animationName} frame ${i}`;

                // 이미지 로딩 대기 (선택적)
                await new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = () => {
                        console.warn(`⚠️ Failed to load: ${imagePath}`);
                        resolve(); // 에러가 있어도 계속 진행
                    };
                });

                // 캐릭터 컨테이너에 추가
                this.mainCharacter.element.appendChild(img);
                frameImageArray.push(img);

                console.log(`📥 Loaded frame: ${imagePath} (${i}/${config.frameCount})`);
            }

            // 애니메이션별로 IMG 태그 배열 저장
            this.frameImages.set(animationName, frameImageArray);
        }

        console.log('✅ All IMG tags created and loaded');
    }

    // 중요 애니메이션만 프리로드 (로딩창에 포함)
    async preloadCriticalAnimations() {
        console.log('📥 Starting critical image preloading...');
        const loadPromises = [];

        for (const animationName of this.criticalAnimations) {
            const config = this.animationStates[animationName];
            if (!config) continue;

            this.preloadedImages[animationName] = {};

            for (let i = 1; i <= config.frameCount; i++) {
                const imagePath = `${config.framePrefix}${i}.png`;
                const imageKey = `frame_${i}`;

                const promise = new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        this.preloadedImages[animationName][imageKey] = img;
                        resolve();
                    };
                    img.onerror = () => {
                        console.warn(`❌ Failed to preload critical: ${imagePath}`);
                        resolve();
                    };
                    img.src = imagePath;
                });

                loadPromises.push(promise);
            }
        }

        await Promise.all(loadPromises);
        console.log('✅ Critical animation images preloaded');
    }

    // 모든 백그라운드 애셋 로드 (animationStates + addCharacter 기반)
    async preloadAllBackgroundAssets() {
        console.log('📥 Starting complete background asset preloading...');

        // 1. animationStates 기반 애니메이션들
        await this.preloadBackgroundAnimations();

        // 2. addCharacter 기반 애니메이션들 (slime, leafs, song 등)
        await this.preloadAddCharacterAssets();

        console.log('✅ All background assets preloaded');
    }

    // animationStates 기반 애니메이션을 백그라운드에서 로드
    async preloadBackgroundAnimations() {
        console.log('📥 Starting animationStates background preloading...');
        const loadPromises = [];

        for (const animationName of this.backgroundAnimations) {
            const config = this.animationStates[animationName];
            if (!config) continue;

            this.preloadedImages[animationName] = {};

            for (let i = 1; i <= config.frameCount; i++) {
                const imagePath = `${config.framePrefix}${i}.png`;
                const imageKey = `frame_${i}`;

                const promise = new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        this.preloadedImages[animationName][imageKey] = img;
                        resolve();
                    };
                    img.onerror = () => {
                        console.warn(`❌ Failed to preload background: ${imagePath}`);
                        resolve();
                    };
                    img.src = imagePath;
                });

                loadPromises.push(promise);
            }
        }

        await Promise.all(loadPromises);
        console.log('✅ AnimationStates background images preloaded');
    }

    // addCharacter 기반 애니메이션을 백그라운드에서 로드
    async preloadAddCharacterAssets() {
        console.log('📥 Starting addCharacter assets preloading...');
        const loadPromises = [];

        // addCharacter 기반 애니메이션 리스트
        const addCharacterAnimations = [
            'slime-idle', 'slime-hurt', 'hit-slime',
            'leafs', 'song'
        ];

        for (const animationName of addCharacterAnimations) {
            // 각 addCharacter 애니메이션의 설정 정보를 가져오기
            const character = this.characters.get(animationName);
            if (!character || !character.framePrefix || !character.frameCount) continue;

            // framePrefix와 frameCount를 사용하여 이미지 경로 생성
            for (let i = 1; i <= character.frameCount; i++) {
                const imagePath = `${character.framePrefix}${i}.png`;

                const promise = new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        console.log(`✅ Preloaded: ${imagePath}`);
                        resolve();
                    };
                    img.onerror = () => {
                        console.warn(`❌ Failed to preload: ${imagePath}`);
                        resolve();
                    };
                    img.src = imagePath;
                });

                loadPromises.push(promise);
            }
        }

        await Promise.all(loadPromises);
        console.log('✅ AddCharacter assets preloaded');
    }

    async setupCharacters() {
        // 메인 애니메이션 (Section-1에서 재생) - 스프레드시트 기반
        this.addCharacter('main', {
            isSpreadsheetBased: true, // 새로운 플래그
            spreadsheetData: null, // 나중에 로드될 데이터
            scale: 2,
            x: '50%',
            y: 'clamp(46%, calc(40% + 1.5vh), 54%);',
            visible: false
        });

        // Ending 애니메이션 (Section-9에서 50vh 도달 시) - 스프레드시트 기반
        this.addCharacter('ending', {
            isSpreadsheetBased: true, // section1과 동일한 구조
            spreadsheetData: null, // ending.json에서 로드될 데이터
            scale: 2,
            x: '50%',
            y: '50%',
            visible: false,
            zIndex: 2000  // 높은 z-index로 다른 요소 위에 표시
        });

        // Lee 아이들 애니메이션 (Section-2에서 기본 상태)
        this.addCharacter('lee-idle', {
            isPngSequence: true,
            framePrefix: 'groom/public/animation/lee-idle/idle',
            frameCount: 2,
            frameRate: 4,
            framePadding: 0,
            scale: 2,
            x: '50%',
            y: '50%',
            visible: false
        });

        // Lee 런 애니메이션 (Section-2에서 스크롤 시)
        this.addCharacter('lee-run', {
            isPngSequence: true,
            framePrefix: 'groom/public/animation/lee-run/run',
            frameCount: 7,
            frameRate: 14,
            framePadding: 0,
            scale: 4,
            x: '50%',
            y: '50%',
            visible: false
        });

        // Lee idle-wow 애니메이션 (Section-9에서 20vh 도달 시)
        this.addCharacter('lee-idle-wow', {
            isPngSequence: true,
            framePrefix: 'groom/public/animation/idle-wow/idle-wow',
            frameCount: 8,
            frameRate: 10,
            framePadding: 0,
            scale: 4,
            x: '50%',
            y: '50%',
            visible: false,
            loop: false,  // 한 번만 재생
            zIndex: 1000
        });

        // 슬라임 idle 애니메이션 (Section-5에서 사용)
        this.addCharacter('slime-idle', {
            isPngSequence: true,
            framePrefix: 'groom/public/animation/slime/slime',
            frameCount: 9, // slime1~slime9
            frameRate: 8,  // 8fps로 천천히
            framePadding: 0,
            scale: 4,
            x: '50%',
            y: '70%', // 70vh 위치에 고정
            visible: false
        });

        // 슬라임 hurt 애니메이션 (hit-slime 7프레임에서 한 번만 실행)
        this.addCharacter('slime-hurt', {
            isPngSequence: true,
            framePrefix: 'groom/public/animation/slime-hurt/slime-hurt',
            frameCount: 4, // slime-hurt1~4
            frameRate: 12,
            framePadding: 0,
            scale: 4,
            x: '50%',
            y: '70%', // 70vh 위치에 고정
            visible: false,
            loop: false // 한 번만 재생
        });

        // Hit 슬라임 애니메이션 (메인 캐릭터가 60vh 도달시 실행)
        this.addCharacter('hit-slime', {
            isPngSequence: true,
            framePrefix: 'groom/public/animation/hit-slime/hit-slime',
            frameCount: 21, // hit-slime 파일 개수 확인 후 조정 필요
            frameRate: 12, // 적당한 속도
            framePadding: 0,
            scale: 2, // 1.5배 크게 (4 * 1.5 = 6)
            x: '50%',
            y: '70%', // 70vh 위치에 고정
            visible: false,
            loop: false // 한 번만 재생
        });

        // hit-idle 애니메이션 (hit-slime 완료 후 반복 실행)
        this.addCharacter('hit-idle', {
            isPngSequence: true,
            framePrefix: 'groom/public/animation/hit-idle/hit-idle',
            frameCount: 5, // hit-idle1.png ~ hit-idle5.png
            frameRate: 8, // idle 속도
            framePadding: 0,
            scale: 4,
            x: '50%',
            y: '50%', // hit-slime과 동일한 위치
            visible: false,
            loop: true // 반복 실행
        });

        // Lee idle-flower 애니메이션 (꽃 아이템 획득 후)
        this.addCharacter('lee-idle-flower', {
            isPngSequence: true,
            framePrefix: 'groom/public/animation/idle-flower/idle',
            frameCount: 2, // idle1.png, idle2.png
            frameRate: 8, // idle 속도
            framePadding: 0,
            scale: 4,
            x: '50%',
            y: '50%',
            visible: false,
            loop: true
        });

        // Lee run-flower 애니메이션 (꽃 아이템 획득 후)
        this.addCharacter('lee-run-flower', {
            isPngSequence: true,
            framePrefix: 'groom/public/animation/run-flower1/run-flower',
            frameCount: 7, // run-flower1.png ~ run-flower7.png
            frameRate: 12, // run 속도
            framePadding: 0,
            scale: 4,
            x: '50%',
            y: '50%',
            visible: false,
            loop: true
        });

        // Leafs 애니메이션 (갤러리 하단에서 트리거)
        this.addCharacter('leafs', {
            isPngSequence: true,
            framePrefix: 'groom/public/animation/leafs/leafs',
            frameCount: 7, // leafs1.png ~ leafs7.png
            frameRate: 8,
            framePadding: 0,
            scale: 4,
            x: '50%',
            y: '50%',
            visible: false,
            loop: false, // 한 번만 재생
            zIndex: 500 // 갤러리 이미지(z-index: 200)보다 높게 설정
        });


        // Song 통합 캐릭터 (하나의 컨테이너에서 idle/run 전환)
        this.addCharacter('song', {
            isPngSequence: true,
            framePrefix: 'groom/public/animation/song-idle/song-idle', // 기본은 idle
            frameCount: 5,
            frameRate: 8,
            framePadding: 0,
            scale: 4,
            x: '50%', // 중앙
            y: '120%', // 화면 아래 바깥
            visible: false,
            loop: true,
            zIndex: 1000,
            currentAnimation: 'song-idle' // 현재 상태 추적
        });

        console.log('🎮 Characters setup: main (spreadsheet), lee-idle (png), lee-run (png), slime-idle (png), slime-hurt (png), hit-slime (png), hit-idle (png), lee-idle-flower (png), lee-run-flower (png), leafs (png), song (unified));')


        // 갤러리 트리거 관련 초기화
        this.galleryLeafsTriggered = false;

        // 스프레드시트 데이터 로드 (이것이 완료되어야 스크롤 가능)
        await this.loadMainAnimationSpreadsheetData();
    }

    // 통합 캐릭터 애니메이션 전환
    switchUnifiedAnimation(animationName) {
        console.log(`🎭 switchUnifiedAnimation called: ${animationName}`);
        console.log(`🔧 Available animations:`, Object.keys(this.animationStates));

        if (!this.animationStates[animationName]) {
            console.warn(`🚫 Animation not found: ${animationName}`);
            return;
        }

        // 현재 애니메이션이 같으면 건너뛰기
        if (this.mainCharacter.currentAnimation === animationName) {
            console.log(`⏭️ Same animation already playing: ${animationName}`);
            return;
        }

        // 기존 애니메이션 정지
        if (this.mainCharacter.animationTimer) {
            cancelAnimationFrame(this.mainCharacter.animationTimer);
        }

        // 모든 IMG 태그 숨기기 (중복 방지)
        for (const frameImages of this.frameImages.values()) {
            frameImages.forEach(img => img.style.visibility = 'hidden');
        }

        // 새 애니메이션 설정
        this.mainCharacter.currentAnimation = animationName;
        this.mainCharacter.currentFrame = 0;
        this.mainCharacter.isActive = true;
        this.mainCharacter.element.style.opacity = '1';

        console.log(`✅ Character activated: opacity=${this.mainCharacter.element.style.opacity}, isActive=${this.mainCharacter.isActive}`);

        // 애니메이션 시작
        this.startUnifiedAnimation();

        console.log(`🎭 Unified character: switching to ${animationName}`);
    }


    // 통합 캐릭터 애니메이션 실행 (성능 최적화)
    startUnifiedAnimation() {
        const animation = this.animationStates[this.mainCharacter.currentAnimation];
        if (!animation) return;

        // 모바일에서 frameRate 약간 감소 (성능 최적화하되 너무 느려지지 않게)
        const effectiveFrameRate = this.isMobile ? Math.max(8, animation.frameRate * 0.75) : animation.frameRate;
        const frameDuration = 1000 / effectiveFrameRate;

        console.log(`🎬 Starting animation: ${this.mainCharacter.currentAnimation} at ${effectiveFrameRate}fps (${this.isMobile ? 'Mobile' : 'Desktop'})`);

        // 시작 전에 모든 다른 애니메이션 숨기기
        for (const [animationName, frameImages] of this.frameImages.entries()) {
            if (animationName !== this.mainCharacter.currentAnimation) {
                frameImages.forEach(img => img.style.visibility = 'hidden');
            }
        }

        const updateFrame = (currentTime) => {
            // 프레임 타이밍 제어 (requestAnimationFrame 기반)
            if (currentTime - this.lastFrameTime < frameDuration) {
                this.mainCharacter.animationTimer = requestAnimationFrame(updateFrame);
                return;
            }

            this.lastFrameTime = currentTime;

            // IMG 태그 기반 프레임 업데이트 (깜빡임 방지)
            const frameImages = this.frameImages.get(this.mainCharacter.currentAnimation);

            if (frameImages) {
                // 모든 애니메이션의 모든 프레임 숨기기 (확실한 중복 방지)
                for (const allFrameImages of this.frameImages.values()) {
                    allFrameImages.forEach(img => {
                        img.style.visibility = 'hidden';
                        img.style.display = 'none';
                        img.style.opacity = '0';
                    });
                }

                // 현재 애니메이션의 현재 프레임만 보이기
                const currentImg = frameImages[this.mainCharacter.currentFrame];
                if (currentImg) {
                    currentImg.style.visibility = 'visible';
                    currentImg.style.display = 'block';
                    currentImg.style.opacity = '1';
                }
            } else {
                console.warn(`⚠️ No frame images found for: ${this.mainCharacter.currentAnimation}`);
            }

            this.mainCharacter.currentFrame++;

            // 애니메이션 완료 또는 반복
            if (this.mainCharacter.currentAnimation === 'lee-idle-wow') {
                // idle-wow 특별 처리: 1~15 → 11~15를 5회 반복
                this.handleIdleWowFrameLogic();
            } else if (this.mainCharacter.currentFrame >= animation.frameCount) {
                if (animation.loop) {
                    this.mainCharacter.currentFrame = 0; // 반복
                } else {
                    // 한 번만 재생하는 애니메이션 완료
                    if (this.mainCharacter.currentAnimation === 'hit-slime') {
                        this.onHitSlimeAnimationComplete();
                    }
                    return;
                }
            }

            // 다음 프레임 예약 (requestAnimationFrame 사용)
            this.mainCharacter.animationTimer = requestAnimationFrame(updateFrame);
        };

        // 첫 프레임 시작
        this.lastFrameTime = 0;
        this.mainCharacter.animationTimer = requestAnimationFrame(updateFrame);
    }

    // 통합 캐릭터 숨기기 (IMG 태그 방식) - ending 애니메이션용 강화
    hideUnifiedCharacter() {
        console.log('👻 Hiding unified character for ending animation');
        this.mainCharacter.element.style.opacity = '0';
        this.mainCharacter.element.style.display = 'none';
        this.mainCharacter.element.style.visibility = 'hidden';
        this.mainCharacter.isActive = false;
        if (this.mainCharacter.animationTimer) {
            cancelAnimationFrame(this.mainCharacter.animationTimer);
        }

        // 모든 IMG 태그 완전히 숨기기
        for (const frameImages of this.frameImages.values()) {
            frameImages.forEach(img => {
                img.style.visibility = 'hidden';
                img.style.display = 'none';
                img.style.opacity = '0';
            });
        }

        console.log(`👻 Unified character completely hidden for ending: opacity=0, display=none, isActive=${this.mainCharacter.isActive}`);
    }

    // 통합 캐릭터 보이기 (IMG 태그 방식)
    showUnifiedCharacter() {
        console.log('👀 Showing unified character');
        console.log('🔍 DEBUG - mainCharacter element:', this.mainCharacter.element);
        console.log('🔍 DEBUG - mainCharacter element style:', {
            opacity: this.mainCharacter.element.style.opacity,
            visibility: this.mainCharacter.element.style.visibility,
            display: this.mainCharacter.element.style.display,
            position: this.mainCharacter.element.style.position,
            top: this.mainCharacter.element.style.top,
            left: this.mainCharacter.element.style.left,
            zIndex: this.mainCharacter.element.style.zIndex
        });

        this.mainCharacter.element.style.opacity = '1';
        this.mainCharacter.element.style.visibility = 'visible';
        this.mainCharacter.element.style.display = 'block'; // display 복원
        this.mainCharacter.isActive = true;

        console.log(`👀 Unified character shown: opacity=${this.mainCharacter.element.style.opacity}, isActive=${this.mainCharacter.isActive}`);
        console.log('🔍 DEBUG - After showing:', {
            opacity: this.mainCharacter.element.style.opacity,
            visibility: this.mainCharacter.element.style.visibility,
            display: this.mainCharacter.element.style.display,
            childrenCount: this.mainCharacter.element.children.length,
            computedStyles: window.getComputedStyle(this.mainCharacter.element).display
        });
    }

    // 통합 캐릭터 위치 업데이트
    updateUnifiedCharacterPosition() {
        this.mainCharacter.element.style.top = `${this.characterY}%`;
        console.log(`📍 Unified character position updated: ${this.characterY}%`);
    }

    // 메인 애니메이션 스프레드시트 데이터 로드 (JSON 파일에서)
    async loadMainAnimationSpreadsheetData() {
        try {
            console.log('📊 Loading section1 spreadsheet data from JSON...');
            this.isLoadingSection1Data = true;

            // 로딩 시작 시간 기록
            const loadingStartTime = Date.now();
            const minimumLoadingTime = 1500; // 최소 1.5초 로딩 시간

            // 로딩 상태를 외부에 알림 (즉시 실행)
            if (window.manualScrollManager) {
                window.manualScrollManager.setLoadingState(true);
            } else {
                // manualScrollManager가 아직 없으면 DOM에 직접 추가
                this.showDirectLoadingMessage();
            }

            // 여러 경로로 시도
            const jsonPaths = [
                'groom/public/animation/section1.json',
                './groom/public/animation/section1.json',
                'animation/section1.json'
            ];

            let response = null;
            let jsonUrl = '';

            for (const path of jsonPaths) {
                try {
                    console.log('🌐 Attempting to load JSON from:', path);
                    response = await fetch(path);
                    if (response.ok) {
                        jsonUrl = path;
                        break;
                    }
                } catch (e) {
                    console.log(`❌ Failed to load from ${path}:`, e.message);
                }
            }

            if (!response || !response.ok) {
                throw new Error(`Failed to load JSON from all paths`);
            }

            console.log('✅ Successfully loaded JSON from:', jsonUrl);

            const jsonData = await response.json();
            console.log('✅ JSON data loaded:', jsonData);

            // JSON 형식을 우리 스프레드시트 형식으로 변환
            const frames = [];
            const frameKeys = Object.keys(jsonData.frames);

            frameKeys.forEach((frameKey, index) => {
                const frameInfo = jsonData.frames[frameKey];
                frames.push({
                    image: `groom/public/animation/${jsonData.meta.image}`, // 상대 경로로 section1.png 구성
                    duration: frameInfo.duration,
                    spriteX: frameInfo.frame.x,
                    spriteY: frameInfo.frame.y,
                    spriteWidth: frameInfo.frame.w,
                    spriteHeight: frameInfo.frame.h
                });
            });

            // frameTags를 이용한 애니메이션 시퀀스 생성
            const frameTags = jsonData.meta.frameTags || [];
            console.log('📋 Available frameTags:', frameTags);

            // 애니메이션 시퀀스 계산 (frameTags에 따른 repeat 적용)
            const animationSequence = [];

            frameTags.forEach(tag => {
                const from = tag.from;
                const to = tag.to;
                const repeatCount = parseInt(tag.repeat) || 1;

                console.log(`🏷️ Tag "${tag.name}": frames ${from}-${to}, repeat ${repeatCount} times`);

                // 해당 태그의 프레임 범위를 repeat만큼 반복
                for (let r = 0; r < repeatCount; r++) {
                    for (let f = from; f <= to; f++) {
                        animationSequence.push(f);
                    }
                }
            });

            // 애니메이션 시퀀스가 없으면 모든 프레임을 순서대로 재생
            if (animationSequence.length === 0) {
                console.log('⚠️ No frameTags found, using all frames in order');
                for (let i = 0; i < frames.length; i++) {
                    animationSequence.push(i);
                }
            }

            console.log(`🎬 Animation sequence: [${animationSequence.slice(0, 20).join(', ')}${animationSequence.length > 20 ? '...' : ''}] (total: ${animationSequence.length} frames)`);

            const spreadsheetData = {
                frames: frames,
                animationSequence: animationSequence, // 새로운 시퀀스 정보
                totalDuration: frames.reduce((total, frame) => total + frame.duration, 0),
                metadata: {
                    name: 'Section 1 Main Animation',
                    frameCount: frames.length,
                    sequenceLength: animationSequence.length,
                    spritesheet: jsonData.meta.image,
                    frameTags: frameTags
                }
            };

            console.log(`📊 Converted ${frames.length} frames from JSON to spreadsheet format`);
            console.log('🎬 Total duration:', spreadsheetData.totalDuration + 'ms');

            // 메인 캐릭터에 데이터 설정
            await this.loadSpreadsheetData('main', spreadsheetData);

            // 최소 로딩 시간 보장 (사용자에게 로딩 경험 제공)
            const loadingElapsed = Date.now() - loadingStartTime;
            const remainingTime = Math.max(0, minimumLoadingTime - loadingElapsed);

            if (remainingTime > 0) {
                console.log(`⏳ Ensuring minimum loading time: ${remainingTime}ms remaining`);
                await new Promise(resolve => setTimeout(resolve, remainingTime));
            }

            // 로딩 완료
            this.isLoadingSection1Data = false;
            this.isFullyInitialized = true;

            // 로딩 완료를 외부에 알림
            if (window.manualScrollManager) {
                window.manualScrollManager.setLoadingState(false);
            } else {
                // DOM에서 직접 제거
                this.hideDirectLoadingMessage();
                this.showDirectScrollGuide();
            }

            console.log('✅ Section1 data loading completed!');

        } catch (error) {
            console.error('❌ Failed to load section1 spreadsheet data:', error);
            console.log('⚠️ Falling back to empty data - animation will use fallback method');

            // 에러 발생 시에도 최소 로딩 시간 보장
            const loadingElapsed = Date.now() - loadingStartTime;
            const remainingTime = Math.max(0, minimumLoadingTime - loadingElapsed);

            if (remainingTime > 0) {
                console.log(`⏳ Ensuring minimum loading time even after error: ${remainingTime}ms remaining`);
                await new Promise(resolve => setTimeout(resolve, remainingTime));
            }

            // 로딩 실패해도 완료 처리
            this.isLoadingSection1Data = false;
            this.isFullyInitialized = true;

            if (window.manualScrollManager) {
                window.manualScrollManager.setLoadingState(false);
            } else {
                // DOM에서 직접 제거
                this.hideDirectLoadingMessage();
                this.showDirectScrollGuide();
            }
        }
    }

    // Ending 애니메이션 스프레드시트 데이터 로드 (ending.json에서)
    async loadEndingAnimationData() {
        try {
            console.log('📊 Loading ending spreadsheet data from JSON...');

            // 여러 경로로 시도 (section1과 동일한 패턴)
            const jsonPaths = [
                'groom/public/animation/ending/ending.json',
                './groom/public/animation/ending/ending.json',
                'animation/ending/ending.json'
            ];

            let response = null;
            let loadedPath = null;

            for (const path of jsonPaths) {
                try {
                    console.log(`🔍 Trying ending.json path: ${path}`);
                    response = await fetch(path);
                    if (response.ok) {
                        loadedPath = path;
                        console.log(`✅ Successfully loaded from: ${path}`);
                        break;
                    }
                } catch (e) {
                    console.log(`❌ Failed to load from ${path}:`, e.message);
                    continue;
                }
            }

            if (!response || !response.ok) {
                throw new Error('Could not load ending.json from any path');
            }

            const jsonData = await response.json();
            console.log(`📥 Raw ending JSON loaded:`, jsonData);

            // JSON 데이터를 스프레드시트 형태로 변환
            const frames = [];
            const frameKeys = Object.keys(jsonData.frames);

            for (let i = 0; i < frameKeys.length; i++) {
                const key = frameKeys[i];
                const frameInfo = jsonData.frames[key];

                frames.push({
                    image: `groom/public/animation/ending/${jsonData.meta.image}`, // 상대 경로로 ending.png 구성 (section1과 동일)
                    duration: frameInfo.duration,
                    spriteX: frameInfo.frame.x,
                    spriteY: frameInfo.frame.y,
                    spriteWidth: frameInfo.frame.w,
                    spriteHeight: frameInfo.frame.h
                });
            }

            // frameTags를 이용한 애니메이션 시퀀스 생성 (section1과 동일)
            const frameTags = jsonData.meta.frameTags || [];
            console.log('📋 Available ending frameTags:', frameTags);

            // 애니메이션 시퀀스 계산 (frameTags에 따른 repeat 적용)
            const animationSequence = [];

            frameTags.forEach(tag => {
                const from = tag.from;
                const to = tag.to;
                const repeatCount = parseInt(tag.repeat) || 1;

                console.log(`🏷️ Ending Tag "${tag.name}": frames ${from}-${to}, repeat ${repeatCount} times`);

                // 해당 태그의 프레임 범위를 repeat만큼 반복
                for (let r = 0; r < repeatCount; r++) {
                    for (let f = from; f <= to; f++) {
                        animationSequence.push(f);
                    }
                }
            });

            // 애니메이션 시퀀스가 없으면 모든 프레임을 순서대로 재생
            if (animationSequence.length === 0) {
                console.log('⚠️ No ending frameTags found, using all frames in order');
                for (let i = 0; i < frames.length; i++) {
                    animationSequence.push(i);
                }
            }

            console.log(`🎬 Ending animation sequence: [${animationSequence.slice(0, 20).join(', ')}${animationSequence.length > 20 ? '...' : ''}] (total: ${animationSequence.length} frames)`);

            const spreadsheetData = {
                frames: frames,
                animationSequence: animationSequence,
                totalDuration: frames.reduce((total, frame) => total + frame.duration, 0),
                meta: {
                    size: jsonData.meta?.size || { w: 50, h: 64 },
                    scale: jsonData.meta?.scale || "1"
                },
                metadata: {
                    name: 'Ending Animation',
                    frameCount: frames.length,
                    sequenceLength: animationSequence.length,
                    spritesheet: jsonData.meta.image,
                    frameTags: frameTags
                }
            };

            console.log(`📊 Converted ${frames.length} ending frames from JSON to spreadsheet format`);
            console.log('🎬 Total ending duration:', spreadsheetData.totalDuration + 'ms');

            // Ending 캐릭터에 데이터 설정
            await this.loadSpreadsheetData('ending', spreadsheetData);

            console.log('✅ Ending data loading completed!');

        } catch (error) {
            console.error('❌ Failed to load ending spreadsheet data:', error);
            console.log('⚠️ Ending animation will not be available');
        }
    }

    // 직접 로딩 메시지 표시 (manualScrollManager 없을 때)
    showDirectLoadingMessage() {
        // HTML의 초기 로딩 스크린이 이미 있으므로 그것을 유지
        // 추가적인 DOM 조작 불필요
        console.log('⏳ Using initial loading screen from HTML');
    }

    // 직접 로딩 메시지 제거
    hideDirectLoadingMessage() {
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

    // 직접 스크롤 가이드 표시
    showDirectScrollGuide() {
        setTimeout(() => {
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

            setTimeout(() => {
                if (guideDiv.parentNode) {
                    guideDiv.remove();
                }
            }, 5000);
        }, 500);
    }

    addCharacter(id, options) {
        const character = {
            id,
            ...options,
            element: null,
            currentFrame: 0,
            animationInterval: null,
            isActive: false
        };

        // 캐릭터 엘리먼트 생성
        character.element = document.createElement('div');
        character.element.className = 'pixel-character';
        character.element.style.cssText = `
            position: absolute;
            left: ${character.x};
            top: ${character.y};
            transform: translate(-50%, -50%) scale(${character.scale});
            opacity: ${character.visible ? '1' : '0'};
            pointer-events: none;
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
            z-index: ${character.zIndex || 50};
            /* transition 제거 - 즉시 이동 */
        `;

        // 이미지 엘리먼트 생성
        const img = document.createElement('img');
        img.style.cssText = `
            display: block;
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
            -webkit-user-drag: none;
            -webkit-user-select: none;
            user-select: none;
        `;

        character.element.appendChild(img);
        character.img = img;

        this.container.appendChild(character.element);
        this.characters.set(id, character);

        // 애니메이션 시작
        if (character.visible) {
            this.startAnimation(character);
        }
    }

    startAnimation(character) {
        if (character.animationInterval || character.animationTimeout) {
            this.stopAnimation(character);
        }

        character.isActive = true;
        character.currentFrame = 0;

        if (character.isSpreadsheetBased) {
            this.startSpreadsheetAnimation(character);
        } else {
            // 기존 PNG 시퀀스 방식
            const frameInterval = 1000 / character.frameRate;
            character.animationInterval = setInterval(() => {
                this.updateFrame(character);
            }, frameInterval);
            this.updateFrame(character); // 첫 프레임 즉시 표시
        }
    }

    // 스프레드시트 기반 애니메이션 시작
    startSpreadsheetAnimation(character) {
        console.log(`🎬 startSpreadsheetAnimation called for: ${character.id}`);

        if (!character.spreadsheetData || !character.spreadsheetData.frames) {
            console.error('❌ Spreadsheet data not loaded for character:', character.id);
            return;
        }

        console.log(`✅ Spreadsheet data found for ${character.id}:`, {
            frameCount: character.spreadsheetData.frames.length,
            sequenceLength: character.spreadsheetData.animationSequence.length,
            totalDuration: character.spreadsheetData.totalDuration
        });

        // 스프라이트시트 이미지 미리 로드
        const spritesheetImg = new Image();
        const firstFrame = character.spreadsheetData.frames[0];

        spritesheetImg.onload = () => {
            console.log(`✅ Spritesheet loaded: ${firstFrame.image}`);
            this.playSpritesheetFrames(character, spritesheetImg);
        };

        spritesheetImg.onerror = () => {
            console.error('❌ Failed to load spritesheet image:', firstFrame.image);
        };

        spritesheetImg.src = firstFrame.image;
    }

    // 스프라이트시트 프레임 재생 (애니메이션 시퀀스 기반)
    playSpritesheetFrames(character, spritesheetImg) {
        // 캔버스를 사용하여 개별 프레임 추출
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // 애니메이션 시퀀스 가져오기
        const animationSequence = character.spreadsheetData.animationSequence || [];

        if (animationSequence.length === 0) {
            console.error('❌ No animation sequence found!');
            return;
        }

        console.log(`🎬 Starting animation with sequence of ${animationSequence.length} frames`);

        const playNextFrame = (sequenceIndex) => {
            // 시퀀스 완료 확인
            if (sequenceIndex >= animationSequence.length) {
                // 애니메이션 완료
                character.isActive = false;
                console.log(`✅ Spreadsheet animation completed: ${character.id} (${animationSequence.length} frames played)`);

                // 애니메이션 완료 콜백 호출
                if (character.id === 'main' && this.mainAnimationCallback) {
                    this.mainAnimationCallback();
                    this.mainAnimationCallback = null;
                } else if (character.id === 'ending') {
                    this.onEndingAnimationComplete();
                }
                return;
            }

            // 시퀀스에서 실제 프레임 인덱스 가져오기
            const frameIndex = animationSequence[sequenceIndex];
            const frameData = character.spreadsheetData.frames[frameIndex];

            if (!frameData) {
                console.error(`❌ Frame ${frameIndex} not found!`);
                return;
            }

            // 캔버스 크기 설정
            canvas.width = frameData.spriteWidth;
            canvas.height = frameData.spriteHeight;

            // 스프라이트시트에서 해당 프레임 영역 추출
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(
                spritesheetImg,
                frameData.spriteX, frameData.spriteY, frameData.spriteWidth, frameData.spriteHeight, // 소스 영역
                0, 0, frameData.spriteWidth, frameData.spriteHeight // 대상 영역
            );

            // 캔버스를 데이터 URL로 변환하여 이미지 소스로 설정
            character.img.src = canvas.toDataURL();
            character.currentFrame = frameIndex;

            // 이미지 표시 강제 확인 (ending 캐릭터인 경우)
            if (character.id === 'ending') {
                character.img.style.display = 'block';
                character.img.style.opacity = '1';
                character.img.style.visibility = 'visible';
                console.log(`🎬 ENDING IMG SET:`, {
                    src: character.img.src.substring(0, 50) + '...',
                    display: character.img.style.display,
                    opacity: character.img.style.opacity,
                    parentOpacity: character.element.style.opacity
                });
            }

            console.log(`🎬 Sequence ${sequenceIndex + 1}/${animationSequence.length} - Frame ${frameIndex}: sprite(${frameData.spriteX},${frameData.spriteY},${frameData.spriteWidth}x${frameData.spriteHeight}) (${frameData.duration}ms)`);

            // 다음 프레임 스케줄링
            character.animationTimeout = setTimeout(() => {
                playNextFrame(sequenceIndex + 1);
            }, frameData.duration || 83); // 기본 83ms (12fps)
        };

        playNextFrame(0);
    }

    updateFrame(character) {
        if (!character.isPngSequence) return;

        const frameNumber = character.currentFrame + 1; // 1부터 시작
        const framePath = `${character.framePrefix}${frameNumber}.png`;
        character.img.src = framePath;

        character.currentFrame = (character.currentFrame + 1) % character.frameCount;
    }

    stopAnimation(character) {
        if (character.animationInterval) {
            clearInterval(character.animationInterval);
            character.animationInterval = null;
        }
        if (character.animationTimeout) {
            clearTimeout(character.animationTimeout);
            character.animationTimeout = null;
        }
        character.isActive = false;
    }

    // 스프레드시트 데이터 로드
    async loadSpreadsheetData(characterId, spreadsheetData) {
        const character = this.characters.get(characterId);
        if (!character) {
            console.error(`❌ Character not found: ${characterId}`);
            return;
        }

        if (!character.isSpreadsheetBased) {
            console.error(`❌ Character ${characterId} is not spreadsheet-based`);
            return;
        }

        character.spreadsheetData = spreadsheetData;
        console.log(`✅ Spreadsheet data loaded for ${characterId}:`, spreadsheetData);

        return character;
    }

    // 통합 캐릭터 상태 전환
    switchToState(newState) {
        // hit-slime 실행 중에만 상태 변경 무시 (hit-idle은 스크롤로 전환 가능)
        if (this.isHitSlimePlaying) {
            console.log(`🚫 State change blocked during hit-slime animation: ${newState}`);
            return;
        }

        // 슬라임 관련 상태 요청은 별도 처리
        if (newState.startsWith('slime-') || newState === 'hit-slime') {
            console.log(`🟢 Slime-related state change ignored in switchToState: ${newState}`);
            return;
        }

        // 실제 사용할 애니메이션 계산
        let actualAnimation = newState;
        console.log(`🌸 Animation check: hasLeafsFlowerDouble=${this.hasLeafsFlowerDouble}, hasFlower=${this.hasFlower}, leafsTriggered=${this.galleryLeafsTriggered}, newState=${newState}`);

        // idle-wow 완료 후에는 idle-wow-normal이 최우선 (leafsflowerdouble 차단)
        if (this.hasIdleWowCompleted && newState === 'lee-idle') {
            actualAnimation = 'lee-idle-wow-normal';
            console.log(`✨ Using idle-wow-normal (blocks leafsflowerdouble): ${actualAnimation}`);
        } else if (this.hasIdleWowCompleted && this.hasLeafsFlowerDouble && newState === 'lee-run') {
            actualAnimation = 'lee-run-leafsflowerdouble'; // idle-wow 완료 후에도 run은 leafsflowerdouble 유지
            console.log(`✨ Using leafsflowerdouble run (idle-wow completed): ${actualAnimation}`);
        } else if (this.hasLeafsFlowerDouble && newState === 'lee-idle') {
            actualAnimation = 'lee-idle-leafsflowerdouble';
            console.log(`🌸✨ Using leafsflowerdouble idle: ${actualAnimation}`);
        } else if (this.hasLeafsFlowerDouble && newState === 'lee-run') {
            actualAnimation = 'lee-run-leafsflowerdouble';
            console.log(`🌸✨ Using leafsflowerdouble run: ${actualAnimation}`);
        } else if (this.galleryLeafsTriggered && newState === 'lee-idle') {
            actualAnimation = 'lee-idle-leafs';
            console.log(`🍃 Using leafs idle: ${actualAnimation}`);
        } else if (this.galleryLeafsTriggered && newState === 'lee-run') {
            actualAnimation = 'lee-run-leafsflower';
            console.log(`🍃 Using leafs run: ${actualAnimation}`);
        } else if (this.hasFlower && newState === 'lee-idle') {
            actualAnimation = 'lee-idle-flower';
            console.log(`🌸 Using flower idle: ${actualAnimation}`);
        } else if (this.hasFlower && newState === 'lee-run') {
            actualAnimation = 'lee-run-flower';
            console.log(`🌸 Using flower run: ${actualAnimation}`);
        } else {
            console.log(`🎭 Using normal animation: ${actualAnimation}`);
        }

        // hit-idle에서 전환할 때 꽃 아이템 획득
        if (this.isHitIdlePlaying) {
            this.isHitIdlePlaying = false;
            this.hasFlower = true;
            this.characterY = 50; // 위치 보존
            console.log('🌸 Hit-idle transition: flower item acquired! Position preserved at 50%');

            // 꽃 모드로 재계산
            if (newState === 'lee-idle') {
                actualAnimation = 'lee-idle-flower';
            } else if (newState === 'lee-run') {
                actualAnimation = 'lee-run-flower';
            }
        }

        // 'main' 애니메이션은 스프레드시트 기반이므로 기존 시스템 사용
        if (newState === 'main') {
            console.log('🎬 Main animation uses spreadsheet system, not unified character');
            // 기존 main 애니메이션 시스템으로 처리 (스프레드시트 기반)
            return;
        }

        // 통합 캐릭터로 전환
        if (newState === 'hidden') {
            this.hideUnifiedCharacter();
        } else {
            // 통합 캐릭터가 초기화되지 않았으면 건너뛰기
            if (!this.mainCharacter || !this.animationStates[actualAnimation]) {
                console.warn(`🚫 Unified character not ready or animation not found: ${actualAnimation}`);
                return;
            }
            this.switchUnifiedAnimation(actualAnimation);
            this.updateUnifiedCharacterPosition();
            console.log(`🎭 Unified character activated for Section-${this.currentSection}: ${actualAnimation}`);
        }

        // 기존 개별 캐릭터들 숨기기 (슬라임과 song 캐릭터들 제외)
        this.characters.forEach((char, id) => {
            if (id.startsWith('slime-') || id.startsWith('song-')) return; // 슬라임과 song 캐릭터들은 별도 관리
            this.stopAnimation(char);
            char.element.style.opacity = '0';
        });

        this.currentState = newState;
        console.log(`🔧 Unified character switched to: ${actualAnimation}`);
    }

    // 메인 애니메이션 재생 (Section-1) - 스프레드시트 기반
    playMainAnimation(callback) {
        console.log('🎬 Starting main animation (Section-1) - Spreadsheet based');

        const mainChar = this.characters.get('main');

        if (!mainChar) {
            console.error('❌ Main character not found! Character system not initialized.');
            return;
        }

        if (!mainChar.spreadsheetData) {
            console.error('❌ Main animation spreadsheet data not loaded! Loading fallback...');
            // 폴백: 기존 PNG 시퀀스 방식으로 전환
            this.loadFallbackMainAnimation();
            return;
        }

        this.mainAnimationCallback = callback;

        // 통합 캐릭터 숨기기 (main 애니메이션 중에는 숨김)
        this.hideUnifiedCharacter();

        // main 캐릭터 보이기 및 시작
        this.currentSection = 1;
        mainChar.element.style.opacity = '1';
        mainChar.element.style.visibility = 'visible';
        mainChar.isActive = true;
        this.startAnimation(mainChar);

        console.log('🎬 Main character activated and animation started');

        // 스프레드시트 기반에서는 애니메이션 완료 콜백이 startSpreadsheetAnimation에서 처리됨
        // 별도의 setTimeout 불필요
    }

    // 폴백용 기존 방식 로딩
    loadFallbackMainAnimation() {
        const mainChar = this.characters.get('main');
        if (mainChar) {
            // 기존 PNG 시퀀스 방식으로 전환
            mainChar.isSpreadsheetBased = false;
            mainChar.isPngSequence = true;
            mainChar.framePrefix = 'groom/public/animation/section1/section';
            mainChar.frameCount = 69;
            mainChar.frameRate = 12;
            mainChar.framePadding = 0;

            console.log('⚠️ Using fallback PNG sequence animation');

            // 폴백 시에는 기존 타이머 방식 사용
            setTimeout(() => {
                console.log('🎉 Main animation completed (fallback)');
                if (this.mainAnimationCallback) {
                    this.mainAnimationCallback();
                    this.mainAnimationCallback = null;
                }
            }, (69 / 12) * 1000); // 5.75초
        }
    }

    // 모든 섹션에서 사용할 통합 메서드
    switchToSectionState(sectionIndex, startHeight) {
        console.log(`🎯 Switching to Section-${sectionIndex} state (starting from ${startHeight}%)`);
        console.log(`🎯 Previous section: ${this.currentSection} → New section: ${sectionIndex}`);

        // 섹션 전환 타이머 정리
        if (this.sectionTransitionTimer) {
            clearTimeout(this.sectionTransitionTimer);
            this.sectionTransitionTimer = null;
        }

        // Section-2는 60% 위치에서 시작, 다른 섹션은 startHeight에서 시작
        if (sectionIndex === 2) {
            this.characterY = 60; // Section-2는 60% 위치에서 시작
            this.updateUnifiedCharacterPosition(); // DOM 위치 즉시 업데이트
            console.log('🎯 Section-2 character positioned at 60% (equivalent to 0.68 progress)');
            this.showUnifiedCharacter();
            console.log('👀 Unified character shown after section1 animation completion');
        } else {
            this.characterY = startHeight;
        }

        this.currentSection = sectionIndex;

        // 스크롤 중이면 run, 아니면 idle로 시작
        const initialState = this.isScrolling ? 'lee-run' : 'lee-idle';
        console.log(`🏃 Starting Section-${sectionIndex} in ${initialState} state (isScrolling: ${this.isScrolling})`);
        this.switchToState(initialState);
    }

    // 호환성을 위한 기존 메서드들
    switchToIdleState() {
        this.switchToSectionState(2, -25);
    }

    switchToSection3State() {
        this.switchToSectionState(3, -25);
    }

    // 슬라임 상태로 전환 (Section-5 전용) - 일반 캐릭터와 동시 표시
    switchToSlimeState() {
        console.log('🟢 Switching to slime state (Section-5)');
        this.currentSection = 5;

        // Section-5 초기화
        this.hitSlimeTriggered = false;
        this.isHitSlimePlaying = false;
        console.log('🟢 Section-5 hit-slime state reset');

        // Section-5에서는 Lee 캐릭터(lee-idle/lee-run)도 함께 표시
        const startHeight = -25; // 화면 위 바깥에서 시작
        this.characterY = startHeight;

        // 스크롤 상태에 따라 일반 캐릭터 시작 상태 결정
        const mainState = this.isScrolling ? 'lee-run' : 'lee-idle';
        this.switchToState(mainState);

        // 슬라임은 별도로 70vh에 고정하여 표시
        this.showSlimeCharacter();

        console.log(`🟢 Section-5 started: main character=${mainState}, slime=active`);
    }

    // 슬라임 캐릭터 별도 표시 (항상 idle 상태)
    showSlimeCharacter() {
        const slimeChar = this.characters.get('slime-idle');

        if (slimeChar && slimeChar.element) {
            slimeChar.element.style.opacity = '1';
            slimeChar.element.style.top = '60%'; // 10vh 높임
            slimeChar.element.style.left = '50%';
            slimeChar.isActive = true;

            // 애니메이션 시작
            if (slimeChar.isPngSequence) {
                this.startAnimation(slimeChar);
            }
        }

        console.log(`🟢 Slime character shown: slime-idle (always idle)`);
    }

    // 캐릭터 숨기기 (포털 전환 시) - 실제로는 숨기지 않고 정리만
    hideCharacter() {
        console.log('👻 Preparing for section transition (not actually hiding)');
        console.log(`👻 Current section: ${this.currentSection}, character state: ${this.currentState}`);
        // this.switchToState('hidden'); // 제거: 실제로 숨기지 않음

        // Section-5에서 나갈 때 슬라임도 숨기기
        if (this.currentSection === 5) {
            this.hideSlimeCharacter();
        }

        // 모든 타이머 정리
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = null;
        }

        // 기존 섹션 전환 타이머 정리
        if (this.sectionTransitionTimer) {
            clearTimeout(this.sectionTransitionTimer);
            this.sectionTransitionTimer = null;
        }

        // 스크롤 상태 유지 (포털 전환 후 올바른 상태로 시작하기 위해)
        console.log(`👻 Preserving scroll state: isScrolling=${this.isScrolling}`);
    }

    // 통합된 섹션 움직임 처리 (모든 섹션에서 사용)
    updateSectionMovement(delta, yProgress, sectionIndex, startHeight) {
        // 현재 섹션과 다른 섹션의 움직임은 무시 (포털 전환 중 보호)
        if (sectionIndex !== this.currentSection) {
            console.log(`⚠️ Ignoring movement for Section-${sectionIndex} (current: Section-${this.currentSection})`);
            return;
        }

        // 스크롤 감지
        const wasScrolling = this.isScrolling;
        this.isScrolling = true;

        // 기존 타이머 클리어
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        // 스크롤 중일 때 run 상태로 전환
        if (!wasScrolling) {
            // hit-idle 상태에서는 즉시 일반 상태로 전환 (통합 시스템)
            if (this.isHitIdlePlaying) {
                // hit-idle의 현재 위치를 characterY로 설정 (50%에서 시작)
                this.characterY = 50;
                this.skipPositionUpdate = true; // 이번 프레임에서 위치 업데이트 스킵
                this.isHitIdlePlaying = false;
                this.hasFlower = true; // 꽃 아이템 획득!
                console.log('🌸 Hit-idle stopped for scroll, flower item acquired! Position preserved at 50%');
            }

            if (sectionIndex === 5) {
                // Section-5: 메인 캐릭터만 run 상태 (슬라임은 항상 idle 유지)
                this.switchToState('lee-run');
            } else {
                // 다른 섹션: 일반 run 상태
                this.switchToState('lee-run');
            }
        }

        // Y 위치 업데이트 (일반 캐릭터는 모든 섹션에서 동일)
        // hit-idle 전환 시에는 위치 업데이트 스킵
        if (!this.skipPositionUpdate) {
            if (sectionIndex === 2) {
                // Section2 특별 처리: 60%에서 시작하여 100%까지 이동
                // yProgress 0~1을 characterY 60%~100%로 매핑
                if (yProgress <= 1) {
                    this.characterY = 60 + (yProgress * 40); // 60% + (0~1 * 40%) = 60%~100%
                } else {
                    this.characterY = 100 + ((yProgress - 1) * 50); // 100%~125% (화면 밖)
                }
            } else {
                // 다른 섹션: -25%~100% (기존 로직)
                if (yProgress <= 1) {
                    const range = 100 - startHeight; // 이동 범위 계산
                    this.characterY = startHeight + (yProgress * range);
                } else {
                    this.characterY = 100 + ((yProgress - 1) * 50); // 화면 밖으로 이동
                }
            }
        } else {
            console.log('⏭️ Skipping position update to preserve hit-idle position');
            this.skipPositionUpdate = false; // 다음 프레임에서는 정상 업데이트
        }

        // 통합 캐릭터 위치 업데이트
        if (this.mainCharacter.isActive) {
            this.updateUnifiedCharacterPosition();

            // 화면 바깥으로 나갔을 때 시각적 표시
            if (this.characterY > 100) {
                console.log(`🚪 Character exiting screen (Section-${sectionIndex}): ${this.characterY.toFixed(1)}%`);
            } else if (this.characterY < 0) {
                console.log(`🔝 Character above screen (Section-${sectionIndex}): ${this.characterY.toFixed(1)}%`);
            }
        }

        // 텍스트 애니메이션 업데이트 (Section-3, Section-4에서)
        if (sectionIndex === 3) {
            this.updateTextAnimation(yProgress, 'groom-text');
        } else if (sectionIndex === 4) {
            this.updateTextAnimation(yProgress, 'bride-text');
        } else if (sectionIndex === 5) {
            // Section-5에서는 텍스트 애니메이션 없음, 슬라임 위치 유지
            this.updateSlimePosition();

            // 슬라임이 비활성화되었으면 다시 활성화 (hit-slime 이전에만)
            if (!this.hitSlimeTriggered) {
                const slimeChar = this.characters.get('slime-idle');
                if (slimeChar && slimeChar.element && !slimeChar.isActive) {
                    this.showSlimeCharacter();
                }
            }

            // 메인 캐릭터가 60vh 도달 체크 (hit-slime 트리거)
            console.log(`🎯 Section-5 update: characterY=${this.characterY.toFixed(1)}, triggered=${this.hitSlimeTriggered}, playing=${this.isHitSlimePlaying}`);
            this.checkHitSlimeTrigger();
        } else if (sectionIndex === 6) {
            // Section-6에서 갤러리 leafs 트리거 체크
            this.checkGalleryLeafsTrigger();
        } else if (sectionIndex === 8) {
            // Section-8 체크
            console.log('🏛️ Section-8 detected! sectionIndex:', sectionIndex);
        } else if (sectionIndex === 9) {
            // Section-9: song 상태 업데이트 (위치 + 애니메이션)
            console.log('🎵 Section-9 detected! Updating song state and position');
            this.updateSongState(yProgress);

            // Lee가 20vh(characterY = 20) 도달 시 idle-wow 트리거 체크
            this.checkIdleWowTrigger();

            // Lee가 50vh(characterY = 50) 도달 시 ending 트리거 체크
            this.checkEndingTrigger();
        }


        console.log(`🏃 Section-${sectionIndex} Character Y: ${this.characterY.toFixed(1)}% (progress: ${(yProgress * 100).toFixed(1)}%)`);

        // 스크롤 정지 감지 타이머 (화면 밖에서는 타이머 안 걸림)
        if (yProgress < 1.2) {
            if (this.scrollTimeout) {
                clearTimeout(this.scrollTimeout);
            }

            this.scrollTimeout = setTimeout(() => {
                // 타이머 실행 시점에 섹션이 바뀌었으면 무시 (포털 전환 보호)
                if (sectionIndex !== this.currentSection) {
                    console.log(`⚠️ Ignoring timeout for Section-${sectionIndex} (current: Section-${this.currentSection})`);
                    return;
                }

                this.isScrolling = false;
                console.log(`😴 Section-${sectionIndex} Scroll stopped - switching to idle`);

                if (sectionIndex === 5) {
                    // Section-5: 메인 캐릭터만 idle 상태 (슬라임은 항상 idle 유지)
                    this.switchToState('lee-idle');
                } else if (sectionIndex === 9) {
                    // Section-9: idle-wow 재생 중이면 Lee 처리 무시, Song은 별도 처리
                    if (this.isIdleWowPlaying) {
                        console.log('🎉 Section-9 scroll stopped - idle-wow playing, ignoring Lee transition');

                        // Song은 독립적으로 idle로 전환
                        const song = this.characters.get('song');
                        if (song) {
                            this.switchSongAnimation(song, 'song-idle');
                            console.log('🎵 Song set to idle (independent of idle-wow)');
                        }
                        return;
                    }

                    // Section-9: 일반 상태 - Lee와 Song 모두 idle로 전환
                    console.log('🎵 Section-9 scroll stopped - Lee to idle, Song to idle');

                    // Lee가 idle-wow 완료 상태라면 직접 wow-normal 사용
                    if (this.hasIdleWowCompleted) {
                        this.switchUnifiedAnimation('lee-idle-wow-normal');
                    } else if (this.hasLeafsFlowerDouble) {
                        this.switchUnifiedAnimation('lee-idle-leafsflowerdouble');
                    } else {
                        this.switchToState('lee-idle');
                    }

                    // Song 애니메이션만 idle로 변경 (위치 변경 없음)
                    const song = this.characters.get('song');
                    if (song) {
                        this.switchSongAnimation(song, 'song-idle');
                    }
                } else {
                    // 다른 섹션: 일반 lee idle 상태
                    this.switchToState('lee-idle');
                }
            }, 200); // 200ms 후 idle로 전환
        }
    }

    // 슬라임 캐릭터 숨기기 (Section-5에서 나갈 때)
    hideSlimeCharacter() {
        const slimeChar = this.characters.get('slime-idle');
        if (slimeChar && slimeChar.element) {
            slimeChar.element.style.opacity = '0';
            slimeChar.isActive = false;
            this.stopAnimation(slimeChar);
        }

        // slime-hurt도 숨기기
        const slimeHurtChar = this.characters.get('slime-hurt');
        if (slimeHurtChar && slimeHurtChar.element) {
            slimeHurtChar.element.style.opacity = '0';
            slimeHurtChar.isActive = false;
            this.stopAnimation(slimeHurtChar);
        }

        console.log(`🟢 Slime characters (idle/hurt) hidden`);
    }

    // 슬라임 상태 업데이트 (Section-5 전용)
    updateSlimeState(newState) {
        if (this.currentSection !== 5) return;

        // 기존 슬라임 캐릭터들 숨기기
        ['slime-idle', 'slime-run'].forEach(state => {
            const char = this.characters.get(state);
            if (char && char.element) {
                char.element.style.opacity = '0';
                char.isActive = false;
                this.stopAnimation(char);
            }
        });

        // 새로운 상태의 슬라임 표시
        const newSlimeChar = this.characters.get(newState);
        if (newSlimeChar && newSlimeChar.element) {
            newSlimeChar.element.style.opacity = '1';
            newSlimeChar.element.style.top = '70%';
            newSlimeChar.element.style.left = '50%';
            newSlimeChar.isActive = true;

            if (newSlimeChar.isPngSequence) {
                this.startAnimation(newSlimeChar);
            }
        }

        console.log(`🟢 Slime state updated to: ${newState}`);
    }

    // 슬라임 위치 유지 (Section-5에서 호출, 항상 idle 상태)
    updateSlimePosition() {
        // hit-slime 완료 후에는 슬라임을 더 이상 표시하지 않음
        if (this.hitSlimeTriggered) {
            return;
        }

        const slimeChar = this.characters.get('slime-idle');
        if (slimeChar && slimeChar.element && slimeChar.isActive) {
            slimeChar.element.style.top = '60%'; // 10vh 높임
            slimeChar.element.style.left = '50%';
        }
    }

    // Hit-slime 트리거 체크 (Section-5에서만)
    checkHitSlimeTrigger() {
        if (this.currentSection !== 5) return;
        if (this.hitSlimeTriggered || this.isHitSlimePlaying) return;

        console.log(`🔍 Checking hit-slime trigger: characterY=${this.characterY.toFixed(1)}, section=${this.currentSection}`);

        // 메인 캐릭터가 60vh 도달했는지 체크 (더 낮은 임계값으로 테스트)
        if (this.characterY >= 50) { // 60vh → 50vh로 임시 변경 (테스트용)
            console.log('💥 Hit-slime triggered at 50vh! (test threshold)');
            this.triggerHitSlimeAnimation();
        }
    }

    // Idle-wow 트리거 체크 (Section-9에서만)
    checkIdleWowTrigger() {
        if (this.currentSection !== 9) return;
        if (this.idleWowTriggered || this.isIdleWowPlaying) return;

        console.log(`🔍 Checking idle-wow trigger: characterY=${this.characterY.toFixed(1)}, section=${this.currentSection}`);

        // Lee가 20vh(characterY = 20) 도달했는지 체크
        if (this.characterY >= 20) {
            console.log('🎉 Idle-wow triggered at 20vh from top!');
            this.triggerIdleWowAnimation();
        }
    }

    // Ending 트리거 체크 (Section-9에서만)
    checkEndingTrigger() {
        if (this.currentSection !== 9) return;
        if (this.endingTriggered || this.isEndingPlaying) return;

        // 디버깅을 위해 더 자세한 로그 추가
        if (this.characterY >= 45) { // 45vh부터 로그 시작
            console.log(`🔍 Ending trigger check: characterY=${this.characterY.toFixed(1)}vh, section=${this.currentSection}, triggered=${this.endingTriggered}, playing=${this.isEndingPlaying}`);
        }

        // Lee가 50vh(characterY = 50) 도달했는지 체크
        if (this.characterY >= 50) {
            console.log('🎬 ENDING TRIGGERED at 50vh!');
            this.triggerEndingAnimation();
        }
    }

    // Ending 애니메이션 실행
    triggerEndingAnimation() {
        this.endingTriggered = true;
        this.isEndingPlaying = true;

        // 스크롤 잠금
        if (window.manualScrollManager) {
            window.manualScrollManager.lockScroll('ending animation');
        }

        // 통합 캐릭터 완전히 숨기기
        this.hideUnifiedCharacter();

        // Lee 개별 캐릭터들도 모두 숨기기
        const leeCharacters = ['lee-idle', 'lee-run', 'lee-idle-wow', 'lee-idle-flower', 'lee-run-flower', 'lee-idle-leafsflowerdouble', 'lee-run-leafsflowerdouble'];
        leeCharacters.forEach(charId => {
            const char = this.characters.get(charId);
            if (char) {
                char.visible = false;
                char.element.style.opacity = '0';
                char.element.style.display = 'none';
                char.element.style.visibility = 'hidden';
                console.log(`👻 Hidden Lee character: ${charId}`);
            }
        });

        // Song 캐릭터도 숨기기
        const song = this.characters.get('song');
        if (song) {
            song.visible = false;
            song.element.style.opacity = '0';
            song.element.style.display = 'none';
            song.element.style.visibility = 'hidden';
            console.log('👻 Hidden Song character');
        }

        // Ending 애니메이션 데이터가 로드되었는지 확인
        const endingChar = this.characters.get('ending');
        if (!endingChar) {
            console.error('❌ Ending character not found');
            return;
        }

        if (!endingChar.spreadsheetData) {
            console.log('🔄 Ending data not loaded, loading now...');
            this.loadEndingAnimationData().then(() => {
                this.startEndingAnimation();
            }).catch(error => {
                console.error('❌ Failed to load ending data:', error);
                // 실패 시 스크롤 잠금 해제
                if (window.manualScrollManager) {
                    window.manualScrollManager.unlockScroll('ending animation failed');
                }
            });
        } else {
            this.startEndingAnimation();
        }

        console.log('🎬 Ending animation started, scroll locked');
    }

    // Ending 애니메이션 시작
    startEndingAnimation() {
        const endingChar = this.characters.get('ending');
        if (!endingChar) {
            console.error('❌ Ending character not found');
            return;
        }

        // Ending 캐릭터 표시 (강력한 스타일 적용)
        endingChar.visible = true;
        endingChar.element.style.opacity = '1';
        endingChar.element.style.display = 'block';
        endingChar.element.style.visibility = 'visible';
        endingChar.element.style.top = '50%';
        endingChar.element.style.left = '50%';
        endingChar.element.style.zIndex = '2000';
        endingChar.element.style.position = 'absolute';
        endingChar.element.style.width = 'auto';
        endingChar.element.style.height = 'auto';


        // 스프레드시트 애니메이션을 위한 img 요소 확인
        if (!endingChar.img) {
            endingChar.img = endingChar.element.querySelector('img');
        }

        console.log('🎬 Starting ending animation...', {
            hasSpreadsheetData: !!endingChar.spreadsheetData,
            hasImg: !!endingChar.img,
            visible: endingChar.visible,
            elementStyle: endingChar.element.style.cssText
        });

        // 스프레드시트 애니메이션 시작
        this.startSpreadsheetAnimation(endingChar);

        console.log('🎬 Ending animation playing...');
    }

    // Ending 애니메이션 완료 처리
    onEndingAnimationComplete() {
        console.log('🎬 Ending animation completed!');

        this.isEndingPlaying = false;

        // Ending 캐릭터를 마지막 프레임에 계속 표시 (숨기지 않음)
        const endingChar = this.characters.get('ending');
        if (endingChar) {
            // 애니메이션은 중단하지만 캐릭터는 계속 보이게 유지
            endingChar.visible = true;
            endingChar.element.style.display = 'block';
            endingChar.element.style.opacity = '1';
            console.log('🎬 Ending character remains visible at final frame');
        }

        // ending.jpg 이미지를 화면에 cover로 표시
        this.showEndingImage();

        // 스크롤 잠금 해제
        if (window.manualScrollManager) {
            window.manualScrollManager.unlockScroll('ending animation completed');
        }

        console.log('🎬 Ending animation completed, scroll unlocked, ending image displayed');
    }

    // ending.jpg 이미지를 화면에 cover로 표시
    showEndingImage() {
        // 기존 ending 이미지가 있으면 제거
        const existingEndingImg = document.getElementById('ending-cover-image');
        if (existingEndingImg) {
            existingEndingImg.remove();
        }

        // ending.jpg를 화면 전체에 cover로 표시
        const endingImg = document.createElement('div');
        endingImg.id = 'ending-cover-image';
        endingImg.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-image: url('/images/gallery/ending.png');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            z-index: 9999;
            pointer-events: none;
        `;

        // body에 추가 (최상위 레이어)
        document.body.appendChild(endingImg);

        console.log('🎬 Ending cover image displayed');
    }

    // Hit-slime 애니메이션 실행
    triggerHitSlimeAnimation() {
        this.hitSlimeTriggered = true;
        this.isHitSlimePlaying = true;

        // 스크롤 잠금
        if (window.manualScrollManager) {
            window.manualScrollManager.lockScroll('hit-slime animation');
        }

        // 통합 캐릭터 (lee-idle/lee-run) 숨기기
        this.hideUnifiedCharacter();
        console.log(`🫥 Unified character hidden for hit-slime`);

        // 슬라임은 6번째 프레임까지 계속 보임 (여기서 숨기지 않음)

        // Hit-slime 애니메이션 표시 및 실행
        const hitSlimeChar = this.characters.get('hit-slime');
        if (hitSlimeChar) {
            hitSlimeChar.element.style.opacity = '1';
            hitSlimeChar.element.style.top = '50%'; // 20vh 높임
            hitSlimeChar.element.style.left = '50%';
            hitSlimeChar.isActive = true;

            // 애니메이션 시작 (한 번만 재생)
            this.startHitSlimeAnimation(hitSlimeChar);
        }

        console.log('💥 Hit-slime animation started, scroll locked');
    }

    // Idle-wow 애니메이션 실행
    triggerIdleWowAnimation() {
        this.idleWowTriggered = true;
        this.isIdleWowPlaying = true;

        // 스크롤 잠금
        if (window.manualScrollManager) {
            window.manualScrollManager.lockScroll('idle-wow animation');
        }

        // 통합 캐릭터가 활성화되어 있는지 확인
        console.log('🎯 Current unified character:', {
            'isActive': this.mainCharacter?.isActive,
            'currentAnimation': this.mainCharacter?.currentAnimation
        });

        if (this.mainCharacter?.isActive) {
            // 위치 유지하면서 idle-wow 애니메이션으로 전환 (Lee만)
            this.switchToIdleWow();
        } else {
            console.log('❌ No active unified character found for idle-wow transition');
        }

        console.log('🎉 Idle-wow animation started, scroll locked');
    }

    // Lee 캐릭터를 idle-wow로 전환 (통합 캐릭터 시스템)
    switchToIdleWow() {
        // 기존 통합 캐릭터 애니메이션 정지하지만 숨기지는 않음 (위치 유지)
        if (this.mainCharacter.animationTimer) {
            cancelAnimationFrame(this.mainCharacter.animationTimer);
        }

        // idle-wow 상태 초기화
        this.idleWowPhase = 1;
        this.idleWowRepeatCount = 0;

        // idle-wow 애니메이션으로 전환 (통합 시스템 사용)
        this.switchUnifiedAnimation('lee-idle-wow');

        console.log('🎉 Switched to idle-wow animation via unified character system (Phase 1: 1~15)');
    }

    // Idle-wow 애니메이션 완료 처리 (통합 캐릭터 시스템)
    onIdleWowAnimationComplete() {
        console.log('🎉 Idle-wow animation completed via unified system!');

        this.isIdleWowPlaying = false;
        this.hasIdleWowCompleted = true; // idle-wow 완료 상태로 설정

        // 스크롤 잠금 해제
        if (window.manualScrollManager) {
            window.manualScrollManager.unlockScroll('idle-wow animation completed');
        }

        // 먼저 idle-wow-normal로 전환 (leafsflowerdouble는 나중에)
        this.switchUnifiedAnimation('lee-idle-wow-normal');

        console.log('🎉 Idle-wow completed, switched to idle-wow-normal mode');
    }

    // idle-wow 프레임 로직 처리: 1~15 → 11~15를 5회 반복
    handleIdleWowFrameLogic() {
        if (this.idleWowPhase === 1) {
            // Phase 1: 1~15 프레임 완료 체크
            if (this.mainCharacter.currentFrame >= 15) {
                console.log('🎉 Phase 1 complete (1~15), starting Phase 2 (11~15 x5)');
                this.idleWowPhase = 2;
                this.idleWowRepeatCount = 0;
                this.mainCharacter.currentFrame = 10; // 11번째 프레임 (index 10)
            }
        } else if (this.idleWowPhase === 2) {
            // Phase 2: 11~15 프레임 반복 (5회)
            if (this.mainCharacter.currentFrame >= 15) {
                this.idleWowRepeatCount++;
                console.log(`🔄 Repeat ${this.idleWowRepeatCount}/5 complete (11~15)`);

                if (this.idleWowRepeatCount >= 2) {
                    // 5회 반복 완료 → 애니메이션 종료
                    console.log('🎉 All repeats complete! Ending idle-wow animation');
                    this.onIdleWowAnimationComplete();
                    return; // 애니메이션 종료
                } else {
                    // 다음 반복을 위해 11번째 프레임으로 리셋
                    this.mainCharacter.currentFrame = 10; // 11번째 프레임 (index 10)
                }
            }
        }
    }

    // Hit-slime 애니메이션 시작 (한 번만 재생)
    startHitSlimeAnimation(character) {
        if (character.animationInterval || character.animationTimeout) {
            this.stopAnimation(character);
        }

        character.isActive = true;
        character.currentFrame = 0;

        const frameInterval = 1000 / character.frameRate;
        let frameCount = 0;

        const animateFrame = () => {
            this.updateFrame(character);
            frameCount++;

            // 6번째 프레임에서 slime을 slime-hurt로 전환
            if (frameCount === 6) {
                console.log('💥 Frame 6 reached - switching slime to hurt animation');
                this.switchSlimeToHurt();
            }

            // 모든 프레임 재생 완료
            if (frameCount >= character.frameCount) {
                this.onHitSlimeAnimationComplete();
            } else {
                character.animationTimeout = setTimeout(animateFrame, frameInterval);
            }
        };

        // 첫 프레임 즉시 표시
        this.updateFrame(character);
        frameCount = 1; // 명시적으로 1로 설정

        if (frameCount < character.frameCount) {
            character.animationTimeout = setTimeout(animateFrame, frameInterval);
        } else {
            this.onHitSlimeAnimationComplete();
        }
    }

    // Hit-slime 애니메이션 완료 처리
    onHitSlimeAnimationComplete() {
        console.log('💥 Hit-slime animation completed, starting hit-idle');

        this.isHitSlimePlaying = false;

        // Hit-slime 애니메이션 숨기기
        const hitSlimeChar = this.characters.get('hit-slime');
        if (hitSlimeChar) {
            hitSlimeChar.element.style.opacity = '0';
            hitSlimeChar.isActive = false;
            this.stopAnimation(hitSlimeChar);
        }

        // hit-idle 애니메이션 시작 (통합 시스템)
        this.isHitIdlePlaying = true;
        this.characterY = 65; // 10vh 아래로 이동 (50 -> 60)

        // 기존 개별 캐릭터들 숨기기
        this.characters.forEach((char, id) => {
            if (id.startsWith('slime-')) return; // 슬라임은 별도 관리
            this.stopAnimation(char);
            char.element.style.opacity = '0';
        });

        // 통합 캐릭터 다시 보이기
        this.showUnifiedCharacter();
        console.log('👀 Unified character restored after hit-slime');

        // 통합 캐릭터로 hit-idle 시작
        this.switchUnifiedAnimation('hit-idle');
        this.updateUnifiedCharacterPosition();
        console.log('🧘 Hit-idle animation started (unified system)');

        // 슬라임은 더 이상 표시하지 않음 (제거됨)
        console.log('🚫 Slime permanently removed after hit-slime animation');

        // 스크롤 잠금 해제
        if (window.manualScrollManager) {
            window.manualScrollManager.unlockScroll('hit-slime animation complete');
        }
    }

    // 슬라임을 hurt 애니메이션으로 전환 (hit-slime 6프레임에서)
    switchSlimeToHurt() {
        // 기존 slime-idle 숨기기 (이미 숨겨져 있지만 확실히)
        const slimeIdleChar = this.characters.get('slime-idle');
        if (slimeIdleChar) {
            slimeIdleChar.element.style.opacity = '0';
            slimeIdleChar.isActive = false;
            this.stopAnimation(slimeIdleChar);
        }

        // slime-hurt 애니메이션 표시 (한 번만 실행)
        const slimeHurtChar = this.characters.get('slime-hurt');
        if (slimeHurtChar) {
            slimeHurtChar.element.style.opacity = '1';
            slimeHurtChar.element.style.top = '60%'; // hit-slime과 동일한 높이
            slimeHurtChar.element.style.left = '50%';
            slimeHurtChar.isActive = true;

            // 한 번만 재생하는 애니메이션 시작
            this.startSinglePlayAnimation(slimeHurtChar);
            console.log('🤕 Slime switched to hurt animation (single play)');
        }
    }

    // 슬라임을 idle로 복원 (hit-slime 완료 후)
    restoreSlimeIdle() {
        // slime-hurt 숨기기
        const slimeHurtChar = this.characters.get('slime-hurt');
        if (slimeHurtChar) {
            slimeHurtChar.element.style.opacity = '0';
            slimeHurtChar.isActive = false;
            this.stopAnimation(slimeHurtChar);
        }

        // 일반 슬라임 idle 다시 표시
        this.showSlimeCharacter();
        console.log('😌 Slime restored to idle animation');
    }

    // 한 번만 재생하는 애니메이션 (slime-hurt용)
    startSinglePlayAnimation(character) {
        if (character.animationInterval || character.animationTimeout) {
            this.stopAnimation(character);
        }

        character.isActive = true;
        character.currentFrame = 0;

        const frameInterval = 1000 / character.frameRate;
        let frameCount = 0;

        const animateFrame = () => {
            this.updateFrame(character);
            frameCount++;

            // 모든 프레임 재생 완료 시 정지 (반복 없음)
            if (frameCount >= character.frameCount) {
                console.log(`🛑 ${character.framePrefix} animation completed (single play)`);
                // 마지막 프레임에서 정지, 숨기지 않음
                return;
            } else {
                character.animationTimeout = setTimeout(animateFrame, frameInterval);
            }
        };

        // 첫 프레임 즉시 표시
        this.updateFrame(character);
        frameCount++;

        if (frameCount < character.frameCount) {
            character.animationTimeout = setTimeout(animateFrame, frameInterval);
        }
    }

    // 텍스트 애니메이션 업데이트 (진행도 기반)
    updateTextAnimation(progress, textElementId) {
        const textElement = document.getElementById(textElementId);
        if (!textElement) return;

        // 새로운 div 블록 기반 애니메이션
        const divBlocks = textElement.querySelectorAll('div');
        const totalBlocks = divBlocks.length; // 4개 블록 (빈 div 포함)

        // 30~70% 구간에서만 블록 표시
        const startProgress = 0.3; // 30%
        const endProgress = 0.7;   // 70%

        let blocksToShow = 0;

        if (progress >= startProgress && progress <= endProgress) {
            // 30~70% 구간을 블록 수만큼 나누기
            const animationProgress = (progress - startProgress) / (endProgress - startProgress); // 0~1
            blocksToShow = Math.floor(animationProgress * totalBlocks) + 1; // 1부터 시작
            blocksToShow = Math.min(blocksToShow, totalBlocks); // 최대값 제한
        } else if (progress > endProgress) {
            // 70% 이후에는 모든 블록 표시
            blocksToShow = totalBlocks;
        }

        // 블록별 표시/숨김 처리
        divBlocks.forEach((block, index) => {
            if (index < blocksToShow) {
                block.style.opacity = '1';
                block.style.transform = 'translateY(0)';
                block.style.transition = 'opacity 0.15s ease-out, transform 0.15s ease-out';
            } else {
                block.style.opacity = '0';
                block.style.transform = 'translateY(10px)';
                block.style.transition = 'opacity 0.15s ease-out, transform 0.15s ease-out';
            }
        });

        const sectionName = textElementId === 'groom-text' ? 'Section-3 (초대장)' : 'Section-4 (신부)';
        console.log(`✏️ ${sectionName} Text animation: showing ${blocksToShow}/${totalBlocks} blocks (${(progress * 100).toFixed(1)}% progress)`);
    }

    // 호환성을 위한 기존 메서드들
    updateCharacterMovement(delta, yProgress) {
        this.updateSectionMovement(delta, yProgress, 2, 60);
    }

    updateSection3Movement(delta, yProgress) {
        this.updateSectionMovement(delta, yProgress, 3, -25);
    }

    // 호환성을 위한 기존 메서드들 (더이상 사용하지 않음)
    updateCharacterByManualScroll(progress) {
        // 새로운 시스템에서는 updateCharacterMovement 사용
        console.log('📢 Deprecated method called - use updateCharacterMovement instead');
    }

    handleSectionTransition(targetSection) {
        // 새로운 시스템에서는 playMainAnimation 또는 switchToIdleState 사용
        console.log('📢 Deprecated method called - use playMainAnimation or switchToIdleState');
        this.currentSection = targetSection;
    }

    // 외부에서 호출 가능한 메서드들
    triggerCharacter(id, show = true) {
        const character = this.characters.get(id);
        if (character) {
            if (show) {
                this.switchToState(id);
            } else {
                character.element.style.opacity = '0';
                this.stopAnimation(character);
            }
        }
    }

    updateCharacter(id, properties) {
        const character = this.characters.get(id);
        if (!character) return;

        Object.assign(character, properties);

        // 스타일 업데이트
        if (properties.x) character.element.style.left = character.x;
        if (properties.y) character.element.style.top = character.y;
        if (properties.scale) {
            character.element.style.transform =
                `translate(-50%, -50%) scale(${character.scale})`;
        }
    }

    // 갤러리 하단에서 leafs 애니메이션 트리거 체크
    checkGalleryLeafsTrigger() {
        // Section-6이 아니거나 이미 트리거되었으면 return
        if (this.currentSection !== 6 || this.galleryLeafsTriggered) {
            return;
        }

        // 갤러리 그리드 컨테이너 위치 정보 가져오기
        const galleryGrid = document.querySelector('.gallery-grid');
        if (!galleryGrid) {
            return;
        }

        const gridRect = galleryGrid.getBoundingClientRect();

        // 갤러리 그리드 하단 중앙 위치 계산
        const targetY = gridRect.bottom / window.innerHeight * 100;
        const centerX = 50; // 화면 정중앙

        // 캐릭터가 해당 위치에 도달했는지 체크 (±5% 오차 허용)
        const characterYPercent = this.characterY;

        if (Math.abs(characterYPercent - targetY) <= 5) {
            console.log(`🍃 Gallery leafs trigger activated! Character Y: ${characterYPercent}%, Target Y: ${targetY}%, Center X: ${centerX}%`);
        console.log(`🍃 Gallery grid rect: left=${gridRect.left}px, width=${gridRect.width}px, center=${gridRect.left + gridRect.width / 2}px`);
            this.triggerGalleryLeafs(centerX, targetY);
            this.switchToLeafsAnimations();
        }
    }

    // 애니메이션을 leafs 버전으로 전환
    switchToLeafsAnimations() {
        // 현재 애니메이션 상태 확인
        const currentAnimation = this.mainCharacter.currentAnimation;
        let newAnimation = null;

        if (currentAnimation === 'lee-run' || currentAnimation === 'lee-run-flower') {
            newAnimation = 'lee-run-leafsflower';
        } else if (currentAnimation === 'lee-idle' || currentAnimation === 'lee-idle-flower') {
            newAnimation = 'lee-idle-leafs';
        }

        if (newAnimation && currentAnimation !== newAnimation) {
            console.log(`🌿 Switching animation: ${currentAnimation} → ${newAnimation}`);
            this.switchUnifiedAnimation(newAnimation);
        }
    }

    // 갤러리 leafs 애니메이션 실행
    triggerGalleryLeafs(x, y) {
        this.galleryLeafsTriggered = true;

        const leafsChar = this.characters.get('leafs');
        if (!leafsChar) {
            console.error('❌ Leafs character not found!');
            return;
        }

        // leafs 위치 설정 - 화면 정중앙
        const leftPx = (window.innerWidth / 2); // 화면 절반
        const topPx = (y / 100) * window.innerHeight + (window.innerHeight * 0.05);

        leafsChar.element.style.left = `${leftPx}px`;
        leafsChar.element.style.top = `${topPx}px`;
        leafsChar.element.style.opacity = '1';
        leafsChar.element.style.visibility = 'visible';
        leafsChar.isActive = true;

        console.log(`🍃 Leafs animation started at center position: (${leftPx}px, ${topPx}px)`);
        console.log(`🍃 Screen: ${window.innerWidth}x${window.innerHeight}, Center X: ${window.innerWidth / 2}px`);

        // 애니메이션 시작
        this.startAnimation(leafsChar);

        // 애니메이션 완료 후 숨기기 (7프레임 * 1000/8fps = 875ms)
        setTimeout(() => {
            leafsChar.element.style.opacity = '0';
            leafsChar.isActive = false;
            console.log('🍃 Leafs animation completed');
        }, 875);
    }

    // Enemy Hit 애니메이션 트리거 (캐릭터와 별개로 동작)
    triggerEnemyRun() {
        console.log('🏃 triggerEnemyRun function called!');
        console.log('🏃 Triggering enemy_run animation');

        // enemy_run 전용 IMG 엘리먼트 생성
        const enemyRunElement = document.createElement('img');
        enemyRunElement.src = 'groom/public/animation/enemy_run/enemy_run1.png'; // 첫 번째 프레임

        const enemyRunChar = {
            element: enemyRunElement,
            basePath: 'groom/public/animation/enemy_run/',
            isActive: true
        };

        // enemy_run 캐릭터를 10vh 아래에 위치, 3배 크기로 설정
        enemyRunChar.element.style.position = 'fixed';
        enemyRunChar.element.style.left = '50%';
        enemyRunChar.element.style.top = '10vh';
        enemyRunChar.element.style.transform = 'translateX(-50%) scale(3)'; // 32px * 3 = 96px와 동일
        enemyRunChar.element.style.imageRendering = 'pixelated';
        enemyRunChar.element.style.imageRendering = '-moz-crisp-edges';
        enemyRunChar.element.style.imageRendering = 'crisp-edges';
        enemyRunChar.element.style.opacity = '1';
        enemyRunChar.element.style.zIndex = '99999';
        enemyRunChar.element.style.display = 'block';
        enemyRunChar.element.style.visibility = 'visible';
        enemyRunChar.element.style.pointerEvents = 'none';

        // DOM에 추가
        document.body.appendChild(enemyRunElement);

        console.log('🏃 Enemy-run element created:', enemyRunChar.element);

        // enemy_run 애니메이션 실행 (6프레임, 반복)
        this.startEnemyRunAnimation(enemyRunChar);

        console.log('🏃 Enemy-run animation started');
    }

    // Enemy Run 전용 애니메이션 함수
    startEnemyRunAnimation(character) {
        if (!character || !character.element) return;

        let currentFrame = 1;
        const totalFrames = 6; // enemy_run1.png ~ enemy_run6.png
        const frameInterval = 100; // 100ms 간격
        let currentY = 10; // 10vh에서 시작

        character.isActive = true;

        const animateFrame = () => {
            if (!character.isActive) {
                return;
            }

            // 프레임 업데이트
            const imageSrc = `${character.basePath}enemy_run${currentFrame}.png`;
            character.element.src = imageSrc;

            // 위로 이동 (매 프레임마다 1vh씩 위로)
            currentY -= 1;
            character.element.style.top = `${currentY}vh`;

            // 화면 위쪽으로 완전히 사라지면 enemy-hit 실행
            if (currentY < -15) {
                character.isActive = false;
                this.triggerEnemyHitSequence();
                return;
            }

            // 다음 프레임으로
            currentFrame++;
            if (currentFrame > totalFrames) {
                currentFrame = 1;
            }

            // 다음 프레임 스케줄링 (반복 실행)
            setTimeout(() => requestAnimationFrame(animateFrame), frameInterval);
        };

        // 애니메이션 시작
        requestAnimationFrame(animateFrame);
    }

    // Enemy Hit 시퀀스 (3개 이미지를 순서대로 표시)
    triggerEnemyHitSequence() {
        console.log('💥 Starting enemy-hit sequence');

        const positions = [
            { top: '0vh', image: 1 },      // 화면 최상단
            { top: '70vh', image: 2 },     // 70vh 위치
            { top: '100vh', image: 3 }     // 화면 맨끝
        ];

        let currentIndex = 0;
        const frameInterval = 50; // 더 빠른 프레임 (50ms)

        const showNextHit = () => {
            if (currentIndex >= positions.length) {
                // 모든 enemy-hit 완료 후 지진 효과
                console.log('💥 Enemy-hit sequence completed, starting earthquake');
                this.triggerEarthquakeFromPixel();
                return;
            }

            const pos = positions[currentIndex];
            this.createEnemyHitElement(pos.top, pos.image);
            currentIndex++;

            // 다음 hit을 스케줄링
            setTimeout(showNextHit, frameInterval);
        };

        // 시퀀스 시작
        showNextHit();
    }

    // 개별 Enemy Hit 엘리먼트 생성
    createEnemyHitElement(topPosition, imageNumber) {
        const enemyHitElement = document.createElement('img');
        enemyHitElement.src = `groom/public/animation/enemy-hit/enemy-hit${imageNumber}.png`;
        enemyHitElement.style.position = 'fixed';
        enemyHitElement.style.left = '50%';
        enemyHitElement.style.top = topPosition;
        enemyHitElement.style.transform = 'translateX(-50%) scale(3)'; // 32px * 3 = 96px와 동일
        enemyHitElement.style.imageRendering = 'pixelated';
        enemyHitElement.style.imageRendering = '-moz-crisp-edges';
        enemyHitElement.style.imageRendering = 'crisp-edges';
        enemyHitElement.style.zIndex = '99999';
        enemyHitElement.style.opacity = '1';
        enemyHitElement.style.pointerEvents = 'none';

        document.body.appendChild(enemyHitElement);

        // 50ms 후 제거 (다음 hit이 나오기 전에 제거)
        setTimeout(() => {
            if (enemyHitElement.parentNode) {
                enemyHitElement.parentNode.removeChild(enemyHitElement);
            }
        }, 50);

        console.log(`💥 Enemy-hit${imageNumber} displayed at ${topPosition}`);
    }

    // 픽셀 캐릭터에서 직접 지진 효과 트리거
    triggerEarthquakeFromPixel() {
        // ManualScrollManager의 지진 효과를 직접 호출
        if (window.manualScrollManager && window.manualScrollManager.triggerEarthquakeEffect) {
            window.manualScrollManager.triggerEarthquakeEffect();
        } else {
            // 직접 지진 효과 구현
            this.executeEarthquake();
        }
    }

    // 지진 효과 직접 구현
    executeEarthquake() {
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
                if (window.manualScrollManager) {
                    window.manualScrollManager.scrollLocked = false;
                    window.manualScrollManager.lockReason = '';
                    console.log('🔓 Scroll unlocked after Section8 animation complete');

                    // 캐릭터 애니메이션을 leafsflowerdouble 버전으로 변경
                    window.manualScrollManager.switchToLeafsFlowerDouble();
                } else {
                    // manualScrollManager가 없으면 직접 애니메이션 변경
                    this.switchToLeafsFlowerDoubleFromPixel();
                }
                console.log('🌍 Earthquake effect completed');
            }
        };
        requestAnimationFrame(shake);
    }

    // 픽셀 캐릭터에서 직접 leafsflowerdouble로 전환
    switchToLeafsFlowerDoubleFromPixel() {
        console.log('🌸 Switching to leafsflowerdouble from pixel manager');

        // leafsflowerdouble 플래그 설정
        this.hasLeafsFlowerDouble = true;
        console.log('🌸✨ LeafsFlowerDouble flag activated!');

        // 현재 상태 다시 적용하여 새 애니메이션으로 전환
        if (this.currentState === 'lee-idle' || this.currentState === 'lee-run') {
            const currentState = this.currentState;
            this.switchToState(currentState);
        }

        console.log('🌸 LeafsFlowerDouble upgrade completed');
    }

    // Enemy Hit 전용 애니메이션 함수 (기존 함수 유지)
    startEnemyHitAnimation(character) {
        if (!character || !character.element) return;

        let currentFrame = 1;
        const totalFrames = 2; // enemy-hit1.png, enemy-hit2.png
        const frameInterval = 125; // 125ms 간격 (2배 빠르게)

        character.isActive = true;
        let animationCount = 0;
        const maxAnimations = totalFrames; // 2프레임만 재생하고 끝

        const animateFrame = () => {
            if (!character.isActive || animationCount >= maxAnimations) {
                character.isActive = false;
                return;
            }

            const imagePath = `groom/public/animation/enemy-hit/enemy-hit${currentFrame}.png`;
            character.element.src = imagePath;

            currentFrame = currentFrame >= totalFrames ? 1 : currentFrame + 1;
            animationCount++;

            if (animationCount < maxAnimations) {
                setTimeout(animateFrame, frameInterval);
            } else {
                character.isActive = false;
            }
        };

        // 첫 프레임으로 시작
        animateFrame();
    }

    // Section-9: song 통합 캐릭터 상태 업데이트 (위치 + 애니메이션)
    updateSongState(yProgress) {
        const song = this.characters.get('song');

        if (!song || !song.element) {
            console.log('🎵 song character not found');
            return;
        }

        // 첫 진입시 활성화
        if (!song.isActive) {
            song.isActive = true;
            song.element.style.opacity = '1';
            song.element.style.visibility = 'visible';
            song.element.style.display = 'block';
            this.startAnimation(song);
            console.log('🎵 song character activated');
        }

        // Song Y 위치 계산 (Lee와 완전히 동일한 로직, 방향만 반대)
        // Lee: startHeight(-25) → 100% (위에서 아래로)
        // Song: startHeight(125) → 0% (아래에서 위로)
        const startHeight = 125; // 화면 아래 바깥에서 시작 (Lee의 -25와 반대)

        // Lee와 동일한 계산 로직
        if (yProgress <= 1) {
            const range = 0 - startHeight; // Lee: 125, Song: -125 (음수 = 반대 방향)
            this.songY = startHeight + (yProgress * range);
        } else {
            this.songY = 0 - ((yProgress - 1) * 50); // 화면 위 바깥으로 이동
        }

        // 위치 업데이트 (Lee와 동일)
        song.element.style.top = `${this.songY}%`;
        song.element.style.left = '50%';
        song.element.style.transform = 'translate(-50%, -50%) scale(4)';

        // 애니메이션 상태에 따라 전환
        const shouldShowRun = this.isScrolling;
        const targetAnimation = shouldShowRun ? 'song-run' : 'song-idle';

        this.switchSongAnimation(song, targetAnimation);

        console.log(`🎵 Song Y: ${this.songY.toFixed(1)}% (progress: ${(yProgress * 100).toFixed(1)}%), animation=${targetAnimation}`);
    }

    // Song 애니메이션 전환 (하나의 캐릭터에서)
    switchSongAnimation(song, targetAnimation) {
        if (song.currentAnimation === targetAnimation) {
            return; // 이미 같은 애니메이션
        }

        // 기존 애니메이션 정지
        if (song.animationInterval) {
            clearInterval(song.animationInterval);
        }

        // 새 애니메이션 설정
        if (targetAnimation === 'song-idle') {
            song.framePrefix = 'groom/public/animation/song-idle/song-idle';
            song.frameCount = 5;
            song.frameRate = 8;
            song.element.style.opacity = '1';  // opacity 명시적 설정
        } else if (targetAnimation === 'song-run') {
            song.framePrefix = 'groom/public/animation/song-run/song-run';
            song.frameCount = 7;
            song.frameRate = 12;
        }

        song.currentAnimation = targetAnimation;
        song.currentFrame = 0;

        // 애니메이션 재시작
        this.startAnimation(song);
        console.log(`🎵 Song switched to: ${targetAnimation}`);
    }

    // 현재 상태 정보
    getState() {
        return {
            currentState: this.currentState,
            currentSection: this.currentSection,
            activeCharacters: Array.from(this.characters.keys()).filter(
                id => this.characters.get(id).isActive
            )
        };
    }
}

export default SimplePixelCharacterManager;