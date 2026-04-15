#!/usr/bin/env node

/**
 * 3월 에디터 전수조사
 * 1. Slack 기획안 제출 여부 + 제출일
 * 2. Slack 피드백 활동 (받은 댓글 vs 남긴 댓글)
 * 3. Ghost CMS 아티클 게시 여부 + 최종 수정일
 */

const { WebClient } = require('@slack/web-api')
const jwt = require('jsonwebtoken')
const https = require('https')

// --- Config ---
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN
if (!SLACK_TOKEN) throw new Error('SLACK_BOT_TOKEN 환경변수가 설정되지 않았습니다')
const GHOST_API_URL = 'https://square.antiegg.kr'
const GHOST_ADMIN_KEY = process.env.GHOST_ADMIN_KEY
if (!GHOST_ADMIN_KEY) throw new Error('GHOST_ADMIN_KEY 환경변수가 설정되지 않았습니다')

const CHANNELS = [
  { id: 'C03CXG0P6A3', name: '1-팀-콘텐츠' },
  { id: 'C079ZFJT1RV', name: '22-스쿼드-그레이' },
  { id: 'C079ZFFHBP1', name: '22-스쿼드-브랜드' },
  { id: 'C07A7DAPKRC', name: '22-스쿼드-아트' },
  { id: 'C07AE2J6SN6', name: '22-스쿼드-컬쳐' },
  { id: 'C07ADUJTTPD', name: '22-스쿼드-플레이스' },
  { id: 'C07B2RPQ872', name: '22-스쿼드-피플' },
]

const MARCH_START = Math.floor(new Date('2026-03-01T00:00:00+09:00').getTime() / 1000)
const MARCH_END = Math.floor(new Date('2026-04-01T00:00:00+09:00').getTime() / 1000)

const EDITORS = [
  '이한빈','김태현','유진','서하','지정현','주제','한나','김자현','이수현','최윤영',
  '김진희','박정호','이소연','정샘물','심혜빈','서희','안수연','효빈','조정묵','김강민',
  '재현','주소영','화윤','황예지','지희','지경','현정','지연','주단단','루루',
  '해지','주현','열매','전세영','황진욱','정한글','나일','김희진','이유진','정구범',
  '정찬휘','이현지','유영','다인','이진실','동춘','유혜승','임진환','태현','예화림',
]

const client = new WebClient(SLACK_TOKEN)

// --- Helpers ---
const sleep = ms => new Promise(r => setTimeout(r, ms))

const userCache = {}
async function getUserName(userId) {
  if (userCache[userId]) return userCache[userId]
  try {
    const info = await client.users.info({ user: userId })
    const name = info.user?.real_name || info.user?.profile?.display_name || info.user?.name || userId
    userCache[userId] = name
    return name
  } catch {
    userCache[userId] = userId
    return userId
  }
}

