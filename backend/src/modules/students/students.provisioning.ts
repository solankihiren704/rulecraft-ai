import { prisma } from '@/config/prisma'
import type { ImportStudentRow } from './students.validators'

export interface AutoProvisionSummary {
  departments: string[]
  programs: string[]
  semestersCount: number
  subjectsCount: number
}

interface StandardBranchCatalog {
  deptCode: string
  deptName: string
  progName: string
  subjectsPerSemester: Record<number, { code: string; name: string; credits: number }[]>
}

const BRANCH_CATALOG: Record<string, StandardBranchCatalog> = {
  ME: {
    deptCode: 'ME',
    deptName: 'Mechanical Engineering',
    progName: 'B.Tech Mechanical Engineering',
    subjectsPerSemester: {
      1: [
        { code: 'ME101', name: 'Engineering Mathematics I', credits: 4 },
        { code: 'ME102', name: 'Engineering Physics', credits: 4 },
        { code: 'ME103', name: 'Basic Electrical Engineering', credits: 3 },
        { code: 'ME104', name: 'Engineering Graphics & CAD', credits: 3 },
      ],
      2: [
        { code: 'ME201', name: 'Engineering Mathematics II', credits: 4 },
        { code: 'ME202', name: 'Engineering Chemistry', credits: 4 },
        { code: 'ME203', name: 'Engineering Mechanics', credits: 3 },
        { code: 'ME204', name: 'Python for Engineers', credits: 3 },
      ],
      3: [
        { code: 'ME301', name: 'Thermodynamics', credits: 4 },
        { code: 'ME302', name: 'Fluid Mechanics', credits: 4 },
        { code: 'ME303', name: 'Kinematics of Machinery', credits: 3 },
        { code: 'ME304', name: 'Materials Science & Metallurgy', credits: 3 },
      ],
      4: [
        { code: 'ME401', name: 'Applied Thermodynamics', credits: 4 },
        { code: 'ME402', name: 'Strength of Materials', credits: 4 },
        { code: 'ME403', name: 'Manufacturing Processes', credits: 3 },
        { code: 'ME404', name: 'Machine Drawing', credits: 3 },
      ],
      5: [
        { code: 'ME501', name: 'Design of Machine Elements', credits: 4 },
        { code: 'ME502', name: 'Heat and Mass Transfer', credits: 4 },
        { code: 'ME503', name: 'Dynamics of Machinery', credits: 3 },
        { code: 'ME504', name: 'Metrology and Measurements', credits: 3 },
      ],
      6: [
        { code: 'ME601', name: 'Computer Aided Manufacturing', credits: 4 },
        { code: 'ME602', name: 'Automobile Engineering', credits: 4 },
        { code: 'ME603', name: 'Finite Element Analysis', credits: 3 },
        { code: 'ME604', name: 'Industrial Management', credits: 3 },
      ],
      7: [
        { code: 'ME701', name: 'Refrigeration and Air Conditioning', credits: 4 },
        { code: 'ME702', name: 'Power Plant Engineering', credits: 4 },
        { code: 'ME703', name: 'Operations Research', credits: 3 },
        { code: 'ME704', name: 'Department Elective I', credits: 3 },
      ],
      8: [
        { code: 'ME801', name: 'Major Capstone Project', credits: 6 },
        { code: 'ME802', name: 'Robotics and Automation', credits: 4 },
        { code: 'ME803', name: 'Product Lifecycle Management', credits: 3 },
        { code: 'ME804', name: 'Technical Seminar & Viva', credits: 2 },
      ],
    },
  },
  BTME: {
    deptCode: 'ME',
    deptName: 'Mechanical Engineering',
    progName: 'B.Tech Mechanical Engineering',
    subjectsPerSemester: {}, // inherits ME
  },
  CE: {
    deptCode: 'CE',
    deptName: 'Civil Engineering',
    progName: 'B.Tech Civil Engineering',
    subjectsPerSemester: {
      1: [
        { code: 'CE101', name: 'Engineering Mathematics I', credits: 4 },
        { code: 'CE102', name: 'Engineering Physics', credits: 4 },
        { code: 'CE103', name: 'Engineering Mechanics', credits: 3 },
        { code: 'CE104', name: 'Surveying Fundamentals', credits: 3 },
      ],
      2: [
        { code: 'CE201', name: 'Engineering Mathematics II', credits: 4 },
        { code: 'CE202', name: 'Building Materials & Construction', credits: 4 },
        { code: 'CE203', name: 'Fluid Mechanics', credits: 3 },
        { code: 'CE204', name: 'Environmental Studies', credits: 3 },
      ],
      3: [
        { code: 'CE301', name: 'Structural Analysis I', credits: 4 },
        { code: 'CE302', name: 'Geotechnical Engineering', credits: 4 },
        { code: 'CE303', name: 'Advanced Surveying', credits: 3 },
        { code: 'CE304', name: 'Concrete Technology', credits: 3 },
      ],
      4: [
        { code: 'CE401', name: 'Design of Concrete Structures', credits: 4 },
        { code: 'CE402', name: 'Hydrology & Water Resources', credits: 4 },
        { code: 'CE403', name: 'Transportation Engineering I', credits: 3 },
        { code: 'CE404', name: 'Structural Analysis II', credits: 3 },
      ],
    },
  },
  BTCE: {
    deptCode: 'CE',
    deptName: 'Civil Engineering',
    progName: 'B.Tech Civil Engineering',
    subjectsPerSemester: {},
  },
  EE: {
    deptCode: 'EE',
    deptName: 'Electrical Engineering',
    progName: 'B.Tech Electrical Engineering',
    subjectsPerSemester: {
      1: [
        { code: 'EE101', name: 'Engineering Mathematics I', credits: 4 },
        { code: 'EE102', name: 'Circuit Theory & Analysis', credits: 4 },
        { code: 'EE103', name: 'Basic Electronics', credits: 3 },
        { code: 'EE104', name: 'Electrical Workshop', credits: 3 },
      ],
      2: [
        { code: 'EE201', name: 'Engineering Mathematics II', credits: 4 },
        { code: 'EE202', name: 'Electromagnetic Fields', credits: 4 },
        { code: 'EE203', name: 'Electrical Machines I', credits: 3 },
        { code: 'EE204', name: 'Signals & Systems', credits: 3 },
      ],
      3: [
        { code: 'EE301', name: 'Electrical Machines II', credits: 4 },
        { code: 'EE302', name: 'Power Systems I', credits: 4 },
        { code: 'EE303', name: 'Control Systems', credits: 3 },
        { code: 'EE304', name: 'Analog Electronics', credits: 3 },
      ],
      4: [
        { code: 'EE401', name: 'Power Electronics', credits: 4 },
        { code: 'EE402', name: 'Power Systems II', credits: 4 },
        { code: 'EE403', name: 'Microprocessors & Microcontrollers', credits: 3 },
        { code: 'EE404', name: 'Digital Signal Processing', credits: 3 },
      ],
    },
  },
  BTEE: {
    deptCode: 'EE',
    deptName: 'Electrical Engineering',
    progName: 'B.Tech Electrical Engineering',
    subjectsPerSemester: {},
  },
  IT: {
    deptCode: 'IT',
    deptName: 'Information Technology',
    progName: 'B.Tech Information Technology',
    subjectsPerSemester: {
      1: [
        { code: 'IT101', name: 'Programming in C/C++', credits: 4 },
        { code: 'IT102', name: 'Discrete Mathematics', credits: 4 },
        { code: 'IT103', name: 'Digital Logic Design', credits: 3 },
        { code: 'IT104', name: 'Web Technologies I', credits: 3 },
      ],
      2: [
        { code: 'IT201', name: 'Data Structures & Algorithms', credits: 4 },
        { code: 'IT202', name: 'Object Oriented Programming', credits: 4 },
        { code: 'IT203', name: 'Computer Organization', credits: 3 },
        { code: 'IT204', name: 'Software Engineering', credits: 3 },
      ],
    },
  },
  AIML: {
    deptCode: 'AI',
    deptName: 'Artificial Intelligence & Machine Learning',
    progName: 'B.Tech Artificial Intelligence & ML',
    subjectsPerSemester: {
      1: [
        { code: 'AI101', name: 'Linear Algebra for Machine Learning', credits: 4 },
        { code: 'AI102', name: 'Python for Data Science', credits: 4 },
        { code: 'AI103', name: 'Data Structures with Python', credits: 3 },
        { code: 'AI104', name: 'Discrete Computational Structures', credits: 3 },
      ],
      2: [
        { code: 'AI201', name: 'Probability & Statistics for AI', credits: 4 },
        { code: 'AI202', name: 'Supervised Machine Learning', credits: 4 },
        { code: 'AI203', name: 'Neural Networks & Deep Learning', credits: 3 },
        { code: 'AI204', name: 'Database Management for AI', credits: 3 },
      ],
    },
  },
}

