#!/usr/bin/env node

/**
 * 기획안 상세 정보 수집 (Slack URL + 메시지 내용)
 * 더 정확한 기획안 감지 로직 포함
 */

const { WebClient } = require('@slack/web-api')
const fs = require('fs')

async function collectPlanningDocsDetailed() {
  const token = process.argv[2]
  if (!token) {
    console.error('❌ Slack 토큰을 인자로 전달해주세요')
    process.exit(1)
  }

  const client = new WebClient(token)
  const fromDate = new Date('2026-02-01')
  const toDate = new Date('2026-02-28')
  const fromTimestamp = Math.floor(fromDate.getTime() / 1000)
  const toTimestamp = Math.floor(toDate.getTime() / 1000)

  // 채널 ID 직접 지정
  const channels = [
    { id: 'C03CXG0P6A3', name: '1-팀-콘텐츠' },
    { id: 'C079ZFJT1RV', name: '22-스쿼드-그레이' },
    { id: 'C079ZFFHBP1', name: '22-스쿼드-브랜드' },
    { id: 'C07A7DAPKRC', name: '22-스쿼드-아트' },
    { id: 'C07AE2J6SN6', name: '22-스쿼드-컬쳐' },
    { id: 'C07ADUJTTPD', name: '22-스쿼드-플레이스' },
    { id: 'C07B2RPQ872', name: '22-스쿼드-피플' },
  ]

  /**
   * 기획안 감지 로직
   * - "기획안" 키워드 포함
   * - "아티클" 미포함
   * - 구조: 제목, 부제, 기획의도, 목차 등 포함 가능
   */
  function isPlanningDoc(text) {
    if (!text) return false

    // 기획안 포함 + 아티클 미포함
    const hasPlanningKeyword = /기획안/i.test(text)
    const isNotArticle = !/아티클/i.test(text)

    // "기획안" 키워드 + 아티클 아님
    if (hasPlanningKeyword && isNotArticle) {
      return true
    }

    // 구조화된 기획안 형식 감지
    // 제목, 부제, 기획의도 등이 있으면 기획안으로 간주
    const structuredPatterns = [
      /\*?제목\*?:/i,
      /\*?부제\*?:/i,
      /\*?기획의도\*?:/i,
      /\*?목차\*?:/i,
    ]

    const hasStructure = structuredPatterns.some(pattern => pattern.test(text))
    if (hasStructure && isNotArticle) {
      return true
    }

    return false
  }

  try {
    console.log('🔍 기획안 상세 정보 수집 중...\n')

    const allProposals = []

    for (const channel of channels) {
      console.log(`  🔎 #${channel.name} 검색 중...`)
      let cursor
      let foundInChannel = 0

      try {
        while (true) {
          const response = await client.conversations.history({
            channel: channel.id,
            cursor,
            limit: 200,
            oldest: String(fromTimestamp),
            latest: String(toTimestamp),
          })

          if (!response.messages) break

          for (const msg of response.messages) {
            // Skip bot messages
            if (msg.bot_id || msg.subtype === 'bot_message') continue
            if (!msg.ts || !msg.user) continue

            // 기획안 감지
            if (isPlanningDoc(msg.text)) {
              try {
                const userInfo = await client.users.info({ user: msg.user })
                const userName =
                  userInfo.user?.real_name || userInfo.user?.name || msg.user

                // Slack URL 생성
                const slackUrl = `https://app.slack.com/archives/${channel.id}/p${msg.ts.replace(
                  '.',
                  ''
                )}`

                // 메시지 내용 일부 추출 (첫 200자)
                let messagePreview = msg.text
                  .replace(/\n/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()

                if (messagePreview.length > 200) {
                  messagePreview = messagePreview.substring(0, 200) + '...'
                }

                allProposals.push({
                  channel: channel.name,
                  channelId: channel.id,
                  user: userName,
                  userId: msg.user,
                  date: new Date(parseFloat(msg.ts) * 1000)
                    .toISOString()
                    .split('T')[0],
                  messageTs: msg.ts,
                  slackUrl,
                  messagePreview,
                })

                foundInChannel++
              } catch (err) {
                // Skip if user info fetch fails
              }
            }
          }

          if (!response.has_more) break
          cursor = response.response_metadata?.next_cursor
        }

        if (foundInChannel > 0) {
          console.log(
            `  ✓ #${channel.name} → ${foundInChannel}개 기획안`
          )
        } else {
          console.log(`  - #${channel.name} → 기획안 없음`)
        }
      } catch (err) {
        console.log(`  ✗ #${channel.name} → 오류 (${err.message})`)
      }
    }

    console.log('\n' + '='.repeat(100))
    console.log('📊 2026년 2월 기획안 상세 목록')
    console.log('='.repeat(100) + '\n')

    if (allProposals.length === 0) {
      console.log('✗ 기획안이 없습니다.')
      return
    }

    // 날짜 역순으로 정렬
    const sorted = allProposals.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    )

    // Group by user
    const byUser = {}
    sorted.forEach((proposal) => {
      if (!byUser[proposal.user]) {
        byUser[proposal.user] = []
      }
      byUser[proposal.user].push(proposal)
    })

    // 사용자별로 그룹화해서 출력
    const sortedUsers = Object.entries(byUser).sort(
      (a, b) => b[1].length - a[1].length
    )

    sortedUsers.forEach(([user, proposals]) => {
      console.log(`\n👤 ${user} (${proposals.length}개)`)
      console.log('-'.repeat(100))

      proposals.forEach((proposal, idx) => {
        console.log(
          `  ${idx + 1}. [${proposal.date}] #${proposal.channel}`
        )
        console.log(`     🔗 ${proposal.slackUrl}`)
        console.log(`     📝 ${proposal.messagePreview}`)
      })
    })

    console.log('\n' + '='.repeat(100))
    console.log(
      `\n✅ 총 ${sorted.length}개 기획안 | ${Object.keys(byUser).length}명의 에디터\n`
    )

    // JSON 파일로도 저장
    const outputPath = '/tmp/planning-docs-detailed.json'
    fs.writeFileSync(outputPath, JSON.stringify(sorted, null, 2))
    console.log(`💾 상세 데이터 저장: ${outputPath}`)
  } catch (error) {
    console.error('❌ 오류 발생:', error.message)
    process.exit(1)
  }
}

collectPlanningDocsDetailed()
