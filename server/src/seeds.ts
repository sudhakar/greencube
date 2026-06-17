/**
 * Seed data — programmatic generation for realistic volume and variety.
 *
 *   employees:       250
 *   departments:       8
 *   offices:          12
 *   productivity:   4500 (250 employees × 18 months)
 *   performance:    1500 (250 employees × ~6 reviews)
 *   pr_events:      2000
 *   teams:            16
 *   employee_teams:  500
 *   skills:           24
 *   employee_skills: 1500
 */

import type { DatabaseSync } from 'node:sqlite'

const DEPARTMENTS = [
  ['Engineering',  1_200_000],
  ['Marketing',      450_000],
  ['Sales',          800_000],
  ['HR',             200_000],
  ['Finance',        350_000],
  ['Operations',     500_000],
  ['Product',        600_000],
  ['Design',         300_000],
]

const OFFICES = [
  ['SF HQ',       'San Francisco', 'California',   'US', 37.77, -122.41],
  ['NYC Office',  'New York',      'New York',     'US', 40.71, -74.01],
  ['Berlin Hub',  'Berlin',        'Berlin',       'DE', 52.52,  13.40],
  ['London',      'London',        'England',      'GB', 51.51,  -0.13],
  ['Tokyo',       'Tokyo',         'Tokyo',        'JP', 35.67, 139.65],
  ['Bangalore',   'Bangalore',     'Karnataka',    'IN', 12.97,  77.59],
  ['Sydney',      'Sydney',        'NSW',          'AU',-33.87, 151.21],
  ['Sao Paulo',   'Sao Paulo',     'SP',           'BR',-23.55, -46.63],
  ['Toronto',     'Toronto',       'Ontario',      'CA', 43.65, -79.38],
  ['Paris',       'Paris',         'Île-de-France','FR', 48.86,   2.35],
  ['Singapore',   'Singapore',     'Singapore',    'SG',  1.35, 103.82],
  ['Dubai',       'Dubai',         'Dubai',        'AE', 25.20,  55.27],
]

const FIRST_NAMES = [
  'Alice','Bob','Carla','David','Elena','Frank','Grace','Hiroshi','Irina','Johan',
  'Kai','Lei','Maria','Nadia','Omar','Priya','Quinn','Ravi','Sofia','Takuya',
  'Uma','Viktor','Wei','Xiao','Yuki','Zara','Anton','Beatriz','Chen','Diego',
  'Elif','Fatima','Gabriel','Hanna','Ivan','Julia','Kenji','Ling','Ming','Nina',
  'Oscar','Petra','Rashid','Sven','Tina','Ursula','Vivek','Wen','Yara','Zane',
]

const LAST_NAMES = [
  'Johnson','Chen','Silva','Park','Torres','Müller','Kim','Tanaka','Petrov','Andersson',
  'Li','Zhang','Garcia','Rodriguez','Martinez','Brown','Wilson','Taylor','Thomas','Jackson',
  'Lee','Wang','Liu','Yamamoto','Sato','Ito','Watanabe','Nakamura','Kobayashi','Kato',
  'Yoshida','Yamada','Sasaki','Matsumoto','Inoue','Kimura','Shimizu','Hayashi','Ishikawa','Nishimura',
  'Fukuda','Okada','Taniguchi','Murata','Noguchi','Aoki','Sakai','Kondo','Endo','Maruyama',
  'Dubois','Lefebvre','Moreau','Laurent','Simon','Michel','Kuznetsov','Popov','Volkov','Sokolov',
]

const NATIONALITIES = [
  'US','CN','BR','KR','MX','DE','JP','IN','GB','FR','CA','AU','IT','ES','NL','SE',
  'NO','DK','FI','RU','SG','AE','NZ','ZA','AR','CL','CO','PT','IE','CH','AT','BE',
]

const BANDS = ['E1','E2','E3','E4','E5','E6','E7','E8','E9']

