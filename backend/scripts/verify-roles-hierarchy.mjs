const BASE_URL = 'http://localhost:4000/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { status: res.status, ok: res.ok, data }
}

async function login(email, password = 'Demo@1234') {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`)
  }
  return res.data.data.accessToken
}

async function run() {
  console.log('=== STARTING ROLE HIERARCHY & REGISTRATION VERIFICATION ===\n')

  // Step 1: Student Self-Registration (Approach B)
  console.log('[Test 1] Testing Student Self-Registration (/api/auth/register)...')
  const uniqueRoll = `STU-REG-${Date.now().toString().slice(-5)}`
  const studentEmail = `newstudent_${Date.now().toString().slice(-4)}@univ.edu`

  // Get a department and program
  const deptRes = await request('/departments')
  const cseDept = deptRes.data.data.find((d) => d.code === 'CSE') || deptRes.data.data[0]
  const progRes = await request('/programs')
  const cseProg = progRes.data.data.find((p) => p.departmentId === cseDept.id) || progRes.data.data[0]

  const regRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Rohan Sharma',
      email: studentEmail,
      password: 'MyPassword@123',
      studentId: uniqueRoll,
      programId: cseProg.id,
      year: 2,
    }),
  })

  if (regRes.status !== 201) {
    throw new Error(`Self-registration failed: ${JSON.stringify(regRes.data)}`)
  }
  console.log('  ✓ Self-registration successful! User role:', regRes.data.data.user.role)

  // Test newly registered student login & auth me
  const studentToken = regRes.data.data.accessToken
  const meRes = await request('/auth/me', {
    headers: { Authorization: `Bearer ${studentToken}` },
  })
  console.log('  ✓ Auth /me verified for registered student:', meRes.data.data.email, meRes.data.data.role)

  // Step 2: Super Admin adds HOD
  console.log('\n[Test 2] Testing Admin adding HOD...')
  const adminToken = await login('aarav.kulkarni@rulecraft.edu')
  const newHodEmail = `newhod_${Date.now().toString().slice(-4)}@univ.edu`
  const createHodRes = await request('/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Dr. Vikramaditya',
      email: newHodEmail,
      role: 'hod',
      departmentId: cseDept.id,
    }),
  })
  if (createHodRes.status !== 201) {
    throw new Error(`Admin adding HOD failed: ${JSON.stringify(createHodRes.data)}`)
  }
  console.log('  ✓ Admin created HOD:', createHodRes.data.data.user.email, 'Temp password:', createHodRes.data.data.tempPassword)
  const hodTempPassword = createHodRes.data.data.tempPassword

  // Step 3: HOD adds Faculty in their own department
  console.log('\n[Test 3] Testing HOD adding Faculty in their own department...')
  const hodToken = await login(newHodEmail, hodTempPassword)
  const newFacultyEmail = `newfac_${Date.now().toString().slice(-4)}@univ.edu`
  const createFacRes = await request('/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${hodToken}` },
    body: JSON.stringify({
      name: 'Prof. Ananya Sen',
      email: newFacultyEmail,
      role: 'faculty',
      departmentId: cseDept.id,
    }),
  })
  if (createFacRes.status !== 201) {
    throw new Error(`HOD adding Faculty failed: ${JSON.stringify(createFacRes.data)}`)
  }
  console.log('  ✓ HOD successfully added Faculty:', createFacRes.data.data.user.email, 'Department:', createFacRes.data.data.user.department)

  // Step 4: Security test: HOD CANNOT add another HOD or Admin
  console.log('\n[Test 4] Testing Security: HOD attempting to add another HOD (should be 403 Forbidden)...')
  const forbidHodRes = await request('/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${hodToken}` },
    body: JSON.stringify({
      name: 'Rival HOD',
      email: `rivalhod_${Date.now()}@univ.edu`,
      role: 'hod',
      departmentId: cseDept.id,
    }),
  })
  if (forbidHodRes.status === 403) {
    console.log('  ✓ Security check PASSED! HOD received 403 Forbidden as expected:', forbidHodRes.data.message)
  } else {
    throw new Error(`Expected 403 Forbidden but got ${forbidHodRes.status}: ${JSON.stringify(forbidHodRes.data)}`)
  }

  // Step 5: HOD adds Student & Auto-provisioning creates linked login
  console.log('\n[Test 5] Testing HOD adding Student & Auto-provisioning user login...')
  const staffStudentRoll = `CS-STU-${Date.now().toString().slice(-5)}`
  const staffStudentEmail = `cs_student_${Date.now().toString().slice(-4)}@univ.edu`
  const createStudentRes = await request('/students', {
    method: 'POST',
    headers: { Authorization: `Bearer ${hodToken}` },
    body: JSON.stringify({
      name: 'Pooja Patel',
      email: staffStudentEmail,
      studentId: staffStudentRoll,
      programId: cseProg.id,
      year: 1,
      status: 'active',
      gpa: 8.4,
    }),
  })
  if (createStudentRes.status !== 201) {
    throw new Error(`HOD adding student failed: ${JSON.stringify(createStudentRes.data)}`)
  }
  console.log('  ✓ HOD successfully created student:', createStudentRes.data.data.studentId, createStudentRes.data.data.name)

  // Step 6: Verify Student can immediately log in with default credentials (Demo@1234)
  console.log('\n[Test 6] Testing Login with auto-provisioned student account (Demo@1234)...')
  const autoStudentToken = await login(staffStudentEmail, 'Demo@1234')
  const autoStudentMe = await request('/auth/me', {
    headers: { Authorization: `Bearer ${autoStudentToken}` },
  })
  console.log('  ✓ Auto-provisioned student successfully logged in!')
  console.log('  ✓ Verified identity:', autoStudentMe.data.data.name, `(${autoStudentMe.data.data.role})`)

  console.log('\n========================================')
  console.log('🎉 ALL HIERARCHY & REGISTRATION TESTS PASSED!')
  console.log('========================================')
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.message)
  process.exit(1)
})
