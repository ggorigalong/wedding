/**
 * 🎬 SubtitleManager - 자막 시스템
 *
 * Spreadsheet 기반 애니메이션과 PNG 시퀀스 애니메이션에
 * 동기화된 자막을 표시하는 시스템
 */

class SubtitleManager {
    constructor() {
        this.subtitles = {}; // 자막 데이터 저장소
        this.currentSubtitle = null; // 현재 표시 중인 자막
        this.isVisible = false; // 자막 표시 상태
        this.lastCheckedState = null; // 마지막 체크된 상태 (프레임 포함)
        this.lastCheckedStateKey = null; // 마지막 체크된 상태 키 (프레임 제외)

        // DOM 요소들
        this.container = null;
        this.box = null;
        this.dialogText = null;

        this.init();
    }

    /**
     * 초기화
     */
    init() {

        // DOM 요소 찾기
        this.container = document.getElementById('subtitleContainer');
        this.box = document.getElementById('subtitleBox');
        this.dialogText = document.getElementById('dialogText');

        if (!this.container || !this.box || !this.dialogText) {
            return;
        }


        // 자막 데이터 로드
        this.loadSubtitleData();
    }

    /**
     * 자막 데이터 로드 (embedded 방식)
     */
    loadSubtitleData() {
        // 신랑편 자막 데이터 (애니메이션 태그 기반)
        this.subtitles = {
            'section1': {
                'section': {
                    'Question': {
                        text: '엥',
                        style: 'normal'
                    },
                    'Left': {
                        text: '부케가 어디갔지?',
                        style: 'normal'
                    },
                    'Empty': {
                        text: '부케가 어디갔지?',
                        style: 'normal'
                    },
                    'Empty2': {
                        text: '는 쏭이도 없어졌넹?',
                        style: 'normal'
                    },
                    'EmptyWave': {
                        text: '쏭이야아아아아아아아악!!',
                        style: 'normal'
                    }
                }
            },
            'information': {
                'section': {
                    'wreath': {
                        text: '화환 노우!',
                        style: 'normal'
                    },
                    'parking': {
                        text: '주차 할 곳이 없네...',
                        style: 'normal'
                    },
                    'howl': {
                        text: '크랔릌랄카ㅡ크를라랔ㅏ...',
                        style: 'normal'
                    },
                    'howl2': {
                        text: '오..오...',
                        style: 'normal'
                    },
                    crash: {
                        text: '으아악!',
                        style: 'normal'
                    }
                }
            },
            'ending': {
                'section': {
                    'Touch': { text: '너도 토끼 만났어?', style: 'normal' },
                    'Adjust': { text: '너도 토끼 만났어?', style: 'normal' },
                    'Touch2': { text: '저는 액괴 만났는데용?', style: 'normal' },
                    'Touch3': { text: '저는 액괴 만났는데용?', style: 'normal' },
                    'Propose': { text: '그나저나 결혼 고?', style: 'normal' },
                    'Tag1': { text: '으으으으음~', style: 'normal' },
                    'Tag2': { text: '흐으으으음~ ㅋㅋㅋ', style: 'normal' },
                    'GGoduck': { text: '고', style: 'normal' },
                    'jump': { text: '끼얏후', style: 'normal' },
                }
            }
        };

    }

