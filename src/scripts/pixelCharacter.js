// Pixel Character Animation System
class PixelCharacterManager {
    constructor() {
        this.characters = new Map();
        this.isInitialized = false;
        this.scrollProgress = 0;
        this.lastScrollY = 0;
        this.isAnimationPlaying = false;
        this.scrollBlocked = false;
        this.hasAnimationPlayed = false; // 애니메이션 실행 여부 추적
        this.animationTimer = null; // 애니메이션 타이머
        this.animationStartTime = null; // 애니메이션 시작 시간
        this.isIdleActive = false; // idle 상태 추적
        this.lastScrollY = 0; // 이전 스크롤 위치
        this.scrollTimer = null; // 스크롤 중지 감지 타이머
        this.currentActiveAnimation = null; // 현재 활성 애니메이션
        this.scrollDirection = 'none'; // 'up', 'down', 'none'
        this.scrollProgress = 0; // 전체 스크롤 진행도
        this.runStartY = 50; // Run 애니메이션 시작 Y 위치
        this.currentCharacterY = 50; // 현재 캐릭터 Y 위치 (lee-idle/lee-run 공유)
        this.currentMap = 'section-0'; // 현재 활성 맵
        this.isTransitioning = false; // 포털 전환 중 플래그

        // Configuration
        this.config = {
            defaultScale: 3, // N배 확대
            zIndex: -1, // 다른 요소보다 낮게
            position: 'fixed', // absolute or fixed
            centerX: '50%',
            centerY: '50%',
            pixelated: true // 픽셀아트 렌더링
        };
    }

    // Initialize the system
    init() {
        if (this.isInitialized) return;

        this.createContainer();
        this.setupScrollListener();
        this.setupScrollBlocking();
        this.isInitialized = true;

        console.log('Pixel Character System initialized');
    }

