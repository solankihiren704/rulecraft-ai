import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:55432/rulecraft_ai?schema=public'
const adapter = new PrismaPg({ connectionString: DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const PASSWORD = 'Demo@1234'

async function getOrCreateDept(name, code) {
  let dept = await prisma.department.findFirst({ where: { OR: [{ code }, { name }] } })
  if (!dept) {
    dept = await prisma.department.create({ data: { name, code } })
    console.log(`+ Created Department: ${name} (${code})`)
  } else {
    console.log(`= Existing Department: ${dept.name} (${dept.code})`)
  }
  return dept
}

async function getOrCreateProgram(name, code, departmentId, years) {
  let prog = await prisma.program.findFirst({ where: { code } })
  if (!prog) {
    prog = await prisma.program.create({ data: { name, code, departmentId, years } })
    console.log(`  + Created Program: ${name} (${code})`)
  } else {
    console.log(`  = Existing Program: ${prog.name} (${prog.code})`)
  }
  return prog
}

async function getOrCreateUser(name, email, role, departmentId, avatarInitials) {
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10)
    user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        departmentId,
        avatarInitials,
      },
    })
    console.log(`    + Created User [${role.toUpperCase()}]: ${name} <${email}> (Dept ID: ${departmentId})`)
  } else {
    // Ensure department is updated
    if (departmentId && user.departmentId !== departmentId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { departmentId, role },
      })
      console.log(`    ~ Updated User [${role.toUpperCase()}]: ${name} with Dept ID: ${departmentId}`)
    } else {
      console.log(`    = Existing User [${role.toUpperCase()}]: ${name} <${email}>`)
    }
  }
  return user
}

async function getOrCreateStudent(name, email, studentId, programId, year, gpa, status = 'active') {
  let stu = await prisma.student.findFirst({ where: { OR: [{ studentId }, { email }] } })
  if (!stu) {
    // Optionally create a student login User
    const passwordHash = await bcrypt.hash(PASSWORD, 10)
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: 'student',
          avatarInitials: initials,
        },
      })
    }
    stu = await prisma.student.create({
      data: {
        name,
        email,
        studentId,
        programId,
        year,
        gpa,
        status,
        enrollDate: new Date('2023-08-01'),
        userId: user.id,
      },
    })
    console.log(`      + Created Student: ${name} (${studentId}) - Year ${year} (GPA: ${gpa})`)
  } else {
    console.log(`      = Existing Student: ${stu.name} (${stu.studentId})`)
  }
  return stu
}

async function seedSemestersAndSubjects(prog) {
  for (let y = 1; y <= prog.years; y++) {
    for (let semInYear = 1; semInYear <= 2; semInYear++) {
      const semNum = (y - 1) * 2 + semInYear
      const semName = `Semester ${semNum}`
      let sem = await prisma.semester.findFirst({
        where: { programId: prog.id, name: semName },
      })
      if (!sem) {
        sem = await prisma.semester.create({
          data: {
            name: semName,
            programId: prog.id,
            year: y,
            startDate: new Date('2024-01-15'),
            endDate: new Date('2024-05-30'),
          },
        })
        // Add sample subjects
        const codePrefix = prog.code.replace(/[^A-Z]/g, '').slice(0, 3) || 'SUB'
        await prisma.subject.createMany({
          data: [
            { code: `${codePrefix}${semNum}01`, name: `Core Foundations ${semNum}`, credits: 4, semesterId: sem.id },
            { code: `${codePrefix}${semNum}02`, name: `Applied Technology ${semNum}`, credits: 4, semesterId: sem.id },
            { code: `${codePrefix}${semNum}03`, name: `Lab & Practical Workshop ${semNum}`, credits: 3, semesterId: sem.id },
          ],
          skipDuplicates: true,
        })
      }
    }
  }
}

