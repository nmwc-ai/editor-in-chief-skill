# Changelog

모든 주요 변경사항은 이 파일에 기록됩니다.

## [Unreleased]

## [1.1.0] - 2026-02-16

### Added
- **새로운 스크립트: `collect-planning-docs-detailed.js`**
  - Slack URL이 포함된 기획안 상세 정보 수집
  - 각 기획안별 메시지 링크 자동 생성
  - 메시지 미리보기 추출 (첫 200자)
  - JSON 형식으로 데이터 저장
  - 구조화된 기획안 패턴 감지 (제목, 부제, 기획의도 등)

### Improved
- 기획안 감지 로직 강화
  - "기획안" 키워드 감지
  - "아티클" 메시지 자동 필터링
  - 구조화된 문서 형식 패턴 매칭
  - 사용자 수동 검증 가능

### Data
- 2026년 2월 기획안 수집 통계
  - 기획안 제출: 50명
  - 미제출: 8명 (예상)
  - 제외 대상: 14명 (에디터 아님)
  - 제출률: 86.2%

## [1.0.0] - 2026-02-15

### Initial Release
- `collect-planning-docs-direct.js` - 기획안 수집 스크립트
- `find-no-planning-docs.js` - 미제출자 식별 스크립트
- Slack API 통합
- 월별 통계 생성 기능
- 에디터 활동 추적 (editor-activity-stats 스킬)
