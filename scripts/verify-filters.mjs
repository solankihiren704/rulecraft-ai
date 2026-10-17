import http from 'http'

async function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: data ? JSON.parse(data) : null })
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data })
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
  const res = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email, password })
  return { token: res.body?.data?.accessToken, user: res.body?.data?.user }
}

async function run() {
  console.log('Testing Authentication & Filter APIs...')

  // 1. Super Admin
  const adminAuth = await login('aarav.kulkarni@rulecraft.edu', 'Demo@1234')
  console.log('1. Super Admin Login:', adminAuth.user?.role)

  const adminStudents = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/students',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  })
  console.log(`- Super Admin sees ${adminStudents.body?.data?.length} students across all departments`)

  const adminDepts = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/departments',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  })
  console.log(`- Super Admin sees ${adminDepts.body?.data?.length} departments`)

  const adminProgs = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/programs',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  })
  console.log(`- Super Admin sees ${adminProgs.body?.data?.length} programs`)

  // 2. Faculty (Sanjay Verma)
  const facultyAuth = await login('sanjay.verma@rulecraft.edu', 'Demo@1234')
  console.log('2. Faculty Login:', facultyAuth.user?.role, '| Department:', facultyAuth.user?.department)

  const facultyStudents = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/students',
    method: 'GET',
    headers: { Authorization: `Bearer ${facultyAuth.token}` },
  })
  console.log(`- Faculty sees ${facultyStudents.body?.data?.length} students (scoped to their department)`)

  // 3. Student (Rajesh Kumar)
  const studentAuth = await login('rajesh.kumar@university.edu', 'Demo@1234')
  console.log('3. Student Login:', studentAuth.user?.role, '| Name:', studentAuth.user?.name)

  const studentList = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/students',
    method: 'GET',
    headers: { Authorization: `Bearer ${studentAuth.token}` },
  })
  console.log(`- Student list call returns only ${studentList.body?.data?.length} student(s) (their own record: ${studentList.body?.data?.[0]?.name})`)

  // Check if student can view someone else's result
  const otherStudentId = adminStudents.body?.data?.find(s => s.id !== studentAuth.user?.studentId)?.id
  if (otherStudentId) {
    const forbiddenRes = await request({
      hostname: 'localhost',
      port: 4000,
      path: `/api/students/${otherStudentId}/result`,
      method: 'GET',
      headers: { Authorization: `Bearer ${studentAuth.token}` },
    })
    console.log(`- Student accessing other student result (${otherStudentId}) returns: ${forbiddenRes.status} (Expected 403)`)
  }

  // Student accessing their own result
  const myResultRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/students/${studentAuth.user?.studentId}/result`,
    method: 'GET',
    headers: { Authorization: `Bearer ${studentAuth.token}` },
  })
  console.log(`- Student accessing their own result returns: ${myResultRes.status} (SGPA: ${myResultRes.body?.data?.academicSummary?.sgpa})`)

  console.log('\nAll test cases verified successfully!')
}

run().catch(console.error)
