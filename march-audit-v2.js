#!/usr/bin/env node

const { WebClient } = require('@slack/web-api')
const jwt = require('jsonwebtoken')
const https = require('https')
const fs = require('fs')

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
const sleep = ms => new Promise(r => setTimeout(r, ms))

const userCache = {}
async function getUserName(userId) {
  if (userCache[userId]) return userCache[userId]
  try {
    const info = await client.users.info({ user: userId })
    const name = info.user?.real_name || info.user?.profile?.display_name || info.user?.name || userId
    userCache[userId] = name
    return name
  } catch { userCache[userId] = userId; return userId }
}

// Aliases: Ghost English names → Korean editor names
const ALIASES = { 'Nile': '나일' }

// Fixed: exact match first, then longest match wins
function matchEditor(name) {
  if (!name) return null
  if (ALIASES[name]) return ALIASES[name]
  const cleaned = name.replace(/\s+/g, '')
  if (ALIASES[cleaned]) return ALIASES[cleaned]
  // 1) exact match
  for (const editor of EDITORS) {
    if (cleaned === editor) return editor
  }
  // 2) longest match wins (sort editors by length desc to prefer "이유진" over "유진")
  const sorted = [...EDITORS].sort((a, b) => b.length - a.length)
  for (const editor of sorted) {
    if (cleaned.includes(editor)) return editor
    if (editor.includes(cleaned) && cleaned.length >= 2) return editor
  }
  return null
}

function ghostRequest(path) {
  const [id, secret] = GHOST_ADMIN_KEY.split(':')
  const token = jwt.sign({}, Buffer.from(secret, 'hex'), {
    keyid: id, algorithm: 'HS256', expiresIn: '5m', audience: '/admin/'
  })
  return new Promise((resolve, reject) => {
    const url = new URL(path, GHOST_API_URL)
    const req = https.request(url, { headers: { Authorization: `Ghost ${token}` } }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch { reject(new Error(data.substring(0, 200))) } })
    })
    req.on('error', reject)
    req.end()
  })
}

async function collectSlackData() {
  console.log('Phase 1: Slack 수집...')
  const planningDocs = []

  for (const ch of CHANNELS) {
    let cursor, count = 0
    while (true) {
      try {
        const res = await client.conversations.history({
          channel: ch.id, cursor, limit: 200,
          oldest: String(MARCH_START), latest: String(MARCH_END),
        })
        if (!res.messages) break
        for (const msg of res.messages) {
          if (msg.bot_id || msg.subtype === 'bot_message' || !msg.ts || !msg.user) continue
          count++
          if (msg.text && /기획안/i.test(msg.text) && !/아티클/i.test(msg.text)) {
            planningDocs.push({
              channel: ch.name, channelId: ch.id, userId: msg.user,
              text: msg.text.substring(0, 150),
              ts: msg.ts, date: new Date(parseFloat(msg.ts) * 1000).toISOString().split('T')[0],
              replyCount: msg.reply_count || 0,
            })
          }
        }
        if (!res.has_more) break
        cursor = res.response_metadata?.next_cursor
        await sleep(300)
      } catch { break }
    }
    console.log(`  #${ch.name}: ${count}개`)
  }

  // Resolve all user names
  const uids = [...new Set(planningDocs.map(m => m.userId))]
  for (const uid of uids) { await getUserName(uid); await sleep(100) }

  // Collect thread replies
  console.log('Phase 1b: 스레드 댓글 수집...')
  const threadReplies = []
  for (const doc of planningDocs) {
    if (doc.replyCount === 0) continue
    try {
      let cursor
      while (true) {
        const res = await client.conversations.replies({ channel: doc.channelId, ts: doc.ts, cursor, limit: 200 })
        if (!res.messages) break
        for (const reply of res.messages) {
          if (reply.ts === doc.ts || reply.bot_id || !reply.user) continue
          await getUserName(reply.user)
          threadReplies.push({ parentUserId: doc.userId, replyUserId: reply.user })
        }
        if (!res.has_more) break
        cursor = res.response_metadata?.next_cursor
        await sleep(300)
      }
    } catch {}
  }

  // Also resolve names for all reply users
  const allUids = [...new Set([...Object.keys(userCache), ...threadReplies.map(r => r.replyUserId)])]
  for (const uid of allUids) { if (!userCache[uid]) { await getUserName(uid); await sleep(100) } }

  console.log(`  기획안 ${planningDocs.length}개, 댓글 ${threadReplies.length}개`)
  return { planningDocs, threadReplies }
}

