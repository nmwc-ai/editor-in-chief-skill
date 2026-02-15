#!/usr/bin/env node

/**
 * 기획안을 아직 올리지 않은 채널 참여자 찾기
 */

const { WebClient } = require('@slack/web-api')

async function findMembersWithoutPlanningDocs() {
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
    { id: 'C079ZFJT1RV', name: '22-스쿼드-그레이' },
    { id: 'C079ZFFHBP1', name: '22-스쿼드-브랜드' },
    { id: 'C07A7DAPKRC', name: '22-스쿼드-아트' },
    { id: 'C07AE2J6SN6', name: '22-스쿼드-컬쳐' },
    { id: 'C07ADUJTTPD', name: '22-스쿼드-플레이스' },
    { id: 'C07B2RPQ872', name: '22-스쿼드-피플' },
  ]

  try {
    console.log('🔍 각 채널의 참여자와 기획안 현황 확인 중...\n')

    // 먼저 모든 기획안 올린 사람 수집
    const planningAuthors = new Set()

    for (const channel of channels) {
      let cursor

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
          if (msg.bot_id || msg.subtype === 'bot_message') continue
          if (!msg.ts || !msg.user) continue

          const msgTs = parseFloat(msg.ts)
          if (isNaN(msgTs)) continue

          // 기획안만 (아티클 제외)
          const hasPlanningKeyword = msg.text && /기획안/i.test(msg.text)
          const isNotArticle = !msg.text || !/아티클/i.test(msg.text)

          if (msg.text && hasPlanningKeyword && isNotArticle) {
            planningAuthors.add(msg.user)
          }
        }

        if (!response.has_more) break
        cursor = response.response_metadata?.next_cursor
      }
    }

    console.log(`✅ 기획안 올린 사람: ${planningAuthors.size}명\n`)

    // 각 채널별로 멤버 중 기획안 안 올린 사람 찾기
    console.log('='.repeat(70))
    console.log('📊 기획안을 아직 올리지 않은 채널 참여자')
    console.log('='.repeat(70) + '\n')

    for (const channel of channels) {
      console.log(`\n#${channel.name}`)
      console.log('-'.repeat(50))

      let cursor
      let members = []

      // 채널 멤버 가져오기
      while (true) {
        const response = await client.conversations.members({
          channel: channel.id,
          cursor,
          limit: 100,
        })

        members = members.concat(response.members || [])

        if (!response.has_more) break
        cursor = response.response_metadata?.next_cursor
      }

      // 멤버의 실명 조회 및 기획안 여부 확인
      const noPlanning = []

      for (const userId of members) {
        if (!planningAuthors.has(userId)) {
          try {
            const userInfo = await client.users.info({ user: userId })
            const userName =
              userInfo.user?.real_name || userInfo.user?.name || userId

            // 봇은 제외
            if (!userInfo.user?.is_bot) {
              noPlanning.push(userName)
            }
          } catch (err) {
            // Skip if user info fetch fails
          }
        }
      }

      if (noPlanning.length === 0) {
        console.log('  ✓ 모두 기획안을 올렸습니다! 👏')
      } else {
        console.log(`  미제출: ${noPlanning.length}명`)
        noPlanning.forEach((name) => {
          console.log(`    - ${name}`)
        })
      }
    }

    console.log('\n' + '='.repeat(70))
  } catch (error) {
    console.error('❌ 오류 발생:', error.message)
    process.exit(1)
  }
}

findMembersWithoutPlanningDocs()
