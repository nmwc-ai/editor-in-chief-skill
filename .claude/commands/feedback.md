# 에디터 기획안/아티클 피드백

슬랙 스쿼드 채널에서 피드백 미완료 기획안을 찾아 편집장 형운 피드백을 작성하고 쓰레드에 발송한다.

## 인자

$ARGUMENTS: 대상 지정 (예: "4월 기획안", "3월 아티클", "그레이 기획안", "전체")
- 미지정 시 "최신 기획안 전체"로 동작

## 프로세스

### 1단계: 스쿼드 채널 식별

Slack API (xoxp 토큰)로 스쿼드 채널 목록 수집:
```
검색 쿼리: "스쿼드" (search.messages API)
채널 패턴: #22-스쿼드-[이름]
```

알려진 채널:
| 채널 | ID |
|------|-----|
| #22-스쿼드-그레이 | C079ZFJT1RV |
| #22-스쿼드-아트 | C07A7DAPKRC |
| #22-스쿼드-컬쳐 | C07AE2J6SN6 |
| #22-스쿼드-플레이스 | C07ADUJTTPD |
| #22-스쿼드-피플 | C07B2RPQ872 |

### 2단계: 피드백 미완료 기획안 탐색

각 채널에서 conversations.history API로 최근 메시지 조회:
- "기획안", "공유", "제출" 키워드가 포함된 메시지 필터
- 형운(U03CXG0SAP9)이 작성한 메시지는 제외
- 각 메시지의 쓰레드(conversations.replies)를 확인하여 형운 답글 유무 판단
- 형운 답글이 없는 메시지 = 피드백 미완료

결과물: 피드백 미완료 목록 (채널, 에디터명, 제목, message_ts)

### 3단계: 에디터 이름 조회

users.info API로 각 에디터의 display_name 조회

### 4단계: 기획안 원문 수집

conversations.history API로 각 기획안의 전체 텍스트 수집 (truncate 없이)

### 5단계: 피드백 작성

`skill.md`의 편집장 형운 페르소나와 평가 기준에 따라 피드백 작성.

#### 필수 규칙
- 존댓말 (반말 절대 금지)
- em dash(—) 절대 금지, 쉼표/마침표/괄호로 대체
- 이모지 0~1개
- AI 티 금지 ("분석했습니다", "평가합니다" 등 금지)
- 매번 다른 형식과 톤
- 에디터의 고민 포인트 우선 해결
- 구체적 칭찬 (왜 좋은지 근거 제시)
- 실행 가능한 개선 제안

#### 기획안 평가 항목
1. 주제 타당성 (ANTIEGG 독자 관심도)
2. 방향성 & 차별화
3. 구성안 논리성 (제목/부제, 목차 흐름)
4. SEO 잠재력
5. ANTIEGG 스타일 부합도

#### 피드백 흐름
1. 에디터 고민 포인트 우선 답변
2. 구체적 칭찬 1-2가지
3. 주제 & 방향성 검토
4. 구성안 평가 + 개선 제안
5. 다음 스텝 제안

### 6단계: 사용자 확인

작성된 피드백 전체를 사용자에게 보여주고 확인을 받는다.
- 수정 요청 시 해당 건 수정
- "보내" / "발송" 등 승인 시 다음 단계 진행

### 7단계: 슬랙 발송

**반드시 curl + xoxp 토큰으로 발송** (형운 이름으로 표시, Claude 표시 없음)

```python
import urllib.request, json, time

TOKEN = os.environ["SLACK_USER_TOKEN"]  # xoxp-... 형운 User Token

data = json.dumps({
    "channel": CHANNEL_ID,
    "thread_ts": MESSAGE_TS,
    "text": f"<@{EDITOR_USER_ID}> {피드백_본문}"
}).encode("utf-8")

req = urllib.request.Request(
    "https://slack.com/api/chat.postMessage",
    data=data,
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json; charset=utf-8"
    }
)
resp = urllib.request.urlopen(req)
```

- 각 발송 사이 1.2초 대기 (rate limit 방지)
- 에디터 멘션 필수: `<@USER_ID>` 형식
- 기획안의 쓰레드에 답글로 발송 (thread_ts 지정)

### 8단계: 결과 보고

발송 결과 테이블 출력:
| # | 스쿼드 | 에디터 | 상태 |
|---|--------|--------|------|

## 주의사항

- `mcp__claude_ai_Slack__slack_send_message`는 "Claude로 보냄" 표시가 붙으므로 사용 금지
- `mcp__slack__reply`는 봇 토큰 전용이라 사용 불가
- 반드시 curl / urllib로 xoxp 토큰 직접 호출
- 피드백 발송 전 반드시 사용자 확인
- conversations.history API에서 `missing_scope` 에러 시 search.messages API로 우회