async function collectGhostData() {
  console.log('Phase 2: Ghost 수집...')
  try {
    const data = await ghostRequest('/ghost/api/admin/posts/?limit=all&include=authors&formats=html')
    const posts = (data.posts || []).map(p => ({
      title: p.title, slug: p.slug, status: p.status,
      publishedAt: p.published_at, updatedAt: p.updated_at,
      authors: (p.authors || []).map(a => a.name),
    }))
    console.log(`  ${posts.length}개 포스트`)
    return posts
  } catch (e) { console.log(`  Ghost 오류: ${e.message}`); return [] }
}

function buildReport(slackData, ghostPosts) {
  const { planningDocs, threadReplies } = slackData

  // Debug: print user mapping
  console.log('\nPhase 3: 이름 매칭 검증...')
  const editorToUids = {}
  for (const [uid, name] of Object.entries(userCache)) {
    const matched = matchEditor(name)
    if (matched) {
      if (!editorToUids[matched]) editorToUids[matched] = []
      editorToUids[matched].push({ uid, slackName: name })
    }
  }
  // Print ambiguous matches for verification
  for (const [editor, uids] of Object.entries(editorToUids)) {
    if (uids.some(u => u.slackName !== editor)) {
      console.log(`  ${editor} ← [${uids.map(u => `${u.slackName}(${u.uid})`).join(', ')}]`)
    }
  }

  const report = []
  for (const editor of EDITORS) {
    const matchingUserIds = (editorToUids[editor] || []).map(u => u.uid)

    const editorDocs = planningDocs.filter(d => matchingUserIds.includes(d.userId))
    const sorted = editorDocs.sort((a, b) => a.ts - b.ts)

    const feedbackReceived = threadReplies.filter(r => matchingUserIds.includes(r.parentUserId)).length
    const feedbackGiven = threadReplies.filter(r =>
      matchingUserIds.includes(r.replyUserId) && !matchingUserIds.includes(r.parentUserId)
    ).length

    const editorArticles = ghostPosts.filter(p => p.authors.some(a => matchEditor(a) === editor))
    const publishedArticles = editorArticles.filter(a => a.status === 'published')
    const latestArticle = editorArticles.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0]

    report.push({
      name: editor,
      slackIds: matchingUserIds,
      planningSubmitted: editorDocs.length > 0,
      planningCount: editorDocs.length,
      planningDate: sorted[0]?.date || null,
      planningChannel: sorted[0]?.channel || null,
      feedbackReceived,
      feedbackGiven,
      ghostTotal: editorArticles.length,
      ghostPublished: publishedArticles.length,
      ghostArticles: editorArticles.map(a => ({
        title: a.title, status: a.status,
        publishedAt: a.publishedAt?.split('T')[0] || null,
        updatedAt: a.updatedAt?.split('T')[0] || null,
      })),
      ghostLastUpdated: latestArticle?.updatedAt?.split('T')[0] || null,
    })
  }
  return report
}

