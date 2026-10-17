import http from 'node:http'

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data })
        }
      })
    })
    req.on('error', reject)
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body))
    }
    req.end()
  })
}

async function run() {
  console.log('--- 1. Login as Faculty ---')
  const loginRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'sanjay.verma@rulecraft.edu', password: 'Demo@1234' }
  )

  const token = loginRes.data?.data?.accessToken
  if (!token) {
    console.error('Login failed:', loginRes.data)
    process.exit(1)
  }
  console.log('✅ Faculty logged in:', loginRes.data.data.user.name)

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  console.log('\n--- 2. Test Faculty Gradebook Matrix (GET) ---')
  const gbRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/results/gradebook',
    method: 'GET',
    headers: authHeaders,
  })

  if (gbRes.status !== 200 || !gbRes.data.success) {
    console.error('Gradebook GET failed:', gbRes.data)
    process.exit(1)
  }

  const { selectedProgram, selectedSemester, selectedSubject, students } = gbRes.data.data
  console.log(`✅ Gradebook matrix fetched:`)
  console.log(`   Program: ${selectedProgram?.name} (${selectedProgram?.code})`)
  console.log(`   Semester: ${selectedSemester?.name}`)
  console.log(`   Subject: ${selectedSubject?.code} - ${selectedSubject?.name}`)
  console.log(`   Enrolled students: ${students.length}`)

  if (students.length > 0) {
    const targetStudent = students[0]
    console.log(`\n--- 3. Test Saving Gradebook Marks (POST) ---`)
    console.log(`   Student: ${targetStudent.studentName} (${targetStudent.studentCode})`)
    console.log(`   Setting marks: Internal=28/30, MidSem=18/20, EndSem=46/50 (Total=92, Grade=O)`)

    const saveRes = await request(
      {
        hostname: 'localhost',
        port: 4000,
        path: '/api/results/gradebook/save',
        method: 'POST',
        headers: authHeaders,
      },
      {
        programId: selectedProgram.id,
        semesterId: selectedSemester.id,
        subjectCode: selectedSubject.code,
        subjectName: selectedSubject.name,
        entries: [
          {
            studentId: targetStudent.studentId,
            internalMarks: 28,
            midSemMarks: 18,
            endSemMarks: 46,
          },
        ],
        submitForModeration: false,
      }
    )

    if (saveRes.status !== 200 || !saveRes.data.success) {
      console.error('Gradebook save failed:', saveRes.data)
      process.exit(1)
    }
    console.log(`✅ Gradebook marks successfully saved: ${saveRes.data.message}`)
  }

  console.log('\n--- 4. Test University Rank List & Honors Board (GET) ---')
  const ranksRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/results/ranks',
    method: 'GET',
    headers: authHeaders,
  })

  if (ranksRes.status !== 200 || !ranksRes.data.success) {
    console.error('Ranks GET failed:', ranksRes.data)
    process.exit(1)
  }

  const { stats, students: rankedStudents } = ranksRes.data.data
  console.log(`✅ University rankings calculated:`)
  console.log(`   Total evaluated: ${stats.totalEvaluated}`)
  console.log(`   Highest CGPA: ${stats.highestCgpa.toFixed(2)}`)
  console.log(`   Median CGPA: ${stats.medianCgpa.toFixed(2)}`)
  console.log(`   Dean's Honor Roll count: ${stats.deansListCount}`)
  console.log(`   Probation count: ${stats.probationCount}`)

  console.log('\n--- Podium Top 3 Medalists: ---')
  stats.topThree.forEach((t) => {
    console.log(`   [${t.medal.toUpperCase()} # ${t.rank}] ${t.name} (${t.studentId}) - CGPA: ${t.cgpa.toFixed(2)} [${t.programName}]`)
  })

  console.log('\n--- 5. Test Rank List CSV Export (GET) ---')
  const exportRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/results/ranks/export',
    method: 'GET',
    headers: authHeaders,
  })

  if (exportRes.status !== 200 || typeof exportRes.data !== 'string') {
    console.error('Export CSV failed:', exportRes.data)
    process.exit(1)
  }
  const lines = exportRes.data.trim().split('\n')
  console.log(`✅ CSV generated successfully (${lines.length} lines):`)
  console.log(`   Header: ${lines[0]}`)
  if (lines[1]) console.log(`   Row 1:  ${lines[1]}`)

  console.log('\n🎉 ALL THREE FEATURES (1, 2, 4) VERIFIED & OPERATIONAL!')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
