// 간소화된 픽셀 캐릭터 시스템 - 수동 스크롤과 연동

class SimplePixelCharacterManager {
    constructor() {
        this.characters = new Map();
        this.container = null;
        this.currentState = 'hidden'; // 'hidden', 'main', 'ha-idle', 'ha-run
        this.currentSection = 0;
        this.characterY = -25; // Ha 캐릭터 Y 위치 (퍼센트, 최상단에서 시작)
        this.songY = 125; // Song 캐릭터 Y 위치 (퍼센트, Lee와 반대 방향)
        this.isScrolling = false;
        this.scrollTimeout = null;
        this.mainAnimationCallback = null; // 메인 애니메이션 완료 콜백
        this.hitRabbitTriggered = false; // hit-rabbit 애니메이션 트리거 여부
        this.isHitRabbitPlaying = false; // hit-rabbit 애니메이션 재생 중 여부
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
        this.wreathTriggered = false; // wreath 애니메이션 트리거 여부
        this.isWreathPlaying = false; // wreath 애니메이션 재생 중 여부
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
        this.criticalAnimations = ['ha-idle', 'ha-run']; // Section 0-1에서 즉시 필요
        this.backgroundAnimations = [
            'ha-idle-wow', 'ha-idle-wow-normal', 'ha-idle-flowers', 'ha-run-flowers',
            'hit-idle', 'hit-rabbit', 'ha-idle-leafs', 'ha-run-leafs',
            'ha-idle-flowers', 'ha-run-flowers'
        ]; // 나중에 필요한 것들

        // 애니메이션 상태들 먼저 정의
        this.animationStates = {
            'ha-idle': {
                framePrefix: 'bride/public/animation/ha-idle/ha-idle',
                frameCount: 14, // ha-idle1.png ~ ha-idle14.png
                frameRate: 12,
                loop: true
            },
            'ha-run': {
                framePrefix: 'bride/public/animation/ha-run/ha-run',
                frameCount: 7, // ha-run1.png ~ ha-run7.png
                frameRate: 18,
                loop: true
            },
            'ha-idle-wow': {
                framePrefix: 'bride/public/animation/idle-wow/idle-wow',
                frameCount: 15, // idle-wow1.png ~ idle-wow15.png
                frameRate: 12, // 10 → 20 (두배 빠르게)
                loop: false // 커스텀 반복 로직 사용
            },
            'ha-idle-wow-normal': {
                framePrefix: 'bride/public/animation/idle-wow-normal/idle-wow-normal',
                frameCount: 5, // idle-wow-normal1.png, idle-wow-normal2.png (기본 idle과 유사)
                frameRate: 8,
                loop: true
            },
            'ha-idle-flowers': {
                framePrefix: 'animation/ha-idle-flowers/ha-idle-flowers',
                frameCount: 14,
                frameRate: 12,
                loop: true
            },
            'ha-run-flowers': {
                framePrefix: 'animation/ha-run-flowers/ha-run-flowers',
                frameCount: 8,
                frameRate: 18,
                loop: true
            },
            'hit-idle': {
                framePrefix: 'bride/public/animation/hit-idle/hit-idle',
                frameCount: 5,
                frameRate: 15, // 8 → 15
                loop: true
            },
            'ha-idle-leafs': {
                framePrefix: 'animation/ha-idle-leafs/ha-idle-leafs',
                frameCount: 14,
                frameRate: 12,
                loop: true
            },
            'ha-run-leafs': {
                framePrefix: 'animation/ha-run-leafs/ha-run-leafs',
                frameCount: 8,
                frameRate: 18,
                loop: true
            },
        };

        // 각 애니메이션의 IMG 태그들 생성
        await this.createFrameImages();

        // 중요 애니메이션만 먼저 로드 (로딩창에 포함)
        // 프리로딩 임시 비활성화 - 디버깅용
        /*
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
        */

        // 나머지 애니메이션 비활성화
        /*
        setTimeout(() => {
            this.preloadAllBackgroundAssets().catch(err =>
                console.warn('⚠️ Background assets preloading failed:', err)
            );
        }, 100);
        */

        this.isLoadingCriticalAssets = false;

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

        // 2. addCharacter 기반 애니메이션들 (rabbit, leafs, song 등)
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
            'rabbit-idle', 'rabbit-hurt', 'hit-rabbit',
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

        // Ha 아이들 애니메이션 (Section-2에서 기본 상태)
        this.addCharacter('ha-idle', {
            isPngSequence: true,
            framePrefix: 'bride/public/animation/ha-idleidle',
            frameCount: 2,
            frameRate: 4,
            
            scale: 2,
            x: '50%',
            y: '50%',
            visible: false
        });

        // Ha 런 애니메이션 (Section-2에서 스크롤 시)
        this.addCharacter('ha-run', {
            isPngSequence: true,
            framePrefix: 'bride/public/animation/ha-runrun',
            frameCount: 7,
            frameRate: 14,
            
            scale: 4,
            x: '50%',
            y: '50%',
            visible: false
        });

        // Ha idle-wow 애니메이션 (Section-9에서 20vh 도달 시)
        this.addCharacter('ha-idle-wow', {
            isPngSequence: true,
            framePrefix: 'bride/public/animation/idle-wow/idle-wow',
            frameCount: 8,
            frameRate: 10,
            
            scale: 2,
            x: '50%',
            y: '50%',
            visible: false,
            loop: false,  // 한 번만 재생
            zIndex: 1000
        });

        // 토끼 idle 애니메이션 (Section-5에서 사용)
        this.addCharacter('rabbit-idle', {
            isPngSequence: true,
            framePrefix: 'bride/public/animation/rabbit/rabbit-idle',
            frameCount: 7, // rabbit-idle1~rabbit-idle7
            frameRate: 8,  // 8fps로 천천히

            scale: 4,
            x: '50%',
            y: '70%', // 70vh 위치에 고정
            visible: false
        });

        // Wreath 애니메이션 (1회 재생)
        this.addCharacter('wreath', {
            isPngSequence: true,
            framePrefix: 'animation/wreath/wreath',
            frameCount: 37, // wreath1~wreath37
            frameRate: 12,  // 12fps로 적당한 속도
            scale: 2,
            x: '50%',
            y: '70%',
            visible: false,
            loop: false,  // 1회만 재생
            onComplete: () => {
                console.log('🌿🎯 WREATH ONCOMPLETE CALLED!');
                this.onWreathAnimationComplete();
            }
        });

        // Wreath-idle 애니메이션 (무한 반복)
        this.addCharacter('wreath-idle', {
            isPngSequence: true,
            framePrefix: 'animation/wreath-idle/wreath',
            frameCount: 8, // wreath38~wreath45
            frameRate: 8,  // 8fps로 천천히

            scale: 2,
            x: '50%',
            y: '70%',
            visible: false,
            loop: true  // 무한 반복
        });

        // 토끼 hurt 애니메이션 (hit-rabbit 7프레임에서 반복 실행)
        this.addCharacter('rabbit-hurt', {
            isPngSequence: true,
            framePrefix: 'animation/rabbit-hurt/rabbit-hurt',
            frameCount: 5, // rabbit-hurt1~5
            frameRate: 12,

            scale: 4,
            x: '56%',
            y: '60%', // 70vh 위치에 고정
            visible: false,
            loop: true // 반복 재생
        });

        // Hit 토끼 애니메이션 (메인 캐릭터가 60vh 도달시 실행)
        this.addCharacter('hit-rabbit', {
            isSpreadsheetBased: true,
            spreadsheetData: null,
            scale: 4, // 1.5배 크게 (4 * 1.5 = 6)
            x: '50%',
            y: '80%', // 80vh 위치에 고정
            visible: false,
            loop: false // 한 번만 재생
        });

        // hit-idle 애니메이션 (hit-rabbit 완료 후 반복 실행)
        this.addCharacter('hit-idle', {
            isPngSequence: true,
            framePrefix: 'bride/public/animation/hit-idle/hit-idle',
            frameCount: 5, // hit-idle1.png ~ hit-idle5.png
            frameRate: 8, // idle 속도
            
            scale: 2,
            x: '50%',
            y: '50%', // hit-rabbit과 동일한 위치
            visible: false,
            loop: true // 반복 실행
        });

        // Ha idle-flower 애니메이션 (꽃 아이템 획득 후)
        this.addCharacter('ha-idle-flowers', {
            isPngSequence: true,
            framePrefix: 'animation/ha-idle-flowers/ha-idle-flowers',
            frameCount: 14, // ha-idle-flowers1~14.png
            frameRate: 8, // idle 속도
            scale: 2,
            x: '50%',
            y: '60%',
            visible: false,
            loop: true
        });

        // Ha run-flower 애니메이션 (꽃 아이템 획득 후)
        this.addCharacter('ha-run-flowers', {
            isPngSequence: true,
            framePrefix: 'animation/ha-run-flowers/ha-run-flowers',
            frameCount: 8, // ha-run-flowers1~8.png
            frameRate: 12, // run 속도
            scale: 2,
            x: '50%',
            y: '60%',
            visible: false,
            loop: true
        });

        // Leafs 애니메이션 (갤러리 하단에서 트리거)
        this.addCharacter('leafs', {
            isPngSequence: true,
            framePrefix: 'bride/public/animation/leafs/leafs',
            frameCount: 7, // leafs1.png ~ leafs7.png
            frameRate: 8,
            
            scale: 2,
            x: '50%',
            y: '50%',
            visible: false,
            loop: false, // 한 번만 재생
            zIndex: 500 // 갤러리 이미지(z-index: 200)보다 높게 설정
        });


        // Song 통합 캐릭터 (하나의 컨테이너에서 idle/run 전환)
        this.addCharacter('song', {
            isPngSequence: true,
            framePrefix: 'bride/public/animation/song-idle/song-idle', // 기본은 idle
            frameCount: 5,
            frameRate: 8,
            
            scale: 2,
            x: '50%', // 중앙
            y: '120%', // 화면 아래 바깥
            visible: false,
            loop: true,
            zIndex: 1000,
            currentAnimation: 'song-idle' // 현재 상태 추적
        });

        console.log('🎮 Characters setup: main (spreadsheet), ha-idle(png), ha-run(png), rabbit-idle (png), rabbit-hurt (png), hit-rabbit (png), hit-idle (png), ha-idle-flowers (png), ha-run-flowers (png), leafs (png), song (unified));')


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

        // 스프레드시트 기반 애니메이션은 개별 프레임 duration 사용
        let frameDuration;
        if (animation.isSpreadsheetBased && animation.spreadsheetData) {
            // 스프레드시트 애니메이션: 각 프레임의 duration 사용
            frameDuration = null; // 프레임마다 동적으로 계산
        } else {
            // 기존 PNG 시퀀스: frameRate 사용
            const effectiveFrameRate = this.isMobile ? Math.max(8, animation.frameRate * 0.75) : animation.frameRate;
            frameDuration = 1000 / effectiveFrameRate;
        }

        if (animation.isSpreadsheetBased) {
            console.log(`🎬 Starting spreadsheet animation: ${this.mainCharacter.currentAnimation} with dynamic durations`);
        } else {
            const effectiveFrameRate = this.isMobile ? Math.max(8, animation.frameRate * 0.75) : animation.frameRate;
            console.log(`🎬 Starting animation: ${this.mainCharacter.currentAnimation} at ${effectiveFrameRate}fps (${this.isMobile ? 'Mobile' : 'Desktop'})`);
        }

        // 시작 전에 모든 다른 애니메이션 숨기기
        for (const [animationName, frameImages] of this.frameImages.entries()) {
            if (animationName !== this.mainCharacter.currentAnimation) {
                frameImages.forEach(img => img.style.visibility = 'hidden');
            }
        }

        const updateFrame = (currentTime) => {
            // 스프레드시트 기반 애니메이션의 경우 현재 프레임 duration 계산
            let currentFrameDuration = frameDuration;
            if (animation.isSpreadsheetBased && animation.spreadsheetData) {
                const sequenceIndex = this.mainCharacter.currentFrame % animation.spreadsheetData.animationSequence.length;
                const frameIndex = animation.spreadsheetData.animationSequence[sequenceIndex];
                const frameData = animation.spreadsheetData.frames[frameIndex];
                currentFrameDuration = frameData ? frameData.duration : 200; // fallback to 200ms
            }

            // 프레임 타이밍 제어 (requestAnimationFrame 기반)
            if (currentTime - this.lastFrameTime < currentFrameDuration) {
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
            if (this.mainCharacter.currentAnimation === 'ha-idle-wow') {
                // idle-wow 특별 처리: 1~15 → 11~15를 5회 반복
                this.handleIdleWowFrameLogic();
            } else if (this.mainCharacter.currentFrame >= animation.frameCount) {
                if (animation.loop) {
                    this.mainCharacter.currentFrame = 0; // 반복
                } else {
                    // 한 번만 재생하는 애니메이션 완료
                    if (this.mainCharacter.currentAnimation === 'hit-rabbit') {
                        this.onHitRabbitAnimationComplete();
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
                'bride/public/animation/section1.json',
                './bride/public/animation/section1.json',
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
                    image: `bride/public/animation/${jsonData.meta.image}`, // 상대 경로로 section1.png 구성
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

            // 전체 프레임 범위 확인
            const totalFrames = frames.length;
            console.log(`📊 Total frames available: ${totalFrames} (0-${totalFrames-1})`);

            // 애니메이션 시퀀스 계산 - 순차적으로 처리
            const animationSequence = [];

            if (frameTags.length > 0) {
                // 태그별 프레임 정보를 구간별로 저장
                const taggedSegments = [];

                frameTags.forEach(tag => {
                    const from = tag.from;
                    const to = tag.to;
                    const repeatCount = parseInt(tag.repeat) || 1;

                    console.log(`🏷️ Tag "${tag.name}": frames ${from}-${to}, repeat ${repeatCount} times`);

                    taggedSegments.push({
                        from: from,
                        to: to,
                        repeat: repeatCount
                    });
                });

                // 태그 구간들을 from 순으로 정렬
                taggedSegments.sort((a, b) => a.from - b.from);

                let currentFrame = 0;

                for (const segment of taggedSegments) {
                    // 태그 시작 전까지의 누락된 프레임들 추가
                    while (currentFrame < segment.from) {
                        animationSequence.push(currentFrame);
                        console.log(`🔍 Adding sequential frame: ${currentFrame}`);
                        currentFrame++;
                    }

                    // 태그 구간을 repeat 횟수만큼 반복
                    for (let r = 0; r < segment.repeat; r++) {
                        for (let f = segment.from; f <= segment.to; f++) {
                            animationSequence.push(f);
                        }
                    }

                    // currentFrame을 태그 구간 다음으로 이동
                    currentFrame = segment.to + 1;
                }

                // 마지막 태그 이후 남은 프레임들 추가
                while (currentFrame < totalFrames) {
                    animationSequence.push(currentFrame);
                    console.log(`🔍 Adding final sequential frame: ${currentFrame}`);
                    currentFrame++;
                }
            } else {
                // 태그가 없으면 모든 프레임을 순서대로 재생
                console.log('⚠️ No frameTags found, using all frames in order');
                for (let i = 0; i < totalFrames; i++) {
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
                'bride/public/animation/ending/ending.json',
                './bride/public/animation/ending/ending.json',
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
                    image: `bride/public/animation/ending/${jsonData.meta.image}`, // 상대 경로로 ending.png 구성 (section1과 동일)
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

            // 전체 프레임 범위 확인
            const totalFrames = frames.length;
            console.log(`📊 Total ending frames available: ${totalFrames} (0-${totalFrames-1})`);

            // 애니메이션 시퀀스 계산 - 순차적으로 처리
            const animationSequence = [];

            if (frameTags.length > 0) {
                // 태그별 프레임 정보를 구간별로 저장
                const taggedSegments = [];

                frameTags.forEach(tag => {
                    const from = tag.from;
                    const to = tag.to;
                    const repeatCount = parseInt(tag.repeat) || 1;

                    console.log(`🏷️ Ending Tag "${tag.name}": frames ${from}-${to}, repeat ${repeatCount} times`);

                    taggedSegments.push({
                        from: from,
                        to: to,
                        repeat: repeatCount
                    });
                });

                // 태그 구간들을 from 순으로 정렬
                taggedSegments.sort((a, b) => a.from - b.from);

                let currentFrame = 0;

                for (const segment of taggedSegments) {
                    // 태그 시작 전까지의 누락된 프레임들 추가
                    while (currentFrame < segment.from) {
                        animationSequence.push(currentFrame);
                        console.log(`🔍 Adding sequential ending frame: ${currentFrame}`);
                        currentFrame++;
                    }

                    // 태그 구간을 repeat 횟수만큼 반복
                    for (let r = 0; r < segment.repeat; r++) {
                        for (let f = segment.from; f <= segment.to; f++) {
                            animationSequence.push(f);
                        }
                    }

                    // currentFrame을 태그 구간 다음으로 이동
                    currentFrame = segment.to + 1;
                }

                // 마지막 태그 이후 남은 프레임들 추가
                while (currentFrame < totalFrames) {
                    animationSequence.push(currentFrame);
                    console.log(`🔍 Adding final sequential ending frame: ${currentFrame}`);
                    currentFrame++;
                }
            } else {
                // 태그가 없으면 모든 프레임을 순서대로 재생
                console.log('⚠️ No ending frameTags found, using all frames in order');
                for (let i = 0; i < totalFrames; i++) {
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
    async loadHitRabbitSpreadsheetData() {
        try {
            console.log('📊 Loading hit-rabbit spreadsheet data from JSON...');

            // 여러 경로로 시도 (section1과 동일한 패턴)
            const jsonPaths = [
                'bride/public/animation/rabbit-hit/rabbit-hit.json',
                './bride/public/animation/rabbit-hit/rabbit-hit.json',
                'animation/hit-rabbit/rabbit-hit.json'
            ];

            let response = null;
            let loadedPath = null;

            for (const path of jsonPaths) {
                try {
                    console.log(`🔍 Trying rabbit-hit.json path: ${path}`);
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
                throw new Error('Could not load rabbit-hit.json from any path');
            }

            const jsonData = await response.json();
            console.log(`📥 Raw hit-rabbit JSON loaded:`, jsonData);

            // JSON 데이터를 스프레드시트 형태로 변환
            const frames = [];
            const frameKeys = Object.keys(jsonData.frames);

            for (let i = 0; i < frameKeys.length; i++) {
                const key = frameKeys[i];
                const frameInfo = jsonData.frames[key];

                frames.push({
                    image: `bride/public/animation/rabbit-hit/${jsonData.meta.image}`, // 상대 경로로 hit-rabbit.png 구성 (section1과 동일)
                    duration: frameInfo.duration,
                    spriteX: frameInfo.frame.x,
                    spriteY: frameInfo.frame.y,
                    spriteWidth: frameInfo.frame.w,
                    spriteHeight: frameInfo.frame.h
                });
            }

            // frameTags를 이용한 애니메이션 시퀀스 생성 (section1과 동일)
            const frameTags = jsonData.meta.frameTags || [];
            console.log('📋 Available hit-rabbit frameTags:', frameTags);

            // 전체 프레임 범위 확인
            const totalFrames = frames.length;
            console.log(`📊 Total hit-rabbit frames available: ${totalFrames} (0-${totalFrames-1})`);

            // 애니메이션 시퀀스 계산 - 순차적으로 처리
            const animationSequence = [];

            if (frameTags.length > 0) {
                // 태그별 프레임 정보를 구간별로 저장
                const taggedSegments = [];

                frameTags.forEach(tag => {
                    const from = tag.from;
                    const to = tag.to;
                    const repeatCount = parseInt(tag.repeat) || 1;

                    console.log(`🏷️ Hit-rabbit Tag "${tag.name}": frames ${from}-${to}, repeat ${repeatCount} times`);

                    taggedSegments.push({
                        from: from,
                        to: to,
                        repeat: repeatCount
                    });
                });

                // 태그 구간들을 from 순으로 정렬
                taggedSegments.sort((a, b) => a.from - b.from);

                let currentFrame = 0;

                for (const segment of taggedSegments) {
                    // 태그 시작 전까지의 누락된 프레임들 추가
                    while (currentFrame < segment.from) {
                        animationSequence.push(currentFrame);
                        console.log(`🔍 Adding sequential hit-rabbit frame: ${currentFrame}`);
                        currentFrame++;
                    }

                    // 태그 구간을 repeat 횟수만큼 반복
                    for (let r = 0; r < segment.repeat; r++) {
                        for (let f = segment.from; f <= segment.to; f++) {
                            animationSequence.push(f);
                        }
                    }

                    // currentFrame을 태그 구간 다음으로 이동
                    currentFrame = segment.to + 1;
                }

                // 마지막 태그 이후 남은 프레임들 추가
                while (currentFrame < totalFrames) {
                    animationSequence.push(currentFrame);
                    console.log(`🔍 Adding final sequential hit-rabbit frame: ${currentFrame}`);
                    currentFrame++;
                }
            } else {
                // 태그가 없으면 모든 프레임을 순서대로 재생
                console.log('⚠️ No hit-rabbit frameTags found, using all frames in order');
                for (let i = 0; i < totalFrames; i++) {
                    animationSequence.push(i);
                }
            }

            console.log(`🎬 Hit-rabbit animation sequence: [${animationSequence.slice(0, 20).join(', ')}${animationSequence.length > 20 ? '...' : ''}] (total: ${animationSequence.length} frames)`);

            const spreadsheetData = {
                frames: frames,
                animationSequence: animationSequence,
                totalDuration: frames.reduce((total, frame) => total + frame.duration, 0),
                meta: {
                    size: jsonData.meta?.size || { w: 50, h: 64 },
                    scale: jsonData.meta?.scale || "1"
                },
                metadata: {
                    name: 'Hit-rabbit Animation',
                    frameCount: frames.length,
                    sequenceLength: animationSequence.length,
                    spritesheet: jsonData.meta.image,
                    frameTags: frameTags
                }
            };

            console.log(`📊 Converted ${frames.length} hit-rabbit frames from JSON to spreadsheet format`);
            console.log('🎬 Total hit-rabbit duration:', spreadsheetData.totalDuration + 'ms');

            // Hit-rabbit 캐릭터에 데이터 설정
            await this.loadSpreadsheetData('hit-rabbit', spreadsheetData);

            console.log('✅ Hit-rabbit data loading completed!');

        } catch (error) {
            console.error('❌ Failed to load hit-rabbit spreadsheet data:', error);
            console.log('⚠️ Hit-rabbit animation will not be available');
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
            // PNG 시퀀스 방식 - loop와 onComplete 지원
            const frameInterval = 1000 / character.frameRate;
            let frameCount = 0;

            const animateFrame = () => {
                this.updateFrameWithoutLoop(character);
                frameCount++;
                console.log(`🎬 ${character.id}: Frame ${frameCount}/${character.frameCount}`);

                if (frameCount >= character.frameCount) {
                    // 애니메이션 완료
                    console.log(`🏁 ${character.id}: Animation completed (${frameCount} frames)`);
                    console.log(`🔍 ${character.id}: onComplete exists? ${!!character.onComplete}, type: ${typeof character.onComplete}`);

                    if (character.onComplete && typeof character.onComplete === 'function') {
                        console.log(`📞 ${character.id}: Calling onComplete callback`);
                        try {
                            character.onComplete();
                            console.log(`✅ ${character.id}: onComplete callback executed successfully`);
                        } catch (error) {
                            console.error(`❌ ${character.id}: onComplete callback error:`, error);
                        }
                    } else {
                        console.log(`⚠️ ${character.id}: No onComplete callback found`);
                    }

                    if (character.loop !== false) {
                        // loop가 true거나 undefined면 반복
                        console.log(`🔄 ${character.id}: Looping animation`);
                        character.currentFrame = 0;
                        frameCount = 0;
                        character.animationTimeout = setTimeout(animateFrame, frameInterval);
                    } else {
                        console.log(`⏹️ ${character.id}: Animation stopped (no loop)`);
                    }
                } else {
                    character.animationTimeout = setTimeout(animateFrame, frameInterval);
                }
            };

            // 첫 프레임 즉시 표시
            animateFrame();
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
                } else if (character.id === 'hit-rabbit') {
                    this.onHitRabbitAnimationComplete();
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
        if (!character.isPngSequence) {
            console.log(`⚠️ updateFrame called on non-PNG character: ${character.id}`);
            return;
        }

        if (!character.img) {
            console.error(`❌ No img element found for character: ${character.id}`);
            return;
        }

        const frameNumber = character.currentFrame + 1; // 1부터 시작
        const framePath = `${character.framePrefix}${frameNumber}.png`;

        console.log(`🖼️ Setting frame ${frameNumber} for ${character.id}: ${framePath}`);
        character.img.src = framePath;

        character.currentFrame = (character.currentFrame + 1) % character.frameCount;
    }

    // Loop 처리 없이 프레임 업데이트 (새로운 startAnimation에서 사용)
    updateFrameWithoutLoop(character) {
        if (!character.isPngSequence) {
            console.log(`⚠️ updateFrameWithoutLoop called on non-PNG character: ${character.id}`);
            return;
        }

        if (!character.img) {
            console.error(`❌ No img element found for character: ${character.id}`);
            return;
        }

        const frameNumber = character.currentFrame + 1; // 1부터 시작
        const framePath = `${character.framePrefix}${frameNumber}.png`;

        console.log(`🖼️ Setting frame ${frameNumber} for ${character.id}: ${framePath}`);
        character.img.src = framePath;

        character.currentFrame++; // 프레임 증가 (startAnimation에서 frameCount도 별도 증가)
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
        // hit-rabbit 실행 중에만 상태 변경 무시 (hit-idle은 스크롤로 전환 가능)
        if (this.isHitRabbitPlaying) {
            console.log(`🚫 State change blocked during hit-rabbit animation: ${newState}`);
            return;
        }

        // 토끼 관련 상태 요청은 별도 처리
        if (newState.startsWith('rabbit-') || newState === 'hit-rabbit') {
            console.log(`🟢 Rabbit-related state change ignored in switchToState: ${newState}`);
            return;
        }

        // 실제 사용할 애니메이션 계산
        let actualAnimation = newState;
        console.log(`🌸 Animation check: hasLeafsFlowerDouble=${this.hasLeafsFlowerDouble}, hasFlower=${this.hasFlower}, leafsTriggered=${this.galleryLeafsTriggered}, newState=${newState}, section=${this.currentSection}`);

        // idle-wow 완료 후에는 idle-wow-normal이 최우선 (leafsflowerdouble 차단)
        if (this.hasIdleWowCompleted && newState === 'ha-idle') {
            actualAnimation = 'ha-idle-wow-normal';
            console.log(`✨ Using idle-wow-normal (blocks leafsflowerdouble): ${actualAnimation}`);
        } else if (this.hasIdleWowCompleted && this.hasLeafsFlowerDouble && newState === 'ha-run') {
            actualAnimation = 'ha-run-flowers'; // idle-wow 완료 후에도 run은 leafsflowerdouble 유지
            console.log(`✨ Using leafsflowerdouble run (idle-wow completed): ${actualAnimation}`);
        } else if (this.galleryLeafsTriggered && newState === 'ha-idle') {
            actualAnimation = 'ha-idle-leafs';
            console.log(`🍃 Using leafs idle: ${actualAnimation}`);
        } else if (this.galleryLeafsTriggered && newState === 'ha-run') {
            actualAnimation = 'ha-run-leafs';
            console.log(`🍃 Using leafs run: ${actualAnimation}`);
        } else if (this.hasLeafsFlowerDouble && newState === 'ha-idle') {
            actualAnimation = 'ha-idle-flowers';
            console.log(`🌸✨ Using leafsflowerdouble idle: ${actualAnimation}`);
        } else if (this.hasLeafsFlowerDouble && newState === 'ha-run') {
            actualAnimation = 'ha-run-flowers';
            console.log(`🌸✨ Using leafsflowerdouble run: ${actualAnimation}`);
        } else if (this.hasFlower && newState === 'ha-idle') {
            actualAnimation = 'ha-idle-flowers';
            console.log(`🌸 Using flower idle: ${actualAnimation}`);
        } else if (this.hasFlower && newState === 'ha-run') {
            actualAnimation = 'ha-run-flowers';
            console.log(`🌸 Using flower run: ${actualAnimation}`);
        } else {
            // ha-run 기본 케이스 처리
            if (newState === 'ha-run' && !this.hasFlower && !this.galleryLeafsTriggered && !this.hasLeafsFlowerDouble) {
                actualAnimation = 'ha-run';
                console.log(`🏃‍♀️ Using ha-run animation: ${actualAnimation}`);
            } else {
                console.log(`🎭 Using normal animation: ${actualAnimation}`);
            }
        }

        // hit-idle에서 전환할 때 꽃 아이템 획득
        if (this.isHitIdlePlaying) {
            this.isHitIdlePlaying = false;
            this.hasFlower = true;
            this.characterY = 50; // 위치 보존
            console.log('🌸 Hit-idle transition: flower item acquired! Position preserved at 50%');

            // 꽃 모드로 재계산
            if (newState === 'ha-idle') {
                actualAnimation = 'ha-idle-flowers';
            } else if (newState === 'ha-run') {
                actualAnimation = 'ha-run-flowers';
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

        // 기존 개별 캐릭터들 숨기기 (토끼, song, wreath 캐릭터들 제외)
        this.characters.forEach((char, id) => {
            if (id.startsWith('rabbit-') || id.startsWith('song-') || id.startsWith('wreath')) return; // 토끼, song, wreath 캐릭터들은 별도 관리
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
            mainChar.framePrefix = 'bride/public/animation/section1/section';
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

        // Section-7 특별 처리: wreath 애니메이션
        if (sectionIndex === 7) {
            console.log(`🌿🔍 Section-7 entered: wreathTriggered=${this.wreathTriggered}, isWreathPlaying=${this.isWreathPlaying}`);
            if (!this.wreathTriggered && !this.isWreathPlaying) {
                console.log(`🌿⚡ Starting wreath animation now!`);
                this.startWreathAnimation();
                return; // wreath 애니메이션이 시작되면 다른 상태 전환 건너뛰기
            } else {
                console.log(`🌿⏸️ Wreath animation already triggered or playing, skipping`);
            }
        }

        // 스크롤 중이면 run, 아니면 idle로 시작
        const initialState = this.isScrolling ? 'ha-run' : 'ha-idle';
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

    // 토끼 상태로 전환 (Section-5 전용) - 일반 캐릭터와 동시 표시
    switchToRabbitState() {
        console.log('🟢 Switching to rabbit state (Section-5)');
        this.currentSection = 5;

        // Section-5 초기화
        this.hitRabbitTriggered = false;
        this.isHitRabbitPlaying = false;
        console.log('🟢 Section-5 hit-rabbit state reset');

        // Section-5에서는 Ha 캐릭터(ha-idleha-run도 함께 표시
        const startHeight = -25; // 화면 위 바깥에서 시작
        this.characterY = startHeight;

        // 스크롤 상태에 따라 일반 캐릭터 시작 상태 결정
        const mainState = this.isScrolling ? 'ha-run' : 'ha-idle';
        this.switchToState(mainState);

        // 토끼은 별도로 70vh에 고정하여 표시
        this.showRabbitCharacter();

        console.log(`🟢 Section-5 started: main character=${mainState}, rabbit=active`);
    }

    // 토끼 캐릭터 별도 표시 (항상 idle 상태)
    showRabbitCharacter() {
        const rabbitChar = this.characters.get('rabbit-idle');

        if (rabbitChar && rabbitChar.element) {
            rabbitChar.element.style.opacity = '1';
            rabbitChar.element.style.top = '60%'; // 10vh 높임
            rabbitChar.element.style.left = '50%';
            rabbitChar.isActive = true;

            // 애니메이션 시작
            if (rabbitChar.isPngSequence) {
                this.startAnimation(rabbitChar);
            }
        }

        console.log(`🟢 Rabbit character shown: rabbit-idle (always idle)`);
    }

    // 캐릭터 숨기기 (포털 전환 시) - 실제로는 숨기지 않고 정리만
    hideCharacter() {
        console.log('👻 Preparing for section transition (not actually hiding)');
        console.log(`👻 Current section: ${this.currentSection}, character state: ${this.currentState}`);
        // this.switchToState('hidden'); // 제거: 실제로 숨기지 않음

        // Section-5에서 나갈 때 토끼도 숨기기
        if (this.currentSection === 5) {
            this.hideRabbitCharacter();
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

        // Section-7에서 화환 애니메이션 중에는 모든 움직임/스크롤 무시
        if (sectionIndex === 7 && this.isWreathPlaying) {
            console.log('🌿🚫 Blocking all scroll movement during wreath animation');
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
                // Section-5: 메인 캐릭터만 run 상태 (토끼은 항상 idle 유지)
                this.switchToState('ha-run');
            } else if (sectionIndex === 7) {
                // Section-7: wreath 애니메이션 트리거
                if (!this.wreathTriggered && !this.isWreathPlaying) {
                    this.startWreathAnimation();
                }
                // wreath 애니메이션 중에는 ha 캐릭터 상태 전환 금지
                if (this.isWreathPlaying) {
                    console.log('🌿 Blocking ha character state change during wreath animation');
                    return; // ha 상태 전환 건너뛰기
                }
                // wreath 애니메이션 완료 후에는 다른 섹션처럼 run 상태로 전환
                this.switchToState('ha-run');
            } else {
                // 다른 섹션: 일반 run 상태
                this.switchToState('ha-run');
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
            // Section-5에서는 텍스트 애니메이션 없음, 토끼 위치 유지
            this.updateRabbitPosition();

            // 토끼이 비활성화되었으면 다시 활성화 (hit-rabbit 이전에만)
            if (!this.hitRabbitTriggered) {
                const rabbitChar = this.characters.get('rabbit-idle');
                if (rabbitChar && rabbitChar.element && !rabbitChar.isActive) {
                    this.showRabbitCharacter();
                }
            }

            // 메인 캐릭터가 60vh 도달 체크 (hit-rabbit 트리거)
            console.log(`🎯 Section-5 update: characterY=${this.characterY.toFixed(1)}, triggered=${this.hitRabbitTriggered}, playing=${this.isHitRabbitPlaying}`);
            this.checkHitRabbitTrigger();
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

            // Ha가 20vh(characterY = 20) 도달 시 idle-wow 트리거 체크
            this.checkIdleWowTrigger();

            // Ha가 50vh(characterY = 50) 도달 시 ending 트리거 체크
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
                    // Section-5: 메인 캐릭터만 idle 상태 (토끼은 항상 idle 유지)
                    this.switchToState('ha-idle');
                } else if (sectionIndex === 9) {
                    // Section-9: idle-wow 재생 중이면 Ha 처리 무시, Song은 별도 처리
                    if (this.isIdleWowPlaying) {
                        console.log('🎉 Section-9 scroll stopped - idle-wow playing, ignoring Ha transition');

                        // Song은 독립적으로 idle로 전환
                        const song = this.characters.get('song');
                        if (song) {
                            this.switchSongAnimation(song, 'song-idle');
                            console.log('🎵 Song set to idle (independent of idle-wow)');
                        }
                        return;
                    }

                    // Section-9: 일반 상태 - Lee와 Song 모두 idle로 전환
                    console.log('🎵 Section-9 scroll stopped - Ha to idle, Song to idle');

                    // Ha가 idle-wow 완료 상태라면 직접 wow-normal 사용
                    if (this.hasIdleWowCompleted) {
                        this.switchUnifiedAnimation('ha-idle-wow-normal');
                    } else if (this.hasLeafsFlowerDouble) {
                        this.switchUnifiedAnimation('ha-idle-flowers');
                    } else {
                        this.switchToState('ha-idle');
                    }

                    // Song 애니메이션만 idle로 변경 (위치 변경 없음)
                    const song = this.characters.get('song');
                    if (song) {
                        this.switchSongAnimation(song, 'song-idle');
                    }
                } else if (sectionIndex === 7) {
                    // Section-7: wreath 재생 중이면 idle 전환 금지
                    if (this.isWreathPlaying) {
                        console.log('🌿 Blocking ha idle transition during wreath animation');
                        return;
                    }
                    this.switchToState('ha-idle');
                } else {
                    // 다른 섹션: 일반 ha idle 상태
                    this.switchToState('ha-idle');
                }
            }, 200); // 200ms 후 idle로 전환
        }
    }

    // 토끼 캐릭터 숨기기 (Section-5에서 나갈 때)
    hideRabbitCharacter() {
        const rabbitChar = this.characters.get('rabbit-idle');
        if (rabbitChar && rabbitChar.element) {
            rabbitChar.element.style.opacity = '0';
            rabbitChar.isActive = false;
            this.stopAnimation(rabbitChar);
        }

        // rabbit-hurt도 숨기기
        const rabbitHurtChar = this.characters.get('rabbit-hurt');
        if (rabbitHurtChar && rabbitHurtChar.element) {
            rabbitHurtChar.element.style.opacity = '0';
            rabbitHurtChar.isActive = false;
            this.stopAnimation(rabbitHurtChar);
        }

        console.log(`🟢 Rabbit characters (idle/hurt) hidden`);
    }

    // 토끼 상태 업데이트 (Section-5 전용)
    updateRabbitState(newState) {
        if (this.currentSection !== 5) return;

        // 기존 토끼 캐릭터들 숨기기
        ['rabbit-idle', 'rabbit-run'].forEach(state => {
            const char = this.characters.get(state);
            if (char && char.element) {
                char.element.style.opacity = '0';
                char.isActive = false;
                this.stopAnimation(char);
            }
        });

        // 새로운 상태의 토끼 표시
        const newRabbitChar = this.characters.get(newState);
        if (newRabbitChar && newRabbitChar.element) {
            newRabbitChar.element.style.opacity = '1';
            newRabbitChar.element.style.top = '70%';
            newRabbitChar.element.style.left = '50%';
            newRabbitChar.isActive = true;

            if (newRabbitChar.isPngSequence) {
                this.startAnimation(newRabbitChar);
            }
        }

        console.log(`🟢 Rabbit state updated to: ${newState}`);
    }

    // 토끼 위치 유지 (Section-5에서 호출, 항상 idle 상태)
    updateRabbitPosition() {
        // hit-rabbit 완료 후에는 토끼을 더 이상 표시하지 않음
        if (this.hitRabbitTriggered) {
            return;
        }

        const rabbitChar = this.characters.get('rabbit-idle');
        if (rabbitChar && rabbitChar.element && rabbitChar.isActive) {
            rabbitChar.element.style.top = '60%'; // 10vh 높임
            rabbitChar.element.style.left = '50%';
        }
    }

    // Hit-rabbit 트리거 체크 (Section-5에서만)
    checkHitRabbitTrigger() {
        if (this.currentSection !== 5) return;
        if (this.hitRabbitTriggered || this.isHitRabbitPlaying) return;

        console.log(`🔍 Checking hit-rabbit trigger: characterY=${this.characterY.toFixed(1)}, section=${this.currentSection}`);

        // 메인 캐릭터가 60vh 도달했는지 체크 (더 낮은 임계값으로 테스트)
        if (this.characterY >= 50) { // 60vh → 50vh로 임시 변경 (테스트용)
            console.log('💥 Hit-rabbit triggered at 50vh! (test threshold)');
            this.triggerHitRabbitAnimation();
        }
    }

    // Idle-wow 트리거 체크 (Section-9에서만)
    checkIdleWowTrigger() {
        if (this.currentSection !== 9) return;
        if (this.idleWowTriggered || this.isIdleWowPlaying) return;

        console.log(`🔍 Checking idle-wow trigger: characterY=${this.characterY.toFixed(1)}, section=${this.currentSection}`);

        // Ha가 20vh(characterY = 20) 도달했는지 체크
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

        // Ha가 50vh(characterY = 50) 도달했는지 체크
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

        // Ha 개별 캐릭터들도 모두 숨기기
        const haCharacters = ['ha-idle', 'ha-run', 'ha-idle-wow', 'ha-idle-flowers', 'ha-run-flowers', 'ha-idle-flowers', 'ha-run-flowers'];
        haCharacters.forEach(charId => {
            const char = this.characters.get(charId);
            if (char) {
                char.visible = false;
                char.element.style.opacity = '0';
                char.element.style.display = 'none';
                char.element.style.visibility = 'hidden';
                console.log(`👻 Hidden Ha character: ${charId}`);
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

    // Hit-rabbit 애니메이션 실행
    async triggerHitRabbitAnimation() {
        this.hitRabbitTriggered = true;
        this.isHitRabbitPlaying = true;

        // 스크롤 잠금
        if (window.manualScrollManager) {
            window.manualScrollManager.lockScroll('hit-rabbit animation');
        }

        // 통합 캐릭터 (ha-idleha-run 숨기기
        this.hideUnifiedCharacter();
        console.log(`🫥 Unified character hidden for hit-rabbit`);

        // rabbit-idle 숨기기 (hit-rabbit 시작 시)
        this.hideRabbitCharacter();

        // Hit-rabbit 애니메이션 표시 및 실행
        const hitRabbitChar = this.characters.get('hit-rabbit');
        if (hitRabbitChar) {
            hitRabbitChar.element.style.opacity = '1';
            hitRabbitChar.element.style.top = '60%'; // 20vh 높임
            hitRabbitChar.element.style.left = '50%';
            hitRabbitChar.isActive = true;

            // 애니메이션 시작 (한 번만 재생)
            // Load hit-rabbit spreadsheet data first
            if (!hitRabbitChar.spreadsheetData) {
                try {
                    await this.loadHitRabbitSpreadsheetData();
                } catch (error) {
                    console.error("❌ Failed to load hit-rabbit data:", error);
                    if (window.manualScrollManager) {
                        window.manualScrollManager.unlockScroll("hit-rabbit animation failed");
                    }
                    return;
                }
            }
            this.startSpreadsheetAnimation(hitRabbitChar);
        }

        console.log('💥 Hit-rabbit animation started, scroll locked');
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

    // Ha 캐릭터를 idle-wow로 전환 (통합 캐릭터 시스템)
    switchToIdleWow() {
        // 기존 통합 캐릭터 애니메이션 정지하지만 숨기지는 않음 (위치 유지)
        if (this.mainCharacter.animationTimer) {
            cancelAnimationFrame(this.mainCharacter.animationTimer);
        }

        // idle-wow 상태 초기화
        this.idleWowPhase = 1;
        this.idleWowRepeatCount = 0;

        // idle-wow 애니메이션으로 전환 (통합 시스템 사용)
        this.switchUnifiedAnimation('ha-idle-wow');

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
        this.switchUnifiedAnimation('ha-idle-wow-normal');

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

    // Hit-rabbit 애니메이션 시작 (한 번만 재생)
    startHitRabbitAnimation(character) {
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

            // 6번째 프레임에서 rabbit을 rabbit-hurt로 전환
            if (frameCount === 6) {
                console.log('💥 Frame 6 reached - switching rabbit to hurt animation');
                this.switchRabbitToHurt();

        // 스크롤 잠금 해제
        if (window.manualScrollManager) {
            window.manualScrollManager.unlockScroll("hit-rabbit animation complete");
        }            }

            // 모든 프레임 재생 완료
            if (frameCount >= character.frameCount) {
                this.onHitRabbitAnimationComplete();
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
            this.onHitRabbitAnimationComplete();
        }
    }

    // Hit-rabbit 애니메이션 완료 처리
    onHitRabbitAnimationComplete() {
        console.log('💥 Hit-rabbit animation completed, starting ha-idle-flowers');
        this.isHitRabbitPlaying = false;

        // Hit-rabbit 애니메이션 숨기기
        const hitRabbitChar = this.characters.get('hit-rabbit');
        if (hitRabbitChar) {
            hitRabbitChar.element.style.opacity = '0';
            hitRabbitChar.isActive = false;
            this.stopAnimation(hitRabbitChar);
        }

        // rabbit-hurt 애니메이션 시작 (개별 캐릭터)
        this.switchRabbitToHurt();

        // 꽃 애니메이션 모드 활성화 (groom의 hit-idle처럼 통합 시스템 사용)
        this.isHitIdlePlaying = true;
        this.characterY = 60; // 10vh 아래로 이동 (50 -> 65)

        // 통합 캐릭터 위치 DOM에 실제 적용
        this.updateUnifiedCharacterPosition();

        // 기존 개별 캐릭터들 숨기기 (토끼 제외)
        this.characters.forEach((char, id) => {
            if (id.startsWith('rabbit-')) return; // 토끼는 별도 관리
            this.stopAnimation(char);
            char.element.style.opacity = '0';
        });

        // 통합 캐릭터 다시 보이기
        this.showUnifiedCharacter();
        console.log('👀 Unified character restored after hit-rabbit');

        // 꽃 모드 플래그 설정
        this.hasLeafsFlowerDouble = true;
        console.log('🌸✨ LeafsFlowerDouble flag activated for flowers mode!');

        // 현재 스크롤 상태에 따라 적절한 애니메이션 직접 호출 (groom 패턴)
        const initialFlowerAnimation = this.isScrolling ? 'ha-run-flowers' : 'ha-idle-flowers';
        console.log(`🌸 Direct unified animation: ${initialFlowerAnimation}`);
        this.switchUnifiedAnimation(initialFlowerAnimation);
        this.updateUnifiedCharacterPosition();

        // 스크롤 잠금 해제
        if (window.manualScrollManager) {
            window.manualScrollManager.unlockScroll('hit-rabbit animation complete');
        }
    }

    // Wreath 애니메이션 완료 처리
    onWreathAnimationComplete() {
        console.log('🌿 Wreath animation completed, starting wreath-idle');
        this.isWreathPlaying = false; // 메인 wreath 애니메이션 완료

        // Wreath 애니메이션 숨기기
        const wreathChar = this.characters.get('wreath');
        if (wreathChar) {
            wreathChar.element.style.opacity = '0';
            wreathChar.isActive = false;
            this.stopAnimation(wreathChar);
        }

        // Wreath-idle 애니메이션 시작 (고정 위치에서 계속)
        const wreathIdleChar = this.characters.get('wreath-idle');
        if (wreathIdleChar) {
            wreathIdleChar.element.style.opacity = '1';
            wreathIdleChar.isActive = true;
            this.startAnimation(wreathIdleChar);
            console.log('🌿 Wreath-idle animation started at fixed position');
        }

        // 통합 캐릭터 다시 보이기 (다른 애니메이션들과 동일한 패턴)
        this.showUnifiedCharacter();

        // 화환 완료 후에는 하 캐릭터를 최상단에서 시작하도록 위치 설정
        this.characterY = -25;
        this.updateUnifiedCharacterPosition();

        // 현재 스크롤 상태에 따라 적절한 애니메이션 시작 (다른 애니메이션 완료 함수와 동일한 패턴)
        const initialAnimation = this.isScrolling ? 'ha-run' : 'ha-idle';
        console.log(`🌿 Starting initial animation: ${initialAnimation}`);
        this.switchToState(initialAnimation);

        console.log('🌿✨ Wreath-idle started, unified character restored at top (-25%) with animation!');
    }

    // Wreath 애니메이션 시작
    startWreathAnimation() {
        if (this.wreathTriggered || this.isWreathPlaying) {
            console.log('🌿 Wreath animation already triggered or playing');
            return;
        }

        console.log('🌿 Starting wreath animation in Section-7');
        this.wreathTriggered = true;
        this.isWreathPlaying = true;

        // 기존 캐릭터들 숨기기
        this.characters.forEach((char, id) => {
            if (!id.startsWith('wreath')) {
                char.element.style.opacity = '0';
                this.stopAnimation(char);
            }
        });

        // 통합 캐릭터도 숨기기 (다른 애니메이션들과 동일한 패턴)
        this.hideUnifiedCharacter();

        // Wreath 애니메이션 시작
        const wreathChar = this.characters.get('wreath');
        console.log('🌿 Wreath character found:', !!wreathChar);

        if (wreathChar) {
            console.log('🌿 Wreath character config:', {
                frameCount: wreathChar.frameCount,
                frameRate: wreathChar.frameRate,
                loop: wreathChar.loop,
                framePrefix: wreathChar.framePrefix,
                hasOnComplete: !!wreathChar.onComplete
            });

            wreathChar.element.style.opacity = '1';
            wreathChar.isActive = true;
            this.startAnimation(wreathChar);
            console.log('🌿 Wreath animation started');
        } else {
            console.error('❌ Wreath character not found!');
        }
    }

    // 토끼을 hurt 애니메이션으로 전환 (hit-rabbit 6프레임에서)
    switchRabbitToHurt() {
        console.log('🔧 switchRabbitToHurt called');

        // 기존 rabbit-idle 숨기기 (이미 숨겨져 있지만 확실히)
        const rabbitIdleChar = this.characters.get('rabbit-idle');
        if (rabbitIdleChar) {
            rabbitIdleChar.element.style.opacity = '0';
            rabbitIdleChar.isActive = false;
            this.stopAnimation(rabbitIdleChar);
            console.log('🚫 rabbit-idle hidden');
        }

        // rabbit-hurt 애니메이션 표시 (반복 실행)
        const rabbitHurtChar = this.characters.get('rabbit-hurt');
        console.log('🔍 rabbitHurtChar found:', !!rabbitHurtChar);

        if (rabbitHurtChar) {
            // 이전 애니메이션 정지
            this.stopAnimation(rabbitHurtChar);

            rabbitHurtChar.element.style.opacity = '1';
            rabbitHurtChar.element.style.display = 'block';
            rabbitHurtChar.element.style.visibility = 'visible';

            // addCharacter에서 설정한 초기 위치로 복원
            rabbitHurtChar.element.style.left = rabbitHurtChar.x;
            rabbitHurtChar.element.style.top = rabbitHurtChar.y;
            rabbitHurtChar.element.style.position = 'absolute';
            rabbitHurtChar.element.style.transform = `translate(-50%, -50%) scale(${rabbitHurtChar.scale})`;

            rabbitHurtChar.visible = true;
            rabbitHurtChar.currentFrame = 0;  // 첫 프레임부터 시작

            console.log('🤕 Starting rabbit-hurt animation (loop) with:', {
                frameCount: rabbitHurtChar.frameCount,
                framePrefix: rabbitHurtChar.framePrefix,
                hasImg: !!rabbitHurtChar.img,
                loop: rabbitHurtChar.loop,
                element: !!rabbitHurtChar.element,
                x: rabbitHurtChar.x,
                y: rabbitHurtChar.y,
                elementStyles: {
                    opacity: rabbitHurtChar.element.style.opacity,
                    display: rabbitHurtChar.element.style.display,
                    visibility: rabbitHurtChar.element.style.visibility,
                    position: rabbitHurtChar.element.style.position,
                    left: rabbitHurtChar.element.style.left,
                    top: rabbitHurtChar.element.style.top,
                    transform: rabbitHurtChar.element.style.transform
                }
            });

            // 반복 애니메이션 시작
            this.startAnimation(rabbitHurtChar);
        } else {
            console.error('❌ rabbit-hurt character not found!');
        }

        // 꽃 애니메이션으로 자동 전환되도록 플래그 설정
        this.switchToFlowersMode();
    }

    // 꽃 애니메이션 모드로 전환 (기존 LeafsFlowerDouble 로직 사용)
    switchToFlowersMode() {
        console.log('🌸 switchToFlowersMode called - activating LeafsFlowerDouble flag');

        // hasLeafsFlowerDouble 플래그 설정 (기존 로직과 동일)
        this.hasLeafsFlowerDouble = true;
        console.log('🌸✨ LeafsFlowerDouble flag activated for flowers mode!');

        // 기존 ha 캐릭터들 모두 숨기기 (개별 캐릭터와 flowers 모두)
        const basicHaChars = ['ha-idle', 'ha-run', 'ha-idle-wow', 'ha-idle-flowers', 'ha-run-flowers'];
        basicHaChars.forEach(charId => {
            const char = this.characters.get(charId);
            if (char) {
                char.element.style.opacity = '0';
                char.isActive = false;
                this.stopAnimation(char);
                console.log(`🚫 Hidden ha character: ${charId}`);
            }
        });

        // 현재 스크롤 상태에 따라 적절한 초기 애니메이션 결정
        const initialFlowerState = this.isScrolling ? 'ha-run' : 'ha-idle';
        console.log(`🌸 Initial flower state based on scroll: isScrolling=${this.isScrolling} -> ${initialFlowerState}`);

        // 적절한 초기 상태로 전환 (스크롤 상태 반영)
        console.log(`🔄 Starting flowers mode with: ${initialFlowerState} -> ${initialFlowerState}-flowers`);
        this.switchToState(initialFlowerState);

        // 디버깅을 위해 flowers 캐릭터 상태 확인
        const haIdleFlowers = this.characters.get('ha-idle-flowers');
        const haRunFlowers = this.characters.get('ha-run-flowers');

        console.log('🌸 Debug - ha-flowers characters state:', {
            'ha-idle-flowers': {
                exists: !!haIdleFlowers,
                opacity: haIdleFlowers?.element?.style?.opacity,
                visible: haIdleFlowers?.visible,
                isActive: haIdleFlowers?.isActive
            },
            'ha-run-flowers': {
                exists: !!haRunFlowers,
                opacity: haRunFlowers?.element?.style?.opacity,
                visible: haRunFlowers?.visible,
                isActive: haRunFlowers?.isActive
            },
            hasLeafsFlowerDouble: this.hasLeafsFlowerDouble,
            currentState: this.currentState
        });

        console.log('🌸 Flowers mode activation completed - now auto-switching based on scroll');
    }

    // 토끼을 idle로 복원 (hit-rabbit 완료 후)
    restoreRabbitIdle() {
        // rabbit-hurt 숨기기
        const rabbitHurtChar = this.characters.get('rabbit-hurt');
        if (rabbitHurtChar) {
            rabbitHurtChar.element.style.opacity = '0';
            rabbitHurtChar.isActive = false;
            this.stopAnimation(rabbitHurtChar);
        }

        // 일반 토끼 idle 다시 표시
        this.showRabbitCharacter();
        console.log('😌 Rabbit restored to idle animation');
    }

    // 한 번만 재생하는 애니메이션 (rabbit-hurt용)
    startSinglePlayAnimation(character) {
        console.log(`🎬 startSinglePlayAnimation called for: ${character.id}`);
        console.log(`📊 Character details:`, {
            id: character.id,
            frameCount: character.frameCount,
            framePrefix: character.framePrefix,
            frameRate: character.frameRate,
            hasImg: !!character.img
        });

        if (character.animationInterval || character.animationTimeout) {
            this.stopAnimation(character);
        }

        character.isActive = true;
        character.currentFrame = 0;

        const frameInterval = 1000 / character.frameRate;
        let frameCount = 0;

        const animateFrame = () => {
            console.log(`🎯 Updating frame ${frameCount + 1}/${character.frameCount} for ${character.id}`);
            this.updateFrame(character);
            frameCount++;

            // 모든 프레임 재생 완료 시 정지 (반복 없음)
            if (frameCount >= character.frameCount) {
                console.log(`🛑 ${character.framePrefix} animation completed (single play, ${frameCount} frames shown)`);
                // 마지막 프레임에서 정지, 숨기지 않음
                return;
            } else {
                character.animationTimeout = setTimeout(animateFrame, frameInterval);
            }
        };

        // 첫 프레임 즉시 표시
        console.log(`🚀 Showing first frame for ${character.id}`);
        this.updateFrame(character);
        frameCount++;

        if (frameCount < character.frameCount) {
            character.animationTimeout = setTimeout(animateFrame, frameInterval);
        } else {
            console.log(`⚠️ Only one frame to show for ${character.id}`);
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

        if (currentAnimation === 'ha-run' || currentAnimation === 'ha-run-flowers') {
            newAnimation = 'ha-run-leafs';
        } else if (currentAnimation === 'ha-idle' || currentAnimation === 'ha-idle-flowers') {
            newAnimation = 'ha-idle-leafs';
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



    // 픽셀 캐릭터에서 직접 leafsflowerdouble로 전환
    switchToLeafsFlowerDoubleFromPixel() {
        console.log('🌸 Switching to leafsflowerdouble from pixel manager');

        // leafsflowerdouble 플래그 설정
        this.hasLeafsFlowerDouble = true;
        console.log('🌸✨ LeafsFlowerDouble flag activated!');

        // 현재 상태 다시 적용하여 새 애니메이션으로 전환
        if (this.currentState === 'ha-idle' || this.currentState === 'ha-run') {
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

            const imagePath = `bride/public/animation/enemy-hit/enemy-hit${currentFrame}.png`;
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
            song.framePrefix = 'bride/public/animation/song-idle/song-idle';
            song.frameCount = 5;
            song.frameRate = 8;
            song.element.style.opacity = '1';  // opacity 명시적 설정
        } else if (targetAnimation === 'song-run') {
            song.framePrefix = 'bride/public/animation/song-run/song-run';
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