function resolveBranchInfo(code: string, candidateRow?: ImportStudentRow) {
  const upper = code.trim().toUpperCase()
  const known = BRANCH_CATALOG[upper]

  if (known) {
    const parent = known.deptCode === 'ME' ? BRANCH_CATALOG.ME : known.deptCode === 'CE' ? BRANCH_CATALOG.CE : known.deptCode === 'EE' ? BRANCH_CATALOG.EE : known
    return {
      deptCode: candidateRow?.departmentCode?.toUpperCase() || known.deptCode,
      deptName: candidateRow?.departmentName || known.deptName,
      progName: candidateRow?.programName || known.progName,
      progCode: upper,
      curriculum: parent.subjectsPerSemester || known.subjectsPerSemester,
    }
  }

  // Generic fallback if unknown code is provided
  const deptCode = candidateRow?.departmentCode?.toUpperCase() || upper.replace(/^BT/, '') || upper
  const deptName = candidateRow?.departmentName || `${deptCode} Engineering & Technology`
  const progName = candidateRow?.programName || `Bachelor of Technology in ${upper}`

  return {
    deptCode,
    deptName,
    progName,
    progCode: upper,
    curriculum: {},
  }
}

/**
 * Auto-provisions missing Departments, Programs, Semesters, Subjects,
 * and active Regulations during bulk Student Excel Import.
 */