async function main() {
  console.log('--- Seeding Comprehensive Academic Structure, HODs, Faculty, & Students ---')

  // 1. Computer Science & Engineering (CSE)
  const cse = await getOrCreateDept('Computer Science', 'CSE')
  const btcs = await getOrCreateProgram('B.Tech Computer Science', 'BTCS', cse.id, 4)
  const mtcs = await getOrCreateProgram('M.Tech Computer Science', 'MTCS', cse.id, 2)
  await seedSemestersAndSubjects(btcs)
  await seedSemestersAndSubjects(mtcs)
  await getOrCreateUser('Dr. Meera Nair', 'meera.nair@rulecraft.edu', 'hod', cse.id, 'MN')
  await getOrCreateUser('Prof. Devendra Sharma', 'devendra.sharma@rulecraft.edu', 'faculty', cse.id, 'DS')
  await getOrCreateStudent('Rajesh Kumar', 'rajesh.kumar@university.edu', 'STU2024001', btcs.id, 4, 3.8)
  await getOrCreateStudent('Ananya Patel', 'ananya.patel@university.edu', 'STU2024003', btcs.id, 2, 3.9)
  await getOrCreateStudent('Vikram Rao', 'vikram.rao@university.edu', 'STU2024006', btcs.id, 3, 3.1)
  await getOrCreateStudent('Ishita Bose', 'ishita.bose@university.edu', 'STU2024007', mtcs.id, 1, 3.95)

  // 2. Electronics & Communication (ECE)
  const ece = await getOrCreateDept('Electronics', 'ECE')
  const bte = await getOrCreateProgram('B.Tech Electronics', 'BTE', ece.id, 4)
  const mte = await getOrCreateProgram('M.Tech VLSI & Embedded Systems', 'MTE', ece.id, 2)
  await seedSemestersAndSubjects(bte)
  await seedSemestersAndSubjects(mte)
  await getOrCreateUser('Dr. Arvind Swaminathan', 'arvind.swaminathan@rulecraft.edu', 'hod', ece.id, 'AS')
  await getOrCreateUser('Sanjay Verma', 'sanjay.verma@rulecraft.edu', 'faculty', ece.id, 'SV')
  await getOrCreateStudent('Priya Sharma', 'priya.sharma@university.edu', 'STU2024002', bte.id, 3, 3.6)
  await getOrCreateStudent('Rohan Nambiar', 'rohan.nambiar@university.edu', 'STU2024010', bte.id, 2, 3.4)
  await getOrCreateStudent('Tanvi Shah', 'tanvi.shah@university.edu', 'STU2024011', mte.id, 1, 3.85)

  // 3. Information Technology & AI (IT / AI-DS)
  const it = await getOrCreateDept('Information Technology & AI', 'IT')
  const btai = await getOrCreateProgram('B.Tech Artificial Intelligence & Data Science', 'BTAI', it.id, 4)
  const mtai = await getOrCreateProgram('M.Tech Machine Learning & AI', 'MTAI', it.id, 2)
  await seedSemestersAndSubjects(btai)
  await seedSemestersAndSubjects(mtai)
  await getOrCreateUser('Dr. Ramesh Joshi', 'ramesh.joshi@rulecraft.edu', 'hod', it.id, 'RJ')
  await getOrCreateUser('Prof. Sneha Deshmukh', 'sneha.deshmukh@rulecraft.edu', 'faculty', it.id, 'SD')
  await getOrCreateStudent('Aditya Narayan', 'aditya.narayan@university.edu', 'STU2024012', btai.id, 3, 3.75)
  await getOrCreateStudent('Kritika Sen', 'kritika.sen@university.edu', 'STU2024013', btai.id, 1, 3.9)
  await getOrCreateStudent('Harshavardhan Patil', 'harsh.patil@university.edu', 'STU2024014', mtai.id, 2, 3.82)

  // 4. Mechanical Engineering (ME)
  const me = await getOrCreateDept('Mechanical Engineering', 'ME')
  const btm = await getOrCreateProgram('B.Tech Mechanical', 'BTM', me.id, 4)
  const mtrob = await getOrCreateProgram('M.Tech Robotics & Automation', 'MTROB', me.id, 2)
  await seedSemestersAndSubjects(btm)
  await seedSemestersAndSubjects(mtrob)
  await getOrCreateUser('Dr. Pradeep Kulkarni', 'pradeep.kulkarni@rulecraft.edu', 'hod', me.id, 'PK')
  await getOrCreateUser('Prof. Kavita Rao', 'kavita.rao@rulecraft.edu', 'faculty', me.id, 'KR')
  await getOrCreateStudent('Arjun Singh', 'arjun.singh@university.edu', 'STU2024004', btm.id, 4, 2.8)
  await getOrCreateStudent('Siddharth Joshi', 'siddharth.joshi@university.edu', 'STU2024015', btm.id, 2, 3.45)
  await getOrCreateStudent('Varun Chopra', 'varun.chopra@university.edu', 'STU2024016', mtrob.id, 1, 3.7)

  // 5. Civil Engineering (CE)
  const ce = await getOrCreateDept('Civil Engineering', 'CE')
  const bce = await getOrCreateProgram('B.Tech Civil', 'BCE', ce.id, 4)
  const mtse = await getOrCreateProgram('M.Tech Structural Engineering', 'MTSE', ce.id, 2)
  await seedSemestersAndSubjects(bce)
  await seedSemestersAndSubjects(mtse)
  await getOrCreateUser('Dr. Suresh Menon', 'suresh.menon@rulecraft.edu', 'hod', ce.id, 'SM')
  await getOrCreateUser('Prof. Manoj Tiwari', 'manoj.tiwari@rulecraft.edu', 'faculty', ce.id, 'MT')
  await getOrCreateStudent('Neha Gupta', 'neha.gupta@university.edu', 'STU2024005', bce.id, 1, 3.7)
  await getOrCreateStudent('Ayush Khandelwal', 'ayush.k@university.edu', 'STU2024017', bce.id, 3, 3.25)
  await getOrCreateStudent('Pallavi Roy', 'pallavi.roy@university.edu', 'STU2024018', mtse.id, 2, 3.9)

  // 6. Electrical & Electronics Engineering (EEE)
  const eee = await getOrCreateDept('Electrical & Electronics Engineering', 'EEE')
  const btee = await getOrCreateProgram('B.Tech Electrical & Electronics Engineering', 'BTEE', eee.id, 4)
  const mtee = await getOrCreateProgram('M.Tech Smart Power Grids', 'MTEE', eee.id, 2)
  await seedSemestersAndSubjects(btee)
  await seedSemestersAndSubjects(mtee)
  await getOrCreateUser('Dr. Sunita Kulkarni', 'sunita.kulkarni@rulecraft.edu', 'hod', eee.id, 'SK')
  await getOrCreateUser('Prof. Alok Banerjee', 'alok.banerjee@rulecraft.edu', 'faculty', eee.id, 'AB')
  await getOrCreateStudent('Gaurav Mehta', 'gaurav.mehta@university.edu', 'STU2024019', btee.id, 2, 3.55)
  await getOrCreateStudent('Ritu Verma', 'ritu.verma@university.edu', 'STU2024020', btee.id, 4, 3.8)
  await getOrCreateStudent('Kunal Das', 'kunal.das@university.edu', 'STU2024021', mtee.id, 1, 3.65)

  // 7. Management & Business Analytics (DOM)
  const dom = await getOrCreateDept('Management & Business Analytics', 'DOM')
  const mbatm = await getOrCreateProgram('MBA Technology Management', 'MBATM', dom.id, 2)
  const bbaba = await getOrCreateProgram('BBA Business Analytics & FinTech', 'BBABA', dom.id, 3)
  await seedSemestersAndSubjects(mbatm)
  await seedSemestersAndSubjects(bbaba)
  await getOrCreateUser('Dr. Vikram Malhotra', 'vikram.malhotra@rulecraft.edu', 'hod', dom.id, 'VM')
  await getOrCreateUser('Prof. Pooja Sen', 'pooja.sen@rulecraft.edu', 'faculty', dom.id, 'PS')
  await getOrCreateStudent('Shreya Saxena', 'shreya.saxena@university.edu', 'STU2024022', mbatm.id, 2, 3.88)
  await getOrCreateStudent('Nikhil Pandey', 'nikhil.pandey@university.edu', 'STU2024023', bbaba.id, 1, 3.6)
  await getOrCreateStudent('Divya Bhatia', 'divya.bhatia@university.edu', 'STU2024024', bbaba.id, 3, 3.92)

  console.log('\n--- Seed Complete! All 7 Departments, 14 Programs, HODs, Faculty, and Students Ready. ---')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