const CITIES: Record<string, { region: string; country: string; lat: number; lng: number }> = {
  'San Francisco': { region: 'California',    country: 'US', lat:  37.77, lng: -122.41 },
  'New York':      { region: 'New York',      country: 'US', lat:  40.71, lng: -74.01  },
  'Berlin':        { region: 'Berlin',        country: 'DE', lat:  52.52, lng:  13.40  },
  'London':        { region: 'England',       country: 'GB', lat:  51.51, lng:  -0.13  },
  'Tokyo':         { region: 'Tokyo',         country: 'JP', lat:  35.67, lng: 139.65  },
  'Bangalore':     { region: 'Karnataka',     country: 'IN', lat:  12.97, lng:  77.59  },
  'Sydney':        { region: 'NSW',           country: 'AU', lat:-33.87, lng: 151.21  },
  'Sao Paulo':     { region: 'SP',            country: 'BR', lat:-23.55, lng: -46.63  },
  'Toronto':       { region: 'Ontario',       country: 'CA', lat:  43.65, lng: -79.38  },
  'Paris':         { region: 'Île-de-France', country: 'FR', lat:  48.86, lng:   2.35  },
  'Singapore':     { region: 'Singapore',     country: 'SG', lat:   1.35, lng: 103.82  },
  'Dubai':         { region: 'Dubai',         country: 'AE', lat:  25.20, lng:  55.27  },
  'Mumbai':        { region: 'Maharashtra',   country: 'IN', lat:  19.08, lng:  72.88  },
  'Seoul':         { region: 'Seoul',         country: 'KR', lat:  37.57, lng: 126.98  },
  'Stockholm':     { region: 'Stockholm',     country: 'SE', lat:  59.33, lng:  18.07  },
  'Amsterdam':     { region: 'North Holland', country: 'NL', lat:  52.37, lng:   4.90  },
}

const SKILLS: [string, string][] = [
  ['TypeScript',  'Programming'],
  ['Python',      'Programming'],
  ['SQL',         'Data'],
  ['React',       'Frontend'],
  ['Docker',      'DevOps'],
  ['UI Design',   'Design'],
  ['Rust',        'Programming'],
  ['Go',          'Programming'],
  ['Kubernetes',  'DevOps'],
  ['GraphQL',     'API'],
  ['PostgreSQL',  'Data'],
  ['Redis',       'Data'],
  ['AWS',         'Cloud'],
  ['GCP',         'Cloud'],
  ['Terraform',   'DevOps'],
  ['Figma',       'Design'],
  ['Swift',       'Mobile'],
  ['Kotlin',      'Mobile'],
  ['Machine Learning', 'AI'],
  ['Data Engineering', 'Data'],
  ['Product Strategy', 'Management'],
  ['Agile Coaching',   'Management'],
  ['Technical Writing', 'Documentation'],
  ['Security',     'Infrastructure'],
]

const TEAM_NAMES = [
  ['Platform',      'Core platform infra and services'],
  ['Data Platform', 'Data engineering and pipelines'],
  ['Growth',        'Growth and acquisition'],
  ['Mobile',        'iOS and Android apps'],
  ['Web',           'Web frontend and API'],
  ['ML/AI',         'Machine learning and AI'],
  ['Security',      'Security and compliance'],
  ['Infra',         'Cloud infrastructure and SRE'],
  ['Analytics',     'Business intelligence and analytics'],
  ['CRM',           'Customer relationship management'],
  ['Payments',      'Payments and billing'],
  ['Search',        'Search and recommendations'],
  ['Design System', 'Design system and components'],
  ['QA',            'Quality assurance and testing'],
  ['Content',       'Content and documentation'],
  ['Research',      'User research and insights'],
]

const EVENT_TYPES = ['created', 'review_requested', 'approved', 'changes_requested', 'merged', 'closed', 'reopened', 'commented']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function dateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function randomDate(startY: number, endY: number): string {
  const y = randInt(startY, endY)
  const m = randInt(1, 12)
  const maxD = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const d = randInt(1, m === 2 && y % 4 !== 0 ? 28 : maxD[m - 1])
  return dateStr(y, m, d)
}

