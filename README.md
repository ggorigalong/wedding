# 📱 모바일 청첩장

미니멀 디자인의 모바일 최적화 청첩장 웹사이트입니다.

## 🚀 사용법

1. **이미지 파일 준비**
   ```
   main-photo.jpg     - 메인 히어로 사진
   photo1.jpg ~ photo5.jpg - 갤러리 사진 (5장)
   wedding-song.mp3   - 배경음악 파일
   ```

2. **내용 수정**
   - `index.html`에서 개인정보 수정:
     - 신랑신부 이름
     - 양가 부모님 성함
     - 결혼식 날짜, 시간
     - 예식장 정보
     - 계좌번호

3. **브라우저에서 열기**
   ```bash
   # 현재 폴더에서 간단한 서버 실행
   python -m http.server 8000
   # 또는
   npx serve .
   ```

## 🎨 주요 기능

- ✅ **미니멀 디자인** - 오렌지 & 그린 컬러
- ✅ **반응형 웹** - 모바일 최적화
- ✅ **터치 갤러리** - 스와이프 지원
- ✅ **배경음악** - 자동재생 (사용자 클릭 후)
- ✅ **계좌번호 복사** - 원터치 복사
- ✅ **지도 연동** - 카카오맵/구글맵
- ✅ **부드러운 애니메이션**

## 📁 파일 구조

```
wedding/
├── index.html          # 메인 HTML
├── styles.css          # CSS 스타일시트
├── script.js           # JavaScript 기능
├── main-photo.jpg      # 메인 사진
├── photo1.jpg~5.jpg    # 갤러리 사진
├── wedding-song.mp3    # 배경음악
└── README.md           # 이 파일
```

## ⚙️ 커스터마이징

### 색상 변경 (styles.css)
```css
:root {
    --primary-orange: #FF6B35;
    --secondary-green: #4CAF50;
}
```

### 갤러리 사진 개수 변경
1. HTML에서 `.gallery-slide` 개수 조정
2. 해당 이미지 파일들 추가

### 지도 주소 변경 (script.js)
```javascript
function openKakaoMap() {
    const address = "실제 예식장 주소";
    // ...
}
```

## 📱 테스트

모바일에서 테스트하려면:
1. 같은 WiFi에 연결된 상태에서
2. 컴퓨터 IP:8000으로 접속

## 🌐 배포

- **GitHub Pages**: repository를 public으로 설정 후 Pages 활성화
- **Netlify**: 폴더 드래그앤드롭으로 즉시 배포
- **Vercel**: GitHub 연동으로 자동 배포

---

💡 **팁**: 실제 이미지와 내용을 넣고 모바일에서 테스트해보세요!