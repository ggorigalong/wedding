# 🎭 신부/신랑 버전 다중 경로 시스템 구축 계획

## 📋 전체 작업 개요
현재 단일 페이지를 신부편/신랑편으로 분리하고, 루트 접속 시 랜덤 리다이렉트 구현

---

## 🗂️ 최종 디렉토리 구조 (완전 독립 복사 방식)
```
/wedding/
├── index.html                 # 랜덤 리다이렉트 페이지 (신규)
├── groom/                     # 신랑편 (현재 버전 이동)
│   ├── index.html
│   ├── src/ (전체 이동)
│   │   ├── styles/main.css
│   │   └── scripts/*.js
│   └── public/ (전체 이동)
│       ├── images/gallery/
│       ├── sounds/
│       └── font/
└── bride/                     # 신부편 (완전 독립 복사)
    ├── index.html (복사)
    ├── src/ (완전 복사)
    │   ├── styles/main.css (기존 색상 팔레트 유지)
    │   └── scripts/*.js (독립 복사)
    └── public/ (완전 복사 + 이미지만 교체)
        ├── images/gallery/
        ├── sounds/
        └── font/
```

---

## 🔄 1단계: 랜덤 리다이렉트 페이지 생성

### 📄 `/index.html` (신규 생성)
```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>이태인 ♥ 하송이 - 결혼합니다</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #f9fbec;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: 'Pretendard', sans-serif;
        }
        .loading {
            text-align: center;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="loading">
        <p>✨ 웨딩 페이지를 불러오는 중...</p>
    </div>
    <script>
        // 완전 랜덤 리다이렉트 (50/50 확률)
        const isGroom = Math.random() < 0.5;
        const redirectUrl = isGroom ? './groom/' : './bride/';

        // 0.5초 후 리다이렉트 (로딩 효과)
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 500);
    </script>
</body>
</html>
```

---

## 📁 2단계: 기존 파일들 `/groom/` 디렉토리로 이동

### 이동할 파일들
- [ ] `index.html` → `groom/index.html`
- [ ] `src/` → `groom/src/` (전체)
- [ ] `public/` → `groom/public/` (전체)
- [ ] ❌ `dist/` (제외 - 빌드 시 자동 생성)

### 경로 수정 필요한 파일들
- [ ] `groom/index.html` - 상대경로 수정 (src/, public/ 경로)
- [ ] `groom/src/styles/main.css` - 폰트 경로 수정
- [ ] `groom/src/scripts/*.js` - 이미지/사운드 경로 확인

---

## 🎨 3단계: 신부편 버전 생성

### 완전 독립 복사 (Zero 사이드이펙트)
- [ ] `groom/` 전체 → `bride/` 완전 복사
- [ ] `bride/index.html` - 타이틀/메타 태그 수정
- [ ] `bride/public/images/` - 신부 전용 이미지로 교체
- [ ] ✅ JavaScript/CSS - 복사본 그대로 유지 (안전성 우선)

### 신부편 전용 이미지 교체 필요
- 🖼️ `bride/public/images/gallery/hero-main.png` (신부 메인 이미지)
- 🖼️ `bride/public/images/gallery/hero-text.png` (신부 텍스트 오버레이)
- 🖼️ `bride/public/images/gallery/hero-animation.png` (신부 배경)
- 🖼️ `bride/public/images/gallery/hero-animation-text.png` (신부 애니메이션 텍스트)

### 기존 색상 팔레트 유지 (수정 없음)
```css
/* 기존 색상 변수 그대로 사용 */
:root {
    --primary-orange: #FF6B35;
    --secondary-green: #4CAF50;
    --text-dark: #333;
    --text-light: #666;
    --bg-light: #f8f8f8;
}
```

---

## 🔧 4단계: 메타 정보 수정 (신부편)

### HTML 메타 태그 수정
- [ ] `bride/index.html` - 페이지 타이틀 변경
- [ ] Open Graph 메타 정보 수정
- [ ] 파비콘 및 기타 메타 태그 확인

### 수정할 메타 정보 예시
```html
<!-- 신부편 메타 정보 -->
<title>하송이 ♥ 이태인 - 결혼합니다</title>
<meta property="og:title" content="하송이 ♥ 이태인 - 결혼합니다">
<meta property="og:description" content="2026년 9월 12일 오전 11:00, 신부 하송이의 결혼식에 초대합니다">
```

### ❌ 제거된 사항들 (안전성 우선)
- 심볼릭 링크 사용하지 않음 (배포/빌드 시 문제 방지)
- 공통 리소스 분리 안함 (사이드이펙트 방지)
- 각 버전 완전 독립 운영

---

## 🧪 5단계: 테스트 계획 (사용자 직접 진행)

### URL 접속 테스트
- [ ] `yoursite.com/` → 랜덤 리다이렉트 확인
- [ ] `yoursite.com/groom/` → 신랑편 정상 로딩
- [ ] `yoursite.com/bride/` → 신부편 정상 로딩

### 기능 테스트 (사용자가 직접 진행)
- [ ] 음악 재생
- [ ] 갤러리 팝업
- [ ] 계좌번호 복사
- [ ] 지도 버튼 (주석 처리 확인)
- [ ] 픽셀 캐릭터 애니메이션

### 반응형 테스트
- [ ] 모바일 레이아웃
- [ ] 폰트 일관성
- [ ] 이미지 로딩

---

## 📝 추가 고려사항

### SEO 및 메타 정보
- 각 버전별 다른 `og:title`, `og:description` 설정
- 신부편: "신부 하송이의 결혼식 초대장"
- 신랑편: "신랑 이태인의 결혼식 초대장"

### 성능 최적화
- 이미지 파일 중복 제거
- 공통 스크립트 CDN 활용
- 폰트 preload 최적화

### 접근성
- 색상 대비 확인 (신부편 핑크 테마)
- 키보드 네비게이션
- 스크린 리더 호환성

---

## 🚀 구현 순서

1. **랜덤 리다이렉트 페이지 생성**
2. **기존 파일을 `/groom/`으로 이동**
3. **경로 수정 및 테스트**
4. **`/bride/` 버전 복사 생성**
5. **신부편 이미지 교체**
6. **신부편 CSS 색상 테마 적용**
7. **전체 기능 테스트**

---

## 📋 작업 진행 상황

### 완료된 작업
- [ ] 1단계: 랜덤 리다이렉트 페이지 생성
- [ ] 2단계: 기존 파일을 `/groom/`으로 이동
- [ ] 3단계: `/bride/` 버전 복사 생성
- [ ] 4단계: 신부편 이미지 교체
- [ ] 5단계: 신부편 CSS 색상 테마 적용
- [ ] 6단계: 전체 기능 테스트

### 이슈 및 해결방안
- 이슈: (작업 중 발견된 문제점 기록)
- 해결: (해결 방법 기록)

---

## 🔗 유용한 링크
- [프로젝트 GitHub](링크)
- [배포 URL](링크)
- [신랑편 URL](yoursite.com/groom/)
- [신부편 URL](yoursite.com/bride/)

---

*최종 업데이트: 2024-05-26*
*작성자: Claude Code Assistant*