#!/usr/bin/env node

/**
 * 이번달(2026-02) 기획안 올린 사람 통계
 * Slack API로 실시간 수집
 */

const { WebClient } = require('@slack/web-api')

const PLANNING_DOC_PATTERN = /square\.antiegg\.kr/

async function collectPlanningDocs() {
  const token = process.argv[2]
  if (!token) {
    console.error('❌ Slack 토큰을 인자로 전달해주세요')
    console.error('사용법: node collect-planning-docs.js <TOKEN>')
    process.exit(1)
  }

  const client = new WebClient(token)
  const fromDate = new Date('2026-02-01')
  const toDate = new Date('2026-02-28')
  const fromTimestamp = Math.floor(fromDate.getTime() / 1000)
  const toTimestamp = Math.floor(toDate.getTime() / 1000)

  try {
    console.log('🔍 Slack 채널 목록 조회 중...\n')

    // Get all public and private channels (with pagination)
    let allChannels = []
    let cursor

    while (true) {
      const response = await client.conversations.list({
        types: 'public_channel,private_channel',
        limit: 100,
        exclude_archived: true,
        cursor,
      })

      allChannels = allChannels.concat(response.channels || [])

      if (!response.has_more) break
      cursor = response.response_metadata?.next_cursor
    }

    const channels = allChannels
    console.log(`✅ ${channels.length}개 채널 발견\n`)

    const allProposals = []
    let searchedChannels = 0

    // Search each channel for planning docs
    for (const channel of channels) {
      let cursor
      let foundInChannel = 0

      try {
        console.log(`  🔎 #${channel.name} 검색 중...`)
        let totalMessages = 0
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

            // Check for planning doc keyword or content
            // 1) URL 검사, 또는 2) "기획안" 키워드 검사
            const hasURL = msg.text && PLANNING_DOC_PATTERN.test(msg.text)
            const hasKeyword = msg.text && /기획안|planning doc|콘텐츠 기획|주제/i.test(msg.text)

            if (msg.text && (hasURL || hasKeyword)) {
              try {
                const userInfo = await client.users.info({ user: msg.user })
                const userName =
                  userInfo.user?.real_name || userInfo.user?.name || msg.user

                const urlMatch = msg.text.match(
                  /https:\/\/square\.antiegg\.kr\/[^\s|>]+/
                )
                const url = urlMatch ? urlMatch[0] : 'unknown'

                allProposals.push({
                  channel: channel.name,
                  user: userName,
                  userId: msg.user,
                  url,
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

        searchedChannels++
        if (foundInChannel > 0) {
          console.log(`  ✓ #${channel.name} → ${foundInChannel}개 기획안 (메시지: ${totalMessages}개)`)
        } else {
          console.log(`  - #${channel.name} → 기획안 없음 (메시지: ${totalMessages}개)`)
        }
      } catch (err) {
        console.log(`  ✗ #${channel.name} → 접근 불가 (${err.message})`)
      }
    }

    console.log(`\n검색 완료: ${searchedChannels}개 채널 확인\n`)
    console.log('='.repeat(70))
    console.log('📊 2026년 2월 기획안 올린 사람 통계')
    console.log('='.repeat(70) + '\n')

    if (allProposals.length === 0) {
      console.log('✗ 이번달 기획안이 없습니다.')
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
        console.log(`   링크: ${proposal.url}`)
        console.log()
      })
  } catch (error) {
    console.error('❌ 오류 발생:', error.message)
    if (error.code === 'invalid_auth') {
      console.error('   → Slack 토큰이 유효하지 않습니다.')
    }
    process.exit(1)
  }
}

collectPlanningDocs()