function ghostRequest(path) {
  const [id, secret] = GHOST_ADMIN_KEY.split(':')
  const token = jwt.sign({}, Buffer.from(secret, 'hex'), {
    keyid: id, algorithm: 'HS256', expiresIn: '5m', audience: '/admin/'
  })
  return new Promise((resolve, reject) => {
    const url = new URL(path, GHOST_API_URL)
    const req = https.request(url, {
      headers: { Authorization: `Ghost ${token}` }
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error(`Ghost parse error: ${data.substring(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function matchEditor(name) {
  if (!name) return null
  const cleaned = name.replace(/\s+/g, '').toLowerCase()
  for (const editor of EDITORS) {
    const editorCleaned = editor.replace(/\s+/g, '').toLowerCase()
    if (cleaned.includes(editorCleaned) || editorCleaned.includes(cleaned)) return editor
    // partial match for single-name editors
    if (editor.length <= 3 && cleaned.endsWith(editorCleaned)) return editor
  }
  return null
}

// --- Phase 1: Slack Data ---
async function collectSlackData() {
  console.log('=== Phase 1: Slack 채널 메시지 수집 ===\n')

  // All messages per channel
  const allMessages = [] // { channel, user, userId, text, ts, date, threadTs, replyCount }
  const planningDocs = [] // subset: messages containing 기획안

  for (const ch of CHANNELS) {
    console.log(`  📡 #${ch.name} 수집 중...`)
    let cursor
    let count = 0

    while (true) {
      try {
        const res = await client.conversations.history({
          channel: ch.id, cursor, limit: 200,
          oldest: String(MARCH_START), latest: String(MARCH_END),
        })
        if (!res.messages) break

        for (const msg of res.messages) {
          if (msg.bot_id || msg.subtype === 'bot_message') continue
          if (!msg.ts || !msg.user) continue

          count++
          allMessages.push({
            channel: ch.name, channelId: ch.id,
            userId: msg.user, text: msg.text || '',
            ts: msg.ts, date: new Date(parseFloat(msg.ts) * 1000).toISOString().split('T')[0],
            threadTs: msg.thread_ts || msg.ts,
            replyCount: msg.reply_count || 0,
            isParent: !msg.thread_ts || msg.thread_ts === msg.ts,
          })

          // Planning doc detection
          if (msg.text && /기획안/i.test(msg.text) && !/아티클/i.test(msg.text)) {
            planningDocs.push({
              channel: ch.name, channelId: ch.id,
              userId: msg.user, text: msg.text.substring(0, 150),
              ts: msg.ts, date: new Date(parseFloat(msg.ts) * 1000).toISOString().split('T')[0],
              replyCount: msg.reply_count || 0,
            })
          }
        }

        if (!res.has_more) break
        cursor = res.response_metadata?.next_cursor
        await sleep(300)
      } catch (e) {
        console.log(`    ⚠️ ${ch.name} 오류: ${e.message}`)
        break
      }
    }
    console.log(`    → ${count}개 메시지`)
  }

  console.log(`\n  총 메시지: ${allMessages.length}개, 기획안: ${planningDocs.length}개\n`)

  // Resolve user names for all planning doc authors
  console.log('  👤 사용자 이름 매핑 중...')
  const uniqueUsers = [...new Set([...allMessages.map(m => m.userId), ...planningDocs.map(m => m.userId)])]
  for (const uid of uniqueUsers) {
    await getUserName(uid)
    await sleep(100)
  }
  console.log(`    → ${Object.keys(userCache).length}명 매핑 완료\n`)

  // Phase 1b: Collect thread replies for planning docs
  console.log('  💬 기획안 스레드 댓글 수집 중...')
  const threadReplies = [] // { parentUserId, parentChannel, replyUserId, replyTs }

  for (const doc of planningDocs) {
    if (doc.replyCount === 0) continue
    try {
      let cursor
      while (true) {
        const res = await client.conversations.replies({
          channel: doc.channelId, ts: doc.ts, cursor, limit: 200,
        })
        if (!res.messages) break

        for (const reply of res.messages) {
          if (reply.ts === doc.ts) continue // skip parent
          if (reply.bot_id || reply.subtype === 'bot_message') continue
          if (!reply.user) continue

          await getUserName(reply.user)
          threadReplies.push({
            parentUserId: doc.userId,
            parentChannel: doc.channel,
            replyUserId: reply.user,
            replyDate: new Date(parseFloat(reply.ts) * 1000).toISOString().split('T')[0],
          })
        }

        if (!res.has_more) break
        cursor = res.response_metadata?.next_cursor
        await sleep(300)
      }
    } catch (e) {
      // skip thread errors
    }
  }
  console.log(`    → ${threadReplies.length}개 스레드 댓글\n`)

  return { allMessages, planningDocs, threadReplies }
}

// --- Phase 2: Ghost Data ---
async function collectGhostData() {
  console.log('=== Phase 2: Ghost CMS 아티클 수집 ===\n')

  try {
    // Get all posts with authors, filter for March or recent
    const data = await ghostRequest('/ghost/api/admin/posts/?limit=all&include=authors&formats=html')
    const posts = data.posts || []
    console.log(`  📰 총 ${posts.length}개 포스트\n`)

    // Get posts updated in March 2026 or later
    const marchPosts = posts.map(p => ({
      title: p.title,
      slug: p.slug,
      status: p.status,
      publishedAt: p.published_at,
      updatedAt: p.updated_at,
      createdAt: p.created_at,
      authors: (p.authors || []).map(a => a.name),
      url: p.url,
    }))

    return marchPosts
  } catch (e) {
    console.log(`  ⚠️ Ghost API 오류: ${e.message}`)
    return []
  }
}

// --- Phase 3: Cross-reference ---
async function buildReport(slackData, ghostPosts) {
  console.log('=== Phase 3: 전수조사 리포트 생성 ===\n')

  const { planningDocs, threadReplies } = slackData
  const report = []

  for (const editor of EDITORS) {
    const entry = {
      name: editor,
      // Slack: planning doc
      planningSubmitted: false,
      planningDate: null,
      planningChannel: null,
      planningCount: 0,
      // Slack: feedback
      feedbackReceived: 0, // replies on their planning docs
      feedbackGiven: 0, // replies they left on others' docs
      // Ghost: article
      ghostArticles: [],
      ghostLastUpdated: null,
    }

    // Find matching userId(s) for this editor
    const matchingUserIds = Object.entries(userCache)
      .filter(([uid, name]) => matchEditor(name) === editor)
      .map(([uid]) => uid)

    // Planning doc check
    const editorDocs = planningDocs.filter(d => matchingUserIds.includes(d.userId))
    if (editorDocs.length > 0) {
      entry.planningSubmitted = true
      entry.planningCount = editorDocs.length
      // earliest submission
      const sorted = editorDocs.sort((a, b) => a.ts - b.ts)
      entry.planningDate = sorted[0].date
      entry.planningChannel = sorted[0].channel
    }

    // Feedback received (replies on their planning docs)
    entry.feedbackReceived = threadReplies.filter(r =>
      matchingUserIds.includes(r.parentUserId)
    ).length

    // Feedback given (replies they left on OTHER people's docs)
    entry.feedbackGiven = threadReplies.filter(r =>
      matchingUserIds.includes(r.replyUserId) && !matchingUserIds.includes(r.parentUserId)
    ).length

    // Ghost articles
    const editorArticles = ghostPosts.filter(p =>
      p.authors.some(author => matchEditor(author) === editor)
    )
    entry.ghostArticles = editorArticles.map(a => ({
      title: a.title,
      status: a.status,
      updatedAt: a.updatedAt ? a.updatedAt.split('T')[0] : null,
      publishedAt: a.publishedAt ? a.publishedAt.split('T')[0] : null,
    }))
    if (editorArticles.length > 0) {
      const latest = editorArticles
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0]
      entry.ghostLastUpdated = latest.updatedAt ? latest.updatedAt.split('T')[0] : null
    }

    report.push(entry)
  }

  return report
}

// --- Phase 4: Output ---
function printReport(report) {
  console.log('\n' + '═'.repeat(120))
  console.log('📊 2026년 3월 에디터 전수조사 리포트')
  console.log('═'.repeat(120))

  // Summary table
  console.log('\n┌─────────┬──────────┬────────────┬──────────────────┬──────────┬──────────┬──────────┬────────────┐')
  console.log('│ 에디터   │ 기획안   │ 제출일     │ 채널             │ 받은댓글 │ 남긴댓글 │ Ghost    │ 최종수정   │')
  console.log('├─────────┼──────────┼────────────┼──────────────────┼──────────┼──────────┼──────────┼────────────┤')

  for (const r of report) {
    const name = r.name.padEnd(6)
    const submitted = r.planningSubmitted ? `✅ ${r.planningCount}개`.padEnd(8) : '❌'.padEnd(8)
    const date = (r.planningDate || '-').padEnd(10)
    const channel = (r.planningChannel || '-').padEnd(16)
    const received = String(r.feedbackReceived).padEnd(8)
    const given = String(r.feedbackGiven).padEnd(8)
    const ghost = r.ghostArticles.length > 0 ? `✅ ${r.ghostArticles.length}개`.padEnd(8) : '❌'.padEnd(8)
    const lastUpdated = (r.ghostLastUpdated || '-').padEnd(10)

    console.log(`│ ${name} │ ${submitted} │ ${date} │ ${channel} │ ${received} │ ${given} │ ${ghost} │ ${lastUpdated} │`)
  }

  console.log('└─────────┴──────────┴────────────┴──────────────────┴──────────┴──────────┴──────────┴────────────┘')

  // Summaries
  const submitted = report.filter(r => r.planningSubmitted).length
  const notSubmitted = report.filter(r => !r.planningSubmitted).length
  const hasGhost = report.filter(r => r.ghostArticles.length > 0).length
  const noGhost = report.filter(r => r.ghostArticles.length === 0).length
  const totalFeedbackGiven = report.reduce((sum, r) => sum + r.feedbackGiven, 0)

  console.log(`\n📈 요약`)
  console.log(`  기획안 제출: ${submitted}명 / 미제출: ${notSubmitted}명`)
  console.log(`  Ghost 아티클: ${hasGhost}명 / 없음: ${noGhost}명`)
  console.log(`  총 피드백 댓글: ${totalFeedbackGiven}건`)

  // Not submitted list
  console.log(`\n❌ 기획안 미제출자 (${notSubmitted}명):`)
  report.filter(r => !r.planningSubmitted).forEach(r => console.log(`  - ${r.name}`))

  // No ghost article list
  console.log(`\n❌ Ghost 아티클 없는 에디터 (${noGhost}명):`)
  report.filter(r => r.ghostArticles.length === 0).forEach(r => console.log(`  - ${r.name}`))

  // High feedback givers
  const topFeedbackers = report.filter(r => r.feedbackGiven > 0).sort((a, b) => b.feedbackGiven - a.feedbackGiven)
  if (topFeedbackers.length > 0) {
    console.log(`\n🏆 피드백 활발한 에디터 (댓글 많이 남긴 순):`)
    topFeedbackers.forEach(r => console.log(`  ${r.name}: 남긴 ${r.feedbackGiven}건 / 받은 ${r.feedbackReceived}건`))
  }

  // Low engagement (submitted but no feedback given)
  const lowEngagement = report.filter(r => r.planningSubmitted && r.feedbackGiven === 0)
  if (lowEngagement.length > 0) {
    console.log(`\n⚠️ 기획안 제출했으나 피드백 0건 (${lowEngagement.length}명):`)
    lowEngagement.forEach(r => console.log(`  - ${r.name} (받은 댓글: ${r.feedbackReceived}건)`))
  }

  // Ghost article details
  const withArticles = report.filter(r => r.ghostArticles.length > 0)
  if (withArticles.length > 0) {
    console.log(`\n📝 Ghost 아티클 상세:`)
    for (const r of withArticles) {
      for (const a of r.ghostArticles) {
        console.log(`  ${r.name}: "${a.title}" [${a.status}] 발행:${a.publishedAt || '-'} 수정:${a.updatedAt || '-'}`)
      }
    }
  }

  // JSON output for further processing
  const jsonPath = '/tmp/march-audit-2026.json'
  require('fs').writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  console.log(`\n💾 JSON 저장: ${jsonPath}`)
}

// --- Main ---
async function main() {
  console.log('🔍 2026년 3월 에디터 전수조사 시작\n')
  console.log(`  대상 에디터: ${EDITORS.length}명`)
  console.log(`  기간: 2026-03-01 ~ 2026-03-31`)
  console.log(`  채널: ${CHANNELS.length}개\n`)

  const slackData = await collectSlackData()
  const ghostPosts = await collectGhostData()
  const report = await buildReport(slackData, ghostPosts)
  printReport(report)
}

main().catch(e => {
  console.error('💥 치명적 오류:', e)
  process.exit(1)
})