    // Create main container for characters
    createContainer() {
        const container = document.createElement('div');
        container.id = 'pixel-character-container';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: ${this.config.zIndex};
            overflow: hidden;
        `;

        document.body.appendChild(container);
        this.container = container;
    }

    // Add a character with specific triggers
    addCharacter(id, options = {}) {
        const character = {
            id,
            element: null,
            gif: null,
            isActive: false,
            scale: options.scale || this.config.defaultScale,
            x: options.x || this.config.centerX,
            y: options.y || this.config.centerY,
            trigger: options.trigger || 'scroll', // 'scroll', 'section', 'custom'
            triggerValue: options.triggerValue || 0, // scroll percentage or section selector
            src: options.src || '/animation/section1.gif',
            duration: options.duration || null, // null = infinite
            playOnce: options.playOnce || false,
            // PNG sequence options
            isPngSequence: options.isPngSequence || false,
            frameCount: options.frameCount || 1,
            frameRate: options.frameRate || 12, // FPS
            framePrefix: options.framePrefix || '', // e.g., 'frame_'
            framePadding: options.framePadding || 3 // e.g., 001, 002, 003
        };

        this.characters.set(id, character);
        this.createCharacterElement(character);

        return character;
    }

    // Create DOM element for character
    createCharacterElement(character) {
        const element = document.createElement('div');
        element.className = 'pixel-character';
        element.id = `pixel-character-${character.id}`;

        element.style.cssText = `
            position: absolute;
            left: ${character.x};
            top: ${character.y};
            transform: translate(-50%, -50%) scale(${character.scale});
            transform-origin: center;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
        `;

        const gif = document.createElement('img');

        // Set initial source based on type
        if (character.isPngSequence) {
            // PNG sequence - start with first frame (no padding for section files)
            gif.src = `${character.framePrefix}1.png`;
        } else {
            // Single GIF file
            gif.src = character.src;
        }

        gif.style.cssText = `
            display: block;
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
        `;

        // Handle image loading
        gif.onload = () => {
            console.log(`Character ${character.id} loaded: ${gif.naturalWidth}x${gif.naturalHeight}`);
        };

        gif.onerror = () => {
            console.error(`Failed to load character: ${gif.src}`);
        };

        element.appendChild(gif);
        this.container.appendChild(element);

        character.element = element;
        character.gif = gif;
    }

    // Setup scroll listener
    setupScrollListener() {
        let ticking = false;

        const updateOnScroll = () => {
            const scrollY = window.scrollY;

            // Debug logging for initial scroll detection
            if (!this.hasAnimationPlayed && scrollY > 0) {
                console.log(`📊 Scroll detected: ${scrollY}px (Animation played: ${this.hasAnimationPlayed}, Playing: ${this.isAnimationPlaying})`);
            }

            if (!this.scrollBlocked) {
                const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                this.scrollProgress = Math.min(scrollY / maxScroll, 1);

                // Check if we should trigger section 0 fadeout and animation
                this.handleSectionTransition(scrollY);

                // Check if section1 animation was skipped and force trigger if needed
                this.checkAndForceSection1Animation(scrollY);

                this.updateCharacters();
            }

            // Handle idle/run animation switching (works even when scroll is blocked initially)
            if (this.isIdleActive) {
                this.handleIdleRunTransition(scrollY);
            }

            ticking = false;
        };

        const onScroll = () => {
            if (!ticking) {
                requestAnimationFrame(updateOnScroll);
                ticking = true;
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });

        // Initial update
        updateOnScroll();
    }

    // Setup scroll blocking mechanism
    setupScrollBlocking() {
        // Prevent scroll when animation is playing
        const preventScroll = (e) => {
            if (this.scrollBlocked) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        };

        // Block various scroll events
        window.addEventListener('wheel', preventScroll, { passive: false });
        window.addEventListener('touchmove', preventScroll, { passive: false });
        window.addEventListener('keydown', (e) => {
            if (this.scrollBlocked && [32, 33, 34, 35, 36, 37, 38, 39, 40].includes(e.keyCode)) {
                e.preventDefault();
                return false;
            }
        });
    }

    // Handle section 0 to section 1 transition
    handleSectionTransition(scrollY) {
        const section0 = document.getElementById('section-0');

        if (!section0) return;

        // More aggressive trigger - any scroll triggers animation
        const triggerPoint = 5; // Just 5px scroll triggers animation

        if (scrollY > triggerPoint && !this.isAnimationPlaying && !this.hasAnimationPlayed) {
            console.log(`🎬 Section transition triggered at scrollY: ${scrollY}px`);
            this.startSectionTransition();
        }
    }

    // Check if section1 animation was skipped due to fast scrolling and force trigger
    checkAndForceSection1Animation(scrollY) {
        // Simplified force trigger - if we've scrolled significantly and animation never played
        const significantScroll = 100; // 100px scroll threshold

        if (scrollY > significantScroll && !this.hasAnimationPlayed && !this.isAnimationPlaying) {
            console.log(`🚨 Force triggering section1 animation - scrollY: ${scrollY}px`);
            this.startSectionTransition();
        }
    }

    // Start section 0 fadeout and animation
    startSectionTransition() {
        const section0 = document.getElementById('section-0');
        if (!section0) return;

        // Mark animation as played to prevent re-triggering
        this.hasAnimationPlayed = true;

        console.log('🎮 Starting immediate section transition and pixel animation');

        // Immediately hide section 0 (no transition)
        section0.style.transition = 'none';
        section0.style.opacity = '0';
        section0.style.display = 'none';

        // Block scrolling immediately
        this.blockScroll();

        // Reset scroll position to ensure we're at the top of section 1
        window.scrollTo(0, 0);

        // Start pixel animation immediately
        this.startPixelAnimation();
    }

    // Update character states based on scroll/triggers
    updateCharacters() {
        this.characters.forEach((character) => {
            this.updateCharacterState(character);
        });
    }

    // Update individual character state
    updateCharacterState(character) {
        let shouldShow = false;

        switch (character.trigger) {
            case 'scroll':
                shouldShow = this.scrollProgress >= (character.triggerValue / 100);
                break;

            case 'section':
                shouldShow = this.isSectionVisible(character.triggerValue);
                break;

            case 'custom':
                // Custom trigger logic can be added here
                shouldShow = character.isActive;
                break;

            default:
                shouldShow = true;
        }

        this.setCharacterVisibility(character, shouldShow);
    }

    // Check if section is visible
    isSectionVisible(selector) {
        const element = document.querySelector(selector);
        if (!element) return false;

        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // Element is visible if any part is in viewport
        return rect.top < windowHeight && rect.bottom > 0;
    }

    // Set character visibility and animation
    setCharacterVisibility(character, visible) {
        if (!character.element) return;

        if (visible && !character.isActive) {
            // Show character
            character.element.style.opacity = '1';
            character.isActive = true;

            // Play animation if it has duration
            if (character.duration && character.playOnce) {
                setTimeout(() => {
                    character.element.style.opacity = '0';
                    character.isActive = false;
                }, character.duration);
            }

        } else if (!visible && character.isActive) {
            // Hide character
            character.element.style.opacity = '0';
            character.isActive = false;
        }
    }

    // Manual trigger for custom animations
    triggerCharacter(id, show = true) {
        const character = this.characters.get(id);
        if (character) {
            character.isActive = show;
            this.setCharacterVisibility(character, show);
        }
    }

    // Remove character
    removeCharacter(id) {
        const character = this.characters.get(id);
        if (character && character.element) {
            character.element.remove();
            this.characters.delete(id);
        }
    }

    // Update character properties
    updateCharacter(id, properties) {
        const character = this.characters.get(id);
        if (!character) return;

        Object.assign(character, properties);

        if (character.element) {
            const element = character.element;
            element.style.left = character.x;
            element.style.top = character.y;
            element.style.transform = `translate(-50%, -50%) scale(${character.scale})`;
        }
    }

    // Block scrolling during animation
    blockScroll() {
        this.scrollBlocked = true;
        document.body.style.overflow = 'hidden';
        console.log('🚫 Scroll blocked');
    }

    // Unblock scrolling after animation
    unblockScroll() {
        this.scrollBlocked = false;
        document.body.style.overflow = '';
        console.log('✅ Scroll unblocked');
    }

    // Start pixel animation sequence
    startPixelAnimation() {
        this.isAnimationPlaying = true;

        // Show main character in center
        const mainCharacter = this.characters.get('main');
        if (mainCharacter) {
            // Position in center and show
            mainCharacter.element.style.left = '50%';
            mainCharacter.element.style.top = '50%';
            mainCharacter.element.style.transform = 'translate(-50%, -50%) scale(4)';
            mainCharacter.element.style.opacity = '1';
            mainCharacter.element.style.zIndex = '1000'; // Above other content during animation
            mainCharacter.isActive = true;

            console.log('🎮 Pixel animation started');

            // Track when animation starts
            this.animationStartTime = Date.now();

            // Handle PNG sequence vs GIF
            if (mainCharacter.isPngSequence) {
                // PNG sequence - precise frame control
                mainCharacter.onSequenceComplete = () => {
                    this.endPixelAnimation();
                };

                const sequenceDuration = this.playPngSequence(mainCharacter, false);
                console.log(`📊 PNG sequence duration: ${sequenceDuration}ms`);

                // Backup timer in case of issues
                this.animationTimer = setTimeout(() => {
                    this.endPixelAnimation();
                }, sequenceDuration + 1000);

            } else {
                // GIF - analyze duration
                this.getGifDuration(mainCharacter.src).then(duration => {
                    console.log(`📊 GIF actual duration: ${duration}ms`);

                    const bufferTime = 500;
                    const animationDuration = duration + bufferTime;

                    this.animationTimer = setTimeout(() => {
                        this.endPixelAnimation();
                    }, animationDuration);
                }).catch(error => {
                    console.warn('Could not get GIF duration, using fallback:', error);
                    const animationDuration = 5000;
                    this.animationTimer = setTimeout(() => {
                        this.endPixelAnimation();
                    }, animationDuration);
                });
            }
        }
    }

    // Get actual GIF animation duration
    async getGifDuration(gifUrl) {
        return new Promise((resolve, reject) => {
            fetch(gifUrl)
                .then(response => response.arrayBuffer())
                .then(buffer => {
                    const duration = this.parseGifDuration(buffer);
                    resolve(duration);
                })
                .catch(reject);
        });
    }

    // Parse GIF file to extract frame durations
    parseGifDuration(buffer) {
        const data = new Uint8Array(buffer);
        let totalDuration = 0;
        let pos = 0;

        // Check GIF header
        if (data[0] !== 0x47 || data[1] !== 0x49 || data[2] !== 0x46) {
            throw new Error('Not a valid GIF file');
        }

        // Skip header (6 bytes) and logical screen descriptor
        pos = 6;
        const globalColorTableFlag = (data[pos + 4] & 0x80) !== 0;
        const globalColorTableSize = 2 << (data[pos + 4] & 0x07);
        pos += 7;

        if (globalColorTableFlag) {
            pos += globalColorTableSize * 3;
        }

        // Parse data stream
        while (pos < data.length) {
            const separator = data[pos++];

            if (separator === 0x21) { // Extension
                const label = data[pos++];

                if (label === 0xF9) { // Graphic Control Extension
                    const blockSize = data[pos++];
                    pos++; // Skip packed field

                    // Get delay time (in 1/100ths of a second)
                    const delayTime = data[pos] | (data[pos + 1] << 8);
                    totalDuration += delayTime * 10; // Convert to milliseconds

                    pos += blockSize - 2;
                } else {
                    // Skip other extensions
                    let blockSize = data[pos++];
                    while (blockSize > 0) {
                        pos += blockSize;
                        blockSize = data[pos++];
                    }
                }
            } else if (separator === 0x2C) { // Image separator
                // Skip image descriptor
                pos += 9;

                const localColorTableFlag = (data[pos - 1] & 0x80) !== 0;
                if (localColorTableFlag) {
                    const localColorTableSize = 2 << (data[pos - 1] & 0x07);
                    pos += localColorTableSize * 3;
                }

                // Skip LZW minimum code size
                pos++;

                // Skip image data
                let blockSize = data[pos++];
                while (blockSize > 0) {
                    pos += blockSize;
                    if (pos >= data.length) break;
                    blockSize = data[pos++];
                }
            } else if (separator === 0x3B) { // Trailer
                break;
            } else {
                // Unknown data, try to continue
                pos++;
            }
        }

        return totalDuration || 3000; // Default to 3 seconds if parsing fails
    }

    // Play PNG sequence animation
    playPngSequence(character, loop = false) {
        if (!character.isPngSequence) return;

        let currentFrame = 0;
        const frameInterval = 1000 / character.frameRate; // Frame duration in ms

        const playFrame = () => {
            if (!character.isActive) return; // Stop if character is deactivated

            // Generate frame filename (no padding for section files)
            const frameNumber = currentFrame + 1; // Start from 1 instead of 0
            const frameSrc = `${character.framePrefix}${frameNumber}.png`;

            // Update image source
            if (character.gif) {
                character.gif.src = frameSrc;
                console.log(`🖼️ Loading frame: ${frameSrc}`);
            }

            currentFrame++;

            // Check if sequence is complete
            if (currentFrame >= character.frameCount) {
                if (loop) {
                    currentFrame = 0; // Reset for loop
                    setTimeout(playFrame, frameInterval);
                } else {
                    // Sequence complete, trigger callback
                    if (character.onSequenceComplete) {
                        character.onSequenceComplete();
                    }
                    console.log(`🎮 PNG sequence completed for ${character.id}`);
                    return;
                }
            } else {
                setTimeout(playFrame, frameInterval);
            }
        };

        console.log(`🎮 Starting PNG sequence for ${character.id} (${character.frameCount} frames at ${character.frameRate} FPS)`);
        playFrame();

        // Return total duration for timing purposes
        return (character.frameCount * frameInterval);
    }

    // End pixel animation and unblock scroll
    endPixelAnimation() {
        // Prevent double execution
        if (!this.isAnimationPlaying) return;

        this.isAnimationPlaying = false;

        // Clear any pending animation timer
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }

        const mainCharacter = this.characters.get('main');
        if (mainCharacter) {
            // Hide character immediately (no transition)
            mainCharacter.element.style.transition = 'none';
            mainCharacter.element.style.opacity = '0';
            mainCharacter.element.style.display = 'none';
            mainCharacter.element.style.zIndex = this.config.zIndex; // Back to background
            mainCharacter.isActive = false;

            console.log('🎮 Pixel animation ended immediately');

            // Start idle animation after main animation ends
            this.startIdleAnimation();
        }

        // Ensure minimum animation time has passed before allowing scroll
        const minAnimationTime = 4000; // Minimum 4 seconds
        const elapsedTime = Date.now() - (this.animationStartTime || Date.now());
        const remainingTime = Math.max(0, minAnimationTime - elapsedTime);

        // Unblock scrolling after ensuring minimum time
        setTimeout(() => {
            // Transition to Section 1 map-style
            this.transitionToSection1();

            console.log('🗺️ Map transition to Section 1 completed');
        }, remainingTime + 500);
    }

    // Transition to Section 1 map-style (complete separation from Section 0)
    transitionToSection1() {
        // Hide hero section completely
        const section0 = document.getElementById('section-0');
        if (section0) {
            section0.style.display = 'none';
        }

        // Show Section 1 at screen top
        const section1 = document.getElementById('section-1');
        if (section1) {
            section1.style.top = '0'; // Move to screen top
            section1.style.zIndex = '0'; // Bring above background
        }

        // Reset scroll position to top (like entering a new map)
        window.scrollTo(0, 0);

        // Unblock scrolling for Section 1
        this.unblockScroll();

        // Set current map to Section 1
        this.currentMap = 'section-1';

        console.log('🗺️ Entered Section 1 map');
    }

    // Handle idle/run animation transition based on scroll - NEW PORTAL SYSTEM
    handleIdleRunTransition(scrollY) {
        const scrollDelta = scrollY - this.lastScrollY;
        const scrollSpeed = Math.abs(scrollDelta);

        // Update scroll direction
        if (scrollSpeed > 1) {
            this.scrollDirection = scrollDelta > 0 ? 'down' : 'up';

            // Clear existing scroll timer
            if (this.scrollTimer) {
                clearTimeout(this.scrollTimer);
                this.scrollTimer = null;
            }

            // Switch to run animation with DIRECT scroll mapping
            if (this.currentActiveAnimation !== 'run') {
                this.switchToRunAnimation();
            } else {
                // Update run position using DIRECT scroll mapping
                this.updateCharacterPositionByScroll(scrollY);
            }

            // Set timer to return to idle when scrolling stops
            this.scrollTimer = setTimeout(() => {
                this.scrollDirection = 'none';
                this.switchToIdleAnimation();
            }, 300); // 300ms after scrolling stops
        }

        this.lastScrollY = scrollY;
    }

    // NEW: Direct scroll to character position mapping
    updateCharacterPositionByScroll(scrollY) {
        // Get current section height for calculating scroll percentage
        const currentSection = document.getElementById(this.currentMap);
        if (!currentSection) return;

        // Use the scroll trigger area height for accurate calculation
        const scrollTriggerArea = document.getElementById('scroll-trigger-area');
        let effectiveScrollHeight;

        if (scrollTriggerArea) {
            // Use the scroll trigger area height (200vh)
            effectiveScrollHeight = window.innerHeight * 2; // 200vh = 2 * viewport height
        } else {
            // Fallback to document body height or section height
            effectiveScrollHeight = Math.max(
                document.body.scrollHeight,
                currentSection.scrollHeight,
                window.innerHeight * 3
            );
        }

        const scrollPercent = Math.min((scrollY / effectiveScrollHeight) * 100, 150); // Allow up to 150% for transition

        // Update character position directly based on scroll
        this.currentCharacterY = scrollPercent;

        const runChar = this.characters.get('run');
        if (runChar && runChar.isActive) {
            runChar.y = scrollPercent + '%';

            // Update DOM position
            if (runChar.element) {
                runChar.element.style.top = runChar.y;
                runChar.element.style.transform = `translate(-50%, -50%) scale(${runChar.scale})`;
            }

            // Check for portal collision
            this.checkPortalCollision(runChar);
        }

        console.log(`📍 Character position: ${scrollPercent.toFixed(1)}% (scroll: ${scrollY}px / ${effectiveScrollHeight}px)`);
    }

    // NEW: Check if character has reached the portal (transition zone)
    checkPortalCollision(character) {
        const currentY = parseFloat(character.y.replace('%', ''));

        // Portal is located at 120% of each section (near the bottom)
        const portalY = 120;

        if (currentY >= portalY) {
            console.log(`🌀 Character reached portal at ${currentY.toFixed(1)}% - triggering transition`);
            this.triggerPortalTransition();
        }
    }

    // NEW: Trigger transition when character hits portal
    triggerPortalTransition() {
        // Prevent multiple triggers
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        const nextMap = this.getNextMap();
        console.log(`🚪 Portal transition: ${this.currentMap} → ${nextMap}`);

        // Transition to next map immediately
        this.transitionToMap(nextMap, this.characters.get('idle'));

        // Reset transition flag after a short delay
        setTimeout(() => {
            this.isTransitioning = false;
        }, 1000);
    }

    // Calculate dynamic Y position for run animation (LEGACY - keeping for compatibility)
    calculateRunYPosition(scrollDelta) {
        let baseY = this.currentCharacterY; // Start from current position

        // Use scroll delta (change amount) instead of total progress to maintain consistent speed
        let moveAmount = Math.abs(scrollDelta) * 0.15; // Increased speed: 0.05 → 0.15 for easier screen exit

        // Apply maximum speed limit to prevent too fast movement
        const maxMoveAmount = 3.0; // Increased max: 1.0 → 3.0 for longer range movement
        moveAmount = Math.min(moveAmount, maxMoveAmount);

        // Adjust based on scroll direction
        if (this.scrollDirection === 'down') {
            // Scrolling down - character moves down gradually
            baseY = this.currentCharacterY + moveAmount;
        } else if (this.scrollDirection === 'up') {
            // Scrolling up - character moves up gradually
            baseY = this.currentCharacterY - moveAmount;
        }

        // No clamp - allow character to exit screen bounds
        this.currentCharacterY = baseY;

        return baseY;
    }

    // Update run character position (DEPRECATED - replaced by updateCharacterPositionByScroll)
    updateRunPosition() {
        // This method is now handled by updateCharacterPositionByScroll in the new portal system
        // Keeping for compatibility but functionality moved to direct scroll mapping
        console.log('📢 updateRunPosition called - this should be handled by updateCharacterPositionByScroll');
    }

    // DEPRECATED: Old screen exit detection (replaced by portal system)
    hasCharacterExitedScreen(character) {
        // This method is deprecated in favor of portal-based collision detection
        console.log('📢 hasCharacterExitedScreen called - replaced by portal collision system');
        return false; // Disabled
    }

    // DEPRECATED: Old screen exit handler (replaced by portal system)
    handleCharacterScreenExit() {
        // This method is deprecated in favor of triggerPortalTransition
        console.log('📢 handleCharacterScreenExit called - replaced by portal transition system');
    }

    // Get next map based on current map
    getNextMap() {
        switch(this.currentMap) {
            case 'section-1': return 'section-2';
            case 'section-2': return 'section-3';
            case 'section-3': return 'section-4'; // Gallery
            case 'section-4': return 'section-5'; // Location
            case 'section-5': return 'section-6'; // Account
            default: return 'section-1';
        }
    }

    // Transition to specific map
    transitionToMap(mapId, character) {
        // Hide current map
        if (this.currentMap) {
            const currentSection = document.getElementById(this.currentMap);
            if (currentSection) {
                currentSection.style.display = 'none';
            }
        }

        // Show target map
        const targetSection = document.getElementById(mapId);
        if (targetSection) {
            targetSection.style.display = 'block';
            targetSection.style.position = 'fixed';
            targetSection.style.top = '0';
            targetSection.style.left = '0';
            targetSection.style.width = '100%';
            targetSection.style.zIndex = '0';
        }

        // Reset scroll position (like entering new map)
        window.scrollTo(0, 0);

        // Update current map
        this.currentMap = mapId;

        // Reset character position to top of new map
        this.currentCharacterY = 0;

        // Show character at top of new map
        this.smoothTeleportToTop(character, 0);

        console.log(`🗺️ Successfully transitioned to ${mapId}`);
    }

    // Smoothly teleport character to top of screen
    smoothTeleportToTop(targetCharacter, targetY) {
        if (!targetCharacter) return;

        // Set target position
        targetCharacter.y = targetY + '%';

        // Add transition for smooth movement
        targetCharacter.element.style.transition = 'top 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        targetCharacter.element.style.left = targetCharacter.x;
        targetCharacter.element.style.top = targetCharacter.y;
        targetCharacter.element.style.transform = `translate(-50%, -50%) scale(${targetCharacter.scale})`;
        targetCharacter.element.style.opacity = '1';
        targetCharacter.element.style.display = 'block';
        targetCharacter.element.style.zIndex = this.config.zIndex;
        targetCharacter.isActive = true;

        // Switch to idle animation at new position
        this.currentActiveAnimation = 'idle';

        // Start idle animation loop at new position
        if (targetCharacter.isPngSequence) {
            this.playPngSequence(targetCharacter, true); // loop=true
        }

        // Remove transition after animation completes
        setTimeout(() => {
            if (targetCharacter.element) {
                targetCharacter.element.style.transition = '';
            }
        }, 800);

        console.log(`✨ Character teleported to top (${targetY}%) and switched to idle mode`);
    }

    // Switch to run animation
    switchToRunAnimation() {
        const idleChar = this.characters.get('idle');
        const runChar = this.characters.get('run');

        if (idleChar && runChar && this.currentActiveAnimation !== 'run') {
            // Hide idle
            this.stopCharacterAnimation(idleChar);

            // Start run at current position (no delta change initially)
            runChar.y = this.currentCharacterY + '%';

            // Show run with dynamic position
            this.showCharacterAnimation(runChar, true); // true for loop
            this.currentActiveAnimation = 'run';

            console.log(`🏃 Switched to run animation at Y: ${this.currentCharacterY}%`);
        }
    }

    // Switch to idle animation
    switchToIdleAnimation() {
        const idleChar = this.characters.get('idle');
        const runChar = this.characters.get('run');

        if (idleChar && runChar && this.currentActiveAnimation !== 'idle') {
            // Hide run
            this.stopCharacterAnimation(runChar);

            // Set idle position to current character position (maintain continuity)
            idleChar.y = this.currentCharacterY + '%';

            // Show idle at the same position where run ended
            this.showCharacterAnimation(idleChar, true); // true for loop
            this.currentActiveAnimation = 'idle';

            console.log(`😴 Switched to idle animation at Y: ${this.currentCharacterY}%`);
        }
    }

    // Show character animation
    showCharacterAnimation(character, loop = false) {
        if (!character) return;

        character.element.style.left = character.x;
        character.element.style.top = character.y;
        character.element.style.transform = `translate(-50%, -50%) scale(${character.scale})`;
        character.element.style.opacity = '1';
        character.element.style.display = 'block';
        character.element.style.zIndex = this.config.zIndex;
        character.isActive = true;

        if (character.isPngSequence) {
            this.playPngSequence(character, loop);
        }
    }

    // Stop character animation
    stopCharacterAnimation(character) {
        if (!character) return;

        character.element.style.opacity = '0';
        character.element.style.display = 'none';
        character.isActive = false;
    }

    // Start idle animation (continuous loop)
    startIdleAnimation() {
        this.isIdleActive = true; // Enable idle/run switching
        this.currentActiveAnimation = 'idle';
        this.currentCharacterY = 50; // Initialize at center

        const idleCharacter = this.characters.get('idle');
        if (idleCharacter) {
            // Set initial idle position
            idleCharacter.y = this.currentCharacterY + '%';
            this.showCharacterAnimation(idleCharacter, true); // true for loop
            console.log('🎮 Idle state activated at center - scroll to switch to run');
        }
    }

    // Stop idle animation
    stopIdleAnimation() {
        this.isIdleActive = false;
        this.currentActiveAnimation = null;

        const idleCharacter = this.characters.get('idle');
        const runCharacter = this.characters.get('run');

        if (idleCharacter) {
            this.stopCharacterAnimation(idleCharacter);
        }

        if (runCharacter) {
            this.stopCharacterAnimation(runCharacter);
        }

        // Clear scroll timer
        if (this.scrollTimer) {
            clearTimeout(this.scrollTimer);
            this.scrollTimer = null;
        }

        console.log('🎮 Idle/Run system stopped');
    }

    // Destroy the system
    destroy() {
        if (this.container) {
            this.container.remove();
        }
        // Clear any pending timers
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }
        // Stop idle animation
        this.stopIdleAnimation();
        this.characters.clear();
        this.isInitialized = false;
        this.hasAnimationPlayed = false; // Reset animation flag
        this.animationStartTime = null;
        this.unblockScroll(); // Ensure scroll is unblocked
    }
}

// Global instance
window.pixelCharacterManager = new PixelCharacterManager();

export default PixelCharacterManager;