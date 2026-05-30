# 애니메이션 추가 가이드

이 문서는 wedding 프로젝트에서 두 가지 방식의 애니메이션을 추가하는 방법을 설명합니다.

## 목차
1. [PNG 시퀀스 애니메이션 추가](#1-png-시퀀스-애니메이션-추가)
2. [스프레드시트 애니메이션 추가](#2-스프레드시트-애니메이션-추가)
3. [언제 어떤 방식을 사용할까](#3-언제-어떤-방식을-사용할까)
4. [트러블슈팅](#4-트러블슈팅)

## 1. PNG 시퀀스 애니메이션 추가

연속된 개별 PNG 파일들을 순차적으로 재생하는 방식입니다.

### 1.1 파일 구조
```
bride/public/animation/
└── your-animation/
    ├── your-animation1.png
    ├── your-animation2.png
    ├── your-animation3.png
    └── ...
```

### 1.2 코드 추가 방법

#### Step 1: addCharacter로 애니메이션 등록
```javascript
// bride/src/scripts/simplePixelCharacter.js

// 생성자 또는 초기화 함수에서 추가
this.addCharacter('your-animation', {
    isPngSequence: true,                    // PNG 시퀀스 방식
    framePrefix: 'bride/public/animation/your-animation/your-animation',  // 파일 경로 프리픽스
    frameCount: 7,                          // 총 프레임 수 (your-animation1.png ~ your-animation7.png)
    frameRate: 8,                           // 초당 프레임 수
    framePadding: 0,                        // 파일명 패딩 (기본값: 0)
    scale: 4,                               // 크기 배율
    x: '50%',                               // 위치 X
    y: '70%',                               // 위치 Y
    visible: false,                         // 초기 표시 여부
    loop: true                              // 반복 재생 여부
});
```

#### Step 2: animationStates에 등록 (통합 캐릭터 사용시만)
```javascript
// 통합 캐릭터(main character)에서 사용할 경우에만 추가
this.animationStates = {
    // ... 기존 애니메이션들
    'your-animation': {
        framePrefix: 'bride/public/animation/your-animation/your-animation',
        frameCount: 7,
        frameRate: 8,
        loop: true
    }
};
```

#### Step 3: 애니메이션 실행
```javascript
// 개별 캐릭터로 실행
const yourChar = this.characters.get('your-animation');
if (yourChar) {
    yourChar.element.style.opacity = '1';
    yourChar.isActive = true;
    this.startAnimation(yourChar);  // PNG 시퀀스용 함수
}

// 또는 통합 캐릭터로 실행
this.switchUnifiedAnimation('your-animation');
```

### 1.3 실제 예시: rabbit-idle
```javascript
// 토끼 idle 애니메이션 (Section-5에서 사용)
this.addCharacter('rabbit-idle', {
    isPngSequence: true,
    framePrefix: 'bride/public/animation/rabbit/rabbit-idle',
    frameCount: 7, // rabbit-idle1~rabbit-idle7
    frameRate: 8,  // 8fps로 천천히
    scale: 4,
    x: '50%',
    y: '70%',
    visible: false
});
```

## 2. 스프레드시트 애니메이션 추가

하나의 스프라이트 시트 이미지와 JSON 메타데이터를 사용하는 방식입니다.

### 2.1 파일 구조
```
bride/public/animation/
└── your-animation/
    ├── your-animation.png      # 스프라이트 시트
    └── your-animation.json     # 프레임 메타데이터
```

### 2.2 JSON 메타데이터 형식
```json
{
  "frames": {
    "frame-1.gif": {
      "frame": { "x": 0, "y": 0, "w": 52, "h": 36 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 52, "h": 36 },
      "sourceSize": { "w": 52, "h": 36 },
      "duration": 100
    },
    // ... 추가 프레임들
  },
  "meta": {
    "app": "https://www.aseprite.org/",
    "version": "1.3.7-arm64",
    "image": "your-animation.png",
    "format": "RGBA8888",
    "size": { "w": 2392, "h": 36 },
    "scale": "1",
    "frameTags": [
      { "name": "idle", "from": 0, "to": 6, "direction": "forward", "repeat": "3" },
      { "name": "attack", "from": 7, "to": 15, "direction": "forward", "repeat": "1" }
    ]
  }
}
```

### 2.3 코드 추가 방법

#### Step 1: addCharacter로 애니메이션 등록
```javascript
// bride/src/scripts/simplePixelCharacter.js

this.addCharacter('your-animation', {
    isSpreadsheetBased: true,               // 스프레드시트 방식
    spreadsheetData: null,                  // 동적으로 로드될 데이터
    scale: 2,
    x: '50%',
    y: '70%',
    visible: false,
    loop: false
});
```

#### Step 2: 스프레드시트 로딩 함수 생성
```javascript
// loadEndingAnimationData 함수를 참고하여 생성
async loadYourAnimationSpreadsheetData() {
    try {
        console.log('📊 Loading your-animation spreadsheet data from JSON...');

        // 여러 경로로 시도
        const jsonPaths = [
            'bride/public/animation/your-animation/your-animation.json',
            './bride/public/animation/your-animation/your-animation.json',
            'animation/your-animation/your-animation.json'
        ];

        let response = null;
        let loadedPath = null;

        for (const path of jsonPaths) {
            try {
                console.log(`🔍 Trying your-animation.json path: ${path}`);
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
            throw new Error('Could not load your-animation.json from any path');
        }

        const jsonData = await response.json();
        console.log(`📥 Raw your-animation JSON loaded:`, jsonData);

        // JSON 데이터를 스프레드시트 형태로 변환
        const frames = [];
        const frameKeys = Object.keys(jsonData.frames);

        for (let i = 0; i < frameKeys.length; i++) {
            const key = frameKeys[i];
            const frameInfo = jsonData.frames[key];

            frames.push({
                image: `bride/public/animation/your-animation/${jsonData.meta.image}`,
                duration: frameInfo.duration,
                spriteX: frameInfo.frame.x,
                spriteY: frameInfo.frame.y,
                spriteWidth: frameInfo.frame.w,
                spriteHeight: frameInfo.frame.h
            });
        }

        // frameTags를 이용한 애니메이션 시퀀스 생성
        const frameTags = jsonData.meta.frameTags || [];
        console.log('📋 Available your-animation frameTags:', frameTags);

        const totalFrames = frames.length;
        console.log(`📊 Total your-animation frames available: ${totalFrames} (0-${totalFrames-1})`);

        // 애니메이션 시퀀스 생성 로직
        const animationSequence = [];
        let currentFrame = 0;

        if (frameTags.length > 0) {
            for (const tag of frameTags) {
                const repeat = parseInt(tag.repeat) || 1;

                for (let r = 0; r < repeat; r++) {
                    for (let f = tag.from; f <= tag.to; f++) {
                        if (f < totalFrames) {
                            animationSequence.push({
                                frameIndex: f,
                                duration: frames[f].duration,
                                spriteX: frames[f].spriteX,
                                spriteY: frames[f].spriteY,
                                spriteWidth: frames[f].spriteWidth,
                                spriteHeight: frames[f].spriteHeight,
                                image: frames[f].image
                            });
                        }
                    }
                }
            }
        } else {
            // frameTags가 없으면 모든 프레임을 순서대로 사용
            for (let i = 0; i < frames.length; i++) {
                animationSequence.push({
                    frameIndex: i,
                    duration: frames[i].duration,
                    spriteX: frames[i].spriteX,
                    spriteY: frames[i].spriteY,
                    spriteWidth: frames[i].spriteWidth,
                    spriteHeight: frames[i].spriteHeight,
                    image: frames[i].image
                });
            }
        }

        const spreadsheetData = {
            image: frames[0]?.image || `bride/public/animation/your-animation/your-animation.png`,
            frames: animationSequence,
            totalDuration: animationSequence.reduce((sum, frame) => sum + frame.duration, 0)
        };

        console.log(`📊 Converted ${frames.length} your-animation frames from JSON to spreadsheet format`);
        console.log('🎬 Total your-animation duration:', spreadsheetData.totalDuration + 'ms');

        // loadSpreadsheetData 호출
        await this.loadSpreadsheetData('your-animation', spreadsheetData);

        console.log('✅ Your-animation data loading completed!');

    } catch (error) {
        console.error('❌ Failed to load your-animation spreadsheet data:', error);
        console.log('⚠️ Your-animation will not be available');
    }
}
```

#### Step 3: 트리거 함수에서 로딩 및 실행
```javascript
async triggerYourAnimationAnimation() {
    this.yourAnimationTriggered = true;
    this.isYourAnimationPlaying = true;

    // 스크롤 잠금
    if (window.manualScrollManager) {
        window.manualScrollManager.lockScroll('your-animation animation');
    }

    // 다른 캐릭터들 숨기기
    this.hideUnifiedCharacter();

    // your-animation 애니메이션 표시 및 실행
    const yourAnimationChar = this.characters.get('your-animation');
    if (yourAnimationChar) {
        // 스프레드시트 데이터 로딩
        if (!yourAnimationChar.spreadsheetData) {
            try {
                await this.loadYourAnimationSpreadsheetData();
            } catch (error) {
                console.error("❌ Failed to load your-animation data:", error);
                if (window.manualScrollManager) {
                    window.manualScrollManager.unlockScroll("your-animation animation failed");
                }
                return;
            }
        }

        yourAnimationChar.element.style.opacity = '1';
        yourAnimationChar.element.style.top = '50%';
        yourAnimationChar.element.style.left = '50%';
        yourAnimationChar.isActive = true;

        // 스프레드시트 애니메이션 시작
        this.startSpreadsheetAnimation(yourAnimationChar);
    }

    console.log('💥 Your-animation animation started, scroll locked');
}
```

### 2.4 실제 예시: hit-rabbit
```javascript
// Hit 토끼 애니메이션 (메인 캐릭터가 60vh 도달시 실행)
this.addCharacter('hit-rabbit', {
    isSpreadsheetBased: true,
    spreadsheetData: null, // rabbit-hit.json에서 동적으로 로드
    scale: 2,
    x: '50%',
    y: '70%',
    visible: false,
    loop: false
});

// 트리거 함수
async triggerHitRabbitAnimation() {
    // ... 스크롤 잠금 및 다른 캐릭터 숨기기

    const hitRabbitChar = this.characters.get('hit-rabbit');
    if (hitRabbitChar) {
        // 스프레드시트 데이터 로드
        if (!hitRabbitChar.spreadsheetData) {
            try {
                await this.loadHitRabbitSpreadsheetData();
            } catch (error) {
                console.error("❌ Failed to load hit-rabbit data:", error);
                return;
            }
        }
        this.startSpreadsheetAnimation(hitRabbitChar);
    }
}
```

## 3. 언제 어떤 방식을 사용할까

### 3.1 PNG 시퀀스 방식을 사용하는 경우
- ✅ **간단한 애니메이션** (10프레임 이하)
- ✅ **반복적인 idle/run 애니메이션**
- ✅ **빠른 프로토타이핑**
- ✅ **파일 관리가 간단한 경우**

**장점:**
- 구현이 간단
- 디버깅이 쉬움
- 개별 프레임 수정이 용이

**단점:**
- 많은 HTTP 요청 (프레임 수만큼)
- 파일 관리 복잡 (프레임이 많을 때)
- 로딩 시간 증가

### 3.2 스프레드시트 방식을 사용하는 경우
- ✅ **복잡한 애니메이션** (20프레임 이상)
- ✅ **일회성 시네마틱 애니메이션**
- ✅ **다양한 프레임 타이밍이 필요한 경우**
- ✅ **파일 최적화가 중요한 경우**

**장점:**
- HTTP 요청 최소화 (이미지 1개 + JSON 1개)
- 파일 관리 효율적
- 정밀한 타이밍 제어 가능
- 애니메이션 도구 (Aseprite 등) 직접 지원

**단점:**
- 초기 구현 복잡
- JSON 메타데이터 필수
- 디버깅 어려움

## 4. 트러블슈팅

### 4.1 공통 문제들

#### 애니메이션이 표시되지 않는 경우
```javascript
// 브라우저 콘솔에서 확인
const char = window.pixelCharacterManager.characters.get('your-animation');
console.log('Character state:', {
    element: char?.element,
    opacity: char?.element?.style.opacity,
    isActive: char?.isActive,
    visible: char?.visible
});
```

#### 파일 로딩 실패
- Network 탭에서 404 에러 확인
- 파일 경로 및 대소문자 확인
- 파일 권한 확인

### 4.2 PNG 시퀀스 특정 문제들

#### 프레임 번호 불일치
```javascript
// frameCount와 실제 파일 수 확인
frameCount: 7, // your-animation1.png ~ your-animation7.png
```

#### 파일명 패딩 문제
```javascript
// 파일명이 your-animation01.png 형태인 경우
framePadding: 2  // 01, 02, 03...
```

### 4.3 스프레드시트 특정 문제들

#### JSON 파일 형식 오류
- JSON 문법 검증 (JSONLint 등 사용)
- frames 객체와 meta 객체 확인

#### 스프라이트 시트 좌표 오류
```javascript
// frame 정보 확인
"frame": { "x": 0, "y": 0, "w": 52, "h": 36 }
```

#### 함수명 오류
- `loadYourAnimationSpreadsheetData` 함수명 일치 확인
- `async/await` 키워드 확인

#### 스프레드시트 애니메이션 완료 처리 누락 ⚠️
**문제:** 스프레드시트 애니메이션이 완료되어도 다음 애니메이션으로 전환되지 않는 경우

**원인:** `startSpreadsheetAnimation` 함수의 완료 콜백에서 해당 애니메이션 ID가 처리되지 않음

**해결방법:**
```javascript
// simplePixelCharacter.js의 startSpreadsheetAnimation 함수 내부
// 애니메이션 완료 콜백 호출 부분에 추가

// 애니메이션 완료 콜백 호출
if (character.id === 'main' && this.mainAnimationCallback) {
    this.mainAnimationCallback();
    this.mainAnimationCallback = null;
} else if (character.id === 'ending') {
    this.onEndingAnimationComplete();
} else if (character.id === 'hit-rabbit') {
    this.onHitRabbitAnimationComplete();  // ← 이 부분 추가
} else if (character.id === 'your-animation') {
    this.onYourAnimationComplete();       // ← 새 애니메이션용 콜백 추가
}
```

**주의사항:**
- 모든 스프레드시트 애니메이션은 완료 콜백이 필요
- 콜백 함수명은 `on[AnimationName]AnimationComplete` 형식 사용
- 함수 내에서 다음 애니메이션 전환이나 스크롤 잠금 해제 처리

#### 경로 문제 - 개발 서버와 실제 파일 경로 불일치 ⚠️
**문제:** 네트워크 탭에서 이미지 로딩 실패 (404 에러)

**원인:** bride 폴더 내의 이미지가 루트 public 폴더에서 접근되지 않음

**해결방법:**
1. 이미지를 루트 public 폴더로 복사
```bash
mkdir -p /path/to/wedding/public/animation/your-animation
cp /path/to/wedding/bride/public/animation/your-animation/* /path/to/wedding/public/animation/your-animation/
```

2. framePrefix 경로 수정
```javascript
// 변경 전
framePrefix: 'bride/public/animation/your-animation/your-animation'

// 변경 후
framePrefix: 'animation/your-animation/your-animation'
```

**예시:** rabbit-hurt 애니메이션 경로 수정
```javascript
// 이미지 복사 후 경로 변경
this.addCharacter('rabbit-hurt', {
    isPngSequence: true,
    framePrefix: 'animation/rabbit-hurt/rabbit-hurt', // bride/public/ 제거
    frameCount: 5,
    frameRate: 12,
    scale: 4,
    x: '50%',
    y: '70%',
    visible: false,
    loop: false
});
```

#### 애니메이션 위치 문제 - 캐릭터가 화면에 보이지 않는 경우 ⚠️
**문제:** 애니메이션이 로드되지만 화면에 표시되지 않거나 잘못된 위치에 나타나는 경우

**원인:** 함수에서 스타일을 직접 수정할 때 `addCharacter`의 초기 위치 설정이 무시되는 경우

**해결방법:** 위치 관련 스타일을 완전히 복원하기

```javascript
// 잘못된 방법 - 일부 스타일만 설정
function showCharacter() {
    character.element.style.opacity = '1';
    character.element.style.display = 'block';
    // left, top, transform 등이 누락될 수 있음
}

// 올바른 방법 - addCharacter 초기 설정 완전 복원
function showCharacter() {
    character.element.style.opacity = '1';
    character.element.style.display = 'block';
    character.element.style.visibility = 'visible';

    // addCharacter에서 설정한 초기 위치로 완전 복원
    character.element.style.left = character.x;
    character.element.style.top = character.y;
    character.element.style.position = 'absolute';
    character.element.style.transform = `translate(-50%, -50%) scale(${character.scale})`;

    character.visible = true;
    character.currentFrame = 0;
}
```

**실제 예시:** rabbit-hurt 위치 복원
```javascript
switchRabbitToHurt() {
    const rabbitHurtChar = this.characters.get('rabbit-hurt');
    if (rabbitHurtChar) {
        // 이전 애니메이션 정지
        this.stopAnimation(rabbitHurtChar);

        // 기본 표시 설정
        rabbitHurtChar.element.style.opacity = '1';
        rabbitHurtChar.element.style.display = 'block';
        rabbitHurtChar.element.style.visibility = 'visible';

        // ✅ addCharacter 초기 설정 완전 복원
        rabbitHurtChar.element.style.left = rabbitHurtChar.x;        // '50%'
        rabbitHurtChar.element.style.top = rabbitHurtChar.y;         // '70%'
        rabbitHurtChar.element.style.position = 'absolute';
        rabbitHurtChar.element.style.transform = `translate(-50%, -50%) scale(${rabbitHurtChar.scale})`;

        rabbitHurtChar.visible = true;
        rabbitHurtChar.currentFrame = 0;

        // 애니메이션 시작
        this.startAnimation(rabbitHurtChar);
    }
}
```

**주의사항:**
- `addCharacter`에서 설정한 x, y 값을 `character.x`, `character.y`로 접근
- `position: 'absolute'`와 `transform`을 반드시 함께 설정
- 다른 함수에서 위치를 수정했다면 반드시 초기 위치로 복원 필요

### 4.4 디버깅 팁

#### 로딩 상태 확인
```javascript
// 개발자 도구에서 확인
console.log('Animation states:', window.pixelCharacterManager.characters);
```

#### 애니메이션 강제 실행
```javascript
// 테스트용 강제 실행
const char = window.pixelCharacterManager.characters.get('your-animation');
if (char) {
    char.element.style.opacity = '1';
    char.isActive = true;
    window.pixelCharacterManager.startAnimation(char); // PNG 시퀀스
    // 또는
    window.pixelCharacterManager.startSpreadsheetAnimation(char); // 스프레드시트
}
```

## 5. Run-Idle 조합 애니메이션 (스크롤 반응형)

스크롤 상태에 따라 자동으로 run/idle 상태가 전환되는 애니메이션 세트를 구현하는 방법입니다.

### 5.1 개념
- **Idle 애니메이션**: 스크롤이 멈췄을 때 재생되는 기본 상태
- **Run 애니메이션**: 스크롤 중일 때 재생되는 움직임 상태
- **자동 전환**: 스크롤 이벤트에 따라 시스템이 자동으로 애니메이션 변경

### 5.2 파일 구조
```
bride/public/animation/
├── your-character-idle/
│   ├── your-character-idle1.png
│   ├── your-character-idle2.png
│   └── ...
└── your-character-run/
    ├── your-character-run1.png
    ├── your-character-run2.png
    └── ...
```

### 5.3 코드 구현

#### Step 1: 두 애니메이션 모두 addCharacter로 등록
```javascript
// Idle 애니메이션 (스크롤 정지 시)
this.addCharacter('your-character-idle', {
    isPngSequence: true,
    framePrefix: 'animation/your-character-idle/your-character-idle',
    frameCount: 2,
    frameRate: 8,
    scale: 4,
    x: '50%',
    y: '50%',
    visible: false,
    loop: true
});

// Run 애니메이션 (스크롤 중)
this.addCharacter('your-character-run', {
    isPngSequence: true,
    framePrefix: 'animation/your-character-run/your-character-run',
    frameCount: 7,
    frameRate: 12,
    scale: 4,
    x: '50%',
    y: '50%',
    visible: false,
    loop: true
});
```

#### Step 2: animationStates에 등록 (통합 캐릭터 시스템)
```javascript
this.animationStates = {
    'your-character-idle': {
        framePrefix: 'animation/your-character-idle/your-character-idle',
        frameCount: 2,
        frameRate: 8,
        loop: true
    },
    'your-character-run': {
        framePrefix: 'animation/your-character-run/your-character-run',
        frameCount: 7,
        frameRate: 12,
        loop: true
    }
};
```

#### Step 3: 플래그 기반 자동 전환 활성화
```javascript
// 특정 이벤트 후 꽃 애니메이션 세트로 자동 전환
switchToYourCharacterMode() {
    console.log('🌸 Activating your-character animation set');

    // 플래그 설정 (LeafsFlowerDouble 시스템 활용)
    this.hasLeafsFlowerDouble = true;
    console.log('🌸✨ LeafsFlowerDouble flag activated for your-character mode!');

    // 현재 상태 다시 적용하여 새 애니메이션으로 자동 전환
    if (this.currentState === 'ha-idle' || this.currentState === 'ha-run') {
        const currentState = this.currentState;
        console.log(`🔄 Re-applying state: ${currentState} -> ${currentState}-flowers`);
        this.switchToState(currentState);
    } else {
        // 기본적으로 idle 상태로 시작
        this.switchToState('ha-idle');
    }

    console.log('🌸 Your-character mode activated - now auto-switching based on scroll');
}
```

### 5.4 switchToState 로직 이해

기존 `switchToState` 함수는 다음과 같이 동작합니다:

```javascript
// 실제 사용할 애니메이션 계산
let actualAnimation = newState;

// hasLeafsFlowerDouble 플래그가 true인 경우 꽃 애니메이션으로 자동 변경
if (this.hasLeafsFlowerDouble && newState === 'ha-idle') {
    actualAnimation = 'ha-idle-flowers';
} else if (this.hasLeafsFlowerDouble && newState === 'ha-run') {
    actualAnimation = 'ha-run-flowers';
}

// 계산된 애니메이션으로 전환
this.switchUnifiedAnimation(actualAnimation);
```

### 5.5 실제 예시: ha-flowers 세트

#### 애니메이션 등록
```javascript
// Ha idle-flower 애니메이션
this.addCharacter('ha-idle-flowers', {
    isPngSequence: true,
    framePrefix: 'animation/ha-idle-flowers/ha-idle-flowers',
    frameCount: 2,
    frameRate: 8,
    scale: 4,
    x: '50%',
    y: '50%',
    visible: false,
    loop: true
});

// Ha run-flower 애니메이션
this.addCharacter('ha-run-flowers', {
    isPngSequence: true,
    framePrefix: 'animation/ha-run-flowers/ha-run-flowers',
    frameCount: 7,
    frameRate: 12,
    scale: 4,
    x: '50%',
    y: '50%',
    visible: false,
    loop: true
});
```

#### 플래그 활성화
```javascript
// hit-rabbit 완료 후 꽃 애니메이션 세트로 전환
switchToFlowersMode() {
    // hasLeafsFlowerDouble 플래그 설정
    this.hasLeafsFlowerDouble = true;

    // 현재 상태 다시 적용하여 자동 전환
    if (this.currentState === 'ha-idle' || this.currentState === 'ha-run') {
        const currentState = this.currentState;
        this.switchToState(currentState); // 자동으로 -flowers 버전으로 전환됨
    } else {
        this.switchToState('ha-idle'); // ha-idle-flowers로 전환됨
    }
}
```

### 5.6 장점
- ✅ **자동 전환**: 스크롤 이벤트에 따라 시스템이 자동으로 처리
- ✅ **일관성**: 기존 ha-idle/ha-run과 동일한 로직 사용
- ✅ **확장성**: 새로운 애니메이션 세트 추가 용이
- ✅ **유지보수**: 중앙 집중식 상태 관리

### 5.7 주의사항
- `hasLeafsFlowerDouble` 플래그는 전역 상태이므로 신중하게 관리
- 새로운 애니메이션 세트를 추가할 때는 `switchToState` 로직 확인 필요
- 파일 경로는 루트 `public/animation/`에서 접근 가능해야 함

## 6. Hit 애니메이션 + 개별 캐릭터 + Run-Idle 조합 패턴

**고급 패턴:** Hit 애니메이션 완료 후 개별 캐릭터와 스크롤 반응형 Run-Idle 조합 애니메이션을 동시에 실행하는 복합 애니메이션 시스템입니다.

### 6.1 패턴 개요

이 패턴은 다음 3가지 애니메이션을 조합합니다:
1. **Hit 애니메이션**: 일회성 스프레드시트 애니메이션 (예: hit-rabbit 46프레임)
2. **개별 캐릭터**: Hit 완료 후 독립적으로 루프하는 애니메이션 (예: rabbit-hurt 5프레임)
3. **Run-Idle 세트**: 스크롤에 반응하는 조합 애니메이션 (예: ha-idle-flowers ⟷ ha-run-flowers)

### 6.2 실행 순서
```
[사용자 트리거]
    ↓
[hit-rabbit 애니메이션 실행] (46프레임, 일회성, 스프레드시트)
    ↓
[onHitRabbitAnimationComplete() 콜백]
    ↓
[rabbit-hurt 시작] (5프레임, 무한루프, PNG시퀀스) + [ha-flowers 모드 활성화]
    ↓
[스크롤 반응] → ha-idle-flowers ⟷ ha-run-flowers 자동 전환
```

### 6.3 구현 코드

#### Step 1: Hit 애니메이션 완료 콜백 구현
```javascript
onHitRabbitAnimationComplete() {
    console.log('💥 Hit-rabbit animation completed, starting combined animations');
    this.isHitRabbitPlaying = false;

    // 1. Hit 애니메이션 숨기기
    const hitRabbitChar = this.characters.get('hit-rabbit');
    if (hitRabbitChar) {
        hitRabbitChar.element.style.opacity = '0';
        hitRabbitChar.isActive = false;
        this.stopAnimation(hitRabbitChar);
    }

    // 2. 개별 캐릭터 시작 (rabbit-hurt)
    this.switchRabbitToHurt();

    // 3. 통합 시스템 설정 (groom 버전 패턴)
    this.isHitIdlePlaying = true;
    this.characterY = 65; // 위치 조정

    // 4. 기존 개별 캐릭터들 숨기기 (rabbit 제외)
    this.characters.forEach((char, id) => {
        if (id.startsWith('rabbit-')) return; // 토끼는 별도 관리
        this.stopAnimation(char);
        char.element.style.opacity = '0';
    });

    // 5. 통합 캐릭터 복원
    this.showUnifiedCharacter();

    // 6. 플래그 설정 및 직접 애니메이션 호출 (핵심!)
    this.hasLeafsFlowerDouble = true;
    const initialFlowerAnimation = this.isScrolling ? 'ha-run-flowers' : 'ha-idle-flowers';
    this.switchUnifiedAnimation(initialFlowerAnimation);
    this.updateUnifiedCharacterPosition();

    // 7. 스크롤 잠금 해제
    if (window.manualScrollManager) {
        window.manualScrollManager.unlockScroll('hit-rabbit animation complete');
    }
}
```

#### Step 2: 개별 캐릭터 전환 함수
```javascript
switchRabbitToHurt() {
    console.log('🔧 switchRabbitToHurt called');

    // 기존 rabbit-idle 숨기기
    const rabbitIdleChar = this.characters.get('rabbit-idle');
    if (rabbitIdleChar) {
        rabbitIdleChar.element.style.opacity = '0';
        rabbitIdleChar.isActive = false;
        this.stopAnimation(rabbitIdleChar);
        console.log('🚫 rabbit-idle hidden');
    }

    // rabbit-hurt 애니메이션 표시 (반복 실행)
    const rabbitHurtChar = this.characters.get('rabbit-hurt');
    if (rabbitHurtChar) {
        // 이전 애니메이션 정지
        this.stopAnimation(rabbitHurtChar);

        // 표시 및 활성화
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

        console.log('🤕 Starting rabbit-hurt animation (loop)');
        this.startAnimation(rabbitHurtChar);
    } else {
        console.error('❌ rabbit-hurt character not found!');
    }
}
```

#### Step 3: Run-Idle 조합 모드 활성화
```javascript
switchToFlowersMode() {
    console.log('🌸 switchToFlowersMode called - activating LeafsFlowerDouble flag');

    // 플래그 설정으로 ha-flowers 세트 활성화
    this.hasLeafsFlowerDouble = true;
    console.log('🌸✨ LeafsFlowerDouble flag activated for flowers mode!');

    // 기존 ha 캐릭터들 모두 숨기기
    const basicHaChars = ['ha-idle', 'ha-run', 'ha-idle-wow'];
    basicHaChars.forEach(charId => {
        const char = this.characters.get(charId);
        if (char) {
            char.element.style.opacity = '0';
            char.isActive = false;
            this.stopAnimation(char);
            console.log(`🚫 Hidden basic ha character: ${charId}`);
        }
    });

    // 현재 상태 다시 적용하여 꽃 애니메이션으로 자동 전환
    if (this.currentState === 'ha-idle' || this.currentState === 'ha-run') {
        const currentState = this.currentState;
        console.log(`🔄 Re-applying current state: ${currentState} -> will switch to ${currentState}-flowers`);
        this.switchToState(currentState);
    } else {
        // 현재 상태가 다른 경우 강제로 idle-flowers로 설정
        console.log('🔄 Current state unknown, forcing to ha-idle-flowers');
        this.switchToState('ha-idle');
    }

    // 직접 ha-flowers 캐릭터 표시 (통합 시스템이 실패할 경우 대비)
    setTimeout(() => {
        const currentFlowerChar = this.currentState === 'ha-run' ?
            this.characters.get('ha-run-flowers') :
            this.characters.get('ha-idle-flowers');

        if (currentFlowerChar && currentFlowerChar.element.style.opacity === '0') {
            console.log(`🌸 Directly showing flower character: ${currentFlowerChar.id}`);
            currentFlowerChar.element.style.opacity = '1';
            currentFlowerChar.element.style.display = 'block';
            currentFlowerChar.element.style.visibility = 'visible';
            currentFlowerChar.visible = true;
            currentFlowerChar.isActive = true;
            this.startAnimation(currentFlowerChar);
        }
    }, 100);

    console.log('🌸 Flowers mode activation completed - now auto-switching based on scroll');
}
```

### 6.4 캐릭터 등록 코드

#### Hit 애니메이션 (스프레드시트 방식)
```javascript
this.addCharacter('hit-rabbit', {
    isPngSequence: false, // 스프레드시트 방식
    framePrefix: 'animation/rabbit-hit/rabbit-hit',
    x: '50%',
    y: '50%',
    scale: 2,
    visible: false
});
```

#### 개별 루프 캐릭터 (PNG 시퀀스)
```javascript
this.addCharacter('rabbit-hurt', {
    isPngSequence: true,
    framePrefix: 'animation/rabbit-hurt/rabbit-hurt',
    frameCount: 5,
    frameRate: 12,
    scale: 2,
    x: '56%',
    y: '60%',
    loop: true,
    visible: false
});
```

#### Run-Idle 조합 애니메이션들 (PNG 시퀀스 + 통합 시스템)
```javascript
// 통합 시스템을 위한 animationStates 등록
this.animationStates = {
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
    }
};

// 개별 캐릭터로도 등록 (직접 제어용)
this.addCharacter('ha-idle-flowers', {
    isPngSequence: true,
    framePrefix: 'animation/ha-idle-flowers/ha-idle-flowers',
    frameCount: 14,
    frameRate: 12,
    scale: 2,
    x: '50%',
    y: '50%',
    loop: true,
    visible: false
});

this.addCharacter('ha-run-flowers', {
    isPngSequence: true,
    framePrefix: 'animation/ha-run-flowers/ha-run-flowers',
    frameCount: 8,
    frameRate: 18,
    scale: 2,
    x: '50%',
    y: '50%',
    loop: true,
    visible: false
});
```

### 6.5 switchToState 로직 확인

기존 `switchToState` 함수가 `hasLeafsFlowerDouble` 플래그를 지원하는지 확인하세요:

```javascript
switchToState(newState) {
    let actualAnimation = newState;

    // hasLeafsFlowerDouble 플래그가 활성화되어 있으면 -flowers 버전으로 전환
    if (this.hasLeafsFlowerDouble && newState === 'ha-idle') {
        actualAnimation = 'ha-idle-flowers';
        console.log('🌸✨ Using leafsflowerdouble idle: ha-idle-flowers');
    } else if (this.hasLeafsFlowerDouble && newState === 'ha-run') {
        actualAnimation = 'ha-run-flowers';
        console.log('🌸✨ Using leafsflowerdouble run: ha-run-flowers');
    }

    // 통합 캐릭터로 애니메이션 실행
    this.switchUnifiedAnimation(actualAnimation);
}
```

### 6.6 디버깅 팁

#### 애니메이션 상태 확인
```javascript
// 브라우저 콘솔에서 상태 확인
console.log('Current animation states:', {
    isHitRabbitPlaying: window.pixelCharacterManager.isHitRabbitPlaying,
    hasLeafsFlowerDouble: window.pixelCharacterManager.hasLeafsFlowerDouble,
    currentState: window.pixelCharacterManager.currentState,
    characterY: window.pixelCharacterManager.characterY
});

// 개별 캐릭터 상태 확인
const rabbitHurt = window.pixelCharacterManager.characters.get('rabbit-hurt');
const haFlowers = window.pixelCharacterManager.characters.get('ha-idle-flowers');
console.log('Character states:', {
    rabbitHurt: {
        opacity: rabbitHurt?.element?.style.opacity,
        isActive: rabbitHurt?.isActive,
        visible: rabbitHurt?.visible
    },
    haFlowers: {
        opacity: haFlowers?.element?.style.opacity,
        isActive: haFlowers?.isActive,
        visible: haFlowers?.visible
    }
});
```

### 6.7 주의사항 및 흔한 실수들

#### ✅ **올바른 접근 (groom 패턴)**

1. **간단하고 직접적인 구조**:
```javascript
onHitRabbitAnimationComplete() {
    // 1. 기본 설정
    this.characterY = 65;
    this.hasLeafsFlowerDouble = true;

    // 2. 통합 캐릭터 복원
    this.showUnifiedCharacter();

    // 3. 직접 애니메이션 호출 (핵심!)
    const animation = this.isScrolling ? 'ha-run-flowers' : 'ha-idle-flowers';
    this.switchUnifiedAnimation(animation);

    // 4. 위치 적용
    this.updateUnifiedCharacterPosition();
}
```

#### ❌ **잘못된 접근들 (하지 말 것)**

**1. 과도한 우회 경로**
```javascript
// ❌ 잘못된 방법: 너무 복잡한 우회
switchToFlowersMode() → switchToState() → switchUnifiedAnimation()

// ✅ 올바른 방법: 직접 호출
switchUnifiedAnimation('ha-idle-flowers')
```

**2. 하드코딩과 강제 처리**
```javascript
// ❌ 잘못된 방법: setTimeout으로 강제 숨기기
setTimeout(() => {
    char.element.style.display = 'none';
    char.element.style.visibility = 'hidden';
}, 50);

// ✅ 올바른 방법: 시스템이 자연스럽게 처리하도록 플래그만 설정
this.hasLeafsFlowerDouble = true;
```

**3. 중복된 위치 업데이트**
```javascript
// ❌ 잘못된 방법: 여러 번 반복 호출
this.updateUnifiedCharacterPosition(); // 1번째
// ... 다른 함수들 ...
this.updateUnifiedCharacterPosition(); // 2번째
// ... 또 다른 함수들 ...
this.updateUnifiedCharacterPosition(); // 3번째

// ✅ 올바른 방법: 마지막에 한 번만
this.switchUnifiedAnimation(animation);
this.updateUnifiedCharacterPosition(); // 한 번만
```

**4. 개별 캐릭터와 통합 시스템 혼재**
```javascript
// ❌ 잘못된 방법: 두 시스템 동시 사용
this.switchToState('ha-idle'); // 통합 시스템
setTimeout(() => {
    this.startAnimation(individualChar); // 개별 시스템
}, 100);

// ✅ 올바른 방법: 통합 시스템만 사용
this.switchUnifiedAnimation('ha-idle-flowers');
```

#### 📋 **핵심 원칙**

1. **KISS 원칙**: Keep It Simple, Stupid - 복잡한 우회보다 직접적인 호출
2. **groom 패턴 준수**: 동작하는 groom 버전과 동일한 구조 사용
3. **시스템 분리**: 개별 캐릭터 vs 통합 시스템 중 하나만 선택
4. **플래그 기반**: 하드코딩보다는 상태 플래그로 시스템이 자연스럽게 처리
5. **단일 진입점**: 여러 경로보다는 하나의 명확한 경로

#### 🐛 **디버깅 체크리스트**

문제가 발생했을 때 확인할 사항들:

1. **위치가 50%로 고정되는 경우**:
   - 개별 캐릭터 요소가 표시되고 있지 않은가?
   - `updateUnifiedCharacterPosition()` 호출 타이밍이 올바른가?
   - 다른 함수에서 위치를 덮어쓰고 있지 않은가?

2. **애니메이션이 두 개 동시 실행되는 경우**:
   - 개별 캐릭터와 통합 캐릭터가 동시에 active인가?
   - `switchToFlowersMode()`에서 개별 캐릭터를 제대로 숨겼는가?

3. **스크롤 반응이 안 되는 경우**:
   - `hasLeafsFlowerDouble` 플래그가 제대로 설정되었는가?
   - `switchToState()` 로직이 플래그를 인식하고 있는가?

#### 💡 **성공 요인**

이 패턴이 성공하는 이유:
- **검증된 구조**: groom 버전에서 이미 동작하는 패턴
- **단순성**: 최소한의 단계로 최대 효과
- **예측 가능성**: 각 단계가 명확하고 디버깅이 쉬움
- **확장성**: 새로운 애니메이션 추가 시에도 동일한 패턴 적용 가능

### 6.8 활용 사례

- **게임 UI**: 피격 이펙트 후 캐릭터 상태변화 + 배경 애니메이션
- **인터랙티브 스토리**: 이벤트 완료 후 복합 애니메이션 실행
- **프레젠테이션**: 단계별 애니메이션 전환 시스템

## 7. 베스트 프랙티스

### 7.1 파일 조직
```
bride/public/animation/
├── characters/          # 캐릭터 애니메이션 (PNG 시퀀스)
│   ├── rabbit/
│   ├── ha-idle/
│   └── ha-run/
├── effects/            # 이펙트 애니메이션 (스프레드시트)
│   ├── hit-rabbit/
│   ├── section1/
│   └── ending/
└── ui/                # UI 애니메이션
    └── leafs/
```

### 5.2 네이밍 컨벤션
- **PNG 시퀀스**: `animation-name/animation-name1.png`
- **스프레드시트**: `animation-name/animation-name.png + animation-name.json`
- **함수명**: `loadAnimationNameSpreadsheetData()`
- **트리거 함수**: `triggerAnimationNameAnimation()`

### 5.3 성능 고려사항
- PNG 시퀀스는 10프레임 이하로 제한
- 스프레드시트는 이미지 크기 최적화 (2MB 이하 권장)
- 불필요한 애니메이션 미리로딩 방지

---

이 가이드를 따라 두 가지 방식의 애니메이션을 모두 구현할 수 있습니다. 각 방식의 장단점을 고려하여 프로젝트 요구사항에 맞는 방식을 선택하세요.