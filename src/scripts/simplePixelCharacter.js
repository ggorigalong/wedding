// 간소화된 픽셀 캐릭터 시스템 - 수동 스크롤과 연동

class SimplePixelCharacterManager {
    constructor() {
        this.characters = new Map();
        this.container = null;
        this.currentState = 'hidden'; // 'hidden', 'main', 'idle', 'run'
        this.currentSection = 0;
        this.characterY = 50; // 캐릭터 Y 위치 (퍼센트)
        this.isScrolling = false;
        this.scrollTimeout = null;
        this.mainAnimationCallback = null; // 메인 애니메이션 완료 콜백
        this.hitSlimeTriggered = false; // hit-slime 애니메이션 트리거 여부
        this.isHitSlimePlaying = false; // hit-slime 애니메이션 재생 중 여부
        this.isHitIdlePlaying = false; // hit-idle 애니메이션 재생 중 여부
        this.hasFlower = false; // 꽃 아이템 획득 여부 (hit-idle 완료 후)
        this.skipPositionUpdate = false; // 위치 업데이트 스킵 플래그

        // 통합 캐릭터 컨테이너
        this.mainCharacter = null;
        this.animationStates = {};
        this.sectionTransitionTimer = null; // 섹션 전환 복원 타이머

        // 모바일 디바이스 감지
        this.isMobile = this.detectMobile();

        // 성능 최적화를 위한 프레임 제어
        this.lastFrameTime = 0;
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

    // 통합 캐릭터 시스템 설정
    async setupUnifiedCharacter() {
        // 메인 캐릭터 컨테이너 생성
        this.mainCharacter = {
            element: document.createElement('div'),
            currentAnimation: null,
            currentFrame: 0,
            animationTimer: null,
            isActive: false
        };

        // 스타일 설정
        this.mainCharacter.element.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%) scale(4);
            z-index: 10;
            opacity: 0;
            pointer-events: none;
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
        `;

        // 컨테이너에 추가
        this.container.appendChild(this.mainCharacter.element);

        // 프리로드된 이미지 저장소
        this.preloadedImages = {};

        // 애니메이션 상태들 정의
        this.animationStates = {
            'idle': {
                framePrefix: '/animation/idle1/idle',
                frameCount: 2, // idle1.png, idle2.png
                frameRate: 8,
                loop: true
            },
            'run': {
                framePrefix: '/animation/run1/run',
                frameCount: 7, // run1.png ~ run7.png
                frameRate: 12,
                loop: true
            },
            'idle-flower': {
                framePrefix: '/animation/idle-flower/idle',
                frameCount: 2,
                frameRate: 8,
                loop: true
            },
            'run-flower1': {
                framePrefix: '/animation/run-flower1/run-flower',
                frameCount: 7,
                frameRate: 12,
                loop: true
            },
            'hit-idle': {
                framePrefix: '/animation/hit-idle/hit-idle',
                frameCount: 5,
                frameRate: 8,
                loop: true
            },
            'hit-slime': {
                framePrefix: '/animation/hit-slime/hit-slime',
                frameCount: 21,
                frameRate: 12,
                loop: false
            },
            'idle-leafs': {
                framePrefix: '/animation/idle-leafs/idle',
                frameCount: 2,
                frameRate: 8,
                loop: true
            },
            'run-leafsflower': {
                framePrefix: '/animation/run-leafsflower/run-leafsflower',
                frameCount: 7,
                frameRate: 12,
                loop: true
            }
        };

        // 모든 애니메이션 이미지 프리로드 (백그라운드에서 실행)
        this.preloadAllAnimationImages().catch(err =>
            console.warn('⚠️ Image preloading failed:', err)
        );

        console.log('🔧 Unified character system initialized');
    }

    // 모든 애니메이션 이미지 프리로드
    async preloadAllAnimationImages() {
        console.log('📥 Starting image preloading...');
        const loadPromises = [];

        for (const [animationName, config] of Object.entries(this.animationStates)) {
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
                        console.warn(`❌ Failed to preload: ${imagePath}`);
                        resolve(); // Continue even if one image fails
                    };
                    img.src = imagePath;
                });

                loadPromises.push(promise);
            }
        }

        await Promise.all(loadPromises);
        console.log('✅ All animation images preloaded');
    }

    async setupCharacters() {
        // 메인 애니메이션 (Section-1에서 재생) - 스프레드시트 기반
        this.addCharacter('main', {
            isSpreadsheetBased: true, // 새로운 플래그
            spreadsheetData: null, // 나중에 로드될 데이터
            scale: 4,
            x: '50%',
            y: '50%',
            visible: false
        });

        // 아이들 애니메이션 (Section-2에서 기본 상태)
        this.addCharacter('idle', {
            isPngSequence: true,
            framePrefix: '/animation/idle1/idle',
            frameCount: 2,
            frameRate: 4,
            framePadding: 0,
            scale: 4,
            x: '50%',
            y: '50%',
            visible: false
        });

        // 런 애니메이션 (Section-2에서 스크롤 시)
        this.addCharacter('run', {
            isPngSequence: true,
            framePrefix: '/animation/run1/run',
            frameCount: 7,
            frameRate: 14,
            framePadding: 0,
            scale: 4,
            x: '50%',
            y: '50%',
            visible: false
        });

        // 슬라임 idle 애니메이션 (Section-5에서 사용)
        this.addCharacter('slime-idle', {
            isPngSequence: true,
            framePrefix: '/animation/slime/slime',
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
            framePrefix: '/animation/slime-hurt/slime-hurt',
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
            framePrefix: '/animation/hit-slime/hit-slime',
            frameCount: 21, // hit-slime 파일 개수 확인 후 조정 필요
            frameRate: 12, // 적당한 속도
            framePadding: 0,
            scale: 3.5, // 1.5배 크게 (4 * 1.5 = 6)
            x: '50%',
            y: '70%', // 70vh 위치에 고정
            visible: false,
            loop: false // 한 번만 재생
        });

        // hit-idle 애니메이션 (hit-slime 완료 후 반복 실행)
        this.addCharacter('hit-idle', {
            isPngSequence: true,
            framePrefix: '/animation/hit-idle/hit-idle',
            frameCount: 5, // hit-idle1.png ~ hit-idle5.png
            frameRate: 8, // idle 속도
            framePadding: 0,
            scale: 4,
            x: '50%',
            y: '50%', // hit-slime과 동일한 위치
            visible: false,
            loop: true // 반복 실행
        });

        // idle-flower 애니메이션 (꽃 아이템 획득 후)
        this.addCharacter('idle-flower', {
            isPngSequence: true,
            framePrefix: '/animation/idle-flower/idle',
            frameCount: 2, // idle1.png, idle2.png
            frameRate: 8, // idle 속도
            framePadding: 0,
            scale: 4,
            x: '50%',
            y: '50%',
            visible: false,
            loop: true
        });

        // run-flower1 애니메이션 (꽃 아이템 획득 후)
        this.addCharacter('run-flower1', {
            isPngSequence: true,
            framePrefix: '/animation/run-flower1/run-flower',
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
            framePrefix: '/animation/leafs/leafs',
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

        console.log('🎮 Characters setup: main (spreadsheet), idle (png), run (png), slime-idle (png), slime-hurt (png), hit-slime (png), hit-idle (png), idle-flower (png), run-flower1 (png), leafs (png)');

        // 갤러리 트리거 관련 초기화
        this.galleryLeafsTriggered = false;

        // 스프레드시트 데이터 로드
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

        // 모바일에서 frameRate 절반으로 감소 (성능 최적화)
        const effectiveFrameRate = this.isMobile ? Math.max(4, animation.frameRate / 2) : animation.frameRate;
        const frameDuration = 1000 / effectiveFrameRate;

        console.log(`🎬 Starting animation: ${this.mainCharacter.currentAnimation} at ${effectiveFrameRate}fps (${this.isMobile ? 'Mobile' : 'Desktop'})`);

        const updateFrame = (currentTime) => {
            // 프레임 타이밍 제어 (requestAnimationFrame 기반)
            if (currentTime - this.lastFrameTime < frameDuration) {
                this.mainCharacter.animationTimer = requestAnimationFrame(updateFrame);
                return;
            }

            this.lastFrameTime = currentTime;

            // 프레임 이미지 업데이트 (프리로드된 이미지 사용)
            const frameNumber = this.mainCharacter.currentFrame + 1;
            const imageKey = `frame_${frameNumber}`;
            const preloadedImg = this.preloadedImages[this.mainCharacter.currentAnimation]?.[imageKey];

            if (preloadedImg) {
                // 프리로드된 이미지 사용
                this.mainCharacter.element.style.backgroundImage = `url('${preloadedImg.src}')`;
            } else {
                // 폴백: 기존 방식
                const imagePath = `${animation.framePrefix}${frameNumber}.png`;
                this.mainCharacter.element.style.backgroundImage = `url('${imagePath}')`;
                console.warn(`⚠️ Using fallback for: ${imagePath}`);
            }

            this.mainCharacter.element.style.backgroundSize = 'contain';
            this.mainCharacter.element.style.backgroundRepeat = 'no-repeat';
            this.mainCharacter.element.style.backgroundPosition = 'center';
            this.mainCharacter.element.style.width = '32px';
            this.mainCharacter.element.style.height = '32px';

            console.log(`🖼️ Frame updated: frame ${frameNumber}/${animation.frameCount} (preloaded: ${!!preloadedImg})`);

            this.mainCharacter.currentFrame++;

            // 애니메이션 완료 또는 반복
            if (this.mainCharacter.currentFrame >= animation.frameCount) {
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

    // 통합 캐릭터 숨기기
    hideUnifiedCharacter() {
        console.log('👻 Hiding unified character');
        this.mainCharacter.element.style.opacity = '0';
        this.mainCharacter.isActive = false;
        if (this.mainCharacter.animationTimer) {
            cancelAnimationFrame(this.mainCharacter.animationTimer);
        }
        console.log(`👻 Unified character hidden: opacity=${this.mainCharacter.element.style.opacity}, isActive=${this.mainCharacter.isActive}`);
    }

    // 통합 캐릭터 보이기
    showUnifiedCharacter() {
        console.log('👀 Showing unified character');
        this.mainCharacter.element.style.opacity = '1';
        this.mainCharacter.isActive = true;
        console.log(`👀 Unified character shown: opacity=${this.mainCharacter.element.style.opacity}, isActive=${this.mainCharacter.isActive}`);
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

            // JSON 파일 로드
            const response = await fetch('/animation/section1.json');
            if (!response.ok) {
                throw new Error(`Failed to load JSON: ${response.status}`);
            }

            const jsonData = await response.json();
            console.log('✅ JSON data loaded:', jsonData);

            // JSON 형식을 우리 스프레드시트 형식으로 변환
            const frames = [];
            const frameKeys = Object.keys(jsonData.frames);

            frameKeys.forEach((frameKey, index) => {
                const frameInfo = jsonData.frames[frameKey];
                frames.push({
                    image: `/animation/${jsonData.meta.image}`, // section1.png 경로 구성
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

        } catch (error) {
            console.error('❌ Failed to load section1 spreadsheet data:', error);
            console.log('⚠️ Falling back to empty data - animation will use fallback method');
        }
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
        if (!character.spreadsheetData || !character.spreadsheetData.frames) {
            console.error('❌ Spreadsheet data not loaded for character:', character.id);
            return;
        }

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

                // 메인 애니메이션 완료 콜백 호출
                if (character.id === 'main' && this.mainAnimationCallback) {
                    this.mainAnimationCallback();
                    this.mainAnimationCallback = null;
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
        console.log(`🌸 Flower check: hasFlower=${this.hasFlower}, leafsTriggered=${this.galleryLeafsTriggered}, newState=${newState}`);

        // leafs 애니메이션 트리거된 경우 leafs 버전 우선
        if (this.galleryLeafsTriggered && newState === 'idle') {
            actualAnimation = 'idle-leafs';
            console.log(`🍃 Using leafs idle: ${actualAnimation}`);
        } else if (this.galleryLeafsTriggered && newState === 'run') {
            actualAnimation = 'run-leafsflower';
            console.log(`🍃 Using leafs run: ${actualAnimation}`);
        } else if (this.hasFlower && newState === 'idle') {
            actualAnimation = 'idle-flower';
            console.log(`🌸 Using flower idle: ${actualAnimation}`);
        } else if (this.hasFlower && newState === 'run') {
            actualAnimation = 'run-flower1';
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
            if (newState === 'idle') {
                actualAnimation = 'idle-flower';
            } else if (newState === 'run') {
                actualAnimation = 'run-flower1';
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

        // 기존 개별 캐릭터들 숨기기 (슬라임 제외)
        this.characters.forEach((char, id) => {
            if (id.startsWith('slime-')) return; // 슬라임은 별도 관리
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

        if (!mainChar.spreadsheetData) {
            console.error('❌ Main animation spreadsheet data not loaded! Loading fallback...');
            // 폴백: 기존 PNG 시퀀스 방식으로 전환
            this.loadFallbackMainAnimation();
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
            mainChar.framePrefix = '/animation/section1/section';
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

        this.characterY = startHeight;
        this.currentSection = sectionIndex;

        // 스크롤 중이면 run, 아니면 idle로 시작
        const initialState = this.isScrolling ? 'run' : 'idle';
        console.log(`🏃 Starting Section-${sectionIndex} in ${initialState} state (isScrolling: ${this.isScrolling})`);
        this.switchToState(initialState);
    }

    // 호환성을 위한 기존 메서드들
    switchToIdleState() {
        this.switchToSectionState(2, 60);
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

        // Section-5에서는 일반 캐릭터(idle/run)도 함께 표시
        const startHeight = -25; // 화면 위 바깥에서 시작
        this.characterY = startHeight;

        // 스크롤 상태에 따라 일반 캐릭터 시작 상태 결정
        const mainState = this.isScrolling ? 'run' : 'idle';
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
                this.switchToState('run');
            } else {
                // 다른 섹션: 일반 run 상태
                this.switchToState('run');
            }
        }

        // Y 위치 업데이트 (일반 캐릭터는 모든 섹션에서 동일)
        // hit-idle 전환 시에는 위치 업데이트 스킵
        if (!this.skipPositionUpdate) {
            // 0~1: startHeight~100% (화면 내)
            // 1~1.5: 100%~125% (화면 밖으로 이동)
            if (yProgress <= 1) {
                const range = 100 - startHeight; // 이동 범위 계산
                this.characterY = startHeight + (yProgress * range);
            } else {
                this.characterY = 100 + ((yProgress - 1) * 50); // 화면 밖으로 이동
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
                    this.switchToState('idle');
                } else {
                    // 다른 섹션: 일반 idle 상태
                    this.switchToState('idle');
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

    // Hit-slime 애니메이션 실행
    triggerHitSlimeAnimation() {
        this.hitSlimeTriggered = true;
        this.isHitSlimePlaying = true;

        // 스크롤 잠금
        if (window.manualScrollManager) {
            window.manualScrollManager.lockScroll('hit-slime animation');
        }

        // 통합 캐릭터 (idle/run) 숨기기
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

        if (currentAnimation === 'run' || currentAnimation === 'run-flower1') {
            newAnimation = 'run-leafsflower';
        } else if (currentAnimation === 'idle' || currentAnimation === 'idle-flower') {
            newAnimation = 'idle-leafs';
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