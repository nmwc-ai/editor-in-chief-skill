# Claude Code 공식 스킬 레지스트리 등록 가이드

## 📋 준비된 파일 목록

다음 파일들이 레지스트리 등록을 위해 준비되었습니다:

```
editor-in-chief/
├── skill.md              # 메인 스킬 프롬프트 (최신 톤 반영)
├── manifest.json         # 스킬 메타데이터
├── README.md             # 사용자 가이드
└── REGISTRY_SETUP.md     # 이 문서
```

## 🚀 등록 절차

### 1단계: GitHub 레포지토리 생성

**ANTIEGG 에디터들을 위한 전용 공개 레포지토리:**

```bash
# 레포지토리명: editor-in-chief-skill
# 설명: ANTIEGG Magazine's Editorial Feedback Agent

git init
git add .
git commit -m "chore: initial skill release"
git branch -M main
git remote add origin https://github.com/antiegg/editor-in-chief-skill.git
git push -u origin main
```

**필수 파일:**
- `skill.md` - 메인 스킬
- `manifest.json` - 메타데이터
- `README.md` - 설치 및 사용 가이드
- `LICENSE` - MIT 라이선스
- `.gitignore` - (일반적인 Node/Python 규칙)

### 2단계: GitHub 레포지토리 설정

#### 2-1. 라이선스 추가

```bash
# MIT 라이선스 파일 생성
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2026 ANTIEGG Magazine

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

#### 2-2. .gitignore 생성

```bash
cat > .gitignore << 'EOF'
# OS files
.DS_Store
Thumbs.db

# Node modules (if needed)
node_modules/
npm-debug.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# Temp files
*.tmp
.env.local
EOF
```

### 3단계: 공식 레지스트리 등록 신청

**Anthropic Claude Code 공식 스킬 레지스트리에 등록하려면:**

1. **GitHub 레포지토리 완성**
   - README.md 작성 ✅
   - manifest.json 작성 ✅
   - 라이선스 추가 ✅
   - Public으로 공개 ✅

2. **등록 신청 방법**
   - 방법 1: Anthropic 공식 Discord/Forum에서 신청
   - 방법 2: 공식 레지스트리 리포지토리에 PR 제출
   - 방법 3: Anthropic 팀에 직접 이메일 문의

3. **필수 정보**
   - 레포지토리 URL: `https://github.com/antiegg/editor-in-chief-skill.git`
   - 스킬 이름: `editor-in-chief`
   - 설명: "ANTIEGG Magazine's Editorial Feedback Agent"
   - 카테고리: `writing`, `content`, `editorial`
   - 메인테이너: ANTIEGG (또는 담당자)

### 4단계: 릴리스 및 버전 관리

#### 첫 번째 릴리스

```bash
# GitHub 릴리스 생성
git tag -a v1.0.0 -m "Initial release: Editor-in-chief skill for ANTIEGG"
git push origin v1.0.0
```

#### GitHub 릴리스 페이지에서 다음 정보 작성:

```markdown
## 📝 편집장 형운 v1.0.0

### ✨ Features
- 기획안 피드백: 주제, 구성, SEO, 스타일 검토
- 최종 아티클 검토: 콘텐츠 품질, SEO, ANTIEGG 스타일
- 동료 에디터로서의 따뜻한 톤
- 매번 다른 형식으로 정형화 탈피

### 📦 Installation

```bash
/install editor-in-chief
```

또는 수동 설치:
```bash
mkdir -p ~/.claude/skills/editor-in-chief
cp skill.md ~/.claude/skills/editor-in-chief/
```

### 🎯 Quick Start

**기획안 피드백:**
```
[기획안 전문]

>> 형운님, 이 기획 어떤가요?
```

**최종 아티클 검토:**
```
>> 형운님, 이 아티클 피드백 부탁합니다
https://square.antiegg.kr/article-url
```

### 📚 Documentation
- [README.md](README.md) - 상세 사용 가이드
- [manifest.json](manifest.json) - 스킬 메타데이터

### 🐛 Issues & Feedback
- GitHub Issues: [Report](https://github.com/antiegg/editor-in-chief-skill/issues)
- Discussions: [Join](https://github.com/antiegg/editor-in-chief-skill/discussions)

---
Made with ❤️ for ANTIEGG Magazine editors
```

## 📊 체크리스트

공식 레지스트리 등록 전 확인:

- [ ] **skill.md** - 최신 톤 반영 (동료 톤, 정형화 탈피)
- [ ] **manifest.json** - 정확한 메타데이터
- [ ] **README.md** - 명확한 사용 가이드
- [ ] **LICENSE** - MIT 또는 선택한 라이선스
- [ ] **GitHub 레포지토리** - Public, 잘 정리된 구조
- [ ] **초기 릴리스** (v1.0.0) 태그 생성
- [ ] **설명 문서** - GitHub 레포지토리에서 읽기 쉬운가
- [ ] **컨택트 정보** - ANTIEGG 담당자 정보 명시

## 🌐 등록 후 공유

### 에디터들에게 알리기

```markdown
# 편집장 형운 - 공식 레지스트리 등록 완료! 🎉

ANTIEGG 에디터들이 이제 Claude Code에서 편집장 형운을 쉽게 설치할 수 있습니다.

## 설치하기

```bash
/install editor-in-chief
```

## 피드백 받기

기획안이나 아티클을 공유하고 형운의 전문적이면서도 따뜻한 피드백을 받아보세요!

[GitHub 레포지토리](https://github.com/antiegg/editor-in-chief-skill)
```

### 채널별 공유 계획

- [ ] ANTIEGG 에디터 슬랙/커뮤니티 공지
- [ ] 웹사이트 공지사항
- [ ] 이메일 안내 (에디터들에게)
- [ ] GitHub 스타 요청 (업데이트 추적용)

## 🔄 유지보수 계획

### 버전 업데이트 전

```
1. 새로운 기능/톤 업데이트 완료
2. skill.md 수정
3. manifest.json의 버전 업데이트 (1.0.0 → 1.1.0)
4. README.md 변경사항 반영
5. CHANGELOG 작성
6. git tag 및 release 생성
```

### 정기 유지보수

- **월 1회**: 에디터 피드백 수집 및 검토
- **분기 1회**: 톤 평가 및 개선
- **필요시**: 긴급 버그 수정

## 📞 지원 및 문의

### GitHub 관리

- Issues: 기술적 문제, 설치 오류
- Discussions: 톤 개선 제안, 사용 팁 공유
- Releases: 새 버전 공지

### ANTIEGG 팀

- 내부 소통: [담당자 이메일/슬랙]
- 에디터 피드백: [피드백 채널]

## 🎯 성공 지표

레지스트리 등록 후 추적할 지표:

- ✅ 스킬 설치 수
- ✅ 에디터 활용률
- ✅ GitHub Issues 수 (개선 제안)
- ✅ 평균 별점/평가
- ✅ 커뮤니티 참여도

---

**다음 단계:**
1. GitHub 레포지토리 생성
2. 파일 푸시
3. 공식 레지스트리 신청
4. ANTIEGG 에디터들에게 공지

Happy editing! 🚀
