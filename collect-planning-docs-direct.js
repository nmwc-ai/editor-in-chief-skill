#!/usr/bin/env node

/**
 * 직접 채널 ID로 기획안 검색
 * 팀-콘텐츠 + 스쿼드 채널들
 */

const { WebClient } = require('@slack/web-api')

async function collectPlanningDocs() {
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

  try {
    console.log('🔍 기획안 검색 중...\n')

    const allProposals = []

    for (const channel of channels) {
      console.log(`  🔎 #${channel.name} 검색 중...`)
      let cursor
      let foundInChannel = 0
      let totalMessages = 0

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
          totalMessages += response.messages.length

          for (const msg of response.messages) {
            // Skip bot messages
            if (msg.bot_id || msg.subtype === 'bot_message') continue
            if (!msg.ts || !msg.user) continue

            const msgTs = parseFloat(msg.ts)
            if (isNaN(msgTs)) continue

            // Check for planning doc keyword (기획안 only, exclude 아티클)
            const hasPlanningKeyword = msg.text && /기획안/i.test(msg.text)
            const isNotArticle = !msg.text || !/아티클/i.test(msg.text)

            if (msg.text && hasPlanningKeyword && isNotArticle) {
              try {
                const userInfo = await client.users.info({ user: msg.user })
                const userName =
                  userInfo.user?.real_name || userInfo.user?.name || msg.user

                allProposals.push({
                  channel: channel.name,
                  user: userName,
                  userId: msg.user,
                  text: msg.text.substring(0, 100),
                  date: new Date(msgTs * 1000).toISOString().split('T')[0],
                  messageTs: msg.ts,
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
          console.log(`  ✓ #${channel.name} → ${foundInChannel}개 기획안 (메시지: ${totalMessages}개)`)
        } else {
          console.log(`  - #${channel.name} → 기획안 없음 (메시지: ${totalMessages}개)`)
        }
      } catch (err) {
        console.log(`  ✗ #${channel.name} → 오류 (${err.message})`)
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('📊 2026년 2월 기획안 올린 사람 통계')
    console.log('='.repeat(70) + '\n')

    if (allProposals.length === 0) {
      console.log('✗ 기획안이 없습니다.')
      return
    }

    // Group by user
    const byUser = {}
    allProposals.forEach((proposal) => {
      if (!byUser[proposal.user]) {
        byUser[proposal.user] = []
      }
      byUser[proposal.user].push(proposal)
    })

    // Display summary table
    console.log('| 에디터       | 기획안 수 | 채널들                      |')
    console.log('|-------------|---------|------------------------------|')

    const sortedUsers = Object.entries(byUser).sort(
      (a, b) => b[1].length - a[1].length
    )

    for (const [user, proposals] of sortedUsers) {
      const channels = [...new Set(proposals.map((p) => `#${p.channel}`))].join(
        ', '
      )
      const channelDisplay =
        channels.length > 22 ? channels.substring(0, 19) + '...' : channels
      console.log(
        `| ${user.padEnd(11)} | ${String(proposals.length).padStart(7)} | ${channelDisplay.padEnd(28)} |`
      )
    }

    console.log('\n' + '='.repeat(70))
    console.log(
      `총 ${allProposals.length}개 기획안 | ${Object.keys(byUser).length}명의 에디터`
    )
    console.log('='.repeat(70) + '\n')

    // Display detailed list
    console.log('📋 상세 목록:\n')
    allProposals
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach((proposal, idx) => {
        console.log(`${idx + 1}. [${proposal.date}] #${proposal.channel}`)
        console.log(`   작성자: ${proposal.user}`)
        console.log(`   내용: ${proposal.text}`)
        console.log()
      })
  } catch (error) {
    console.error('❌ 오류 발생:', error.message)
    process.exit(1)
  }
}

collectPlanningDocs()
