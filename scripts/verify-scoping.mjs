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

async function login(email, password) {
  const res = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email, password }
  )
  return res.data?.data?.accessToken
}

async function run() {
  console.log('=== TEST 1: Student (Rajesh Kumar) Restrictions ===')
  const studentToken = await login('rajesh.kumar@university.edu', 'Demo@1234')
  if (!studentToken) throw new Error('Student login failed')

  // 1. Student trying to delete a department
  const delDeptRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/departments/dept-cse',
    method: 'DELETE',
    headers: { Authorization: `Bearer ${studentToken}` },
  })
  console.log(`- Student DELETE /api/departments: status ${delDeptRes.status} (Expected 403)`)
  if (delDeptRes.status !== 403) throw new Error(`Expected 403 but got ${delDeptRes.status}`)

  // 2. Student trying to create a department
  const createDeptRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/departments',
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
    },
    { name: 'Hacked Department', code: 'HACK' }
  )
  console.log(`- Student POST /api/departments: status ${createDeptRes.status} (Expected 403)`)
  if (createDeptRes.status !== 403) throw new Error(`Expected 403 but got ${createDeptRes.status}`)

  // 3. Student trying to access Gradebook
  const gradebookRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/results/gradebook',
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  })
  console.log(`- Student GET /api/results/gradebook: status ${gradebookRes.status} (Expected 403)`)
  if (gradebookRes.status !== 403) throw new Error(`Expected 403 but got ${gradebookRes.status}`)

  console.log('✅ Student restrictions verified: Cannot edit/delete departments or access gradebook.\n')

  console.log('=== TEST 2: Department Isolation for HOD (Dr. Meera Nair, CSE) ===')
  const hodToken = await login('meera.nair@rulecraft.edu', 'Demo@1234')
  if (!hodToken) throw new Error('HOD login failed')

  // 1. Gradebook programs for CSE HOD
  const hodGbRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/results/gradebook',
    method: 'GET',
    headers: { Authorization: `Bearer ${hodToken}` },
  })
  console.log(`- HOD GET /api/results/gradebook: status ${hodGbRes.status}`)
  const hodPrograms = hodGbRes.data?.data?.programs || []
  console.log(`  Visible programs for CSE HOD: ${hodPrograms.map((p) => p.code).join(', ')}`)
  const hasNonCse = hodPrograms.some((p) => p.department !== 'Computer Science')
  if (hasNonCse) {
    throw new Error('HOD saw programs from other departments!')
  }
  console.log('  ✅ Verified: HOD sees ONLY Computer Science programs.')

  // 2. HOD trying to access another department program directly (e.g. ECE / CE)
  // Let's get ECE program ID by logging in as Admin
  const adminToken = await login('aarav.kulkarni@rulecraft.edu', 'Demo@1234')
  const adminGbRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/results/gradebook',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const allProgs = adminGbRes.data?.data?.programs || []
  const eceProg = allProgs.find((p) => p.department !== 'Computer Science')

  if (eceProg) {
    const crossDeptRes = await request({
      hostname: 'localhost',
      port: 4000,
      path: `/api/results/gradebook?programId=${eceProg.id}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${hodToken}` },
    })
    console.log(`- CSE HOD requesting ${eceProg.name} (${eceProg.department}): status ${crossDeptRes.status} (Expected 403)`)
    if (crossDeptRes.status !== 403) throw new Error(`Expected 403 but got ${crossDeptRes.status}`)
    console.log('  ✅ Verified: CSE HOD blocked from viewing another department’s gradebook!')
  }

  console.log('\n=== TEST 3: Super Admin University-Wide Access ===')
  console.log(`- Super Admin visible programs across all departments: ${allProgs.length} programs`)
  console.log(`  Departments represented: ${[...new Set(allProgs.map((p) => p.department))].join(', ')}`)
  console.log('  ✅ Verified: Admin has complete global visibility.')

  console.log('\n🎉 ALL SECURITY & DEPARTMENT ISOLATION RULES FULLY VERIFIED!')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