function generateHTML(report) {
  const submitted = report.filter(r => r.planningSubmitted).length
  const notSubmitted = report.filter(r => !r.planningSubmitted).length
  const hasGhost = report.filter(r => r.ghostPublished > 0).length
  const totalFeedback = report.reduce((s, r) => s + r.feedbackGiven, 0)
  const zeroActivity = report.filter(r => !r.planningSubmitted && r.ghostTotal === 0 && r.feedbackGiven === 0)

  const rows = report.map((r, i) => {
    const planBadge = r.planningSubmitted
      ? `<span class="badge ok">${r.planningCount}개</span>`
      : `<span class="badge fail">미제출</span>`
    const ghostBadge = r.ghostPublished > 0
      ? `<span class="badge ok">${r.ghostPublished}개</span>`
      : r.ghostTotal > 0
        ? `<span class="badge warn">draft ${r.ghostTotal}</span>`
        : `<span class="badge fail">없음</span>`
    const fbRatio = r.feedbackGiven === 0 && r.feedbackReceived === 0
      ? '<span class="text-muted">-</span>'
      : `<span class="fb-given">${r.feedbackGiven}</span> / <span class="fb-recv">${r.feedbackReceived}</span>`

    const isZero = !r.planningSubmitted && r.ghostTotal === 0 && r.feedbackGiven === 0
    const rowClass = isZero ? 'row-danger' : !r.planningSubmitted ? 'row-warn' : ''

    const ghostDetail = r.ghostArticles.length > 0
      ? r.ghostArticles.map(a => `${a.title} [${a.status}]`).join('<br>')
      : '-'

    return `<tr class="${rowClass}">
      <td class="num">${i + 1}</td>
      <td class="name">${r.name}</td>
      <td>${planBadge}</td>
      <td>${r.planningDate || '-'}</td>
      <td>${r.planningChannel?.replace('22-스쿼드-', '') || '-'}</td>
      <td class="center">${fbRatio}</td>
      <td>${ghostBadge}</td>
      <td>${r.ghostLastUpdated || '-'}</td>
      <td class="detail">${ghostDetail}</td>
    </tr>`
  }).join('\n')

  const notSubmittedList = report.filter(r => !r.planningSubmitted).map(r => r.name).join(', ')
  const noGhostList = report.filter(r => r.ghostTotal === 0).map(r => r.name).join(', ')
  const zeroList = zeroActivity.map(r => r.name).join(', ')
  const topFeeders = report.filter(r => r.feedbackGiven > 0).sort((a, b) => b.feedbackGiven - a.feedbackGiven).slice(0, 10)

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>2026년 3월 에디터 활동 현황</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; background: #f5f5f7; color: #1d1d1f; padding: 32px; }
  .container { max-width: 1400px; margin: 0 auto; }
  h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  .subtitle { color: #86868b; font-size: 14px; margin-bottom: 32px; }

  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .card .label { font-size: 13px; color: #86868b; margin-bottom: 4px; }
  .card .value { font-size: 36px; font-weight: 700; }
  .card .value.green { color: #34c759; }
  .card .value.red { color: #ff3b30; }
  .card .value.orange { color: #ff9500; }
  .card .value.blue { color: #007aff; }

  .alert-box { background: #fff2f2; border: 1px solid #ffcdd2; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; }
  .alert-box h3 { color: #ff3b30; font-size: 14px; margin-bottom: 8px; }
  .alert-box p { font-size: 14px; color: #1d1d1f; line-height: 1.6; }

  .section { background: #fff; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .section h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f5f5f7; padding: 10px 12px; text-align: left; font-weight: 600; color: #86868b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; position: sticky; top: 0; }
  td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  td.num { color: #86868b; width: 30px; }
  td.name { font-weight: 600; white-space: nowrap; }
  td.center { text-align: center; }
  td.detail { font-size: 12px; color: #86868b; max-width: 300px; }

  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge.ok { background: #e8f5e9; color: #2e7d32; }
  .badge.fail { background: #ffebee; color: #c62828; }
  .badge.warn { background: #fff3e0; color: #e65100; }

  .fb-given { color: #007aff; font-weight: 600; }
  .fb-recv { color: #86868b; }
  .text-muted { color: #ccc; }

  tr.row-danger { background: #fff5f5; }
  tr.row-warn { background: #fffdf5; }
  tr:hover { background: #f0f4ff !important; }

  .mini-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .mini-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .mini-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
  .mini-card ul { list-style: none; font-size: 13px; line-height: 2; }
  .mini-card ul li::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 8px; vertical-align: middle; }
  .mini-card.red-list ul li::before { background: #ff3b30; }
  .mini-card.blue-list ul li::before { background: #007aff; }

  .timestamp { text-align: center; color: #86868b; font-size: 12px; margin-top: 32px; }
</style>
</head>
<body>
<div class="container">
  <h1>2026년 3월 에디터 활동 현황</h1>
  <p class="subtitle">대상 ${report.length}명 · Slack 기획안 + 피드백 + Ghost CMS 전수조사 · ${new Date().toISOString().split('T')[0]} 기준</p>

  <div class="cards">
    <div class="card">
      <div class="label">기획안 제출</div>
      <div class="value green">${submitted}<span style="font-size:18px;color:#86868b">/${report.length}</span></div>
    </div>
    <div class="card">
      <div class="label">기획안 미제출</div>
      <div class="value red">${notSubmitted}</div>
    </div>
    <div class="card">
      <div class="label">Ghost 아티클 발행</div>
      <div class="value green">${hasGhost}</div>
    </div>
    <div class="card">
      <div class="label">총 피드백 댓글</div>
      <div class="value blue">${totalFeedback}</div>
    </div>
  </div>

  ${zeroActivity.length > 0 ? `
  <div class="alert-box">
    <h3>완전 무활동 에디터 (${zeroActivity.length}명)</h3>
    <p>기획안 미제출 + Ghost 아티클 없음 + 피드백 0건: <strong>${zeroList}</strong></p>
  </div>` : ''}

  <div class="mini-grid">
    <div class="mini-card red-list">
      <h3>기획안 미제출 (${notSubmitted}명)</h3>
      <ul>${report.filter(r => !r.planningSubmitted).map(r => `<li>${r.name}</li>`).join('')}</ul>
    </div>
    <div class="mini-card red-list">
      <h3>Ghost 아티클 없음 (${report.filter(r => r.ghostTotal === 0).length}명)</h3>
      <ul>${report.filter(r => r.ghostTotal === 0).map(r => `<li>${r.name}</li>`).join('')}</ul>
    </div>
  </div>

  <div class="mini-grid">
    <div class="mini-card blue-list">
      <h3>피드백 활발 TOP 10</h3>
      <ul>${topFeeders.map(r => `<li>${r.name} — 남긴 ${r.feedbackGiven}건 / 받은 ${r.feedbackReceived}건</li>`).join('')}</ul>
    </div>
    <div class="mini-card red-list">
      <h3>기획안 제출 + 피드백 0건</h3>
      <ul>${report.filter(r => r.planningSubmitted && r.feedbackGiven === 0).map(r => `<li>${r.name} (받은 댓글 ${r.feedbackReceived}건)</li>`).join('') || '<li style="color:#86868b">해당 없음</li>'}</ul>
    </div>
  </div>

  <div class="section">
    <h2>전체 상세 현황</h2>
    <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>에디터</th>
          <th>기획안</th>
          <th>제출일</th>
          <th>채널</th>
          <th>피드백 (남긴/받은)</th>
          <th>Ghost</th>
          <th>최종수정</th>
          <th>아티클 상세</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    </div>
  </div>

  <p class="timestamp">생성: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
</div>
</body>
</html>`
}

async function main() {
  const slackData = await collectSlackData()
  const ghostPosts = await collectGhostData()
  const report = buildReport(slackData, ghostPosts)

  const html = generateHTML(report)
  const outPath = '/tmp/march-editor-audit-2026.html'
  fs.writeFileSync(outPath, html)
  console.log(`\nHTML 저장: ${outPath}`)

  // Also save JSON
  fs.writeFileSync('/tmp/march-audit-2026.json', JSON.stringify(report, null, 2))
}

main().catch(e => { console.error('오류:', e); process.exit(1) })