export function seed(db: DatabaseSync): void {
  db.exec("ATTACH DATABASE ':memory:' AS analytics")

  // ── Create tables ────────────────────────────────────────────────────────

  db.exec(`CREATE TABLE analytics.departments (
    id INTEGER PRIMARY KEY, name TEXT, budget REAL
  )`)

  db.exec(`CREATE TABLE analytics.offices (
    id INTEGER PRIMARY KEY, name TEXT, city TEXT, region TEXT,
    country TEXT, latitude REAL, longitude REAL, created_at TEXT
  )`)

  db.exec(`CREATE TABLE analytics.employees (
    id INTEGER PRIMARY KEY, name TEXT, email TEXT, active INTEGER,
    sex TEXT, nationality TEXT, band TEXT, birth_date TEXT,
    start_date TEXT, last_working_date TEXT NULL,
    manager_id INTEGER NULL, department_id INTEGER, office_id INTEGER,
    salary REAL, city TEXT, region TEXT, country TEXT,
    latitude REAL, longitude REAL, created_at TEXT
  )`)

  db.exec(`CREATE TABLE analytics.productivity (
    id INTEGER PRIMARY KEY, employee_id INTEGER, department_id INTEGER,
    date TEXT, lines_of_code INTEGER, pull_requests INTEGER,
    live_deployments INTEGER, days_off INTEGER, happiness_index INTEGER,
    created_at TEXT
  )`)

  db.exec(`CREATE TABLE analytics.performance_reviews (
    id INTEGER PRIMARY KEY, employee_id INTEGER, reviewer_id INTEGER,
    review_date TEXT, period_start TEXT, period_end TEXT,
    rating INTEGER, created_at TEXT
  )`)

  db.exec(`CREATE TABLE analytics.pr_events (
    id INTEGER PRIMARY KEY, pr_number INTEGER, event_type TEXT,
    employee_id INTEGER, timestamp TEXT, created_at TEXT
  )`)

  db.exec(`CREATE TABLE analytics.teams (
    id INTEGER PRIMARY KEY, name TEXT, description TEXT,
    department_id INTEGER, created_at TEXT
  )`)

  db.exec(`CREATE TABLE analytics.employee_teams (
    id INTEGER PRIMARY KEY, employee_id INTEGER, team_id INTEGER,
    role TEXT, joined_at TEXT
  )`)

  db.exec(`CREATE TABLE analytics.skills (
    id INTEGER PRIMARY KEY, name TEXT, category TEXT, created_at TEXT
  )`)

  db.exec(`CREATE TABLE analytics.employee_skills (
    id INTEGER PRIMARY KEY, employee_id INTEGER, skill_id INTEGER,
    proficiency_level INTEGER, since_date TEXT
  )`)

  // ── Departments ────────────────────────────────────────────────────────

  const insD = db.prepare('INSERT INTO analytics.departments VALUES (?, ?, ?)')
  for (let i = 0; i < DEPARTMENTS.length; i++) {
    insD.run(i + 1, DEPARTMENTS[i][0], DEPARTMENTS[i][1])
  }

  // ── Offices ────────────────────────────────────────────────────────────

  const insO = db.prepare('INSERT INTO analytics.offices VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  for (let i = 0; i < OFFICES.length; i++) {
    const o = OFFICES[i]
    insO.run(i + 1, o[0], o[1], o[2], o[3], o[4], o[5], randomDate(2018, 2024))
  }

  // ── Employees ──────────────────────────────────────────────────────────

  const insE = db.prepare(`INSERT INTO analytics.employees VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

  // First create managers (E6+) for the first 40 employees, then normal employees
  const managerIds: number[] = []
  const allEmployeeIds: number[] = []
  const employeeDept: number[] = []
  const employeeOffice: number[] = []

  const TOTAL_EMPLOYEES = 250
  const MANAGER_COUNT = 35

  for (let id = 1; id <= TOTAL_EMPLOYEES; id++) {
    const first = pick(FIRST_NAMES)
    const last = pick(LAST_NAMES)
    const name = `${first} ${last}`
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@greencube.io`
    const isActive = Math.random() < 0.92 ? 1 : 0
    const sex = Math.random() < 0.48 ? 'F' : 'M'
    const nationality = pick(NATIONALITIES)
    const isManager = id <= MANAGER_COUNT
    const band = pick(isManager ? ['E5','E6','E7','E8','E9'] : ['E1','E2','E3','E4'])
    const birthYear = randInt(1975, 1998)
    const birthDate = dateStr(birthYear, randInt(1, 12), randInt(1, 28))
    const startYear = randInt(2018, 2024)
    const startDate = randomDate(startYear, startYear)
    const lastWDate = isActive ? null : randomDate(2023, 2025)
    const deptIdx = randInt(0, DEPARTMENTS.length - 1)
    const deptId = deptIdx + 1
    const officeIdx = randInt(0, OFFICES.length - 1)
    const officeId = officeIdx + 1
    const city = OFFICES[officeIdx][1] as string
    const loc = CITIES[city]
    const bandBase = ['E1','E2','E3','E4','E5','E6','E7','E8','E9'].indexOf(band)
    const salary = Math.round(40000 + bandBase * 25000 + randInt(0, 20000) + (loc?.country === 'US' || loc?.country === 'AU' || loc?.country === 'GB' ? 30000 : 0))

    // Assign manager (skip for first MANAGER_COUNT — they manage themselves or null)
    const managerId = isManager ? null : pick(
      managerIds.filter((mid) => mid !== id && employeeDept[mid - 1] === deptId) // same dept
        .concat(
          managerIds.filter((mid) => mid !== id)
        )
    ) ?? pick(managerIds.filter((mid) => mid !== id)) ?? null

    insE.run(
      id, name, email, isActive, sex, nationality, band, birthDate,
      startDate, lastWDate, managerId, deptId, officeId, salary,
      city, loc?.region ?? '', loc?.country ?? '',
      loc?.lat ?? 0, loc?.lng ?? 0, startDate,
    )

    allEmployeeIds.push(id)
    employeeDept.push(deptId)
    employeeOffice.push(officeId)
    if (isManager) managerIds.push(id)
  }

  // ── Productivity ───────────────────────────────────────────────────────

  const insP = db.prepare('INSERT INTO analytics.productivity VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  let prodId = 1

  for (let ei = 0; ei < allEmployeeIds.length; ei++) {
    const empId = allEmployeeIds[ei]
    const deptId = employeeDept[ei]

    // 18 months of weekly records per employee
    for (let month = 0; month < 18; month++) {
      const year = 2023 + Math.floor(month / 12)
      const m = (month % 12) + 1
      for (let week = 0; week < 4; week++) {
        const day = week * 7 + randInt(1, 5)
        const d = dateStr(year, m, Math.min(day, [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]))
        const isDayOff = Math.random() < 0.15 ? 1 : 0
        const loc = CITIES[OFFICES[employeeOffice[ei] - 1][1] as keyof typeof CITIES]
        const isWeekend = ![1,2,3,4,5].includes(randInt(1, 7))
        insP.run(
          prodId++, empId, deptId, d,
          isDayOff ? 0 : randInt(50, 450),
          isDayOff ? 0 : randInt(0, 5),
          isDayOff ? 0 : randInt(0, 3),
          isDayOff,
          isDayOff ? null : clamp(Math.round(randInt(3, 10) + (Math.random() < 0.3 ? randInt(0, 0) : 0)), 1, 10),
          d,
        )
      }
    }
  }

  // ── Performance Reviews ─────────────────────────────────────────────────

  const insR = db.prepare('INSERT INTO analytics.performance_reviews VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  let revId = 1

  for (let ei = 0; ei < allEmployeeIds.length; ei++) {
    const empId = allEmployeeIds[ei]
    const deptId = employeeDept[ei]

    // 2-8 reviews per employee across years
    const reviewCount = randInt(2, 8)
    const startYear = randInt(2020, 2023)

    for (let r = 0; r < reviewCount; r++) {
      const year = startYear + Math.floor(r / 2)
      const half = (r % 2) + 1
      const reviewMonth = half === 1 ? 6 : 12
      const reviewDay = randInt(15, 28)
      const reviewDate = dateStr(year, reviewMonth, reviewDay)
      const periodStart = dateStr(half === 1 ? year : year - (half === 2 ? 0 : 0), half === 1 ? 1 : 7, 1)
      const periodEnd = reviewDate
      const rating = clamp(randInt(2, 10) + (Math.random() < 0.6 ? randInt(0, 1) : 0), 1, 10)

      // Pick a reviewer — anyone from same dept
      const sameDept = Array.from({ length: allEmployeeIds.length }, (_, i) => i)
        .filter((i) => employeeDept[i] === deptId && allEmployeeIds[i] !== empId)
      const reviewerId = sameDept.length > 0 ? pick(sameDept.map((i) => allEmployeeIds[i])) : pick(managerIds)

      insR.run(revId++, empId, reviewerId, reviewDate, periodStart, periodEnd, rating, reviewDate)
    }
  }

  // ── PR Events ──────────────────────────────────────────────────────────

  const insPE = db.prepare('INSERT INTO analytics.pr_events VALUES (?, ?, ?, ?, ?, ?)')
  let prEventId = 1

  for (let prNum = 100; prNum < 500; prNum++) {
    const eventsForPr = randInt(2, 5)
    const authorId = pick(allEmployeeIds)

    for (let e = 0; e < eventsForPr; e++) {
      const eventType = pick(EVENT_TYPES)
      // reviewer is someone else from same dept
      const sameDept = Array.from({ length: allEmployeeIds.length }, (_, i) => i)
        .filter((i) => employeeDept[i] === employeeDept[authorId - 1] && allEmployeeIds[i] !== authorId)
      const actorId = eventType === 'created' || eventType === 'merged' || eventType === 'reopened'
        ? authorId
        : sameDept.length > 0
          ? pick(sameDept.map((i) => allEmployeeIds[i]))
          : pick(allEmployeeIds.filter((a) => a !== authorId)) ?? authorId

      const ts = randomDate(2023, 2025)
      insPE.run(prEventId++, prNum, eventType, actorId, ts, ts)
    }
  }

  // ── Teams ──────────────────────────────────────────────────────────────

  const insT = db.prepare('INSERT INTO analytics.teams VALUES (?, ?, ?, ?, ?)')
  for (let i = 0; i < TEAM_NAMES.length; i++) {
    const deptId = i < 4 ? 1 : i < 10 ? randInt(1, 7) : randInt(1, 8)
    insT.run(i + 1, TEAM_NAMES[i][0], TEAM_NAMES[i][1], deptId, randomDate(2020, 2024))
  }

  // ── Employee Teams ─────────────────────────────────────────────────────

  const insET = db.prepare('INSERT INTO analytics.employee_teams VALUES (?, ?, ?, ?, ?)')
  let empTeamId = 1
  const assignedPairs = new Set<string>()

  for (let ei = 0; ei < allEmployeeIds.length; ei++) {
    const empId = allEmployeeIds[ei]
    const teamsForEmp = randInt(1, 4)

    for (let t = 0; t < teamsForEmp; t++) {
      const teamId = randInt(1, TEAM_NAMES.length)
      const pairKey = `${empId}-${teamId}`
      if (assignedPairs.has(pairKey)) continue
      assignedPairs.add(pairKey)

      const role = randInt(1, 10) === 1 ? 'lead' : 'member'
      insET.run(empTeamId++, empId, teamId, role, randomDate(2021, 2025))
    }
  }

  // ── Skills ─────────────────────────────────────────────────────────────

  const insS = db.prepare('INSERT INTO analytics.skills VALUES (?, ?, ?, ?)')
  for (let i = 0; i < SKILLS.length; i++) {
    insS.run(i + 1, SKILLS[i][0], SKILLS[i][1], randomDate(2020, 2024))
  }

  // ── Employee Skills ────────────────────────────────────────────────────

  const insES = db.prepare('INSERT INTO analytics.employee_skills VALUES (?, ?, ?, ?, ?)')
  let empSkillId = 1
  const esAssigned = new Set<string>()

  for (let ei = 0; ei < allEmployeeIds.length; ei++) {
    const empId = allEmployeeIds[ei]
    const skillsForEmp = randInt(2, 8)

    for (let s = 0; s < skillsForEmp; s++) {
      const skillId = randInt(1, SKILLS.length)
      const pairKey = `${empId}-${skillId}`
      if (esAssigned.has(pairKey)) continue
      esAssigned.add(pairKey)

      const proficiency = clamp(randInt(1, 5), 1, 5)
      insES.run(empSkillId++, empId, skillId, proficiency, randomDate(2019, 2025))
    }
  }
}