export async function autoProvisionAcademicStructure(
  unresolvedCodes: string[],
  validRows: { data: ImportStudentRow }[],
): Promise<{
  createdPrograms: Map<string, { id: string; name: string; code: string; departmentId: string }>
  summary: AutoProvisionSummary
}> {
  const createdPrograms = new Map<string, { id: string; name: string; code: string; departmentId: string }>()
  const summary: AutoProvisionSummary = {
    departments: [],
    programs: [],
    semestersCount: 0,
    subjectsCount: 0,
  }

  for (const progCode of unresolvedCodes) {
    const candidate = validRows.find((r) => r.data.programCode === progCode)?.data
    const info = resolveBranchInfo(progCode, candidate)

    // 1. Resolve or Create Department
    let dept = await prisma.department.findFirst({
      where: {
        OR: [{ code: info.deptCode }, { name: { equals: info.deptName, mode: 'insensitive' } }],
      },
    })

    if (!dept) {
      dept = await prisma.department.create({
        data: {
          name: info.deptName,
          code: info.deptCode,
        },
      })
      summary.departments.push(dept.name)
    }

    // 2. Create Program
    let program = await prisma.program.findFirst({
      where: { code: info.progCode },
    })

    if (!program) {
      program = await prisma.program.create({
        data: {
          name: info.progName,
          code: info.progCode,
          departmentId: dept.id,
          years: 4,
        },
      })
      summary.programs.push(program.name)
    }

    createdPrograms.set(info.progCode, program)

    // 3. Auto-Generate Semesters 1 through 8
    const existingSemesters = await prisma.semester.findMany({
      where: { programId: program.id },
    })

    if (existingSemesters.length === 0) {
      for (let s = 1; s <= 8; s++) {
        const year = Math.ceil(s / 2)
        const isOdd = s % 2 === 1
        const cycleYear = 2024 + Math.floor((s - 1) / 2)
        const startDate = new Date(Date.UTC(cycleYear, isOdd ? 7 : 0, 15)) // Aug or Jan
        const endDate = new Date(Date.UTC(cycleYear, isOdd ? 11 : 4, 30)) // Dec or May

        const semester = await prisma.semester.create({
          data: {
            name: `Semester ${s}`,
            programId: program.id,
            year,
            startDate,
            endDate,
          },
        })
        summary.semestersCount++

        // 4. Auto-Seed Curricular Subjects for this Semester
        const semSubjects =
          info.curriculum[s] ?? [
            { code: `${info.progCode}${s}01`, name: `${info.deptName} Applied Core ${s}`, credits: 4 },
            { code: `${info.progCode}${s}02`, name: `Advanced Analytical Systems ${s}`, credits: 4 },
            { code: `${info.progCode}${s}03`, name: `${info.deptName} Practical Lab ${s}`, credits: 3 },
            { code: `${info.progCode}${s}04`, name: 'Professional Seminar & Innovation', credits: 3 },
          ]

        for (const sub of semSubjects) {
          await prisma.subject.create({
            data: {
              code: sub.code,
              name: sub.name,
              credits: sub.credits,
              semesterId: semester.id,
            },
          })
          summary.subjectsCount++
        }
      }
    }

    // 5. Auto-Generate Official Academic Performance & Promotion Regulation
    const existingReg = await prisma.regulation.findFirst({
      where: { programId: program.id },
    })

    if (!existingReg) {
      const regCode = `REG-${info.progCode}-2024`
      const regulation = await prisma.regulation.create({
        data: {
          name: `${program.name} Academic Policy & Regulation 2024`,
          code: regCode,
          version: '1.0',
          status: 'published',
          effectiveDate: new Date(Date.UTC(2024, 7, 1)),
          programId: program.id,
          description: `Comprehensive automated academic regulation policy covering examination passing, minimum attendance, and semester promotion for ${program.name}.`,
        },
      })

      // Add Standard University Rules
      await prisma.rule.createMany({
        data: [
          {
            regulationId: regulation.id,
            name: 'Minimum semester attendance requirement',
            type: 'attendance',
            outcome: 'eligible',
            active: true,
            conditionTree: {
              type: 'condition',
              field: 'attendancePercent',
              operator: '>=',
              value: '75',
            },
          },
          {
            regulationId: regulation.id,
            name: 'Subject passing marks threshold',
            type: 'passing',
            outcome: 'pass',
            active: true,
            conditionTree: {
              type: 'condition',
              field: 'subjectMarks',
              operator: '>=',
              value: '40',
            },
          },
          {
            regulationId: regulation.id,
            name: 'Grace marks allocation cap',
            type: 'grace_marks',
            outcome: 'pass_with_grace',
            active: true,
            conditionTree: {
              type: 'condition',
              field: 'subjectMarks',
              operator: '>=',
              value: '35',
            },
          },
          {
            regulationId: regulation.id,
            name: 'Yearly academic progression criteria',
            type: 'promotion',
            outcome: 'promoted',
            active: true,
            conditionTree: {
              type: 'condition',
              field: 'activeBacklogs',
              operator: '<=',
              value: '2',
            },
          },
        ],
      })
    }
  }

  return { createdPrograms, summary }
}
