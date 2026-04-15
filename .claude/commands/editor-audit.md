# 에디터 활동 전수조사 + 대시보드 배포

월별 에디터 활동을 Slack + Ghost CMS에서 전수조사하고, HTML 대시보드를 생성하여 Vercel에 배포한다.

## 인자

$ARGUMENTS: 대상 월 (예: "3월", "4월", "2026-03") — 미지정 시 직전 월

## 데이터 소스

### Slack (기획안 + 피드백)
- **토큰**: `~/_tools/slack-hyungwoon-bot/.env` → `SLACK_BOT_TOKEN`
- **채널**: 6개 스쿼드 채널

| 채널 | ID |
|------|-----|
| #22-스쿼드-그레이 | C079ZFJT1RV |
| #22-스쿼드-브랜드 | C079ZFFHBP1 |
| #22-스쿼드-아트 | C07A7DAPKRC |
| #22-스쿼드-컬쳐 | C07AE2J6SN6 |
| #22-스쿼드-플레이스 | C07ADUJTTPD |
| #22-스쿼드-피플 | C07B2RPQ872 |

### Ghost CMS (아티클)
- **토큰**: `~/_tools/antiegg-newsletter/.env` → `GHOST_ADMIN_API_KEY`
- **URL**: https://square.antiegg.kr
- **인증**: JWT (HS256, key id:secret 분리, hex decode)

### 이름 매칭 규칙
- Slack real_name ↔ 에디터 이름 매칭
- **정확 매칭 우선**, 그 다음 긴 이름 우선 (예: "이유진" > "유진")
- Ghost 영문 별명 별도 관리 (예: Nile → 나일)

## 프로세스

### 1단계: 사용자 확인

에디터 목록을 사용자에게 확인받는다:
- 대상 에디터 전체 목록
- 휴식중/제외 에디터
- 마감 지연 메모 (있으면)
- 대상 월

메모리(`memory/project_on_break.md`, `memory/project_march_deadlines.md` 등)에 저장된 정보가 있으면 먼저 참조하되, 사용자에게 변경사항 확인.

### 2단계: Slack 데이터 수집

**기획안 판정**: 스쿼드 채널의 부모 메시지 중 **200자 이상** 또는 **파일 첨부** → 기획안
- "기획안" 키워드에 의존하지 않음
- 에디터들은 기획안 본문을 직접 메시지로 올림

**피드백 판정**: 기획안 스레드에 남긴 **모든 댓글** = 피드백
- 길이 무관, 짧은 댓글도 피드백

수집 항목:
- 기획안 제출 여부 + 제출일 + 채널
- 남긴 피드백 수 (다른 사람 기획안 스레드에 남긴 댓글)
- 받은 피드백 수 (본인 기획안에 달린 댓글)

### 3단계: Ghost CMS 데이터 수집

Ghost Admin API (`/ghost/api/admin/posts/?limit=all&include=authors`) 호출:
- 작성자별 아티클 매핑
- 발행 상태 (published/draft)
- 최종 수정일

### 4단계: 크로스 리포트 생성

에디터별로 Slack + Ghost 데이터를 결합:
- 기획안 제출 여부/일자/채널
- 피드백 남긴/받은 건수
- Ghost 아티클 발행 여부/최종 수정일
- 마감 메모, 경고 표시

### 5단계: HTML 대시보드 생성

포함 섹션:
1. **상단 카드 4개**: 기획안 제출 N/전체, 피드백 참여 N/전체, Ghost 발행 N/전체, 총 피드백 댓글
2. **경고 박스**: 완전 무활동 에디터 (있으면)
3. **미니 카드 2개**: 피드백 많이 남긴 TOP 10 + 기획안 인기 TOP 10 (받은 댓글 순)
4. **아티클 미발행 현황**: 마감 메모 포함
5. **채널별 활동 요약**: 스쿼드별 기획안 수, 평균 피드백
6. **전체 상세 테이블**: 에디터별 전 항목 (휴식중 에디터 하단 별도 표시)

스타일: Apple HIG 스타일, 깔끔한 카드 UI, 뱃지 시스템
- 녹색 뱃지: 완료
- 빨간 뱃지: 미완료/경고
- 주황 뱃지: 마감 지연 메모
- 파란 뱃지: 휴식중

### 6단계: 사용자 검증

HTML을 로컬 브라우저로 열어 사용자에게 보여준다:
```bash
open /tmp/{month}-editor-audit.html
```

수정사항 반영 후 확인받기.

### 7단계: Vercel 배포

```bash
mkdir -p /tmp/editor-audit-deploy
cp /tmp/{month}-editor-audit.html /tmp/editor-audit-deploy/index.html
cd /tmp/editor-audit-deploy && vercel --yes --prod
```

배포 URL을 사용자에게 전달.

## 구현

작업 디렉토리: `/Users/hyungwoonlee/Documents/AI/_core/editor-in-chief`

기존 스크립트 `march-audit-v3.js`를 참조하되, 대상 월에 맞게 날짜 범위와 에디터 목록을 조정한다. 매월 스크립트를 새로 작성하지 말고, 기존 스크립트의 상수(날짜, 에디터 목록, 휴식자, 메모)만 수정하여 재실행.

## 주의사항

- Slack API rate limit: 요청 사이 300ms sleep
- Ghost JWT 토큰 만료: 5분 이내 사용
- 이름 매칭은 정확 매칭 우선, 부분 매칭은 긴 이름 우선
- 휴식중 에디터는 별도 섹션으로 분리 (활동 통계에서 제외)
- 배포 전 반드시 로컬에서 사용자 확인