    /**
     * 애니메이션 상태에 따른 자막 체크
     * @param {string} characterId - 캐릭터 ID (section1, ending 등)
     * @param {string} sectionId - 섹션 ID (section)
     * @param {string} currentTag - 현재 애니메이션 태그 (Idle, Swipe 등)
     * @param {number} currentFrame - 현재 프레임 번호
     */
    checkSubtitle(characterId, sectionId, currentTag = null, currentFrame = null) {
        // 상태 비교용 키 (프레임 번호 제외)
        const currentStateKey = `${characterId}-${sectionId}-${currentTag}`;
        const fullCurrentState = `${characterId}-${sectionId}-${currentTag}-${currentFrame}`;

        // 같은 태그 상태에서는 중복 처리 방지
        if (this.lastCheckedStateKey === currentStateKey) {
            this.lastCheckedState = fullCurrentState;
            return;
        }

        // 이전 상태에서 태그가 변경되었는지 확인
        if (this.lastCheckedStateKey && this.lastCheckedStateKey !== currentStateKey) {
            const previousState = this.lastCheckedStateKey.split('-');
            const previousCharacterId = previousState[0] || null;
            const previousSectionId = previousState[1] || null;
            const previousTag = previousState[2] || null;

            this.hideSubtitle();
        }

        this.lastCheckedStateKey = currentStateKey;
        this.lastCheckedState = fullCurrentState;


        // 해당 캐릭터와 섹션의 자막 데이터 찾기
        const characterData = this.subtitles[characterId];
        if (!characterData) {
            this.hideSubtitle();
            return;
        }

        const sectionData = characterData[sectionId];
        if (!sectionData) {
            this.hideSubtitle();
            return;
        }

        // 현재 태그에 해당하는 자막 찾기
        if (currentTag && sectionData[currentTag]) {
            const subtitleData = sectionData[currentTag];
            this.showSubtitle(subtitleData);
        } else {
            this.hideSubtitle();
        }
    }

    /**
     * 자막 표시
     * @param {Object} subtitleData - 자막 데이터 {text, style}
     */
    showSubtitle(subtitleData) {
        if (!this.container || !this.box) return;


        // 이미 같은 자막이 표시 중이면 스킵
        if (this.currentSubtitle &&
            this.currentSubtitle.text === subtitleData.text) {
            return;
        }

        this.currentSubtitle = subtitleData;

        // 대사 텍스트만 설정
        this.dialogText.textContent = subtitleData.text;

        // 스타일 적용 (추후 확장 가능)
        this.box.className = `subtitle-box visible ${subtitleData.style || 'normal'}`;

        // 컨테이너 표시
        this.container.style.display = 'block';
        this.isVisible = true;

    }

    /**
     * 자막 숨기기
     */
    hideSubtitle() {
        if (!this.isVisible || !this.container || !this.box) return;


        this.box.classList.remove('visible');
        this.currentSubtitle = null;
        this.isVisible = false;

        // 애니메이션 완료 후 컨테이너 숨기기
        setTimeout(() => {
            if (!this.isVisible && this.container) {
                this.container.style.display = 'none';
            }
        }, 300); // CSS transition 시간과 맞춤
    }

    /**
     * 강제로 모든 자막 클리어 (섹션 전환 시 사용)
     */
    clearAllSubtitles() {
        this.lastCheckedState = null;
        this.lastCheckedStateKey = null;
        this.hideSubtitle();
    }

    /**
     * 자막 데이터 동적 추가 (개발용)
     * @param {string} characterId
     * @param {string} sectionId
     * @param {string} tag
     * @param {Object} subtitleData
     */
    addSubtitle(characterId, sectionId, tag, subtitleData) {
        if (!this.subtitles[characterId]) {
            this.subtitles[characterId] = {};
        }
        if (!this.subtitles[characterId][sectionId]) {
            this.subtitles[characterId][sectionId] = {};
        }

        this.subtitles[characterId][sectionId][tag] = subtitleData;
    }

    /**
     * 테스트용 메서드 - 자막 강제 표시
     */
    testSubtitle() {
        this.showSubtitle({
            text: '테스트 자막입니다!',
            style: 'normal'
        });

        // 3초 후 자동 숨김
        setTimeout(() => {
            this.hideSubtitle();
        }, 3000);
    }

    /**
     * Idle 태그 테스트용 메서드
     */
    testIdleSubtitle() {
        this.checkSubtitle('section1', 'section', 'Idle', 0);
    }

    /**
     * Swipe 태그 테스트용 메서드
     */
    testSwipeSubtitle() {
        this.checkSubtitle('section1', 'section', 'Swipe', 0);
    }
}

// 전역 export
window.SubtitleManager = SubtitleManager;

export default SubtitleManager;