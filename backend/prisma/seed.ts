/**
 * seed.ts
 * Populates the database with the same demo dataset the frontend's mock
 * (frontend/src/services/mockData.ts) was built against, plus one login per
 * role. Running `npm run db:seed` after a fresh migrate gives an
 * immediately explorable, realistic database — no "Lorem Ipsum University."
 */
import { prisma } from '../src/config/prisma'
import { logger } from '../src/utils/logger'
import { hashPassword } from '../src/utils/password'

const DEMO_PASSWORD = 'Demo@1234'

async function main() {
  logger.info('Seeding database...')
  const passwordHash = await hashPassword(DEMO_PASSWORD)

  // --- Departments ---
  const cse = await prisma.department.create({ data: { name: 'Computer Science', code: 'CSE' } })
  const ece = await prisma.department.create({ data: { name: 'Electronics', code: 'ECE' } })
  const me = await prisma.department.create({ data: { name: 'Mechanical Engineering', code: 'ME' } })
  const ce = await prisma.department.create({ data: { name: 'Civil Engineering', code: 'CE' } })

  // --- Programs ---
  const btcs = await prisma.program.create({ data: { name: 'B.Tech Computer Science', code: 'BTCS', departmentId: cse.id, years: 4 } })
  const mtcs = await prisma.program.create({ data: { name: 'M.Tech Computer Science', code: 'MTCS', departmentId: cse.id, years: 2 } })
  const bte = await prisma.program.create({ data: { name: 'B.Tech Electronics', code: 'BTE', departmentId: ece.id, years: 4 } })
  const btm = await prisma.program.create({ data: { name: 'B.Tech Mechanical', code: 'BTM', departmentId: me.id, years: 4 } })
  const bce = await prisma.program.create({ data: { name: 'B.Tech Civil', code: 'BCE', departmentId: ce.id, years: 4 } })

  // --- Semesters ---
  const sem1 = await prisma.semester.create({ data: { name: 'Semester 1', programId: btcs.id, year: 1, startDate: new Date('2024-01-08'), endDate: new Date('2024-04-30') } })
  await prisma.semester.create({ data: { name: 'Semester 2', programId: btcs.id, year: 1, startDate: new Date('2024-06-01'), endDate: new Date('2024-09-15') } })
  const sem3 = await prisma.semester.create({ data: { name: 'Semester 3', programId: btcs.id, year: 2, startDate: new Date('2024-01-08'), endDate: new Date('2024-04-30') } })
  await prisma.semester.create({ data: { name: 'Semester 1', programId: bte.id, year: 1, startDate: new Date('2024-01-08'), endDate: new Date('2024-04-30') } })

  // --- Subjects ---
  await prisma.subject.createMany({
    data: [
      { code: 'CS101', name: 'Programming Fundamentals', credits: 4, semesterId: sem1.id },
      { code: 'CS102', name: 'Data Structures', credits: 4, semesterId: sem1.id },
      { code: 'CS201', name: 'Algorithms', credits: 4, semesterId: sem3.id },
      { code: 'CS202', name: 'Database Management', credits: 3, semesterId: sem3.id },
    ],
  })

  // --- Users (one per role) ---
  const superAdmin = await prisma.user.create({
    data: { name: 'Aarav Kulkarni', email: 'aarav.kulkarni@rulecraft.edu', passwordHash, role: 'super_admin', avatarInitials: 'AK' },
  })
  await prisma.user.create({
    data: { name: 'Neha Iyer', email: 'neha.iyer@rulecraft.edu', passwordHash, role: 'registrar', avatarInitials: 'NI' },
  })
  const hod = await prisma.user.create({
    data: { name: 'Dr. Meera Nair', email: 'meera.nair@rulecraft.edu', passwordHash, role: 'hod', departmentId: cse.id, avatarInitials: 'MN' },
  })
  await prisma.user.create({
    data: { name: 'Sanjay Verma', email: 'sanjay.verma@rulecraft.edu', passwordHash, role: 'faculty', departmentId: ece.id, avatarInitials: 'SV' },
  })
  const studentUser = await prisma.user.create({
    data: { name: 'Rajesh Kumar', email: 'rajesh.kumar@university.edu', passwordHash, role: 'student', avatarInitials: 'RK' },
  })

  // --- Students ---
  await prisma.student.create({ data: { name: 'Rajesh Kumar', email: 'rajesh.kumar@university.edu', studentId: 'STU2024001', programId: btcs.id, year: 4, status: 'active', gpa: 3.8, enrollDate: new Date('2020-08-15'), userId: studentUser.id } })
  await prisma.student.create({ data: { name: 'Priya Sharma', email: 'priya.sharma@university.edu', studentId: 'STU2024002', programId: bte.id, year: 3, status: 'active', gpa: 3.6, enrollDate: new Date('2021-08-20') } })
  await prisma.student.create({ data: { name: 'Ananya Patel', email: 'ananya.patel@university.edu', studentId: 'STU2024003', programId: btcs.id, year: 2, status: 'active', gpa: 3.9, enrollDate: new Date('2022-08-10') } })
  const stu4 = await prisma.student.create({ data: { name: 'Arjun Singh', email: 'arjun.singh@university.edu', studentId: 'STU2024004', programId: btm.id, year: 4, status: 'suspended', gpa: 2.1, enrollDate: new Date('2020-08-15') } })
  await prisma.student.create({ data: { name: 'Neha Gupta', email: 'neha.gupta@university.edu', studentId: 'STU2024005', programId: bce.id, year: 1, status: 'active', gpa: 3.7, enrollDate: new Date('2023-08-05') } })
  await prisma.student.create({ data: { name: 'Vikram Rao', email: 'vikram.rao@university.edu', studentId: 'STU2024006', programId: btcs.id, year: 3, status: 'active', gpa: 2.9, enrollDate: new Date('2021-08-20') } })
  await prisma.student.create({ data: { name: 'Ishita Bose', email: 'ishita.bose@university.edu', studentId: 'STU2024007', programId: mtcs.id, year: 1, status: 'graduated', gpa: 3.95, enrollDate: new Date('2019-08-15') } })

  // --- Regulation 1: published, with rules ---
  const reg1 = await prisma.regulation.create({
    data: {
      name: 'Academic Performance Policy 2024',
      code: 'AP-2024-001',
      version: '2.1',
      status: 'published',
      effectiveDate: new Date('2024-01-01'),
      programId: btcs.id,
      description: 'Governs minimum academic performance thresholds for continuation and honors eligibility.',
      versions: {
        create: [
          { version: '1.0', changeSummary: 'Initial publication.', changedById: superAdmin.id, changedAt: new Date('2024-01-01') },
          { version: '2.0', changeSummary: 'Introduced CGPA-based promotion tiers.', changedById: superAdmin.id, changedAt: new Date('2024-03-02') },
          { version: '2.1', changeSummary: 'Adjusted grace-mark cap from 5 to 8 marks.', changedById: superAdmin.id, changedAt: new Date('2024-08-15') },
        ],
      },
      approvalHistory: {
        create: [
          { step: 'submitted', byId: superAdmin.id, at: new Date('2024-07-01T09:00:00Z'), note: 'Initial draft submitted for review.' },
          { step: 'reviewed', byId: hod.id, at: new Date('2024-07-05T11:30:00Z'), note: 'Reviewed, minor clarifications requested.' },
          { step: 'approved', byId: superAdmin.id, at: new Date('2024-07-12T14:00:00Z') },
          { step: 'published', byId: superAdmin.id, at: new Date('2024-07-15T08:00:00Z') },
        ],
      },
    },
  })
  await prisma.rule.create({
    data: {
      regulationId: reg1.id,
      name: 'Minimum semester attendance',
      type: 'attendance',
      outcome: 'Eligible to sit for semester exams',
      active: true,
      conditions: { create: [{ field: 'attendancePercent', operator: 'gte', value: '75' }] },
    },
  })
  await prisma.rule.create({
    data: {
      regulationId: reg1.id,
      name: 'Minimum passing marks per subject',
      type: 'passing',
      outcome: 'Subject marked as passed',
      active: true,
      conditions: { create: [{ field: 'subjectMarks', operator: 'gte', value: '40' }] },
    },
  })
  await prisma.rule.create({
    data: {
      regulationId: reg1.id,
      name: 'Grace marks cap',
      type: 'grace_marks',
      outcome: 'Up to 8 grace marks applied per subject',
      active: true,
      conditions: { create: [{ field: 'shortfallMarks', operator: 'lte', value: '8' }] },
    },
  })

  // --- Regulation 2: draft ---
  await prisma.regulation.create({
    data: {
      name: 'Attendance Requirement',
      code: 'AR-2024-002',
      version: '1.5',
      status: 'draft',
      effectiveDate: new Date('2024-09-01'),
      programId: bte.id,
      description: 'Defines minimum attendance percentage required for exam eligibility, with medical condonation rules.',
      versions: {
        create: [
          { version: '1.0', changeSummary: 'Initial draft.', changedById: superAdmin.id, changedAt: new Date('2024-06-01') },
          { version: '1.5', changeSummary: 'Added medical condonation clause.', changedById: superAdmin.id, changedAt: new Date('2024-08-20') },
        ],
      },
      approvalHistory: {
        create: [{ step: 'submitted', byId: superAdmin.id, at: new Date('2024-08-20T09:00:00Z'), note: 'Draft created, not yet submitted.' }],
      },
      rules: {
        create: [
          {
            name: 'Attendance shortfall condonation',
            type: 'attendance',
            outcome: 'Condoned to eligible with HOD approval',
            active: false,
            conditions: {
              create: [
                { field: 'attendancePercent', operator: 'gte', value: '65' },
                { field: 'medicalCertificate', operator: 'eq', value: 'true' },
              ],
            },
          },
        ],
      },
    },
  })

  // --- Regulation 3: published, with rules used by the simulator's not-eligible demo ---
  const reg3 = await prisma.regulation.create({
    data: {
      name: 'Promotion and Continuation Policy',
      code: 'PC-2024-003',
      version: '3.0',
      status: 'published',
      effectiveDate: new Date('2024-01-15'),
      programId: btm.id,
      description: 'Rules for year-to-year promotion, backlog (ATKT) limits, and re-admission criteria.',
      versions: { create: [{ version: '3.0', changeSummary: 'Backlog cap raised from 3 to 4 subjects.', changedById: hod.id, changedAt: new Date('2024-07-10') }] },
      approvalHistory: {
        create: [
          { step: 'submitted', byId: superAdmin.id, at: new Date('2024-07-01T09:00:00Z') },
          { step: 'reviewed', byId: hod.id, at: new Date('2024-07-05T11:30:00Z') },
          { step: 'approved', byId: superAdmin.id, at: new Date('2024-07-12T14:00:00Z') },
          { step: 'published', byId: superAdmin.id, at: new Date('2024-07-15T08:00:00Z') },
        ],
      },
    },
  })
  const backlogRule = await prisma.rule.create({
    data: {
      regulationId: reg3.id,
      name: 'Backlog limit for promotion',
      type: 'backlog',
      outcome: 'Promoted to next year with active backlog',
      active: true,
      conditions: { create: [{ field: 'activeBacklogs', operator: 'lte', value: '4' }] },
    },
  })
  const cgpaRule = await prisma.rule.create({
    data: {
      regulationId: reg3.id,
      name: 'CGPA threshold for promotion',
      type: 'promotion',
      outcome: 'Eligible for promotion to next academic year',
      active: true,
      conditions: { create: [{ field: 'cgpa', operator: 'gte', value: '5.0' }] },
    },
  })

  // --- Regulation 4: in review ---
  await prisma.regulation.create({
    data: {
      name: 'Exception Handling Framework',
      code: 'EH-2024-004',
      version: '1.0',
      status: 'review',
      effectiveDate: new Date('2024-10-01'),
      programId: bce.id,
      description: 'Process for handling grace marks, appeals, and manual overrides to automated eligibility decisions.',
      versions: { create: [{ version: '1.0', changeSummary: 'Initial submission for council review.', changedById: superAdmin.id, changedAt: new Date('2024-08-22') }] },
      approvalHistory: {
        create: [
          { step: 'submitted', byId: superAdmin.id, at: new Date('2024-08-18T09:00:00Z') },
          { step: 'reviewed', byId: hod.id, at: new Date('2024-08-21T10:15:00Z'), note: 'Awaiting Academic Council sign-off.' },
        ],
      },
    },
  })

  // --- A pre-existing simulation result, matching the frontend mock ---
  const simulation = await prisma.simulationResult.create({
    data: {
      studentId: stu4.id,
      studentName: 'Arjun Singh',
      regulationId: reg3.id,
      ranById: superAdmin.id,
      ranAt: new Date('2024-08-23T10:00:00Z'),
      outcome: 'not_eligible',
    },
  })
  await prisma.simulationBreakdownItem.createMany({
    data: [
      { simulationResultId: simulation.id, ruleName: backlogRule.name, passed: false, detail: '5 active backlogs, limit is 4.' },
      { simulationResultId: simulation.id, ruleName: cgpaRule.name, passed: false, detail: 'CGPA 2.1, requires 5.0.' },
    ],
  })

  // --- Notifications ---
  await prisma.notification.createMany({
    data: [
      { recipientId: superAdmin.id, title: 'Regulation 2025.1 published', detail: 'Academic Council approved Academic Performance Policy 2024 v2.1.', tone: 'teal', read: false },
      { recipientId: superAdmin.id, title: 'New exception requires review', detail: 'B.Tech Computer Science — grace marks request pending.', tone: 'coral', read: false },
      { recipientId: superAdmin.id, title: 'Eligibility simulation completed', detail: 'Batch 2022 what-if run finished with 3 flagged students.', tone: 'blue', read: false },
      { recipientId: superAdmin.id, title: 'Attendance Requirement moved to draft', detail: 'Version 1.5 saved by Aarav Kulkarni.', tone: 'amber', read: true },
    ],
  })

  logger.info('Seed complete', {
    users: 5,
    departments: 4,
    programs: 5,
    students: 7,
    regulations: 4,
    demoPassword: DEMO_PASSWORD,
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    logger.error('Seed failed', { message: err instanceof Error ? err.message : String(err) })
    await prisma.$disconnect()
    process.exit(1)
  })
